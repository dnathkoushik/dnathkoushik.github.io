import { useId, useMemo, useState } from 'react'
import type { Category, ISODate, LogEntry, PartOfDay } from '@/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { WorkLogRow } from '@/components/worklog/WorkLogRow'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { durationLabel, formatDayShort, partOfDay } from '@/utils/date'
import { truncate } from '@/utils/format'

export interface WorkLogListProps {
  date: ISODate
  logs: LogEntry[]
  categories: Category[]
  className?: string
}

const PARTS: { id: PartOfDay; label: string; icon: string }[] = [
  { id: 'morning', label: 'Morning', icon: 'Sunrise' },
  { id: 'afternoon', label: 'Afternoon', icon: 'Sun' },
  { id: 'evening', label: 'Evening', icon: 'Sunset' },
  { id: 'night', label: 'Night', icon: 'Moon' },
]

/**
 * The day as it actually happened, grouped the way people remember it.
 *
 * Grouping by part of day rather than by category is deliberate: the log is
 * read chronologically ("what did I do this morning?"), and the category totals
 * that answer the other question already live on the analytics screen.
 */
export function WorkLogList({ date, logs, categories, className }: WorkLogListProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const baseId = useId()
  const [pendingDelete, setPendingDelete] = useState<LogEntry | null>(null)

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) map.set(category.id, category)
    return map
  }, [categories])

  const groups = useMemo(
    () =>
      PARTS.map((part) => {
        const items = logs
          .filter((entry) => partOfDay(entry.time) === part.id)
          .sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt))
        return {
          ...part,
          items,
          minutes: items.reduce((total, entry) => total + entry.durationMinutes, 0),
        }
      }).filter((part) => part.items.length > 0),
    [logs],
  )

  const totalMinutes = useMemo(
    () => logs.reduce((total, entry) => total + entry.durationMinutes, 0),
    [logs],
  )

  function handleSave(entry: LogEntry, patch: Partial<LogEntry>) {
    actions.updateLog(entry.id, patch)
    toast({
      title: 'Entry updated',
      description: truncate(patch.activity ?? entry.activity, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  function handleDuplicate(entry: LogEntry) {
    const copy = actions.addLog({
      date: entry.date,
      activity: entry.activity,
      time: entry.time,
      categoryId: entry.categoryId,
      durationMinutes: entry.durationMinutes,
      notes: entry.notes,
    })
    toast({
      title: 'Entry duplicated',
      description: truncate(copy.activity, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  function handleDelete(entry: LogEntry) {
    setPendingDelete(null)
    actions.deleteLog(entry.id)
    toast({
      title: 'Entry deleted',
      description: truncate(entry.activity, 60),
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          actions.addLog({
            date: entry.date,
            activity: entry.activity,
            time: entry.time,
            categoryId: entry.categoryId,
            durationMinutes: entry.durationMinutes,
            notes: entry.notes,
          })
          toast({ title: 'Entry restored', tone: 'positive', duration: 2000 })
        },
      },
    })
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon="Clock"
        title={`Nothing logged on ${formatDayShort(date)}`}
        description="Record what you actually did as you go. Entries are grouped into morning, afternoon, evening and night, and roll up into the analytics screen."
        className={className}
      />
    )
  }

  return (
    <div className={cn('space-y-5', className)}>
      {groups.map((group) => {
        const headingId = `${baseId}-${group.id}`
        return (
          <section key={group.id} aria-labelledby={headingId}>
            <div className="mb-2 flex items-center gap-2">
              <Icon name={group.icon} size={13} className="text-ink-faint" />
              <h3
                id={headingId}
                className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
              >
                {group.label}
              </h3>
              <span className="font-mono text-xs text-ink-faint tabular-nums">
                {durationLabel(group.minutes)}
              </span>
            </div>

            <ul className="space-y-2">
              {group.items.map((entry) => (
                <WorkLogRow
                  key={entry.id}
                  entry={entry}
                  category={categoryById.get(entry.categoryId)}
                  categories={categories}
                  onSave={(patch) => handleSave(entry, patch)}
                  onDuplicate={() => handleDuplicate(entry)}
                  onDelete={() => setPendingDelete(entry)}
                />
              ))}
            </ul>
          </section>
        )
      })}

      <p className="flex items-center justify-between border-t border-line pt-3 text-sm">
        <span className="text-ink-muted">Logged on {formatDayShort(date)}</span>
        <span className="font-mono font-semibold text-ink tabular-nums">
          {durationLabel(totalMinutes)}
        </span>
      </p>

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete)
        }}
        title="Delete this entry?"
        message={
          pendingDelete
            ? `“${truncate(pendingDelete.activity, 80)}” will be removed from the work log. You can undo it from the notification that follows.`
            : ''
        }
        confirmLabel="Delete entry"
        tone="danger"
      />
    </div>
  )
}
