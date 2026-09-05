/**
 * Selector hooks over the private database.
 *
 * Pages never filter or sort the raw collections themselves. Every hook here
 * takes the same shape: read the document from the provider, derive with
 * `useMemo` keyed on the exact slices it touches, and hand back data that is
 * already in render order. Two things fall out of that.
 *
 * First, memo keys are collection references (`db.tasks`), never `db`. The
 * service replaces only the collections that actually changed on each commit,
 * so ticking a task off does not re-sort the notes list.
 *
 * Second, sort order is decided in one place per entity. "Tasks come back in
 * `order`" is a fact of this module rather than something each of eleven pages
 * has to remember separately.
 */
import { useMemo } from 'react'
import { usePersonalData } from '@/providers/personalDataContext'
import { monthKeyOf, todayISO, weekKeyOf } from '@/utils/date'
import type {
  Category,
  DayMeta,
  GoalStatus,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MonthKey,
  MonthlyGoal,
  Note,
  PersonalSettings,
  Priority,
  Task,
  WeekKey,
  WeeklyGoal,
  WeeklyReview,
} from '@/types'

/* -------------------------------------------------------------------------- *
 * Ordering
 * -------------------------------------------------------------------------- */

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** Live work first, then whatever is already resolved. */
const GOAL_STATUS_RANK: Record<GoalStatus, number> = {
  active: 0,
  completed: 1,
  missed: 2,
  archived: 3,
}

function byOrderThenCreated(a: Task, b: Task): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt)
}

function byTime(a: LogEntry, b: LogEntry): number {
  return a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt)
}

interface GoalSortFields {
  status: GoalStatus
  priority: Priority
  createdAt: string
}

function byGoalOrder(a: GoalSortFields, b: GoalSortFields): number {
  const status = GOAL_STATUS_RANK[a.status] - GOAL_STATUS_RANK[b.status]
  if (status !== 0) return status
  const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (priority !== 0) return priority
  return a.createdAt.localeCompare(b.createdAt)
}

/* -------------------------------------------------------------------------- *
 * Days
 * -------------------------------------------------------------------------- */

/** Tasks for one calendar day, in the manual order the owner arranged. */
export function useTasksForDate(date: ISODate): Task[] {
  const { db } = usePersonalData()
  return useMemo(
    () => db.tasks.filter((task) => task.date === date).sort(byOrderThenCreated),
    [db.tasks, date],
  )
}

/** Tasks across an inclusive day span, by day and then manual order. */
export function useTasksInRange(from: ISODate, to: ISODate): Task[] {
  const { db } = usePersonalData()
  return useMemo(
    () =>
      db.tasks
        .filter((task) => task.date >= from && task.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date) || byOrderThenCreated(a, b)),
    [db.tasks, from, to],
  )
}

/** Work-log entries for one day, earliest first. */
export function useLogsForDate(date: ISODate): LogEntry[] {
  const { db } = usePersonalData()
  return useMemo(() => db.logs.filter((log) => log.date === date).sort(byTime), [db.logs, date])
}

/** Work-log entries across an inclusive day span, chronological. */
export function useLogsInRange(from: ISODate, to: ISODate): LogEntry[] {
  const { db } = usePersonalData()
  return useMemo(
    () =>
      db.logs
        .filter((log) => log.date >= from && log.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)),
    [db.logs, from, to],
  )
}

/** The objective / mood / energy header for a day, undefined if never set. */
export function useDayMeta(date: ISODate): DayMeta | undefined {
  const { db } = usePersonalData()
  return useMemo(() => db.days.find((day) => day.date === date), [db.days, date])
}

/* -------------------------------------------------------------------------- *
 * Goals
 * -------------------------------------------------------------------------- */

/** Goals for one ISO week: active first, then by priority. */
export function useWeeklyGoals(weekKey: WeekKey): WeeklyGoal[] {
  const { db } = usePersonalData()
  return useMemo(
    () => db.weeklyGoals.filter((goal) => goal.weekKey === weekKey).sort(byGoalOrder),
    [db.weeklyGoals, weekKey],
  )
}

/** Goals for one calendar month: active first, then by priority. */
export function useMonthlyGoals(monthKey: MonthKey): MonthlyGoal[] {
  const { db } = usePersonalData()
  return useMemo(
    () => db.monthlyGoals.filter((goal) => goal.monthKey === monthKey).sort(byGoalOrder),
    [db.monthlyGoals, monthKey],
  )
}

