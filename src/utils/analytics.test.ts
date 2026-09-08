import { describe, expect, it } from 'vitest'
import type {
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  Note,
  PersonalDatabase,
  Task,
  Timestamp,
  WeeklyGoal,
} from '@/types'
import {
  buildActivityFeed,
  dailyMinutesSeries,
  dayStats,
  goalProgress,
  habitAdherence,
  heatmapData,
  rangeStats,
  streakInfo,
  weeklyTrend,
} from '@/utils/analytics'
import { shiftDay, shiftWeek, todayISO, weekKeyOf } from '@/utils/date'

/* -------------------------------------------------------------------------- *
 * Fixtures
 * -------------------------------------------------------------------------- */

/**
 * A timestamp anchored to a LOCAL wall-clock time on the given day, so that
 * converting it back to a calendar date yields the same day in any timezone.
 */
function stamp(date: ISODate, hour = 12, minute = 0): Timestamp {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

function task(date: ISODate, overrides: Partial<Task> = {}): Task {
  return {
    id: `t-${date}-${overrides.title ?? Math.random().toString(36).slice(2, 8)}`,
    date,
    title: 'Task',
    categoryId: 'dsa',
    priority: 'medium',
    status: 'completed',
    order: 0,
    createdAt: stamp(date, 8),
    updatedAt: stamp(date, 18),
    ...overrides,
  }
}

function log(date: ISODate, durationMinutes: number, overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: `l-${date}-${durationMinutes}-${overrides.time ?? '09:00'}`,
    date,
    time: '09:00',
    activity: 'Focus block',
    categoryId: 'dsa',
    durationMinutes,
    createdAt: stamp(date, 9),
    updatedAt: stamp(date, 9),
    ...overrides,
  }
}

function habit(id: string, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    categoryId: 'dsa',
    color: 1,
    targetPerWeek: 7,
    dailyTarget: 1,
    order: 0,
    archived: false,
    createdAt: stamp('2020-01-01'),
    ...overrides,
  }
}

function entry(habitId: string, date: ISODate, value: number): HabitEntry {
  return { id: `${habitId}::${date}`, habitId, date, value, updatedAt: stamp(date, 21) }
}

function note(date: ISODate, title = 'Note'): Note {
  return {
    id: `n-${date}`,
    date,
    title,
    body: 'body',
    tags: [],
    pinned: false,
    createdAt: stamp(date, 20),
    updatedAt: stamp(date, 20),
  }
}

function weeklyGoal(overrides: Partial<WeeklyGoal> = {}): WeeklyGoal {
  return {
    id: 'g-1',
    weekKey: '2026-W36',
    title: 'Solve 20 problems',
    categoryId: 'dsa',
    priority: 'high',
    targetValue: 20,
    currentValue: 20,
    unit: 'problems',
    status: 'completed',
    createdAt: stamp('2026-08-31'),
    updatedAt: stamp('2026-09-03', 19),
    ...overrides,
  }
}

function makeDb(overrides: Partial<PersonalDatabase> = {}): PersonalDatabase {
  return {
    version: 2,
    companies: [],
    contacts: [],
    opportunities: [],
    touches: [],
    templates: [],
    outreach: { weeklyTarget: 15, followUpDays: [4, 10], staleAfterDays: 10, fitCriteria: [] },
    categories: [
      { id: 'dsa', label: 'DSA', color: 1 },
      { id: 'dev', label: 'Development', color: 2 },
    ],
    tasks: [],
    logs: [],
    weeklyGoals: [],
    monthlyGoals: [],
    habits: [],
    habitEntries: [],
    reviews: [],
    notes: [],
    days: [],
    settings: {
      weekStartsOn: 1,
      dailyHoursTarget: 6,
      dailyTaskTarget: 3,
      displayName: 'Owner',
      seedDataCleared: true,
    },
    ...overrides,
  }
}

const DAY: ISODate = '2026-09-05'

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

