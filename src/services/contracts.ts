/**
 * The command surface of the private dashboard.
 *
 * `PersonalDataService` implements this, `PersonalDataProvider` hands it to the
 * React tree, and every page calls it. Keeping it in its own file means the UI
 * never imports the storage implementation, so swapping IndexedDB for a real
 * backend touches exactly one file (`services/storage/index.ts`).
 */
import type {
  Category,
  Company,
  CompanyFact,
  Contact,
  FitValue,
  Habit,
  HabitEntry,
  ISODate,
  LogEntry,
  MessageTemplate,
  MonthKey,
  MonthlyGoal,
  Note,
  Opportunity,
  OpportunityStage,
  OutreachSettings,
  PersonalDatabase,
  PersonalSettings,
  Task,
  TaskStatus,
  Touch,
  WeekKey,
  WeeklyGoal,
  WeeklyReview,
} from '@/types'

/** Fields the caller supplies; ids and timestamps are filled in by the service. */
type Draft<T, Required extends keyof T> = Pick<T, Required> &
  Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>

export type TaskInput = Draft<Task, 'title' | 'date'>
export type LogInput = Draft<LogEntry, 'activity' | 'date'>
export type WeeklyGoalInput = Draft<WeeklyGoal, 'title' | 'weekKey'>
export type MonthlyGoalInput = Draft<MonthlyGoal, 'title' | 'monthKey'>
export type HabitInput = Draft<Habit, 'name'>
export type NoteInput = Draft<Note, 'title'>
export type CategoryInput = Draft<Category, 'label'>

/* -- outreach ----------------------------------------------------------- */
export type CompanyInput = Draft<Company, 'name'>
export type ContactInput = Draft<Contact, 'name'>
export type OpportunityInput = Draft<Opportunity, 'companyId' | 'title'>
export type TouchInput = Draft<Touch, 'summary' | 'channel' | 'direction'>
export type TemplateInput = Draft<MessageTemplate, 'name' | 'body'>

/** Which outreach collection a CSV maps onto. */
export type OutreachCsvKind = 'companies' | 'contacts'

export type ImportMode = 'replace' | 'merge'

export interface ImportSummary {
  added: number
  updated: number
  skipped: number
}

/**
 * The optional at-rest privacy lock.
 *
 * This encrypts the local database with a key derived from a passphrase. It
 * protects the data sitting in this browser's IndexedDB — it is NOT
 * authentication, and it does not make anything about a statically hosted site
 * secure. See README.md.
 */
export interface LockApi {
  /** True when a passphrase has been configured on this device. */
  enabled: boolean
  /** True when the database is currently readable. */
  unlocked: boolean
  /** Turns encryption on and re-writes the database in encrypted form. */
  enable(passphrase: string): Promise<void>
  /** Verifies the passphrase, then rewrites the database as plain text. */
  disable(passphrase: string): Promise<boolean>
  /** Returns false on a wrong passphrase; the UI keeps the lock screen up. */
  unlock(passphrase: string): Promise<boolean>
  /** Drops the in-memory key and returns to the lock screen. */
  lock(): void
  /** Verifies then replaces the passphrase, re-encrypting in place. */
  change(current: string, next: string): Promise<boolean>
}

export interface PersonalActions {
  /* -- daily targets ---------------------------------------------------- */
  addTask(input: TaskInput): Task
  updateTask(id: string, patch: Partial<Task>): void
  deleteTask(id: string): void
  /** Also stamps `startedAt` / `completedAt` / `actualMinutes` as appropriate. */
  setTaskStatus(id: string, status: TaskStatus): void
  /** Moves a task within its day. `orderedIds` is the full new order. */
  reorderTasks(date: ISODate, orderedIds: string[]): void
  /** Copies every unfinished task from `from` onto `to`. Returns how many. */
  rolloverTasks(from: ISODate, to: ISODate): number

  /* -- work log --------------------------------------------------------- */
  addLog(input: LogInput): LogEntry
  updateLog(id: string, patch: Partial<LogEntry>): void
  deleteLog(id: string): void

  /* -- goals ------------------------------------------------------------ */
  addWeeklyGoal(input: WeeklyGoalInput): WeeklyGoal
  updateWeeklyGoal(id: string, patch: Partial<WeeklyGoal>): void
  deleteWeeklyGoal(id: string): void
  addMonthlyGoal(input: MonthlyGoalInput): MonthlyGoal
  updateMonthlyGoal(id: string, patch: Partial<MonthlyGoal>): void
  deleteMonthlyGoal(id: string): void
  /** Copies unfinished goals from one week to the next. Returns how many. */
  carryOverWeeklyGoals(from: WeekKey, to: WeekKey): number

  /* -- habits ----------------------------------------------------------- */
  addHabit(input: HabitInput): Habit
  updateHabit(id: string, patch: Partial<Habit>): void
  deleteHabit(id: string): void
  reorderHabits(orderedIds: string[]): void
  setHabitEntry(habitId: string, date: ISODate, value: number, note?: string): HabitEntry
  /** Flips between 0 and the habit's `dailyTarget`. */
  toggleHabit(habitId: string, date: ISODate): void

