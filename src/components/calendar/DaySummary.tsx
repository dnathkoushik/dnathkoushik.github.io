import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { PERSONAL_ROUTES } from '@/config/routes'
import type { ISODate, PersonalDatabase, TaskStatus } from '@/types'
import { dayStats, goalProgress, isGoalReached } from '@/utils/analytics'
import {
  durationLabel,
  formatDayLong,
  formatWeekLabel,
  relativeDay,
  weekKeyOf,
} from '@/utils/date'
import { CAT_CLASSES, goalStatusTone, priorityTone, statusTone, truncate } from '@/utils/format'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Progress } from '@/components/ui/Progress'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { cn } from '@/lib/cn'

export interface DaySummaryProps {
  date: ISODate
  db: PersonalDatabase
  className?: string
}

const STATUS_ICON: Record<TaskStatus, string> = {
  'not-started': 'Circle',
  'in-progress': 'CircleDashed',
  completed: 'CircleCheckBig',
  skipped: 'CircleMinus',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] font-semibold tracking-wide text-ink-faint uppercase">
          {title}
        </h3>
        {count ? (
          <span className="font-mono text-xs text-ink-faint tabular-nums">{count}</span>
        ) : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Everything recorded on one day, read-only.
 *
 * The calendar is for looking back; editing lives on Today, which is one link
 * away with the date pre-filled. Keeping this panel read-only means a stray
 * click while browsing last month can never change what happened in it.
 */
export function DaySummary({ date, db, className }: DaySummaryProps) {
  const view = useMemo(() => {
    const stats = dayStats(db, date)
    const categories = new Map(db.categories.map((category) => [category.id, category]))
    const weekKey = weekKeyOf(date, db.settings.weekStartsOn)

    const tasks = db.tasks
      .filter((task) => task.date === date)
      .slice()
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))

    const logs = db.logs
      .filter((entry) => entry.date === date)
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))

    const notes = db.notes
      .filter((note) => note.date === date)
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))

    const entries = new Map(
      db.habitEntries.filter((entry) => entry.date === date).map((entry) => [entry.habitId, entry]),
    )
    const habits = db.habits
      .filter((habit) => !habit.archived)
      .map((habit) => {
        const entry = entries.get(habit.id)
        const target = habit.dailyTarget > 0 ? habit.dailyTarget : 1
        return {
          habit,
          value: entry?.value ?? 0,
          done: (entry?.value ?? 0) > 0 && (entry?.value ?? 0) >= target,
        }
      })
      .sort((a, b) => a.habit.order - b.habit.order)

    const goals = db.weeklyGoals
      .filter((goal) => goal.weekKey === weekKey && goal.status !== 'archived')
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title))

    return {
      stats,
      categories,
      weekKey,
      tasks,
      logs,
      notes,
      habits,
      goals,
      meta: db.days.find((day) => day.date === date),
    }
  }, [db, date])

  const { stats, categories, weekKey, tasks, logs, notes, habits, goals, meta } = view
  const habitsDone = habits.filter((item) => item.done)
  const anything =
    tasks.length > 0 || logs.length > 0 || notes.length > 0 || habitsDone.length > 0 || Boolean(meta?.objective)

  return (
    <Card className={cn('animate-rise', className)}>
      <CardHeader
        actions={
          <ButtonLink
            to={`${PERSONAL_ROUTES.today}?date=${date}`}
            variant="primary"
            size="sm"
            icon="SquarePen"
          >
            Open in Today
          </ButtonLink>
        }
      >
        <CardTitle as="h2" className="text-base sm:text-lg">
          <time dateTime={date}>{formatDayLong(date)}</time>
        </CardTitle>
        <p className="text-xs text-ink-faint">
          {relativeDay(date)} · week of {formatWeekLabel(weekKey, db.settings.weekStartsOn)}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center gap-4 rounded-card bg-surface-muted p-4">
          <ProgressRing
            value={stats.score}
            size={72}
            thickness={7}
            tone={stats.score >= 70 ? 'positive' : stats.score >= 40 ? 'accent' : 'neutral'}
          >
            <span className="font-mono text-base leading-none font-semibold text-ink tabular-nums">
              {stats.score}
            </span>
          </ProgressRing>

          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-ink-faint">Tasks</dt>
              <dd className="font-mono font-medium text-ink tabular-nums">
                {stats.tasksCompleted}/{stats.tasksTotal}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Logged</dt>
              <dd className="font-mono font-medium text-ink tabular-nums">
                {durationLabel(stats.loggedMinutes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Habits</dt>
              <dd className="font-mono font-medium text-ink tabular-nums">
                {stats.habitsDone}/{stats.habitsDue}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-faint">Score</dt>
              <dd className="font-mono font-medium text-ink tabular-nums">{stats.score}%</dd>
            </div>
          </dl>
        </div>

        {meta?.objective ? (
          <Section title="Objective">
            <p className="rounded-lg border border-line bg-surface-muted/60 px-3 py-2 text-sm leading-relaxed text-ink">
              {meta.objective}
            </p>
            {meta.highlight ? (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
                <Icon name="Sparkles" size={13} className="mt-0.5 text-warning" />
                <span>{meta.highlight}</span>
              </p>
            ) : null}
          </Section>
        ) : null}

        {tasks.length > 0 ? (
          <Section title="Tasks" count={`${stats.tasksCompleted}/${stats.tasksTotal}`}>
            <ul className="space-y-1.5">
              {tasks.map((task) => {
                const category = categories.get(task.categoryId)
                return (
                  <li
                    key={task.id}
                    className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2"
                  >
                    <Icon
                      name={STATUS_ICON[task.status]}
                      size={15}
                      className={cn(
                        'mt-0.5',
                        task.status === 'completed' ? 'text-positive' : 'text-ink-faint',
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm leading-snug break-words',
                          task.status === 'completed'
                            ? 'text-ink-muted line-through'
                            : 'text-ink',
                        )}
                      >
                        {task.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {category ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
                            <span
                              aria-hidden="true"
                              className={cn('size-1.5 rounded-full', CAT_CLASSES[category.color].bg)}
                            />
                            {category.label}
                          </span>
                        ) : null}
                        {task.priority === 'high' ? (
                          <Badge tone={priorityTone(task.priority)} size="sm">
                            High
                          </Badge>
                        ) : null}
                        {task.actualMinutes ? (
                          <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                            {durationLabel(task.actualMinutes)}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <Badge tone={statusTone(task.status)} size="sm">
                      {STATUS_LABEL[task.status]}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          </Section>
        ) : null}

        {logs.length > 0 ? (
          <Section title="Work log" count={durationLabel(stats.loggedMinutes)}>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {logs.map((entry) => {
                const category = categories.get(entry.categoryId)
                return (
                  <li key={entry.id} className="flex items-start gap-3 px-3 py-2">
                    <time
                      dateTime={`${date}T${entry.time}`}
                      className="w-11 shrink-0 pt-0.5 font-mono text-xs text-ink-faint tabular-nums"
                    >
                      {entry.time}
                    </time>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm leading-snug break-words text-ink">
                        {entry.activity}
                      </span>
                      {category ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
                          <span
                            aria-hidden="true"
                            className={cn('size-1.5 rounded-full', CAT_CLASSES[category.color].bg)}
                          />
                          {category.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 pt-0.5 font-mono text-xs text-ink-muted tabular-nums">
                      {durationLabel(entry.durationMinutes)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Section>
        ) : null}

        {habits.length > 0 ? (
          <Section title="Habits" count={`${habitsDone.length}/${habits.length}`}>
            <ul className="flex flex-wrap gap-1.5">
              {habits.map(({ habit, value, done }) => (
                <li key={habit.id}>
                  <Badge
                    tone={done ? 'positive' : 'neutral'}
                    icon={done ? 'Check' : 'Circle'}
                    size="sm"
                  >
                    {habit.name}
                    {habit.unit && value > 0 ? ` · ${value} ${habit.unit}` : ''}
                  </Badge>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {goals.length > 0 ? (
          <Section title="Goals live this week" count={`${goals.length}`}>
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li key={goal.id} className="rounded-lg border border-line px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 text-sm leading-snug text-ink">{goal.title}</span>
                    <Badge tone={goalStatusTone(goal.status)} size="sm">
                      {goal.status}
                    </Badge>
                  </div>
                  <Progress
                    className="mt-2"
                    value={goalProgress(goal)}
                    size="sm"
                    tone={isGoalReached(goal) ? 'positive' : 'accent'}
                    showValue
                  />
                  <p className="mt-1 font-mono text-[11px] text-ink-faint tabular-nums">
                    {goal.currentValue} / {goal.targetValue} {goal.unit}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {notes.length > 0 ? (
          <Section title="Notes" count={`${notes.length}`}>
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id} className="rounded-lg border border-line px-3 py-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    {note.pinned ? (
                      <Icon name="Pin" size={13} className="text-warning" title="Pinned" />
                    ) : null}
                    {note.title}
                  </p>
                  {note.body ? (
                    <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                      {truncate(note.body, 160)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {!anything ? (
          <div className="rounded-card border border-dashed border-line bg-surface-muted/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink">Nothing recorded on this day</p>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-ink-muted">
              Open it in Today to set an objective, add tasks or log the work you did.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
