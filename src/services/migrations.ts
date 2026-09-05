/**
 * Turning "some JSON someone handed us" into a `PersonalDatabase` the UI can
 * render, without ever throwing.
 *
 * This runs on three paths: the document loaded from storage at boot, a file
 * dropped on the import screen, and the output of `loadSampleData`. Two of
 * those are outside our control, and a private dashboard that white-screens on
 * a slightly-off backup is worse than useless — so the rule here is: accept
 * anything, repair what can be repaired, drop what cannot, and always return
 * something renderable.
 *
 * What "repair" means concretely:
 *   - missing collections become empty arrays,
 *   - records missing an id get one, duplicate ids get a fresh one,
 *   - unknown enum values snap back to a sane default,
 *   - references to categories or habits that no longer exist are re-pointed or
 *     dropped rather than left dangling,
 *   - a version from the future is clamped, so an old build can still open a
 *     new export (losing only the fields it does not understand).
 */
import { DB_VERSION } from '@/config/app'
import { createEmptyDatabase, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/services/defaults'
import { todayISO } from '@/utils/date'
import { uid } from '@/utils/ids'
import type {
  Category,
  CategoryColor,
  DayMeta,
  GoalStatus,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MonthlyGoal,
  Note,
  PersonalDatabase,
  PersonalSettings,
  Priority,
  Task,
  TaskStatus,
  WeeklyGoal,
  WeeklyReview,
} from '@/types'

type RawRecord = Record<string, unknown>

/* -------------------------------------------------------------------------- *
 * The migration chain
 * -------------------------------------------------------------------------- */

export interface Migration {
  /** The version this step upgrades the document *to*. */
  to: number
  /** One line, shown in the import summary and useful in a bug report. */
  describe: string
  /** Receives (and returns) a loose document — normalisation happens after. */
  up(document: RawRecord): RawRecord
}

/**
 * HOW TO ADD THE NEXT MIGRATION
 *
 *   1. Change the shape in `types/personal.ts`.
 *   2. Bump `DB_VERSION` in `config/app.ts` to N.
 *   3. Append an entry here:
 *
 *        {
 *          to: N,
 *          describe: 'Split Task.notes into notes + description',
 *          up(document) {
 *            const tasks = Array.isArray(document.tasks) ? document.tasks : []
 *            return { ...document, tasks: tasks.map(...) }
 *          },
 *        }
 *
 *   4. Do not edit an existing entry — someone's export is still at that
 *      version. Steps run in ascending `to` order, each on the output of the
 *      last, and only for versions above the document's own.
 *
 * Empty today: version 1 is the first shipped schema.
 */
export const MIGRATIONS: Migration[] = []

/* -------------------------------------------------------------------------- *
 * Coercion helpers
 * -------------------------------------------------------------------------- */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const WEEK_KEY_RE = /^\d{4}-W\d{2}$/
const MONTH_KEY_RE = /^\d{4}-\d{2}$/
const CLOCK_RE = /^\d{2}:\d{2}$/

const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']
const TASK_STATUSES: readonly TaskStatus[] = ['not-started', 'in-progress', 'completed', 'skipped']
const GOAL_STATUSES: readonly GoalStatus[] = ['active', 'completed', 'missed', 'archived']

function asRecord(value: unknown): RawRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as RawRecord)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function optionalStr(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : ''
  return text ? text : undefined
}

function num(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function optionalNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback
}

/** Accepts `YYYY-MM-DD` and full ISO instants, which get truncated to the day. */
function isoDate(value: unknown): ISODate | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (ISO_DATE_RE.test(trimmed)) return trimmed
  if (trimmed.length > 10 && ISO_DATE_RE.test(trimmed.slice(0, 10))) return trimmed.slice(0, 10)
  return null
}

function timestamp(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
  }
  return fallback
}

function optionalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString()
}

function clockTime(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (CLOCK_RE.test(trimmed)) return trimmed
    if (trimmed.length >= 5 && CLOCK_RE.test(trimmed.slice(0, 5))) return trimmed.slice(0, 5)
  }
  return fallback
}

function weekKey(value: unknown): string | null {
  return typeof value === 'string' && WEEK_KEY_RE.test(value.trim()) ? value.trim() : null
}

function monthKey(value: unknown): string | null {
  return typeof value === 'string' && MONTH_KEY_RE.test(value.trim()) ? value.trim() : null
}