describe('dayStats', () => {
  it('scores a fully finished day at 100 when nothing else is configured', () => {
    const db = makeDb({
      tasks: [
        task(DAY, { id: 'a', title: 'a' }),
        task(DAY, { id: 'b', title: 'b' }),
        task(DAY, { id: 'c', title: 'c' }),
      ],
    })

    const stats = dayStats(db, DAY)
    expect(stats.tasksTotal).toBe(3)
    expect(stats.tasksCompleted).toBe(3)
    // Habits and the work log are unused, so their weight goes to the one
    // component that applies rather than dragging the day down to 55.
    expect(stats.score).toBe(100)
    expect(stats.hasEntries).toBe(true)
  })

  it('blends tasks, logged minutes and habits by weight', () => {
    const db = makeDb({
      tasks: [
        task(DAY, { id: 'a', title: 'a' }),
        task(DAY, { id: 'b', title: 'b' }),
        task(DAY, { id: 'c', title: 'c' }),
        task(DAY, { id: 'd', title: 'd' }),
      ],
      logs: [log(DAY, 180)],
      habits: [habit('read'), habit('gym')],
    })

    // 0.55 x 1 + 0.25 x 0.5 + 0.20 x 0 = 0.675
    expect(dayStats(db, DAY).score).toBe(68)
  })

  it('redistributes the weight of components with no records at all', () => {
    const db = makeDb({
      logs: [log(DAY, 360)],
      habits: [habit('read'), habit('gym')],
      habitEntries: [entry('read', DAY, 1)],
    })

    // No tasks: (0.25 x 1 + 0.20 x 0.5) / 0.45 = 0.7778
    const stats = dayStats(db, DAY)
    expect(stats.habitsDue).toBe(2)
    expect(stats.habitsDone).toBe(1)
    expect(stats.score).toBe(78)
  })

  it('caps the logged-minutes component at the daily target', () => {
    const overshoot = dayStats(makeDb({ logs: [log(DAY, 900)] }), DAY)
    const exact = dayStats(makeDb({ logs: [log(DAY, 360)] }), DAY)
    expect(overshoot.score).toBe(exact.score)
    expect(overshoot.score).toBe(100)
    expect(overshoot.loggedMinutes).toBe(900)
  })

  it('reports an untouched day as empty rather than as a failure', () => {
    const stats = dayStats(makeDb(), DAY)
    expect(stats.hasEntries).toBe(false)
    expect(stats.score).toBe(0)
    expect(stats.habitsDue).toBe(0)
  })

  it('does not hold a habit against days before it existed', () => {
    const db = makeDb({ habits: [habit('read', { createdAt: stamp('2026-09-05', 9) })] })
    expect(dayStats(db, '2026-09-04').habitsDue).toBe(0)
    expect(dayStats(db, '2026-09-05').habitsDue).toBe(1)
  })

  it('counts a habit as done only once its daily target is met', () => {
    const db = makeDb({
      habits: [habit('problems', { dailyTarget: 2, unit: 'problems' })],
      habitEntries: [entry('problems', DAY, 1), entry('problems', '2026-09-06', 2)],
    })
    expect(dayStats(db, DAY).habitsDone).toBe(0)
    expect(dayStats(db, '2026-09-06').habitsDone).toBe(1)
  })
})

describe('rangeStats', () => {
  it('returns 0% rather than NaN when the range holds no tasks', () => {
    const stats = rangeStats(makeDb({ logs: [log(DAY, 60)] }), '2026-09-01', '2026-09-07')
    expect(stats.tasksTotal).toBe(0)
    expect(stats.completionRate).toBe(0)
    expect(stats.loggedMinutes).toBe(60)
    expect(stats.activeDays).toBe(1)
  })

  it('ranks minutes by category, busiest first', () => {
    const db = makeDb({
      logs: [
        log('2026-09-01', 30, { categoryId: 'dsa' }),
        log('2026-09-02', 90, { categoryId: 'dev', time: '11:00' }),
        log('2026-09-03', 45, { categoryId: 'dsa', time: '15:00' }),
      ],
    })

    const stats = rangeStats(db, '2026-09-01', '2026-09-07')
    expect(stats.minutesByCategory).toEqual([
      { categoryId: 'dev', minutes: 90 },
      { categoryId: 'dsa', minutes: 75 },
    ])
    expect(stats.loggedMinutes).toBe(165)
    expect(stats.bestStreak).toBe(3)
  })
})

