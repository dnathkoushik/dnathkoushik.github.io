import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Habit, HabitEntry, ISODate } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Stat } from '@/components/ui/Stat'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { DayDetailPanel } from '@/components/habits/DayDetailPanel'
import { HabitForm } from '@/components/habits/HabitForm'
import type { HabitFormValues } from '@/components/habits/HabitForm'
import { HabitHeatmap } from '@/components/habits/HabitHeatmap'
import type { HeatmapDay, HeatmapLevel } from '@/components/habits/HabitHeatmap'
import { HabitRow } from '@/components/habits/HabitRow'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { usePersonalData } from '@/providers/personalDataContext'
import { dayStats, habitAdherence, heatmapData, streakInfo } from '@/utils/analytics'
import {
  durationLabel,
  eachDayISO,
  formatDayLong,
  formatDayShort,
  formatWeekLabel,
  shiftDay,
  shiftWeek,
  todayISO,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import { CAT_CLASSES, percent, pluralize } from '@/utils/format'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const CHIP_BASE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors outline-accent focus-visible:outline-2 focus-visible:outline-offset-2'
const CHIP_ON = 'border-accent bg-accent-soft text-accent'
const CHIP_OFF = 'border-line text-ink-muted hover:bg-surface-hover hover:text-ink'

/** How far back the "most consistent habit" figure looks. */
const CONSISTENCY_DAYS = 30

function levelForRatio(value: number, target: number): HeatmapLevel {
  if (value <= 0) return 0
  const ratio = value / Math.max(1, target)
  if (ratio >= 1) return 4
  if (ratio >= 0.66) return 3
  if (ratio >= 0.33) return 2
  return 1
}

export default function HabitsPage() {
  useDocumentMeta({
    title: 'Habits',
    description: 'Streaks, weekly targets and a consistency heatmap, private to this browser.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const wideScreen = useMediaQuery('(min-width: 1024px)')
  const desktop = useMediaQuery('(min-width: 768px)')

  /*
   * Every calendar value the page needs is derived up front, in one block.
   * Keeping these ahead of the `useMemo` calls that depend on them is not
   * cosmetic: React Compiler widens a value's mutable range to its last use, so
   * a `weekRange(...)` sitting further down the body would invalidate the
   * memoised analytics above it.
   */
  const weekStartsOn = db.settings.weekStartsOn
  const today = todayISO()
  const currentWeek = weekKeyOf(today, weekStartsOn)
  const week = weekRange(currentWeek, weekStartsOn)
  const weekLabel = formatWeekLabel(currentWeek, weekStartsOn)
  /* A week still running is only measured up to today. */
  const weekTo = week.end < today ? week.end : today

  const heatmapWeeks = wideScreen ? 53 : 26
  const heatmapFrom = weekRange(
    shiftWeek(currentWeek, -(heatmapWeeks - 1), weekStartsOn),
    weekStartsOn,
  ).start

  const dateParam = params.get('date')
  const selectedDate: ISODate =
    dateParam && ISO_DATE_RE.test(dateParam) && dateParam <= today ? dateParam : today
  const selectedDateLong = formatDayLong(selectedDate)
  const selectedDateShort = formatDayShort(selectedDate)

  const habits = useMemo(
    () => [...db.habits].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    [db.habits],
  )
  const activeHabits = useMemo(() => habits.filter((habit) => !habit.archived), [habits])
  const archivedHabits = useMemo(() => habits.filter((habit) => habit.archived), [habits])

  const categories = useMemo(
    () => db.categories.filter((category) => !category.archived),
    [db.categories],
  )
  const categoryMap = useMemo(
    () => new Map(db.categories.map((category) => [category.id, category])),
    [db.categories],
  )

  /** Every entry, bucketed by habit then by date — one pass, many lookups. */
  const entriesByHabit = useMemo(() => {
    const map = new Map<string, Map<ISODate, HabitEntry>>()
    for (const entry of db.habitEntries) {
      let bucket = map.get(entry.habitId)
      if (!bucket) {
        bucket = new Map<ISODate, HabitEntry>()
        map.set(entry.habitId, bucket)
      }
      bucket.set(entry.date, entry)
    }
    return map
  }, [db.habitEntries])

  const streak = useMemo(() => streakInfo(db, today), [db, today])

  /*
   * Adherence is measured against the days a habit was actually meant to
   * happen, not against all seven — a habit set to three days a week is at
   * 100 % on Wednesday if it has been done three times.
   */
  const weekAdherence = useMemo(() => {
    let expected = 0
    let done = 0
    for (const habit of activeHabits) {
      const adherence = habitAdherence(db, habit.id, week.start, weekTo)
      expected += adherence.expected
      done += adherence.daysDone
    }
    return { expected, done, rate: Math.min(percent(done, expected), 100) }
  }, [db, activeHabits, week.start, weekTo])

  const consistency = useMemo(() => {
    const from = shiftDay(today, -(CONSISTENCY_DAYS - 1))
    return activeHabits
      .map((habit) => ({ habit, adherence: habitAdherence(db, habit.id, from, today) }))
      .filter((item) => item.adherence.daysDue > 0)
      .sort(
        (a, b) =>
          b.adherence.targetRate - a.adherence.targetRate ||
          b.adherence.daysDone - a.adherence.daysDone ||
          a.habit.name.localeCompare(b.habit.name),
      )
  }, [db, activeHabits, today])
  const mostConsistent = consistency[0]

  /* -- heatmap ---------------------------------------------------------- */

  const [habitFilter, setHabitFilter] = useState('all')
  const selectedHabit = activeHabits.find((habit) => habit.id === habitFilter)

  const heatmapDays = useMemo<HeatmapDay[]>(() => {
    if (selectedHabit) {
      const target = Math.max(1, selectedHabit.dailyTarget)
      const unit = selectedHabit.unit?.trim() ?? ''
      const entries = entriesByHabit.get(selectedHabit.id)

      return eachDayISO(heatmapFrom, today).map((date) => {
        const value = entries?.get(date)?.value ?? 0
        const suffix = unit ? ` ${unit}` : ''
        return {
          date,
          level: levelForRatio(value, target),
          label:
            value <= 0
              ? `${formatDayLong(date)}: ${selectedHabit.name} not done`
              : `${formatDayLong(date)}: ${selectedHabit.name}, ${value} of ${target}${suffix}`,
        }
      })
    }

    return heatmapData(db, heatmapFrom, today).map((cell) => ({
      date: cell.date,
      level: cell.level,
      label: cell.hasEntries
        ? `${formatDayLong(cell.date)}: score ${cell.score}, ${cell.habitsDone} habits done, ${cell.tasksCompleted} of ${cell.tasksTotal} tasks, ${durationLabel(cell.loggedMinutes)} logged`
        : `${formatDayLong(cell.date)}: nothing recorded`,
    }))
  }, [db, selectedHabit, entriesByHabit, heatmapFrom, today])

  const recordedDays = heatmapDays.filter((day) => day.level > 0).length
  const heatmapSummary = selectedHabit
    ? `${selectedHabit.name} was done on ${recordedDays} of the last ${heatmapDays.length} days.`
    : `Activity recorded on ${recordedDays} of the last ${heatmapDays.length} days.`

  /* -- selected day ------------------------------------------------------ */

  // Arriving on a deep link such as `?date=2026-09-05` on a phone should show
  // that day, not just quietly select it behind the grid.
  const [sheetOpen, setSheetOpen] = useState(() => dateParam !== null)

  const selectDate = (date: ISODate) => {
    const draft = new URLSearchParams(params)
    draft.set('date', date)
    setParams(draft, { replace: true })
    if (!desktop) setSheetOpen(true)
  }

  const dayDetail = useMemo(() => {
    const dayTasks = db.tasks
      .filter((task) => task.date === selectedDate)
      .sort((a, b) => a.order - b.order)
    const dayLogs = db.logs.filter((log) => log.date === selectedDate)
    const meta = db.days.find((entry) => entry.date === selectedDate)
    const habitStatuses = activeHabits.map((habit) => {
      const value = entriesByHabit.get(habit.id)?.get(selectedDate)?.value ?? 0
      return { habit, value, done: value >= Math.max(1, habit.dailyTarget) }
    })
    return {
      tasks: dayTasks,
      logs: dayLogs,
      objective: meta?.objective,
      highlight: meta?.highlight,
      habitStatuses,
      stats: dayStats(db, selectedDate),
    }
  }, [db, selectedDate, activeHabits, entriesByHabit])

  /* -- habit editing ----------------------------------------------------- */

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Habit | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<Habit | undefined>(undefined)
  const [showArchived, setShowArchived] = useState(false)

  const openCreate = () => {
    setEditing(undefined)
    setFormOpen(true)
  }

  const submitForm = (values: HabitFormValues) => {
    if (editing) {
      actions.updateHabit(editing.id, values)
      toast({ title: 'Habit updated', description: values.name })
      return
    }
    actions.addHabit(values)
    toast({ title: 'Habit added', description: values.name, tone: 'positive' })
  }

  const toggleArchived = (habit: Habit) => {
    actions.updateHabit(habit.id, { archived: !habit.archived })
    toast({
      title: habit.archived ? 'Habit restored' : 'Habit archived',
      description: habit.archived
        ? `${habit.name} is back in your weekly rotation.`
        : `${habit.name} keeps its history but stops counting.`,
    })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    actions.deleteHabit(pendingDelete.id)
    toast({
      title: 'Habit deleted',
      description: `${pendingDelete.name} and every entry for it were removed.`,
    })
    setPendingDelete(undefined)
  }

  const weeklyCheckIns = activeHabits.reduce((sum, habit) => sum + habit.targetPerWeek, 0)

  const detail = (
    <DayDetailPanel
      date={selectedDate}
      stats={dayDetail.stats}
      tasks={dayDetail.tasks}
      logs={dayDetail.logs}
      habits={dayDetail.habitStatuses}
      objective={dayDetail.objective}
      highlight={dayDetail.highlight}
      categories={categoryMap}
    />
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader
        eyebrow="Consistency"
        title="Habits"
        description="The small things, repeated. Every figure here is computed from your own entries."
        actions={
          <Button variant="primary" icon="Plus" onClick={openCreate}>
            New habit
          </Button>
        }
      />

      <section aria-labelledby="habit-stats-heading" className="space-y-3">
        <h2 id="habit-stats-heading" className="sr-only">
          Habit summary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Current streak"
            value={streak.current}
            sublabel={`Best run: ${pluralize(streak.best, 'day')}`}
            icon="Flame"
            tone={streak.current > 0 ? 'warning' : 'neutral'}
          />
          <Stat
            label="This week"
            value={`${weekAdherence.rate}%`}
            sublabel={
              weekAdherence.expected > 0
                ? `${weekAdherence.done} of ${weekAdherence.expected} target days met`
                : 'No habits are due yet this week'
            }
            icon="Target"
            tone={weekAdherence.rate >= 80 ? 'positive' : 'accent'}
          />
          <Stat
            label="Active habits"
            value={activeHabits.length}
            sublabel={`${pluralize(weeklyCheckIns, 'check-in')} a week when fully on track`}
            icon="Repeat"
          />
          <Stat
            label="Most consistent"
            value={
              mostConsistent ? (
                <span className="block truncate text-base leading-tight">
                  {mostConsistent.habit.name}
                </span>
              ) : (
                '—'
              )
            }
            sublabel={
              mostConsistent
                ? `${mostConsistent.adherence.targetRate}% of target over ${CONSISTENCY_DAYS} days`
                : 'Add a habit to start measuring'
            }
            icon="Trophy"
            tone={mostConsistent ? 'positive' : 'neutral'}
          />
        </div>
      </section>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle as="h2">
            {selectedHabit ? selectedHabit.name : 'Everything you did'}
          </CardTitle>
          <p className="text-sm leading-relaxed text-ink-muted">
            {heatmapSummary} Showing the last {heatmapWeeks} weeks.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeHabits.length > 0 ? (
            <div
              role="group"
              aria-label="Filter the heatmap by habit"
              className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1"
            >
              <button
                type="button"
                aria-pressed={!selectedHabit}
                onClick={() => setHabitFilter('all')}
                className={cn(CHIP_BASE, !selectedHabit ? CHIP_ON : CHIP_OFF)}
              >
                Everything
              </button>
              {activeHabits.map((habit) => {
                const on = habit.id === habitFilter
                return (
                  <button
                    key={habit.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setHabitFilter(habit.id)}
                    className={cn(CHIP_BASE, on ? CHIP_ON : CHIP_OFF)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('size-2 rounded-full', CAT_CLASSES[habit.color].bg)}
                    />
                    {habit.name}
                  </button>
                )
              })}
            </div>
          ) : null}

          <HabitHeatmap
            days={heatmapDays}
            weekStartsOn={weekStartsOn}
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            summary={`${selectedHabit ? `${selectedHabit.name} heatmap` : 'Daily activity heatmap'} for the last ${heatmapWeeks} weeks. ${heatmapSummary}`}
          />

          {!desktop ? (
            <Button
              variant="secondary"
              size="sm"
              icon="CalendarDays"
              fullWidth
              onClick={() => setSheetOpen(true)}
            >
              What happened on {selectedDateShort}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="habit-list-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="habit-list-heading" className="text-lg font-semibold tracking-tight text-ink">
              This week
            </h2>
            <p className="font-mono text-xs text-ink-faint tabular-nums">
              {weekLabel}
            </p>
          </div>

          {activeHabits.length === 0 ? (
            <EmptyState
              icon="Flame"
              title="No habits yet"
              description="Pick one or two things you want to do most days. The grid above fills in as you tick them off."
              action={
                <Button variant="primary" icon="Plus" onClick={openCreate}>
                  Add your first habit
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {activeHabits.map((habit) => (
                <HabitRow
                  key={habit.id}
                  habit={habit}
                  category={categoryMap.get(habit.categoryId)}
                  weekDays={week.days}
                  entries={entriesByHabit.get(habit.id) ?? new Map<ISODate, HabitEntry>()}
                  onToggle={(date) => actions.toggleHabit(habit.id, date)}
                  onEdit={() => {
                    setEditing(habit)
                    setFormOpen(true)
                  }}
                  onArchive={() => toggleArchived(habit)}
                  onDelete={() => setPendingDelete(habit)}
                />
              ))}
            </ul>
          )}

          {archivedHabits.length > 0 ? (
            <div className="space-y-3 rounded-card border border-line bg-surface-muted/40 p-4">
              <Switch
                checked={showArchived}
                onCheckedChange={setShowArchived}
                label={`Archived habits (${archivedHabits.length})`}
                description="Archived habits keep their history but stop counting toward streaks."
              />
              {showArchived ? (
                <ul className="space-y-3">
                  {archivedHabits.map((habit) => (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      category={categoryMap.get(habit.categoryId)}
                      weekDays={week.days}
                      entries={entriesByHabit.get(habit.id) ?? new Map<ISODate, HabitEntry>()}
                      onToggle={(date) => actions.toggleHabit(habit.id, date)}
                      onEdit={() => {
                        setEditing(habit)
                        setFormOpen(true)
                      }}
                      onArchive={() => toggleArchived(habit)}
                      onDelete={() => setPendingDelete(habit)}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

        {desktop ? (
          <section aria-labelledby="day-detail-heading" className="lg:sticky lg:top-6 lg:self-start">
            <h2 id="day-detail-heading" className="sr-only">
              Selected day
            </h2>
            <Card>
              <CardContent>{detail}</CardContent>
            </Card>
          </section>
        ) : null}
      </div>

      {!desktop ? (
        <Dialog
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={selectedDateLong}
          size="md"
        >
          {detail}
        </Dialog>
      ) : null}

      <HabitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={submitForm}
        categories={categories}
        habit={editing}
      />

      <ConfirmDialog
        open={pendingDelete !== undefined}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={confirmDelete}
        title="Delete this habit?"
        message={
          pendingDelete
            ? `"${pendingDelete.name}" and every entry recorded against it will be removed from this device. Archive it instead if you want to keep the history.`
            : ''
        }
        confirmLabel="Delete habit"
        tone="danger"
      />
    </div>
  )
}