function categoryColor(value: unknown, fallback: CategoryColor): CategoryColor {
  const parsed = Math.round(num(value, fallback))
  return (parsed >= 1 && parsed <= 8 ? parsed : fallback) as CategoryColor
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Math.round(num(value, fallback))
  return Math.min(Math.max(parsed, min), max)
}

function stringList(value: unknown): string[] {
  return asArray(value)
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0)
}

/** Keeps a usable id, replaces a missing or duplicate one. */
function uniqueId(value: unknown, seen: Set<string>, prefix: string): string {
  const candidate = typeof value === 'string' ? value.trim() : ''
  const id = candidate && !seen.has(candidate) ? candidate : uid(prefix)
  seen.add(id)
  return id
}

/* -------------------------------------------------------------------------- *
 * Collection normalisers
 * -------------------------------------------------------------------------- */

function normalizeCategories(value: unknown): Category[] {
  const seen = new Set<string>()
  const categories: Category[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const label = str(record.label).trim()
    if (!label) continue
    categories.push({
      id: uniqueId(record.id, seen, 'cat'),
      label,
      color: categoryColor(record.color, 1),
      icon: optionalStr(record.icon),
      archived: bool(record.archived, false),
    })
  }
  // A database with no categories cannot render a single task, so restore the
  // defaults rather than shipping an unusable document to the UI.
  return categories.length > 0 ? categories : DEFAULT_CATEGORIES.map((c) => ({ ...c }))
}

function normalizeTasks(value: unknown, resolveCategory: (id: unknown) => string): Task[] {
  const seen = new Set<string>()
  const tasks: Task[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const title = str(record.title).trim()
    const date = isoDate(record.date)
    if (!title || !date) continue
    const createdAt = timestamp(record.createdAt, `${date}T09:00:00.000Z`)
    tasks.push({
      id: uniqueId(record.id, seen, 'task'),
      date,
      title,
      description: optionalStr(record.description),
      categoryId: resolveCategory(record.categoryId),
      priority: oneOf(record.priority, PRIORITIES, 'medium'),
      status: oneOf(record.status, TASK_STATUSES, 'not-started'),
      estimatedMinutes: optionalNum(record.estimatedMinutes),
      actualMinutes: optionalNum(record.actualMinutes),
      startedAt: optionalTimestamp(record.startedAt),
      completedAt: optionalTimestamp(record.completedAt),
      notes: optionalStr(record.notes),
      order: Math.round(num(record.order, tasks.length + 1)),
      createdAt,
      updatedAt: timestamp(record.updatedAt, createdAt),
    })
  }
  return tasks
}

function normalizeLogs(value: unknown, resolveCategory: (id: unknown) => string): LogEntry[] {
  const seen = new Set<string>()
  const logs: LogEntry[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const activity = str(record.activity).trim()
    const date = isoDate(record.date)
    if (!activity || !date) continue
    const createdAt = timestamp(record.createdAt, `${date}T09:00:00.000Z`)
    logs.push({
      id: uniqueId(record.id, seen, 'log'),
      date,
      time: clockTime(record.time, '09:00'),
      activity,
      categoryId: resolveCategory(record.categoryId),
      durationMinutes: Math.max(0, Math.round(num(record.durationMinutes, 30))),
      notes: optionalStr(record.notes),
      createdAt,
      updatedAt: timestamp(record.updatedAt, createdAt),
    })
  }
  return logs
}

function normalizeWeeklyGoals(
  value: unknown,
  resolveCategory: (id: unknown) => string,
): WeeklyGoal[] {
  const seen = new Set<string>()
  const goals: WeeklyGoal[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const title = str(record.title).trim()
    const key = weekKey(record.weekKey)
    if (!title || !key) continue
    const createdAt = timestamp(record.createdAt, new Date(0).toISOString())
    goals.push({
      id: uniqueId(record.id, seen, 'wgoal'),
      weekKey: key,
      title,
      description: optionalStr(record.description),
      categoryId: resolveCategory(record.categoryId),
      priority: oneOf(record.priority, PRIORITIES, 'medium'),
      targetValue: Math.max(1, Math.round(num(record.targetValue, 1))),
      currentValue: Math.max(0, Math.round(num(record.currentValue, 0))),
      unit: str(record.unit).trim(),
      deadline: isoDate(record.deadline) ?? undefined,
      status: oneOf(record.status, GOAL_STATUSES, 'active'),
      createdAt,
      updatedAt: timestamp(record.updatedAt, createdAt),
    })
  }
  return goals
}

