import { useEffect, useMemo, useRef, useState } from 'react'
import type { ISODate, MonthKey } from '@/types'
import type { WeekStartsOn } from '@/utils/date'
import {
  durationLabel,
  eachDayISO,
  formatDayLong,
  formatMonthLabel,
  fromISODate,
  isToday,
  monthKeyOf,
  monthRange,
  shiftDay,
  shiftMonth,
} from '@/utils/date'
import { pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/**
 * Everything one cell needs to draw itself. The grid is deliberately dumb: the
 * page owns the database and hands down 42 pre-computed cells, which keeps the
 * per-keystroke re-render cost of the roving tabindex to a plain array map.
 */
export interface CalendarDay {
  date: ISODate
  /** False for the leading/trailing days borrowed from the adjacent months. */
  inMonth: boolean
  /** 0–100 productivity score for the day. */
  score: number
  /** Quartile of `score`; 0 means nothing was recorded at all. */
  level: 0 | 1 | 2 | 3 | 4
  tasksTotal: number
  tasksCompleted: number
  loggedMinutes: number
  notes: number
  habitsDone: number
  hasEntries: boolean
}

export interface MonthGridProps {
  monthKey: MonthKey
  /** Exactly 42 days, ascending, starting on `weekStartsOn`. */
  days: CalendarDay[]
  selected: ISODate
  weekStartsOn: WeekStartsOn
  onSelect: (date: ISODate) => void
  /** Fired when keyboard navigation walks off the drawn six-week window. */
  onMonthChange: (monthKey: MonthKey) => void
  /** Id of the heading that names this grid. */
  labelledBy?: string
  className?: string
}

/**
 * The six-week window drawn for a month: the month itself plus the leading and
 * trailing days needed to fill whole weeks. Always 42 days, so the grid never
 * changes height between a 28-day February and a 31-day month that starts on a
 * Sunday — a shifting layout under the cursor is how you mis-click a date.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function monthGridRange(
  monthKey: MonthKey,
  weekStartsOn: WeekStartsOn,
): { start: ISODate; end: ISODate; days: ISODate[] } {
  const first = monthRange(monthKey).start
  const leading = (fromISODate(first).getDay() - weekStartsOn + 7) % 7
  const start = shiftDay(first, -leading)
  const end = shiftDay(start, 41)
  return { start, end, days: eachDayISO(start, end) }
}

const WEEKDAYS = [
  { short: 'S', medium: 'Sun', full: 'Sunday' },
  { short: 'M', medium: 'Mon', full: 'Monday' },
  { short: 'T', medium: 'Tue', full: 'Tuesday' },
  { short: 'W', medium: 'Wed', full: 'Wednesday' },
  { short: 'T', medium: 'Thu', full: 'Thursday' },
  { short: 'F', medium: 'Fri', full: 'Friday' },
  { short: 'S', medium: 'Sat', full: 'Saturday' },
]

function weekdayLabels(weekStartsOn: WeekStartsOn) {
  return weekStartsOn === 1 ? [...WEEKDAYS.slice(1), WEEKDAYS[0]] : WEEKDAYS
}

/** Intensity ramp for the productivity bar. Written out so Tailwind sees them. */
const LEVEL_FILL: Record<CalendarDay['level'], string> = {
  0: 'bg-transparent',
  1: 'bg-accent/25',
  2: 'bg-accent/45',
  3: 'bg-accent/70',
  4: 'bg-accent',
}

function dayNumber(date: ISODate): number {
  return fromISODate(date).getDate()
}

/** The sentence a screen reader hears for one cell. */
function summarise(day: CalendarDay): string {
  if (!day.hasEntries) return 'nothing recorded'

  const parts: string[] = []
  if (day.tasksTotal > 0) parts.push(`${day.tasksCompleted} of ${day.tasksTotal} tasks done`)
  if (day.loggedMinutes > 0) parts.push(`${durationLabel(day.loggedMinutes)} logged`)
  if (day.habitsDone > 0) parts.push(`${pluralize(day.habitsDone, 'habit')} done`)
  if (day.notes > 0) parts.push(pluralize(day.notes, 'note'))
  parts.push(`productivity ${day.score}%`)
  return parts.join(', ')
}

/**
 * A month of days as a real ARIA grid.
 *
 * Navigation follows the WAI-ARIA date-grid pattern: exactly one cell is in the
 * tab order at a time (a roving tabindex), the arrow keys move the focus
 * without changing the selection, and Enter or Space commits. Walking off the
 * drawn window asks the page for the next month and the focus follows the day
 * across the boundary, which is what makes "hold ArrowRight" behave the way a
 * native date picker does.
 */
export function MonthGrid({
  monthKey,
  days,
  selected,
  weekStartsOn,
  onSelect,
  onMonthChange,
  labelledBy,
  className,
}: MonthGridProps) {
  const [focusedDate, setFocusedDate] = useState<ISODate>(selected)
  const [lastSelected, setLastSelected] = useState<ISODate>(selected)
  const cellRefs = useRef(new Map<ISODate, HTMLButtonElement>())
  /** Set only by keyboard moves, so the grid never steals focus on first paint. */
  const wantsFocus = useRef(false)

  /*
   * Selecting a day elsewhere — a deep link, the Today button — moves the
   * keyboard focus with it. Derived during render rather than in an effect so
   * the grid never paints one frame with the tab stop on the old day.
   */
  if (selected !== lastSelected) {
    setLastSelected(selected)
    setFocusedDate(selected)
  }

  const weeks = useMemo(() => {
    const rows: CalendarDay[][] = []
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7))
    return rows
  }, [days])

  /*
   * The tab stop must always exist. When the selection sits in a month that is
   * no longer drawn — the user paged forward with the buttons — it falls back
   * to the first day of the visible month rather than leaving the grid
   * unreachable by keyboard.
   */
  const drawn = useMemo(() => new Set(days.map((day) => day.date)), [days])
  const roving = drawn.has(focusedDate)
    ? focusedDate
    : (days.find((day) => day.inMonth)?.date ?? days[0]?.date ?? selected)

  useEffect(() => {
    if (!wantsFocus.current) return
    wantsFocus.current = false
    cellRefs.current.get(roving)?.focus()
  })

  function moveTo(next: ISODate) {
    wantsFocus.current = true
    setFocusedDate(next)
    if (!drawn.has(next)) onMonthChange(monthKeyOf(next))
  }

  /** Same day-of-month in an adjacent month, clamped to that month's length. */
  function shiftByMonth(date: ISODate, delta: number): ISODate {
    const target = shiftMonth(monthKeyOf(date), delta)
    const inTarget = monthRange(target).days
    return inTarget[Math.min(dayNumber(date), inTarget.length) - 1]
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return

    const offsetInWeek = (fromISODate(roving).getDay() - weekStartsOn + 7) % 7

    switch (event.key) {
      case 'ArrowLeft':
        moveTo(shiftDay(roving, -1))
        break
      case 'ArrowRight':
        moveTo(shiftDay(roving, 1))
        break
      case 'ArrowUp':
        moveTo(shiftDay(roving, -7))
        break
      case 'ArrowDown':
        moveTo(shiftDay(roving, 7))
        break
      case 'Home':
        moveTo(shiftDay(roving, -offsetInWeek))
        break
      case 'End':
        moveTo(shiftDay(roving, 6 - offsetInWeek))
        break
      case 'PageUp':
        moveTo(shiftByMonth(roving, -1))
        break
      case 'PageDown':
        moveTo(shiftByMonth(roving, 1))
        break
      case 'Enter':
      case ' ':
        onSelect(roving)
        break
      default:
        return
    }

    event.preventDefault()
  }

  return (
    <div
      role="grid"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : formatMonthLabel(monthKey)}
      aria-multiselectable={false}
      onKeyDown={handleKeyDown}
      className={cn('select-none', className)}
    >
      <div role="row" className="mb-1 grid grid-cols-7 gap-1">
        {weekdayLabels(weekStartsOn).map((weekday) => (
          <div
            key={weekday.full}
            role="columnheader"
            aria-label={weekday.full}
            className="py-1 text-center font-mono text-[11px] font-medium tracking-wide text-ink-faint uppercase"
          >
            <span aria-hidden="true" className="sm:hidden">
              {weekday.short}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              {weekday.medium}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week) => (
          <div key={week[0].date} role="row" className="grid grid-cols-7 gap-1">
            {week.map((day) => {
              const isSelected = day.date === selected
              const today = isToday(day.date)

              return (
                <button
                  key={day.date}
                  ref={(node) => {
                    if (node) cellRefs.current.set(day.date, node)
                    else cellRefs.current.delete(day.date)
                  }}
                  type="button"
                  role="gridcell"
                  aria-selected={isSelected}
                  aria-current={today ? 'date' : undefined}
                  aria-label={`${formatDayLong(day.date)}${
                    day.inMonth ? '' : ', outside this month'
                  } — ${summarise(day)}`}
                  tabIndex={day.date === roving ? 0 : -1}
                  onClick={() => {
                    setFocusedDate(day.date)
                    onSelect(day.date)
                  }}
                  className={cn(
                    'relative flex h-14 flex-col justify-between rounded-lg border px-1.5 py-1.5',
                    'text-left transition-colors duration-150 sm:h-20 sm:px-2 sm:py-2',
                    isSelected
                      ? 'border-accent bg-accent text-accent-ink shadow-subtle'
                      : today
                        ? 'border-accent/60 bg-surface text-ink ring-1 ring-accent/30 hover:bg-surface-hover'
                        : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-hover',
                    !day.inMonth && !isSelected && 'bg-surface-muted/40 text-ink-faint',
                  )}
                >
                  <span className="flex items-start justify-between gap-1">
                    <span
                      className={cn(
                        'font-mono text-[13px] leading-none font-medium tabular-nums sm:text-sm',
                        !isSelected && today && 'text-accent',
                      )}
                    >
                      {dayNumber(day.date)}
                    </span>

                    {day.hasEntries ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'hidden font-mono text-[10px] leading-none tabular-nums sm:inline',
                          // 70% white on the accent fill fell under 4.5:1;
                          // this is the day's score, so it has to be legible.
                          isSelected ? 'text-accent-ink/90' : 'text-ink-faint',
                        )}
                      >
                        {day.score}
                      </span>
                    ) : null}
                  </span>

                  <span aria-hidden="true" className="flex flex-col gap-1">
                    <span className="flex items-center gap-1">
                      {day.tasksTotal > 0 ? (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            isSelected ? 'bg-accent-ink/75' : 'bg-accent',
                          )}
                        />
                      ) : null}
                      {day.loggedMinutes > 0 ? (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            isSelected ? 'bg-accent-ink/55' : 'bg-info',
                          )}
                        />
                      ) : null}
                      {day.notes > 0 ? (
                        <span
                          className={cn(
                            'size-1.5 rounded-full',
                            isSelected ? 'bg-accent-ink/40' : 'bg-warning',
                          )}
                        />
                      ) : null}
                    </span>

                    <span
                      className={cn(
                        'h-1 w-full overflow-hidden rounded-full',
                        isSelected ? 'bg-accent-ink/20' : 'bg-surface-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'block h-full rounded-full',
                          isSelected ? 'bg-accent-ink/80' : LEVEL_FILL[day.level],
                        )}
                        style={{ width: `${day.hasEntries ? Math.max(day.score, 4) : 0}%` }}
                      />
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
