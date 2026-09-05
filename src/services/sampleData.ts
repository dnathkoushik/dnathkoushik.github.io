/**
 * The demo dataset a first-time visitor lands in.
 *
 * An empty dashboard cannot show what a dashboard is for — streaks, trends and
 * a heatmap all need history — so the first run seeds eight weeks of it. The
 * user clears it in one click from Settings, and `settings.seedDataCleared`
 * records that they did.
 *
 * Two rules govern everything below.
 *
 * DETERMINISM. `Math.random` is never called. A mulberry32 PRNG seeded with a
 * constant means the same `today` always produces byte-identical data, so a
 * screenshot, a test and a support question all describe the same dashboard.
 *
 * HONESTY. This is placeholder *activity*, never placeholder *credentials*.
 * Every entry is an ordinary piece of work — "Solve 2 array problems",
 * "Refactor auth middleware". There are no ranks, no company names, no contest
 * results and no certifications, because seeded data must never be mistaken for
 * a record of what the owner of this site actually did. The history is also
 * deliberately imperfect: missed days, a broken streak, skipped tasks and a
 * weak week. A wall of perfect green would be a lie about how work goes.
 */
import { createEmptyDatabase, DEFAULT_SETTINGS } from '@/services/defaults'
import { weekKeyOf } from '@/utils/date'
import type {
  DayMeta,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MonthlyGoal,
  Note,
  PersonalDatabase,
  Priority,
  Task,
  TaskStatus,
  WeekKey,
  WeeklyGoal,
  WeeklyReview,
} from '@/types'

/** Change this and every seeded dashboard changes with it. */
const SEED = 20_260_514
const SAMPLE_DAYS = 56

/* -------------------------------------------------------------------------- *
 * Deterministic randomness
 * -------------------------------------------------------------------------- */

type Random = () => number

function mulberry32(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

function randInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1))
}

function pick<T>(random: Random, items: readonly T[]): T {
  return items[Math.floor(random() * items.length) % items.length]
}

function chance(random: Random, probability: number): boolean {
  return random() < probability
}

/* -------------------------------------------------------------------------- *
 * Local date helpers
 *
 * Deliberately self-contained: seeding must not depend on the exact signature
 * of the shared date utilities. `weekKeyOf` is the one exception, because week
 * keys written here have to match the keys the app computes when it reads them
 * back.
 * -------------------------------------------------------------------------- */

function parseDay(date: ISODate): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDay(date: Date): ISODate {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: ISODate, delta: number): ISODate {
  const parsed = parseDay(date)
  parsed.setDate(parsed.getDate() + delta)
  return formatDay(parsed)
}

/** A true instant for `date` at local `hour:minute`. */
function stampAt(date: ISODate, hour: number, minute: number): string {
  const parsed = parseDay(date)
  parsed.setHours(hour, minute, 0, 0)
  return parsed.toISOString()
}

function monthOf(date: ISODate): string {
  return date.slice(0, 7)
}

function shiftMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const shifted = new Date(year, month - 1 + delta, 1)
  return `${shifted.getFullYear()}-${`${shifted.getMonth() + 1}`.padStart(2, '0')}`
}

function endOfMonth(monthKey: string): ISODate {
  const [year, month] = monthKey.split('-').map(Number)
  return formatDay(new Date(year, month, 0))
}

function weekdayOf(date: ISODate): number {
  return parseDay(date).getDay()
}

/* -------------------------------------------------------------------------- *
 * Content pools — ordinary work, nothing that reads as an achievement
 * -------------------------------------------------------------------------- */

interface CategoryPlan {
  id: string
  weight: number
  tasks: readonly string[]
  logs: readonly string[]
}

