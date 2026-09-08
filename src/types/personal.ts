/**
 * Types for the PRIVATE productivity dashboard.
 *
 * Nothing typed by this file is ever committed to the repository or shipped in
 * the bundle — it lives only in the browser's IndexedDB on the device you use.
 * See README.md ("What is and is not private") for the full threat model.
 */

/** Calendar date, `YYYY-MM-DD`. Always local time — never UTC-shifted. */
export type ISODate = string
/** ISO 8601 instant, `YYYY-MM-DDTHH:mm:ss.sssZ`. */
export type Timestamp = string
/** ISO week key, `YYYY-Www`, e.g. `2026-W36`. */
export type WeekKey = string
/** Month key, `YYYY-MM`, e.g. `2026-09`. */
export type MonthKey = string
/** Wall-clock time of day, `HH:mm`. */
export type ClockTime = string

/** Index into the `--color-cat-*` design tokens. */
export type CategoryColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'skipped'
export type GoalStatus = 'active' | 'completed' | 'missed' | 'archived'
export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

/**
 * A user-defined bucket shared by tasks, logs, goals and habits. Categories are
 * data rather than a union type so they can be renamed or added from Settings
 * without touching any component.
 */
export interface Category {
  id: string
  label: string
  color: CategoryColor
  /** Lucide icon name; falls back to a dot when unknown. */
  icon?: string
  archived?: boolean
}

