import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ISODate, Opportunity, OpportunityStage, OpportunityType, Priority, Task } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { ComposeDialog } from '@/components/outreach/ComposeDialog'
import { OpportunityForm } from '@/components/outreach/OpportunityForm'
import { StageBadge } from '@/components/outreach/StageBadge'
import { TouchForm } from '@/components/outreach/TouchForm'
import { TouchList } from '@/components/outreach/TouchList'
import {
  useCompany,
  useContactMap,
  useOpportunityMap,
  useOutreachSettings,
  useTouches,
} from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayShort, relativeDay, shiftDay, todayISO } from '@/utils/date'
import { pluralize, priorityTone } from '@/utils/format'
import {
  SOURCE_META,
  STAGES,
  STAGE_META,
  isTerminal,
  responseRate,
  suggestedFollowUpDate,
} from '@/utils/outreach'

export interface OpportunityDetailProps {
  /** The record to show; null keeps the dialog closed. */
  opportunityId: string | null
  onClose: () => void
}

const TYPE_LABEL: Record<OpportunityType, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const OPEN_STAGES: OpportunityStage[] = STAGES.filter((stage) => !isTerminal(stage))
const CLOSED_STAGES: OpportunityStage[] = STAGES.filter((stage) => isTerminal(stage))

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** "5 Sep · 14:32" for a stored instant, in local time. */
function formatInstant(timestamp: string): string {
  const at = new Date(timestamp)
  if (Number.isNaN(at.getTime())) return timestamp
  return `${formatDayShort(at)} · ${pad2(at.getHours())}:${pad2(at.getMinutes())}`
}

/** The host of a URL, for a link label that does not wrap three lines. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * The follow-up task `scheduleFollowUp` created for this opportunity's current
 * next action, if it is still open. Matched on the link and the due date, so an
 * older completed follow-up is never mistaken for the current one.
 */
function linkedFollowUpTask(tasks: Task[], opportunity: Opportunity): Task | undefined {
  if (!opportunity.nextActionDue) return undefined
  return tasks.find(
    (task) =>
      task.link?.kind === 'opportunity' &&
      task.link.id === opportunity.id &&
      task.date === opportunity.nextActionDue &&
      task.status !== 'completed',
  )
}

/**
 * Everything about one opportunity, in a dialog.
 *
 * The body is keyed on the opportunity id so local drafts (the notes textarea,
 * the follow-up date) start fresh when the dialog is pointed at another record
 * without closing in between. If the record disappears while open — deleted
 * from another tab, say — the dialog simply closes.
 */
export function OpportunityDetail({ opportunityId, onClose }: OpportunityDetailProps) {
  const opportunity = useOpportunityMap().get(opportunityId ?? '')
  const company = useCompany(opportunity?.companyId)
  const open = opportunityId !== null && opportunity !== undefined

  const title = opportunity ? `${company?.name ?? 'Unknown company'} · ${opportunity.title}` : 'Opportunity'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={
        opportunity
          ? `${TYPE_LABEL[opportunity.type]} · ${SOURCE_META[opportunity.source].label} · ${PRIORITY_LABEL[opportunity.priority]}`
          : undefined
      }
      size="lg"
    >
      {opportunity ? (
        <DetailBody key={opportunity.id} opportunity={opportunity} onClose={onClose} />
      ) : null}
    </Dialog>
  )
}

interface DetailBodyProps {
  opportunity: Opportunity
  onClose: () => void
}

