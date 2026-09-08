/**
 * The private dashboard's data service.
 *
 * One in-memory document, one subscriber list, one debounced writer.
 *
 * WHY IT LOOKS LIKE THIS
 *
 * Every mutation is synchronous and optimistic: it rewrites the in-memory
 * document, notifies subscribers in the same tick, and only *then* schedules a
 * write. Ticking a checkbox on a phone should never wait on IndexedDB, and a
 * personal dashboard has no server to disagree with, so there is nothing to
 * reconcile and no loading spinner to justify.
 *
 * `getSnapshot` is built for `useSyncExternalStore`, which means one rule
 * matters more than any other: return a NEW top-level object whenever anything
 * changed, and the SAME object when nothing did. Returning a fresh object on
 * every read is an infinite render loop; returning a stale one is a dashboard
 * that does not update. `commit()` is the only place the document is replaced,
 * and it replaces only the collections that actually changed — the rest keep
 * their identity, so hooks that select a single collection stay cheap.
 *
 * Writes are debounced by `PERSIST_DEBOUNCE_MS` and also flushed when the tab
 * is hidden or unloaded, so a burst of typing costs one write and closing the
 * laptop mid-sentence costs nothing.
 */
import { APP_NAME, PERSIST_DEBOUNCE_MS, STORAGE_KEYS } from '@/config/app'
import {
  checkVerifier,
  createVerifier,
  deriveKey,
  exportKey,
  importKey,
  isCryptoAvailable,
  isEncryptedEnvelope,
  randomSalt,
} from '@/services/crypto'
import type { EncryptedEnvelope } from '@/services/crypto'
import {
  createEmptyDatabase,
  FALLBACK_CATEGORY_ID,
  nextCategoryColor,
} from '@/services/defaults'
import { parseCsvTable, serializeCsv } from '@/services/csv'
import type { CsvRow } from '@/services/csv'
import {
  migrate,
  normalizeOutreachSettings,
  normalizeSettings,
  unwrapDocument,
} from '@/services/migrations'
import { buildSampleDatabase } from '@/services/sampleData'
import {
  createEncryptedAdapter,
  createMemoryAdapter,
  createStorageAdapter,
} from '@/services/storage'
import type {
  CategoryInput,
  CompanyInput,
  ContactInput,
  HabitInput,
  ImportMode,
  ImportSummary,
  LockApi,
  LogInput,
  MonthlyGoalInput,
  NoteInput,
  OpportunityInput,
  OutreachCsvKind,
  PersonalActions,
  PersonalStatus,
  TaskInput,
  TemplateInput,
  TouchInput,
  WeeklyGoalInput,
} from '@/services/contracts'
import type {
  Category,
  Company,
  CompanyFact,
  CompanyKind,
  CompanySize,
  Contact,
  ContactWarmth,
  DayMeta,
  FitValue,
  GoalStatus,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MessageTemplate,
  MonthlyGoal,
  Note,
  Opportunity,
  OpportunityStage,
  OutreachSettings,
  PersonalDatabase,
  PersonalSettings,
  Priority,
  StorageAdapter,
  Task,
  TaskStatus,
  Touch,
  WeekKey,
  WeeklyGoal,
  WeeklyReview,
} from '@/types'
import { nowClockTime, nowTimestamp, todayISO } from '@/utils/date'
import { uid } from '@/utils/ids'

/** Minimum passphrase length for the privacy lock. */
export const MIN_PASSPHRASE_LENGTH = 8

/** Unencrypted lock metadata. Holds a salt and a verifier — never a passphrase. */
interface LockMeta {
  v: 1
  salt: string
  verifier: EncryptedEnvelope
}

/* -------------------------------------------------------------------------- *
 * Small pure helpers
 * -------------------------------------------------------------------------- */

function describeError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return fallback
}

function minutesBetween(from: string, to: string): number {
  const start = Date.parse(from)
  const end = Date.parse(to)
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0
  return Math.round((end - start) / 60_000)
}

function timeOf(value: string | undefined): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function countRecords(db: PersonalDatabase): number {
  return (
    db.categories.length +
    db.tasks.length +
    db.logs.length +
    db.weeklyGoals.length +
    db.monthlyGoals.length +
    db.habits.length +
    db.habitEntries.length +
    db.reviews.length +
    db.notes.length +
    db.days.length +
    db.companies.length +
    db.contacts.length +
    db.opportunities.length +
    db.touches.length +
    db.templates.length
  )
}

interface MergeCounters {
  added: number
  updated: number
  skipped: number
}

/** Upsert by id; the newer `updatedAt` wins, ties keep what is already here. */
function mergeCollection<T extends { id: string }>(
  current: T[],
  incoming: T[],
  stampOf: (item: T) => number,
  counters: MergeCounters,
): T[] {
  const result = current.slice()
  const indexById = new Map(current.map((item, index) => [item.id, index]))
  for (const item of incoming) {
    const index = indexById.get(item.id)
    if (index === undefined) {
      indexById.set(item.id, result.length)
      result.push(item)
      counters.added += 1
      continue
    }
    if (stampOf(item) > stampOf(result[index])) {
      result[index] = item
      counters.updated += 1
    } else {
      counters.skipped += 1
    }
  }
  return result
}

function applyGoalPatch<G extends WeeklyGoal | MonthlyGoal>(goal: G, patch: Partial<G>): G {
  const next = {
    ...goal,
    ...patch,
    id: goal.id,
    createdAt: goal.createdAt,
    updatedAt: nowTimestamp(),
  } as G
  // Hitting the number is the same as finishing, unless the caller said
  // otherwise in the same patch.
  if (patch.status === undefined && next.status === 'active' && next.currentValue >= next.targetValue) {
    return { ...next, status: 'completed' as GoalStatus } as G
  }
  return next
}

/* -------------------------------------------------------------------------- *
 * Outreach helpers
 * -------------------------------------------------------------------------- */

/** Stages an opportunity does not move on from. Mirrors `hooks/outreach.ts`. */
const TERMINAL_STAGES: ReadonlySet<OpportunityStage> = new Set<OpportunityStage>([
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
])

/** Stages that imply an application went in, used to default `appliedAt`. */
const APPLIED_STAGES: ReadonlySet<OpportunityStage> = new Set<OpportunityStage>([
  'applied',
  'screening',
  'interviewing',
  'offer',
  'accepted',
])

/** Follow-ups land here. `defaults.ts` ships the id; `categoryIdOrDefault` covers its absence. */
const CAREER_CATEGORY_ID = 'cat-career'

const COMPANY_KINDS: readonly CompanyKind[] = ['startup', 'scaleup', 'mnc', 'other']
const COMPANY_SIZES: readonly CompanySize[] = ['1-10', '11-50', '51-200', '201-1000', '1000+']
const CONTACT_WARMTHS: readonly ContactWarmth[] = ['cold', 'warm', 'referral', 'alumni']
const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low']

/** Column order for both directions of the CSV round trip. */
const COMPANY_CSV_COLUMNS = [
  'name',
  'website',
  'kind',
  'stage',
  'size',
  'location',
  'remote',
  'industry',
  'why',
  'tags',
  'priority',
] as const
const CONTACT_CSV_COLUMNS = ['name', 'role', 'company', 'email', 'linkedin', 'warmth', 'notes'] as const

/**
 * The one place a stage changes. Appends to the history, stamps or clears
 * `closedAt`, records the first application date and drops the next action
 * once nothing more can happen.
 */
function advanceStage(opportunity: Opportunity, stage: OpportunityStage, now: string): Opportunity {
  const terminal = TERMINAL_STAGES.has(stage)
  const next: Opportunity = {
    ...opportunity,
    stage,
    stageHistory: [...opportunity.stageHistory, { stage, at: now }],
    closedAt: terminal ? now : undefined,
    updatedAt: now,
  }
  if (stage === 'applied' && !next.appliedAt) next.appliedAt = todayISO()
  if (terminal) {
    next.nextAction = undefined
    next.nextActionDue = undefined
  }
  return next
}

/** Ids about to disappear, by collection. Absent sets mean "nothing of that kind". */
interface RemovedRefs {
  companies?: ReadonlySet<string>
  contacts?: ReadonlySet<string>
  opportunities?: ReadonlySet<string>
}

