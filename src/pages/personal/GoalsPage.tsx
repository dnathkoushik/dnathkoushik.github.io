import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AnyGoal, GoalStatus, MonthKey, Priority, WeekKey } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Tabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { GoalCard } from '@/components/goals/GoalCard'
import { GoalForm } from '@/components/goals/GoalForm'
import type { GoalFormValues } from '@/components/goals/GoalForm'
import type { GoalPatch } from '@/components/goals/GoalProgressControl'
import { MonthPicker, WeekPicker } from '@/components/review/WeekPicker'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { usePersonalData } from '@/providers/personalDataContext'
import {
  formatMonthLabel,
  formatWeekLabel,
  monthKeyOf,
  monthRange,
  shiftWeek,
  todayISO,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import { percent, pluralize } from '@/utils/format'
import { isGoalReached } from '@/utils/analytics'

type Period = 'week' | 'month'

const WEEK_KEY_RE = /^\d{4}-W\d{1,2}$/
const MONTH_KEY_RE = /^\d{4}-\d{2}$/

/** Unfinished work first, then the most important of it. */
const STATUS_ORDER: Record<GoalStatus, number> = {
  active: 0,
  missed: 1,
  completed: 2,
  archived: 3,
}
const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function sortGoals<G extends AnyGoal>(goals: G[]): G[] {
  return [...goals].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.title.localeCompare(b.title),
  )
}