describe('streakInfo', () => {
  const today = todayISO()

  it('stays alive when today has not been filled in yet', () => {
    const db = makeDb({
      tasks: [
        task(shiftDay(today, -1), { id: 'x1', title: 'x1' }),
        task(shiftDay(today, -2), { id: 'x2', title: 'x2' }),
        task(shiftDay(today, -3), { id: 'x3', title: 'x3' }),
      ],
    })

    const streak = streakInfo(db, today)
    expect(streak.current).toBe(3)
    expect(streak.best).toBe(3)
    expect(streak.lastActiveDate).toBe(shiftDay(today, -1))
  })

  it('extends the streak once today counts', () => {
    const db = makeDb({
      tasks: [
        task(today, { id: 'x0', title: 'x0' }),
        task(shiftDay(today, -1), { id: 'x1', title: 'x1' }),
        task(shiftDay(today, -2), { id: 'x2', title: 'x2' }),
      ],
    })
    expect(streakInfo(db, today).current).toBe(3)
    expect(streakInfo(db, today).lastActiveDate).toBe(today)
  })

  it('breaks on a genuine gap but still reports the best run', () => {
    const db = makeDb({
      tasks: [
        task(shiftDay(today, -1), { id: 'a', title: 'a' }),
        task(shiftDay(today, -3), { id: 'b', title: 'b' }),
        task(shiftDay(today, -4), { id: 'c', title: 'c' }),
        task(shiftDay(today, -5), { id: 'd', title: 'd' }),
      ],
    })

    const streak = streakInfo(db, today)
    expect(streak.current).toBe(1)
    expect(streak.best).toBe(3)
  })

  it('does not count a day where nothing was actually finished', () => {
    const db = makeDb({
      notes: [note(shiftDay(today, -1))],
      tasks: [task(shiftDay(today, -1), { id: 'p', title: 'p', status: 'not-started' })],
    })

    const streak = streakInfo(db, today)
    expect(dayStats(db, shiftDay(today, -1)).hasEntries).toBe(true)
    expect(streak.current).toBe(0)
    expect(streak.best).toBe(0)
  })
})

describe('goalProgress', () => {
  it('caps at 100 and never divides by zero', () => {
    expect(goalProgress(weeklyGoal({ currentValue: 5, targetValue: 20 }))).toBe(25)
    expect(goalProgress(weeklyGoal({ currentValue: 40, targetValue: 20 }))).toBe(100)
    expect(goalProgress(weeklyGoal({ currentValue: 3, targetValue: 0 }))).toBe(0)
  })
})

describe('weeklyTrend', () => {
  it('returns oldest first so a chart reads left to right', () => {
    const endWeek = weekKeyOf(DAY, 1)
    const db = makeDb({ tasks: [task(DAY, { id: 'a', title: 'a' })] })

    const trend = weeklyTrend(db, endWeek, 4, 1)
    expect(trend).toHaveLength(4)
    expect(trend[3].weekKey).toBe(endWeek)
    expect(trend[0].weekKey).toBe(shiftWeek(endWeek, -3, 1))
    expect(trend.map((point) => point.weekKey)).toEqual([...trend.map((p) => p.weekKey)].sort())

    // The single completed task lands in the newest bucket only.
    expect(trend[3].tasksCompleted).toBe(1)
    expect(trend.slice(0, 3).every((point) => point.tasksCompleted === 0)).toBe(true)
    expect(trend[3].label.length).toBeGreaterThan(0)
  })
})

describe('heatmapData and dailyMinutesSeries', () => {
  it('emits one dense, zero-filled point per day', () => {
    const db = makeDb({ logs: [log('2026-09-03', 120)] })
    const series = dailyMinutesSeries(db, '2026-09-01', '2026-09-05')

    expect(series.map((point) => point.date)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ])
    expect(series.map((point) => point.minutes)).toEqual([0, 0, 120, 0, 0])
  })

  it('buckets scores into quartile levels, with 0 for untouched days', () => {
    const db = makeDb({
      tasks: [
        // 1 of 4 completed -> 25 -> level 1
        task('2026-09-01', { id: 'a1', title: 'a1' }),
        task('2026-09-01', { id: 'a2', title: 'a2', status: 'not-started' }),
        task('2026-09-01', { id: 'a3', title: 'a3', status: 'not-started' }),
        task('2026-09-01', { id: 'a4', title: 'a4', status: 'not-started' }),
        // 1 of 2 completed -> 50 -> level 2
        task('2026-09-02', { id: 'b1', title: 'b1' }),
        task('2026-09-02', { id: 'b2', title: 'b2', status: 'not-started' }),
        // 3 of 4 completed -> 75 -> level 3
        task('2026-09-03', { id: 'c1', title: 'c1' }),
        task('2026-09-03', { id: 'c2', title: 'c2' }),
        task('2026-09-03', { id: 'c3', title: 'c3' }),
        task('2026-09-03', { id: 'c4', title: 'c4', status: 'not-started' }),
        // 1 of 1 -> 100 -> level 4
        task('2026-09-04', { id: 'd1', title: 'd1' }),
      ],
    })

    const cells = heatmapData(db, '2026-09-01', '2026-09-05')
    expect(cells.map((cell) => cell.score)).toEqual([25, 50, 75, 100, 0])
    expect(cells.map((cell) => cell.level)).toEqual([1, 2, 3, 4, 0])
    expect(cells[4].hasEntries).toBe(false)
  })
})

