import { Fragment, useMemo, useState } from 'react'
import type { MessageTemplate, TemplatePurpose } from '@/types'
import { STORAGE_PREFIX } from '@/config/app'
import { PERSONAL_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import {
  useCompanyMap,
  useContactMap,
  useOpportunityMap,
  useTemplateMap,
  useTemplates,
} from '@/hooks/outreach'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { nowClockTime, todayISO } from '@/utils/date'
import { CHANNEL_META, PURPOSE_META, STAGE_META } from '@/utils/outreach'
import { composeLinks, renderTemplate } from '@/utils/templates'
import type { TemplateVariable } from '@/utils/templates'

export interface ComposeDialogProps {
  open: boolean
  onClose: () => void
  /** Any subset of the chain; the rest is resolved (opportunity → contact → company). */
  opportunityId?: string
  contactId?: string
  companyId?: string
  /** Pre-selects a template; its channel becomes the starting channel. */
  templateId?: string
}

type ComposeChannel = MessageTemplate['channel']

/** A type alias, not an interface, so it satisfies `TemplateVars`' index signature. */
type Vars = Record<TemplateVariable, string>

/** What is remembered between openings: the channel, and the last template used on each. */
interface Remembered {
  channel?: ComposeChannel
  email?: string
  linkedin?: string
}

const REMEMBER_KEY = `${STORAGE_PREFIX}.compose.lastTemplate`

const CHANNEL_OPTIONS: { value: ComposeChannel; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'Link' },
]

const PURPOSES = Object.keys(PURPOSE_META) as TemplatePurpose[]

/** Splits on `{{var}}` tokens while keeping them, so the preview can mark the unfilled ones. */
const TOKEN_SPLIT_RE = /(\{\{\s*[A-Za-z0-9_-]+\s*\}\})/g
const TOKEN_ONLY_RE = /^\{\{\s*[A-Za-z0-9_-]+\s*\}\}$/

function firstName(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  return words[0] ?? ''
}

