import { useMemo } from 'react'
import type { ISODate } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/cn'
import type { WeekStartsOn } from '@/utils/date'
import { fromISODate } from '@/utils/date'

export type HeatmapLevel = 0 | 1 | 2 | 3 | 4

export interface HeatmapDay {
  date: ISODate
  level: HeatmapLevel
  /** A complete sentence — it is both the tooltip and the cell's a11y name. */
  label: string
}

export interface HabitHeatmapProps {
  /** Dense, ascending, ending on the most recent day worth showing. */
  days: HeatmapDay[]
  weekStartsOn: WeekStartsOn
  selectedDate?: ISODate
  onSelectDate: (date: ISODate) => void
  /** Sentence naming the whole grid, e.g. "Activity over the last 26 weeks…". */
  summary: string
  className?: string
}

/*
 * Geometry lives in JS rather than in classes because the month labels are
 * positioned by column index — the two have to agree on the pitch to the pixel,
 * and a Tailwind size class the labels cannot read would drift the moment the
 * cell size changed.
 */
const CELL = 14
const GAP = 4
const PITCH = CELL + GAP
/** Columns that must pass before another month label is allowed. */
const MIN_LABEL_GAP = 3

const LEVEL_CLASS: Record<HeatmapLevel, string> = {
  0: 'bg-surface-muted ring-1 ring-inset ring-line',
  1: 'bg-accent/25',
  2: 'bg-accent/45',
  3: 'bg-accent/70',
  4: 'bg-accent',
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * A contribution grid: one column per week, one row per weekday.
 *
 * Colour is never the only channel. Every cell is a button whose accessible
 * name spells out the day and its actual figures, so the grid is fully
 * readable with the shading switched off, inverted, or unseen.
 */
export function HabitHeatmap({
  days,
  weekStartsOn,
  selectedDate,
  onSelectDate,
  summary,
  className,
}: HabitHeatmapProps) {
  const { cells, monthLabels, weeks } = useMemo(() => {
    if (days.length === 0) {
      return { cells: [] as (HeatmapDay | null)[], monthLabels: [] as { col: number; label: string }[], weeks: 0 }
    }

    // Pad the first column so the grid's rows line up with real weekdays.
    const lead = (fromISODate(days[0].date).getDay() - weekStartsOn + 7) % 7
    const padded: (HeatmapDay | null)[] = [...Array<null>(lead).fill(null), ...days]
    const columnCount = Math.ceil(padded.length / 7)

    const labels: { col: number; label: string }[] = []
    let lastMonth = -1
    let lastCol = -MIN_LABEL_GAP

    for (let col = 0; col < columnCount; col += 1) {
      const first = padded.slice(col * 7, col * 7 + 7).find((cell) => cell !== null)
      if (!first) continue
      const month = fromISODate(first.date).getMonth()
      if (month !== lastMonth && col - lastCol >= MIN_LABEL_GAP) {
        labels.push({ col, label: MONTH_SHORT[month] })
        lastCol = col
      }
      lastMonth = month
    }

    return { cells: padded, monthLabels: labels, weeks: columnCount }
  }, [days, weekStartsOn])

  if (days.length === 0) {
    return (
      <p className={cn('text-sm text-ink-muted', className)}>
        Nothing recorded in this range yet.
      </p>
    )
  }

  return (
    <div className={cn('w-full', className)}>
      <div className="no-scrollbar w-full overflow-x-auto">
        <div className="flex w-max gap-2">
          {/* Weekday gutter. `pt-5` matches the month-label strip beside it. */}
          <div
            aria-hidden="true"
            className="grid shrink-0 pt-5"
            style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: `${GAP}px` }}
          >
            {Array.from({ length: 7 }, (_, row) => {
              const weekday = (weekStartsOn + row) % 7
              return (
                <span
                  key={weekday}
                  className="flex items-center pr-1 font-mono text-[10px] leading-none text-ink-faint"
                >
                  {row % 2 === 1 ? WEEKDAY_SHORT[weekday] : ''}
                </span>
              )
            })}
          </div>

          <div className="shrink-0">
            <div
              aria-hidden="true"
              className="relative h-5"
              style={{ width: weeks * PITCH }}
            >
              {monthLabels.map((entry) => (
                <span
                  key={`${entry.col}-${entry.label}`}
                  className="absolute top-0 font-mono text-[10px] leading-none text-ink-faint"
                  style={{ left: entry.col * PITCH }}
                >
                  {entry.label}
                </span>
              ))}
            </div>

            <div
              role="group"
              aria-label={summary}
              className="grid"
              style={{
                gridTemplateRows: `repeat(7, ${CELL}px)`,
                gridAutoFlow: 'column',
                gridAutoColumns: `${CELL}px`,
                gap: `${GAP}px`,
              }}
            >
              {cells.map((cell, index) => {
                if (!cell) {
                  return <span key={`pad-${index}`} aria-hidden="true" />
                }

                const selected = cell.date === selectedDate
                // Rows near the top open downwards so the tooltip is never
                // clipped by the horizontal scroll container above it.
                const side = index % 7 <= 2 ? 'bottom' : 'top'

                return (
                  <Tooltip key={cell.date} content={cell.label} side={side}>
                    <button
                      type="button"
                      onClick={() => onSelectDate(cell.date)}
                      aria-label={cell.label}
                      aria-current={selected ? 'date' : undefined}
                      style={{ width: CELL, height: CELL }}
                      className={cn(
                        'rounded-[3px] transition-colors outline-accent',
                        'focus-visible:outline-2 focus-visible:outline-offset-2',
                        LEVEL_CLASS[cell.level],
                        selected && 'ring-2 ring-ink ring-offset-1 ring-offset-surface',
                      )}
                    />
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <Icon name="Info" className="size-3.5" />
          Select any day to see exactly what happened on it.
        </p>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as HeatmapLevel[]).map((level) => (
            <span
              key={level}
              aria-hidden="true"
              className={cn('size-3 rounded-[3px]', LEVEL_CLASS[level])}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      <p className="sr-only">
        Shading runs across five levels from no activity to a full day. Every cell also states its
        exact figures, so the grid does not rely on colour.
      </p>
    </div>
  )
}
