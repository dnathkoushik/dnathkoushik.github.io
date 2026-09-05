import { useMemo } from 'react'
import { STORAGE_PREFIX } from '@/config/app'
import { PERSONAL_ROUTES } from '@/config/routes'
import type { ISODate } from '@/types'
import {
  categoryBreakdown,
  dailyMinutesSeries,
  rangeStats,
  streakInfo,
  weeklyTrend,
} from '@/utils/analytics'
import {
  daysBetween,
  durationLabel,
  fromISODate,
  shiftDay,
  todayISO,
  weekKeyOf,
} from '@/utils/date'
import { pluralize } from '@/utils/format'
import { useTheme } from '@/providers/ThemeProvider'
import { usePersonalData } from '@/providers/personalDataContext'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { CategoryChart } from '@/components/analytics/CategoryChart'
import { ScoreChart } from '@/components/analytics/ScoreChart'
import { TrendChart } from '@/components/analytics/TrendChart'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Stat } from '@/components/ui/Stat'

type RangeKey = '7d' | '30d' | '90d' | 'year'

const RANGE_OPTIONS: { value: RangeKey; label: string; icon?: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
]

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

interface Range {
  from: ISODate
  to: ISODate
  days: number
  label: string
}

function rangeFor(key: RangeKey, today: ISODate): Range {
  if (key === 'year') {
    const from = `${today.slice(0, 4)}-01-01`
    return { from, to: today, days: daysBetween(from, today) + 1, label: 'this year' }
  }
  const span = key === '7d' ? 7 : key === '30d' ? 30 : 90
  return {
    from: shiftDay(today, -(span - 1)),
    to: today,
    days: span,
    label: `the last ${span} days`,
  }
}

/**
 * Trends computed from the owner's own data.
 *
 * Everything on this page is derived at render time from the private database —
 * there is no analytics service, no event pipeline and nothing leaves the
 * browser. The range control at the top drives every number below it.
 */