function normalizeMonthlyGoals(
  value: unknown,
  resolveCategory: (id: unknown) => string,
): MonthlyGoal[] {
  const seen = new Set<string>()
  const goals: MonthlyGoal[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const title = str(record.title).trim()
    const key = monthKey(record.monthKey)
    if (!title || !key) continue
    const createdAt = timestamp(record.createdAt, new Date(0).toISOString())
    goals.push({
      id: uniqueId(record.id, seen, 'mgoal'),
      monthKey: key,
      title,
      description: optionalStr(record.description),
      categoryId: resolveCategory(record.categoryId),
      priority: oneOf(record.priority, PRIORITIES, 'medium'),
      targetValue: Math.max(1, Math.round(num(record.targetValue, 1))),
      currentValue: Math.max(0, Math.round(num(record.currentValue, 0))),
      unit: str(record.unit).trim(),
      deadline: isoDate(record.deadline) ?? undefined,
      status: oneOf(record.status, GOAL_STATUSES, 'active'),
      createdAt,
      updatedAt: timestamp(record.updatedAt, createdAt),
    })
  }
  return goals
}

function normalizeHabits(value: unknown, resolveCategory: (id: unknown) => string): Habit[] {
  const seen = new Set<string>()
  const habits: Habit[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const name = str(record.name).trim()
    if (!name) continue
    habits.push({
      id: uniqueId(record.id, seen, 'habit'),
      name,
      categoryId: resolveCategory(record.categoryId),
      color: categoryColor(record.color, 1),
      targetPerWeek: clampInt(record.targetPerWeek, 1, 7, 5),
      dailyTarget: Math.max(1, Math.round(num(record.dailyTarget, 1))),
      unit: optionalStr(record.unit),
      order: Math.round(num(record.order, habits.length + 1)),
      archived: bool(record.archived, false),
      createdAt: timestamp(record.createdAt, new Date(0).toISOString()),
    })
  }
  return habits
}

function normalizeHabitEntries(value: unknown, habitIds: Set<string>): HabitEntry[] {
  const seen = new Set<string>()
  const entries: HabitEntry[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const habitId = str(record.habitId).trim()
    const date = isoDate(record.date)
    // An entry whose habit is gone can never be rendered — drop it.
    if (!habitId || !date || !habitIds.has(habitId)) continue
    const id = `${habitId}::${date}`
    if (seen.has(id)) continue
    seen.add(id)
    entries.push({
      id,
      habitId,
      date,
      value: Math.max(0, Math.round(num(record.value, 0))),
      note: optionalStr(record.note),
      updatedAt: timestamp(record.updatedAt, `${date}T12:00:00.000Z`),
    })
  }
  return entries
}

