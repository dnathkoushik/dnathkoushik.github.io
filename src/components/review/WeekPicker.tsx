import type { MonthKey, WeekKey } from '@/types'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import type { WeekStartsOn } from '@/utils/date'
import {
  formatMonthLabel,
  formatWeekLabel,
  monthKeyOf,
  shiftMonth,
  shiftWeek,
  todayISO,
  weekKeyOf,
} from '@/utils/date'

/**
 * The period selector shared by Goals and the Weekly review.
 *
 * Two exports rather than one component with a `mode` prop: a week is keyed by
 * `WeekKey` and a month by `MonthKey`, and collapsing them into one union type
 * would push a cast onto every caller. The chrome is factored into `PeriodNav`
 * so both stay pixel-identical.
 */

interface PeriodNavProps {
  label: string
  /** Announced as the group name, e.g. "Week navigation". */
  groupLabel: string
  previousLabel: string
  nextLabel: string
  onPrevious: () => void
  onNext: () => void
  /** Rendered only when the selection has moved away from the present. */
  reset?: { label: string; onSelect: () => void }
  className?: string
}

function PeriodNav({
  label,
  groupLabel,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  reset,
  className,
}: PeriodNavProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div
        role="group"
        aria-label={groupLabel}
        className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 shadow-subtle"
      >
        <button
          type="button"
          onClick={onPrevious}
          aria-label={previousLabel}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink pointer-coarse:size-10"
        >
          <Icon name="ChevronLeft" className="size-4" />
        </button>

        <span className="min-w-40 px-2 text-center font-mono text-[13px] font-medium tracking-tight text-ink tabular-nums sm:min-w-44">
          {label}
        </span>

        <button
          type="button"
          onClick={onNext}
          aria-label={nextLabel}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink pointer-coarse:size-10"
        >
          <Icon name="ChevronRight" className="size-4" />
        </button>
      </div>

      {reset ? (
        <Button variant="ghost" size="sm" icon="RotateCcw" onClick={reset.onSelect}>
          {reset.label}
        </Button>
      ) : null}
    </div>
  )
}

export interface WeekPickerProps {
  weekKey: WeekKey
  onChange: (weekKey: WeekKey) => void
  weekStartsOn: WeekStartsOn
  /** Label for the shortcut back to the present week. */
  currentLabel?: string
  className?: string
}

export function WeekPicker({
  weekKey,
  onChange,
  weekStartsOn,
  currentLabel = 'This week',
  className,
}: WeekPickerProps) {
  const currentWeek = weekKeyOf(todayISO(), weekStartsOn)
  const label = formatWeekLabel(weekKey, weekStartsOn)

  return (
    <PeriodNav
      className={className}
      groupLabel="Week navigation"
      label={label}
      previousLabel={`Previous week, ${formatWeekLabel(shiftWeek(weekKey, -1, weekStartsOn), weekStartsOn)}`}
      nextLabel={`Next week, ${formatWeekLabel(shiftWeek(weekKey, 1, weekStartsOn), weekStartsOn)}`}
      onPrevious={() => onChange(shiftWeek(weekKey, -1, weekStartsOn))}
      onNext={() => onChange(shiftWeek(weekKey, 1, weekStartsOn))}
      reset={
        weekKey === currentWeek
          ? undefined
          : { label: currentLabel, onSelect: () => onChange(currentWeek) }
      }
    />
  )
}

export interface MonthPickerProps {
  monthKey: MonthKey
  onChange: (monthKey: MonthKey) => void
  currentLabel?: string
  className?: string
}

export function MonthPicker({
  monthKey,
  onChange,
  currentLabel = 'This month',
  className,
}: MonthPickerProps) {
  const currentMonth = monthKeyOf(todayISO())

  return (
    <PeriodNav
      className={className}
      groupLabel="Month navigation"
      label={formatMonthLabel(monthKey)}
      previousLabel={`Previous month, ${formatMonthLabel(shiftMonth(monthKey, -1))}`}
      nextLabel={`Next month, ${formatMonthLabel(shiftMonth(monthKey, 1))}`}
      onPrevious={() => onChange(shiftMonth(monthKey, -1))}
      onNext={() => onChange(shiftMonth(monthKey, 1))}
      reset={
        monthKey === currentMonth
          ? undefined
          : { label: currentLabel, onSelect: () => onChange(currentMonth) }
      }
    />
  )
}
