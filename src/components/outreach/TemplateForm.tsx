import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MessageTemplate, TemplatePurpose } from '@/types'
import type { TemplateInput } from '@/services/contracts'
import { profile } from '@/data'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { useTemplateMap } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { PURPOSE_META } from '@/utils/outreach'
import { TEMPLATE_VARIABLES, extractVariables, renderTemplate } from '@/utils/templates'
import type { TemplateVariable } from '@/utils/templates'

export interface TemplateFormProps {
  open: boolean
  onClose: () => void
  /** Present when editing; absent when creating. */
  templateId?: string
  /** Pre-fills a new template, e.g. a duplicate. */
  defaults?: Partial<TemplateInput>
}

type Channel = MessageTemplate['channel']

interface Values {
  name: string
  channel: Channel
  purpose: TemplatePurpose
  subject: string
  body: string
}

interface Errors {
  name?: string
  body?: string
}

const CHANNEL_OPTIONS: { value: Channel; label: string; icon: string }[] = [
  { value: 'email', label: 'Email', icon: 'Mail' },
  { value: 'linkedin', label: 'LinkedIn', icon: 'Link' },
]

const PURPOSES = Object.keys(PURPOSE_META) as TemplatePurpose[]

const VARIABLE_HINT: Record<TemplateVariable, string> = {
  name: 'the person',
  company: 'their company',
  role: 'the role',
  hook: 'your one specific line',
  me: 'your sign-off',
}

/** Realistic stand-ins so the preview reads like a real message, not a form. */
const SAMPLE_VARS = {
  name: 'Priya',
  company: 'Acme Labs',
  role: 'Backend Engineering Intern',
  hook: 'Your write-up on migrating the billing schema without downtime was the most useful thing I read this month.',
}

const KNOWN_VARIABLES = new Set<string>(TEMPLATE_VARIABLES)

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Create or edit a message template, with the rendered result beside it.
 *
 * The variable buttons insert at the caret rather than appending, so a
 * template can be edited in the middle without retyping the token by hand.
 */
