/**
 * Calendar helpers.
 *
 * The single rule this module exists to enforce: **every `ISODate` is a LOCAL
 * calendar date**, never a UTC instant. `new Date('2026-09-05')` parses as
 * midnight UTC, which is the previous day for anyone west of Greenwich and
 * 05:30 on the same day in India — so days silently shift, streaks break and
 * the heatmap lies. Nothing here ever calls that constructor with a string, and
 * nothing ever formats with `toISOString().slice(0, 10)`.
 *
 * Dates are parsed by pulling the year/month/day apart and handing them to the
 * numeric `Date` constructor, and formatted with date-fns `format` — both of
 * which work entirely in local time.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfWeek,
} from 'date-fns'
import type {
  ClockTime,
  ISODate,
  MonthKey,
  PartOfDay,
  Timestamp,
  WeekKey,
  YearMonth,
} from '@/types'

/** Anything this module will read a calendar day out of. */
export type DateLike = ISODate | Date

/** 0 = Sunday, 1 = Monday. Mirrors `PersonalSettings.weekStartsOn`. */
export type WeekStartsOn = 0 | 1

/** An inclusive span of days, with every day in it enumerated. */
export interface DayRange {
  start: ISODate
  end: ISODate
  days: ISODate[]
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/
const WEEK_KEY_RE = /^(\d{4})-W(\d{1,2})$/
const MONTH_KEY_RE = /^(\d{4})-(\d{1,2})$/
const CLOCK_RE = /^(\d{1,2}):(\d{2})/

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/* -------------------------------------------------------------------------- *
 * Parsing and formatting primitives
 * -------------------------------------------------------------------------- */

/** Midnight, local time, on the given calendar day. */
export function fromISODate(value: ISODate): Date {
  const match = ISO_DATE_RE.exec(value)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }

  // Not a plain YYYY-MM-DD. date-fns still reads date-only strings as local
  // time, which keeps anything else ISO-8601 shaped consistent with the above.
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : new Date(Number.NaN)
}

/** `YYYY-MM-DD` for the local calendar day the date falls on. */
export function toISODate(date: Date): ISODate {
  return format(date, 'yyyy-MM-dd')
}

/** Normalises either accepted input shape to a `Date`. */
function asDate(value: DateLike): Date {
  return typeof value === 'string' ? fromISODate(value) : value
}

/** Today, as a local calendar date. */
export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** The current instant, as an ISO 8601 UTC timestamp. */
export function nowTimestamp(): Timestamp {
  return new Date().toISOString()
}

/** The current local wall-clock time, `HH:mm`. */
export function nowClockTime(): ClockTime {
  return format(new Date(), 'HH:mm')
}

/* -------------------------------------------------------------------------- *
 * Weeks
 *
 * Week numbering generalises ISO 8601 to either week start: a week belongs to
 * the year containing its middle day (`start + 3`), which is exactly the ISO
 * "Thursday rule" when weeks start on Monday. Week 1 of year Y is therefore the
 * week containing 4 January, so numbering never skips a week and never emits
 * two week 1s. `weekKeyOf` canonicalises on the week's start date, which is
 * what makes `weekRange(weekKeyOf(d, s), s).days` always contain `d`.
 * -------------------------------------------------------------------------- */

/** Start of the week that owns week 1 of the given year. */
function firstWeekStart(year: number, weekStartsOn: WeekStartsOn): Date {
  return startOfWeek(new Date(year, 0, 4), { weekStartsOn })
}

export function weekKeyOf(date: DateLike, weekStartsOn: WeekStartsOn): WeekKey {
  const start = startOfWeek(asDate(date), { weekStartsOn })
  const midweek = addDays(start, 3)
  const year = midweek.getFullYear()
  const offset = differenceInCalendarDays(start, firstWeekStart(year, weekStartsOn))
  return `${year}-W${pad2(Math.round(offset / 7) + 1)}`
}

export function weekRange(weekKey: WeekKey, weekStartsOn: WeekStartsOn): DayRange {
  const match = WEEK_KEY_RE.exec(weekKey)
  const start = match
    ? addDays(firstWeekStart(Number(match[1]), weekStartsOn), (Number(match[2]) - 1) * 7)
    : startOfWeek(new Date(), { weekStartsOn })

  const startISO = toISODate(start)
  const endISO = toISODate(addDays(start, 6))
  return { start: startISO, end: endISO, days: eachDayISO(startISO, endISO) }
}

export function shiftWeek(weekKey: WeekKey, delta: number, weekStartsOn: WeekStartsOn): WeekKey {
  const { start } = weekRange(weekKey, weekStartsOn)
  return weekKeyOf(shiftDay(start, delta * 7), weekStartsOn)
}

/* -------------------------------------------------------------------------- *
 * Months
 * -------------------------------------------------------------------------- */