describe('habitAdherence', () => {
  it('measures done days against due days and the weekly target', () => {
    const db = makeDb({
      habits: [habit('read', { targetPerWeek: 5, dailyTarget: 1 })],
      habitEntries: [
        entry('read', '2026-09-01', 1),
        entry('read', '2026-09-02', 1),
        entry('read', '2026-09-03', 0),
        entry('read', '2026-09-04', 1),
      ],
    })

    const adherence = habitAdherence(db, 'read', '2026-09-01', '2026-09-07')
    expect(adherence.daysDue).toBe(7)
    expect(adherence.daysLogged).toBe(4)
    expect(adherence.daysDone).toBe(3)
    expect(adherence.rate).toBe(43)
    expect(adherence.expected).toBe(5)
    expect(adherence.targetRate).toBe(60)
    expect(adherence.bestStreak).toBe(2)
    expect(adherence.days).toHaveLength(7)
  })

  it('returns an empty result for a habit that does not exist', () => {
    const adherence = habitAdherence(makeDb(), 'missing', '2026-09-01', '2026-09-07')
    expect(adherence.daysDue).toBe(0)
    expect(adherence.days).toEqual([])
  })
})

describe('buildActivityFeed', () => {
  const db = makeDb({
    tasks: [
      task('2026-09-01', { id: 'old', title: 'Oldest task' }),
      task('2026-09-04', { id: 'mid', title: 'Middle task' }),
    ],
    logs: [
      log('2026-09-04', 60, { id: 'log-morning', activity: 'Morning block', time: '08:00' }),
      log('2026-09-04', 60, { id: 'log-evening', activity: 'Evening block', time: '20:00' }),
    ],
    weeklyGoals: [weeklyGoal()],
    notes: [note('2026-09-02', 'A note')],
  })

  it('sorts newest first, by day and then by time within the day', () => {
    const feed = buildActivityFeed(db)
    const dates = feed.map((event) => event.date)
    expect([...dates]).toEqual([...dates].sort().reverse())

    const sameDay = feed.filter((event) => event.date === '2026-09-04').map((e) => e.title)
    // 20:00 log, then the 18:00 task completion, then the 08:00 log.
    expect(sameDay).toEqual(['Evening block', 'Middle task', 'Morning block'])
    expect(feed[feed.length - 1].title).toBe('Oldest task')
  })

  it('respects limit, kind and range filters', () => {
    expect(buildActivityFeed(db, { limit: 2 })).toHaveLength(2)

    const logsOnly = buildActivityFeed(db, { kinds: ['log'] })
    expect(logsOnly.every((event) => event.kind === 'log')).toBe(true)
    expect(logsOnly).toHaveLength(2)

    const narrow = buildActivityFeed(db, { from: '2026-09-03', to: '2026-09-04' })
    expect(narrow.every((event) => event.date >= '2026-09-03' && event.date <= '2026-09-04')).toBe(
      true,
    )
    expect(narrow.some((event) => event.title === 'Oldest task')).toBe(false)
  })

  it('links every event into the dashboard', () => {
    for (const event of buildActivityFeed(db)) {
      expect(event.href).toBeDefined()
      expect(event.href?.startsWith('/dashboard')).toBe(true)
    }
  })

  it('includes a completed goal on the day it was marked done', () => {
    const feed = buildActivityFeed(db, { kinds: ['goal-completed'] })
    expect(feed).toHaveLength(1)
    // The goal's week ended on 2026-09-06; it was ticked off on the 3rd.
    expect(feed[0].date).toBe('2026-09-03')
  })
})