  /* -- weekly review ---------------------------------------------------- */
  saveReview(weekKey: WeekKey, patch: Partial<WeeklyReview>): WeeklyReview

  /* -- notes ------------------------------------------------------------ */
  addNote(input: NoteInput): Note
  updateNote(id: string, patch: Partial<Note>): void
  deleteNote(id: string): void

  /* -- day header ------------------------------------------------------- */
  setDayMeta(date: ISODate, patch: Partial<Omit<import('@/types').DayMeta, 'id' | 'date'>>): void

  /* -- categories & settings -------------------------------------------- */
  addCategory(input: CategoryInput): Category
  updateCategory(id: string, patch: Partial<Category>): void
  /** Refuses to remove a category that is still referenced; returns false. */
  deleteCategory(id: string): boolean
  updateSettings(patch: Partial<PersonalSettings>): void

  /* -- outreach: companies ---------------------------------------------- */
  addCompany(input: CompanyInput): Company
  updateCompany(id: string, patch: Partial<Company>): void
  /**
   * Hard delete. Also removes the company's opportunities and every touch that
   * pointed only at them; contacts are kept and unlinked. Returns what was
   * removed so the confirm dialog can say so beforehand via `companyFootprint`.
   */
  deleteCompany(id: string): { opportunities: number; touches: number; contacts: number }
  companyFootprint(id: string): { opportunities: number; touches: number; contacts: number }
  addCompanyFact(companyId: string, text: string, sourceUrl?: string): CompanyFact
  removeCompanyFact(companyId: string, factId: string): void
  setCompanyFit(companyId: string, criterionId: string, value: FitValue): void

  /* -- outreach: contacts ----------------------------------------------- */
  addContact(input: ContactInput): Contact
  updateContact(id: string, patch: Partial<Contact>): void
  /** Touches and opportunities that pointed at the contact are unlinked, not deleted. */
  deleteContact(id: string): void

  /* -- outreach: opportunities ------------------------------------------ */
  addOpportunity(input: OpportunityInput): Opportunity
  updateOpportunity(id: string, patch: Partial<Opportunity>): void
  /** Also deletes touches that pointed only at this opportunity. */
  deleteOpportunity(id: string): void
  /**
   * Moves the stage, appends to `stageHistory`, stamps `closedAt` on a terminal
   * stage (and clears it when reopened), stamps `appliedAt` when reaching
   * 'applied' for the first time, and clears `nextAction*` on terminal stages.
   */
  setOpportunityStage(id: string, stage: OpportunityStage): void
  /**
   * Creates a real Task on `date` in the Career category, linked to the
   * opportunity, and sets `nextAction` / `nextActionDue` on it. Returns the task.
   */
  scheduleFollowUp(opportunityId: string, date: ISODate, title?: string): Task

  /* -- outreach: touches ------------------------------------------------ */
  /**
   * Logs an interaction. Side effects on a linked opportunity: an outbound
   * touch while 'researching' moves it to 'contacted'; an inbound touch while
   * 'researching' or 'contacted' moves it to 'replied'. Never moves it backwards
   * and never touches terminal stages.
   */
  addTouch(input: TouchInput): Touch
  updateTouch(id: string, patch: Partial<Touch>): void
  deleteTouch(id: string): void

  /* -- outreach: templates & settings ----------------------------------- */
  addTemplate(input: TemplateInput): MessageTemplate
  updateTemplate(id: string, patch: Partial<MessageTemplate>): void
  /** Touches keep their `templateId` (for response-rate history); the template just goes. */
  deleteTemplate(id: string): void
  updateOutreach(patch: Partial<OutreachSettings>): void

  /* -- outreach: import / export ---------------------------------------- */
  /**
   * Header-mapped CSV. Companies: name, website, kind, stage, size, location,
   * remote, industry, why, tags, priority. Contacts: name, role, company,
   * email, linkedin, warmth, notes ("company" is matched by name, created if
   * missing). Duplicate names update instead of duplicating.
   */
  importOutreachCsv(kind: OutreachCsvKind, csv: string): Promise<ImportSummary>
  exportOutreachCsv(kind: OutreachCsvKind): string

  /* -- whole-database operations ---------------------------------------- */
  /** Pretty-printed JSON of the entire private database. */
  exportJson(): string
  importJson(json: string, mode: ImportMode): Promise<ImportSummary>
  /** Replaces everything with the demo dataset. */
  loadSampleData(): Promise<void>
  /** Empties every collection, keeping categories and settings. */
  clearAllEntries(): Promise<void>
  /** Full factory reset, including categories and settings. */
  resetEverything(): Promise<void>
}

export type PersonalStatus = 'loading' | 'ready' | 'locked' | 'error'

export interface PersonalDataContextValue {
  db: PersonalDatabase
  status: PersonalStatus
  error?: string
  actions: PersonalActions
  lock: LockApi
  /** Name of the active storage adapter, shown in Settings. */
  storageName: string
}

/** Convenience alias used by selector helpers that take the raw document. */
export type { HabitEntry, PersonalDatabase, MonthKey, WeekKey }