function normalizeReviews(value: unknown): WeeklyReview[] {
  const seen = new Set<string>()
  const reviews: WeeklyReview[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const key = weekKey(record.weekKey) ?? weekKey(record.id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    reviews.push({
      id: key,
      weekKey: key,
      wentWell: str(record.wentWell),
      wentWrong: str(record.wentWrong),
      learned: str(record.learned),
      improve: str(record.improve),
      biggestAchievement: str(record.biggestAchievement),
      biggestMistake: str(record.biggestMistake),
      nextWeekFocus: str(record.nextWeekFocus),
      rating: record.rating === undefined ? undefined : clampInt(record.rating, 1, 5, 3),
      updatedAt: timestamp(record.updatedAt, new Date(0).toISOString()),
    })
  }
  return reviews
}

function normalizeNotes(value: unknown): Note[] {
  const seen = new Set<string>()
  const notes: Note[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const title = str(record.title).trim()
    const body = str(record.body)
    if (!title && !body) continue
    // A note with no usable date still has to appear somewhere in the
    // journal, and today is the only defensible guess.
    const date = isoDate(record.date) ?? isoDate(record.createdAt) ?? todayISO()
    const createdAt = timestamp(record.createdAt, `${date}T09:00:00.000Z`)
    notes.push({
      id: uniqueId(record.id, seen, 'note'),
      date,
      title: title || 'Untitled note',
      body,
      tags: stringList(record.tags),
      pinned: bool(record.pinned, false),
      createdAt,
      updatedAt: timestamp(record.updatedAt, createdAt),
    })
  }
  return notes
}

function normalizeDays(value: unknown): DayMeta[] {
  const seen = new Set<string>()
  const days: DayMeta[] = []
  for (const entry of asArray(value)) {
    const record = asRecord(entry)
    if (!record) continue
    const date = isoDate(record.date) ?? isoDate(record.id)
    if (!date || seen.has(date)) continue
    seen.add(date)
    days.push({
      id: date,
      date,
      objective: str(record.objective),
      mood: record.mood === undefined ? undefined : clampInt(record.mood, 1, 5, 3),
      energy: record.energy === undefined ? undefined : clampInt(record.energy, 1, 5, 3),
      highlight: optionalStr(record.highlight),
      updatedAt: timestamp(record.updatedAt, `${date}T21:00:00.000Z`),
    })
  }
  return days
}

export function normalizeSettings(value: unknown): PersonalSettings {
  const record = asRecord(value) ?? {}
  const displayName = str(record.displayName, DEFAULT_SETTINGS.displayName).trim()
  return {
    weekStartsOn: num(record.weekStartsOn, DEFAULT_SETTINGS.weekStartsOn) === 0 ? 0 : 1,
    dailyHoursTarget: Math.min(
      Math.max(num(record.dailyHoursTarget, DEFAULT_SETTINGS.dailyHoursTarget), 0.5),
      24,
    ),
    dailyTaskTarget: clampInt(record.dailyTaskTarget, 1, 50, DEFAULT_SETTINGS.dailyTaskTarget),
    displayName: displayName || DEFAULT_SETTINGS.displayName,
    seedDataCleared: bool(record.seedDataCleared, DEFAULT_SETTINGS.seedDataCleared),
  }
}

/* -------------------------------------------------------------------------- *
 * Entry point
 * -------------------------------------------------------------------------- */

/** Digs the document out of a plain object, a JSON string, or an export wrapper. */
function unwrap(raw: unknown): RawRecord | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  const record = asRecord(value)
  if (!record) return null
  // Tolerate `{ database: {...} }` / `{ data: {...} }` wrappers from other tools.
  for (const key of ['database', 'data'] as const) {
    const nested = asRecord(record[key])
    if (nested && (Array.isArray(nested.tasks) || Array.isArray(nested.categories))) {
      return nested
    }
  }
  return record
}

function readVersion(document: RawRecord): number {
  const version = Math.floor(num(document.version, 0))
  if (!Number.isFinite(version) || version < 0) return 0
  // A document from a newer build: clamp, keep what we understand, drop the
  // rest during normalisation rather than refusing to open it.
  return Math.min(version, DB_VERSION)
}

/**
 * Accepts anything and returns a `PersonalDatabase`. Never throws.
 */
export function migrate(raw: unknown): PersonalDatabase {
  const source = unwrap(raw)
  if (!source) return createEmptyDatabase()

  let document = source
  const version = readVersion(document)
  for (const migration of [...MIGRATIONS].sort((a, b) => a.to - b.to)) {
    if (migration.to <= version) continue
    try {
      document = asRecord(migration.up(document)) ?? document
    } catch {
      // A migration that throws must not cost the user their whole database;
      // skip it and let normalisation salvage what it can.
    }
  }

  const categories = normalizeCategories(document.categories)
  const categoryIds = new Set(categories.map((category) => category.id))
  const fallbackCategoryId =
    categories.find((category) => !category.archived)?.id ?? categories[0].id
  const resolveCategory = (id: unknown): string => {
    const candidate = typeof id === 'string' ? id.trim() : ''
    return candidate && categoryIds.has(candidate) ? candidate : fallbackCategoryId
  }

  const habits = normalizeHabits(document.habits, resolveCategory)
  const habitIds = new Set(habits.map((habit) => habit.id))

  return {
    version: DB_VERSION,
    categories,
    tasks: normalizeTasks(document.tasks, resolveCategory),
    logs: normalizeLogs(document.logs, resolveCategory),
    weeklyGoals: normalizeWeeklyGoals(document.weeklyGoals, resolveCategory),
    monthlyGoals: normalizeMonthlyGoals(document.monthlyGoals, resolveCategory),
    habits,
    habitEntries: normalizeHabitEntries(document.habitEntries, habitIds),
    reviews: normalizeReviews(document.reviews),
    notes: normalizeNotes(document.notes),
    days: normalizeDays(document.days),
    settings: normalizeSettings(document.settings),
  }
}

/** True when the stored document is already at the current schema version. */
export function isCurrentVersion(raw: unknown): boolean {
  const source = unwrap(raw)
  return source ? num(source.version, 0) === DB_VERSION : false
}