/* -------------------------------------------------------------------------- *
 * Habits
 * -------------------------------------------------------------------------- */

/**
 * Habits in their manual order. Archived habits are left out unless asked for,
 * and sink to the end when they are included.
 */
export function useHabits(includeArchived = false): Habit[] {
  const { db } = usePersonalData()
  return useMemo(
    () =>
      db.habits
        .filter((habit) => includeArchived || !habit.archived)
        .sort(
          (a, b) =>
            Number(a.archived) - Number(b.archived) ||
            a.order - b.order ||
            a.createdAt.localeCompare(b.createdAt),
        ),
    [db.habits, includeArchived],
  )
}

/** The lookup key for one habit on one day. Mirrors `HabitEntry.id`. */
export function habitEntryKey(habitId: string, date: ISODate): string {
  return habitId + '::' + date
}

/**
 * Every recorded habit value, keyed `${habitId}::${date}`.
 *
 * A Map rather than an array because the habit grid and the heatmap do one
 * lookup per cell — hundreds of them per render — and re-scanning the array for
 * each cell is exactly what makes a year view feel slow. Pass `from` / `to` to
 * narrow it to the window on screen.
 */
export function useHabitEntries(from?: ISODate, to?: ISODate): Map<string, HabitEntry> {
  const { db } = usePersonalData()
  return useMemo(() => {
    const map = new Map<string, HabitEntry>()
    for (const entry of db.habitEntries) {
      if (from !== undefined && entry.date < from) continue
      if (to !== undefined && entry.date > to) continue
      map.set(habitEntryKey(entry.habitId, entry.date), entry)
    }
    return map
  }, [db.habitEntries, from, to])
}

/* -------------------------------------------------------------------------- *
 * Review and notes
 * -------------------------------------------------------------------------- */

/** The retrospective for one week, undefined when it has not been started. */
export function useReview(weekKey: WeekKey): WeeklyReview | undefined {
  const { db } = usePersonalData()
  return useMemo(
    () => db.reviews.find((review) => review.weekKey === weekKey),
    [db.reviews, weekKey],
  )
}

/** Notes: pinned first, then newest by day, then most recently edited. */
export function useNotes(): Note[] {
  const { db } = usePersonalData()
  return useMemo(
    () =>
      db.notes
        .slice()
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) ||
            b.date.localeCompare(a.date) ||
            b.updatedAt.localeCompare(a.updatedAt),
        ),
    [db.notes],
  )
}

/* -------------------------------------------------------------------------- *
 * Categories and settings
 * -------------------------------------------------------------------------- */

/**
 * Categories in their configured order, archived ones last.
 *
 * Pickers take the default (live categories only). Settings passes `true`, so
 * an archived bucket can still be renamed or brought back.
 */
export function useCategories(includeArchived = false): Category[] {
  const { db } = usePersonalData()
  return useMemo(
    () =>
      db.categories
        .filter((category) => includeArchived || !category.archived)
        .sort((a, b) => Number(Boolean(a.archived)) - Number(Boolean(b.archived))),
    [db.categories, includeArchived],
  )
}

/**
 * Every category by id, archived included.
 *
 * Historical tasks and logs keep pointing at categories that are no longer
 * offered in the picker, and they still have to render with their own label and
 * colour instead of a blank — so this map never filters.
 */
export function useCategoryMap(): Map<string, Category> {
  const { db } = usePersonalData()
  return useMemo(
    () => new Map(db.categories.map((category) => [category.id, category])),
    [db.categories],
  )
}

/** One category by id. Undefined for a missing or unknown id. */
export function useCategory(id?: string): Category | undefined {
  const { db } = usePersonalData()
  return useMemo(
    () => (id ? db.categories.find((category) => category.id === id) : undefined),
    [db.categories, id],
  )
}

/** The user's dashboard preferences. Already a stable object from the service. */
export function useSettings(): PersonalSettings {
  const { db } = usePersonalData()
  return db.settings
}

/* -------------------------------------------------------------------------- *
 * Today
 * -------------------------------------------------------------------------- */

/** The week key for today, honouring the `weekStartsOn` setting. */
export function useCurrentWeekKey(): WeekKey {
  const { weekStartsOn } = useSettings()
  const today = todayISO()
  return useMemo(() => weekKeyOf(today, weekStartsOn), [today, weekStartsOn])
}

/** The month key for today. */
export function useCurrentMonthKey(): MonthKey {
  const today = todayISO()
  return useMemo(() => monthKeyOf(today), [today])
}
