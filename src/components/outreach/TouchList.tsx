import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ISODate, Touch } from '@/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { TouchRow } from '@/components/outreach/TouchRow'
import {
  useCompanyMap,
  useContactMap,
  useOpportunityMap,
  useTemplateMap,
} from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayLong, relativeDay } from '@/utils/date'
import { truncate } from '@/utils/format'

export interface TouchListProps {
  touches: Touch[]
  /** When given, every row offers "Edit" and calls back with the touch id. */
  onEdit?: (id: string) => void
  /** Company · contact · role links under each summary. */
  showLinks?: boolean
  /** Render at most this many rows (newest first). */
  limit?: number
  /** Shown inside the empty state, e.g. a "Log touch" button. */
  emptyAction?: ReactNode
  className?: string
}

/** Above this many rows the list is broken into days so it can be scanned. */
const GROUP_THRESHOLD = 10

/** Newest first: date, then time, then when it was logged — the same order `useTouches` uses. */
function compareNewestFirst(a: Touch, b: Touch): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.time ?? '').localeCompare(a.time ?? '') ||
    b.createdAt.localeCompare(a.createdAt)
  )
}

interface DayGroup {
  date: ISODate
  touches: Touch[]
}

function groupByDay(touches: Touch[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const touch of touches) {
    const last = groups[groups.length - 1]
    if (last && last.date === touch.date) last.touches.push(touch)
    else groups.push({ date: touch.date, touches: [touch] })
  }
  return groups
}

/**
 * Touches, newest first, with delete handled here so every list on the module
 * confirms the same way. Grouped by day once there are enough rows for the
 * dates to blur together.
 */
export function TouchList({
  touches,
  onEdit,
  showLinks = false,
  limit,
  emptyAction,
  className,
}: TouchListProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const companies = useCompanyMap()
  const contacts = useContactMap()
  const opportunities = useOpportunityMap()
  const templates = useTemplateMap()

  const [pendingDelete, setPendingDelete] = useState<Touch | null>(null)

  const visible = useMemo(() => {
    const sorted = touches.slice().sort(compareNewestFirst)
    return limit !== undefined && limit >= 0 ? sorted.slice(0, limit) : sorted
  }, [touches, limit])

  const grouped = visible.length > GROUP_THRESHOLD
  const groups = useMemo(() => (grouped ? groupByDay(visible) : []), [grouped, visible])

  function confirmDelete() {
    const touch = pendingDelete
    setPendingDelete(null)
    if (!touch) return
    actions.deleteTouch(touch.id)
    toast({ title: 'Touch deleted', description: truncate(touch.summary, 80) })
  }

  const renderRow = (touch: Touch, showDate: boolean) => {
    const opportunity = touch.opportunityId ? opportunities.get(touch.opportunityId) : undefined
    const contact = touch.contactId ? contacts.get(touch.contactId) : undefined
    const companyId = touch.companyId ?? opportunity?.companyId ?? contact?.companyId
    return (
      <TouchRow
        key={touch.id}
        touch={touch}
        company={companyId ? companies.get(companyId) : undefined}
        contact={contact}
        opportunity={opportunity}
        template={touch.templateId ? templates.get(touch.templateId) : undefined}
        showLinks={showLinks}
        showDate={showDate}
        onEdit={onEdit ? () => onEdit(touch.id) : undefined}
        onDelete={() => setPendingDelete(touch)}
      />
    )
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon="Inbox"
        title="No touches yet"
        description="Compose from a template or log one by hand. Every response rate in this module is computed from this list, so the small ones count too."
        action={emptyAction}
        className={className}
      />
    )
  }

  return (
    <div className={cn('space-y-5', className)}>
      {grouped ? (
        groups.map((group) => {
          const headingId = `touch-day-${group.date}`
          return (
            <section key={group.date} aria-labelledby={headingId} className="space-y-2">
              <h3
                id={headingId}
                className="flex flex-wrap items-baseline gap-x-2 px-1 text-sm font-semibold text-ink"
              >
                {relativeDay(group.date)}
                <time dateTime={group.date} className="text-xs font-normal text-ink-faint">
                  {formatDayLong(group.date)}
                </time>
                <span className="font-mono text-xs font-normal text-ink-faint tabular-nums">
                  {group.touches.length}
                </span>
              </h3>
              <ul className="divide-y divide-line rounded-card border border-line bg-surface">
                {group.touches.map((touch) => renderRow(touch, false))}
              </ul>
            </section>
          )
        })
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {visible.map((touch) => renderRow(touch, true))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this touch?"
        message={
          pendingDelete
            ? `"${truncate(pendingDelete.summary, 90)}" is removed from this device. Response rates and follow-up timing are recomputed without it. Stage changes it caused are kept.`
            : ''
        }
        confirmLabel="Delete touch"
        tone="danger"
      />
    </div>
  )
}
