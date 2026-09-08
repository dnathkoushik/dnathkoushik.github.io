import { describe, expect, it } from 'vitest'
import type {
  Company,
  Contact,
  FitCriterion,
  ISODate,
  Opportunity,
  PersonalDatabase,
  Timestamp,
  Touch,
} from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { shiftDay, shiftWeek, weekKeyOf } from '@/utils/date'
import {
  STAGES,
  STAGE_META,
  daysToFirstReply,
  dueFollowUps,
  fitBreakdown,
  fitScore,
  funnel,
  isTerminal,
  lastTouch,
  outreachVelocity,
  pipelineSummary,
  rateByChannel,
  rateByTemplate,
  responseRate,
  staleOpportunities,
  suggestedFollowUpDate,
  touchEvents,
  weeklyProgress,
} from '@/utils/outreach'

/* -------------------------------------------------------------------------- *
 * Fixtures
 * -------------------------------------------------------------------------- */

const TODAY: ISODate = '2026-09-08'

/** A timestamp anchored to LOCAL noon on the day, so it converts back to the same date anywhere. */
function stamp(date: ISODate, hour = 12, minute = 0): Timestamp {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute).toISOString()
}

function company(id: string, overrides: Partial<Company> = {}): Company {
  return {
    id,
    name: id,
    kind: 'startup',
    remote: true,
    facts: [],
    fit: {},
    priority: 'medium',
    tags: [],
    archived: false,
    createdAt: stamp('2026-08-01'),
    updatedAt: stamp('2026-08-01'),
    ...overrides,
  }
}

function contact(id: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    name: id,
    warmth: 'cold',
    createdAt: stamp('2026-08-01'),
    updatedAt: stamp('2026-08-01'),
    ...overrides,
  }
}

function opportunity(id: string, overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id,
    companyId: 'acme',
    title: `Role ${id}`,
    type: 'internship',
    stage: 'contacted',
    source: 'cold',
    priority: 'medium',
    stageHistory: [],
    createdAt: stamp('2026-08-20'),
    updatedAt: stamp('2026-08-20'),
    ...overrides,
  }
}

function touch(
  id: string,
  date: ISODate,
  direction: Touch['direction'],
  overrides: Partial<Touch> = {},
): Touch {
  return {
    id,
    date,
    channel: 'email',
    direction,
    summary: `Touch ${id}`,
    createdAt: stamp(date, 10),
    ...overrides,
  }
}

function makeDb(overrides: Partial<PersonalDatabase> = {}): PersonalDatabase {
  return {
    version: 2,
    categories: [{ id: 'cat-career', label: 'Career', color: 5 }],
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
    companies: [company('acme', { name: 'Acme' })],
    contacts: [],
    opportunities: [],
    touches: [],
    templates: [],
    outreach: { weeklyTarget: 10, followUpDays: [4, 10], staleAfterDays: 10, fitCriteria: [] },
    ...overrides,
  }
}

const CRITERIA: FitCriterion[] = [
  { id: 'a', label: 'A', weight: 5 },
  { id: 'b', label: 'B', weight: 3 },
  { id: 'c', label: 'C', weight: 2 },
]

/* -------------------------------------------------------------------------- *
 * Tests
 * -------------------------------------------------------------------------- */

describe('stage metadata', () => {
  it('covers every stage in pipeline order with matching terminal flags', () => {
    expect(STAGES).toHaveLength(11)
    expect(STAGES[0]).toBe('researching')
    expect(STAGES.map((stage) => STAGE_META[stage].order)).toEqual([...STAGES.keys()])
    expect(STAGES.filter(isTerminal)).toEqual(['accepted', 'rejected', 'ghosted', 'withdrawn'])
  })
})

describe('fitScore', () => {
  it('is 0 with no criteria', () => {
    expect(fitScore(company('x', { fit: { a: 2 } }), [])).toBe(0)
  })

  it('is 100 when every criterion is a yes', () => {
    expect(fitScore(company('x', { fit: { a: 2, b: 2, c: 2 } }), CRITERIA)).toBe(100)
  })

  it('weights partial and missing values', () => {
    // (5×2 + 3×1 + 2×0) / (10 × 2) = 13/20
    const scored = company('x', { fit: { a: 2, b: 1 } })
    expect(fitScore(scored, CRITERIA)).toBe(65)

    const rows = fitBreakdown(scored, CRITERIA)
    expect(rows).toHaveLength(3)
    expect(rows[2]).toMatchObject({ value: 0, points: 0, max: 4 })
    expect(rows[0]).toMatchObject({ value: 2, points: 10, max: 10 })
  })
})