/** "linkedin.com/in/x" → "https://linkedin.com/in/x"; anything with a scheme is untouched. */
function ensureScheme(url: string): string {
  const value = url.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Clipboard write with the old `execCommand` path as a fallback for browsers
 * that refuse the async API outside a secure context.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** Preview text with every unfilled `{{var}}` marked. */
function Highlighted({ text }: { text: string }) {
  const parts = text.split(TOKEN_SPLIT_RE)
  return (
    <>
      {parts.map((part, index) =>
        TOKEN_ONLY_RE.test(part) ? (
          <mark
            key={index}
            className="rounded-sm bg-warning-soft px-1 font-mono text-[0.9em] text-ink"
          >
            {part}
          </mark>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  )
}

/**
 * The heart of the module: pick a template, fill the five variables, read the
 * result, then open it in Gmail / the mail app or copy it for LinkedIn — and
 * log the touch in the same click.
 *
 * Nothing is ever sent from this site. There is no server to send from; the
 * message opens in the user's own client, pre-filled.
 */
export function ComposeDialog({
  open,
  onClose,
  opportunityId,
  contactId,
  companyId,
  templateId,
}: ComposeDialogProps) {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()

  const opportunityMap = useOpportunityMap()
  const contactMap = useContactMap()
  const companyMap = useCompanyMap()
  const templateMap = useTemplateMap()
  const allTemplates = useTemplates(true)

  const [remembered, remember] = useLocalStorage<Remembered>(REMEMBER_KEY, {})

  // Resolve the record chain. Explicit ids win; the rest follows the links.
  const opportunity = opportunityId ? opportunityMap.get(opportunityId) : undefined
  const contact = contactMap.get(contactId ?? opportunity?.contactId ?? '')
  const company = companyMap.get(companyId ?? opportunity?.companyId ?? contact?.companyId ?? '')

  const initialChannel = (): ComposeChannel => {
    const preset = templateId ? templateMap.get(templateId) : undefined
    if (preset) return preset.channel
    if (contact && !contact.email && contact.linkedinUrl) return 'linkedin'
    if (contact?.email) return 'email'
    return remembered.channel ?? 'email'
  }
  const initialVars = (): Vars => ({
    name: contact ? firstName(contact.name) : '',
    company: company?.name ?? '',
    role: opportunity?.title ?? '',
    hook: '',
    me: db.settings.displayName.trim() || profile.name,
  })

  const [channel, setChannel] = useState<ComposeChannel>(initialChannel)
  const [selectedId, setSelectedId] = useState<string>(() => templateId ?? '')
  const [vars, setVars] = useState<Vars>(initialVars)
  const [to, setTo] = useState<string>(() => contact?.email ?? '')
  const [shouldLog, setShouldLog] = useState(true)
  const [loggedTouchId, setLoggedTouchId] = useState<string | null>(null)

  // Reset on the way in, keyed by what is being composed for.
  const session = open
    ? [opportunityId, contactId, companyId, templateId].map((id) => id ?? '').join('|')
    : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setChannel(initialChannel())
      setSelectedId(templateId ?? '')
      setVars(initialVars())
      setTo(contact?.email ?? '')
      setShouldLog(true)
      setLoggedTouchId(null)
    }
  }

  const templatesForChannel = useMemo(
    () =>
      allTemplates.filter(
        (template) => template.channel === channel && (!template.archived || template.id === selectedId),
      ),
    [allTemplates, channel, selectedId],
  )

  // The chosen template, falling back to what was used last on this channel,
  // then to the first available one.
  const template = useMemo(() => {
    const chosen = templateMap.get(selectedId)
    if (chosen && chosen.channel === channel) return chosen
    const last = templateMap.get(remembered[channel] ?? '')
    if (last && last.channel === channel && !last.archived) return last
    return templatesForChannel[0]
  }, [templateMap, selectedId, channel, remembered, templatesForChannel])

  const grouped = useMemo(
    () =>
      PURPOSES.map((purpose) => ({
        purpose,
        templates: templatesForChannel.filter((item) => item.purpose === purpose),
      })).filter((group) => group.templates.length > 0),
    [templatesForChannel],
  )

  const rendered = useMemo(
    () =>
      template
        ? renderTemplate({ subject: template.subject, body: template.body }, vars)
        : { subject: '', body: '', missing: [] },
    [template, vars],
  )

  const links = useMemo(
    () => composeLinks({ to, subject: rendered.subject, body: rendered.body }),
    [to, rendered.subject, rendered.body],
  )

  const profileUrl = contact?.linkedinUrl?.trim()
    ? ensureScheme(contact.linkedinUrl)
    : company?.linkedinUrl?.trim()
      ? ensureScheme(company.linkedinUrl)
      : undefined
  const profileLabel = contact?.linkedinUrl?.trim() ? 'Open LinkedIn profile' : 'Open company on LinkedIn'

  const words = wordCount(rendered.body)
  const patchVars = (next: Partial<Vars>) => setVars((prev) => ({ ...prev, ...next }))

  /** Stores the channel and the template used on it, without a computed key the type checker widens. */
  const rememberChoice = (nextChannel: ComposeChannel, id: string) => {
    remember(
      nextChannel === 'email'
        ? { ...remembered, channel: nextChannel, email: id }
        : { ...remembered, channel: nextChannel, linkedin: id },
    )
  }

  const chooseChannel = (next: ComposeChannel) => {
    setChannel(next)
    remember({ ...remembered, channel: next })
  }

  const chooseTemplate = (id: string) => {
    setSelectedId(id)
    rememberChoice(channel, id)
  }

  /**
   * Logs the outbound touch once per opening. Returns the sentence the caller
   * appends to its own toast so a copy and a log read as one event.
   */
  const logTouchIfWanted = (): { note: string; undo: () => void } | null => {
    if (!shouldLog || !template || loggedTouchId) return null
    const who = contact?.name ?? company?.name
    // Mirrors the documented side effect of `addTouch`: outbound while
    // 'researching' moves the opportunity to 'contacted'.
    const moved = opportunity?.stage === 'researching'
    const touch = actions.addTouch({
      channel: template.channel,
      direction: 'outbound',
      summary: who ? `${template.name} → ${who}` : template.name,
      templateId: template.id,
      opportunityId: opportunity?.id,
      contactId: contact?.id,
      companyId: company?.id,
      date: todayISO(),
      time: nowClockTime(),
    })
    setLoggedTouchId(touch.id)
    rememberChoice(channel, template.id)
    const note = `Logged as an outbound ${CHANNEL_META[template.channel].label.toLowerCase()} touch${who ? ` to ${who}` : ''}.${
      moved && opportunity ? ` ${opportunity.title} moved to ${STAGE_META.contacted.label}.` : ''
    }`
    return {
      note,
      undo: () => {
        actions.deleteTouch(touch.id)
        setLoggedTouchId(null)
      },
    }
  }

  const copy = async (text: string, what: string) => {
    const ok = await copyText(text)
    if (!ok) {
      toast({
        title: `Could not copy the ${what}`,
        description: 'Select the preview and copy it by hand.',
        tone: 'danger',
      })
      return
    }
    const logged = logTouchIfWanted()
    toast({
      title: `Copied ${what}`,
      description: logged?.note,
      tone: 'positive',
      action: logged ? { label: 'Undo log', onClick: logged.undo } : undefined,
    })
  }

  const opened = (where: string) => {
    const logged = logTouchIfWanted()
    toast({
      title: `Opening ${where}`,
      description: logged?.note ?? 'Nothing was sent from this site — finish it in your own client.',
      tone: logged ? 'positive' : 'neutral',
      action: logged ? { label: 'Undo log', onClick: logged.undo } : undefined,
    })
  }

  const contextChips = [
    contact ? { icon: 'User', label: contact.name } : null,
    company ? { icon: 'Building2', label: company.name } : null,
    opportunity ? { icon: 'Briefcase', label: opportunity.title } : null,
  ].filter((chip): chip is { icon: string; label: string } => chip !== null)

  const noTemplatesAtAll = allTemplates.filter((item) => !item.archived).length === 0

  const footer = template ? (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Checkbox
        checked={shouldLog || loggedTouchId !== null}
        onCheckedChange={setShouldLog}
        disabled={loggedTouchId !== null}
        label={
          loggedTouchId
            ? 'Logged as an outbound touch'
            : '…and log this as an outbound touch when I copy or open it'
        }
      />
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {channel === 'email' ? (
          <>
            <Button variant="ghost" icon="Copy" onClick={() => copy(rendered.subject, 'subject')}>
              Copy subject
            </Button>
            <Button variant="ghost" icon="Copy" onClick={() => copy(rendered.body, 'body')}>
              Copy body
            </Button>
            <a
              href={links.mailto}
              onClick={() => opened('your mail app')}
              className={buttonClasses('secondary')}
            >
              <Icon name="Mail" size={16} />
              Open mail app
            </a>
            <ButtonLink
              href={links.gmail}
              variant="primary"
              icon="ExternalLink"
              onClick={() => opened('Gmail')}
            >
              Open in Gmail
            </ButtonLink>
          </>
        ) : (
          <>
            {profileUrl ? (
              <ButtonLink
                href={profileUrl}
                variant="secondary"
                icon="ExternalLink"
                onClick={() => opened('LinkedIn')}
              >
                {profileLabel}
              </ButtonLink>
            ) : null}
            <Button variant="primary" icon="Copy" onClick={() => copy(rendered.body, 'message')}>
              Copy message
            </Button>
          </>
        )}
      </div>
    </div>
  ) : (
    <Button variant="ghost" onClick={onClose}>
      Close
    </Button>
  )

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Compose"
      description="Nothing is sent from this site. The message opens in your own mail client, or is copied for LinkedIn — logging the touch here is what keeps the pipeline honest."
      size="lg"
      className="sm:max-w-4xl"
      footer={footer}
    >
      {noTemplatesAtAll ? (
        <EmptyState
          icon="MessageSquare"
          title="No templates to compose from"
          description="Write one first — a template is just the message you send most, with {{name}}, {{company}}, {{role}}, {{hook}} and {{me}} left blank."
          action={
            <ButtonLink to={PERSONAL_ROUTES.outreachTemplates} variant="primary" icon="Plus">
              Open templates
            </ButtonLink>
          }
          className="mb-2"
        />
      ) : (
        <div className="flex flex-col gap-5 pb-1">
          {contextChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {contextChips.map((chip) => (
                <Badge key={`${chip.icon}-${chip.label}`} tone="neutral" icon={chip.icon}>
                  {chip.label}
                </Badge>
              ))}
              {opportunity ? (
                <Badge tone={STAGE_META[opportunity.stage].tone} size="md">
                  {STAGE_META[opportunity.stage].label}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Left: what to send and the five blanks. */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-ink">Channel</span>
                <SegmentedControl<ComposeChannel>
                  value={channel}
                  onChange={chooseChannel}
                  options={CHANNEL_OPTIONS}
                  ariaLabel="Compose channel"
                  className="w-full"
                />
              </div>

              <Field
                label="Template"
                hint={
                  templatesForChannel.length === 0
                    ? `No ${channel === 'email' ? 'email' : 'LinkedIn'} templates yet — add one on the Templates page.`
                    : 'The last one used on this channel is remembered.'
                }
              >
                <Select
                  value={template?.id ?? ''}
                  onChange={(event) => chooseTemplate(event.target.value)}
                  disabled={templatesForChannel.length === 0}
                >
                  {templatesForChannel.length === 0 ? <option value="">None available</option> : null}
                  {grouped.map((group) => (
                    <optgroup key={group.purpose} label={PURPOSE_META[group.purpose].label}>
                      {group.templates.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.archived ? ' (archived)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>

              {channel === 'email' ? (
                <Field
                  label="To"
                  hint={contact?.email ? 'From the contact record.' : 'Optional. Leave blank to fill it in your client.'}
                >
                  <Input
                    type="email"
                    value={to}
                    onChange={(event) => setTo(event.target.value)}
                    placeholder="name@company.com"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
              ) : null}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Name" hint="How you address them.">
                  <Input
                    value={vars.name}
                    onChange={(event) => patchVars({ name: event.target.value })}
                    placeholder="Priya"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Company">
                  <Input
                    value={vars.company}
                    onChange={(event) => patchVars({ company: event.target.value })}
                    placeholder="Acme"
                    autoComplete="off"
                  />
                </Field>
              </div>

              <Field label="Role">
                <Input
                  value={vars.role}
                  onChange={(event) => patchVars({ role: event.target.value })}
                  placeholder="Backend Engineering Intern"
                  autoComplete="off"
                />
              </Field>

              <Field
                label="The one specific line about them"
                hint="Why this person, this week. Something you could only say after reading their work."
              >
                <Textarea
                  autoGrow
                  rows={2}
                  value={vars.hook}
                  onChange={(event) => patchVars({ hook: event.target.value })}
                  placeholder="Your write-up on migrating the billing schema without downtime was the most useful thing I read this month."
                />
              </Field>

              <Field label="Sign-off" hint="Fills {{me}}.">
                <Input
                  value={vars.me}
                  onChange={(event) => patchVars({ me: event.target.value })}
                  autoComplete="name"
                />
              </Field>
            </div>

            {/* Right: what they will actually read. */}
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">Preview</span>
                <span className="font-mono text-xs text-ink-faint tabular-nums">
                  ≈ {words} {words === 1 ? 'word' : 'words'}
                </span>
              </div>

              {template ? (
                <div className="rounded-card border border-line bg-surface-muted/40">
                  {channel === 'email' ? (
                    <>
                      <p className="border-b border-line px-4 py-2.5 text-xs text-ink-faint">
                        <span className="font-medium">To </span>
                        {to.trim() ? (
                          <span className="font-mono text-ink">{to.trim()}</span>
                        ) : (
                          <span>not set</span>
                        )}
                      </p>
                      <p className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
                        <span className="font-normal text-ink-faint">Subject </span>
                        {rendered.subject ? (
                          <Highlighted text={rendered.subject} />
                        ) : (
                          <span className="font-normal text-ink-faint">(none)</span>
                        )}
                      </p>
                    </>
                  ) : null}
                  <div className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                    <Highlighted text={rendered.body} />
                  </div>
                </div>
              ) : (
                <div className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
                  Pick a template to see the message.
                </div>
              )}

              <p
                aria-live="polite"
                className={cn(
                  'flex items-start gap-1.5 text-xs leading-relaxed',
                  rendered.missing.length > 0 ? 'text-warning' : 'text-ink-faint',
                )}
              >
                <Icon
                  name={rendered.missing.length > 0 ? 'TriangleAlert' : 'CircleCheckBig'}
                  size={13}
                  className="mt-px shrink-0"
                />
                <span>
                  {rendered.missing.length > 0
                    ? `${rendered.missing.length} still to fill: ${rendered.missing
                        .map((name) => `{{${name}}}`)
                        .join(', ')}`
                    : template
                      ? 'Every variable is filled.'
                      : 'Nothing to check yet.'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  )
}