function monthStart(monthKey: MonthKey): Date {
  const match = MONTH_KEY_RE.exec(monthKey)
  if (!match) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

export function monthKeyOf(date: DateLike): MonthKey {
  return format(asDate(date), 'yyyy-MM')
}

export function monthRange(monthKey: MonthKey): DayRange {
  const start = monthStart(monthKey)
  const startISO = toISODate(start)
  const endISO = toISODate(endOfMonth(start))
  return { start: startISO, end: endISO, days: eachDayISO(startISO, endISO) }
}

export function shiftMonth(monthKey: MonthKey, delta: number): MonthKey {
  return format(addMonths(monthStart(monthKey), delta), 'yyyy-MM')
}

/* -------------------------------------------------------------------------- *
 * Day arithmetic
 * -------------------------------------------------------------------------- */

/**
 * Moves by whole calendar days. `addDays` steps the day-of-month rather than
 * adding 24 hours, so this stays correct across a DST transition.
 */
export function shiftDay(date: DateLike, delta: number): ISODate {
  return toISODate(addDays(asDate(date), delta))
}

/** Whole calendar days from `a` to `b`. Negative when `b` is the earlier day. */
export function daysBetween(a: DateLike, b: DateLike): number {
  return differenceInCalendarDays(asDate(b), asDate(a))
}

/** Every day from `from` to `to`, inclusive. Empty when `to` precedes `from`. */
export function eachDayISO(from: DateLike, to: DateLike): ISODate[] {
  const start = asDate(from)
  const span = differenceInCalendarDays(asDate(to), start)
  if (!Number.isFinite(span) || span < 0) return []

  const days: ISODate[] = []
  for (let i = 0; i <= span; i += 1) {
    days.push(toISODate(addDays(start, i)))
  }
  return days
}

export function isToday(date: DateLike): boolean {
  return toISODate(asDate(date)) === todayISO()
}

export function isFutureDay(date: DateLike): boolean {
  return differenceInCalendarDays(asDate(date), new Date()) > 0
}

/* -------------------------------------------------------------------------- *
 * Human-readable labels
 * -------------------------------------------------------------------------- */

/** "Saturday, 5 September 2026" */
export function formatDayLong(date: DateLike): string {
  return format(asDate(date), 'EEEE, d MMMM yyyy')
}

/** "5 Sep" — compact enough for a chart axis or a dense list. */
export function formatDayShort(date: DateLike): string {
  return format(asDate(date), 'd MMM')
}

/** "September 2026" */
export function formatMonthLabel(monthKey: MonthKey): string {
  return format(monthStart(monthKey), 'MMMM yyyy')
}

/**
 * "1 – 7 Sep", "29 Sep – 5 Oct", or "29 Dec 2025 – 4 Jan 2026" when the week
 * straddles a year boundary and the year is genuinely needed to read it.
 */
export function formatWeekLabel(weekKey: WeekKey, weekStartsOn: WeekStartsOn): string {
  const { start, end } = weekRange(weekKey, weekStartsOn)
  const first = fromISODate(start)
  const last = fromISODate(end)

  if (first.getFullYear() !== last.getFullYear()) {
    return `${format(first, 'd MMM yyyy')} – ${format(last, 'd MMM yyyy')}`
  }
  if (first.getMonth() !== last.getMonth()) {
    return `${format(first, 'd MMM')} – ${format(last, 'd MMM')}`
  }
  return `${format(first, 'd')} – ${format(last, 'd MMM')}`
}

/**
 * "Today" / "Yesterday" / "Tomorrow", then "in 4 days" / "4 days ago" for
 * anything inside the surrounding week, then a plain date.
 */
export function relativeDay(date: DateLike): string {
  const target = asDate(date)
  const now = new Date()
  const diff = differenceInCalendarDays(target, now)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 6) return `in ${diff} days`
  if (diff < -1 && diff >= -6) return `${-diff} days ago`
  if (target.getFullYear() !== now.getFullYear()) return format(target, 'd MMM yyyy')
  return formatDayShort(target)
}

/** 05:00–11:59 morning, 12:00–16:59 afternoon, 17:00–21:59 evening, else night. */
export function partOfDay(time: ClockTime): PartOfDay {
  const match = CLOCK_RE.exec(time)
  if (!match) return 'night'

  const hour = Number(match[1])
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 22) return 'evening'
  return 'night'
}

/** 0 → "0m", 45 → "45m", 60 → "1h", 105 → "1h 45m". */
export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(Number.isFinite(minutes) ? minutes : 0))
  if (total < 60) return `${total}m`

  const hours = Math.floor(total / 60)
  const rest = total % 60
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** "2024-07" → "Jul 2024". */
export function formatYearMonth(value: YearMonth): string {
  return format(monthStart(value), 'MMM yyyy')
}

/** "Jul 2024 - Present", or "Jul 2024 - Mar 2025" when an end month is given. */
export function yearMonthRangeLabel(start: YearMonth, end?: YearMonth): string {
  return `${formatYearMonth(start)} - ${end ? formatYearMonth(end) : 'Present'}`
}
