import { useId, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Opportunity, OpportunityType, Touch } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Avatar } from '@/components/ui/Avatar'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { ComposeDialog } from '@/components/outreach/ComposeDialog'
import { ContactForm } from '@/components/outreach/ContactForm'
import { StageBadge } from '@/components/outreach/StageBadge'
import { TouchForm } from '@/components/outreach/TouchForm'
import { TouchList } from '@/components/outreach/TouchList'
import { WarmthBadge } from '@/components/outreach/WarmthBadge'
import { useCompanyMap, useContactMap } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { pluralize, initialsOf } from '@/utils/format'
import { isTerminal, responseRate, WARMTH_META } from '@/utils/outreach'

export interface ContactDetailProps {
  contactId: string | null
  onClose: () => void
}

const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
}

/** Newest first: date, then time, then when it was logged — the order `useTouches` uses. */
function newestFirst(a: Touch, b: Touch): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt.localeCompare(a.createdAt)
  )
}

/** Open opportunities first, then the most recently updated. */
function byOpenThenRecent(a: Opportunity, b: Opportunity): number {
  const aOpen = isTerminal(a.stage) ? 1 : 0
  const bOpen = isTerminal(b.stage) ? 1 : 0
  return aOpen - bOpen || b.updatedAt.localeCompare(a.updatedAt)
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string
  count?: number
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {count !== undefined ? (
            <span className="rounded-full bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-ink-faint">
              {count}
            </span>
          ) : null}
        </h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/**
 * Everything about one person, in a dialog: who they are, how warm, how to
 * reach them, the roles being pursued through them and every touch so far.
 *
 * Composing opens Gmail or the mail client pre-filled — nothing is sent from
 * here — and logging a touch is the manual record of what actually went out.
 */
export function ContactDetail({ contactId, onClose }: ContactDetailProps) {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const contact = useContactMap().get(contactId ?? '')
  const companyMap = useCompanyMap()
  const company = contact?.companyId ? companyMap.get(contact.companyId) : undefined

  const [editOpen, setEditOpen] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [touchFormOpen, setTouchFormOpen] = useState(false)
  const [editingTouchId, setEditingTouchId] = useState<string | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState(false)

  const opportunities = useMemo(
    () =>
      contact
        ? db.opportunities.filter((o) => o.contactId === contact.id).sort(byOpenThenRecent)
        : [],
    [db.opportunities, contact],
  )
  const touches = useMemo(
    () =>
      contact ? db.touches.filter((t) => t.contactId === contact.id).sort(newestFirst) : [],
    [db.touches, contact],
  )
  const rate = useMemo(() => responseRate(touches, db.touches), [touches, db.touches])
  const openCount = opportunities.filter((o) => !isTerminal(o.stage)).length

  /*
   * Notes are edited in place and saved on blur. The draft is re-seeded
   * whenever the record itself changes (a different contact, or an edit made
   * through the form), never while the person is typing.
   */
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const session = contact ? `${contact.id}::${contact.updatedAt}` : 'none'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    setNotes(contact?.notes ?? '')
  }

  const saveNotes = () => {
    if (!contact) return
    const next = notes.trim()
    if (next === (contact.notes ?? '')) return
    actions.updateContact(contact.id, { notes: next || undefined })
    toast({ title: 'Notes saved', description: contact.name, duration: 2000 })
  }

  const copyEmail = async () => {
    if (!contact?.email) return
    try {
      await navigator.clipboard.writeText(contact.email)
      toast({ title: 'Email copied', description: contact.email, duration: 2000 })
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Select the address and copy it by hand.',
        tone: 'danger',
      })
    }
  }

  const confirmDelete = () => {
    if (!contact) return
    const name = contact.name
    actions.deleteContact(contact.id)
    setPendingDelete(false)
    toast({
      title: 'Contact deleted',
      description: `${name} removed. Their touches and opportunities were kept and unlinked.`,
    })
    onClose()
  }

  const editTouch = (id: string) => {
    setEditingTouchId(id)
    setTouchFormOpen(true)
  }

  const logTouch = () => {
    setEditingTouchId(undefined)
    setTouchFormOpen(true)
  }

  const open = contactId !== null && contact !== undefined

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={contact?.name ?? 'Contact'}
        description={
          contact
            ? [contact.role, company?.name].filter(Boolean).join(' · ') || undefined
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button
              variant="ghost"
              icon="Trash"
              onClick={() => setPendingDelete(true)}
              className="mr-auto text-danger hover:bg-danger-soft hover:text-danger"
            >
              Delete
            </Button>
            <Button variant="secondary" icon="Pencil" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="secondary" icon="Plus" onClick={logTouch}>
              Log touch
            </Button>
            <Button variant="primary" icon="Send" onClick={() => setComposeOpen(true)}>
              Compose
            </Button>
          </>
        }
      >
        {contact ? (
          <div className="space-y-6 pb-2">
            {/* Identity */}
            <section aria-label="Identity" className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <Avatar initials={initialsOf(contact.name)} size={56} className="shrink-0" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <WarmthBadge warmth={contact.warmth} />
                  {company ? (
                    <ButtonLink
                      to={`${PERSONAL_ROUTES.outreachCompanies}?id=${encodeURIComponent(company.id)}`}
                      variant="ghost"
                      size="sm"
                      icon="Building2"
                      iconRight="ArrowRight"
                    >
                      {company.name}
                    </ButtonLink>
                  ) : (
                    <span className="text-xs text-ink-faint">No company linked</span>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-ink-muted">
                  {WARMTH_META[contact.warmth].hint}
                </p>

                <dl className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">Email</dt>
                    <dd className="flex min-w-0 flex-1 items-center gap-2">
                      <Icon name="Mail" size={14} className="shrink-0 text-ink-faint" />
                      {contact.email ? (
                        <>
                          <a
                            href={`mailto:${contact.email}`}
                            className="truncate rounded-sm font-mono text-[13px] text-ink underline-offset-2 hover:text-accent hover:underline"
                          >
                            {contact.email}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            icon="Copy"
                            aria-label={`Copy email address ${contact.email}`}
                            onClick={copyEmail}
                            className="size-8 pointer-coarse:size-11"
                          />
                        </>
                      ) : (
                        <span className="text-ink-faint">No email on file</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">LinkedIn</dt>
                    <dd className="flex min-w-0 flex-1 items-center gap-2">
                      <Icon name="Link" size={14} className="shrink-0 text-ink-faint" />
                      {contact.linkedinUrl ? (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-sm text-[13px] text-ink underline-offset-2 hover:text-accent hover:underline"
                        >
                          <span className="truncate">LinkedIn profile</span>
                          <Icon name="ArrowUpRight" size={12} className="shrink-0 text-ink-faint" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="text-ink-faint">No LinkedIn URL</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* Response rate */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-surface-muted/60 px-4 py-3 text-xs text-ink-muted">
              <span className="font-mono tabular-nums">
                <span className="font-semibold text-ink">{rate.sent}</span> sent
              </span>
              <span className="font-mono tabular-nums">
                <span className="font-semibold text-ink">{rate.replied}</span> replied
              </span>
              <span className="font-mono tabular-nums">
                <span className="font-semibold text-ink">{rate.sent > 0 ? `${rate.rate}%` : '–'}</span>{' '}
                response rate
              </span>
              <span className="font-mono tabular-nums">
                <span className="font-semibold text-ink">{openCount}</span> open{' '}
                {openCount === 1 ? 'opportunity' : 'opportunities'}
              </span>
            </div>

            {/* Notes */}
            <Field
              label="Notes"
              hint="Saved when you click away. Where you met, what they care about, what to reference next time."
            >
              <Textarea
                autoGrow
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                onBlur={saveNotes}
                placeholder="Nothing yet."
              />
            </Field>

            {/* Opportunities */}
            <Section title="Opportunities through them" count={opportunities.length}>
              {opportunities.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  No role is being pursued through {contact.name} yet. Create one from the
                  pipeline and pick them as the contact.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {opportunities.map((opportunity) => {
                    const employer = companyMap.get(opportunity.companyId)
                    return (
                      <li
                        key={opportunity.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{opportunity.title}</p>
                          <p className="truncate text-xs text-ink-faint">
                            {[employer?.name, TYPE_LABEL[opportunity.type]].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <StageBadge stage={opportunity.stage} size="sm" />
                          <ButtonLink
                            to={`${PERSONAL_ROUTES.outreachPipeline}?id=${encodeURIComponent(opportunity.id)}`}
                            variant="ghost"
                            size="sm"
                            iconRight="ArrowRight"
                            aria-label={`Open ${opportunity.title} in the pipeline`}
                          >
                            Open
                          </ButtonLink>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Section>

            {/* Touches */}
            <Section
              title="Touches"
              count={touches.length}
              action={
                <Button variant="ghost" size="sm" icon="Plus" onClick={logTouch}>
                  Log touch
                </Button>
              }
            >
              {touches.length === 0 ? (
                <p className="text-sm text-ink-faint">
                  Nothing logged yet. Compose to open your mail client pre-filled, then log what you
                  sent.
                </p>
              ) : (
                <TouchList touches={touches} onEdit={editTouch} showLinks={false} />
              )}
            </Section>
          </div>
        ) : null}
      </Dialog>

      {/* Secondary dialogs are siblings, not children, of the main Dialog so its
          focus trap never intercepts their keystrokes. */}
      <ContactForm open={editOpen} onClose={() => setEditOpen(false)} contactId={contact?.id} />
      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        contactId={contact?.id}
        companyId={contact?.companyId}
      />
      <TouchForm
        open={touchFormOpen}
        onClose={() => setTouchFormOpen(false)}
        touchId={editingTouchId}
        defaults={
          editingTouchId
            ? undefined
            : { contactId: contact?.id, companyId: contact?.companyId, direction: 'outbound' }
        }
      />
      <ConfirmDialog
        open={pendingDelete}
        onCancel={() => setPendingDelete(false)}
        onConfirm={confirmDelete}
        title="Delete this contact?"
        message={
          contact
            ? `${contact.name} will be removed from this device. ${pluralize(touches.length, 'touch', 'touches')} and ${pluralize(opportunities.length, 'opportunity', 'opportunities')} that mention them are kept and unlinked, not deleted.`
            : ''
        }
        confirmLabel="Delete contact"
        tone="danger"
      />
    </>
  )
}
