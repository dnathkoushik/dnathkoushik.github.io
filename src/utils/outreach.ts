/**
 * Pure derivations for the outreach module — the owner's personal GTM pipeline.
 *
 * Every function here is `(db | records, ...) => value`. Nothing touches
 * storage, React or the DOM, so the numbers on the Outreach pages can be
 * driven from a plain object literal in `outreach.test.ts`.
 *
 * Two conventions run through the file:
 *
 *  - **`today` is always an argument.** Nothing reads the clock, so the same
 *    database produces the same figures in a test and on screen.
 *  - **Touch order is date, then time, then `createdAt`** — the same order
 *    `useTouches` renders in — so "later inbound" means the same thing to the
 *    response-rate maths as it does to the eye.
 */
import { PERSONAL_ROUTES } from '@/config/routes'
import type {
  ActivityEvent,
  Company,
  CompanyKind,
  ContactWarmth,
  FitCriterion,
  FitValue,
  ISODate,
  Opportunity,
  OpportunitySource,
  OpportunityStage,
  PersonalDatabase,
  Priority,
  TemplatePurpose,
  Tone,
  Touch,
  TouchChannel,
  TouchOutcome,
  WeekKey,
} from '@/types'
import {
  daysBetween,
  formatWeekLabel,
  fromISODate,
  shiftDay,
  shiftWeek,
  toISODate,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import type { WeekStartsOn } from '@/utils/date'
import { clamp, percent } from '@/utils/format'

/* -------------------------------------------------------------------------- *
 * Derived shapes. Computed, never stored, so they live next to the code that
 * produces them rather than in `types/personal.ts`.
 * -------------------------------------------------------------------------- */

export interface StageMeta {
  label: string
  tone: Tone
  terminal: boolean
  /** Position in the pipeline, 0-based. Same order as `STAGES`. */
  order: number
  /** One sentence: what to do while an opportunity sits at this stage. */
  hint: string
}

export interface FunnelStep {
  stage: OpportunityStage
  count: number
}

export interface PipelineSummary {
  /** Opportunities in a non-terminal stage. */
  open: number
  offers: number
  /** Opportunities exactly at 'interviewing' (screening is counted separately in the funnel). */
  interviewing: number
  /** Response rate over every outbound touch, 0–100. */
  replyRate: number
  dueToday: number
  overdue: number
  stale: number
}

export interface VelocityPoint {
  weekKey: WeekKey
  label: string
  outbound: number
  /** Every inbound touch that week. */
  inbound: number
  /**
   * Inbound touches that week which answer an earlier outbound touch on the
   * same opportunity (or, lacking one, the same contact). Unsolicited inbound
   * — a recruiter writing first — counts under `inbound` but not here.
   */
  replies: number
}

export interface WeeklyProgress {
  target: number
  outbound: number
  /** 0–100, capped at 100 so it can drive a progress bar directly. */
  pct: number
}

export interface ResponseRate {
  sent: number
  replied: number
  /** 0–100. */
  rate: number
}

export interface ChannelRate extends ResponseRate {
  channel: TouchChannel
}

export interface TemplateRate extends ResponseRate {
  templateId: string
  name: string
}

export interface DueFollowUps {
  overdue: Opportunity[]
  today: Opportunity[]
  /** Due within the next 7 days, exclusive of today. */
  upcoming: Opportunity[]
}

export interface StaleOpportunity {
  opportunity: Opportunity
  daysSinceTouch: number
}

export interface FitBreakdownRow {
  criterion: FitCriterion
  value: FitValue
  points: number
  max: number
}

export interface ReplyLatency {
  /** Mean days from first outbound to first inbound, one decimal. Null when `n` is 0. */
  avg: number | null
  median: number | null
  n: number
}

/** Any subset of the three ids a touch can point at; a touch matches on ANY of them. */
export interface TouchRef {
  companyId?: string
  contactId?: string
  opportunityId?: string
}

export interface TouchEventOptions {
  limit?: number
  from?: ISODate
  to?: ISODate
}

/* -------------------------------------------------------------------------- *
 * Enum metadata
 * -------------------------------------------------------------------------- */

/** Pipeline order. Terminal stages last. */
export const STAGES: OpportunityStage[] = [
  'researching',
  'contacted',
  'replied',
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
]

export const STAGE_META: Record<OpportunityStage, StageMeta> = {
  researching: {
    label: 'Researching',
    tone: 'neutral',
    terminal: false,
    order: 0,
    hint: 'Find the right person and one specific reason to write to them.',
  },
  contacted: {
    label: 'Contacted',
    tone: 'info',
    terminal: false,
    order: 1,
    hint: 'Wait for a reply and follow up on the scheduled day, not before.',
  },
  replied: {
    label: 'Replied',
    tone: 'accent',
    terminal: false,
    order: 2,
    hint: 'Answer within a day and ask for the next concrete step.',
  },
  applied: {
    label: 'Applied',
    tone: 'accent',
    terminal: false,
    order: 3,
    hint: 'Tell your contact you applied and note which resume version went in.',
  },
  screening: {
    label: 'Screening',
    tone: 'warning',
    terminal: false,
    order: 4,
    hint: 'Rehearse the two-minute story and confirm the logistics.',
  },
  interviewing: {
    label: 'Interviewing',
    tone: 'warning',
    terminal: false,
    order: 5,
    hint: 'Prepare per round and send a short thank-you the same day.',
  },
  offer: {
    label: 'Offer',
    tone: 'positive',
    terminal: false,
    order: 6,
    hint: 'Get it in writing, compare it against the others and decide by a date.',
  },
  accepted: {
    label: 'Accepted',
    tone: 'positive',
    terminal: true,
    order: 7,
    hint: 'Thank everyone who helped and close the parallel threads politely.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'danger',
    terminal: true,
    order: 8,
    hint: 'Ask for one line of feedback and note what to change next time.',
  },
  ghosted: {
    label: 'Ghosted',
    tone: 'neutral',
    terminal: true,
    order: 9,
    hint: 'One last note in a month; otherwise let it go.',
  },
  withdrawn: {
    label: 'Withdrawn',
    tone: 'neutral',
    terminal: true,
    order: 10,
    hint: 'Leave the door open with a short, polite note.',
  },
}

/** Icon names are verified against the curated map in `components/ui/Icon.tsx`. */
export const CHANNEL_META: Record<TouchChannel, { label: string; icon: string }> = {
  email: { label: 'Email', icon: 'Mail' },
  linkedin: { label: 'LinkedIn', icon: 'Link' },
  referral: { label: 'Referral', icon: 'Users' },
  portal: { label: 'Job portal', icon: 'Globe' },
  call: { label: 'Call', icon: 'Phone' },
  event: { label: 'Event', icon: 'Calendar' },
  other: { label: 'Other', icon: 'Ellipsis' },
}

export const WARMTH_META: Record<ContactWarmth, { label: string; tone: Tone; hint: string }> = {
  cold: {
    label: 'Cold',
    tone: 'neutral',
    hint: 'No prior contact. Lead with a specific hook and stay under 120 words.',
  },
  warm: {
    label: 'Warm',
    tone: 'info',
    hint: 'They know your name or you have spoken. Remind them where from.',
  },
  referral: {
    label: 'Referral',
    tone: 'positive',
    hint: 'Someone vouched for you. Name them in the first line.',
  },
  alumni: {
    label: 'Alumni',
    tone: 'accent',
    hint: 'Shared institution. Open with it, then ask for five minutes.',
  },
}

export const KIND_META: Record<CompanyKind, { label: string }> = {
  startup: { label: 'Startup' },
  scaleup: { label: 'Scale-up' },
  mnc: { label: 'MNC' },
  other: { label: 'Other' },
}

export const SOURCE_META: Record<OpportunitySource, { label: string }> = {
  cold: { label: 'Cold outreach' },
  referral: { label: 'Referral' },
  linkedin: { label: 'LinkedIn' },
  portal: { label: 'Job portal' },
  event: { label: 'Event' },
  inbound: { label: 'Inbound' },
}

export const PURPOSE_META: Record<TemplatePurpose, { label: string }> = {
  cold: { label: 'Cold' },
  'follow-up': { label: 'Follow-up' },
  referral: { label: 'Referral' },
  'thank-you': { label: 'Thank-you' },
  connection: { label: 'Connection' },
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

/** Outcomes on an outbound touch that mean "they answered", even with no inbound logged. */
const REPLY_OUTCOMES: ReadonlySet<TouchOutcome> = new Set<TouchOutcome>([
  'replied',
  'positive',
  'scheduled',
])

/** The category follow-up tasks land in. Mirrors `DEFAULT_CATEGORIES` in `services/defaults.ts`. */
const CAREER_CATEGORY_ID = 'cat-career'

export function isTerminal(stage: OpportunityStage): boolean {
  return STAGE_META[stage].terminal
}

/* -------------------------------------------------------------------------- *
 * Shared helpers
 * -------------------------------------------------------------------------- */

/** Ascending: oldest touch first. Date, then time, then `createdAt`. */
function compareTouches(a: Touch, b: Touch): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    a.createdAt.localeCompare(b.createdAt)
  )
}