/** True when the touch has at least one link and every link points into `removed`. */
function touchOrphanedBy(touch: Touch, removed: RemovedRefs): boolean {
  let links = 0
  let hits = 0
  if (touch.companyId) {
    links += 1
    if (removed.companies?.has(touch.companyId)) hits += 1
  }
  if (touch.contactId) {
    links += 1
    if (removed.contacts?.has(touch.contactId)) hits += 1
  }
  if (touch.opportunityId) {
    links += 1
    if (removed.opportunities?.has(touch.opportunityId)) hits += 1
  }
  return links > 0 && hits === links
}

/** Clears links into `removed`; returns the same object when nothing pointed there. */
function unlinkTouch(touch: Touch, removed: RemovedRefs): Touch {
  const companyId =
    touch.companyId && removed.companies?.has(touch.companyId) ? undefined : touch.companyId
  const contactId =
    touch.contactId && removed.contacts?.has(touch.contactId) ? undefined : touch.contactId
  const opportunityId =
    touch.opportunityId && removed.opportunities?.has(touch.opportunityId)
      ? undefined
      : touch.opportunityId
  if (
    companyId === touch.companyId &&
    contactId === touch.contactId &&
    opportunityId === touch.opportunityId
  ) {
    return touch
  }
  return { ...touch, companyId, contactId, opportunityId }
}

/**
 * Drops orphaned touches and unlinks the rest. Returns null when the
 * collection would be unchanged, so the caller can keep its identity.
 */
function pruneTouches(touches: Touch[], removed: RemovedRefs): Touch[] | null {
  let changed = false
  const kept: Touch[] = []
  for (const touch of touches) {
    if (touchOrphanedBy(touch, removed)) {
      changed = true
      continue
    }
    const next = unlinkTouch(touch, removed)
    if (next !== touch) changed = true
    kept.push(next)
  }
  return changed ? kept : null
}

/** Follow-up tasks keep their text but lose a link into `removed`. Null when unchanged. */
function unlinkTasks(tasks: Task[], removed: RemovedRefs, now: string): Task[] | null {
  let changed = false
  const next = tasks.map((task) => {
    if (!task.link) return task
    const pool =
      task.link.kind === 'company'
        ? removed.companies
        : task.link.kind === 'contact'
          ? removed.contacts
          : removed.opportunities
    if (!pool?.has(task.link.id)) return task
    changed = true
    return { ...task, link: undefined, updatedAt: now }
  })
  return changed ? next : null
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

/* -- CSV cell readers ----------------------------------------------------- */

/** The first non-empty cell among the accepted header spellings. */
function cell(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[name]
    if (value !== undefined && value !== '') return value
  }
  return ''
}

function parseEnum<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  const key = value.trim().toLowerCase()
  return allowed.find((candidate) => candidate === key)
}

function parseKind(value: string): CompanyKind | undefined {
  const key = value.trim().toLowerCase().replace(/[^a-z]/g, '')
  if (!key) return undefined
  if (key === 'enterprise' || key === 'corporate' || key === 'bigtech') return 'mnc'
  return COMPANY_KINDS.find((kind) => kind === key)
}

function parseRemote(value: string): boolean | undefined {
  switch (value.trim().toLowerCase()) {
    case 'yes':
    case 'y':
    case 'true':
    case '1':
    case 'remote':
      return true
    case 'no':
    case 'n':
    case 'false':
    case '0':
    case 'onsite':
    case 'on-site':
      return false
    default:
      return undefined
  }
}

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of value.split(/[;,]/)) {
    const tag = part.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    tags.push(tag)
  }
  return tags
}

function mergeTags(current: string[], incoming: string[]): string[] {
  if (incoming.length === 0) return current
  const merged = current.slice()
  for (const tag of incoming) if (!merged.includes(tag)) merged.push(tag)
  return merged
}

/* -------------------------------------------------------------------------- *
 * Lock metadata, parked in localStorage next to the database
 * -------------------------------------------------------------------------- */

function readLockMeta(): LockMeta | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lock)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<LockMeta>
    if (typeof candidate.salt !== 'string' || !isEncryptedEnvelope(candidate.verifier)) return null
    return { v: 1, salt: candidate.salt, verifier: candidate.verifier }
  } catch {
    return null
  }
}

function writeLockMeta(meta: LockMeta): void {
  localStorage.setItem(STORAGE_KEYS.lock, JSON.stringify(meta))
}

function clearLockMeta(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.lock)
  } catch {
    // Nothing to do — the lock simply stays configured.
  }
}

/*
 * The unlocked key lives in sessionStorage, not the passphrase.
 *
 * The alternative is re-typing the passphrase on every reload, including every
 * hot reload during development, which is the kind of friction that gets a
 * privacy feature switched off. sessionStorage dies with the tab, so the window
 * is one browsing session on a machine that is already unlocked — the same
 * threat model the lock does not claim to defend against anyway.
 */
function readSessionKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.unlocked)
  } catch {
    return null
  }
}

async function writeSessionKey(key: CryptoKey): Promise<void> {
  try {
    sessionStorage.setItem(STORAGE_KEYS.unlocked, await exportKey(key))
  } catch {
    // Session storage blocked: the user re-enters the passphrase after reload.
  }
}

function clearSessionKey(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.unlocked)
  } catch {
    // Ignore.
  }
}