describe('responseRate', () => {
  const db = makeDb({
    touches: [
      touch('o1', '2026-09-01', 'outbound', { opportunityId: 'A', outcome: 'replied' }),
      touch('o2', '2026-09-02', 'outbound', { opportunityId: 'B', channel: 'linkedin' }),
      touch('i2', '2026-09-04', 'inbound', { opportunityId: 'B' }),
      touch('i3', '2026-09-01', 'inbound', { opportunityId: 'C' }),
      touch('o3', '2026-09-03', 'outbound', { opportunityId: 'C' }),
      touch('o4', '2026-09-03', 'outbound', { contactId: 'X' }),
      touch('i4', '2026-09-05', 'inbound', { contactId: 'X' }),
      touch('o5', '2026-09-05', 'outbound', { opportunityId: 'D', outcome: 'no-reply' }),
    ],
  })

  it('counts outcome-based and later-inbound replies, but not earlier inbound', () => {
    const rate = responseRate(db.touches, db.touches)
    expect(rate).toEqual({ sent: 5, replied: 3, rate: 60 })
  })

  it('looks up replies in allTouches even for a filtered slice', () => {
    const o2 = db.touches.filter((t) => t.id === 'o2')
    expect(responseRate(o2, db.touches)).toEqual({ sent: 1, replied: 1, rate: 100 })
    expect(responseRate(o2, o2)).toEqual({ sent: 1, replied: 0, rate: 0 })
  })

  it('groups by channel, omitting channels never used outbound', () => {
    const rows = rateByChannel(db)
    expect(rows.map((row) => row.channel)).toEqual(['email', 'linkedin'])
    expect(rows[1]).toMatchObject({ sent: 1, replied: 1, rate: 100 })
  })
})

describe('rateByTemplate', () => {
  it('names deleted templates and sorts most-used first', () => {
    const db = makeDb({
      templates: [
        {
          id: 'tpl-1',
          name: 'Cold',
          channel: 'email',
          purpose: 'cold',
          body: 'x',
          archived: false,
          createdAt: stamp('2026-08-01'),
          updatedAt: stamp('2026-08-01'),
        },
      ],
      touches: [
        touch('a', '2026-09-01', 'outbound', { templateId: 'tpl-gone' }),
        touch('b', '2026-09-01', 'outbound', { templateId: 'tpl-1', outcome: 'positive' }),
        touch('c', '2026-09-02', 'outbound', { templateId: 'tpl-1' }),
        touch('d', '2026-09-02', 'outbound'),
      ],
    })
    const rows = rateByTemplate(db)
    expect(rows.map((row) => row.name)).toEqual(['Cold', '(deleted template)'])
    expect(rows[0]).toMatchObject({ templateId: 'tpl-1', sent: 2, replied: 1, rate: 50 })
  })
})

describe('dueFollowUps', () => {
  it('buckets around today and the 7-day horizon, sorted by due then priority', () => {
    const db = makeDb({
      opportunities: [
        opportunity('late-low', { nextActionDue: '2026-09-05', priority: 'low' }),
        opportunity('late-high', { nextActionDue: '2026-09-05', priority: 'high' }),
        opportunity('today', { nextActionDue: TODAY }),
        opportunity('soon', { nextActionDue: '2026-09-12' }),
        opportunity('edge', { nextActionDue: shiftDay(TODAY, 7) }),
        opportunity('beyond', { nextActionDue: shiftDay(TODAY, 8) }),
        opportunity('closed', { nextActionDue: TODAY, stage: 'rejected' }),
        opportunity('undated'),
      ],
    })
    const due = dueFollowUps(db, TODAY)
    expect(due.overdue.map((o) => o.id)).toEqual(['late-high', 'late-low'])
    expect(due.today.map((o) => o.id)).toEqual(['today'])
    expect(due.upcoming.map((o) => o.id)).toEqual(['soon', 'edge'])
  })
})

describe('staleOpportunities', () => {
  it('flags untouched-for-long and never-touched opportunities, stalest first', () => {
    const db = makeDb({
      opportunities: [
        opportunity('A'),
        opportunity('B'),
        opportunity('C', { createdAt: stamp(shiftDay(TODAY, -15)) }),
        opportunity('D', { stage: 'researching', createdAt: stamp('2026-01-01') }),
        opportunity('E', { stage: 'ghosted', createdAt: stamp('2026-01-01') }),
      ],
      touches: [
        touch('ta', shiftDay(TODAY, -12), 'outbound', { opportunityId: 'A' }),
        touch('tb', shiftDay(TODAY, -3), 'outbound', { opportunityId: 'B' }),
      ],
    })
    const stale = staleOpportunities(db, TODAY, 10)
    expect(stale.map((row) => row.opportunity.id)).toEqual(['C', 'A'])
    expect(stale.map((row) => row.daysSinceTouch)).toEqual([15, 12])
  })
})

describe('suggestedFollowUpDate', () => {
  it('walks the schedule then stops', () => {
    expect(suggestedFollowUpDate('2026-09-01', [4, 10], 0)).toBe('2026-09-05')
    expect(suggestedFollowUpDate('2026-09-01', [4, 10], 1)).toBe('2026-09-11')
    expect(suggestedFollowUpDate('2026-09-01', [4, 10], 2)).toBeNull()
    expect(suggestedFollowUpDate('2026-09-01', [], 0)).toBeNull()
  })
})