export interface Task {
  id: string
  /** The day this task belongs to. Drives Today, Calendar and analytics. */
  date: ISODate
  title: string
  description?: string
  categoryId: string
  priority: Priority
  status: TaskStatus
  estimatedMinutes?: number
  actualMinutes?: number
  startedAt?: Timestamp
  completedAt?: Timestamp
  notes?: string
  /** Manual sort position within its day. Lower sorts first. */
  order: number
  /** Set when the task was created from the outreach pipeline (a follow-up). */
  link?: TaskLink
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface TaskLink {
  kind: 'opportunity' | 'company' | 'contact'
  id: string
}

export interface LogEntry {
  id: string
  date: ISODate
  time: ClockTime
  activity: string
  categoryId: string
  durationMinutes: number
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface GoalFields {
  id: string
  title: string
  description?: string
  categoryId: string
  priority: Priority
  /** Numeric goal, e.g. 20 problems. Use 1 for a simple done/not-done goal. */
  targetValue: number
  currentValue: number
  /** Unit label rendered next to the numbers, e.g. "problems", "hours". */
  unit: string
  deadline?: ISODate
  status: GoalStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface WeeklyGoal extends GoalFields {
  weekKey: WeekKey
}

export interface MonthlyGoal extends GoalFields {
  monthKey: MonthKey
}

/** Either goal shape, for components that render both. */
export type AnyGoal = WeeklyGoal | MonthlyGoal

export interface Habit {
  id: string
  name: string
  categoryId: string
  color: CategoryColor
  /** How many days per week counts as "on track". 1–7. */
  targetPerWeek: number
  /** Amount that counts as a full day, e.g. 2 problems. Defaults to 1. */
  dailyTarget: number
  /** Unit label for `dailyTarget`, e.g. "problems". Empty means done/not-done. */
  unit?: string
  order: number
  archived: boolean
  createdAt: Timestamp
}

export interface HabitEntry {
  /** Deterministic `${habitId}::${date}` so a day can only be logged once. */
  id: string
  habitId: string
  date: ISODate
  /** 0 means explicitly not done. Absent entry means never recorded. */
  value: number
  note?: string
  updatedAt: Timestamp
}

export interface WeeklyReview {
  /** Same value as `weekKey` — one review per week. */
  id: string
  weekKey: WeekKey
  wentWell: string
  wentWrong: string
  learned: string
  improve: string
  biggestAchievement: string
  biggestMistake: string
  nextWeekFocus: string
  /** Self-assessment, 1–5. */
  rating?: number
  updatedAt: Timestamp
}

export interface Note {
  id: string
  date: ISODate
  title: string
  body: string
  tags: string[]
  pinned: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Per-day header information: the objective, plus optional mood/energy. */
export interface DayMeta {
  /** Same value as `date` — one record per day. */
  id: ISODate
  date: ISODate
  objective: string
  /** 1–5. */
  mood?: number
  /** 1–5. */
  energy?: number
  highlight?: string
  updatedAt: Timestamp
}

export interface PersonalSettings {
  /** 0 = Sunday, 1 = Monday. Affects every week boundary in the app. */
  weekStartsOn: 0 | 1
  /** Focused hours per day that count as a full day, used by analytics. */
  dailyHoursTarget: number
  /** Tasks per day that count as a full day, used by the productivity score. */
  dailyTaskTarget: number
  /** Display name shown in the dashboard greeting. */
  displayName: string
  /** True once the user has dismissed or replaced the seeded demo data. */
  seedDataCleared: boolean
}

/* -------------------------------------------------------------------------- *
 * Outreach — a personal GTM pipeline for internships and full-time roles.
 *
 * Same shape as a sales CRM, pointed at the owner as the customer: target
 * accounts (companies) with source-cited facts and a deterministic fit score,
 * people at them (contacts), roles being pursued (opportunities) moving through
 * stages, and every interaction (touches). All of it is private data.
 * -------------------------------------------------------------------------- */

export type CompanyKind = 'startup' | 'scaleup' | 'mnc' | 'other'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'

/** One thing known about a company, and where it came from. */
export interface CompanyFact {
  id: string
  text: string
  sourceUrl?: string
  addedAt: Timestamp
}

/** 0 = no, 1 = partly, 2 = yes — against one fit criterion. */
export type FitValue = 0 | 1 | 2

export interface FitCriterion {
  id: string
  label: string
  /** 1-5. Weights are relative; the score is normalised to 0-100. */
  weight: number
}

export interface Company {
  id: string
  name: string
  website?: string
  careersUrl?: string
  linkedinUrl?: string
  kind: CompanyKind
  /** Free text, e.g. "Series A", "Public". */
  stage?: string
  size?: CompanySize
  location?: string
  remote: boolean
  industry?: string
  /** Why this company, in the owner's own words. */
  why?: string
  facts: CompanyFact[]
  /** criterionId -> FitValue. Missing criteria count as 0. */
  fit: Record<string, FitValue>
  priority: Priority
  tags: string[]
  archived: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ContactWarmth = 'cold' | 'warm' | 'referral' | 'alumni'

export interface Contact {
  id: string
  companyId?: string
  name: string
  role?: string
  linkedinUrl?: string
  email?: string
  warmth: ContactWarmth
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type OpportunityType = 'internship' | 'full-time'

export type OpportunityStage =
  | 'researching'
  | 'contacted'
  | 'replied'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'ghosted'
  | 'withdrawn'

export type OpportunitySource = 'cold' | 'referral' | 'linkedin' | 'portal' | 'event' | 'inbound'

export interface StageChange {
  stage: OpportunityStage
  at: Timestamp
}

export interface Opportunity {
  id: string
  companyId: string
  /** The person this is being pursued through, if any. */
  contactId?: string
  /** The role, e.g. "Backend Engineering Intern". */
  title: string
  type: OpportunityType
  stage: OpportunityStage
  source: OpportunitySource
  jobUrl?: string
  appliedAt?: ISODate
  nextAction?: string
  nextActionDue?: ISODate
  priority: Priority
  compensation?: string
  /** Which resume variant was sent, e.g. "backend-v3". */
  resumeVersion?: string
  notes?: string
  /** Every stage this has been in, oldest first. */
  stageHistory: StageChange[]
  /** Set when the stage becomes terminal. */
  closedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type TouchChannel = 'email' | 'linkedin' | 'referral' | 'portal' | 'call' | 'event' | 'other'
export type TouchDirection = 'outbound' | 'inbound'
export type TouchOutcome = 'no-reply' | 'replied' | 'positive' | 'negative' | 'scheduled'

/** One interaction. The unit that response rates and velocity are computed from. */
export interface Touch {
  id: string
  date: ISODate
  time?: ClockTime
  channel: TouchChannel
  direction: TouchDirection
  companyId?: string
  contactId?: string
  opportunityId?: string
  /** What was said / what happened, one or two lines. */
  summary: string
  /** The template this outbound touch was composed from, if any. */
  templateId?: string
  outcome?: TouchOutcome
  createdAt: Timestamp
}

export type TemplatePurpose = 'cold' | 'follow-up' | 'referral' | 'thank-you' | 'connection'

/**
 * A reusable message. `body` (and `subject`) may contain `{{name}}`,
 * `{{company}}`, `{{role}}`, `{{hook}}`, `{{me}}` - rendered by
 * `utils/templates.ts` before copying or composing.
 */
export interface MessageTemplate {
  id: string
  name: string
  channel: 'email' | 'linkedin'
  purpose: TemplatePurpose
  subject?: string
  body: string
  archived: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface OutreachSettings {
  /** Outbound touches per week that count as "on target". */
  weeklyTarget: number
  /** Days after an unanswered outbound touch to follow up, in order, e.g. [4, 10]. */
  followUpDays: number[]
  /** An open opportunity with no touch for this many days is "stale". */
  staleAfterDays: number
  fitCriteria: FitCriterion[]
  /** Pre-fills the resume field on new opportunities. */
  defaultResumeVersion?: string
}

/**
 * The complete private dataset. Persisted as one document, which keeps writes
 * atomic and makes export/import a single JSON blob. `version` drives the
 * migration chain in `services/migrations.ts`.
 */
export interface PersonalDatabase {
  version: number
  categories: Category[]
  tasks: Task[]
  logs: LogEntry[]
  weeklyGoals: WeeklyGoal[]
  monthlyGoals: MonthlyGoal[]
  habits: Habit[]
  habitEntries: HabitEntry[]
  reviews: WeeklyReview[]
  notes: Note[]
  days: DayMeta[]
  settings: PersonalSettings
  /* -- outreach (schema v2) --------------------------------------------- */
  companies: Company[]
  contacts: Contact[]
  opportunities: Opportunity[]
  touches: Touch[]
  templates: MessageTemplate[]
  outreach: OutreachSettings
}

/* -------------------------------------------------------------------------- *
 * Derived shapes — computed from the database, never stored.
 * -------------------------------------------------------------------------- */

export type ActivityKind =
  | 'task-completed'
  | 'log'
  | 'goal-completed'
  | 'habit'
  | 'note'
  | 'review'
  | 'day-objective'
  | 'touch'

export interface ActivityEvent {
  id: string
  date: ISODate
  /** Present when the source record carries a time; used for intra-day order. */
  timestamp?: Timestamp
  kind: ActivityKind
  title: string
  detail?: string
  categoryId?: string
  /** Route to open when the entry is clicked. */
  href?: string
}

export interface DayStats {
  date: ISODate
  tasksTotal: number
  tasksCompleted: number
  tasksSkipped: number
  /** Minutes recorded in the work log for this day. */
  loggedMinutes: number
  habitsDue: number
  habitsDone: number
  /** 0–100 composite of task completion, logged hours and habit adherence. */
  score: number
  hasEntries: boolean
}

export interface RangeStats {
  from: ISODate
  to: ISODate
  tasksCompleted: number
  tasksTotal: number
  /** 0–100. */
  completionRate: number
  loggedMinutes: number
  activeDays: number
  /** Minutes per category id, descending by value. */
  minutesByCategory: { categoryId: string; minutes: number }[]
  /** Longest run of consecutive days with any activity, ending inside range. */
  bestStreak: number
}

export interface StreakInfo {
  current: number
  best: number
  /** Most recent day that counted toward the streak. */
  lastActiveDate?: ISODate
}

/* -------------------------------------------------------------------------- *
 * Storage
 * -------------------------------------------------------------------------- */

/**
 * The seam between the UI and wherever private data physically lives.
 *
 * The whole database is read and written as a single document. That is
 * deliberately naive — it keeps the local implementation trivial and makes the
 * contract small enough that a Supabase/Firebase/REST adapter is a single file.
 * See README.md ("Connecting a real backend").
 */
export interface StorageAdapter {
  /** Human-readable name, surfaced in Settings. */
  readonly name: string
  /** Resolves null when nothing has been stored yet. */
  load(): Promise<PersonalDatabase | null>
  save(db: PersonalDatabase): Promise<void>
  clear(): Promise<void>
}

export type SearchResultKind =
  | 'project'
  | 'skill'
  | 'experience'
  | 'achievement'
  | 'page'
  | 'task'
  | 'log'
  | 'goal'
  | 'note'
  | 'review'
  | 'habit'
  | 'company'
  | 'contact'
  | 'opportunity'

export interface SearchResult {
  id: string
  kind: SearchResultKind
  title: string
  subtitle?: string
  /** Where selecting the result navigates to. */
  href: string
  /** True for results derived from private data, so the UI can mark them. */
  private: boolean
  /** Lower is a better match. */
  score: number
  /** Optional date shown on the right of the row. */
  date?: string
}