export default function GoalsPage() {
  useDocumentMeta({
    title: 'Goals',
    description: 'Weekly and monthly goals, tracked privately in this browser.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const weekStartsOn = db.settings.weekStartsOn
  const today = todayISO()
  const currentWeek = weekKeyOf(today, weekStartsOn)
  const currentMonth = monthKeyOf(today)

  const weekParam = params.get('week')
  const monthParam = params.get('month')
  const tabParam = params.get('tab')

  /*
   * The activity feed deep-links with `?week=` or `?month=`, so the tab is
   * inferred from whichever key arrived when `?tab=` is absent.
   */
  const period: Period =
    tabParam === 'month' || (tabParam === null && monthParam !== null && weekParam === null)
      ? 'month'
      : 'week'

  const weekKey: WeekKey = weekParam && WEEK_KEY_RE.test(weekParam) ? weekParam : currentWeek
  const monthKey: MonthKey = monthParam && MONTH_KEY_RE.test(monthParam) ? monthParam : currentMonth

  const setPeriodParams = (next: { period?: Period; week?: WeekKey; month?: MonthKey }) => {
    const draft = new URLSearchParams(params)
    draft.set('tab', next.period ?? period)
    draft.set('week', next.week ?? weekKey)
    draft.set('month', next.month ?? monthKey)
    setParams(draft, { replace: true })
  }

  const range = period === 'week' ? weekRange(weekKey, weekStartsOn) : monthRange(monthKey)
  const periodLabel =
    period === 'week' ? formatWeekLabel(weekKey, weekStartsOn) : formatMonthLabel(monthKey)

  const weekGoals = useMemo(
    () => sortGoals(db.weeklyGoals.filter((goal) => goal.weekKey === weekKey)),
    [db.weeklyGoals, weekKey],
  )
  const monthGoals = useMemo(
    () => sortGoals(db.monthlyGoals.filter((goal) => goal.monthKey === monthKey)),
    [db.monthlyGoals, monthKey],
  )
  const goals: AnyGoal[] = period === 'week' ? weekGoals : monthGoals

  const categories = useMemo(
    () => db.categories.filter((category) => !category.archived),
    [db.categories],
  )
  const categoryMap = useMemo(
    () => new Map(db.categories.map((category) => [category.id, category])),
    [db.categories],
  )

  /** Aggregate progress weights every goal by its own target, not by count. */
  const summary = useMemo(() => {
    const counted = goals.filter((goal) => goal.status !== 'archived')
    let done = 0
    let reached = 0
    let target = 0
    for (const goal of counted) {
      if (isGoalReached(goal)) done += 1
      reached += Math.min(goal.currentValue, goal.targetValue)
      target += goal.targetValue
    }
    return {
      total: counted.length,
      done,
      progress: percent(reached, target),
      reached,
      target,
    }
  }, [goals])

  const previousWeek = shiftWeek(weekKey, -1, weekStartsOn)
  const carryOverCount = useMemo(() => {
    if (period !== 'week') return 0
    const present = new Set(weekGoals.map((goal) => goal.title.trim().toLowerCase()))
    return db.weeklyGoals.filter(
      (goal) =>
        goal.weekKey === previousWeek &&
        (goal.status === 'active' || goal.status === 'missed') &&
        !present.has(goal.title.trim().toLowerCase()),
    ).length
  }, [db.weeklyGoals, period, previousWeek, weekGoals])

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AnyGoal | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<AnyGoal | undefined>(undefined)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const openEdit = (goal: AnyGoal) => {
    setEditing(goal)
    setFormOpen(true)
  }

  const updateGoal = (goal: AnyGoal, patch: GoalPatch) => {
    if (period === 'week') actions.updateWeeklyGoal(goal.id, patch)
    else actions.updateMonthlyGoal(goal.id, patch)
  }

  const submitForm = (values: GoalFormValues) => {
    if (editing) {
      if (period === 'week') actions.updateWeeklyGoal(editing.id, values)
      else actions.updateMonthlyGoal(editing.id, values)
      toast({ title: 'Goal updated', description: values.title })
      return
    }

    if (period === 'week') actions.addWeeklyGoal({ ...values, weekKey })
    else actions.addMonthlyGoal({ ...values, monthKey })
    toast({ title: 'Goal added', description: `${values.title} — ${periodLabel}`, tone: 'positive' })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    if (period === 'week') actions.deleteWeeklyGoal(pendingDelete.id)
    else actions.deleteMonthlyGoal(pendingDelete.id)
    toast({ title: 'Goal deleted', description: pendingDelete.title })
    setPendingDelete(undefined)
  }

  const carryOver = () => {
    const moved = actions.carryOverWeeklyGoals(previousWeek, weekKey)
    toast({
      title: moved > 0 ? 'Goals carried over' : 'Nothing to carry over',
      description:
        moved > 0
          ? `${pluralize(moved, 'unfinished goal')} copied from ${formatWeekLabel(previousWeek, weekStartsOn)}.`
          : 'Every unfinished goal from last week is already here.',
      tone: moved > 0 ? 'positive' : 'neutral',
    })
  }

  const ringTone = summary.progress >= 100 ? 'positive' : summary.progress > 0 ? 'accent' : 'neutral'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow={period === 'week' ? 'Weekly goals' : 'Monthly goals'}
        title="Goals"
        description="What this period is actually for. Track the number, not the intention."
        actions={
          <>
            {period === 'week' && carryOverCount > 0 ? (
              <Button variant="secondary" icon="Repeat" onClick={carryOver}>
                Carry over {carryOverCount}
              </Button>
            ) : null}
            <Button variant="primary" icon="Plus" onClick={openCreate}>
              New goal
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs
          ariaLabel="Goal period"
          value={period}
          onChange={(next) => setPeriodParams({ period: next as Period })}
          items={[
            {
              id: 'week',
              label: 'This week',
              icon: 'CalendarRange',
              badge: weekGoals.length || undefined,
            },
            {
              id: 'month',
              label: 'This month',
              icon: 'CalendarDays',
              badge: monthGoals.length || undefined,
            },
          ]}
          className="sm:w-auto sm:shrink-0"
        />

        {period === 'week' ? (
          <WeekPicker
            weekKey={weekKey}
            weekStartsOn={weekStartsOn}
            onChange={(next) => setPeriodParams({ week: next, period: 'week' })}
            className="sm:justify-end"
          />
        ) : (
          <MonthPicker
            monthKey={monthKey}
            onChange={(next) => setPeriodParams({ month: next, period: 'month' })}
            className="sm:justify-end"
          />
        )}
      </div>

      <div
        role="tabpanel"
        id={`${period}-panel`}
        aria-labelledby={`${period}-tab`}
        tabIndex={-1}
        className="space-y-6"
      >
        <Card className="animate-rise">
          <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-5">
            <div className="flex items-center gap-4">
              <ProgressRing
                value={summary.progress}
                size={68}
                thickness={7}
                tone={ringTone}
                label={`Aggregate progress for ${periodLabel}`}
              >
                <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {summary.progress}%
                </span>
              </ProgressRing>

              <div className="min-w-0">
                <p className="font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase">
                  {periodLabel}
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-ink">
                  {summary.done} of {summary.total} {summary.total === 1 ? 'goal' : 'goals'} done
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {summary.target > 0
                    ? `${summary.reached} of ${summary.target} counted units across every goal.`
                    : 'Nothing planned for this period yet.'}
                </p>
              </div>
            </div>

            {period === 'week' && carryOverCount > 0 ? (
              <div className="flex min-w-0 flex-1 items-center justify-start gap-3 rounded-lg bg-surface-muted px-4 py-3 sm:justify-end">
                <Icon name="Repeat" className="size-4 shrink-0 text-ink-faint" />
                <p className="min-w-0 text-sm text-ink-muted">
                  {pluralize(carryOverCount, 'goal')} left unfinished last week.
                </p>
                <Button variant="subtle" size="sm" onClick={carryOver}>
                  Carry over
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <section aria-labelledby="goal-list-heading" className="space-y-4">
          <h2 id="goal-list-heading" className="text-lg font-semibold tracking-tight text-ink">
            {period === 'week' ? 'Goals for this week' : 'Goals for this month'}
          </h2>

          {goals.length === 0 ? (
            <EmptyState
              icon="Target"
              title={`Nothing planned for ${periodLabel}`}
              description="A goal is a number you can check off. Two or three good ones beat a list of ten."
              action={
                <>
                  <Button variant="primary" icon="Plus" onClick={openCreate}>
                    Add your first goal
                  </Button>
                  {period === 'week' && carryOverCount > 0 ? (
                    <Button variant="secondary" icon="Repeat" onClick={carryOver}>
                      Carry over {carryOverCount} from last week
                    </Button>
                  ) : null}
                </>
              }
            />
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {goals.map((goal) => (
                <li key={goal.id} className="flex">
                  <GoalCard
                    className="w-full"
                    goal={goal}
                    category={categoryMap.get(goal.categoryId)}
                    onUpdate={(patch) => updateGoal(goal, patch)}
                    onEdit={() => openEdit(goal)}
                    onDelete={() => setPendingDelete(goal)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <GoalForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
        categories={categories}
        goal={editing}
        periodLabel={periodLabel}
        periodRange={{ start: range.start, end: range.end }}
      />

      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title="Delete this goal?"
        message={
          pendingDelete
            ? `"${pendingDelete.title}" and its progress will be removed from this device. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete goal"
        tone="danger"
      />
    </div>
  )
}
