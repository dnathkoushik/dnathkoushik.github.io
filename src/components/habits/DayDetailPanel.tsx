import type { Category, DayStats, Habit, ISODate, LogEntry, Task } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { PERSONAL_ROUTES } from '@/config/routes'
import { cn } from '@/lib/cn'
import { durationLabel, formatDayLong, relativeDay } from '@/utils/date'
import { catClasses, pluralize } from '@/utils/format'

export interface DayHabitStatus {
  habit: Habit
  value: number
  done: boolean
}

export interface DayDetailPanelProps {
  date: ISODate
  stats: DayStats
  /** Every task filed against this day, in display order. */
  tasks: Task[]
  logs: LogEntry[]
  habits: DayHabitStatus[]
  objective?: string
  highlight?: string
  categories: Map<string, Category>
  className?: string
}

function SectionLabel({ icon, children }: { icon: string; children: string }) {
  return (
    <p className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] text-ink-faint uppercase">
      <Icon name={icon} className="size-3.5" />
      {children}
    </p>
  )
}

function CategoryDot({ category }: { category?: Category }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2 shrink-0 rounded-full', catClasses(category?.color).bg)}
    />
  )
}

/**
 * What actually happened on one day.
 *
 * Rendered inside a dialog on a phone and as a card on a wide screen, so it
 * owns no container of its own — only the content, and only what exists: a
 * section with nothing in it is not drawn rather than drawn empty.
 */
export function DayDetailPanel({
  date,
  stats,
  tasks,
  logs,
  habits,
  objective,
  highlight,
  categories,
  className,
}: DayDetailPanelProps) {
  const completedTasks = tasks.filter((task) => task.status === 'completed')
  const openTasks = tasks.filter((task) => task.status !== 'completed')
  const doneHabits = habits.filter((entry) => entry.done)
  const scoreTone = stats.score >= 70 ? 'positive' : stats.score >= 40 ? 'accent' : 'neutral'

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[15px] leading-snug font-semibold text-ink">
            <time dateTime={date}>{formatDayLong(date)}</time>
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">{relativeDay(date)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="neutral" size="sm" icon="ListTodo">
              {stats.tasksCompleted}/{stats.tasksTotal} tasks
            </Badge>
            <Badge tone="neutral" size="sm" icon="Clock">
              {durationLabel(stats.loggedMinutes)}
            </Badge>
            <Badge tone="neutral" size="sm" icon="Flame">
              {stats.habitsDone}/{stats.habitsDue} habits
            </Badge>
          </div>
        </div>

        <ProgressRing
          value={stats.score}
          size={60}
          thickness={6}
          tone={scoreTone}
          label={`Day score for ${formatDayLong(date)}`}
          className="shrink-0"
        >
          <span className="font-mono text-sm font-semibold text-ink tabular-nums">
            {stats.score}
          </span>
        </ProgressRing>
      </div>

      {objective ? (
        <section aria-label="Objective for the day" className="rounded-lg bg-surface-muted p-3">
          <SectionLabel icon="Target">Objective</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">{objective}</p>
        </section>
      ) : null}

      {!stats.hasEntries ? (
        <p className="rounded-lg border border-dashed border-line bg-surface-muted/40 px-4 py-6 text-center text-sm text-ink-muted">
          Nothing was recorded on this day.
        </p>
      ) : null}

      {tasks.length > 0 ? (
        <section aria-label="Tasks on this day" className="space-y-2">
          <SectionLabel icon="ListTodo">
            {`Tasks · ${stats.tasksCompleted} of ${stats.tasksTotal} done`}
          </SectionLabel>
          <ul className="space-y-1.5">
            {[...completedTasks, ...openTasks].map((task) => {
              const done = task.status === 'completed'
              return (
                <li key={task.id} className="flex items-start gap-2 text-sm">
                  <Icon
                    name={done ? 'CircleCheckBig' : task.status === 'skipped' ? 'CircleX' : 'Circle'}
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0',
                      done ? 'text-positive' : 'text-ink-faint',
                    )}
                  />
                  <span className={cn('min-w-0 flex-1', done ? 'text-ink' : 'text-ink-muted')}>
                    {task.title}
                  </span>
                  {task.actualMinutes ? (
                    <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                      {durationLabel(task.actualMinutes)}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {logs.length > 0 ? (
        <section aria-label="Work log for this day" className="space-y-2">
          <SectionLabel icon="Clock">
            {`Work log · ${durationLabel(stats.loggedMinutes)} across ${pluralize(logs.length, 'entry', 'entries')}`}
          </SectionLabel>
          <ul className="space-y-1.5">
            {[...logs]
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((log) => (
                <li key={log.id} className="flex items-start gap-2 text-sm">
                  <span className="w-11 shrink-0 pt-0.5 font-mono text-xs text-ink-faint tabular-nums">
                    {log.time}
                  </span>
                  <CategoryDot category={categories.get(log.categoryId)} />
                  <span className="min-w-0 flex-1 text-ink-muted">{log.activity}</span>
                  <span className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                    {durationLabel(log.durationMinutes)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {habits.length > 0 ? (
        <section aria-label="Habits on this day" className="space-y-2">
          <SectionLabel icon="Flame">
            {`Habits · ${doneHabits.length} of ${habits.length} done`}
          </SectionLabel>
          <ul className="flex flex-wrap gap-1.5">
            {habits.map(({ habit, value, done }) => (
              <li key={habit.id}>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                    done
                      ? cn(catClasses(habit.color).softBg, catClasses(habit.color).text, catClasses(habit.color).ring)
                      : 'bg-surface-muted text-ink-faint ring-line',
                  )}
                >
                  <Icon name={done ? 'Check' : 'Minus'} className="size-3" />
                  {habit.name}
                  {habit.dailyTarget > 1 ? (
                    <span className="font-mono tabular-nums">
                      {value}/{habit.dailyTarget}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {highlight ? (
        <section aria-label="Highlight of the day" className="space-y-1.5">
          <SectionLabel icon="Sparkles">Highlight</SectionLabel>
          <p className="text-sm leading-relaxed text-ink-muted">{highlight}</p>
        </section>
      ) : null}

      <ButtonLink
        to={`${PERSONAL_ROUTES.today}?date=${date}`}
        variant="secondary"
        size="sm"
        iconRight="ArrowRight"
        className="self-start"
      >
        Open this day
      </ButtonLink>
    </div>
  )
}