/** Local calendar day of an ISO instant, or undefined when it cannot be read. */
function timestampDay(timestamp?: string): ISODate | undefined {
  if (!timestamp) return undefined
  const parsed = new Date(timestamp)
  return Number.isNaN(parsed.getTime()) ? undefined : toISODate(parsed)
}

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

/**
 * True when `candidate` is on the same thread as `touch`: the same opportunity,
 * or — when `touch` has no opportunity — the same contact.
 */
function sameThread(touch: Touch, candidate: Touch): boolean {
  if (touch.opportunityId) return candidate.opportunityId === touch.opportunityId
  if (touch.contactId) return candidate.contactId === touch.contactId
  return false
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/* -------------------------------------------------------------------------- *
 * Fit score
 * -------------------------------------------------------------------------- */

function fitValueOf(company: Pick<Company, 'fit'>, criterionId: string): FitValue {
  const value = company.fit[criterionId]
  return value === 1 || value === 2 ? value : 0
}

function criterionWeight(criterion: FitCriterion): number {
  return Number.isFinite(criterion.weight) && criterion.weight > 0 ? criterion.weight : 0
}

/**
 * `round(100 × Σ(weight × value) / Σ(weight × 2))`, 0–100. Criteria the
 * company has not been scored against count as 0; no criteria means 0.
 */
export function fitScore(company: Pick<Company, 'fit'>, criteria: FitCriterion[]): number {
  let points = 0
  let max = 0
  for (const criterion of criteria) {
    const weight = criterionWeight(criterion)
    points += weight * fitValueOf(company, criterion.id)
    max += weight * 2
  }
  if (max <= 0) return 0
  return clamp(Math.round((100 * points) / max), 0, 100)
}

/** One row per criterion, in the order the criteria are configured. */
export function fitBreakdown(
  company: Pick<Company, 'fit'>,
  criteria: FitCriterion[],
): FitBreakdownRow[] {
  return criteria.map((criterion) => {
    const weight = criterionWeight(criterion)
    const value = fitValueOf(company, criterion.id)
    return { criterion, value, points: weight * value, max: weight * 2 }
  })
}

/* -------------------------------------------------------------------------- *
 * Pipeline
 * -------------------------------------------------------------------------- */

/** A count for every stage, in pipeline order — including empty ones. */
export function funnel(db: PersonalDatabase): FunnelStep[] {
  const counts = new Map<OpportunityStage, number>(STAGES.map((stage) => [stage, 0]))
  for (const opportunity of db.opportunities) {
    counts.set(opportunity.stage, (counts.get(opportunity.stage) ?? 0) + 1)
  }
  return STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
}

export function pipelineSummary(db: PersonalDatabase, today: ISODate): PipelineSummary {
  let open = 0
  let offers = 0
  let interviewing = 0
  for (const opportunity of db.opportunities) {
    if (isTerminal(opportunity.stage)) continue
    open += 1
    if (opportunity.stage === 'offer') offers += 1
    if (opportunity.stage === 'interviewing') interviewing += 1
  }

  const due = dueFollowUps(db, today)
  return {
    open,
    offers,
    interviewing,
    replyRate: responseRate(db.touches, db.touches).rate,
    dueToday: due.today.length,
    overdue: due.overdue.length,
    stale: staleOpportunities(db, today, db.outreach.staleAfterDays).length,
  }
}

/* -------------------------------------------------------------------------- *
 * Velocity
 * -------------------------------------------------------------------------- */

/**
 * `weeks` buckets ending at `endWeekKey`, oldest first. Touches are bucketed
 * by `weekKeyOf(touch.date)`; weeks with nothing in them are still emitted so
 * a chart's axis never skips.
 */
export function outreachVelocity(
  db: PersonalDatabase,
  endWeekKey: WeekKey,
  weeks: number,
  weekStartsOn: WeekStartsOn,
): VelocityPoint[] {
  const count = Number.isFinite(weeks) ? Math.max(0, Math.floor(weeks)) : 0
  if (count === 0) return []

  // Canonicalise the caller's key so `2026-W7` and `2026-W07` bucket alike.
  const end = shiftWeek(endWeekKey, 0, weekStartsOn)
  const points: VelocityPoint[] = []
  const byKey = new Map<WeekKey, VelocityPoint>()
  for (let i = count - 1; i >= 0; i -= 1) {
    const weekKey = shiftWeek(end, -i, weekStartsOn)
    const point: VelocityPoint = {
      weekKey,
      label: formatWeekLabel(weekKey, weekStartsOn),
      outbound: 0,
      inbound: 0,
      replies: 0,
    }
    points.push(point)
    byKey.set(weekKey, point)
  }

  const outbound = db.touches.filter((touch) => touch.direction === 'outbound')
  for (const touch of db.touches) {
    const point = byKey.get(weekKeyOf(touch.date, weekStartsOn))
    if (!point) continue
    if (touch.direction === 'outbound') {
      point.outbound += 1
      continue
    }
    point.inbound += 1
    const answers = outbound.some(
      (sent) => sameThread(touch, sent) && compareTouches(sent, touch) < 0,
    )
    if (answers) point.replies += 1
  }

  return points
}

/** Outbound touches in `weekKey` against `outreach.weeklyTarget`. */
export function weeklyProgress(
  db: PersonalDatabase,
  weekKey: WeekKey,
  weekStartsOn: WeekStartsOn,
): WeeklyProgress {
  const { start, end } = weekRange(weekKey, weekStartsOn)
  let outbound = 0
  for (const touch of db.touches) {
    if (touch.direction !== 'outbound') continue
    if (touch.date >= start && touch.date <= end) outbound += 1
  }
  const target = Number.isFinite(db.outreach.weeklyTarget)
    ? Math.max(0, db.outreach.weeklyTarget)
    : 0
  return { target, outbound, pct: clamp(percent(outbound, target), 0, 100) }
}

/* -------------------------------------------------------------------------- *
 * Response rates
 * -------------------------------------------------------------------------- */

/**
 * `sent` is the outbound touches in `touches`. One of them counts as replied
 * when its outcome is 'replied' | 'positive' | 'scheduled', OR when a later
 * inbound touch exists in `allTouches` on the same opportunity (or, when it
 * has no opportunity, the same contact). Pass the full `db.touches` as
 * `allTouches` so replies logged against the thread are found even when
 * `touches` is a filtered slice.
 */
export function responseRate(touches: Touch[], allTouches: Touch[]): ResponseRate {
  const inbound = allTouches.filter((touch) => touch.direction === 'inbound')
  let sent = 0
  let replied = 0
  for (const touch of touches) {
    if (touch.direction !== 'outbound') continue
    sent += 1
    if (touch.outcome && REPLY_OUTCOMES.has(touch.outcome)) {
      replied += 1
      continue
    }
    const answered = inbound.some(
      (reply) => sameThread(touch, reply) && compareTouches(reply, touch) > 0,
    )
    if (answered) replied += 1
  }
  return { sent, replied, rate: percent(replied, sent) }
}

/** Channels with at least one outbound touch, in `CHANNEL_META` order. */
export function rateByChannel(db: PersonalDatabase): ChannelRate[] {
  const channels = Object.keys(CHANNEL_META) as TouchChannel[]
  const rows: ChannelRate[] = []
  for (const channel of channels) {
    const rate = responseRate(
      db.touches.filter((touch) => touch.channel === channel),
      db.touches,
    )
    if (rate.sent > 0) rows.push({ channel, ...rate })
  }
  return rows
}

/**
 * Templates with at least one outbound touch, most-used first. Touches keep
 * their `templateId` after a template is deleted, so those rows survive as
 * "(deleted template)" — the history is the point.
 */
export function rateByTemplate(db: PersonalDatabase): TemplateRate[] {
  const byTemplate = new Map<string, Touch[]>()
  for (const touch of db.touches) {
    if (touch.direction !== 'outbound' || !touch.templateId) continue
    pushInto(byTemplate, touch.templateId, touch)
  }
  const names = new Map(db.templates.map((template) => [template.id, template.name]))

  const rows: TemplateRate[] = []
  for (const [templateId, touches] of byTemplate) {
    rows.push({
      templateId,
      name: names.get(templateId) ?? '(deleted template)',
      ...responseRate(touches, db.touches),
    })
  }
  return rows.sort((a, b) => b.sent - a.sent || a.name.localeCompare(b.name))
}

/* -------------------------------------------------------------------------- *
 * Follow-ups and staleness
 * -------------------------------------------------------------------------- */

function compareDue(a: Opportunity, b: Opportunity): number {
  return (
    (a.nextActionDue ?? '').localeCompare(b.nextActionDue ?? '') ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.title.localeCompare(b.title)
  )
}

/**
 * Open opportunities with a `nextActionDue`, split around `today`. `upcoming`
 * is the next 7 days. Each list is sorted by due date, then priority.
 */
export function dueFollowUps(db: PersonalDatabase, today: ISODate): DueFollowUps {
  const horizon = shiftDay(today, 7)
  const overdue: Opportunity[] = []
  const dueToday: Opportunity[] = []
  const upcoming: Opportunity[] = []

  for (const opportunity of db.opportunities) {
    if (isTerminal(opportunity.stage)) continue
    const due = opportunity.nextActionDue
    if (!due) continue
    if (due < today) overdue.push(opportunity)
    else if (due === today) dueToday.push(opportunity)
    else if (due <= horizon) upcoming.push(opportunity)
  }

  return {
    overdue: overdue.sort(compareDue),
    today: dueToday.sort(compareDue),
    upcoming: upcoming.sort(compareDue),
  }
}

/**
 * Open opportunities past 'researching' whose last touch (either direction)
 * is `staleAfterDays` or more days ago — or which have never been touched and
 * were created that long ago. Stalest first.
 */
export function staleOpportunities(
  db: PersonalDatabase,
  today: ISODate,
  staleAfterDays: number,
): StaleOpportunity[] {
  if (!Number.isFinite(staleAfterDays)) return []

  const rows: StaleOpportunity[] = []
  for (const opportunity of db.opportunities) {
    if (isTerminal(opportunity.stage) || opportunity.stage === 'researching') continue
    const last = lastTouch(db, { opportunityId: opportunity.id })
    const since = last ? last.date : timestampDay(opportunity.createdAt)
    if (!since) continue
    const daysSinceTouch = daysSince(since, today)
    if (daysSinceTouch >= staleAfterDays) rows.push({ opportunity, daysSinceTouch })
  }

  return rows.sort(
    (a, b) =>
      b.daysSinceTouch - a.daysSinceTouch ||
      a.opportunity.title.localeCompare(b.opportunity.title),
  )
}

/**
 * The newest touch pointing at any of the given ids. A `companyId` also
 * matches touches whose opportunity or contact belongs to that company, so a
 * company's "last touch" is right even when the touch was logged against the
 * person rather than the account.
 */
export function lastTouch(db: PersonalDatabase, ref: TouchRef): Touch | undefined {
  const { companyId, contactId, opportunityId } = ref
  if (!companyId && !contactId && !opportunityId) return undefined

  let opportunityCompany: Map<string, string> | undefined
  let contactCompany: Map<string, string | undefined> | undefined
  if (companyId) {
    opportunityCompany = new Map(db.opportunities.map((o) => [o.id, o.companyId]))
    contactCompany = new Map(db.contacts.map((c) => [c.id, c.companyId]))
  }

  const matches = (touch: Touch): boolean => {
    if (opportunityId && touch.opportunityId === opportunityId) return true
    if (contactId && touch.contactId === contactId) return true
    if (companyId) {
      if (touch.companyId === companyId) return true
      if (touch.opportunityId && opportunityCompany?.get(touch.opportunityId) === companyId) {
        return true
      }
      if (touch.contactId && contactCompany?.get(touch.contactId) === companyId) return true
    }
    return false
  }

  let best: Touch | undefined
  for (const touch of db.touches) {
    if (!matches(touch)) continue
    if (!best || compareTouches(touch, best) > 0) best = touch
  }
  return best
}

/** Whole calendar days from `date` to `today`. Negative for a future date. */
export function daysSince(date: ISODate, today: ISODate): number {
  return daysBetween(date, today)
}

/**
 * Per opportunity: first outbound touch → first inbound touch after it.
 * Averaged and medianed over the opportunities that have both.
 */
export function daysToFirstReply(db: PersonalDatabase): ReplyLatency {
  const byOpportunity = new Map<string, Touch[]>()
  for (const touch of db.touches) {
    if (touch.opportunityId) pushInto(byOpportunity, touch.opportunityId, touch)
  }

  const samples: number[] = []
  for (const touches of byOpportunity.values()) {
    const ordered = touches.slice().sort(compareTouches)
    const firstOut = ordered.find((touch) => touch.direction === 'outbound')
    if (!firstOut) continue
    const firstIn = ordered.find(
      (touch) => touch.direction === 'inbound' && compareTouches(touch, firstOut) > 0,
    )
    if (!firstIn) continue
    samples.push(Math.max(0, daysBetween(firstOut.date, firstIn.date)))
  }

  const n = samples.length
  if (n === 0) return { avg: null, median: null, n: 0 }

  samples.sort((a, b) => a - b)
  const sum = samples.reduce((total, value) => total + value, 0)
  const mid = Math.floor(n / 2)
  const median = n % 2 === 1 ? samples[mid] : (samples[mid - 1] + samples[mid]) / 2
  return { avg: round1(sum / n), median: round1(median), n }
}

/**
 * When to follow up next. `attemptsSoFar` follow-ups have already gone out
 * after `lastOutbound`; with `followUpDays` of `[4, 10]` that is +4 days for
 * the first, +10 for the second, and null once the schedule is exhausted.
 */
export function suggestedFollowUpDate(
  lastOutbound: ISODate,
  followUpDays: number[],
  attemptsSoFar: number,
): ISODate | null {
  if (!Number.isInteger(attemptsSoFar) || attemptsSoFar < 0) return null
  if (attemptsSoFar >= followUpDays.length) return null
  const offset = followUpDays[attemptsSoFar]
  if (!Number.isFinite(offset)) return null
  return shiftDay(lastOutbound, Math.max(0, Math.round(offset)))
}

/* -------------------------------------------------------------------------- *
 * Activity feed
 * -------------------------------------------------------------------------- */

/** The instant of a touch: its date + time when given, else when it was logged. */
function touchTimestamp(touch: Touch): string {
  if (touch.time) {
    const match = /^(\d{1,2}):(\d{2})/.exec(touch.time)
    if (match) {
      const at = fromISODate(touch.date)
      if (!Number.isNaN(at.getTime())) {
        at.setHours(Number(match[1]), Number(match[2]), 0, 0)
        return at.toISOString()
      }
    }
  }
  return touch.createdAt
}

/** Every touch as a timeline event, newest first. */
export function touchEvents(db: PersonalDatabase, opts: TouchEventOptions = {}): ActivityEvent[] {
  const { limit, from, to } = opts
  const companyNames = new Map(db.companies.map((company) => [company.id, company.name]))
  const contacts = new Map(db.contacts.map((contact) => [contact.id, contact]))
  const opportunities = new Map(
    db.opportunities.map((opportunity) => [opportunity.id, opportunity]),
  )
  const categoryId = db.categories.some((category) => category.id === CAREER_CATEGORY_ID)
    ? CAREER_CATEGORY_ID
    : undefined

  const titleOf = (touch: Touch): string => {
    const channel = CHANNEL_META[touch.channel].label
    const opportunity = touch.opportunityId ? opportunities.get(touch.opportunityId) : undefined
    const contact = touch.contactId ? contacts.get(touch.contactId) : undefined
    const companyId = touch.companyId ?? opportunity?.companyId ?? contact?.companyId
    const companyName = companyId ? companyNames.get(companyId) : undefined

    const who = contact?.name ?? companyName ?? opportunity?.title
    if (!who) return `${channel} ${touch.direction}`

    const preposition = touch.direction === 'outbound' ? 'to' : 'from'
    const suffix = contact && companyName ? ` · ${companyName}` : ''
    return `${channel} ${preposition} ${who}${suffix}`
  }

  const events: ActivityEvent[] = db.touches
    .filter((touch) => (!from || touch.date >= from) && (!to || touch.date <= to))
    .slice()
    .sort((a, b) => compareTouches(b, a))
    .map((touch): ActivityEvent => ({
      id: `touch:${touch.id}`,
      date: touch.date,
      timestamp: touchTimestamp(touch),
      kind: 'touch',
      title: titleOf(touch),
      detail: touch.summary.trim() || undefined,
      categoryId,
      href: PERSONAL_ROUTES.outreachActivity,
    }))

  return limit !== undefined && limit >= 0 ? events.slice(0, limit) : events
}