function DetailBody({ opportunity, onClose }: DetailBodyProps) {
  const baseId = useId()
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const settings = useOutreachSettings()
  const company = useCompany(opportunity.companyId)
  const contact = useContactMap().get(opportunity.contactId ?? '')
  const touches = useTouches({ opportunityId: opportunity.id })
  const today = todayISO()

  const companyName = company?.name ?? 'Unknown company'
  const terminal = isTerminal(opportunity.stage)
  const currentOrder = STAGE_META[opportunity.stage].order
  const due = opportunity.nextActionDue
  const overdue = due !== undefined && due < today

  const rate = useMemo(() => responseRate(touches, db.touches), [touches, db.touches])
  const linkedTask = useMemo(
    () => linkedFollowUpTask(db.tasks, opportunity),
    [db.tasks, opportunity],
  )

  /*
   * The suggested follow-up date comes from the last outbound touch and how
   * many follow-ups have already gone out after the first message. Past
   * suggestions collapse to today; an exhausted schedule falls back to the
   * first interval so the field is never empty.
   */
  const suggestion = useMemo(() => {
    const outbound = touches.filter((touch) => touch.direction === 'outbound')
    const last = outbound[0]
    if (!last) return { date: shiftDay(today, settings.followUpDays[0] ?? 3), reason: undefined }
    const attempts = Math.max(0, outbound.length - 1)
    const suggested = suggestedFollowUpDate(last.date, settings.followUpDays, attempts)
    if (!suggested) {
      return {
        date: shiftDay(today, settings.followUpDays[settings.followUpDays.length - 1] ?? 3),
        reason: `Your ${settings.followUpDays.length}-step follow-up schedule is used up for this thread.`,
      }
    }
    return {
      date: suggested < today ? today : suggested,
      reason: `Suggested from your last outbound touch on ${formatDayShort(last.date)} plus ${settings.followUpDays[attempts]} days.`,
    }
  }, [touches, today, settings.followUpDays])

  const [scheduling, setScheduling] = useState(false)
  const [followUpDate, setFollowUpDate] = useState<ISODate>(due ?? suggestion.date)
  const [followUpTitle, setFollowUpTitle] = useState(opportunity.nextAction ?? '')
  const [notesDraft, setNotesDraft] = useState(opportunity.notes ?? '')
  const [editing, setEditing] = useState(false)
  const [composing, setComposing] = useState(false)
  const [touchForm, setTouchForm] = useState<{ open: boolean; touchId?: string }>({ open: false })
  const [confirmDelete, setConfirmDelete] = useState(false)

  /*
   * Logging a touch changes the suggestion. While no follow-up is set and the
   * owner has not typed a date of their own, the field tracks the suggestion.
   */
  const [lastSuggested, setLastSuggested] = useState(suggestion.date)
  if (suggestion.date !== lastSuggested) {
    setLastSuggested(suggestion.date)
    if (!opportunity.nextAction && followUpDate === lastSuggested) {
      setFollowUpDate(suggestion.date)
    }
  }

  const showScheduleForm = scheduling || !opportunity.nextAction

  const move = (stage: OpportunityStage) => {
    if (stage === opportunity.stage) return
    actions.setOpportunityStage(opportunity.id, stage)
    const meta = STAGE_META[stage]
    toast({
      title: `${meta.terminal ? 'Closed as' : terminal ? 'Reopened at' : 'Moved to'} ${meta.label}`,
      description: `${companyName} · ${opportunity.title}`,
      tone: stage === 'offer' || stage === 'accepted' ? 'positive' : 'neutral',
    })
  }

  const closeItems: DropdownMenuItem[] = CLOSED_STAGES.map((stage) => ({
    id: `close-${stage}`,
    label: `Close as ${STAGE_META[stage].label}`,
    disabled: stage === opportunity.stage,
    tone: stage === 'rejected' ? 'danger' : 'default',
    onSelect: () => move(stage),
  }))

  const scheduleFollowUp = () => {
    if (!followUpDate) return
    const taskTitle = followUpTitle.trim() || undefined
    if (linkedTask) {
      // The current follow-up already has a task; move it instead of piling up a second one.
      const nextTitle = taskTitle ?? linkedTask.title
      actions.updateTask(linkedTask.id, { date: followUpDate, title: nextTitle })
      actions.updateOpportunity(opportunity.id, {
        nextAction: nextTitle,
        nextActionDue: followUpDate,
      })
      toast({
        title: 'Follow-up moved',
        description: `The task on Today now sits on ${relativeDay(followUpDate).toLowerCase()}.`,
      })
    } else {
      actions.scheduleFollowUp(opportunity.id, followUpDate, taskTitle)
      toast({
        title: 'Follow-up scheduled',
        description: `A Career task was added to Today for ${relativeDay(followUpDate).toLowerCase()}, linked back here.`,
        tone: 'positive',
      })
    }
    setScheduling(false)
  }

  const markDone = () => {
    if (linkedTask) actions.setTaskStatus(linkedTask.id, 'completed')
    actions.updateOpportunity(opportunity.id, { nextAction: undefined, nextActionDue: undefined })
    toast({
      title: 'Follow-up done',
      description: linkedTask
        ? 'The linked task on Today is completed too.'
        : 'Next action cleared. Log what you did as a touch so the response rate sees it.',
      tone: 'positive',
    })
  }

  const clearNextAction = () => {
    if (linkedTask && linkedTask.status === 'not-started') actions.deleteTask(linkedTask.id)
    actions.updateOpportunity(opportunity.id, { nextAction: undefined, nextActionDue: undefined })
    toast({
      title: 'Next action cleared',
      description:
        linkedTask && linkedTask.status === 'not-started'
          ? 'Its task was removed from Today.'
          : undefined,
    })
  }

  const saveNotes = () => {
    const next = notesDraft.trim()
    if (next === (opportunity.notes ?? '').trim()) return
    actions.updateOpportunity(opportunity.id, { notes: next || undefined })
    toast({ title: 'Notes saved', description: `${companyName} · ${opportunity.title}` })
  }

  const linkedTouches = db.touches.filter((touch) => touch.opportunityId === opportunity.id)
  const orphanedTouches = linkedTouches.filter((touch) => !touch.companyId && !touch.contactId).length
  const keptTouches = linkedTouches.length - orphanedTouches

  const confirmDeletion = () => {
    actions.deleteOpportunity(opportunity.id)
    setConfirmDelete(false)
    toast({ title: 'Opportunity deleted', description: `${opportunity.title} at ${companyName}` })
    onClose()
  }

  const factsId = `${baseId}-facts`
  const nextId = `${baseId}-next`
  const touchesId = `${baseId}-touches`
  const historyId = `${baseId}-history`
  const stageId = `${baseId}-stage`

  return (
    <div className="space-y-6 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <StageBadge stage={opportunity.stage} />
        <Badge tone={opportunity.type === 'internship' ? 'info' : 'accent'}>
          {TYPE_LABEL[opportunity.type]}
        </Badge>
        <Badge tone={priorityTone(opportunity.priority)}>{PRIORITY_LABEL[opportunity.priority]}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="secondary" icon="Pencil" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon="Trash"
            onClick={() => setConfirmDelete(true)}
            className="text-danger hover:text-danger"
          >
            Delete
          </Button>
        </div>
      </div>

      <section aria-labelledby={stageId}>
        <h3 id={stageId} className="sr-only">
          Stage
        </h3>
        <ol className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1">
          {OPEN_STAGES.map((stage) => {
            const meta = STAGE_META[stage]
            const current = stage === opportunity.stage
            const passed = !terminal && meta.order < currentOrder
            return (
              <li key={stage} className="shrink-0">
                <button
                  type="button"
                  aria-current={current ? 'step' : undefined}
                  disabled={current}
                  onClick={() => move(stage)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors',
                    'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default',
                    current
                      ? 'border-accent bg-accent text-accent-ink'
                      : passed
                        ? 'border-line bg-surface-muted text-ink-muted hover:border-line-strong hover:text-ink'
                        : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  {passed ? <Icon name="Check" size={12} /> : null}
                  {meta.label}
                </button>
              </li>
            )
          })}
          <li className="ml-auto shrink-0 border-l border-line pl-1">
            <DropdownMenu
              items={closeItems}
              label={terminal ? 'Close as a different outcome' : 'Close as…'}
              triggerIcon="CircleX"
            />
          </li>
        </ol>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          {terminal && opportunity.closedAt
            ? `Closed as ${STAGE_META[opportunity.stage].label} ${relativeDay(new Date(opportunity.closedAt)).toLowerCase()}. Pick any stage above to reopen it. `
            : ''}
          {STAGE_META[opportunity.stage].hint}
        </p>
      </section>

      <section aria-labelledby={factsId}>
        <h3 id={factsId} className="sr-only">
          Key facts
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Company</dt>
            <dd className="mt-0.5 text-ink">
              {company ? (
                <Link
                  to={`${PERSONAL_ROUTES.outreachCompanies}?id=${company.id}`}
                  className="inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline"
                >
                  {company.name}
                  <Icon name="ArrowUpRight" size={13} className="text-ink-faint" />
                </Link>
              ) : (
                'Unknown company'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Contact</dt>
            <dd className="mt-0.5 text-ink">
              {contact ? (
                <Link
                  to={`${PERSONAL_ROUTES.outreachContacts}?id=${contact.id}`}
                  className="inline-flex items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline"
                >
                  {contact.name}
                  {contact.role ? <span className="font-normal text-ink-muted"> · {contact.role}</span> : null}
                  <Icon name="ArrowUpRight" size={13} className="text-ink-faint" />
                </Link>
              ) : (
                <span className="text-ink-muted">No contact yet</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Source</dt>
            <dd className="mt-0.5 text-ink">{SOURCE_META[opportunity.source].label}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Applied</dt>
            <dd className="mt-0.5 font-mono text-ink tabular-nums">
              {opportunity.appliedAt ? formatDayShort(opportunity.appliedAt) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Resume</dt>
            <dd className="mt-0.5 font-mono text-ink">{opportunity.resumeVersion ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Compensation</dt>
            <dd className="mt-0.5 text-ink">{opportunity.compensation ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Job posting</dt>
            <dd className="mt-0.5 text-ink">
              {opportunity.jobUrl ? (
                <a
                  href={opportunity.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 rounded-sm font-medium underline-offset-2 hover:underline"
                >
                  <span className="truncate">{hostOf(opportunity.jobUrl)}</span>
                  <Icon name="ExternalLink" size={13} className="shrink-0 text-ink-faint" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">Added</dt>
            <dd className="mt-0.5 font-mono text-ink tabular-nums">
              {formatInstant(opportunity.createdAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby={nextId} className="rounded-lg border border-line bg-surface-muted/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={nextId} className="text-sm font-semibold text-ink">
            Next action
          </h3>
          {opportunity.nextAction ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="primary" icon="Check" onClick={markDone}>
                Mark done
              </Button>
              <Button
                size="sm"
                variant="secondary"
                icon="CalendarClock"
                onClick={() => {
                  setFollowUpDate(due ?? suggestion.date)
                  setFollowUpTitle(opportunity.nextAction ?? '')
                  setScheduling((value) => !value)
                }}
                aria-expanded={scheduling}
              >
                Reschedule
              </Button>
              <Button size="sm" variant="ghost" icon="X" onClick={clearNextAction}>
                Clear
              </Button>
            </div>
          ) : null}
        </div>

        {opportunity.nextAction ? (
          <p className={cn('mt-2 flex flex-wrap items-center gap-x-2 text-sm', overdue ? 'text-danger' : 'text-ink')}>
            <Icon name={overdue ? 'TriangleAlert' : 'CalendarClock'} size={15} className="shrink-0" />
            <span className="font-medium">{opportunity.nextAction}</span>
            {due ? (
              <span className="font-mono text-xs tabular-nums">
                {overdue ? `overdue · was ${relativeDay(due).toLowerCase()}` : relativeDay(due)}
              </span>
            ) : null}
            {linkedTask ? (
              <Link
                to={`${PERSONAL_ROUTES.today}?date=${linkedTask.date}`}
                className="text-xs text-ink-muted underline-offset-2 hover:underline"
              >
                Open on Today
              </Link>
            ) : null}
          </p>
        ) : terminal ? (
          <p className="mt-2 text-sm text-ink-muted">
            Closed opportunities do not carry follow-ups. Reopen it above to schedule one.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">No follow-up scheduled yet.</p>
        )}

        {showScheduleForm && !terminal ? (
          <form
            className="mt-3 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-[minmax(0,10rem)_1fr_auto] sm:items-start"
            onSubmit={(event) => {
              event.preventDefault()
              scheduleFollowUp()
            }}
          >
            <Field label="Follow up on" hint={suggestion.reason}>
              <Input
                type="date"
                value={followUpDate}
                min={today}
                onChange={(event) => setFollowUpDate(event.target.value)}
              />
            </Field>
            <Field
              label="Task title"
              hint={`Blank uses "Follow up: ${companyName} — ${opportunity.title}".`}
            >
              <Input
                value={followUpTitle}
                onChange={(event) => setFollowUpTitle(event.target.value)}
                placeholder="Nudge on LinkedIn, mention the new blog post"
                autoComplete="off"
              />
            </Field>
            <Button
              type="submit"
              variant={opportunity.nextAction ? 'secondary' : 'primary'}
              icon="CalendarPlus"
              disabled={!followUpDate}
              className="sm:mt-[26px]"
            >
              {opportunity.nextAction ? 'Move it' : 'Schedule follow-up'}
            </Button>
            <p className="text-xs leading-relaxed text-ink-faint sm:col-span-3">
              This creates a real task on the Today page, in the Career category, linked back
              to this opportunity.
            </p>
          </form>
        ) : null}
      </section>

      <section aria-labelledby={touchesId}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 id={touchesId} className="text-sm font-semibold text-ink">
              Touches
            </h3>
            <span className="font-mono text-xs tabular-nums text-ink-faint" aria-live="polite">
              {rate.sent > 0
                ? `${rate.sent} sent · ${pluralize(rate.replied, 'reply', 'replies')} · ${rate.rate}%`
                : `${pluralize(touches.length, 'touch', 'touches')}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="secondary" icon="Send" onClick={() => setComposing(true)}>
              Compose
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon="Plus"
              onClick={() => setTouchForm({ open: true })}
            >
              Log touch
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-faint">
          Compose opens Gmail or your mail app with the message filled in — nothing is sent from
          here — and logs the touch once you have.
        </p>

        <div className="mt-3">
          {touches.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">
              No touches yet. Log the first one, or compose a message from a template.
            </p>
          ) : (
            <TouchList
              touches={touches}
              showLinks={false}
              onEdit={(touchId) => setTouchForm({ open: true, touchId })}
            />
          )}
        </div>
      </section>

      <section aria-label="Notes">
        <Field label="Notes" hint="Saved when you leave the field.">
          <Textarea
            autoGrow
            rows={3}
            value={notesDraft}
            onChange={(event) => setNotesDraft(event.target.value)}
            onBlur={saveNotes}
            placeholder="Interview format, who you spoke to, what they care about."
          />
        </Field>
      </section>

      <section aria-labelledby={historyId}>
        <h3 id={historyId} className="text-sm font-semibold text-ink">
          Stage history
        </h3>
        <ol className="mt-2 space-y-2 border-l border-line pl-4">
          {opportunity.stageHistory.map((change, index) => (
            <li key={`${change.at}-${change.stage}-${index}`} className="relative flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-1/2 -left-[1.3rem] size-2 -translate-y-1/2 rounded-full',
                  index === opportunity.stageHistory.length - 1 ? 'bg-accent' : 'bg-line-strong',
                )}
              />
              <span className="w-32 shrink-0 font-mono text-xs tabular-nums text-ink-faint">
                {formatInstant(change.at)}
              </span>
              <StageBadge stage={change.stage} size="sm" />
            </li>
          ))}
        </ol>
      </section>

      <OpportunityForm
        open={editing}
        onClose={() => setEditing(false)}
        opportunityId={opportunity.id}
      />

      <TouchForm
        open={touchForm.open}
        onClose={() => setTouchForm({ open: false })}
        touchId={touchForm.touchId}
        defaults={{
          opportunityId: opportunity.id,
          companyId: opportunity.companyId,
          contactId: opportunity.contactId,
        }}
      />

      <ComposeDialog
        open={composing}
        onClose={() => setComposing(false)}
        opportunityId={opportunity.id}
        contactId={opportunity.contactId}
        companyId={opportunity.companyId}
      />

      <ConfirmDialog
        open={confirmDelete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={confirmDeletion}
        title="Delete this opportunity?"
        message={
          `"${opportunity.title}" at ${companyName} and its stage history will be removed from this device` +
          (orphanedTouches > 0
            ? `, along with ${pluralize(orphanedTouches, 'touch', 'touches')} that pointed only at it`
            : '') +
          '. ' +
          (keptTouches > 0
            ? `${pluralize(keptTouches, 'touch', 'touches')} stay logged against the company or contact. `
            : '') +
          'Follow-up tasks keep their text but lose the link. This cannot be undone.'
        }
        confirmLabel="Delete opportunity"
        tone="danger"
      />
    </div>
  )
}
