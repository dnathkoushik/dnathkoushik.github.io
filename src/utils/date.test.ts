import { describe, expect, it } from 'vitest'
import {
  daysBetween,
  durationLabel,
  eachDayISO,
  formatDayLong,
  formatDayShort,
  formatMonthLabel,
  formatWeekLabel,
  formatYearMonth,
  fromISODate,
  monthRange,
  partOfDay,
  relativeDay,
  shiftDay,
  shiftMonth,
  shiftWeek,
  toISODate,
  todayISO,
  weekKeyOf,
  weekRange,
  yearMonthRangeLabel,
} from '@/utils/date'
import type { WeekStartsOn } from '@/utils/date'

const WEEK_STARTS: WeekStartsOn[] = [0, 1]

/**
 * Days that a naive `+ 86400000` implementation gets wrong: DST transitions in
 * the US, the EU, Australia and Chile. The assertions hold in every timezone,
 * and fail loudly in any zone that actually observes the shift.
 */
const DST_DAYS = [
  '2026-03-08', // US spring forward
  '2026-11-01', // US fall back
  '2026-03-29', // EU spring forward
  '2026-10-25', // EU fall back
  '2026-04-05', // Australia
  '2026-09-06', // Chile
]

describe('local calendar dates', () => {
  it('parses YYYY-MM-DD as local midnight, not as a UTC instant', () => {
    const parsed = fromISODate('2026-09-05')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(8)
    expect(parsed.getDate()).toBe(5)
    // `new Date('2026-09-05')` would be midnight UTC, i.e. 05:30 in IST and the
    // previous evening in New York.
    expect(parsed.getHours()).toBe(0)
    expect(parsed.getMinutes()).toBe(0)
  })

  it('round-trips every day of a year without shifting', () => {
    let date = '2026-01-01'
    for (let i = 0; i < 365; i += 1) {
      expect(toISODate(fromISODate(date))).toBe(date)
      date = shiftDay(date, 1)
    }
    expect(date).toBe('2027-01-01')
  })

  it('round-trips across DST transitions', () => {
    for (const day of DST_DAYS) {
      expect(toISODate(fromISODate(day))).toBe(day)
    }
  })
})

