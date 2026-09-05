import { useCallback, useId, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ISODate, Tone } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { Progress } from '@/components/ui/Progress'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useToast } from '@/components/ui/Toast'
import { DayNavigator } from '@/components/personal/DayNavigator'
import { ObjectiveCard } from '@/components/personal/ObjectiveCard'
import { QuickAddTask } from '@/components/tasks/QuickAddTask'
import { TaskList } from '@/components/tasks/TaskList'
import { QuickAddLog } from '@/components/worklog/QuickAddLog'
import { WorkLogList } from '@/components/worklog/WorkLogList'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useCategories, useLogsForDate, useSettings, useTasksForDate } from '@/hooks/personal'
import { usePersonalData } from '@/providers/personalDataContext'
import { dayStats } from '@/utils/analytics'
import {
  durationLabel,
  fromISODate,
  relativeDay,
  shiftDay,
  toISODate,
  todayISO,
} from '@/utils/date'
import { percent, pluralize } from '@/utils/format'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads `?date=` defensively.
 *
 * The calendar links straight into this screen, and people edit the query
 * string by hand, so anything that is not a real calendar day — `2026-02-31`
 * included, which `Date` silently rolls forward into March — falls back to
 * today rather than rendering a day that does not exist.
 */
function readDateParam(raw: string | null): ISODate | undefined {
  if (!raw || !ISO_DATE_RE.test(raw)) return undefined
  const parsed = fromISODate(raw)
  if (Number.isNaN(parsed.getTime())) return undefined
  return toISODate(parsed) === raw ? raw : undefined
}

function scoreTone(score: number): Tone {
  if (score >= 75) return 'positive'
  if (score >= 40) return 'accent'
  return 'warning'
}

