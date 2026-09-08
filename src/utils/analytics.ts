/**
 * Every number the dashboard shows about the owner's own behaviour is computed
 * here.
 *
 * All functions are pure `(db, ...) => value`. Nothing in this file touches
 * storage, React or the network, which is what makes the whole analytics
 * surface testable from a plain object literal.
 *
 * Two conventions run through the module:
 *
 *  - **Days are indexed once per call.** Building `DayIndex` is a single pass
 *    over the database; every per-day figure is then a map lookup, so a
 *    42-cell calendar or a 90-day heatmap stays linear rather than quadratic.
 *  - **A metric the owner does not use is absent, not zero.** If no habits are
 *    configured, the habit component of the daily score is dropped and its
 *    weight is spread across the components that do apply. Scoring an unused
 *    feature as 0% would quietly punish someone for the shape of their setup.
 */
import { PERSONAL_ROUTES } from '@/config/routes'
import type {
  ActivityEvent,
  ActivityKind,
  AnyGoal,
  Category,
  CategoryColor,
  DayMeta,
  DayStats,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  Note,
  PersonalDatabase,
  PersonalSettings,
  RangeStats,
  StreakInfo,
  Task,
  WeekKey,
} from '@/types'
import {
  eachDayISO,
  formatDayShort,
  formatWeekLabel,
  fromISODate,
  isToday,
  shiftDay,
  shiftWeek,
  toISODate,
  weekRange,
} from '@/utils/date'
import type { WeekStartsOn } from '@/utils/date'
import { percent } from '@/utils/format'
import { touchEvents } from '@/utils/outreach'

/* -------------------------------------------------------------------------- *
 * Derived shapes that are computed rather than stored, so they live with the
 * code that produces them instead of in `types/personal.ts`.
 * -------------------------------------------------------------------------- */

export interface WeeklyTrendPoint {
  weekKey: WeekKey
  /** Short axis label, e.g. "1 – 7 Sep". */
  label: string
  tasksCompleted: number
  tasksTotal: number
  /** 0–100. */
  completionRate: number
  loggedMinutes: number
  activeDays: number
  /** Mean daily score across the seven days, 0–100. */
  score: number
}

export interface CategoryBreakdownItem {
  categoryId: string
  label: string
  color: CategoryColor
  icon?: string
  minutes: number
  /** Share of the range's total logged minutes, 0–100. */
  share: number
  tasksTotal: number
  tasksCompleted: number
}

export interface HabitAdherenceDay {
  date: ISODate
  value: number
  done: boolean
}

export interface HabitAdherence {
  habitId: string
  /** Days in the range on which the habit existed and was not archived. */
  daysDue: number
  /** Days on which a value was recorded at all, done or not. */
  daysLogged: number
  /** Days the habit's `dailyTarget` was met. */
  daysDone: number
  totalValue: number
  /** `daysDone` as a percentage of `daysDue`, 0–100. */
  rate: number
  /** Days expected across the range from `targetPerWeek`. */
  expected: number
  /** `daysDone` against `expected`, capped at 100. */
  targetRate: number
  /** Consecutive done days ending at `to` (a not-yet-done today is forgiven). */
  currentStreak: number
  bestStreak: number
  days: HabitAdherenceDay[]
}

export interface HeatmapCell {
  date: ISODate
  score: number
  /** 0 = nothing recorded, then quartiles of `score`. */
  level: 0 | 1 | 2 | 3 | 4
  tasksCompleted: number
  tasksTotal: number
  loggedMinutes: number
  habitsDone: number
  hasEntries: boolean
}

export interface DailyMinutesPoint {
  date: ISODate
  /** Short axis label, e.g. "5 Sep". */
  label: string
  minutes: number
  tasksCompleted: number
  score: number
}

export interface ActivityFeedOptions {
  limit?: number
  from?: ISODate
  to?: ISODate
  kinds?: ActivityKind[]
}

/* -------------------------------------------------------------------------- *
 * Scoring weights
 * -------------------------------------------------------------------------- */