function hasLocalStorage(): boolean {
  try {
    const probe = `${STORAGE_KEYS.lock}.probe`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- *
 * The service
 * -------------------------------------------------------------------------- */

export class PersonalDataService implements PersonalActions {
  private db: PersonalDatabase = createEmptyDatabase()
  private status: PersonalStatus = 'loading'
  private errorMessage: string | undefined = undefined
  private listeners = new Set<() => void>()

  /** Where data physically goes. `adapter` may be an encrypting wrapper. */
  private baseAdapter: StorageAdapter | null = null
  private adapter: StorageAdapter | null = null

  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private pendingWrite = false
  private writeChain: Promise<void> = Promise.resolve()
  private initPromise: Promise<void> | null = null
  private lifecycleBound = false

  private lockMeta: LockMeta | null = null

  /**
   * Stable object: the boolean fields are mutated in place and every change is
   * paired with a snapshot bump, so React re-renders and reads the new values.
   */
  readonly lockApi: LockApi = {
    enabled: false,
    unlocked: true,
    enable: (passphrase) => this.enableLock(passphrase),
    disable: (passphrase) => this.disableLock(passphrase),
    unlock: (passphrase) => this.unlockWith(passphrase),
    lock: () => this.lockNow(),
    change: (current, next) => this.changePassphrase(current, next),
  }

  /* -- store surface ---------------------------------------------------- */

  /** Idempotent: repeated calls share one bootstrap. */
  init = (): Promise<void> => {
    if (!this.initPromise) this.initPromise = this.bootstrap()
    return this.initPromise
  }

  getSnapshot = (): PersonalDatabase => this.db

  getStatus = (): PersonalStatus => this.status

  getError = (): string | undefined => this.errorMessage

  getStorageName = (): string =>
    this.adapter?.name ?? this.baseAdapter?.name ?? 'Not connected'

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /* -- internals -------------------------------------------------------- */

  private emit = (): void => {
    for (const listener of this.listeners) listener()
  }

  /** The single place the document is replaced. */
  private commit = (patch: Partial<PersonalDatabase>): void => {
    this.db = { ...this.db, ...patch }
    this.emit()
    this.schedulePersist()
  }

  /** New snapshot identity without a data change (status / lock transitions). */
  private touch = (): void => {
    this.db = { ...this.db }
    this.emit()
  }

  private setStatus = (status: PersonalStatus, error?: string): void => {
    this.status = status
    this.errorMessage = error
    this.touch()
  }

  private setError = (message: string): void => {
    this.errorMessage = message
    this.touch()
  }

  private activeAdapter = (): StorageAdapter | null => this.adapter ?? this.baseAdapter

  private requireBaseAdapter = (): StorageAdapter => {
    if (!this.baseAdapter) {
      throw new Error('Storage is still starting up. Try again in a moment.')
    }
    return this.baseAdapter
  }

  private bootstrap = async (): Promise<void> => {
    this.bindLifecycle()
    this.baseAdapter = await createStorageAdapter().catch(() => createMemoryAdapter())
    this.adapter = this.baseAdapter

    this.lockMeta = readLockMeta()
    if (this.lockMeta) {
      this.lockApi.enabled = true
      const restored = await this.restoreSessionKey(this.lockMeta)
      if (!restored) {
        this.lockApi.unlocked = false
        this.setStatus('locked')
        return
      }
    }

    await this.loadFromAdapter()
  }

  /** Reuses the key parked by an earlier unlock in this same tab session. */
  private restoreSessionKey = async (meta: LockMeta): Promise<boolean> => {
    const stored = readSessionKey()
    if (!stored || !isCryptoAvailable()) return false
    try {
      const key = await importKey(stored)
      if (!(await checkVerifier(key, meta.verifier))) {
        clearSessionKey()
        return false
      }
      this.adapter = createEncryptedAdapter(this.requireBaseAdapter(), key, meta.salt)
      this.lockApi.unlocked = true
      return true
    } catch {
      clearSessionKey()
      return false
    }
  }

  private loadFromAdapter = async (): Promise<void> => {
    const adapter = this.activeAdapter()
    if (!adapter) {
      this.setStatus('error', 'No storage adapter is available.')
      return
    }
    try {
      const stored = await adapter.load()
      if (stored === null) {
        // Nothing on this device.
        //
        // This deliberately does NOT seed the demo dataset. `/dashboard` is a
        // public URL on a static host, so anyone can open it — and auto-seeding
        // meant a stranger landed in a fully populated dashboard addressed to
        // the owner by name. Nothing real leaked, but it read exactly like it
        // had, which is just as bad. An empty database sends the visitor to the
        // gate in `PersonalLayout` instead; demo data is now opt-in.
        this.db = createEmptyDatabase()
        this.setStatus('ready')
        return
      }

      const storedVersion =
        typeof (stored as { version?: unknown }).version === 'number'
          ? (stored as { version: number }).version
          : 0
      this.db = migrate(stored)
      this.setStatus('ready')
      if (storedVersion !== this.db.version) {
        // Persist the upgrade once, so the repair is not redone on every boot.
        this.pendingWrite = true
        await this.flush()
      }
    } catch (error) {
      this.setStatus(
        'error',
        describeError(error, 'Could not read the private database from this browser.'),
      )
    }
  }

  private bindLifecycle = (): void => {
    if (this.lifecycleBound || typeof window === 'undefined') return
    this.lifecycleBound = true
    const flushNow = (): void => {
      void this.flush()
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushNow()
    })
    // `pagehide` fires on bfcache navigations where `unload` does not.
    window.addEventListener('pagehide', flushNow)
  }

  private schedulePersist = (): void => {
    this.pendingWrite = true
    if (this.flushTimer !== null) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush()
    }, PERSIST_DEBOUNCE_MS)
  }

  /** Writes now if anything is pending. Writes are serialised, never parallel. */
  flush = (): Promise<void> => {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    const adapter = this.activeAdapter()
    if (!this.pendingWrite || !adapter || this.status === 'locked') return this.writeChain

    this.pendingWrite = false
    const snapshot = this.db
    this.writeChain = this.writeChain
      .catch(() => undefined)
      .then(() => adapter.save(snapshot))
      .catch((error: unknown) => {
        // Keep the data in memory and try again on the next mutation rather
        // than pretending the write succeeded.
        this.pendingWrite = true
        this.setError(describeError(error, 'Could not save to this browser’s storage.'))
      })
    return this.writeChain
  }

  private replaceIn = <T extends { id: string }>(
    items: T[],
    id: string,
    mutate: (item: T) => T,
  ): T[] | null => {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) return null
    const next = items.slice()
    next[index] = mutate(items[index])
    return next
  }

  private categoryIdOrDefault = (id?: string): string => {
    if (id && this.db.categories.some((category) => category.id === id)) return id
    const first =
      this.db.categories.find((category) => !category.archived) ?? this.db.categories[0]
    return first ? first.id : FALLBACK_CATEGORY_ID
  }

  private maxTaskOrder = (date: ISODate): number =>
    this.db.tasks.reduce((max, task) => (task.date === date ? Math.max(max, task.order) : max), 0)

  /* -- tasks ------------------------------------------------------------ */

  /** Fills in every default; shared by `addTask` and `scheduleFollowUp`. */
  private buildTask = (input: TaskInput): Task => {
    const now = nowTimestamp()
    return {
      id: uid('task'),
      date: input.date,
      title: input.title.trim() || 'Untitled task',
      description: input.description,
      categoryId: this.categoryIdOrDefault(input.categoryId),
      priority: input.priority ?? 'medium',
      status: input.status ?? 'not-started',
      estimatedMinutes: input.estimatedMinutes,
      actualMinutes: input.actualMinutes,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      notes: input.notes,
      order: input.order ?? this.maxTaskOrder(input.date) + 1,
      link: input.link,
      createdAt: now,
      updatedAt: now,
    }
  }

  addTask = (input: TaskInput): Task => {
    const task = this.buildTask(input)
    this.commit({ tasks: [...this.db.tasks, task] })
    return task
  }

  updateTask = (id: string, patch: Partial<Task>): void => {
    const tasks = this.replaceIn(this.db.tasks, id, (task) => ({
      ...task,
      ...patch,
      id: task.id,
      createdAt: task.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (tasks) this.commit({ tasks })
  }

  deleteTask = (id: string): void => {
    const tasks = this.db.tasks.filter((task) => task.id !== id)
    if (tasks.length !== this.db.tasks.length) this.commit({ tasks })
  }

  setTaskStatus = (id: string, status: TaskStatus): void => {
    const now = nowTimestamp()
    const tasks = this.replaceIn(this.db.tasks, id, (task) => {
      const next: Task = { ...task, status, updatedAt: now }

      if (status === 'in-progress' && !next.startedAt) {
        next.startedAt = now
      }

      if (status === 'completed') {
        next.completedAt = now
        // A task that was started and never timed gets its duration for free.
        if (next.startedAt && next.actualMinutes === undefined) {
          const elapsed = minutesBetween(next.startedAt, now)
          if (elapsed > 0) next.actualMinutes = elapsed
        }
      } else {
        // Anything that is not "completed" has no completion time.
        next.completedAt = undefined
        if (status === 'not-started') {
          // Back to the start line: it was never begun either.
          next.startedAt = undefined
        }
      }

      return next
    })
    if (tasks) this.commit({ tasks })
  }

  reorderTasks = (date: ISODate, orderedIds: string[]): void => {
    const positions = new Map(orderedIds.map((id, index) => [id, index + 1]))
    if (positions.size === 0) return
    const now = nowTimestamp()
    let changed = false
    const tasks = this.db.tasks.map((task) => {
      if (task.date !== date) return task
      const order = positions.get(task.id)
      if (order === undefined || order === task.order) return task
      changed = true
      return { ...task, order, updatedAt: now }
    })
    if (changed) this.commit({ tasks })
  }

  rolloverTasks = (from: ISODate, to: ISODate): number => {
    const carried = this.db.tasks.filter(
      (task) => task.date === from && task.status !== 'completed' && task.status !== 'skipped',
    )
    if (carried.length === 0) return 0

    const now = nowTimestamp()
    let order = this.maxTaskOrder(to)
    const copies: Task[] = carried.map((task) => {
      order += 1
      return {
        ...task,
        id: uid('task'),
        date: to,
        status: 'not-started',
        startedAt: undefined,
        completedAt: undefined,
        actualMinutes: undefined,
        order,
        createdAt: now,
        updatedAt: now,
      }
    })
    this.commit({ tasks: [...this.db.tasks, ...copies] })
    return copies.length
  }

  /* -- work log --------------------------------------------------------- */

  addLog = (input: LogInput): LogEntry => {
    const now = nowTimestamp()
    const entry: LogEntry = {
      id: uid('log'),
      date: input.date,
      time: input.time ?? nowClockTime(),
      activity: input.activity.trim() || 'Untitled entry',
      categoryId: this.categoryIdOrDefault(input.categoryId),
      durationMinutes: Math.max(0, Math.round(input.durationMinutes ?? 30)),
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ logs: [...this.db.logs, entry] })
    return entry
  }

  updateLog = (id: string, patch: Partial<LogEntry>): void => {
    const logs = this.replaceIn(this.db.logs, id, (entry) => ({
      ...entry,
      ...patch,
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (logs) this.commit({ logs })
  }

  deleteLog = (id: string): void => {
    const logs = this.db.logs.filter((entry) => entry.id !== id)
    if (logs.length !== this.db.logs.length) this.commit({ logs })
  }

  /* -- goals ------------------------------------------------------------ */

  addWeeklyGoal = (input: WeeklyGoalInput): WeeklyGoal => {
    const now = nowTimestamp()
    const goal: WeeklyGoal = {
      id: uid('wgoal'),
      weekKey: input.weekKey,
      title: input.title.trim() || 'Untitled goal',
      description: input.description,
      categoryId: this.categoryIdOrDefault(input.categoryId),
      priority: input.priority ?? 'medium',
      targetValue: Math.max(1, Math.round(input.targetValue ?? 1)),
      currentValue: Math.max(0, Math.round(input.currentValue ?? 0)),
      unit: input.unit ?? '',
      deadline: input.deadline,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ weeklyGoals: [...this.db.weeklyGoals, goal] })
    return goal
  }

  updateWeeklyGoal = (id: string, patch: Partial<WeeklyGoal>): void => {
    const weeklyGoals = this.replaceIn(this.db.weeklyGoals, id, (goal) =>
      applyGoalPatch(goal, patch),
    )
    if (weeklyGoals) this.commit({ weeklyGoals })
  }

  deleteWeeklyGoal = (id: string): void => {
    const weeklyGoals = this.db.weeklyGoals.filter((goal) => goal.id !== id)
    if (weeklyGoals.length !== this.db.weeklyGoals.length) this.commit({ weeklyGoals })
  }

  addMonthlyGoal = (input: MonthlyGoalInput): MonthlyGoal => {
    const now = nowTimestamp()
    const goal: MonthlyGoal = {
      id: uid('mgoal'),
      monthKey: input.monthKey,
      title: input.title.trim() || 'Untitled goal',
      description: input.description,
      categoryId: this.categoryIdOrDefault(input.categoryId),
      priority: input.priority ?? 'medium',
      targetValue: Math.max(1, Math.round(input.targetValue ?? 1)),
      currentValue: Math.max(0, Math.round(input.currentValue ?? 0)),
      unit: input.unit ?? '',
      deadline: input.deadline,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ monthlyGoals: [...this.db.monthlyGoals, goal] })
    return goal
  }

  updateMonthlyGoal = (id: string, patch: Partial<MonthlyGoal>): void => {
    const monthlyGoals = this.replaceIn(this.db.monthlyGoals, id, (goal) =>
      applyGoalPatch(goal, patch),
    )
    if (monthlyGoals) this.commit({ monthlyGoals })
  }

  deleteMonthlyGoal = (id: string): void => {
    const monthlyGoals = this.db.monthlyGoals.filter((goal) => goal.id !== id)
    if (monthlyGoals.length !== this.db.monthlyGoals.length) this.commit({ monthlyGoals })
  }

  carryOverWeeklyGoals = (from: WeekKey, to: WeekKey): number => {
    const unfinished = this.db.weeklyGoals.filter(
      (goal) => goal.weekKey === from && (goal.status === 'active' || goal.status === 'missed'),
    )
    if (unfinished.length === 0) return 0

    const alreadyThere = new Set(
      this.db.weeklyGoals
        .filter((goal) => goal.weekKey === to)
        .map((goal) => goal.title.trim().toLowerCase()),
    )
    const now = nowTimestamp()
    const copies: WeeklyGoal[] = unfinished
      .filter((goal) => !alreadyThere.has(goal.title.trim().toLowerCase()))
      .map((goal) => ({
        ...goal,
        id: uid('wgoal'),
        weekKey: to,
        // A weekly goal counts a week's worth of work, so the tally restarts.
        currentValue: 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      }))
    if (copies.length === 0) return 0
    this.commit({ weeklyGoals: [...this.db.weeklyGoals, ...copies] })
    return copies.length
  }

  /* -- habits ----------------------------------------------------------- */

  addHabit = (input: HabitInput): Habit => {
    const categoryId = this.categoryIdOrDefault(input.categoryId)
    const category = this.db.categories.find((entry) => entry.id === categoryId)
    const habit: Habit = {
      id: uid('habit'),
      name: input.name.trim() || 'Untitled habit',
      categoryId,
      color: input.color ?? category?.color ?? nextCategoryColor(this.db.habits),
      targetPerWeek: Math.min(7, Math.max(1, Math.round(input.targetPerWeek ?? 5))),
      dailyTarget: Math.max(1, Math.round(input.dailyTarget ?? 1)),
      unit: input.unit,
      order:
        input.order ?? this.db.habits.reduce((max, entry) => Math.max(max, entry.order), 0) + 1,
      archived: input.archived ?? false,
      createdAt: nowTimestamp(),
    }
    this.commit({ habits: [...this.db.habits, habit] })
    return habit
  }

  updateHabit = (id: string, patch: Partial<Habit>): void => {
    const habits = this.replaceIn(this.db.habits, id, (habit) => ({
      ...habit,
      ...patch,
      id: habit.id,
      createdAt: habit.createdAt,
    }))
    if (habits) this.commit({ habits })
  }

  deleteHabit = (id: string): void => {
    const habits = this.db.habits.filter((habit) => habit.id !== id)
    if (habits.length === this.db.habits.length) return
    // Entries for a deleted habit can never be rendered again.
    this.commit({
      habits,
      habitEntries: this.db.habitEntries.filter((entry) => entry.habitId !== id),
    })
  }

  reorderHabits = (orderedIds: string[]): void => {
    const positions = new Map(orderedIds.map((id, index) => [id, index + 1]))
    if (positions.size === 0) return
    let changed = false
    const habits = this.db.habits.map((habit) => {
      const order = positions.get(habit.id)
      if (order === undefined || order === habit.order) return habit
      changed = true
      return { ...habit, order }
    })
    if (changed) this.commit({ habits })
  }

  setHabitEntry = (habitId: string, date: ISODate, value: number, note?: string): HabitEntry => {
    const entry: HabitEntry = {
      id: `${habitId}::${date}`,
      habitId,
      date,
      value: Math.max(0, Math.round(value)),
      note,
      updatedAt: nowTimestamp(),
    }
    // Guard against writing an orphan the loader would drop on the next boot.
    if (!this.db.habits.some((habit) => habit.id === habitId)) return entry

    const index = this.db.habitEntries.findIndex((existing) => existing.id === entry.id)
    if (index === -1) {
      this.commit({ habitEntries: [...this.db.habitEntries, entry] })
    } else {
      const habitEntries = this.db.habitEntries.slice()
      habitEntries[index] = entry
      this.commit({ habitEntries })
    }
    return entry
  }

  toggleHabit = (habitId: string, date: ISODate): void => {
    const habit = this.db.habits.find((entry) => entry.id === habitId)
    if (!habit) return
    const current = this.db.habitEntries.find((entry) => entry.id === `${habitId}::${date}`)
    const done = (current?.value ?? 0) >= habit.dailyTarget
    this.setHabitEntry(habitId, date, done ? 0 : habit.dailyTarget, current?.note)
  }

  /* -- weekly review ---------------------------------------------------- */

  saveReview = (weekKey: WeekKey, patch: Partial<WeeklyReview>): WeeklyReview => {
    const existing = this.db.reviews.find((review) => review.weekKey === weekKey)
    const review: WeeklyReview = {
      id: weekKey,
      weekKey,
      wentWell: patch.wentWell ?? existing?.wentWell ?? '',
      wentWrong: patch.wentWrong ?? existing?.wentWrong ?? '',
      learned: patch.learned ?? existing?.learned ?? '',
      improve: patch.improve ?? existing?.improve ?? '',
      biggestAchievement: patch.biggestAchievement ?? existing?.biggestAchievement ?? '',
      biggestMistake: patch.biggestMistake ?? existing?.biggestMistake ?? '',
      nextWeekFocus: patch.nextWeekFocus ?? existing?.nextWeekFocus ?? '',
      rating: patch.rating ?? existing?.rating,
      updatedAt: nowTimestamp(),
    }
    const index = this.db.reviews.findIndex((entry) => entry.weekKey === weekKey)
    if (index === -1) {
      this.commit({ reviews: [...this.db.reviews, review] })
    } else {
      const reviews = this.db.reviews.slice()
      reviews[index] = review
      this.commit({ reviews })
    }
    return review
  }

  /* -- notes ------------------------------------------------------------ */

  addNote = (input: NoteInput): Note => {
    const now = nowTimestamp()
    const note: Note = {
      id: uid('note'),
      date: input.date ?? todayISO(),
      title: input.title.trim() || 'Untitled note',
      body: input.body ?? '',
      tags: input.tags ?? [],
      pinned: input.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ notes: [...this.db.notes, note] })
    return note
  }

  updateNote = (id: string, patch: Partial<Note>): void => {
    const notes = this.replaceIn(this.db.notes, id, (note) => ({
      ...note,
      ...patch,
      id: note.id,
      createdAt: note.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (notes) this.commit({ notes })
  }

  deleteNote = (id: string): void => {
    const notes = this.db.notes.filter((note) => note.id !== id)
    if (notes.length !== this.db.notes.length) this.commit({ notes })
  }

  /* -- day header ------------------------------------------------------- */

  setDayMeta = (date: ISODate, patch: Partial<Omit<DayMeta, 'id' | 'date'>>): void => {
    const index = this.db.days.findIndex((day) => day.date === date)
    const existing = index === -1 ? undefined : this.db.days[index]
    const day: DayMeta = {
      id: date,
      date,
      objective: patch.objective ?? existing?.objective ?? '',
      mood: patch.mood ?? existing?.mood,
      energy: patch.energy ?? existing?.energy,
      highlight: patch.highlight ?? existing?.highlight,
      updatedAt: nowTimestamp(),
    }
    if (index === -1) {
      this.commit({ days: [...this.db.days, day] })
    } else {
      const days = this.db.days.slice()
      days[index] = day
      this.commit({ days })
    }
  }

  /* -- categories & settings -------------------------------------------- */

  addCategory = (input: CategoryInput): Category => {
    const category: Category = {
      id: uid('cat'),
      label: input.label.trim() || 'Untitled',
      color: input.color ?? nextCategoryColor(this.db.categories),
      icon: input.icon,
      archived: input.archived ?? false,
    }
    this.commit({ categories: [...this.db.categories, category] })
    return category
  }

  updateCategory = (id: string, patch: Partial<Category>): void => {
    const categories = this.replaceIn(this.db.categories, id, (category) => ({
      ...category,
      ...patch,
      id: category.id,
    }))
    if (categories) this.commit({ categories })
  }

  deleteCategory = (id: string): boolean => {
    const referenced =
      this.db.tasks.some((task) => task.categoryId === id) ||
      this.db.logs.some((entry) => entry.categoryId === id) ||
      this.db.weeklyGoals.some((goal) => goal.categoryId === id) ||
      this.db.monthlyGoals.some((goal) => goal.categoryId === id) ||
      this.db.habits.some((habit) => habit.categoryId === id)
    // Deleting a referenced category would orphan records the UI cannot draw,
    // so this refuses instead. Archiving is the intended alternative.
    if (referenced) return false
    if (this.db.categories.length <= 1) return false

    const categories = this.db.categories.filter((category) => category.id !== id)
    if (categories.length === this.db.categories.length) return false
    this.commit({ categories })
    return true
  }

  updateSettings = (patch: Partial<PersonalSettings>): void => {
    this.commit({ settings: normalizeSettings({ ...this.db.settings, ...patch }) })
  }

  /* -- outreach: companies ---------------------------------------------- */

  private companyById = (id: string | undefined): Company | undefined =>
    id ? this.db.companies.find((company) => company.id === id) : undefined

  private contactById = (id: string | undefined): Contact | undefined =>
    id ? this.db.contacts.find((contact) => contact.id === id) : undefined

  private opportunityById = (id: string | undefined): Opportunity | undefined =>
    id ? this.db.opportunities.find((opportunity) => opportunity.id === id) : undefined

  addCompany = (input: CompanyInput): Company => {
    const now = nowTimestamp()
    const company: Company = {
      id: uid('company'),
      name: input.name.trim() || 'Untitled company',
      website: input.website,
      careersUrl: input.careersUrl,
      linkedinUrl: input.linkedinUrl,
      kind: input.kind ?? 'startup',
      stage: input.stage,
      size: input.size,
      location: input.location,
      remote: input.remote ?? false,
      industry: input.industry,
      why: input.why,
      facts: input.facts ?? [],
      fit: input.fit ?? {},
      priority: input.priority ?? 'medium',
      tags: input.tags ?? [],
      archived: input.archived ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ companies: [...this.db.companies, company] })
    return company
  }

  updateCompany = (id: string, patch: Partial<Company>): void => {
    const companies = this.replaceIn(this.db.companies, id, (company) => ({
      ...company,
      ...patch,
      id: company.id,
      createdAt: company.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (companies) this.commit({ companies })
  }

  /** Everything `deleteCompany` would touch, so the confirm dialog can say so first. */
  companyFootprint = (id: string): { opportunities: number; touches: number; contacts: number } => {
    const opportunityIds = new Set(
      this.db.opportunities.filter((o) => o.companyId === id).map((o) => o.id),
    )
    const removed: RemovedRefs = { companies: new Set([id]), opportunities: opportunityIds }
    return {
      opportunities: opportunityIds.size,
      touches: this.db.touches.filter((touch) => touchOrphanedBy(touch, removed)).length,
      contacts: this.db.contacts.filter((contact) => contact.companyId === id).length,
    }
  }

  deleteCompany = (id: string): { opportunities: number; touches: number; contacts: number } => {
    if (!this.companyById(id)) return { opportunities: 0, touches: 0, contacts: 0 }
    const footprint = this.companyFootprint(id)
    const now = nowTimestamp()
    const opportunityIds = new Set(
      this.db.opportunities.filter((o) => o.companyId === id).map((o) => o.id),
    )
    const removed: RemovedRefs = { companies: new Set([id]), opportunities: opportunityIds }

    const patch: Partial<PersonalDatabase> = {
      companies: this.db.companies.filter((company) => company.id !== id),
    }
    if (opportunityIds.size > 0) {
      patch.opportunities = this.db.opportunities.filter((o) => !opportunityIds.has(o.id))
    }
    if (footprint.contacts > 0) {
      // Contacts outlive the company: a person is worth keeping even when the
      // account is not.
      patch.contacts = this.db.contacts.map((contact) =>
        contact.companyId === id ? { ...contact, companyId: undefined, updatedAt: now } : contact,
      )
    }
    const touches = pruneTouches(this.db.touches, removed)
    if (touches) patch.touches = touches
    const tasks = unlinkTasks(this.db.tasks, removed, now)
    if (tasks) patch.tasks = tasks

    this.commit(patch)
    return footprint
  }

  addCompanyFact = (companyId: string, text: string, sourceUrl?: string): CompanyFact => {
    const fact: CompanyFact = {
      id: uid('fact'),
      text: text.trim(),
      sourceUrl: sourceUrl?.trim() || undefined,
      addedAt: nowTimestamp(),
    }
    // An empty fact is nothing to remember; the form disables the button, this
    // is the belt to that brace.
    if (!fact.text) return fact
    const companies = this.replaceIn(this.db.companies, companyId, (company) => ({
      ...company,
      facts: [...company.facts, fact],
      updatedAt: fact.addedAt,
    }))
    if (companies) this.commit({ companies })
    return fact
  }

  removeCompanyFact = (companyId: string, factId: string): void => {
    const company = this.companyById(companyId)
    if (!company || !company.facts.some((fact) => fact.id === factId)) return
    const companies = this.replaceIn(this.db.companies, companyId, (current) => ({
      ...current,
      facts: current.facts.filter((fact) => fact.id !== factId),
      updatedAt: nowTimestamp(),
    }))
    if (companies) this.commit({ companies })
  }

  setCompanyFit = (companyId: string, criterionId: string, value: FitValue): void => {
    // Only 0, 1 and 2 mean anything; anything else is treated as "no".
    const clean: FitValue = value === 2 ? 2 : value === 1 ? 1 : 0
    const company = this.companyById(companyId)
    if (!company || company.fit[criterionId] === clean) return
    const companies = this.replaceIn(this.db.companies, companyId, (current) => ({
      ...current,
      fit: { ...current.fit, [criterionId]: clean },
      updatedAt: nowTimestamp(),
    }))
    if (companies) this.commit({ companies })
  }

  /* -- outreach: contacts ----------------------------------------------- */

  addContact = (input: ContactInput): Contact => {
    const now = nowTimestamp()
    const contact: Contact = {
      id: uid('contact'),
      // Never write a link the loader would drop on the next boot.
      companyId: this.companyById(input.companyId)?.id,
      name: input.name.trim() || 'Unnamed contact',
      role: input.role,
      linkedinUrl: input.linkedinUrl,
      email: input.email,
      warmth: input.warmth ?? 'cold',
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ contacts: [...this.db.contacts, contact] })
    return contact
  }

  updateContact = (id: string, patch: Partial<Contact>): void => {
    const contacts = this.replaceIn(this.db.contacts, id, (contact) => ({
      ...contact,
      ...patch,
      id: contact.id,
      createdAt: contact.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (contacts) this.commit({ contacts })
  }

  deleteContact = (id: string): void => {
    const contacts = this.db.contacts.filter((contact) => contact.id !== id)
    if (contacts.length === this.db.contacts.length) return
    const now = nowTimestamp()
    const removed: RemovedRefs = { contacts: new Set([id]) }
    const patch: Partial<PersonalDatabase> = { contacts }

    // The history stays; only the person is gone from it.
    if (this.db.touches.some((touch) => touch.contactId === id)) {
      patch.touches = this.db.touches.map((touch) =>
        touch.contactId === id ? { ...touch, contactId: undefined } : touch,
      )
    }
    if (this.db.opportunities.some((o) => o.contactId === id)) {
      patch.opportunities = this.db.opportunities.map((o) =>
        o.contactId === id ? { ...o, contactId: undefined, updatedAt: now } : o,
      )
    }
    const tasks = unlinkTasks(this.db.tasks, removed, now)
    if (tasks) patch.tasks = tasks

    this.commit(patch)
  }

  /* -- outreach: opportunities ------------------------------------------ */

  addOpportunity = (input: OpportunityInput): Opportunity => {
    if (!this.companyById(input.companyId)) {
      // Writing an orphan would only have it dropped on the next load.
      throw new Error('That company no longer exists. Add the company first.')
    }
    const now = nowTimestamp()
    const stage = input.stage ?? 'researching'
    const terminal = TERMINAL_STAGES.has(stage)
    const opportunity: Opportunity = {
      id: uid('opp'),
      companyId: input.companyId,
      contactId: this.contactById(input.contactId)?.id,
      title: input.title.trim() || 'Untitled role',
      type: input.type ?? 'internship',
      stage,
      source: input.source ?? 'cold',
      jobUrl: input.jobUrl,
      // A role added straight into a post-application stage was applied to at
      // some point; today is the only defensible default, and it is editable.
      appliedAt: input.appliedAt ?? (APPLIED_STAGES.has(stage) ? todayISO() : undefined),
      nextAction: terminal ? undefined : input.nextAction,
      nextActionDue: terminal ? undefined : input.nextActionDue,
      priority: input.priority ?? 'medium',
      compensation: input.compensation,
      resumeVersion: input.resumeVersion ?? this.db.outreach.defaultResumeVersion,
      notes: input.notes,
      stageHistory:
        input.stageHistory && input.stageHistory.length > 0
          ? input.stageHistory
          : [{ stage, at: now }],
      closedAt: terminal ? now : undefined,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ opportunities: [...this.db.opportunities, opportunity] })
    return opportunity
  }

  updateOpportunity = (id: string, patch: Partial<Opportunity>): void => {
    const opportunities = this.replaceIn(this.db.opportunities, id, (opportunity) => ({
      ...opportunity,
      ...patch,
      id: opportunity.id,
      createdAt: opportunity.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (opportunities) this.commit({ opportunities })
  }

  deleteOpportunity = (id: string): void => {
    const opportunities = this.db.opportunities.filter((o) => o.id !== id)
    if (opportunities.length === this.db.opportunities.length) return
    const removed: RemovedRefs = { opportunities: new Set([id]) }
    const patch: Partial<PersonalDatabase> = { opportunities }
    const touches = pruneTouches(this.db.touches, removed)
    if (touches) patch.touches = touches
    const tasks = unlinkTasks(this.db.tasks, removed, nowTimestamp())
    if (tasks) patch.tasks = tasks
    this.commit(patch)
  }

  setOpportunityStage = (id: string, stage: OpportunityStage): void => {
    const current = this.opportunityById(id)
    if (!current || current.stage === stage) return
    const now = nowTimestamp()
    const opportunities = this.replaceIn(this.db.opportunities, id, (opportunity) =>
      advanceStage(opportunity, stage, now),
    )
    if (opportunities) this.commit({ opportunities })
  }

  scheduleFollowUp = (opportunityId: string, date: ISODate, title?: string): Task => {
    const opportunity = this.opportunityById(opportunityId)
    if (!opportunity) {
      throw new Error('That opportunity no longer exists.')
    }
    const company = this.companyById(opportunity.companyId)
    const taskTitle =
      title?.trim() || `Follow up: ${company?.name ?? 'Unknown company'} — ${opportunity.title}`
    const task = this.buildTask({
      title: taskTitle,
      date,
      categoryId: this.categoryIdOrDefault(CAREER_CATEGORY_ID),
      priority: 'medium',
      link: { kind: 'opportunity', id: opportunityId },
    })
    const opportunities = this.replaceIn(this.db.opportunities, opportunityId, (current) => ({
      ...current,
      nextAction: taskTitle,
      nextActionDue: date,
      updatedAt: task.createdAt,
    }))
    // One commit, so the Today page and the pipeline update in the same tick.
    this.commit({
      tasks: [...this.db.tasks, task],
      ...(opportunities ? { opportunities } : {}),
    })
    return task
  }

  /* -- outreach: touches ------------------------------------------------ */

  addTouch = (input: TouchInput): Touch => {
    const now = nowTimestamp()
    const today = todayISO()
    const date = input.date ?? today
    const opportunity = this.opportunityById(input.opportunityId)
    const contact = this.contactById(input.contactId)
    // Every link is checked, and the company is inferred from the opportunity
    // or the contact when it was not given — an opportunity belongs to exactly
    // one company, so this is never a guess.
    const companyId =
      this.companyById(input.companyId)?.id ?? opportunity?.companyId ?? contact?.companyId
    const touch: Touch = {
      id: uid('touch'),
      date,
      time: input.time ?? (date === today ? nowClockTime() : undefined),
      channel: input.channel,
      direction: input.direction,
      companyId,
      contactId: contact?.id,
      opportunityId: opportunity?.id,
      summary: input.summary.trim() || 'No summary',
      templateId: input.templateId,
      outcome: input.outcome,
      createdAt: now,
    }

    // Logging an interaction is evidence the pipeline moved. Only forwards,
    // only out of the two earliest stages, and never once it is closed.
    let opportunities: Opportunity[] | null = null
    if (opportunity && !TERMINAL_STAGES.has(opportunity.stage)) {
      let target: OpportunityStage | null = null
      if (input.direction === 'outbound' && opportunity.stage === 'researching') {
        target = 'contacted'
      } else if (
        input.direction === 'inbound' &&
        (opportunity.stage === 'researching' || opportunity.stage === 'contacted')
      ) {
        target = 'replied'
      }
      if (target) {
        const nextStage = target
        opportunities = this.replaceIn(this.db.opportunities, opportunity.id, (current) =>
          advanceStage(current, nextStage, now),
        )
      }
    }

    this.commit({
      touches: [...this.db.touches, touch],
      ...(opportunities ? { opportunities } : {}),
    })
    return touch
  }

  updateTouch = (id: string, patch: Partial<Touch>): void => {
    const touches = this.replaceIn(this.db.touches, id, (touch) => ({
      ...touch,
      ...patch,
      id: touch.id,
      createdAt: touch.createdAt,
    }))
    if (touches) this.commit({ touches })
  }

  deleteTouch = (id: string): void => {
    const touches = this.db.touches.filter((touch) => touch.id !== id)
    if (touches.length !== this.db.touches.length) this.commit({ touches })
  }

  /* -- outreach: templates & settings ----------------------------------- */

  addTemplate = (input: TemplateInput): MessageTemplate => {
    const now = nowTimestamp()
    const template: MessageTemplate = {
      id: uid('tpl'),
      name: input.name.trim() || 'Untitled template',
      channel: input.channel ?? 'email',
      purpose: input.purpose ?? 'cold',
      subject: input.subject,
      body: input.body,
      archived: input.archived ?? false,
      createdAt: now,
      updatedAt: now,
    }
    this.commit({ templates: [...this.db.templates, template] })
    return template
  }

  updateTemplate = (id: string, patch: Partial<MessageTemplate>): void => {
    const templates = this.replaceIn(this.db.templates, id, (template) => ({
      ...template,
      ...patch,
      id: template.id,
      createdAt: template.createdAt,
      updatedAt: nowTimestamp(),
    }))
    if (templates) this.commit({ templates })
  }

  deleteTemplate = (id: string): void => {
    // Touches keep their `templateId` on purpose: the response rate of a
    // message that was sent thirty times is history, not configuration.
    const templates = this.db.templates.filter((template) => template.id !== id)
    if (templates.length !== this.db.templates.length) this.commit({ templates })
  }

  updateOutreach = (patch: Partial<OutreachSettings>): void => {
    this.commit({ outreach: normalizeOutreachSettings({ ...this.db.outreach, ...patch }) })
  }

  /* -- outreach: import / export ---------------------------------------- */

  importOutreachCsv = async (kind: OutreachCsvKind, csv: string): Promise<ImportSummary> => {
    const table = parseCsvTable(csv)
    if (!table.headers.includes('name')) {
      throw new Error(
        `The first row must be a header row with at least a "name" column. Found: ${
          table.headers.filter(Boolean).join(', ') || 'nothing usable'
        }.`,
      )
    }
    const summary: ImportSummary = { added: 0, updated: 0, skipped: 0 }
    const now = nowTimestamp()

    // Both imports work on a copy keyed by lower-cased name, so a duplicate
    // later in the same file updates the row that was added a moment earlier.
    const companies = this.db.companies.slice()
    const companyIndex = new Map(companies.map((c, index) => [normalizeName(c.name), index]))
    let companiesChanged = false

    const ensureCompany = (name: string, draft: Partial<Company>): Company => {
      const key = normalizeName(name)
      const index = companyIndex.get(key)
      if (index !== undefined) {
        const next: Company = { ...companies[index], ...draft, updatedAt: now }
        companies[index] = next
        companiesChanged = true
        return next
      }
      const company: Company = {
        id: uid('company'),
        name: name.trim(),
        kind: 'other',
        remote: false,
        facts: [],
        fit: {},
        priority: 'medium',
        tags: [],
        archived: false,
        ...draft,
        createdAt: now,
        updatedAt: now,
      }
      companyIndex.set(key, companies.length)
      companies.push(company)
      companiesChanged = true
      return company
    }

    if (kind === 'companies') {
      for (const row of table.rows) {
        const name = cell(row, 'name').trim()
        if (!name) {
          summary.skipped += 1
          continue
        }
        const existing = companyIndex.get(normalizeName(name))
        const current = existing === undefined ? undefined : companies[existing]
        const draft: Partial<Company> = {}

        const website = cell(row, 'website', 'url', 'site')
        if (website) draft.website = website
        const companyKind = parseKind(cell(row, 'kind', 'type'))
        if (companyKind) draft.kind = companyKind
        const stage = cell(row, 'stage', 'funding', 'funding stage')
        if (stage) draft.stage = stage
        const size = parseEnum(cell(row, 'size', 'headcount', 'employees'), COMPANY_SIZES)
        if (size) draft.size = size
        const location = cell(row, 'location', 'city', 'hq')
        if (location) draft.location = location
        const remote = parseRemote(cell(row, 'remote'))
        if (remote !== undefined) draft.remote = remote
        const industry = cell(row, 'industry', 'sector')
        if (industry) draft.industry = industry
        const why = cell(row, 'why', 'notes')
        if (why) draft.why = why
        const tags = parseTags(cell(row, 'tags', 'tag'))
        if (tags.length > 0) draft.tags = current ? mergeTags(current.tags, tags) : tags
        const priority = parseEnum(cell(row, 'priority'), PRIORITIES)
        if (priority) draft.priority = priority

        ensureCompany(name, draft)
        if (current) summary.updated += 1
        else summary.added += 1
      }
      if (companiesChanged) this.commit({ companies })
      await this.flush()
      return summary
    }

    const contacts = this.db.contacts.slice()
    let contactsChanged = false
    // A name alone is ambiguous across companies, so the match narrows to the
    // company when the row names one and falls back to the first name match.
    const findContact = (name: string, companyId: string | undefined): number => {
      const key = normalizeName(name)
      const scoped = companyId
        ? contacts.findIndex((c) => normalizeName(c.name) === key && c.companyId === companyId)
        : -1
      if (scoped !== -1) return scoped
      return contacts.findIndex((c) => normalizeName(c.name) === key)
    }
    // An existing company is left alone — a mention in a contact file is not
    // an edit — and a missing one is created with the minimum, kind 'other'.
    const ensureCompanyByName = (companyName: string): string => {
      const index = companyIndex.get(normalizeName(companyName))
      if (index !== undefined) return companies[index].id
      return ensureCompany(companyName, {}).id
    }

    for (const row of table.rows) {
      const name = cell(row, 'name', 'contact', 'full name').trim()
      if (!name) {
        summary.skipped += 1
        continue
      }
      const companyName = cell(row, 'company', 'company name', 'organisation', 'organization')
      const companyId = companyName ? ensureCompanyByName(companyName) : undefined
      const index = findContact(name, companyId)
      const current = index === -1 ? undefined : contacts[index]
      const draft: Partial<Contact> = {}

      if (companyId) draft.companyId = companyId
      const role = cell(row, 'role', 'title', 'position')
      if (role) draft.role = role
      const email = cell(row, 'email', 'e-mail', 'mail')
      if (email) draft.email = email
      const linkedin = cell(row, 'linkedin', 'linkedin url', 'linkedin_url', 'linkedinurl', 'profile')
      if (linkedin) draft.linkedinUrl = linkedin
      const warmth = parseEnum(cell(row, 'warmth'), CONTACT_WARMTHS)
      if (warmth) draft.warmth = warmth
      const notes = cell(row, 'notes', 'note')
      if (notes) draft.notes = notes

      if (current) {
        contacts[index] = { ...current, ...draft, updatedAt: now }
        summary.updated += 1
      } else {
        contacts.push({
          id: uid('contact'),
          name,
          warmth: 'cold',
          ...draft,
          createdAt: now,
          updatedAt: now,
        })
        summary.added += 1
      }
      contactsChanged = true
    }

    const patch: Partial<PersonalDatabase> = {}
    if (companiesChanged) patch.companies = companies
    if (contactsChanged) patch.contacts = contacts
    if (companiesChanged || contactsChanged) this.commit(patch)
    await this.flush()
    return summary
  }

  exportOutreachCsv = (kind: OutreachCsvKind): string => {
    if (kind === 'companies') {
      return serializeCsv(
        COMPANY_CSV_COLUMNS,
        this.db.companies.map((company) => [
          company.name,
          company.website ?? '',
          company.kind,
          company.stage ?? '',
          company.size ?? '',
          company.location ?? '',
          company.remote ? 'yes' : 'no',
          company.industry ?? '',
          company.why ?? '',
          company.tags.join('; '),
          company.priority,
        ]),
      )
    }
    const companyName = new Map(this.db.companies.map((company) => [company.id, company.name]))
    return serializeCsv(
      CONTACT_CSV_COLUMNS,
      this.db.contacts.map((contact) => [
        contact.name,
        contact.role ?? '',
        contact.companyId ? (companyName.get(contact.companyId) ?? '') : '',
        contact.email ?? '',
        contact.linkedinUrl ?? '',
        contact.warmth,
        contact.notes ?? '',
      ]),
    )
  }

  /* -- whole-database operations ---------------------------------------- */

  exportJson = (): string =>
    JSON.stringify({ app: APP_NAME, exportedAt: nowTimestamp(), ...this.db }, null, 2)

  importJson = async (json: string, mode: ImportMode): Promise<ImportSummary> => {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('That file is not valid JSON.')
    }

    // Everything imported goes through the same repair pass as a stored
    // document, so an old or hand-edited backup cannot break the dashboard.
    const incoming = migrate(parsed)
    const rawDocument = unwrapDocument(parsed)
    const incomingHasOutreach =
      rawDocument !== null &&
      typeof rawDocument.outreach === 'object' &&
      rawDocument.outreach !== null

    if (mode === 'replace') {
      const summary: ImportSummary = { added: countRecords(incoming), updated: 0, skipped: 0 }
      this.db = incoming
      this.emit()
      this.pendingWrite = true
      await this.flush()
      return summary
    }

    const counters: MergeCounters = { added: 0, updated: 0, skipped: 0 }
    const merged: PersonalDatabase = {
      ...this.db,
      categories: mergeCollection(
        this.db.categories,
        incoming.categories,
        // Categories carry no timestamps: keep the local one, add new ones.
        () => 0,
        counters,
      ),
      tasks: mergeCollection(this.db.tasks, incoming.tasks, (t) => timeOf(t.updatedAt), counters),
      logs: mergeCollection(this.db.logs, incoming.logs, (l) => timeOf(l.updatedAt), counters),
      weeklyGoals: mergeCollection(
        this.db.weeklyGoals,
        incoming.weeklyGoals,
        (g) => timeOf(g.updatedAt),
        counters,
      ),
      monthlyGoals: mergeCollection(
        this.db.monthlyGoals,
        incoming.monthlyGoals,
        (g) => timeOf(g.updatedAt),
        counters,
      ),
      habits: mergeCollection(
        this.db.habits,
        incoming.habits,
        (h) => timeOf(h.createdAt),
        counters,
      ),
      habitEntries: mergeCollection(
        this.db.habitEntries,
        incoming.habitEntries,
        (e) => timeOf(e.updatedAt),
        counters,
      ),
      reviews: mergeCollection(
        this.db.reviews,
        incoming.reviews,
        (r) => timeOf(r.updatedAt),
        counters,
      ),
      notes: mergeCollection(this.db.notes, incoming.notes, (n) => timeOf(n.updatedAt), counters),
      days: mergeCollection(this.db.days, incoming.days, (d) => timeOf(d.updatedAt), counters),
      companies: mergeCollection(
        this.db.companies,
        incoming.companies,
        (c) => timeOf(c.updatedAt),
        counters,
      ),
      contacts: mergeCollection(
        this.db.contacts,
        incoming.contacts,
        (c) => timeOf(c.updatedAt),
        counters,
      ),
      opportunities: mergeCollection(
        this.db.opportunities,
        incoming.opportunities,
        (o) => timeOf(o.updatedAt),
        counters,
      ),
      // Touches are immutable once logged, so creation time is the only stamp.
      touches: mergeCollection(
        this.db.touches,
        incoming.touches,
        (t) => timeOf(t.createdAt),
        counters,
      ),
      templates: mergeCollection(
        this.db.templates,
        incoming.templates,
        (t) => timeOf(t.updatedAt),
        counters,
      ),
      // Settings are not a collection: the backup's copy wins when it has one.
      // `migrate` would have filled in defaults for a v1 backup, which must not
      // overwrite the targets configured on this device.
      outreach: incomingHasOutreach ? incoming.outreach : this.db.outreach,
    }

    // One more repair pass: the merged document may now reference a habit,
    // category or company that only existed on one side.
    this.db = migrate(merged)
    this.emit()
    this.pendingWrite = true
    await this.flush()
    return counters
  }

  loadSampleData = async (): Promise<void> => {
    const sample = buildSampleDatabase(todayISO())
    this.db = {
      ...sample,
      // Keep the user's own preferences; only the demo content is replaced.
      settings: { ...this.db.settings, seedDataCleared: false },
    }
    this.emit()
    this.pendingWrite = true
    await this.flush()
  }

  clearAllEntries = async (): Promise<void> => {
    this.db = {
      ...this.db,
      tasks: [],
      logs: [],
      weeklyGoals: [],
      monthlyGoals: [],
      habits: [],
      habitEntries: [],
      reviews: [],
      notes: [],
      days: [],
      settings: { ...this.db.settings, seedDataCleared: true },
      companies: [],
      contacts: [],
      opportunities: [],
      touches: [],
      // Templates and outreach settings are configuration, not entries.
    }
    this.emit()
    this.pendingWrite = true
    await this.flush()
  }

  resetEverything = async (): Promise<void> => {
    const fresh = createEmptyDatabase()
    // Do not re-seed the demo data behind the user's back after a reset.
    fresh.settings = { ...fresh.settings, seedDataCleared: true }
    this.db = fresh
    this.emit()

    const adapter = this.activeAdapter()
    if (adapter) {
      try {
        await adapter.clear()
      } catch {
        // The overwrite below is what actually matters.
      }
    }
    this.pendingWrite = true
    await this.flush()
  }

  /* -- privacy lock ------------------------------------------------------ */

  private syncLock = (enabled: boolean, unlocked: boolean): void => {
    this.lockApi.enabled = enabled
    this.lockApi.unlocked = unlocked
    this.touch()
  }

  private assertLockUsable = (passphrase: string): void => {
    if (!isCryptoAvailable()) {
      throw new Error('This browser does not support Web Crypto, so the lock is unavailable.')
    }
    if (!hasLocalStorage()) {
      throw new Error('This browser blocks local storage, so the lock cannot be remembered.')
    }
    if (passphrase.trim().length < MIN_PASSPHRASE_LENGTH) {
      throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE_LENGTH} characters.`)
    }
  }

  private enableLock = async (passphrase: string): Promise<void> => {
    this.assertLockUsable(passphrase)
    const base = this.requireBaseAdapter()
    const salt = randomSalt()
    const key = await deriveKey(passphrase, salt)
    const meta: LockMeta = { v: 1, salt, verifier: await createVerifier(key, salt) }

    this.lockMeta = meta
    this.adapter = createEncryptedAdapter(base, key, salt)
    writeLockMeta(meta)
    await writeSessionKey(key)

    // Rewrites the document through the encrypting adapter, replacing the
    // plaintext copy at the same storage key.
    this.pendingWrite = true
    await this.flush()
    this.syncLock(true, true)
  }

  private disableLock = async (passphrase: string): Promise<boolean> => {
    const meta = this.lockMeta ?? readLockMeta()
    if (!meta) {
      this.syncLock(false, true)
      return true
    }
    const key = await deriveKey(passphrase, meta.salt)
    if (!(await checkVerifier(key, meta.verifier))) return false

    this.adapter = this.requireBaseAdapter()
    this.lockMeta = null
    clearLockMeta()
    clearSessionKey()

    this.pendingWrite = true
    await this.flush()
    this.syncLock(false, true)
    return true
  }

  private unlockWith = async (passphrase: string): Promise<boolean> => {
    const meta = this.lockMeta ?? readLockMeta()
    if (!meta) {
      this.syncLock(false, true)
      return true
    }
    let key: CryptoKey
    try {
      key = await deriveKey(passphrase, meta.salt)
    } catch {
      return false
    }
    if (!(await checkVerifier(key, meta.verifier))) return false

    this.lockMeta = meta
    this.adapter = createEncryptedAdapter(this.requireBaseAdapter(), key, meta.salt)
    await writeSessionKey(key)
    this.syncLock(true, true)
    await this.loadFromAdapter()
    return true
  }

  private lockNow = (): void => {
    if (!this.lockMeta) return
    // Save whatever is pending before the key goes away. `flush` captures the
    // adapter and the document synchronously, so clearing them below is safe.
    void this.flush()

    this.adapter = null
    this.pendingWrite = false
    clearSessionKey()
    // Drop the decrypted document from memory — a lock screen over readable
    // data in a React tree is theatre.
    this.db = createEmptyDatabase()
    this.lockApi.enabled = true
    this.lockApi.unlocked = false
    this.setStatus('locked')
  }

  private changePassphrase = async (current: string, next: string): Promise<boolean> => {
    const meta = this.lockMeta ?? readLockMeta()
    if (!meta) return false
    const currentKey = await deriveKey(current, meta.salt)
    if (!(await checkVerifier(currentKey, meta.verifier))) return false

    this.assertLockUsable(next)
    const salt = randomSalt()
    const key = await deriveKey(next, salt)
    const updated: LockMeta = { v: 1, salt, verifier: await createVerifier(key, salt) }

    this.lockMeta = updated
    this.adapter = createEncryptedAdapter(this.requireBaseAdapter(), key, salt)
    writeLockMeta(updated)
    await writeSessionKey(key)

    this.pendingWrite = true
    await this.flush()
    this.syncLock(true, true)
    return true
  }
}

/**
 * One instance for the whole app. The provider calls `init()` once and hands
 * `actions` / `lockApi` to the React tree; nothing else should construct this.
 */
export const personalData = new PersonalDataService()