const CATEGORY_PLANS: readonly CategoryPlan[] = [
  {
    id: 'cat-dsa',
    weight: 28,
    tasks: [
      'Solve 2 array problems',
      'Revise binary search patterns',
      'Practice a sliding window set',
      'Solve one graph traversal problem',
      'Redo the DP problem without hints',
      'Review yesterday’s wrong submissions',
      'Timed practice set, 60 minutes',
      'Write notes on heap problems',
    ],
    logs: [
      'Array and two-pointer practice',
      'Graph problems on paper first',
      'Debugged a failing DP submission',
      'Timed practice set',
      'Reviewed editorial for a hard problem',
    ],
  },
  {
    id: 'cat-dev',
    weight: 24,
    tasks: [
      'Refactor auth middleware',
      'Fix the flaky signup test',
      'Write unit tests for the parser',
      'Ship the pagination fix',
      'Add loading states to the settings page',
      'Clean up dead code in the API layer',
      'Review open pull requests',
      'Split the giant component file',
    ],
    logs: [
      'Refactored the auth middleware',
      'Chased down a flaky test',
      'Wrote tests for the parser',
      'Paired on the pagination bug',
      'Cleaned up API error handling',
    ],
  },
  {
    id: 'cat-system-design',
    weight: 10,
    tasks: [
      'Sketch a rate limiter design',
      'Read one chapter of the design primer',
      'Write notes on caching strategies',
      'Compare SQL and document store trade-offs',
      'Draw the read path for the feed service',
    ],
    logs: [
      'Read about consistent hashing',
      'Sketched a rate limiter on the whiteboard',
      'Notes on cache invalidation',
      'Watched a design walkthrough',
    ],
  },
  {
    id: 'cat-learning',
    weight: 13,
    tasks: [
      'Watch one operating systems lecture',
      'Read 20 pages of the networking book',
      'Take notes on database indexing',
      'Finish the TypeScript generics exercises',
      'Work through the concurrency chapter',
    ],
    logs: [
      'OS lecture on scheduling',
      'Networking book, TCP chapter',
      'Notes on B-trees and indexing',
      'TypeScript generics exercises',
    ],
  },
  {
    id: 'cat-career',
    weight: 8,
    tasks: [
      'Update resume bullet points',
      'Write a short project write-up',
      'Prepare answers for behavioural questions',
      'Tidy the portfolio project list',
      'Send two follow-up emails',
    ],
    logs: [
      'Rewrote two resume bullets',
      'Drafted a project write-up',
      'Practised behavioural answers out loud',
    ],
  },
  {
    id: 'cat-health',
    weight: 9,
    tasks: [
      'Morning run, 3 km',
      'Gym session',
      'Stretch and mobility, 15 minutes',
      'Walk after dinner',
      'Sleep before midnight',
    ],
    logs: ['Morning run', 'Gym session', 'Long walk', 'Stretching and mobility'],
  },
  {
    id: 'cat-personal',
    weight: 6,
    tasks: [
      'Journal for 10 minutes',
      'Call home',
      'Plan tomorrow before bed',
      'Read fiction for 30 minutes',
    ],
    logs: ['Journalling', 'Read a few chapters', 'Called home', 'Planned the next day'],
  },
  {
    id: 'cat-admin',
    weight: 2,
    tasks: ['Clear the inbox', 'Back up the laptop', 'Tidy the desk and desktop'],
    logs: ['Inbox and admin', 'Backed up the laptop'],
  },
]

const TOTAL_WEIGHT = CATEGORY_PLANS.reduce((sum, plan) => sum + plan.weight, 0)

function pickPlan(random: Random): CategoryPlan {
  let ticket = random() * TOTAL_WEIGHT
  for (const plan of CATEGORY_PLANS) {
    ticket -= plan.weight
    if (ticket <= 0) return plan
  }
  return CATEGORY_PLANS[0]
}

const OBJECTIVES: readonly string[] = [
  'Two DSA problems before anything else',
  'Ship the pagination fix and write the tests',
  'Finish the graph module, no new tabs',
  'One deep block on system design, then rest',
  'Clear the review queue and go outside',
  'Slow day on purpose — read and take notes',
  'Close out the auth refactor',
  'Practice set in the morning, portfolio in the evening',
  'Catch up on the reading backlog',
  'Fix the flaky test before touching anything new',
]

const HIGHLIGHTS: readonly string[] = [
  'Finally understood why the DP recurrence works',
  'Auth refactor is smaller than the code it replaced',
  'Solved the graph problem without looking anything up',
  'Two hours of uninterrupted focus in the morning',
  'Wrote the test first for once',
]

const ESTIMATES: readonly number[] = [20, 30, 45, 60, 90]
const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']

/* -------------------------------------------------------------------------- *
 * Builder
 * -------------------------------------------------------------------------- */

