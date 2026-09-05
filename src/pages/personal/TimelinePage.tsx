import { useMemo, useState } from 'react'
import { PERSONAL_ROUTES } from '@/config/routes'
import type { ActivityEvent, ActivityKind, Category, ISODate } from '@/types'
import { buildActivityFeed, heatmapData } from '@/utils/analytics'
import type { HeatmapCell } from '@/utils/analytics'
import { durationLabel, formatDayLong, relativeDay, shiftDay, todayISO } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { usePersonalData } from '@/providers/personalDataContext'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ActivityItem, KIND_STYLE } from '@/components/timeline/ActivityItem'
import { ButtonLink, Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/cn'

const PAGE_SIZE = 40

type RangeKey = '30d' | '90d' | 'year' | 'all'

const RANGE_OPTIONS: { value: RangeKey; label: string; icon?: string }[] = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All' },
]

const KINDS = Object.keys(KIND_STYLE) as ActivityKind[]

interface DayGroup {
  date: ISODate
  events: ActivityEvent[]
  stats?: HeatmapCell
}

function boundsFor(key: RangeKey, today: ISODate): { from?: ISODate; to?: ISODate } {
  if (key === 'all') return {}
  if (key === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today }
  return { from: shiftDay(today, key === '30d' ? -29 : -89), to: today }
}

/**
 * Everything you have done, newest first.
 *
 * The feed is assembled from the same records the rest of the dashboard draws:
 * finished tasks, work-log entries, completed goals, habit ticks, notes,
 * reviews and the objective you set for a day. Nothing here is a separate
 * "event log" that could drift out of sync with the data itself.
 */
export default function TimelinePage() {
  useDocumentMeta({
    title: 'Timeline',
    description: 'Everything recorded in your private dashboard, grouped by day.',
    noindex: true,
    canonicalPath: PERSONAL_ROUTES.timeline,
  })

  const { db } = usePersonalData()
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d')
  const [active, setActive] = useState<ActivityKind[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)

  const today = todayISO()
  const bounds = useMemo(() => boundsFor(rangeKey, today), [rangeKey, today])

  const all = useMemo(
    () => buildActivityFeed(db, { from: bounds.from, to: bounds.to }),
    [db, bounds],
  )

  const counts = useMemo(() => {
    const map = new Map<ActivityKind, number>()
    for (const event of all) map.set(event.kind, (map.get(event.kind) ?? 0) + 1)
    return map
  }, [all])

  const filtered = useMemo(
    () => (active.length === 0 ? all : all.filter((event) => active.includes(event.kind))),
    [all, active],
  )

  // Changing the range or the kind filters starts the feed over at page one.
  const filterKey = `${rangeKey}|${[...active].sort().join(',')}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setLimit(PAGE_SIZE)
  }

  const visible = filtered.slice(0, limit)

  const categories = useMemo(
    () => new Map<string, Category>(db.categories.map((category) => [category.id, category])),
    [db.categories],
  )

  const groups = useMemo<DayGroup[]>(() => {
    if (visible.length === 0) return []

    // One index pass covers every day on screen instead of one per group.
    const last = visible[visible.length - 1].date
    const first = visible[0].date
    const cells = new Map<ISODate, HeatmapCell>()
    for (const cell of heatmapData(db, last, first)) cells.set(cell.date, cell)

    const byDate = new Map<ISODate, ActivityEvent[]>()
    for (const event of visible) {
      const bucket = byDate.get(event.date)
      if (bucket) bucket.push(event)
      else byDate.set(event.date, [event])
    }

    return [...byDate.entries()].map(([date, events]) => ({
      date,
      events,
      stats: cells.get(date),
    }))
  }, [visible, db])

  function toggleKind(kind: ActivityKind) {
    setActive((current) =>
      current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind],
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Timeline"
        title="Everything you have done"
        description={`${pluralize(filtered.length, 'event')} across ${pluralize(groups.length, 'day')} in view. Assembled from your own records, in this browser.`}
        actions={
          <SegmentedControl<RangeKey>
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGE_OPTIONS}
            ariaLabel="Timeline date range"
          />
        }
      />

      <section aria-label="Filter by kind">
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <li className="shrink-0">
            <button
              type="button"
              onClick={() => setActive([])}
              aria-pressed={active.length === 0}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                active.length === 0
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink',
              )}
            >
              <Icon name="Layers" size={14} />
              Everything
              <span className="font-mono text-[11px] tabular-nums">{all.length}</span>
            </button>
          </li>

          {KINDS.map((kind) => {
            const count = counts.get(kind) ?? 0
            const on = active.includes(kind)
            return (
              <li key={kind} className="shrink-0">
                <button
                  type="button"
                  onClick={() => toggleKind(kind)}
                  aria-pressed={on}
                  disabled={count === 0 && !on}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    on
                      ? 'border-accent bg-accent text-accent-ink'
                      : 'border-line bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )}
                >
                  <Icon name={KIND_STYLE[kind].icon} size={14} />
                  {KIND_STYLE[kind].label}
                  <span className="font-mono text-[11px] tabular-nums">{count}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {groups.length === 0 ? (
        <EmptyState
          icon="Activity"
          title={
            all.length === 0 ? 'Nothing recorded in this range' : 'No events of those kinds here'
          }
          description={
            all.length === 0
              ? 'Finish a task, log some work or tick a habit and it shows up here, grouped by the day it happened.'
              : 'Try widening the date range, or clear the kind filters.'
          }
          action={
            all.length === 0 ? (
              <ButtonLink to={PERSONAL_ROUTES.today} variant="primary" icon="ListTodo">
                Go to Today
              </ButtonLink>
            ) : (
              <Button variant="secondary" icon="RotateCcw" onClick={() => setActive([])}>
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date} aria-labelledby={`day-${group.date}`}>
              <div className="sticky top-0 z-10 -mx-1 border-b border-line bg-canvas px-1 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <h2 id={`day-${group.date}`} className="text-sm font-semibold text-ink">
                    <time dateTime={group.date}>{formatDayLong(group.date)}</time>
                    <span className="ml-2 font-normal text-ink-faint">
                      {relativeDay(group.date)}
                    </span>
                  </h2>
                  {group.stats ? (
                    <p className="font-mono text-[11px] text-ink-faint tabular-nums">
                      {group.stats.tasksCompleted}/{group.stats.tasksTotal} tasks ·{' '}
                      {durationLabel(group.stats.loggedMinutes)} · score {group.stats.score}
                    </p>
                  ) : null}
                </div>
              </div>

              <Card className="mt-2 animate-fade-in">
                <ul className="divide-y divide-line py-1">
                  {group.events.map((event) => (
                    <ActivityItem
                      key={event.id}
                      event={event}
                      category={event.categoryId ? categories.get(event.categoryId) : undefined}
                    />
                  ))}
                </ul>
              </Card>
            </section>
          ))}

          {filtered.length > visible.length ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                icon="ChevronDown"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
              >
                Load more ({filtered.length - visible.length} left)
              </Button>
            </div>
          ) : (
            <p className="text-center text-xs text-ink-faint">
              That is everything in this range.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