export default function AnalyticsPage() {
  useDocumentMeta({
    title: 'Analytics',
    description: 'Trends computed from your own private dashboard data.',
    noindex: true,
    canonicalPath: PERSONAL_ROUTES.analytics,
  })

  const { db } = usePersonalData()
  const { resolved } = useTheme()
  const [rangeKey, setRangeKey] = useLocalStorage<RangeKey>(
    `${STORAGE_PREFIX}.analytics.range`,
    '30d',
  )

  const today = todayISO()
  const range = useMemo(() => rangeFor(rangeKey, today), [rangeKey, today])

  const stats = useMemo(() => rangeStats(db, range.from, range.to), [db, range])
  const streak = useMemo(() => streakInfo(db, today), [db, today])
  const daily = useMemo(() => dailyMinutesSeries(db, range.from, range.to), [db, range])
  const categories = useMemo(() => categoryBreakdown(db, range.from, range.to), [db, range])

  const weeks = Math.max(4, Math.ceil(range.days / 7))
  const trend = useMemo(
    () => weeklyTrend(db, weekKeyOf(today, db.settings.weekStartsOn), weeks, db.settings.weekStartsOn),
    [db, today, weeks],
  )

  /** Average score per weekday, ignoring days with nothing on them. */
  const weekdays = useMemo(() => {
    const totals = new Array(7).fill(0) as number[]
    const counts = new Array(7).fill(0) as number[]
    for (const point of daily) {
      if (point.score <= 0) continue
      const index = fromISODate(point.date).getDay()
      totals[index] += point.score
      counts[index] += 1
    }
    return WEEKDAY_NAMES.map((name, index) => ({
      name,
      days: counts[index],
      average: counts[index] > 0 ? Math.round(totals[index] / counts[index]) : 0,
    }))
  }, [daily])

  const bestWeekday = weekdays.reduce(
    (best, day) => (day.days > 0 && day.average > best.average ? day : best),
    { name: '—', days: 0, average: 0 },
  )

  const averageFocusedMinutes =
    stats.activeDays > 0 ? Math.round(stats.loggedMinutes / stats.activeDays) : 0
  const targetMinutes = db.settings.dailyHoursTarget * 60

  const nothingYet = stats.tasksTotal === 0 && stats.loggedMinutes === 0 && stats.activeDays === 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Analytics"
        title="Your numbers"
        description={`Everything below covers ${range.label}, from ${range.from} to ${range.to}. Computed in this browser, from data that never leaves it.`}
        actions={
          <SegmentedControl<RangeKey>
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGE_OPTIONS}
            ariaLabel="Analytics date range"
          />
        }
      />

      {nothingYet ? (
        <EmptyState
          icon="ChartColumn"
          title="Nothing to measure yet"
          description={`No tasks, work-log entries or habits recorded in ${range.label}. Log a few days and the trends fill in on their own.`}
          action={
            <>
              <ButtonLink to={PERSONAL_ROUTES.today} variant="primary" icon="ListTodo">
                Go to Today
              </ButtonLink>
              <ButtonLink to={PERSONAL_ROUTES.settings} variant="secondary" icon="Sparkles">
                Load sample data
              </ButtonLink>
            </>
          }
        />
      ) : (
        <>
          <section aria-labelledby="analytics-headline" className="space-y-3 animate-rise">
            <h2 id="analytics-headline" className="sr-only">
              Headline numbers for {range.label}
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat
                label="Tasks done"
                value={stats.tasksCompleted}
                sublabel={`of ${stats.tasksTotal} planned`}
                icon="CircleCheckBig"
                tone="positive"
              />
              <Stat
                label="Completion"
                value={`${stats.completionRate}%`}
                sublabel={
                  stats.completionRate >= 70
                    ? 'You finish what you plan'
                    : 'Try planning fewer, larger tasks'
                }
                icon="Percent"
                tone="accent"
              />
              <Stat
                label="Time logged"
                value={durationLabel(stats.loggedMinutes)}
                sublabel={`${durationLabel(averageFocusedMinutes)} per active day`}
                icon="Clock"
                tone="info"
              />
              <Stat
                label="Active days"
                value={`${stats.activeDays}/${range.days}`}
                sublabel={`${Math.round((stats.activeDays / range.days) * 100)}% of the range`}
                icon="CalendarCheck"
                tone="neutral"
              />
              <Stat
                label="Current streak"
                value={pluralize(streak.current, 'day')}
                sublabel={`Best ever ${pluralize(streak.best, 'day')}`}
                icon="Flame"
                tone={streak.current > 0 ? 'warning' : 'neutral'}
                className="col-span-2 lg:col-span-1"
              />
            </div>
          </section>

          <section aria-labelledby="analytics-trend">
            <Card className="animate-rise">
              <CardHeader>
                <CardTitle as="h2" id="analytics-trend">
                  Week over week
                </CardTitle>
                <CardDescription>
                  Completion rate against the number of tasks actually finished, for the last{' '}
                  {weeks} weeks ending this week.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendChart points={trend} themeKey={resolved} />
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="analytics-score">
            <Card className="animate-rise">
              <CardHeader>
                <CardTitle as="h2" id="analytics-score">
                  Daily productivity
                </CardTitle>
                <CardDescription>
                  {`A blend of task completion, time logged against your ${db.settings.dailyHoursTarget}-hour target, and habit adherence. Parts of the day you do not use are left out rather than scored as zero.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScoreChart points={daily} themeKey={resolved} />
              </CardContent>
            </Card>
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section aria-labelledby="analytics-categories" className="min-w-0">
              <Card className="h-full animate-rise">
                <CardHeader>
                  <CardTitle as="h2" id="analytics-categories">
                    Where the time went
                  </CardTitle>
                  <CardDescription>
                    Minutes from your work log, grouped by category over {range.label}.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryChart items={categories} themeKey={resolved} />
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="analytics-patterns" className="min-w-0">
              <Card className="h-full animate-rise">
                <CardHeader>
                  <CardTitle as="h2" id="analytics-patterns">
                    Patterns worth acting on
                  </CardTitle>
                  <CardDescription>
                    Two things you can actually change next week.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-card bg-surface-muted p-4">
                    <p className="text-xs text-ink-faint">Most productive day</p>
                    <p className="mt-1 text-lg font-semibold text-ink">{bestWeekday.name}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      {bestWeekday.days > 0
                        ? `Averaging ${bestWeekday.average} out of 100 across ${pluralize(bestWeekday.days, 'recorded day')}. Put the work you keep postponing here.`
                        : 'Not enough recorded days yet to call one.'}
                    </p>
                  </div>

                  <div className="rounded-card bg-surface-muted p-4">
                    <p className="text-xs text-ink-faint">Average focused time</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-ink tabular-nums">
                      {durationLabel(averageFocusedMinutes)}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                      Per day with any activity, against a {db.settings.dailyHoursTarget}-hour
                      target.{' '}
                      {targetMinutes > 0 && averageFocusedMinutes >= targetMinutes
                        ? 'You are hitting it.'
                        : `That is ${durationLabel(Math.max(0, targetMinutes - averageFocusedMinutes))} short.`}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-[13px] font-semibold tracking-wide text-ink-faint uppercase">
                      Average score by weekday
                    </h3>
                    <dl className="mt-2 space-y-1.5">
                      {weekdays.map((day) => (
                        <div key={day.name} className="flex items-center gap-3">
                          <dt className="w-20 shrink-0 text-xs text-ink-muted">{day.name}</dt>
                          <dd className="flex min-w-0 flex-1 items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover"
                            >
                              <span
                                className="block h-full rounded-full bg-accent"
                                style={{ width: `${day.average}%` }}
                              />
                            </span>
                            <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink-muted tabular-nums">
                              {day.days > 0 ? `${day.average} / 100` : '—'}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