export function buildSampleDatabase(today: ISODate): PersonalDatabase {
  const random = mulberry32(SEED)
  const base = createEmptyDatabase()
  const settings = { ...DEFAULT_SETTINGS, seedDataCleared: false }
  const weekStartsOn = settings.weekStartsOn

  const days: ISODate[] = []
  for (let offset = SAMPLE_DAYS - 1; offset >= 0; offset -= 1) {
    days.push(addDays(today, -offset))
  }

  /** Days with no activity at all: holidays, travel, burnout. */
  const restDays = new Set<ISODate>([days[6], days[17], days[18], days[33], days[44]])
  /** One visibly weaker stretch so the trend line is not a straight climb. */
  const slumpStart = 24
  const slumpEnd = 30

  const tasks: Task[] = []
  const logs: LogEntry[] = []
  const dayMetas: DayMeta[] = []

  let taskSeq = 0
  let logSeq = 0

  days.forEach((date, index) => {
    const isToday = index === days.length - 1
    const weekday = weekdayOf(date)
    const isWeekend = weekday === 0 || weekday === 6
    const inSlump = index >= slumpStart && index <= slumpEnd

    if (restDays.has(date)) {
      // Nothing logged, and no objective either — a genuinely blank day.
      return
    }

    let completionRate = isWeekend ? 0.52 : 0.78
    if (inSlump) completionRate -= 0.26
    // The most recent fortnight is the strongest, which is what a real
    // "I built a dashboard and started using it" run looks like.
    if (index > SAMPLE_DAYS - 14) completionRate += 0.08

    const taskCount = isWeekend ? randInt(random, 2, 3) : randInt(random, 4, 6)
    let hour = isWeekend ? 10 : 8

    for (let position = 0; position < taskCount; position += 1) {
      const plan = pickPlan(random)
      const title = pick(random, plan.tasks)
      const estimatedMinutes = pick(random, ESTIMATES)
      const createdAt = stampAt(date, isWeekend ? 9 : 7, 45)

      let status: TaskStatus
      if (isToday) {
        // Today is mid-flight: some done, one running, the rest waiting.
        if (position === 0) status = 'completed'
        else if (position === 1) status = 'in-progress'
        else if (position === 2 && chance(random, 0.5)) status = 'completed'
        else status = 'not-started'
      } else if (chance(random, completionRate)) {
        status = 'completed'
      } else if (chance(random, 0.35)) {
        status = 'skipped'
      } else {
        status = 'not-started'
      }

      const startHour = Math.min(hour, 22)
      const startedAt =
        status === 'not-started' ? undefined : stampAt(date, startHour, randInt(random, 0, 45))
      const actualMinutes =
        status === 'completed'
          ? Math.max(10, estimatedMinutes + randInt(random, -15, 25))
          : undefined
      const completedAt =
        status === 'completed'
          ? stampAt(date, Math.min(startHour + 1, 23), randInt(random, 0, 50))
          : undefined

      taskSeq += 1
      tasks.push({
        id: `sample-task-${`${taskSeq}`.padStart(4, '0')}`,
        date,
        title,
        description:
          position === 0 && !isWeekend ? 'First block of the day, before email.' : undefined,
        categoryId: plan.id,
        priority: position === 0 ? 'high' : pick(random, PRIORITIES),
        status,
        estimatedMinutes,
        actualMinutes,
        startedAt,
        completedAt,
        notes:
          status === 'skipped' && chance(random, 0.4)
            ? 'Ran out of time — moved to tomorrow.'
            : undefined,
        order: position + 1,
        createdAt,
        updatedAt: completedAt ?? startedAt ?? createdAt,
      })

      hour += randInt(random, 1, 3)
    }

    // Work log: fewer entries than tasks, because nobody logs everything.
    const logCount = isWeekend ? randInt(random, 1, 2) : randInt(random, 2, 4)
    let logHour = isWeekend ? 11 : 9
    for (let entry = 0; entry < logCount; entry += 1) {
      const plan = pickPlan(random)
      logSeq += 1
      logs.push({
        id: `sample-log-${`${logSeq}`.padStart(4, '0')}`,
        date,
        time: `${`${Math.min(logHour, 23)}`.padStart(2, '0')}:${randInt(random, 0, 1) === 0 ? '00' : '30'}`,
        activity: pick(random, plan.logs),
        categoryId: plan.id,
        durationMinutes: pick(random, [25, 30, 45, 50, 60, 75, 90, 120]),
        notes: chance(random, 0.18) ? 'Focus was good until the last twenty minutes.' : undefined,
        createdAt: stampAt(date, Math.min(logHour, 23), 5),
        updatedAt: stampAt(date, Math.min(logHour, 23), 5),
      })
      logHour += randInt(random, 2, 4)
    }

    if (chance(random, 0.72)) {
      dayMetas.push({
        id: date,
        date,
        objective: pick(random, OBJECTIVES),
        mood: inSlump ? randInt(random, 2, 3) : randInt(random, 3, 5),
        energy: inSlump ? randInt(random, 2, 3) : randInt(random, 3, 5),
        highlight: chance(random, 0.22) ? pick(random, HIGHLIGHTS) : undefined,
        updatedAt: stampAt(date, 22, 10),
      })
    }
  })

  /* -- habits ------------------------------------------------------------ */

  const habitPlans: readonly (Omit<Habit, 'createdAt'> & { adherence: number })[] = [
    {
      id: 'sample-habit-dsa',
      name: 'Solve DSA problems',
      categoryId: 'cat-dsa',
      color: 1,
      targetPerWeek: 6,
      dailyTarget: 2,
      unit: 'problems',
      order: 1,
      archived: false,
      adherence: 0.82,
    },
    {
      id: 'sample-habit-ship',
      name: 'Commit something every day',
      categoryId: 'cat-dev',
      color: 2,
      targetPerWeek: 5,
      dailyTarget: 1,
      unit: 'commit',
      order: 2,
      archived: false,
      adherence: 0.68,
    },
    {
      id: 'sample-habit-read',
      name: 'Read 20 pages',
      categoryId: 'cat-learning',
      color: 4,
      targetPerWeek: 5,
      dailyTarget: 20,
      unit: 'pages',
      order: 3,
      archived: false,
      adherence: 0.55,
    },
    {
      id: 'sample-habit-move',
      name: 'Move for 30 minutes',
      categoryId: 'cat-health',
      color: 6,
      targetPerWeek: 5,
      dailyTarget: 30,
      unit: 'minutes',
      order: 4,
      archived: false,
      adherence: 0.7,
    },
    {
      id: 'sample-habit-sleep',
      name: 'Sleep before midnight',
      categoryId: 'cat-personal',
      color: 7,
      targetPerWeek: 7,
      dailyTarget: 1,
      unit: undefined,
      order: 5,
      archived: false,
      adherence: 0.6,
    },
  ]

  const habits: Habit[] = habitPlans.map(({ adherence: _adherence, ...habit }) => ({
    ...habit,
    createdAt: stampAt(days[0], 8, 0),
  }))

  const habitEntries: HabitEntry[] = []
  for (const plan of habitPlans) {
    days.forEach((date, index) => {
      if (restDays.has(date)) return
      // A deliberate five-day hole: the DSA streak breaks and has to restart.
      const brokenStreak = plan.id === 'sample-habit-dsa' && index >= 26 && index <= 30
      // Some days were simply never recorded, which is not the same as a zero.
      if (!brokenStreak && chance(random, 0.08)) return

      const inSlump = index >= slumpStart && index <= slumpEnd
      const done = brokenStreak
        ? false
        : chance(random, inSlump ? plan.adherence - 0.25 : plan.adherence)

      let value = 0
      if (done) {
        value = chance(random, 0.78)
          ? plan.dailyTarget
          : Math.max(1, Math.round(plan.dailyTarget * 0.6))
      }

      habitEntries.push({
        id: `${plan.id}::${date}`,
        habitId: plan.id,
        date,
        value,
        note: brokenStreak && index === 26 ? 'Travelling this week.' : undefined,
        updatedAt: stampAt(date, 22, 30),
      })
    })
  }

  /* -- goals ------------------------------------------------------------- */

  const weekKeys: WeekKey[] = []
  for (const date of days) {
    const key = weekKeyOf(date, weekStartsOn)
    if (!weekKeys.includes(key)) weekKeys.push(key)
  }
  const recentWeeks = weekKeys.slice(-6)
  const currentWeek = recentWeeks[recentWeeks.length - 1]

  const weeklyGoalPlans: readonly { title: string; categoryId: string; target: number; unit: string }[] =
    [
      { title: 'Solve 12 problems', categoryId: 'cat-dsa', target: 12, unit: 'problems' },
      { title: 'Ship one feature end to end', categoryId: 'cat-dev', target: 1, unit: 'feature' },
      { title: 'Read two chapters', categoryId: 'cat-learning', target: 2, unit: 'chapters' },
      { title: 'Three gym sessions', categoryId: 'cat-health', target: 3, unit: 'sessions' },
      { title: 'Write one design note', categoryId: 'cat-system-design', target: 1, unit: 'note' },
      { title: 'Apply to two internships', categoryId: 'cat-career', target: 2, unit: 'applications' },
    ]

  const weeklyGoals: WeeklyGoal[] = []
  recentWeeks.forEach((week, weekIndex) => {
    const isCurrent = week === currentWeek
    const count = randInt(random, 2, 3)
    for (let slot = 0; slot < count; slot += 1) {
      const plan = weeklyGoalPlans[(weekIndex * 3 + slot) % weeklyGoalPlans.length]
      const hit = isCurrent ? false : chance(random, 0.62)
      const currentValue = hit
        ? plan.target
        : randInt(random, 0, Math.max(0, plan.target - (isCurrent ? 0 : 1)))
      const createdAt = stampAt(days[Math.max(0, days.length - (6 - weekIndex) * 7)], 9, 0)
      weeklyGoals.push({
        id: `sample-wgoal-${weekIndex + 1}-${slot + 1}`,
        weekKey: week,
        title: plan.title,
        description: undefined,
        categoryId: plan.categoryId,
        priority: slot === 0 ? 'high' : 'medium',
        targetValue: plan.target,
        currentValue: Math.min(currentValue, plan.target),
        unit: plan.unit,
        deadline: undefined,
        status: isCurrent ? 'active' : hit ? 'completed' : 'missed',
        createdAt,
        updatedAt: createdAt,
      })
    }
  })

  const thisMonth = monthOf(today)
  const lastMonth = shiftMonths(thisMonth, -1)

  const monthlyGoalPlans: readonly {
    title: string
    categoryId: string
    target: number
    unit: string
  }[] = [
    { title: 'Solve 60 problems', categoryId: 'cat-dsa', target: 60, unit: 'problems' },
    { title: 'Finish the portfolio rebuild', categoryId: 'cat-dev', target: 1, unit: 'project' },
    { title: 'Read one technical book', categoryId: 'cat-learning', target: 1, unit: 'book' },
    { title: 'Write four design notes', categoryId: 'cat-system-design', target: 4, unit: 'notes' },
    { title: 'Twelve workouts', categoryId: 'cat-health', target: 12, unit: 'sessions' },
    { title: 'Six internship applications', categoryId: 'cat-career', target: 6, unit: 'applications' },
  ]

  const monthlyGoals: MonthlyGoal[] = []
  ;[lastMonth, thisMonth].forEach((monthKey, monthIndex) => {
    const isCurrent = monthKey === thisMonth
    for (let slot = 0; slot < 3; slot += 1) {
      const plan = monthlyGoalPlans[(monthIndex * 3 + slot) % monthlyGoalPlans.length]
      const hit = isCurrent ? false : chance(random, 0.6)
      const currentValue = hit
        ? plan.target
        : Math.round(plan.target * (isCurrent ? 0.35 + random() * 0.4 : random() * 0.8))
      const createdAt = stampAt(`${monthKey}-01`, 9, 0)
      monthlyGoals.push({
        id: `sample-mgoal-${monthIndex + 1}-${slot + 1}`,
        monthKey,
        title: plan.title,
        description: undefined,
        categoryId: plan.categoryId,
        priority: slot === 0 ? 'high' : 'medium',
        targetValue: plan.target,
        currentValue: Math.min(Math.max(currentValue, 0), plan.target),
        unit: plan.unit,
        deadline: endOfMonth(monthKey),
        status: isCurrent ? 'active' : hit ? 'completed' : 'missed',
        createdAt,
        updatedAt: createdAt,
      })
    }
  })

  /* -- reviews ----------------------------------------------------------- */

  const reviewSources: readonly Omit<WeeklyReview, 'id' | 'weekKey' | 'updatedAt'>[] = [
    {
      wentWell: 'Kept the morning block for DSA four days out of five. The auth refactor finally landed and is smaller than what it replaced.',
      wentWrong: 'Lost most of Thursday to a flaky test I should have quarantined instead of chasing.',
      learned: 'Writing the failing test first turned a two-hour debug into twenty minutes.',
      improve: 'Timebox debugging to 45 minutes, then write it down and move on.',
      biggestAchievement: 'Shipped the pagination fix end to end, tests included.',
      biggestMistake: 'Started three things on Wednesday and finished none of them.',
      nextWeekFocus: 'Graph problems, and the settings page redesign.',
      rating: 4,
    },
    {
      wentWell: 'Reading habit held all week. Notes on indexing are actually usable now.',
      wentWrong: 'Slept late four nights, and every one of those mornings was wasted.',
      learned: 'Energy is the constraint, not time. Sleep is the highest-leverage habit here.',
      improve: 'Laptop closed by 23:00, no exceptions.',
      biggestAchievement: 'Explained B-trees to someone else without looking anything up.',
      biggestMistake: 'Skipped the weekly review last Sunday, so this week started blind.',
      nextWeekFocus: 'Sleep schedule first, then the system design chapter.',
      rating: 3,
    },
    {
      wentWell: 'Not much. Travel ate three days and I did not plan around it.',
      wentWrong: 'The DSA streak broke at nineteen days and that took the wind out of the week.',
      learned: 'A streak is a signal, not the goal. Restarting on the same day it breaks matters more than the number.',
      improve: 'Set a smaller target for weeks with travel instead of pretending the schedule is normal.',
      biggestAchievement: 'Restarted the day after getting back rather than writing the week off.',
      biggestMistake: 'Deleted nothing from the plan when the week clearly changed.',
      nextWeekFocus: 'Rebuild the streak, keep goals modest.',
      rating: 2,
    },
    {
      wentWell: 'Best week in a month. Every weekday had one deep block before anything else.',
      wentWrong: 'Reviews of open pull requests kept slipping to the evening.',
      learned: 'Two 90-minute blocks beat six scattered half hours, by a wide margin.',
      improve: 'Batch code review into one slot right after lunch.',
      biggestAchievement: 'Finished the graph module and wrote it up properly.',
      biggestMistake: 'Said yes to a side task on Friday that cost the whole afternoon.',
      nextWeekFocus: 'Hold the morning block, start the dashboard analytics work.',
      rating: 5,
    },
  ]

  const reviewWeeks = recentWeeks.slice(0, -1).slice(-4)
  const reviews: WeeklyReview[] = reviewWeeks.map((week, index) => ({
    ...reviewSources[index % reviewSources.length],
    id: week,
    weekKey: week,
    updatedAt: stampAt(days[Math.max(0, days.length - (reviewWeeks.length - index) * 7)], 20, 0),
  }))

  /* -- notes ------------------------------------------------------------- */

  const notePlans: readonly { offset: number; title: string; body: string; tags: string[]; pinned: boolean }[] =
    [
      {
        offset: 2,
        title: 'Sliding window checklist',
        body: 'Expand right until the window is invalid, shrink from the left until it is valid again, record the answer at every valid state. Almost every variant is that loop plus a different validity test.',
        tags: ['dsa', 'patterns'],
        pinned: true,
      },
      {
        offset: 9,
        title: 'Why the auth refactor got smaller',
        body: 'Three middlewares were each re-parsing the token. Parsing once at the edge and passing the claims down removed two files and every one of the "is the user loaded yet" checks.',
        tags: ['development', 'refactor'],
        pinned: false,
      },
      {
        offset: 15,
        title: 'Cache invalidation notes',
        body: 'Write-through is simpler to reason about than write-back when reads dominate. TTL alone is fine until a stale read is expensive; then it needs an explicit bust on write.',
        tags: ['system-design'],
        pinned: false,
      },
      {
        offset: 21,
        title: 'Interview prep: things I keep forgetting',
        body: 'Say the brute force out loud before optimising. State the complexity before writing code. Ask about input size first — it decides the whole approach.',
        tags: ['career', 'interview'],
        pinned: true,
      },
      {
        offset: 30,
        title: 'What broke the streak',
        body: 'Travel week with no plan. The fix is not more discipline, it is a smaller target for weeks that are already full.',
        tags: ['reflection'],
        pinned: false,
      },
      {
        offset: 38,
        title: 'Indexing, in one paragraph',
        body: 'A B-tree index makes range scans cheap because the leaves are ordered and linked. A hash index does not, which is why it loses on anything but equality.',
        tags: ['learning', 'databases'],
        pinned: false,
      },
      {
        offset: 47,
        title: 'Dashboard ideas worth keeping',
        body: 'The number that matters is not tasks completed, it is whether the first block of the day happened. Everything else follows from that one.',
        tags: ['product', 'reflection'],
        pinned: false,
      },
    ]

  const notes: Note[] = notePlans.map((plan, index) => {
    const date = days[Math.max(0, days.length - 1 - plan.offset)]
    return {
      id: `sample-note-${index + 1}`,
      date,
      title: plan.title,
      body: plan.body,
      tags: plan.tags,
      pinned: plan.pinned,
      createdAt: stampAt(date, 21, 15),
      updatedAt: stampAt(date, 21, 15),
    }
  })

  return {
    ...base,
    tasks,
    logs,
    weeklyGoals,
    monthlyGoals,
    habits,
    habitEntries,
    reviews,
    notes,
    days: dayMetas,
    settings,
  }
}