describe('funnel and summary', () => {
  const db = makeDb({
    opportunities: [
      opportunity('a', { stage: 'contacted', nextActionDue: shiftDay(TODAY, -1) }),
      opportunity('b', { stage: 'interviewing', nextActionDue: TODAY }),
      opportunity('c', { stage: 'offer' }),
      opportunity('d', { stage: 'rejected' }),
    ],
    touches: [
      touch('t1', shiftDay(TODAY, -1), 'outbound', { opportunityId: 'a', outcome: 'replied' }),
      touch('t2', shiftDay(TODAY, -1), 'outbound', { opportunityId: 'b' }),
      touch('t3', shiftDay(TODAY, -1), 'outbound', { opportunityId: 'c' }),
    ],
  })

  it('emits every stage in order with counts', () => {
    const steps = funnel(db)
    expect(steps.map((step) => step.stage)).toEqual(STAGES)
    expect(steps.find((step) => step.stage === 'contacted')?.count).toBe(1)
    expect(steps.find((step) => step.stage === 'researching')?.count).toBe(0)
  })

  it('summarises the pipeline', () => {
    expect(pipelineSummary(db, TODAY)).toEqual({
      open: 3,
      offers: 1,
      interviewing: 1,
      replyRate: 33,
      dueToday: 1,
      overdue: 1,
      stale: 0,
    })
  })
})

describe('velocity and weekly progress', () => {
  const thisWeek = weekKeyOf(TODAY, 1)
  const db = makeDb({
    touches: [
      touch('w0a', '2026-09-07', 'outbound', { opportunityId: 'A' }),
      touch('w0b', TODAY, 'outbound', { opportunityId: 'B' }),
      touch('w0c', TODAY, 'inbound', { opportunityId: 'E' }),
      touch('w1a', '2026-08-31', 'outbound', { opportunityId: 'C' }),
      touch('w1b', '2026-09-02', 'inbound', { opportunityId: 'C' }),
      touch('w2a', '2026-08-25', 'outbound', { opportunityId: 'D' }),
      touch('old', '2026-07-01', 'outbound'),
    ],
  })

  it('buckets touches per week, oldest first, separating replies from unsolicited inbound', () => {
    const points = outreachVelocity(db, thisWeek, 3, 1)
    expect(points.map((p) => p.weekKey)).toEqual([
      shiftWeek(thisWeek, -2, 1),
      shiftWeek(thisWeek, -1, 1),
      thisWeek,
    ])
    expect(points.map((p) => [p.outbound, p.inbound, p.replies])).toEqual([
      [1, 0, 0],
      [1, 1, 1],
      [2, 1, 0],
    ])
    expect(points[2].label).toBe('7 – 13 Sep')
  })

  it('measures outbound against the weekly target', () => {
    expect(weeklyProgress(db, thisWeek, 1)).toEqual({ target: 10, outbound: 2, pct: 20 })
  })
})

describe('daysToFirstReply', () => {
  it('averages first-outbound to first-inbound per opportunity', () => {
    const db = makeDb({
      touches: [
        touch('a1', '2026-09-01', 'outbound', { opportunityId: 'A' }),
        touch('a2', '2026-09-03', 'inbound', { opportunityId: 'A' }),
        touch('a3', '2026-09-06', 'inbound', { opportunityId: 'A' }),
        touch('b1', '2026-09-01', 'outbound', { opportunityId: 'B' }),
        touch('b2', '2026-09-05', 'inbound', { opportunityId: 'B' }),
        touch('c1', '2026-09-01', 'outbound', { opportunityId: 'C' }),
      ],
    })
    expect(daysToFirstReply(db)).toEqual({ avg: 3, median: 3, n: 2 })
    expect(daysToFirstReply(makeDb())).toEqual({ avg: null, median: null, n: 0 })
  })
})

describe('lastTouch and touchEvents', () => {
  const db = makeDb({
    contacts: [contact('jane', { name: 'Jane Doe', companyId: 'acme' })],
    opportunities: [opportunity('A', { companyId: 'acme' })],
    touches: [
      touch('t1', '2026-09-01', 'outbound', { opportunityId: 'A', contactId: 'jane' }),
      touch('t2', '2026-09-03', 'inbound', { opportunityId: 'A', contactId: 'jane', time: '09:30' }),
      touch('t3', '2026-09-03', 'outbound', { opportunityId: 'A', contactId: 'jane', time: '18:00' }),
    ],
  })

  it('finds the newest touch by date then time, resolving a company through its opportunity', () => {
    expect(lastTouch(db, { opportunityId: 'A' })?.id).toBe('t3')
    expect(lastTouch(db, { companyId: 'acme' })?.id).toBe('t3')
    expect(lastTouch(db, { contactId: 'nobody' })).toBeUndefined()
  })

  it('emits touch events newest first with a route to the activity page', () => {
    const events = touchEvents(db, { limit: 2 })
    expect(events.map((event) => event.id)).toEqual(['touch:t3', 'touch:t2'])
    expect(events[0]).toMatchObject({
      kind: 'touch',
      date: '2026-09-03',
      title: 'Email to Jane Doe · Acme',
      categoryId: 'cat-career',
      href: PERSONAL_ROUTES.outreachActivity,
    })
    expect(events[1].title).toBe('Email from Jane Doe · Acme')
  })
})
