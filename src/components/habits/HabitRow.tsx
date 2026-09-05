import type { Category, Habit, HabitEntry, ISODate } from '@/types'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { formatDayLong, fromISODate, isFutureDay, isToday } from '@/utils/date'
import { CAT_CLASSES } from '@/utils/format'

export interface HabitRowProps {
  habit: Habit
  category?: Category
  /** The seven days of the week being shown, ascending. */
  weekDays: ISODate[]
  /** This habit's entries, keyed by date. */
  entries: Map<ISODate, HabitEntry>
  onToggle: (date: ISODate) => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
  className?: string
}

/** Sunday-first initials, indexed by `Date.getDay()`. */
const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function HabitRow({
  habit,
  category,
  weekDays,
  entries,
  onToggle,
  onEdit,
  onArchive,
  onDelete,
  className,
}: HabitRowProps) {
  const swatch = CAT_CLASSES[habit.color]
  const dailyTarget = Math.max(1, habit.dailyTarget)
  const unit = habit.unit?.trim() ?? ''

  const doneCount = weekDays.reduce((count, date) => {
    const value = entries.get(date)?.value ?? 0
    return value >= dailyTarget ? count + 1 : count
  }, 0)
  const onTrack = doneCount >= habit.targetPerWeek

  const menuItems: DropdownMenuItem[] = [
    { id: 'edit', label: 'Edit habit', icon: 'Pencil', onSelect: onEdit },
    {
      id: 'archive',
      label: habit.archived ? 'Restore habit' : 'Archive habit',
      icon: habit.archived ? 'ArchiveRestore' : 'Archive',
      onSelect: onArchive,
    },
    { id: 'delete', label: 'Delete habit', icon: 'Trash', tone: 'danger', onSelect: onDelete },
  ]

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-subtle',
        'sm:flex-row sm:items-center sm:gap-5',
        habit.archived && 'opacity-70',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          aria-hidden="true"
          className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', swatch.bg)}
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] leading-snug font-semibold text-ink">{habit.name}</h3>
          <p className="mt-0.5 text-xs text-ink-faint">
            {category?.label ?? 'Uncategorised'} · {habit.targetPerWeek}× a week
            {dailyTarget > 1 || unit ? ` · ${dailyTarget} ${unit || 'per day'}` : ''}
          </p>

          <div className="mt-2 flex items-center gap-2.5">
            <Progress
              value={doneCount}
              max={habit.targetPerWeek}
              size="sm"
              tone={onTrack ? 'positive' : 'accent'}
              label={`${habit.name} weekly target`}
              className="max-w-40 [&>div:first-child]:sr-only"
            />
            <p
              className={cn(
                'font-mono text-xs font-medium tabular-nums',
                onTrack ? 'text-positive' : 'text-ink-muted',
              )}
            >
              {doneCount}/{habit.targetPerWeek}
            </p>
          </div>
        </div>

        <DropdownMenu
          items={menuItems}
          label={`Actions for ${habit.name}`}
          className="-mt-1 -mr-1 shrink-0 sm:hidden"
        />
      </div>

      <div
        role="group"
        aria-label={`${habit.name}, this week`}
        className="flex items-end justify-between gap-1 sm:justify-end sm:gap-1.5"
      >
        {weekDays.map((date) => {
          const value = entries.get(date)?.value ?? 0
          const done = value >= dailyTarget
          const partial = !done && value > 0
          const future = isFutureDay(date)
          const today = isToday(date)
          const weekday = WEEKDAY_INITIALS[fromISODate(date).getDay()]

          const state = future
            ? 'upcoming'
            : done
              ? `done, ${value}${unit ? ` ${unit}` : ''}`
              : partial
                ? `${value} of ${dailyTarget}${unit ? ` ${unit}` : ''}`
                : 'not done'

          return (
            <div key={date} className="flex flex-col items-center gap-1">
              <span aria-hidden="true" className="font-mono text-[10px] text-ink-faint">
                {weekday}
              </span>
              <button
                type="button"
                disabled={future}
                aria-pressed={future ? undefined : done}
                aria-label={`${habit.name} on ${formatDayLong(date)}: ${state}`}
                onClick={() => onToggle(date)}
                className={cn(
                  'inline-flex size-10 items-center justify-center rounded-lg border font-mono text-xs font-medium tabular-nums transition-colors',
                  'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                  future && 'cursor-not-allowed border-dashed border-line bg-transparent opacity-60',
                  !future && done && cn(swatch.bg, 'border-transparent text-canvas'),
                  !future && partial && cn(swatch.softBg, swatch.border, swatch.text),
                  !future &&
                    !done &&
                    !partial &&
                    'border-line bg-surface-muted text-ink-faint hover:border-line-strong hover:bg-surface-hover',
                  today && 'ring-2 ring-accent/40 ring-offset-1 ring-offset-surface',
                )}
              >
                {done ? (
                  <Icon name="Check" className="size-4" />
                ) : partial ? (
                  value
                ) : (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-50" />
                )}
              </button>
            </div>
          )
        })}
      </div>

      <DropdownMenu
        items={menuItems}
        label={`Actions for ${habit.name}`}
        className="hidden shrink-0 sm:inline-flex"
      />
    </li>
  )
}
