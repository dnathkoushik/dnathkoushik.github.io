import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ActivityKind, PartOfDay, Priority, Tone } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Progress } from '@/components/ui/Progress'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { useToast } from '@/components/ui/Toast'
import { PrivacyNotice } from '@/components/personal/PrivacyNotice'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useCategories, useSettings } from '@/hooks/personal'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { buildActivityFeed, dayStats, goalProgress, heatmapData, isGoalReached, rangeStats, streakInfo } from '@/utils/analytics'
import {
  durationLabel,
  formatDayLong,
  formatMonthLabel,
  formatWeekLabel,
  monthKeyOf,
  nowClockTime,
  partOfDay,
  relativeDay,
  shiftWeek,
  todayISO,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import { pluralize, priorityTone, truncate } from '@/utils/format'

const GREETING: Record<PartOfDay, string> = {
  morning: 'Good morning',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good evening',
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const ACTIVITY_STYLE: Record<ActivityKind, { icon: string; className: string }> = {
  'task-completed': { icon: 'CircleCheckBig', className: 'bg-positive-soft text-positive' },
  log: { icon: 'Clock', className: 'bg-info-soft text-info' },
  'goal-completed': { icon: 'Target', className: 'bg-accent-soft text-accent' },
  habit: { icon: 'Flame', className: 'bg-warning-soft text-warning' },
  note: { icon: 'StickyNote', className: 'bg-surface-muted text-ink-muted' },
  review: { icon: 'ClipboardList', className: 'bg-accent-soft text-accent' },
  'day-objective': { icon: 'Crosshair', className: 'bg-surface-muted text-ink-muted' },
}

const ACTIVITY_LABEL: Record<ActivityKind, string> = {
  'task-completed': 'Completed',
  log: 'Logged',
  'goal-completed': 'Goal reached',
  habit: 'Habit',
  note: 'Note',
  review: 'Review',
  'day-objective': 'Objective',
}

/** Score buckets for the consistency strip, from "nothing" to "a full day". */
const LEVEL_CLASS = [
  'bg-surface-muted',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const

const QUICK_ACTIONS: { href: string; icon: string; label: string; description: string }[] = [
  {
    href: `${PERSONAL_ROUTES.today}?focus=task`,
    icon: 'Plus',
    label: 'Add a task',
    description: 'Straight into the entry box for today',
  },
  {
    href: `${PERSONAL_ROUTES.today}?focus=log`,
    icon: 'Clock',
    label: 'Log work',
    description: 'Record what you just finished',
  },
  {
    href: PERSONAL_ROUTES.review,
    icon: 'ClipboardList',
    label: 'Weekly review',
    description: 'Close the week out honestly',
  },
  {
    href: PERSONAL_ROUTES.calendar,
    icon: 'CalendarDays',
    label: 'Open the calendar',
    description: 'Browse any day of any month',
  },
]

function scoreTone(score: number): Tone {
  if (score >= 75) return 'positive'
  if (score >= 40) return 'accent'
  return 'warning'
}

export default function OverviewPage() {
  useDocumentMeta({
    title: 'Dashboard',
    description: 'A private productivity dashboard stored only in this browser.',
    noindex: true,
  })

  const { db, status, actions } = usePersonalData()
  const settings = useSettings()
  const categories = useCategories()
  const { toast } = useToast()
  const [seeding, setSeeding] = useState(false)

  const today = todayISO()
  const weekKey = weekKeyOf(today, settings.weekStartsOn)
  const monthKey = monthKeyOf(today)

  const todayStats = useMemo(() => dayStats(db, today), [db, today])

  const todaysTasks = useMemo(
    () =>
      db.tasks
        .filter((task) => task.date === today)
        .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    [db.tasks, today],
  )

  const nextTask = useMemo(
    () =>
      todaysTasks
        .filter((task) => task.status === 'not-started' || task.status === 'in-progress')
        .sort(
          (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order,
        )
        .at(0),
    [todaysTasks],
  )

  const objective = useMemo(
    () => db.days.find((day) => day.date === today)?.objective ?? '',
    [db.days, today],
  )

  const week = useMemo(() => weekRange(weekKey, settings.weekStartsOn), [weekKey, settings.weekStartsOn])
  const weekStats = useMemo(() => rangeStats(db, week.start, week.end), [db, week.start, week.end])

  const weeklyGoals = useMemo(
    () =>
      db.weeklyGoals
        .filter((goal) => goal.weekKey === weekKey && goal.status !== 'archived')
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [db.weeklyGoals, weekKey],
  )

  const monthlyGoals = useMemo(
    () =>
      db.monthlyGoals
        .filter((goal) => goal.monthKey === monthKey && goal.status !== 'archived')
        .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    [db.monthlyGoals, monthKey],
  )

  const streak = useMemo(() => streakInfo(db, today), [db, today])

  /*
   * Eight whole weeks, aligned to the week start so every column in the strip is
   * one week and the last column is the week in progress.
   */
  const strip = useMemo(() => {
    const first = weekRange(shiftWeek(weekKey, -7, settings.weekStartsOn), settings.weekStartsOn)
    return heatmapData(db, first.start, week.end)
  }, [db, weekKey, settings.weekStartsOn, week.end])

  const stripSummary = useMemo(() => {
    const active = strip.filter((cell) => cell.hasEntries)
    const average =
      active.length > 0
        ? Math.round(active.reduce((total, cell) => total + cell.score, 0) / active.length)
        : 0
    return { activeDays: active.length, average, days: strip.length }
  }, [strip])

  const feed = useMemo(() => buildActivityFeed(db, { limit: 8 }), [db])

  const categoryLabel = useMemo(() => {
    if (!nextTask) return undefined
    return categories.find((category) => category.id === nextTask.categoryId)?.label
  }, [categories, nextTask])

  const isEmpty =
    db.tasks.length === 0 &&
    db.logs.length === 0 &&
    db.weeklyGoals.length === 0 &&
    db.monthlyGoals.length === 0 &&
    db.habits.length === 0 &&
    db.notes.length === 0 &&
    db.reviews.length === 0 &&
    db.days.length === 0

  const greeting = `${GREETING[partOfDay(nowClockTime())]}, ${settings.displayName}`
  const remaining = todayStats.tasksTotal - todayStats.tasksCompleted - todayStats.tasksSkipped
  const monthCompleted = monthlyGoals.filter(isGoalReached).length
  const monthAverage =
    monthlyGoals.length > 0
      ? Math.round(
          monthlyGoals.reduce((total, goal) => total + goalProgress(goal), 0) /
            monthlyGoals.length,
        )
      : 0

  async function loadSample() {
    setSeeding(true)
    try {
      await actions.loadSampleData()
      toast({
        title: 'Sample data loaded',
        description: 'Every screen now has something real to show. Clear it any time from Settings.',
        tone: 'positive',
        duration: 5000,
      })
    } catch {
      toast({
        title: 'Could not load the sample data',
        description: 'This browser refused to write to its own storage. Try again in a normal window.',
        tone: 'danger',
        duration: 6000,
      })
    } finally {
      setSeeding(false)
    }
  }

  function startClean() {
    actions.updateSettings({ seedDataCleared: true })
    toast({
      title: 'Starting clean',
      description: 'The eight default categories are kept. Add your first task on the Today screen.',
      tone: 'positive',
      duration: 4000,
    })
  }

  if (status === 'loading') {
    return (
      <div className="space-y-6" aria-busy="true">
        <p role="status" className="sr-only">
          Loading your dashboard from this browser.
        </p>
        <Skeleton className="h-20 rounded-card" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
        </div>
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    )
  }

  const showFirstRun = isEmpty && !settings.seedDataCleared

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={formatDayLong(today)}
        title={greeting}
        description="Everything below is computed from your own data. Nothing here leaves this browser."
        actions={
          <ButtonLink to={PERSONAL_ROUTES.today} variant="primary" icon="ListTodo">
            Open today
          </ButtonLink>
        }
      />

      <PrivacyNotice variant="banner" />

      {showFirstRun ? (
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle as="h2">Start your dashboard</CardTitle>
            <CardDescription>
              There is nothing stored yet. Pick how you want to begin — both options are
              reversible from Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-muted/50 p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">
                <Icon name="Sparkles" size={18} />
              </span>
              <div className="space-y-1">
                <h3 className="text-[15px] font-semibold text-ink">Load sample data</h3>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Fills the dashboard with a few weeks of realistic tasks, work log entries,
                  goals and habits so every screen has something to show. It replaces whatever
                  is stored now, and Settings can wipe it in one click.
                </p>
              </div>
              <Button
                variant="primary"
                icon="Download"
                loading={seeding}
                onClick={loadSample}
                className="mt-auto"
              >
                Load sample data
              </Button>
            </div>

            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-muted/50 p-4">
              <span className="grid size-9 place-items-center rounded-lg bg-surface text-ink-muted">
                <Icon name="Inbox" size={18} />
              </span>
              <div className="space-y-1">
                <h3 className="text-[15px] font-semibold text-ink">Start clean</h3>
                <p className="text-sm leading-relaxed text-ink-muted">
                  Keeps the eight default categories and nothing else. This card goes away and
                  the dashboard fills up as you use it — begin with a task or a work log entry
                  on the Today screen.
                </p>
              </div>
              <Button variant="secondary" icon="Check" onClick={startClean} className="mt-auto">
                Start clean
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showFirstRun ? null : (
        <>
        {/* 1 — today, in numbers */}
        <section aria-labelledby="overview-today" className="space-y-4">
          <h2 id="overview-today" className="sr-only">
            Today at a glance
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Open today"
              value={remaining}
              sublabel={
                todayStats.tasksTotal === 0
                  ? 'No tasks planned yet'
                  : `${todayStats.tasksCompleted} done, ${todayStats.tasksSkipped} skipped`
              }
              icon="ListTodo"
              tone={remaining > 0 ? 'accent' : 'positive'}
            />
            <Stat
              label="Logged today"
              value={durationLabel(todayStats.loggedMinutes)}
              sublabel={`Target ${durationLabel(settings.dailyHoursTarget * 60)}`}
              icon="Clock"
              tone="info"
            />
            <Stat
              label="Day score"
              value={todayStats.score}
              sublabel="Tasks, time and habits combined"
              icon="Gauge"
              tone={scoreTone(todayStats.score)}
            />
            <Stat
              label="Current streak"
              value={pluralize(streak.current, 'day')}
              sublabel={`Best run ${pluralize(streak.best, 'day')}`}
              icon="Flame"
              tone={streak.current > 0 ? 'warning' : 'neutral'}
            />
          </div>

          <Card>
            <CardHeader
              actions={
                <ButtonLink
                  to={PERSONAL_ROUTES.today}
                  variant="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                >
                  Open today
                </ButtonLink>
              }
            >
              <CardTitle as="h3">Today at a glance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Objective
                </p>
                {objective ? (
                  <p className="text-[15px] leading-relaxed text-ink">{objective}</p>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-muted">
                    No objective set yet.{' '}
                    <Link
                      to={PERSONAL_ROUTES.today}
                      className="font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Set one for today
                    </Link>
                    .
                  </p>
                )}

                <Progress
                  value={todayStats.tasksCompleted}
                  max={Math.max(todayStats.tasksTotal, 1)}
                  tone="positive"
                  label={`${todayStats.tasksCompleted} of ${todayStats.tasksTotal} tasks completed`}
                  showValue
                  className="pt-1"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                  Next up
                </p>
                {nextTask ? (
                  <div className="space-y-2 rounded-lg border border-line bg-surface-muted/50 p-3">
                    <p className="text-sm font-medium text-ink">{nextTask.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <Badge tone={priorityTone(nextTask.priority)} size="sm">
                        {PRIORITY_LABEL[nextTask.priority]}
                      </Badge>
                      {categoryLabel ? <span>{categoryLabel}</span> : null}
                      {nextTask.estimatedMinutes !== undefined ? (
                        <span className="font-mono tabular-nums">
                          {durationLabel(nextTask.estimatedMinutes)}
                        </span>
                      ) : null}
                      {nextTask.status === 'in-progress' ? (
                        <Badge tone="accent" size="sm" icon="Play">
                          In progress
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-ink-muted">
                    {todayStats.tasksTotal === 0
                      ? 'Nothing planned for today yet.'
                      : 'Everything planned for today is closed out.'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 2 — the week */}
        <section aria-labelledby="overview-week">
          <Card>
            <CardHeader
              actions={
                <ButtonLink
                  to={PERSONAL_ROUTES.goals}
                  variant="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                >
                  Goals
                </ButtonLink>
              }
            >
              <CardTitle as="h2" id="overview-week">
                On track this week
              </CardTitle>
              <CardDescription>{formatWeekLabel(weekKey, settings.weekStartsOn)}</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: 'Completion',
                    value: `${weekStats.completionRate}%`,
                    detail: `${weekStats.tasksCompleted}/${weekStats.tasksTotal} tasks`,
                  },
                  {
                    label: 'Logged',
                    value: durationLabel(weekStats.loggedMinutes),
                    detail: `${pluralize(weekStats.activeDays, 'active day')}`,
                  },
                  {
                    label: 'Goals',
                    value: `${weeklyGoals.filter(isGoalReached).length}/${weeklyGoals.length}`,
                    detail: 'reached this week',
                  },
                  {
                    label: 'Best run',
                    value: pluralize(weekStats.bestStreak, 'day'),
                    detail: 'inside this week',
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-surface-muted/60 p-3">
                    <dt className="text-xs font-medium tracking-wide text-ink-faint uppercase">
                      {item.label}
                    </dt>
                    <dd className="mt-1 font-mono text-lg font-semibold text-ink tabular-nums">
                      {item.value}
                    </dd>
                    <dd className="text-xs text-ink-muted">{item.detail}</dd>
                  </div>
                ))}
              </dl>

              {weeklyGoals.length > 0 ? (
                <ul className="space-y-3">
                  {weeklyGoals.slice(0, 4).map((goal) => (
                    <li key={goal.id}>
                      <Progress
                        value={goalProgress(goal)}
                        tone={isGoalReached(goal) ? 'positive' : 'accent'}
                        label={`${goal.title} — ${goal.currentValue}/${goal.targetValue} ${goal.unit}`.trim()}
                        showValue
                      />
                    </li>
                  ))}
                  {weeklyGoals.length > 4 ? (
                    <li className="text-xs text-ink-faint">
                      <Link
                        to={PERSONAL_ROUTES.goals}
                        className="underline-offset-4 hover:text-ink hover:underline"
                      >
                        {weeklyGoals.length - 4} more this week
                      </Link>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <EmptyState
                  icon="Target"
                  title="No goals set for this week"
                  description="A week without a target is a week you cannot review. Two or three is usually enough."
                  action={
                    <ButtonLink to={PERSONAL_ROUTES.goals} variant="secondary" icon="Plus">
                      Set a weekly goal
                    </ButtonLink>
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* 3 — consistency and the month */}
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="overview-consistency">
            <Card className="h-full">
              <CardHeader
                actions={
                  <ButtonLink
                    to={PERSONAL_ROUTES.habits}
                    variant="ghost"
                    size="sm"
                    iconRight="ArrowRight"
                  >
                    Habits
                  </ButtonLink>
                }
              >
                <CardTitle as="h2" id="overview-consistency">
                  Consistency
                </CardTitle>
                <CardDescription>The last eight weeks, one square per day.</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-6">
                  <div>
                    <p className="font-mono text-2xl font-semibold text-ink tabular-nums">
                      {streak.current}
                    </p>
                    <p className="text-xs text-ink-muted">
                      current streak{streak.lastActiveDate ? `, last active ${relativeDay(streak.lastActiveDate).toLowerCase()}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-2xl font-semibold text-ink tabular-nums">
                      {streak.best}
                    </p>
                    <p className="text-xs text-ink-muted">best streak</p>
                  </div>
                </div>

                <div
                  role="img"
                  aria-label={`Daily scores for the last ${stripSummary.days} days: ${stripSummary.activeDays} days with activity, averaging ${stripSummary.average} out of 100 on those days.`}
                  className="grid grid-flow-col grid-rows-7 gap-1"
                >
                  {strip.map((cell) => (
                    <span
                      key={cell.date}
                      title={`${cell.date} — score ${cell.score}, ${cell.tasksCompleted}/${cell.tasksTotal} tasks, ${durationLabel(cell.loggedMinutes)} logged`}
                      className={cn('size-3 rounded-[3px]', LEVEL_CLASS[cell.level])}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-faint">
                  <p>
                    {pluralize(stripSummary.activeDays, 'active day')} of {stripSummary.days},
                    averaging {stripSummary.average}/100
                  </p>
                  <p className="flex items-center gap-1">
                    <span>Less</span>
                    {LEVEL_CLASS.map((level) => (
                      <span
                        key={level}
                        aria-hidden="true"
                        className={cn('size-2.5 rounded-[3px]', level)}
                      />
                    ))}
                    <span>More</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="overview-month">
            <Card className="h-full">
              <CardHeader
                actions={
                  <ButtonLink
                    to={PERSONAL_ROUTES.goals}
                    variant="ghost"
                    size="sm"
                    iconRight="ArrowRight"
                  >
                    Goals
                  </ButtonLink>
                }
              >
                <CardTitle as="h2" id="overview-month">
                  This month
                </CardTitle>
                <CardDescription>{formatMonthLabel(monthKey)}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {monthlyGoals.length > 0 ? (
                  <>
                    <div className="flex items-baseline gap-6">
                      <div>
                        <p className="font-mono text-2xl font-semibold text-ink tabular-nums">
                          {monthCompleted}/{monthlyGoals.length}
                        </p>
                        <p className="text-xs text-ink-muted">goals reached</p>
                      </div>
                      <div>
                        <p className="font-mono text-2xl font-semibold text-ink tabular-nums">
                          {monthAverage}%
                        </p>
                        <p className="text-xs text-ink-muted">average progress</p>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {monthlyGoals.slice(0, 3).map((goal) => (
                        <li key={goal.id}>
                          <Progress
                            value={goalProgress(goal)}
                            tone={isGoalReached(goal) ? 'positive' : 'accent'}
                            label={`${goal.title} — ${goal.currentValue}/${goal.targetValue} ${goal.unit}`.trim()}
                            showValue
                          />
                        </li>
                      ))}
                    </ul>

                    {monthlyGoals.length > 3 ? (
                      <p className="text-xs text-ink-faint">
                        <Link
                          to={PERSONAL_ROUTES.goals}
                          className="underline-offset-4 hover:text-ink hover:underline"
                        >
                          {monthlyGoals.length - 3} more this month
                        </Link>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <EmptyState
                    icon="CalendarRange"
                    title="No monthly goals yet"
                    description="Monthly goals are where the weekly ones add up to something. Set one or two."
                    action={
                      <ButtonLink to={PERSONAL_ROUTES.goals} variant="secondary" icon="Plus">
                        Set a monthly goal
                      </ButtonLink>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        {/* 4 — what has actually been happening */}
        <section aria-labelledby="overview-activity">
          <Card>
            <CardHeader
              actions={
                <ButtonLink
                  to={PERSONAL_ROUTES.timeline}
                  variant="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                >
                  Timeline
                </ButtonLink>
              }
            >
              <CardTitle as="h2" id="overview-activity">
                Recent activity
              </CardTitle>
              <CardDescription>The last few things you finished, newest first.</CardDescription>
            </CardHeader>

            <CardContent>
              {feed.length > 0 ? (
                <ul className="divide-y divide-line">
                  {feed.map((item) => {
                    const style = ACTIVITY_STYLE[item.kind]
                    return (
                      <li key={item.id}>
                        <Link
                          to={item.href ?? PERSONAL_ROUTES.timeline}
                          className="flex items-start gap-3 rounded-lg px-1 py-3 transition-colors duration-150 hover:bg-surface-hover"
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              'grid size-8 shrink-0 place-items-center rounded-lg',
                              style.className,
                            )}
                          >
                            <Icon name={style.icon} size={15} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-ink">
                              {item.title}
                            </span>
                            <span className="block text-xs text-ink-muted">
                              {ACTIVITY_LABEL[item.kind]}
                              {item.detail ? ` — ${truncate(item.detail, 70)}` : ''}
                            </span>
                          </span>

                          <time
                            dateTime={item.date}
                            className="shrink-0 pt-0.5 font-mono text-xs text-ink-faint tabular-nums"
                          >
                            {relativeDay(item.date)}
                          </time>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon="Activity"
                  title="Nothing to show yet"
                  description="Complete a task, log some work or tick a habit and it will appear here."
                  action={
                    <ButtonLink to={PERSONAL_ROUTES.today} variant="secondary" icon="ListTodo">
                      Go to today
                    </ButtonLink>
                  }
                />
              )}
            </CardContent>
          </Card>
        </section>

        {/* 5 — the four things worth one click */}
        <section aria-labelledby="overview-actions">
          <h2
            id="overview-actions"
            className="mb-3 text-xs font-semibold tracking-wide text-ink-faint uppercase"
          >
            Quick actions
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => (
              <li key={action.href}>
                <Link
                  to={action.href}
                  className="flex h-full items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-subtle transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover"
                >
                  <span
                    aria-hidden="true"
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                  >
                    <Icon name={action.icon} size={17} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{action.label}</span>
                    <span className="block text-xs text-ink-muted">{action.description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        </>
      )}
    </div>
  )
}