const WEIGHT_TASKS = 0.55
const WEIGHT_MINUTES = 0.25
const WEIGHT_HABITS = 0.2

/** Hard stop for the backwards streak walk, so a corrupt date cannot hang the UI. */
const MAX_STREAK_SCAN_DAYS = 3660

/* -------------------------------------------------------------------------- *
 * Day index
 * -------------------------------------------------------------------------- */

interface DayIndex {
  tasksByDate: Map<ISODate, Task[]>
  logsByDate: Map<ISODate, LogEntry[]>
  entriesByDate: Map<ISODate, Map<string, HabitEntry>>
  notesByDate: Map<ISODate, Note[]>
  metaByDate: Map<ISODate, DayMeta>
  /** Non-archived habits, in display order. */
  habits: Habit[]
  /** First day each habit counts as due — habits are not retroactive. */
  habitStart: Map<string, ISODate>
  categories: Map<string, Category>
  settings: PersonalSettings
  /** Every date mentioned by any record, ascending. */
  dates: ISODate[]
}

function pushInto<T>(map: Map<ISODate, T[]>, key: ISODate, value: T): void {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

/** Local calendar day of an ISO instant, or undefined when it cannot be read. */
function timestampDay(timestamp?: string): ISODate | undefined {
  if (!timestamp) return undefined
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? undefined : toISODate(parsed)
}

function buildIndex(db: PersonalDatabase): DayIndex {
  const tasksByDate = new Map<ISODate, Task[]>()
  const logsByDate = new Map<ISODate, LogEntry[]>()
  const entriesByDate = new Map<ISODate, Map<string, HabitEntry>>()
  const notesByDate = new Map<ISODate, Note[]>()
  const metaByDate = new Map<ISODate, DayMeta>()
  const dates = new Set<ISODate>()

  for (const task of db.tasks) {
    pushInto(tasksByDate, task.date, task)
    dates.add(task.date)
  }
  for (const log of db.logs) {
    pushInto(logsByDate, log.date, log)
    dates.add(log.date)
  }
  for (const entry of db.habitEntries) {
    let bucket = entriesByDate.get(entry.date)
    if (!bucket) {
      bucket = new Map<string, HabitEntry>()
      entriesByDate.set(entry.date, bucket)
    }
    bucket.set(entry.habitId, entry)
    dates.add(entry.date)
  }
  for (const note of db.notes) {
    pushInto(notesByDate, note.date, note)
    dates.add(note.date)
  }
  for (const meta of db.days) {
    metaByDate.set(meta.date, meta)
    dates.add(meta.date)
  }

  const habits = db.habits.filter((habit) => !habit.archived)
  const habitStart = new Map<string, ISODate>()
  for (const habit of habits) {
    const created = timestampDay(habit.createdAt)
    if (created) habitStart.set(habit.id, created)
  }

  const categories = new Map<string, Category>()
  for (const category of db.categories) categories.set(category.id, category)

  return {
    tasksByDate,
    logsByDate,
    entriesByDate,
    notesByDate,
    metaByDate,
    habits,
    habitStart,
    categories,
    settings: db.settings,
    // ISO dates sort lexicographically exactly as they sort chronologically.
    dates: [...dates].sort(),
  }
}

/** A habit counts as done when its entry meets the daily target. */
function isHabitDone(habit: Habit, entry: HabitEntry | undefined): boolean {
  if (!entry) return false
  const target = habit.dailyTarget > 0 ? habit.dailyTarget : 1
  return entry.value > 0 && entry.value >= target
}

function habitIsDue(index: DayIndex, habit: Habit, date: ISODate): boolean {
  const start = index.habitStart.get(habit.id)
  return start === undefined || start <= date
}

function minutesOf(log: LogEntry): number {
  return Number.isFinite(log.durationMinutes) ? Math.max(0, log.durationMinutes) : 0
}

function statsFor(index: DayIndex, date: ISODate): DayStats {
  const tasks = index.tasksByDate.get(date) ?? []
  const logs = index.logsByDate.get(date) ?? []
  const notes = index.notesByDate.get(date) ?? []
  const entries = index.entriesByDate.get(date)

  let tasksCompleted = 0
  let tasksSkipped = 0
  for (const task of tasks) {
    if (task.status === 'completed') tasksCompleted += 1
    else if (task.status === 'skipped') tasksSkipped += 1
  }

  let loggedMinutes = 0
  for (const log of logs) loggedMinutes += minutesOf(log)

  let habitsDue = 0
  let habitsDone = 0
  for (const habit of index.habits) {
    if (!habitIsDue(index, habit, date)) continue
    habitsDue += 1
    if (isHabitDone(habit, entries?.get(habit.id))) habitsDone += 1
  }

  /*
   * Only the parts of the day the owner actually uses contribute. A component
   * with no source records at all is dropped and the remaining weights are
   * renormalised, so three of three tasks with no habits and no work log is a
   * 100 rather than a 55.
   */
  const minutesTarget = index.settings.dailyHoursTarget * 60
  let weight = 0
  let weighted = 0

  if (tasks.length > 0) {
    weight += WEIGHT_TASKS
    weighted += WEIGHT_TASKS * (tasksCompleted / tasks.length)
  }
  if (logs.length > 0 && minutesTarget > 0) {
    weight += WEIGHT_MINUTES
    weighted += WEIGHT_MINUTES * Math.min(loggedMinutes / minutesTarget, 1)
  }
  if (habitsDue > 0) {
    weight += WEIGHT_HABITS
    weighted += WEIGHT_HABITS * (habitsDone / habitsDue)
  }

  const score = weight > 0 ? Math.round((weighted / weight) * 100) : 0

  return {
    date,
    tasksTotal: tasks.length,
    tasksCompleted,
    tasksSkipped,
    loggedMinutes,
    habitsDue,
    habitsDone,
    score,
    hasEntries:
      tasks.length > 0 || logs.length > 0 || notes.length > 0 || (entries?.size ?? 0) > 0,
  }
}

/**
 * A day keeps a streak alive only if something was actually finished on it.
 * Merely opening the app and typing an objective is not a productive day.
 */
function countsTowardStreak(stats: DayStats): boolean {
  return (
    stats.hasEntries &&
    (stats.tasksCompleted > 0 || stats.loggedMinutes > 0 || stats.habitsDone > 0)
  )
}

/* -------------------------------------------------------------------------- *
 * Public API
 * -------------------------------------------------------------------------- */

export function dayStats(db: PersonalDatabase, date: ISODate): DayStats {
  return statsFor(buildIndex(db), date)
}

export function rangeStats(db: PersonalDatabase, from: ISODate, to: ISODate): RangeStats {
  const index = buildIndex(db)
  const days = eachDayISO(from, to)

  let tasksCompleted = 0
  let tasksTotal = 0
  let loggedMinutes = 0
  let activeDays = 0
  let bestStreak = 0
  let run = 0
  const minutes = new Map<string, number>()

  for (const date of days) {
    const stats = statsFor(index, date)
    tasksCompleted += stats.tasksCompleted
    tasksTotal += stats.tasksTotal
    loggedMinutes += stats.loggedMinutes
    if (stats.hasEntries) activeDays += 1

    if (countsTowardStreak(stats)) {
      run += 1
      if (run > bestStreak) bestStreak = run
    } else {
      run = 0
    }

    for (const log of index.logsByDate.get(date) ?? []) {
      minutes.set(log.categoryId, (minutes.get(log.categoryId) ?? 0) + minutesOf(log))
    }
  }

  const minutesByCategory = [...minutes.entries()]
    .map(([categoryId, value]) => ({ categoryId, minutes: value }))
    .sort((a, b) => b.minutes - a.minutes || a.categoryId.localeCompare(b.categoryId))

  return {
    from,
    to,
    tasksCompleted,
    tasksTotal,
    completionRate: percent(tasksCompleted, tasksTotal),
    loggedMinutes,
    activeDays,
    minutesByCategory,
    bestStreak,
  }
}

/**
 * `current` counts back from `upTo`. An empty `upTo` does not break a live
 * streak: the day is not over yet, so the walk starts from the previous day
 * instead. `best` scans the entire history, not just the recent past.
 */
export function streakInfo(db: PersonalDatabase, upTo: ISODate): StreakInfo {
  const index = buildIndex(db)
  if (index.dates.length === 0) return { current: 0, best: 0 }

  const counting = new Set<ISODate>()
  for (const date of index.dates) {
    if (countsTowardStreak(statsFor(index, date))) counting.add(date)
  }
  if (counting.size === 0) return { current: 0, best: 0 }

  let best = 0
  for (const date of counting) {
    // Only walk forward from the first day of each run.
    if (counting.has(shiftDay(date, -1))) continue
    let run = 0
    let cursor = date
    while (counting.has(cursor) && run < MAX_STREAK_SCAN_DAYS) {
      run += 1
      cursor = shiftDay(cursor, 1)
    }
    if (run > best) best = run
  }

  let current = 0
  const yesterday = shiftDay(upTo, -1)
  let cursor = counting.has(upTo) ? upTo : counting.has(yesterday) ? yesterday : undefined
  while (cursor !== undefined && counting.has(cursor) && current < MAX_STREAK_SCAN_DAYS) {
    current += 1
    cursor = shiftDay(cursor, -1)
  }

  let lastActiveDate: ISODate | undefined
  for (const date of index.dates) {
    if (date <= upTo && counting.has(date)) lastActiveDate = date
  }

  return { current, best, lastActiveDate }
}

/** Progress toward a goal's target, 0–100 and never over 100. */
export function goalProgress(goal: AnyGoal): number {
  return Math.min(percent(goal.currentValue, goal.targetValue), 100)
}

/**
 * Whether a goal counts as reached.
 *
 * A goal can arrive at its target two ways: the progress stepper flips the
 * status for you, or the number simply gets there — by an edit in the goal
 * form, or by importing a backup written before that behaviour existed. Reading
 * only `status` made a full progress bar sit next to a "0 of 3 reached" tally,
 * which reads as a bug even though both halves were technically right. Counting
 * either condition keeps every screen telling the same story.
 */
export function isGoalReached(goal: AnyGoal): boolean {
  return goal.status === 'completed' || goal.currentValue >= goal.targetValue
}

/**
 * `weeks` consecutive weeks ending at `endWeekKey`, oldest first — charts are
 * read left to right, so the newest week is the LAST element.
 */
export function weeklyTrend(
  db: PersonalDatabase,
  endWeekKey: WeekKey,
  weeks: number,
  weekStartsOn: WeekStartsOn,
): WeeklyTrendPoint[] {
  const count = Math.max(0, Math.floor(weeks))
  if (count === 0) return []

  const index = buildIndex(db)
  const points: WeeklyTrendPoint[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const weekKey = shiftWeek(endWeekKey, -offset, weekStartsOn)
    const { days } = weekRange(weekKey, weekStartsOn)

    let tasksCompleted = 0
    let tasksTotal = 0
    let loggedMinutes = 0
    let activeDays = 0
    let scoreSum = 0

    for (const date of days) {
      const stats = statsFor(index, date)
      tasksCompleted += stats.tasksCompleted
      tasksTotal += stats.tasksTotal
      loggedMinutes += stats.loggedMinutes
      scoreSum += stats.score
      if (stats.hasEntries) activeDays += 1
    }

    points.push({
      weekKey,
      label: formatWeekLabel(weekKey, weekStartsOn),
      tasksCompleted,
      tasksTotal,
      completionRate: percent(tasksCompleted, tasksTotal),
      loggedMinutes,
      activeDays,
      score: days.length > 0 ? Math.round(scoreSum / days.length) : 0,
    })
  }

  return points
}

/** Minutes and tasks per category across a range, busiest category first. */
export function categoryBreakdown(
  db: PersonalDatabase,
  from: ISODate,
  to: ISODate,
): CategoryBreakdownItem[] {
  const index = buildIndex(db)
  const minutes = new Map<string, number>()
  const tasksTotal = new Map<string, number>()
  const tasksCompleted = new Map<string, number>()
  let totalMinutes = 0

  for (const date of eachDayISO(from, to)) {
    for (const log of index.logsByDate.get(date) ?? []) {
      const value = minutesOf(log)
      minutes.set(log.categoryId, (minutes.get(log.categoryId) ?? 0) + value)
      totalMinutes += value
    }
    for (const task of index.tasksByDate.get(date) ?? []) {
      tasksTotal.set(task.categoryId, (tasksTotal.get(task.categoryId) ?? 0) + 1)
      if (task.status === 'completed') {
        tasksCompleted.set(task.categoryId, (tasksCompleted.get(task.categoryId) ?? 0) + 1)
      }
    }
  }

  const ids = new Set<string>([...minutes.keys(), ...tasksTotal.keys()])

  return [...ids]
    .map((categoryId): CategoryBreakdownItem => {
      const category = index.categories.get(categoryId)
      const categoryMinutes = minutes.get(categoryId) ?? 0
      return {
        categoryId,
        label: category?.label ?? 'Uncategorised',
        color: category?.color ?? 1,
        icon: category?.icon,
        minutes: categoryMinutes,
        share: percent(categoryMinutes, totalMinutes),
        tasksTotal: tasksTotal.get(categoryId) ?? 0,
        tasksCompleted: tasksCompleted.get(categoryId) ?? 0,
      }
    })
    .sort(
      (a, b) =>
        b.minutes - a.minutes ||
        b.tasksCompleted - a.tasksCompleted ||
        a.label.localeCompare(b.label),
    )
}

export function habitAdherence(
  db: PersonalDatabase,
  habitId: string,
  from: ISODate,
  to: ISODate,
): HabitAdherence {
  const index = buildIndex(db)
  const habit = db.habits.find((candidate) => candidate.id === habitId)
  const dates = eachDayISO(from, to)

  if (!habit) {
    return {
      habitId,
      daysDue: 0,
      daysLogged: 0,
      daysDone: 0,
      totalValue: 0,
      rate: 0,
      expected: 0,
      targetRate: 0,
      currentStreak: 0,
      bestStreak: 0,
      days: [],
    }
  }

  const days: HabitAdherenceDay[] = []
  let daysDue = 0
  let daysLogged = 0
  let daysDone = 0
  let totalValue = 0
  let bestStreak = 0
  let run = 0

  for (const date of dates) {
    if (!habitIsDue(index, habit, date)) continue
    daysDue += 1

    const entry = index.entriesByDate.get(date)?.get(habit.id)
    const value = entry ? Math.max(0, entry.value) : 0
    const done = isHabitDone(habit, entry)

    if (entry) daysLogged += 1
    if (done) {
      daysDone += 1
      run += 1
      if (run > bestStreak) bestStreak = run
    } else {
      run = 0
    }
    totalValue += value

    days.push({ date, value, done })
  }

  /*
   * Trailing streak. The final day is forgiven only when it is today — the day
   * is still in progress, so a not-yet-ticked habit should not read as broken.
   */
  let currentStreak = 0
  let cursor = days.length - 1
  if (cursor >= 0 && !days[cursor].done && isToday(days[cursor].date)) cursor -= 1
  while (cursor >= 0 && days[cursor].done) {
    currentStreak += 1
    cursor -= 1
  }

  const perWeek = Math.min(Math.max(habit.targetPerWeek, 1), 7)
  const expected = Math.round((daysDue * perWeek) / 7)

  return {
    habitId,
    daysDue,
    daysLogged,
    daysDone,
    totalValue,
    rate: percent(daysDone, daysDue),
    expected,
    targetRate: Math.min(percent(daysDone, expected), 100),
    currentStreak,
    bestStreak,
    days,
  }
}

/** One cell per day in the range, always dense. */
export function heatmapData(db: PersonalDatabase, from: ISODate, to: ISODate): HeatmapCell[] {
  const index = buildIndex(db)

  return eachDayISO(from, to).map((date): HeatmapCell => {
    const stats = statsFor(index, date)
    let level: HeatmapCell['level'] = 0
    if (stats.hasEntries && stats.score > 0) {
      if (stats.score <= 25) level = 1
      else if (stats.score <= 50) level = 2
      else if (stats.score <= 75) level = 3
      else level = 4
    }

    return {
      date,
      score: stats.score,
      level,
      tasksCompleted: stats.tasksCompleted,
      tasksTotal: stats.tasksTotal,
      loggedMinutes: stats.loggedMinutes,
      habitsDone: stats.habitsDone,
      hasEntries: stats.hasEntries,
    }
  })
}

/** One point per day in the range, zero-filled so a chart never has gaps. */
export function dailyMinutesSeries(
  db: PersonalDatabase,
  from: ISODate,
  to: ISODate,
): DailyMinutesPoint[] {
  const index = buildIndex(db)

  return eachDayISO(from, to).map((date): DailyMinutesPoint => {
    const stats = statsFor(index, date)
    return {
      date,
      label: formatDayShort(date),
      minutes: stats.loggedMinutes,
      tasksCompleted: stats.tasksCompleted,
      score: stats.score,
    }
  })
}

/* -------------------------------------------------------------------------- *
 * Activity feed
 * -------------------------------------------------------------------------- */

function dayHref(date: ISODate): string {
  return `${PERSONAL_ROUTES.calendar}?date=${date}`
}

function journalHref(date: ISODate): string {
  return `${PERSONAL_ROUTES.journal}?date=${date}`
}

/**
 * Sort key for intra-day ordering. Instants win where a record has one; the
 * work log's `HH:mm` is resolved against its own local day so a 14:30 entry
 * sorts correctly against a task completed at 16:05.
 */
function instantOf(date: ISODate, timestamp?: string, time?: string): number {
  if (timestamp) {
    const parsed = Date.parse(timestamp)
    if (Number.isFinite(parsed)) return parsed
  }
  const base = fromISODate(date)
  if (Number.isNaN(base.getTime())) return 0
  if (time) {
    const match = /^(\d{1,2}):(\d{2})/.exec(time)
    if (match) base.setHours(Number(match[1]), Number(match[2]), 0, 0)
  }
  return base.getTime()
}

interface RankedEvent {
  event: ActivityEvent
  rank: number
}

/**
 * Everything the owner has done, newest first.
 *
 * Ordering is by calendar day first and instant second, so the feed groups the
 * way a person remembers their week even when a task was ticked off after
 * midnight.
 */
export function buildActivityFeed(
  db: PersonalDatabase,
  opts: ActivityFeedOptions = {},
): ActivityEvent[] {
  const { limit, from, to, kinds } = opts
  const wanted = kinds ? new Set<ActivityKind>(kinds) : undefined
  const ranked: RankedEvent[] = []

  const accept = (kind: ActivityKind, date: ISODate): boolean => {
    if (wanted && !wanted.has(kind)) return false
    if (from && date < from) return false
    if (to && date > to) return false
    return true
  }

  const add = (event: ActivityEvent, rank: number): void => {
    ranked.push({ event, rank })
  }

  for (const task of db.tasks) {
    if (task.status !== 'completed') continue
    if (!accept('task-completed', task.date)) continue
    const timestamp = task.completedAt ?? task.updatedAt
    add(
      {
        id: `task-completed:${task.id}`,
        date: task.date,
        timestamp,
        kind: 'task-completed',
        title: task.title,
        detail: task.description,
        categoryId: task.categoryId,
        href: dayHref(task.date),
      },
      instantOf(task.date, timestamp),
    )
  }

  for (const log of db.logs) {
    if (!accept('log', log.date)) continue
    const rank = instantOf(log.date, undefined, log.time)
    add(
      {
        id: `log:${log.id}`,
        date: log.date,
        timestamp: new Date(rank).toISOString(),
        kind: 'log',
        title: log.activity,
        detail: log.notes,
        categoryId: log.categoryId,
        href: journalHref(log.date),
      },
      rank,
    )
  }

  const goals: { goal: AnyGoal; href: string }[] = [
    ...db.weeklyGoals.map((goal) => ({
      goal,
      href: `${PERSONAL_ROUTES.goals}?week=${goal.weekKey}`,
    })),
    ...db.monthlyGoals.map((goal) => ({
      goal,
      href: `${PERSONAL_ROUTES.goals}?month=${goal.monthKey}`,
    })),
  ]

  for (const { goal, href } of goals) {
    if (goal.status !== 'completed') continue
    // A goal is "done" on the day it was marked done, not on its deadline.
    const date = timestampDay(goal.updatedAt) ?? goal.deadline
    if (!date || !accept('goal-completed', date)) continue
    add(
      {
        id: `goal-completed:${goal.id}`,
        date,
        timestamp: goal.updatedAt,
        kind: 'goal-completed',
        title: goal.title,
        detail: `${goal.currentValue} / ${goal.targetValue} ${goal.unit}`.trim(),
        categoryId: goal.categoryId,
        href,
      },
      instantOf(date, goal.updatedAt),
    )
  }

  const habitsById = new Map(db.habits.map((habit) => [habit.id, habit]))
  for (const entry of db.habitEntries) {
    const habit = habitsById.get(entry.habitId)
    if (!habit || !isHabitDone(habit, entry)) continue
    if (!accept('habit', entry.date)) continue
    add(
      {
        id: `habit:${entry.id}`,
        date: entry.date,
        timestamp: entry.updatedAt,
        kind: 'habit',
        title: habit.name,
        detail: habit.unit ? `${entry.value} ${habit.unit}` : entry.note,
        categoryId: habit.categoryId,
        href: `${PERSONAL_ROUTES.habits}?date=${entry.date}`,
      },
      instantOf(entry.date, entry.updatedAt),
    )
  }

  for (const note of db.notes) {
    if (!accept('note', note.date)) continue
    add(
      {
        id: `note:${note.id}`,
        date: note.date,
        timestamp: note.updatedAt,
        kind: 'note',
        title: note.title,
        detail: note.body.slice(0, 160),
        href: journalHref(note.date),
      },
      instantOf(note.date, note.updatedAt),
    )
  }

  for (const review of db.reviews) {
    const date = timestampDay(review.updatedAt) ?? weekRange(review.weekKey, db.settings.weekStartsOn).end
    if (!accept('review', date)) continue
    add(
      {
        id: `review:${review.id}`,
        date,
        timestamp: review.updatedAt,
        kind: 'review',
        title: `Weekly review · ${formatWeekLabel(review.weekKey, db.settings.weekStartsOn)}`,
        detail: review.biggestAchievement || review.wentWell || undefined,
        href: `${PERSONAL_ROUTES.review}?week=${review.weekKey}`,
      },
      instantOf(date, review.updatedAt),
    )
  }

  for (const meta of db.days) {
    if (!meta.objective.trim()) continue
    if (!accept('day-objective', meta.date)) continue
    add(
      {
        id: `day-objective:${meta.id}`,
        date: meta.date,
        timestamp: meta.updatedAt,
        kind: 'day-objective',
        title: meta.objective,
        detail: meta.highlight,
        href: dayHref(meta.date),
      },
      instantOf(meta.date, meta.updatedAt),
    )
  }

  // Outreach touches are shaped by their own module; only the ordering is ours.
  if (!wanted || wanted.has('touch')) {
    for (const event of touchEvents(db, { from, to })) {
      if (!accept('touch', event.date)) continue
      add(event, instantOf(event.date, event.timestamp))
    }
  }

  ranked.sort((a, b) => {
    if (a.event.date !== b.event.date) return a.event.date < b.event.date ? 1 : -1
    if (a.rank !== b.rank) return b.rank - a.rank
    return a.event.id.localeCompare(b.event.id)
  })

  const events = ranked.map((item) => item.event)
  return limit !== undefined && limit >= 0 ? events.slice(0, limit) : events
}