export function TemplateForm({ open, onClose, templateId, defaults }: TemplateFormProps) {
  const formId = `template-form-${useId()}`
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const templateMap = useTemplateMap()

  const existing = templateId ? templateMap.get(templateId) : undefined

  const initialValues = (): Values => ({
    name: existing?.name ?? defaults?.name ?? '',
    channel: existing?.channel ?? defaults?.channel ?? 'email',
    purpose: existing?.purpose ?? defaults?.purpose ?? 'cold',
    subject: existing?.subject ?? defaults?.subject ?? '',
    body: existing?.body ?? defaults?.body ?? '',
  })

  const [values, setValues] = useState<Values>(initialValues)
  const [errors, setErrors] = useState<Errors>({})

  const session = open ? (templateId ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(initialValues())
      setErrors({})
    }
  }

  const patch = (next: Partial<Values>) => setValues((prev) => ({ ...prev, ...next }))

  // Caret restoration after an insert: the position is parked in a ref and
  // applied once the controlled textarea has re-rendered with the new value.
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    const position = pendingCaret.current
    if (position === null) return
    pendingCaret.current = null
    const element = bodyRef.current
    if (element) {
      element.focus()
      element.setSelectionRange(position, position)
    }
  }, [values.body])

  const insertVariable = (name: TemplateVariable) => {
    const token = `{{${name}}}`
    const element = bodyRef.current
    const start = element?.selectionStart ?? values.body.length
    const end = element?.selectionEnd ?? values.body.length
    const before = values.body.slice(0, start)
    const after = values.body.slice(end)
    // A space either side when the token lands mid-word.
    const lead = before && !/\s$/.test(before) ? ' ' : ''
    const trail = after && !/^[\s,.!?;:]/.test(after) ? ' ' : ''
    const inserted = `${lead}${token}${trail}`
    pendingCaret.current = start + inserted.length
    patch({ body: `${before}${inserted}${after}` })
  }

  const used = useMemo(
    () => extractVariables(`${values.subject}\n${values.body}`),
    [values.subject, values.body],
  )
  const unknown = used.filter((name) => !KNOWN_VARIABLES.has(name))

  const preview = useMemo(
    () =>
      renderTemplate(
        { subject: values.channel === 'email' ? values.subject : undefined, body: values.body },
        { ...SAMPLE_VARS, me: db.settings.displayName.trim() || profile.name },
      ),
    [values.channel, values.subject, values.body, db.settings.displayName],
  )

  const words = wordCount(preview.body)

  const handleSubmit = () => {
    const name = values.name.trim()
    const body = values.body.replace(/\r\n?/g, '\n').trim()
    const nextErrors: Errors = {}
    if (!name) nextErrors.name = 'Name it so you recognise it in the picker.'
    if (!body) nextErrors.body = 'The message itself cannot be empty.'
    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.body) return

    const input: TemplateInput = {
      name,
      channel: values.channel,
      purpose: values.purpose,
      subject: values.channel === 'email' ? values.subject.trim() || undefined : undefined,
      body,
    }

    if (existing) {
      actions.updateTemplate(existing.id, input)
      toast({ title: 'Template saved', description: name })
    } else {
      actions.addTemplate(input)
      toast({ title: 'Template added', description: name, tone: 'positive' })
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? 'Edit template' : 'New template'}
      description="Write it once with the blanks left in. Compose fills them for each person; the response rate is measured per template."
      size="lg"
      className="sm:max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {existing ? 'Save changes' : 'Add template'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-5 pb-1 md:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Name" required error={errors.name}>
            <Input
              value={values.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Cold email — founder / hiring manager"
              autoComplete="off"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Channel</span>
              <SegmentedControl<Channel>
                value={values.channel}
                onChange={(channel) => patch({ channel })}
                options={CHANNEL_OPTIONS}
                ariaLabel="Template channel"
                className="w-full"
              />
            </div>
            <Field label="Purpose" hint="Groups the template in the picker.">
              <Select
                value={values.purpose}
                onChange={(event) => patch({ purpose: event.target.value as TemplatePurpose })}
              >
                {PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {PURPOSE_META[purpose].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {values.channel === 'email' ? (
            <Field label="Subject" hint="Variables work here too.">
              <Input
                value={values.subject}
                onChange={(event) => patch({ subject: event.target.value })}
                placeholder="{{role}} at {{company}} — {{me}}"
                autoComplete="off"
              />
            </Field>
          ) : null}

          <Field
            label="Message"
            required
            error={errors.body}
            hint="Under 120 words for a cold message. Insert a variable at the cursor with the buttons above the box."
          >
            <div className="flex flex-col gap-2">
              <div
                role="group"
                aria-label="Insert a variable at the cursor"
                className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5"
              >
                {TEMPLATE_VARIABLES.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="subtle"
                    size="sm"
                    onClick={() => insertVariable(name)}
                    title={`Insert {{${name}}} — ${VARIABLE_HINT[name]}`}
                    className="shrink-0 font-mono text-xs"
                  >
                    {`{{${name}}}`}
                  </Button>
                ))}
              </div>
              <Textarea
                ref={bodyRef}
                rows={10}
                value={values.body}
                onChange={(event) => patch({ body: event.target.value })}
                placeholder={'Hi {{name}},\n\n{{hook}}\n\n…\n\n{{me}}'}
                className="font-mono text-[13px] leading-relaxed"
                spellCheck
              />
            </div>
          </Field>

          {unknown.length > 0 ? (
            <p className="flex items-start gap-1.5 text-xs leading-relaxed text-warning" role="status">
              <Icon name="TriangleAlert" size={13} className="mt-px shrink-0" />
              <span>
                {unknown.map((name) => `{{${name}}}`).join(', ')}{' '}
                {unknown.length === 1 ? 'is not a known variable and' : 'are not known variables and'}{' '}
                will never be filled. Use {TEMPLATE_VARIABLES.map((name) => `{{${name}}}`).join(', ')}.
              </span>
            </p>
          ) : null}
        </form>

        <aside aria-label="Preview with sample values" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-ink">Preview</span>
            <span className="font-mono text-xs text-ink-faint tabular-nums">
              ≈ {words} {words === 1 ? 'word' : 'words'}
            </span>
          </div>

          <div className="rounded-card border border-line bg-surface-muted/40">
            {values.channel === 'email' ? (
              <p className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
                <span className="font-normal text-ink-faint">Subject </span>
                {preview.subject || <span className="font-normal text-ink-faint">(none)</span>}
              </p>
            ) : null}
            <div
              className={cn(
                'px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                preview.body ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {preview.body || 'The message appears here as you type.'}
            </div>
          </div>

          <p className="text-xs leading-relaxed text-ink-faint">
            Sample values: Priya at Acme Labs, for a Backend Engineering Intern role, signed{' '}
            {db.settings.displayName.trim() || profile.name}.
          </p>

          {used.length > 0 ? (
            <ul aria-label="Variables used" className="flex flex-wrap gap-1.5">
              {used.map((name) => (
                <li
                  key={name}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 font-mono text-[11px]',
                    KNOWN_VARIABLES.has(name)
                      ? 'bg-surface-muted text-ink-muted'
                      : 'bg-warning-soft text-ink',
                  )}
                >
                  {`{{${name}}}`}
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>
    </Dialog>
  )
}