describe('shiftDay', () => {
  it('crosses DST boundaries by whole calendar days', () => {
    expect(shiftDay('2026-03-08', 1)).toBe('2026-03-09')
    expect(shiftDay('2026-03-08', -1)).toBe('2026-03-07')
    expect(shiftDay('2026-11-01', 1)).toBe('2026-11-02')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26')
    expect(shiftDay('2026-04-05', 1)).toBe('2026-04-06')
  })

  it('crosses month, year and leap-day boundaries', () => {
    expect(shiftDay('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDay('2028-02-29', 1)).toBe('2028-03-01')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('eachDayISO', () => {
  it('is inclusive at both ends', () => {
    expect(eachDayISO('2026-09-05', '2026-09-05')).toEqual(['2026-09-05'])
    expect(eachDayISO('2026-09-05', '2026-09-08')).toEqual([
      '2026-09-05',
      '2026-09-06',
      '2026-09-07',
      '2026-09-08',
    ])
  })

  it('returns nothing when the range is inverted', () => {
    expect(eachDayISO('2026-09-08', '2026-09-05')).toEqual([])
  })

  it('produces no duplicate or missing days across a DST transition', () => {
    const days = eachDayISO('2026-03-06', '2026-03-11')
    expect(days).toHaveLength(6)
    expect(new Set(days).size).toBe(6)
    expect(days[2]).toBe('2026-03-08')
  })
})

describe('week keys', () => {
  it.each(WEEK_STARTS)('round-trips for weekStartsOn=%i across a year boundary', (weekStartsOn) => {
    let date = '2025-11-15'
    for (let i = 0; i < 420; i += 1) {
      const key = weekKeyOf(date, weekStartsOn)
      expect(key).toMatch(/^\d{4}-W\d{2}$/)

      const range = weekRange(key, weekStartsOn)
      expect(range.days).toHaveLength(7)
      expect(range.days).toContain(date)
      expect(range.days[0]).toBe(range.start)
      expect(range.days[6]).toBe(range.end)
      expect(fromISODate(range.start).getDay()).toBe(weekStartsOn)

      // The key is canonical: re-deriving it from the week's own start is a
      // fixed point, which is what makes navigation by week stable.
      expect(weekKeyOf(range.start, weekStartsOn)).toBe(key)

      date = shiftDay(date, 1)
    }
  })

  it('follows ISO 8601 when weeks start on Monday', () => {
    // ISO week 2026-W01 runs Mon 29 Dec 2025 - Sun 4 Jan 2026.
    expect(weekKeyOf('2026-01-01', 1)).toBe('2026-W01')
    expect(weekKeyOf('2025-12-29', 1)).toBe('2026-W01')
    expect(weekRange('2026-W01', 1).start).toBe('2025-12-29')
    expect(weekRange('2026-W01', 1).end).toBe('2026-01-04')
  })

  it('assigns the turn of the year to the previous week when weeks start on Sunday', () => {
    const key = weekKeyOf('2026-01-01', 0)
    expect(key).toBe('2025-W53')
    expect(weekRange(key, 0).start).toBe('2025-12-28')
    expect(weekRange(key, 0).days).toContain('2026-01-01')
  })

  it.each(WEEK_STARTS)('shiftWeek is reversible for weekStartsOn=%i', (weekStartsOn) => {
    for (const seed of ['2025-12-29', '2026-01-01', '2026-06-15', '2026-12-31']) {
      const key = weekKeyOf(seed, weekStartsOn)
      expect(shiftWeek(shiftWeek(key, 6, weekStartsOn), -6, weekStartsOn)).toBe(key)
      expect(weekRange(shiftWeek(key, 1, weekStartsOn), weekStartsOn).start).toBe(
        shiftDay(weekRange(key, weekStartsOn).start, 7),
      )
    }
  })

  it('steps into the next year without skipping a week', () => {
    expect(shiftWeek('2025-W52', 1, 1)).toBe('2026-W01')
    expect(shiftWeek('2026-W01', -1, 1)).toBe('2025-W52')
  })
})

describe('months', () => {
  it('enumerates a leap February', () => {
    const range = monthRange('2028-02')
    expect(range.start).toBe('2028-02-01')
    expect(range.end).toBe('2028-02-29')
    expect(range.days).toHaveLength(29)
  })

  it('shifts month keys across year boundaries', () => {
    expect(shiftMonth('2026-01', 1)).toBe('2026-02')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    // A 31-day month must not spill into March when stepping to February.
    expect(shiftMonth('2026-01', 1)).not.toBe('2026-03')
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days in both directions', () => {
    expect(daysBetween('2026-09-05', '2026-09-12')).toBe(7)
    expect(daysBetween('2026-09-12', '2026-09-05')).toBe(-7)
    expect(daysBetween('2026-09-05', '2026-09-05')).toBe(0)
    // Spans a spring-forward day, which is only 23 hours long.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
  })
})

describe('durationLabel', () => {
  it('formats minutes the way a person reads them', () => {
    expect(durationLabel(0)).toBe('0m')
    expect(durationLabel(45)).toBe('45m')
    expect(durationLabel(59)).toBe('59m')
    expect(durationLabel(60)).toBe('1h')
    expect(durationLabel(105)).toBe('1h 45m')
    expect(durationLabel(120)).toBe('2h')
    expect(durationLabel(1439)).toBe('23h 59m')
    expect(durationLabel(-30)).toBe('0m')
  })
})

describe('partOfDay', () => {
  it('splits the day at 05:00, 12:00, 17:00 and 22:00', () => {
    expect(partOfDay('04:59')).toBe('night')
    expect(partOfDay('05:00')).toBe('morning')
    expect(partOfDay('11:59')).toBe('morning')
    expect(partOfDay('12:00')).toBe('afternoon')
    expect(partOfDay('16:59')).toBe('afternoon')
    expect(partOfDay('17:00')).toBe('evening')
    expect(partOfDay('21:59')).toBe('evening')
    expect(partOfDay('22:00')).toBe('night')
    expect(partOfDay('00:00')).toBe('night')
  })
})

describe('labels', () => {
  it('formats days, months and weeks', () => {
    expect(formatDayLong('2026-09-05')).toBe('Saturday, 5 September 2026')
    expect(formatDayShort('2026-09-05')).toBe('5 Sep')
    expect(formatMonthLabel('2026-09')).toBe('September 2026')
    expect(formatWeekLabel(weekKeyOf('2026-09-05', 1), 1)).toBe('31 Aug – 6 Sep')
    expect(formatWeekLabel('2026-W01', 1)).toBe('29 Dec 2025 – 4 Jan 2026')
  })

  it('formats month-precision CV ranges', () => {
    expect(formatYearMonth('2024-07')).toBe('Jul 2024')
    expect(yearMonthRangeLabel('2024-07')).toBe('Jul 2024 - Present')
    expect(yearMonthRangeLabel('2024-07', '2025-03')).toBe('Jul 2024 - Mar 2025')
  })

  it('describes nearby days relative to today', () => {
    const today = todayISO()
    expect(relativeDay(today)).toBe('Today')
    expect(relativeDay(shiftDay(today, 1))).toBe('Tomorrow')
    expect(relativeDay(shiftDay(today, -1))).toBe('Yesterday')
    expect(relativeDay(shiftDay(today, 4))).toBe('in 4 days')
    expect(relativeDay(shiftDay(today, -4))).toBe('4 days ago')
    // Beyond the surrounding week it falls back to a plain date.
    expect(relativeDay(shiftDay(today, 30))).not.toMatch(/days/)
  })
})
