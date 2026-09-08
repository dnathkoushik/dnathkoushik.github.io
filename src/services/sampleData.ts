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
 * "Refactor auth middleware". There are no ranks, no contest results and no
 * certifications, because seeded data must never be mistaken for a record of
 * what the owner of this site actually did. The outreach slice is the one
 * place company and people names appear, and every one of them is invented:
 * Northwind Labs, Quillfeather and the rest exist nowhere, the people at them
 * are fictional, and every source link points at example.com. The history is
 * also deliberately imperfect: missed days, a broken streak, skipped tasks, a
 * weak week, cold emails that went nowhere and a rejection. A wall of perfect
 * green would be a lie about how work goes.
 */
import { createEmptyDatabase, DEFAULT_FIT_CRITERIA, DEFAULT_SETTINGS } from '@/services/defaults'
import { weekKeyOf } from '@/utils/date'
import type {
  Company,
  CompanyFact,
  Contact,
  DayMeta,
  FitValue,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MonthlyGoal,
  Note,
  Opportunity,
  OpportunityStage,
  PersonalDatabase,
  Priority,
  StageChange,
  Task,
  TaskStatus,
  Touch,
  TouchChannel,
  TouchDirection,
  TouchOutcome,
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
 * Outreach — an invented pipeline
 *
 * Every company and person below is fictional. The names were chosen to sound
 * plausible and to match nothing real; every source URL points at example.com,
 * which is reserved for exactly this purpose. The pipeline is deliberately
 * mid-flight and imperfect: cold emails that went nowhere, a rejection, a
 * ghosting, and follow-ups that are overdue, due today and coming up — so
 * every state the Outreach pages can render has something to show.
 *
 * Hand-authored rather than drawn from the PRNG: a pipeline needs a story, and
 * a story is deterministic by construction.
 * -------------------------------------------------------------------------- */

const COMPANY_ID = {
  northwind: 'sample-company-northwind',
  meridian: 'sample-company-meridian',
  quillfeather: 'sample-company-quillfeather',
  halden: 'sample-company-halden',
  larkspur: 'sample-company-larkspur',
  tessellate: 'sample-company-tessellate',
  orbital: 'sample-company-orbital',
  brightwater: 'sample-company-brightwater',
} as const

const CONTACT_ID = {
  anaya: 'sample-contact-anaya',
  devendra: 'sample-contact-devendra',
  priyamvada: 'sample-contact-priyamvada',
  rohan: 'sample-contact-rohan',
  sana: 'sample-contact-sana',
  mateo: 'sample-contact-mateo',
  farah: 'sample-contact-farah',
  ishaan: 'sample-contact-ishaan',
  nikhil: 'sample-contact-nikhil',
  leela: 'sample-contact-leela',
} as const

const OPP_ID = {
  northwindIntern: 'sample-opp-northwind-intern',
  meridianNewGrad: 'sample-opp-meridian-new-grad',
  quillfeatherIntern: 'sample-opp-quillfeather-intern',
  orbitalPlatform: 'sample-opp-orbital-platform',
  larkspurIntern: 'sample-opp-larkspur-intern',
  tessellateIntern: 'sample-opp-tessellate-intern',
  haldenGraduate: 'sample-opp-halden-graduate',
  meridianSummer: 'sample-opp-meridian-summer',
  haldenAnalyst: 'sample-opp-halden-analyst',
} as const

/** Fit values in `DEFAULT_FIT_CRITERIA` order; missing trailing values are 0. */
function fitOf(...values: FitValue[]): Record<string, FitValue> {
  const fit: Record<string, FitValue> = {}
  DEFAULT_FIT_CRITERIA.forEach((criterion, index) => {
    fit[criterion.id] = values[index] ?? 0
  })
  return fit
}

interface TouchSeed {
  daysAgo: number
  time: string
  channel: TouchChannel
  direction: TouchDirection
  company: string
  contact?: string
  opportunity?: string
  summary: string
  template?: string
  outcome?: TouchOutcome
}

interface OutreachSlice {
  companies: Company[]
  contacts: Contact[]
  opportunities: Opportunity[]
  touches: Touch[]
  /** Follow-up tasks, linked back to their opportunity. */
  tasks: Task[]
}

function buildOutreachSlice(today: ISODate): OutreachSlice {
  const ago = (days: number): ISODate => addDays(today, -days)
  const ahead = (days: number): ISODate => addDays(today, days)
  const at = (daysAgo: number, hour: number, minute = 0): string =>
    stampAt(ago(daysAgo), hour, minute)
  const stamps = (createdDaysAgo: number, updatedDaysAgo: number) => ({
    createdAt: at(createdDaysAgo, 20),
    updatedAt: at(updatedDaysAgo, 20, 30),
  })
  const fact = (id: string, text: string, path: string, daysAgo: number): CompanyFact => ({
    id,
    text,
    sourceUrl: `https://example.com/${path}`,
    addedAt: at(daysAgo, 20, 15),
  })
  const history = (...steps: [OpportunityStage, number][]): StageChange[] =>
    steps.map(([stage, daysAgo]) => ({ stage, at: at(daysAgo, 18) }))

  const companies: Company[] = [
    {
      id: COMPANY_ID.northwind,
      name: 'Northwind Labs',
      website: 'https://northwind.example.com',
      careersUrl: 'https://northwind.example.com/careers',
      kind: 'startup',
      stage: 'Series A',
      size: '11-50',
      location: 'Bengaluru',
      remote: true,
      industry: 'Developer tools',
      why: 'Small backend team shipping a schema-migration product — the kind of work where correctness is the product.',
      facts: [
        fact(
          'sample-fact-northwind-1',
          'Announced a Series A and said the backend team would double this year.',
          'northwind/series-a',
          40,
        ),
        fact(
          'sample-fact-northwind-2',
          'Careers page lists a backend engineering internship for the winter cohort.',
          'northwind/careers',
          39,
        ),
      ],
      fit: fitOf(2, 2, 2, 2, 2, 2),
      priority: 'high',
      tags: ['devtools', 'backend', 'warm-intro'],
      archived: false,
      ...stamps(41, 7),
    },
    {
      id: COMPANY_ID.meridian,
      name: 'Meridian Systems',
      website: 'https://meridian.example.com',
      careersUrl: 'https://meridian.example.com/careers',
      kind: 'scaleup',
      stage: 'Series C',
      size: '201-1000',
      location: 'Hyderabad',
      remote: false,
      industry: 'Fintech infrastructure',
      why: 'Payments-grade backend at real scale, and a new-grad programme with a good reputation.',
      facts: [
        fact(
          'sample-fact-meridian-1',
          'Opened a Hyderabad engineering hub focused on payments infrastructure.',
          'meridian/hyderabad-hub',
          35,
        ),
        fact(
          'sample-fact-meridian-2',
          'New-grad software engineer applications close at the end of the month.',
          'meridian/new-grad',
          20,
        ),
      ],
      fit: fitOf(2, 2, 1, 1, 2, 1),
      priority: 'high',
      tags: ['fintech', 'new-grad', 'alumni'],
      archived: false,
      ...stamps(40, 9),
    },
    {
      id: COMPANY_ID.quillfeather,
      name: 'Quillfeather',
      website: 'https://quillfeather.example.com',
      kind: 'startup',
      stage: 'Seed',
      size: '1-10',
      location: 'Remote',
      remote: true,
      industry: 'AI writing tools',
      why: 'Founding-engineer scope at a six-person company: broad ownership, fast feedback.',
      facts: [
        fact(
          'sample-fact-quillfeather-1',
          'Raised a seed round; two engineers today, hiring a third.',
          'quillfeather/seed',
          13,
        ),
      ],
      fit: fitOf(2, 1, 2, 2, 0, 2),
      priority: 'medium',
      tags: ['ai', 'early-stage'],
      archived: false,
      ...stamps(14, 6),
    },
    {
      id: COMPANY_ID.halden,
      name: 'Halden & Co',
      website: 'https://halden.example.com',
      careersUrl: 'https://halden.example.com/graduates',
      kind: 'mnc',
      stage: 'Public',
      size: '1000+',
      location: 'Pune',
      remote: false,
      industry: 'Enterprise software and consulting',
      why: 'Large graduate programme; a safe application rather than a target.',
      facts: [
        fact(
          'sample-fact-halden-1',
          'Graduate programme takes applications through the portal only, no referrals.',
          'halden/graduates',
          32,
        ),
      ],
      fit: fitOf(2, 1, 0, 1, 0, 0),
      priority: 'low',
      tags: ['graduate-programme', 'portal'],
      archived: false,
      ...stamps(32, 4),
    },
    {
      id: COMPANY_ID.larkspur,
      name: 'Larkspur Health',
      website: 'https://larkspur.example.com',
      careersUrl: 'https://larkspur.example.com/careers',
      kind: 'scaleup',
      stage: 'Series B',
      size: '51-200',
      location: 'Mumbai',
      remote: true,
      industry: 'Health tech',
      why: 'Regulated data and audit trails: a backend that has to be right, and a good place to learn that discipline.',
      facts: [
        fact(
          'sample-fact-larkspur-1',
          'Series B announced alongside a plan to grow the engineering team.',
          'larkspur/series-b',
          22,
        ),
      ],
      fit: fitOf(2, 2, 1, 2, 0, 1),
      priority: 'medium',
      tags: ['healthtech', 'backend'],
      archived: false,
      ...stamps(23, 2),
    },
    {
      id: COMPANY_ID.tessellate,
      name: 'Tessellate',
      website: 'https://tessellate.example.com',
      kind: 'startup',
      stage: 'Pre-seed',
      size: '1-10',
      location: 'Bengaluru',
      remote: true,
      industry: 'Data infrastructure',
      why: 'Founders met at a campus meetup; building query infrastructure for analytics teams.',
      facts: [
        fact(
          'sample-fact-tessellate-1',
          'Pre-seed, three people, planning a first intern hire this term.',
          'tessellate/about',
          4,
        ),
      ],
      fit: fitOf(1, 2, 2, 2, 2, 2),
      priority: 'medium',
      tags: ['infra', 'early-stage', 'alumni'],
      archived: false,
      ...stamps(5, 2),
    },
    {
      id: COMPANY_ID.orbital,
      name: 'Orbital Ledger',
      website: 'https://orbital.example.com',
      careersUrl: 'https://orbital.example.com/careers',
      kind: 'scaleup',
      stage: 'Series B',
      size: '51-200',
      location: 'Remote (US)',
      remote: true,
      industry: 'Payments',
      why: 'Ledger correctness problems: consistency, idempotency, reconciliation.',
      facts: [
        fact(
          'sample-fact-orbital-1',
          'Engineering blog post on the consistency guarantees of their ledger.',
          'orbital/blog/consistency',
          13,
        ),
        fact(
          'sample-fact-orbital-2',
          'Platform engineering internship posted, open to remote candidates.',
          'orbital/careers/platform-intern',
          12,
        ),
      ],
      fit: fitOf(2, 2, 1, 2, 1, 2),
      priority: 'high',
      tags: ['payments', 'remote', 'platform'],
      archived: false,
      ...stamps(13, 3),
    },
    {
      id: COMPANY_ID.brightwater,
      name: 'Brightwater Analytics',
      website: 'https://brightwater.example.com',
      kind: 'mnc',
      stage: 'Public',
      size: '1000+',
      location: 'Gurugram',
      remote: false,
      industry: 'Analytics and BI',
      why: 'Paused: no intern hiring this cycle according to the careers page.',
      facts: [
        fact(
          'sample-fact-brightwater-1',
          'Careers page shows no engineering internships open this cycle.',
          'brightwater/careers',
          35,
        ),
      ],
      fit: fitOf(0, 1, 0, 1, 0, 0),
      priority: 'low',
      tags: ['paused'],
      archived: true,
      ...stamps(42, 35),
    },
  ]

  const contacts: Contact[] = [
    {
      id: CONTACT_ID.anaya,
      companyId: COMPANY_ID.northwind,
      name: 'Anaya Raghunathan',
      role: 'Head of Engineering',
      linkedinUrl: 'https://example.com/in/anaya-raghunathan',
      email: 'anaya@northwind.example.com',
      warmth: 'warm',
      notes: 'Spoke after her talk on zero-downtime migrations; asked for a resume.',
      ...stamps(38, 33),
    },
    {
      id: CONTACT_ID.devendra,
      companyId: COMPANY_ID.northwind,
      name: 'Devendra Kaul',
      role: 'Technical Recruiter',
      email: 'devendra@northwind.example.com',
      warmth: 'cold',
      ...stamps(30, 7),
    },
    {
      id: CONTACT_ID.priyamvada,
      companyId: COMPANY_ID.meridian,
      name: 'Priyamvada Iyer',
      role: 'Engineering Manager, Payments',
      linkedinUrl: 'https://example.com/in/priyamvada-iyer',
      warmth: 'alumni',
      notes: 'Same department, graduated a few years earlier. Happy to refer.',
      ...stamps(20, 9),
    },
    {
      id: CONTACT_ID.rohan,
      companyId: COMPANY_ID.meridian,
      name: 'Rohan Bhattacharya',
      role: 'Senior Backend Engineer',
      linkedinUrl: 'https://example.com/in/rohan-bhattacharya',
      warmth: 'referral',
      notes: 'Introduced by a batchmate; has not replied yet.',
      ...stamps(25, 15),
    },
    {
      id: CONTACT_ID.sana,
      companyId: COMPANY_ID.quillfeather,
      name: 'Sana Qureshi',
      role: 'Founder & CEO',
      email: 'sana@quillfeather.example.com',
      warmth: 'cold',
      ...stamps(12, 8),
    },
    {
      id: CONTACT_ID.mateo,
      companyId: COMPANY_ID.orbital,
      name: 'Mateo Lindqvist',
      role: 'Staff Engineer, Ledger',
      linkedinUrl: 'https://example.com/in/mateo-lindqvist',
      warmth: 'warm',
      notes: 'Wrote the consistency blog post; connected on LinkedIn.',
      ...stamps(5, 5),
    },
    {
      id: CONTACT_ID.farah,
      companyId: COMPANY_ID.larkspur,
      name: 'Farah Menon',
      role: 'Talent Partner',
      email: 'farah@larkspur.example.com',
      warmth: 'cold',
      ...stamps(11, 8),
    },
    {
      id: CONTACT_ID.ishaan,
      companyId: COMPANY_ID.tessellate,
      name: 'Ishaan Varghese',
      role: 'Co-founder',
      linkedinUrl: 'https://example.com/in/ishaan-varghese',
      warmth: 'alumni',
      notes: 'Met at the campus infra meetup; said they take one intern a term.',
      ...stamps(4, 2),
    },
    {
      id: CONTACT_ID.nikhil,
      companyId: COMPANY_ID.halden,
      name: 'Nikhil Adhikari',
      role: 'Campus Hiring Lead',
      linkedinUrl: 'https://example.com/in/nikhil-adhikari',
      warmth: 'cold',
      ...stamps(1, 1),
    },
    {
      id: CONTACT_ID.leela,
      companyId: COMPANY_ID.orbital,
      name: 'Leela Ramaswamy',
      role: 'University Recruiter',
      email: 'leela@orbital.example.com',
      warmth: 'cold',
      ...stamps(13, 3),
    },
  ]

  const opportunities: Opportunity[] = [
    {
      id: OPP_ID.northwindIntern,
      companyId: COMPANY_ID.northwind,
      contactId: CONTACT_ID.anaya,
      title: 'Backend Engineering Intern',
      type: 'internship',
      stage: 'interviewing',
      source: 'referral',
      jobUrl: 'https://northwind.example.com/careers/backend-intern',
      appliedAt: ago(32),
      nextAction: 'Prepare for the system design round',
      nextActionDue: today,
      priority: 'high',
      resumeVersion: 'backend-v3',
      notes: 'Two rounds done. The system design round is the last technical step.',
      stageHistory: history(
        ['researching', 41],
        ['contacted', 38],
        ['replied', 36],
        ['applied', 32],
        ['screening', 27],
        ['interviewing', 16],
      ),
      ...stamps(41, 7),
    },
    {
      id: OPP_ID.meridianNewGrad,
      companyId: COMPANY_ID.meridian,
      contactId: CONTACT_ID.priyamvada,
      title: 'Software Engineer (New Grad)',
      type: 'full-time',
      stage: 'applied',
      source: 'referral',
      jobUrl: 'https://meridian.example.com/careers/new-grad-swe',
      appliedAt: ago(10),
      nextAction: 'Follow up with Priyamvada on the referral status',
      nextActionDue: ago(3),
      priority: 'high',
      resumeVersion: 'general-v2',
      stageHistory: history(['researching', 36], ['contacted', 20], ['replied', 18], ['applied', 10]),
      ...stamps(36, 9),
    },
    {
      id: OPP_ID.quillfeatherIntern,
      companyId: COMPANY_ID.quillfeather,
      contactId: CONTACT_ID.sana,
      title: 'Founding Engineer Intern',
      type: 'internship',
      stage: 'replied',
      source: 'cold',
      nextAction: 'Send the take-home write-up',
      nextActionDue: ahead(2),
      priority: 'medium',
      resumeVersion: 'backend-v3',
      stageHistory: history(['researching', 14], ['contacted', 12], ['replied', 8]),
      ...stamps(14, 6),
    },
    {
      id: OPP_ID.orbitalPlatform,
      companyId: COMPANY_ID.orbital,
      contactId: CONTACT_ID.leela,
      title: 'Platform Engineering Intern',
      type: 'internship',
      stage: 'contacted',
      source: 'linkedin',
      jobUrl: 'https://orbital.example.com/careers/platform-intern',
      nextAction: 'Follow up with Leela if there is no reply',
      nextActionDue: ahead(4),
      priority: 'high',
      resumeVersion: 'backend-v3',
      stageHistory: history(['researching', 13], ['contacted', 3]),
      ...stamps(13, 3),
    },
    {
      id: OPP_ID.larkspurIntern,
      companyId: COMPANY_ID.larkspur,
      contactId: CONTACT_ID.farah,
      title: 'Backend Intern',
      type: 'internship',
      stage: 'screening',
      source: 'portal',
      jobUrl: 'https://larkspur.example.com/careers/backend-intern',
      appliedAt: ago(16),
      priority: 'medium',
      resumeVersion: 'backend-v3',
      stageHistory: history(
        ['researching', 23],
        ['contacted', 22],
        ['applied', 16],
        ['screening', 11],
      ),
      ...stamps(23, 2),
    },
    {
      id: OPP_ID.tessellateIntern,
      companyId: COMPANY_ID.tessellate,
      contactId: CONTACT_ID.ishaan,
      title: 'Infrastructure Intern',
      type: 'internship',
      stage: 'researching',
      source: 'event',
      nextAction: 'Send Ishaan a one-page project proposal',
      nextActionDue: ahead(6),
      priority: 'medium',
      notes: 'No posting yet. Ishaan said to send a resume and they would find a project.',
      stageHistory: history(['researching', 4]),
      ...stamps(4, 2),
    },
    {
      id: OPP_ID.haldenGraduate,
      companyId: COMPANY_ID.halden,
      title: 'Graduate Software Engineer',
      type: 'full-time',
      stage: 'rejected',
      source: 'portal',
      jobUrl: 'https://halden.example.com/graduates/software-engineer',
      appliedAt: ago(31),
      priority: 'low',
      resumeVersion: 'general-v2',
      stageHistory: history(['researching', 32], ['applied', 31], ['rejected', 12]),
      closedAt: at(12, 10),
      ...stamps(32, 12),
    },
    {
      id: OPP_ID.meridianSummer,
      companyId: COMPANY_ID.meridian,
      title: 'Backend Intern (Summer)',
      type: 'internship',
      stage: 'ghosted',
      source: 'cold',
      priority: 'low',
      notes: 'Two cold emails to the careers alias, no reply in five weeks.',
      stageHistory: history(['researching', 40], ['contacted', 40], ['ghosted', 5]),
      closedAt: at(5, 20),
      ...stamps(40, 5),
    },
    {
      id: OPP_ID.haldenAnalyst,
      companyId: COMPANY_ID.halden,
      contactId: CONTACT_ID.nikhil,
      title: 'Technology Analyst Intern',
      type: 'internship',
      stage: 'applied',
      source: 'portal',
      jobUrl: 'https://halden.example.com/graduates/technology-analyst-intern',
      appliedAt: ago(4),
      nextAction: 'Check the portal for a status change',
      nextActionDue: ahead(6),
      priority: 'low',
      resumeVersion: 'general-v2',
      stageHistory: history(['researching', 5], ['applied', 4]),
      ...stamps(5, 1),
    },
  ]

  // Oldest first. Roughly two in five outbound touches ever got an answer,
  // which is what a warm-heavy pipeline with a few cold shots looks like.
  const touchSeeds: readonly TouchSeed[] = [
    { daysAgo: 42, time: '10:15', channel: 'email', direction: 'outbound', company: COMPANY_ID.brightwater, summary: 'Cold email to the analytics platform team alias about a backend internship.', template: 'tpl-cold-founder', outcome: 'no-reply' },
    { daysAgo: 40, time: '09:40', channel: 'email', direction: 'outbound', company: COMPANY_ID.meridian, opportunity: OPP_ID.meridianSummer, summary: 'Cold email to the careers alias about the summer backend internship.', template: 'tpl-cold-founder', outcome: 'no-reply' },
    { daysAgo: 38, time: '18:20', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.anaya, opportunity: OPP_ID.northwindIntern, summary: 'Connection note to Anaya after her talk on zero-downtime migrations.', template: 'tpl-connection', outcome: 'replied' },
    { daysAgo: 36, time: '11:05', channel: 'linkedin', direction: 'inbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.anaya, opportunity: OPP_ID.northwindIntern, summary: 'Anaya accepted and asked for a resume and a short summary.' },
    { daysAgo: 35, time: '10:00', channel: 'email', direction: 'outbound', company: COMPANY_ID.brightwater, summary: 'Follow-up to the analytics team alias.', template: 'tpl-follow-up', outcome: 'no-reply' },
    { daysAgo: 35, time: '21:30', channel: 'email', direction: 'outbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.anaya, opportunity: OPP_ID.northwindIntern, summary: 'Sent the resume and a one-paragraph summary; asked about the backend intern opening.', template: 'tpl-referral', outcome: 'positive' },
    { daysAgo: 34, time: '09:30', channel: 'email', direction: 'outbound', company: COMPANY_ID.meridian, opportunity: OPP_ID.meridianSummer, summary: 'Follow-up on the summer internship email.', template: 'tpl-follow-up', outcome: 'no-reply' },
    { daysAgo: 33, time: '14:10', channel: 'email', direction: 'inbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.anaya, opportunity: OPP_ID.northwindIntern, summary: 'Referred internally; a recruiter will reach out this week.' },
    { daysAgo: 33, time: '16:00', channel: 'email', direction: 'outbound', company: COMPANY_ID.halden, summary: 'Cold email to the graduate programme mailbox asking about timelines.', template: 'tpl-cold-founder', outcome: 'no-reply' },
    { daysAgo: 32, time: '20:45', channel: 'portal', direction: 'outbound', company: COMPANY_ID.northwind, opportunity: OPP_ID.northwindIntern, summary: 'Applied through the referral link Anaya sent.' },
    { daysAgo: 31, time: '19:20', channel: 'portal', direction: 'outbound', company: COMPANY_ID.halden, opportunity: OPP_ID.haldenGraduate, summary: 'Applied to the graduate programme through the portal.' },
    { daysAgo: 30, time: '11:45', channel: 'email', direction: 'inbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Devendra proposed times for a 30-minute screening call.', outcome: 'scheduled' },
    { daysAgo: 30, time: '17:30', channel: 'email', direction: 'outbound', company: COMPANY_ID.meridian, summary: 'Cold email to a payments engineering manager found on the team page.', template: 'tpl-cold-founder', outcome: 'no-reply' },
    { daysAgo: 27, time: '15:00', channel: 'call', direction: 'outbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Screening call: team structure, stack, timeline. Technical round to follow.', outcome: 'positive' },
    { daysAgo: 25, time: '20:10', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.rohan, summary: 'Connection note to Rohan, introduced by a batchmate.', template: 'tpl-connection', outcome: 'no-reply' },
    { daysAgo: 22, time: '10:30', channel: 'email', direction: 'outbound', company: COMPANY_ID.larkspur, opportunity: OPP_ID.larkspurIntern, summary: 'Cold email to the careers alias before applying through the portal.', template: 'tpl-cold-founder', outcome: 'no-reply' },
    { daysAgo: 21, time: '18:50', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.larkspur, summary: 'Connection note to a backend lead listed on the engineering page.', template: 'tpl-connection', outcome: 'no-reply' },
    { daysAgo: 20, time: '21:00', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.priyamvada, opportunity: OPP_ID.meridianNewGrad, summary: 'Asked Priyamvada for a referral to the new-grad SWE role.', template: 'tpl-referral', outcome: 'replied' },
    { daysAgo: 18, time: '09:15', channel: 'linkedin', direction: 'inbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.priyamvada, opportunity: OPP_ID.meridianNewGrad, summary: 'Happy to refer — asked for the resume and the job id.' },
    { daysAgo: 18, time: '19:40', channel: 'email', direction: 'outbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Sent availability for the technical round.' },
    { daysAgo: 17, time: '08:50', channel: 'email', direction: 'outbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.priyamvada, opportunity: OPP_ID.meridianNewGrad, summary: 'Sent the resume, job id and a three-line summary for the referral.', outcome: 'positive' },
    { daysAgo: 16, time: '12:20', channel: 'email', direction: 'inbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Technical round confirmed for next week.' },
    { daysAgo: 16, time: '22:10', channel: 'portal', direction: 'outbound', company: COMPANY_ID.larkspur, opportunity: OPP_ID.larkspurIntern, summary: 'Applied to the backend internship through the careers portal.' },
    { daysAgo: 15, time: '20:30', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.rohan, summary: 'Nudged Rohan on the connection request.', template: 'tpl-follow-up', outcome: 'no-reply' },
    { daysAgo: 13, time: '18:00', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.orbital, contact: CONTACT_ID.leela, summary: 'Connection request to Leela ahead of the platform intern posting.', template: 'tpl-connection', outcome: 'no-reply' },
    { daysAgo: 12, time: '09:00', channel: 'email', direction: 'outbound', company: COMPANY_ID.quillfeather, contact: CONTACT_ID.sana, opportunity: OPP_ID.quillfeatherIntern, summary: 'Cold email to Sana about the founding engineer intern role.', template: 'tpl-cold-founder', outcome: 'replied' },
    { daysAgo: 12, time: '10:05', channel: 'email', direction: 'inbound', company: COMPANY_ID.halden, opportunity: OPP_ID.haldenGraduate, summary: 'Automated rejection from the graduate programme — profile not shortlisted.', outcome: 'negative' },
    { daysAgo: 11, time: '13:30', channel: 'email', direction: 'inbound', company: COMPANY_ID.larkspur, contact: CONTACT_ID.farah, opportunity: OPP_ID.larkspurIntern, summary: 'Farah reached out to schedule a recruiter screen.', outcome: 'scheduled' },
    { daysAgo: 10, time: '21:15', channel: 'portal', direction: 'outbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.priyamvada, opportunity: OPP_ID.meridianNewGrad, summary: 'Submitted the application through the portal with the referral code.' },
    { daysAgo: 9, time: '10:40', channel: 'email', direction: 'inbound', company: COMPANY_ID.meridian, contact: CONTACT_ID.priyamvada, opportunity: OPP_ID.meridianNewGrad, summary: 'Referral submitted on their side; the application shows as under review.' },
    { daysAgo: 9, time: '16:00', channel: 'call', direction: 'outbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Technical round: two coding problems and a short design discussion.', outcome: 'positive' },
    { daysAgo: 8, time: '08:30', channel: 'email', direction: 'inbound', company: COMPANY_ID.quillfeather, contact: CONTACT_ID.sana, opportunity: OPP_ID.quillfeatherIntern, summary: 'Sana replied: interested, and sent a small take-home to talk through.' },
    { daysAgo: 8, time: '15:30', channel: 'call', direction: 'outbound', company: COMPANY_ID.larkspur, contact: CONTACT_ID.farah, opportunity: OPP_ID.larkspurIntern, summary: 'Recruiter screen: role scope, timeline and the compensation range.', outcome: 'positive' },
    { daysAgo: 7, time: '11:20', channel: 'email', direction: 'inbound', company: COMPANY_ID.northwind, contact: CONTACT_ID.devendra, opportunity: OPP_ID.northwindIntern, summary: 'Moving to the system design round; scheduling for next week.' },
    { daysAgo: 6, time: '19:05', channel: 'email', direction: 'outbound', company: COMPANY_ID.quillfeather, contact: CONTACT_ID.sana, opportunity: OPP_ID.quillfeatherIntern, summary: 'Confirmed the take-home write-up would go out by the weekend.' },
    { daysAgo: 5, time: '20:20', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.orbital, contact: CONTACT_ID.mateo, summary: 'Connection note to Mateo about the ledger consistency post.', template: 'tpl-connection' },
    { daysAgo: 4, time: '17:45', channel: 'event', direction: 'outbound', company: COMPANY_ID.tessellate, contact: CONTACT_ID.ishaan, summary: 'Met Ishaan at the campus infra meetup; they take one intern a term.' },
    { daysAgo: 4, time: '22:00', channel: 'portal', direction: 'outbound', company: COMPANY_ID.halden, opportunity: OPP_ID.haldenAnalyst, summary: 'Applied to the technology analyst internship through the portal.' },
    { daysAgo: 3, time: '09:10', channel: 'email', direction: 'outbound', company: COMPANY_ID.orbital, contact: CONTACT_ID.leela, opportunity: OPP_ID.orbitalPlatform, summary: 'Cold email to Leela about the platform intern posting.', template: 'tpl-cold-founder' },
    { daysAgo: 2, time: '10:00', channel: 'email', direction: 'outbound', company: COMPANY_ID.larkspur, contact: CONTACT_ID.farah, opportunity: OPP_ID.larkspurIntern, summary: 'Checked in on next steps after the recruiter screen.', template: 'tpl-follow-up' },
    { daysAgo: 2, time: '21:40', channel: 'email', direction: 'outbound', company: COMPANY_ID.tessellate, contact: CONTACT_ID.ishaan, summary: 'Sent Ishaan the resume he asked for, with two project links.' },
    { daysAgo: 1, time: '18:30', channel: 'linkedin', direction: 'outbound', company: COMPANY_ID.halden, contact: CONTACT_ID.nikhil, summary: 'Connection note to Nikhil, who runs campus hiring.', template: 'tpl-connection' },
  ]

  const touches: Touch[] = touchSeeds.map((seed, index) => {
    const date = ago(seed.daysAgo)
    const [hour, minute] = seed.time.split(':').map(Number)
    return {
      id: `sample-touch-${`${index + 1}`.padStart(2, '0')}`,
      date,
      time: seed.time,
      channel: seed.channel,
      direction: seed.direction,
      companyId: seed.company,
      contactId: seed.contact,
      opportunityId: seed.opportunity,
      summary: seed.summary,
      templateId: seed.template,
      outcome: seed.outcome,
      createdAt: stampAt(date, hour, minute),
    }
  })

  // Real tasks on the Today page, one per due follow-up: overdue, today, upcoming.
  const tasks: Task[] = [
    {
      id: 'sample-task-followup-1',
      date: ago(3),
      title: 'Follow up: Meridian Systems — Software Engineer (New Grad)',
      description: 'Ask Priyamvada whether the referral has moved; the portal still says under review.',
      categoryId: 'cat-career',
      priority: 'medium',
      status: 'not-started',
      order: 90,
      link: { kind: 'opportunity', id: OPP_ID.meridianNewGrad },
      createdAt: at(9, 18),
      updatedAt: at(9, 18),
    },
    {
      id: 'sample-task-followup-2',
      date: today,
      title: 'Prepare for the system design round — Northwind Labs',
      description: 'Last technical step. Revisit the rate limiter sketch and the caching notes.',
      categoryId: 'cat-career',
      priority: 'high',
      status: 'not-started',
      order: 90,
      link: { kind: 'opportunity', id: OPP_ID.northwindIntern },
      createdAt: at(7, 19),
      updatedAt: at(7, 19),
    },
    {
      id: 'sample-task-followup-3',
      date: ahead(2),
      title: 'Follow up: Quillfeather — Founding Engineer Intern',
      description: 'Send Sana the take-home write-up.',
      categoryId: 'cat-career',
      priority: 'medium',
      status: 'not-started',
      order: 1,
      link: { kind: 'opportunity', id: OPP_ID.quillfeatherIntern },
      createdAt: at(6, 18),
      updatedAt: at(6, 18),
    },
  ]

  return { companies, contacts, opportunities, touches, tasks }
}

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

  /* -- outreach ---------------------------------------------------------- */

  const outreach = buildOutreachSlice(today)

  return {
    ...base,
    tasks: [...tasks, ...outreach.tasks],
    logs,
    weeklyGoals,
    monthlyGoals,
    habits,
    habitEntries,
    reviews,
    notes,
    days: dayMetas,
    settings,
    companies: outreach.companies,
    contacts: outreach.contacts,
    opportunities: outreach.opportunities,
    touches: outreach.touches,
  }
}