export default function TodayPage() {
  useDocumentMeta({
    title: 'Today',
    description: 'Plan the day, work it, and log what actually happened.',
    noindex: true,
  })

  const [searchParams, setSearchParams] = useSearchParams()
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const baseId = useId()

  const date = readDateParam(searchParams.get('date')) ?? todayISO()
  const focusTarget = searchParams.get('focus')

  const settings = useSettings()
  const categories = useCategories()
  const tasks = useTasksForDate(date)
  const logs = useLogsForDate(date)

  const stats = useMemo(() => dayStats(db, date), [db, date])
  const previousDay = useMemo(() => shiftDay(date, -1), [date])
  const rolloverCount = useMemo(
    () =>
      db.tasks.filter(
        (task) =>
          task.date === previousDay &&
          task.status !== 'completed' &&
          task.status !== 'skipped',
      ).length,
    [db.tasks, previousDay],
  )

  const goToDate = useCallback(
    (next: ISODate) => {
      const params = new URLSearchParams(searchParams)
      params.delete('focus')
      if (next === todayISO()) params.delete('date')
      else params.set('date', next)
      // Replace rather than push: arrowing through a week should not bury the
      // page you arrived from under thirty history entries.
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  function handleRollover() {
    const moved = actions.rolloverTasks(previousDay, date)
    toast({
      title: moved > 0 ? `Moved ${pluralize(moved, 'task')} over` : 'Nothing left to move',
      description:
        moved > 0
          ? `Carried across from ${relativeDay(previousDay).toLowerCase()} as not started.`
          : 'Everything from that day is already finished or skipped.',
      tone: moved > 0 ? 'positive' : 'neutral',
      duration: 3500,
    })
  }

  const minutesTarget = Math.max(1, Math.round(settings.dailyHoursTarget * 60))
  const taskCompletion = percent(stats.tasksCompleted, stats.tasksTotal)
  const remaining = stats.tasksTotal - stats.tasksCompleted - stats.tasksSkipped

  const progressTitleId = `${baseId}-progress`
  const tasksTitleId = `${baseId}-tasks`
  const logTitleId = `${baseId}-log`

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Day workspace"
        title={relativeDay(date)}
        description="Plan the day, work it, and log what actually happened. Everything here stays in this browser."
        actions={
          <>
            <ButtonLink
              to={`${PERSONAL_ROUTES.calendar}?date=${date}`}
              variant="secondary"
              icon="CalendarDays"
            >
              Calendar
            </ButtonLink>
            <ButtonLink to={PERSONAL_ROUTES.review} variant="secondary" icon="ClipboardList">
              Weekly review
            </ButtonLink>
          </>
        }
      />

      <DayNavigator date={date} onChange={goToDate} className="animate-rise" />

      {rolloverCount > 0 ? (
        <div className="flex flex-col gap-3 rounded-card border border-warning/40 bg-warning-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Icon name="ArrowRightLeft" size={18} className="mt-0.5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-ink">
                {pluralize(rolloverCount, 'task')} unfinished from{' '}
                {relativeDay(previousDay).toLowerCase()}
              </p>
              <p className="text-xs leading-relaxed text-ink-muted">
                Copy them onto this day as not started. The originals stay where they were.
              </p>
            </div>
          </div>
          <Button variant="secondary" icon="CornerDownRight" onClick={handleRollover}>
            Move them here
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-label="Objective, mood and energy" className="lg:col-span-2">
          <ObjectiveCard date={date} />
        </section>

        <section aria-labelledby={progressTitleId}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle as="h2" id={progressTitleId}>
                Where the day stands
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <ProgressRing
                  value={stats.score}
                  size={76}
                  thickness={7}
                  tone={scoreTone(stats.score)}
                  label="Day score"
                >
                  <span className="font-mono text-lg font-semibold text-ink tabular-nums">
                    {stats.score}
                  </span>
                </ProgressRing>

                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-ink">
                    {stats.tasksCompleted} of {stats.tasksTotal}{' '}
                    {stats.tasksTotal === 1 ? 'task' : 'tasks'} done
                  </p>
                  <p className="text-xs leading-relaxed text-ink-muted">
                    {remaining > 0
                      ? `${pluralize(remaining, 'task')} still open`
                      : stats.tasksTotal === 0
                        ? 'No tasks planned yet'
                        : 'Everything is closed out'}
                  </p>
                  <p className="font-mono text-xs text-ink-faint tabular-nums">
                    {durationLabel(stats.loggedMinutes)} logged of{' '}
                    {durationLabel(minutesTarget)}
                  </p>
                </div>
              </div>

              <Progress
                value={stats.tasksCompleted}
                max={Math.max(stats.tasksTotal, 1)}
                tone="positive"
                label={`Tasks completed (${stats.tasksCompleted}/${stats.tasksTotal})`}
                showValue
              />
              <Progress
                value={stats.loggedMinutes}
                max={minutesTarget}
                tone="accent"
                label={`Focused time (${durationLabel(stats.loggedMinutes)})`}
                showValue
              />
              {stats.habitsDue > 0 ? (
                <Progress
                  value={stats.habitsDone}
                  max={stats.habitsDue}
                  tone="info"
                  label={`Habits kept (${stats.habitsDone}/${stats.habitsDue})`}
                  showValue
                />
              ) : null}

              <p className="text-xs leading-relaxed text-ink-faint">
                The score blends task completion, logged time against your{' '}
                {settings.dailyHoursTarget}-hour target and habits, ignoring anything you do
                not use.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      <section aria-labelledby={tasksTitleId}>
        <Card>
          <CardHeader
            actions={
              <Badge tone={taskCompletion === 100 && stats.tasksTotal > 0 ? 'positive' : 'neutral'}>
                {stats.tasksCompleted}/{stats.tasksTotal} done
              </Badge>
            }
          >
            <CardTitle as="h2" id={tasksTitleId}>
              Tasks
            </CardTitle>
            <CardDescription>
              Type a title and press Enter. Use !high, #category and ~45m inline and they are
              lifted out of the title for you.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {/*
              On a phone the entry box sits at the bottom of the card and sticks
              above the tab bar, which is the only part of the screen a thumb
              reaches without moving the hand. From `sm` up it returns to the top
              of the list, where a pointer expects it.
            */}
            <QuickAddTask
              date={date}
              categories={categories}
              autoFocus={focusTarget === 'task'}
              className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 order-last sm:static sm:order-first"
            />
            <TaskList date={date} tasks={tasks} categories={categories} />
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby={logTitleId}>
        <Card>
          <CardHeader
            actions={
              <Badge tone={stats.loggedMinutes > 0 ? 'accent' : 'neutral'} icon="Clock">
                {durationLabel(stats.loggedMinutes)}
              </Badge>
            }
          >
            <CardTitle as="h2" id={logTitleId}>
              Work log
            </CardTitle>
            <CardDescription>
              What actually happened, in the order it happened. Grouped by part of day.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <QuickAddLog
              date={date}
              categories={categories}
              autoFocus={focusTarget === 'log'}
            />
            <WorkLogList date={date} logs={logs} categories={categories} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
