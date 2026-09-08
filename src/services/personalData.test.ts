// @vitest-environment jsdom
/**
 * Behavioural tests for the private data layer.
 *
 * The route smoke test proves the dashboard renders. This proves it actually
 * works: that a task survives a page reload, that completing one stamps the
 * right timestamps, that a category still in use cannot be deleted out from
 * under its records, and that analytics read the data that was really stored.
 *
 * A note on the environment: Node ships its own experimental `localStorage`
 * global that shadows jsdom's and does not implement `clear()`, and there is no
 * IndexedDB here at all. So we install a real Storage implementation below.
 * That makes `createStorageAdapter()` settle on the localStorage adapter, which
 * means the persistence test exercises the genuine adapter chain — serialise,
 * write, read back in a brand new service — rather than a stub.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { PersonalDataService } from '@/services/personalData'
import { dayStats } from '@/utils/analytics'
import { todayISO, shiftDay, weekKeyOf } from '@/utils/date'
import { DEFAULT_CATEGORIES, DEFAULT_FIT_CRITERIA, DEFAULT_TEMPLATES } from '@/services/defaults'
import { migrate } from '@/services/migrations'
import { parseCsvRows } from '@/services/csv'

const CATEGORY = DEFAULT_CATEGORIES[0]!.id

/** A spec-shaped Storage backed by a Map. */
function createStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage
}

function installStorage(name: 'localStorage' | 'sessionStorage') {
  const storage = createStorage()
  for (const target of [globalThis, window] as object[]) {
    Object.defineProperty(target, name, {
      value: storage,
      configurable: true,
      writable: true,
    })
  }
}

/** A service that has booted and been emptied of the seeded demo data. */
async function freshService() {
  const service = new PersonalDataService()
  await service.init()
  await service.clearAllEntries()
  return service
}

beforeEach(() => {
  installStorage('localStorage')
  installStorage('sessionStorage')
})

describe('startup', () => {
  it('leaves a brand new browser EMPTY rather than seeding demo data', async () => {
    // `/dashboard` is a public URL. Auto-seeding meant a stranger in an
    // incognito window landed in a fully populated dashboard addressed to the
    // owner by name — indistinguishable from a real data leak, even though
    // nothing had leaked. Demo data is opt-in now.
    const service = new PersonalDataService()
    await service.init()

    expect(service.getStatus()).toBe('ready')
    expect(service.getSnapshot().tasks).toHaveLength(0)
    expect(service.getSnapshot().habits).toHaveLength(0)
    expect(service.getSnapshot().notes).toHaveLength(0)
  })

  it('ships no personal name by default, so a visitor is never greeted as the owner', async () => {
    const service = new PersonalDataService()
    await service.init()
    expect(service.getSnapshot().settings.displayName).toBe('')
  })

  it('still has its categories, so the dashboard is usable immediately', async () => {
    const service = new PersonalDataService()
    await service.init()
    expect(service.getSnapshot().categories.length).toBeGreaterThan(0)
  })

  it('loads demo data only when explicitly asked', async () => {
    const service = new PersonalDataService()
    await service.init()
    expect(service.getSnapshot().tasks).toHaveLength(0)

    await service.loadSampleData()
    expect(service.getSnapshot().tasks.length).toBeGreaterThan(0)
  })
})

describe('daily targets', () => {
  it('creates, edits and deletes a task', async () => {
    const service = await freshService()
    const today = todayISO()

    const task = service.addTask({ title: 'Solve two array problems', date: today, categoryId: CATEGORY })
    expect(task.id).toBeTruthy()
    expect(service.getSnapshot().tasks).toHaveLength(1)

    service.updateTask(task.id, { title: 'Solve three array problems', priority: 'high' })
    expect(service.getSnapshot().tasks[0]!.title).toBe('Solve three array problems')
    expect(service.getSnapshot().tasks[0]!.priority).toBe('high')

    service.deleteTask(task.id)
    expect(service.getSnapshot().tasks).toHaveLength(0)
  })

  it('stamps completion and clears it again when reopened', async () => {
    const service = await freshService()
    const task = service.addTask({ title: 'Read a chapter', date: todayISO() })

    service.setTaskStatus(task.id, 'completed')
    const completed = service.getSnapshot().tasks[0]!
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBeTruthy()

    service.setTaskStatus(task.id, 'not-started')
    expect(service.getSnapshot().tasks[0]!.completedAt).toBeUndefined()
  })

  it('gives each new task of a day the next order, and honours a reorder', async () => {
    const service = await freshService()
    const date = todayISO()
    const a = service.addTask({ title: 'A', date })
    const b = service.addTask({ title: 'B', date })
    const c = service.addTask({ title: 'C', date })

    expect(a.order).toBeLessThan(b.order)
    expect(b.order).toBeLessThan(c.order)

    service.reorderTasks(date, [c.id, a.id, b.id])
    const byOrder = [...service.getSnapshot().tasks].sort((x, y) => x.order - y.order)
    expect(byOrder.map((t) => t.title)).toEqual(['C', 'A', 'B'])
  })

  it('rolls unfinished work forward and leaves finished work behind', async () => {
    const service = await freshService()
    const yesterday = shiftDay(todayISO(), -1)
    const today = todayISO()

    const done = service.addTask({ title: 'Finished', date: yesterday })
    service.addTask({ title: 'Unfinished', date: yesterday })
    service.setTaskStatus(done.id, 'completed')

    const moved = service.rolloverTasks(yesterday, today)

    expect(moved).toBe(1)
    const todays = service.getSnapshot().tasks.filter((t) => t.date === today)
    expect(todays.map((t) => t.title)).toEqual(['Unfinished'])
  })
})

describe('goals and habits', () => {
  it('tracks progress on a weekly goal', async () => {
    const service = await freshService()
    const week = weekKeyOf(todayISO(), 1)

    const goal = service.addWeeklyGoal({
      title: 'Solve 20 problems',
      weekKey: week,
      targetValue: 20,
      unit: 'problems',
    })
    service.updateWeeklyGoal(goal.id, { currentValue: 20, status: 'completed' })

    const saved = service.getSnapshot().weeklyGoals[0]!
    expect(saved.currentValue).toBe(20)
    expect(saved.status).toBe('completed')
  })

  it('toggles a habit on and back off for a given day', async () => {
    const service = await freshService()
    const habit = service.addHabit({ name: 'DSA', dailyTarget: 2 })
    const date = todayISO()

    service.toggleHabit(habit.id, date)
    const on = service.getSnapshot().habitEntries.find((e) => e.habitId === habit.id)
    expect(on?.value).toBe(2)

    service.toggleHabit(habit.id, date)
    const off = service.getSnapshot().habitEntries.find((e) => e.habitId === habit.id)
    expect(off?.value).toBe(0)
  })

  it('keeps one review per week rather than appending duplicates', async () => {
    const service = await freshService()
    const week = weekKeyOf(todayISO(), 1)

    service.saveReview(week, { wentWell: 'Consistent mornings' })
    service.saveReview(week, { wentWell: 'Consistent mornings', learned: 'Heaps' })

    expect(service.getSnapshot().reviews).toHaveLength(1)
    expect(service.getSnapshot().reviews[0]!.learned).toBe('Heaps')
  })
})

describe('categories', () => {
  it('refuses to delete a category that records still point at', async () => {
    const service = await freshService()
    service.addTask({ title: 'Tied to a category', date: todayISO(), categoryId: CATEGORY })

    expect(service.deleteCategory(CATEGORY)).toBe(false)
    expect(service.getSnapshot().categories.some((c) => c.id === CATEGORY)).toBe(true)
  })

  it('deletes a category once nothing references it', async () => {
    const service = await freshService()
    const spare = service.addCategory({ label: 'Temporary' })

    expect(service.deleteCategory(spare.id)).toBe(true)
    expect(service.getSnapshot().categories.some((c) => c.id === spare.id)).toBe(false)
  })
})

describe('persistence', () => {
  it('survives a reload: a second service reads what the first one wrote', async () => {
    const first = await freshService()
    first.addTask({ title: 'Written before the reload', date: todayISO() })
    await first.flush()

    const second = new PersonalDataService()
    await second.init()

    expect(second.getSnapshot().tasks.map((t) => t.title)).toContain('Written before the reload')
  })

  it('round-trips through export and import', async () => {
    const service = await freshService()
    service.addTask({ title: 'Exported task', date: todayISO() })
    service.addNote({ title: 'Exported note', body: 'Body text' })

    const json = service.exportJson()
    expect(JSON.parse(json).exportedAt).toBeTruthy()

    await service.clearAllEntries()
    expect(service.getSnapshot().tasks).toHaveLength(0)

    await service.importJson(json, 'replace')

    expect(service.getSnapshot().tasks.map((t) => t.title)).toContain('Exported task')
    expect(service.getSnapshot().notes.map((n) => n.title)).toContain('Exported note')
  })

  it('rejects a payload that is not a database without corrupting state', async () => {
    const service = await freshService()
    service.addTask({ title: 'Should still be here', date: todayISO() })

    await expect(service.importJson('{ not json at all', 'replace')).rejects.toThrow()
    expect(service.getSnapshot().tasks).toHaveLength(1)
  })
})

describe('store contract', () => {
  it('notifies subscribers and hands out a new snapshot on every write', async () => {
    const service = await freshService()
    let notifications = 0
    const unsubscribe = service.subscribe(() => {
      notifications += 1
    })

    const before = service.getSnapshot()
    service.addTask({ title: 'Triggers a notification', date: todayISO() })
    const after = service.getSnapshot()

    expect(notifications).toBeGreaterThan(0)
    expect(after).not.toBe(before)

    unsubscribe()
    service.addTask({ title: 'After unsubscribe', date: todayISO() })
    const settled = notifications
    service.addTask({ title: 'And another', date: todayISO() })
    expect(notifications).toBe(settled)
  })

  it('returns the same snapshot when nothing has changed', async () => {
    const service = await freshService()
    expect(service.getSnapshot()).toBe(service.getSnapshot())
  })
})

describe('analytics read real stored data', () => {
  it('reflects tasks that were actually completed', async () => {
    const service = await freshService()
    const date = todayISO()

    const one = service.addTask({ title: 'One', date })
    service.addTask({ title: 'Two', date })
    service.setTaskStatus(one.id, 'completed')
    service.addLog({ activity: 'Studied graphs', date, durationMinutes: 90 })

    const stats = dayStats(service.getSnapshot(), date)

    expect(stats.tasksTotal).toBe(2)
    expect(stats.tasksCompleted).toBe(1)
    expect(stats.loggedMinutes).toBe(90)
    expect(stats.hasEntries).toBe(true)
    expect(stats.score).toBeGreaterThan(0)
    expect(stats.score).toBeLessThanOrEqual(100)
  })
})

/* -------------------------------------------------------------------------- *
 * Outreach
 * -------------------------------------------------------------------------- */

describe('outreach: companies', () => {
  it('creates a company with the documented defaults and trims the name', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: '  Northwind Labs  ' })

    expect(company.name).toBe('Northwind Labs')
    expect(company.kind).toBe('startup')
    expect(company.remote).toBe(false)
    expect(company.priority).toBe('medium')
    expect(company.facts).toEqual([])
    expect(company.fit).toEqual({})
    expect(company.archived).toBe(false)
    expect(service.addCompany({ name: '   ' }).name).toBe('Untitled company')
  })

  it('reports its footprint, then deletes the cascade and unlinks the rest', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Northwind Labs' })
    const contact = service.addContact({ name: 'Anaya', companyId: company.id })
    const opportunity = service.addOpportunity({ companyId: company.id, title: 'Backend Intern' })

    // Points only at the opportunity: goes with the company.
    service.addTouch({
      summary: 'Applied',
      channel: 'portal',
      direction: 'outbound',
      opportunityId: opportunity.id,
    })
    // Points at the contact too: survives, with the company link cleared.
    const kept = service.addTouch({
      summary: 'Coffee chat',
      channel: 'call',
      direction: 'outbound',
      contactId: contact.id,
    })
    expect(kept.companyId).toBe(company.id)
    service.scheduleFollowUp(opportunity.id, todayISO())

    expect(service.companyFootprint(company.id)).toEqual({
      opportunities: 1,
      touches: 1,
      contacts: 1,
    })

    const removed = service.deleteCompany(company.id)
    expect(removed).toEqual({ opportunities: 1, touches: 1, contacts: 1 })

    const db = service.getSnapshot()
    expect(db.companies).toHaveLength(0)
    expect(db.opportunities).toHaveLength(0)
    expect(db.touches).toHaveLength(1)
    expect(db.touches[0]!.companyId).toBeUndefined()
    expect(db.touches[0]!.contactId).toBe(contact.id)
    expect(db.contacts[0]!.companyId).toBeUndefined()
    // The follow-up task keeps its text but no longer points at a ghost.
    expect(db.tasks).toHaveLength(1)
    expect(db.tasks[0]!.link).toBeUndefined()
  })

  it('stores facts and fit values, and only accepts 0, 1 or 2', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Meridian Systems' })
    const criterion = DEFAULT_FIT_CRITERIA[0]!.id

    const fact = service.addCompanyFact(company.id, 'Hiring interns', 'https://example.com/careers')
    service.setCompanyFit(company.id, criterion, 2)

    let saved = service.getSnapshot().companies[0]!
    expect(saved.facts.map((f) => f.id)).toEqual([fact.id])
    expect(saved.fit[criterion]).toBe(2)

    service.setCompanyFit(company.id, criterion, 7 as unknown as 0)
    service.removeCompanyFact(company.id, fact.id)
    saved = service.getSnapshot().companies[0]!
    expect(saved.fit[criterion]).toBe(0)
    expect(saved.facts).toHaveLength(0)
  })

  it('refuses an opportunity at a company that does not exist', async () => {
    const service = await freshService()
    expect(() => service.addOpportunity({ companyId: 'nope', title: 'Ghost role' })).toThrow()
  })
})

describe('outreach: stages', () => {
  it('stamps appliedAt once, sets and clears closedAt, and drops the next action on close', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Northwind Labs' })
    const opportunity = service.addOpportunity({ companyId: company.id, title: 'Backend Intern' })
    const read = () => service.getSnapshot().opportunities[0]!

    service.setOpportunityStage(opportunity.id, 'applied')
    expect(read().appliedAt).toBe(todayISO())
    expect(read().stageHistory.map((s) => s.stage)).toEqual(['researching', 'applied'])

    // A hand-corrected application date survives a later trip through 'applied'.
    service.updateOpportunity(opportunity.id, {
      appliedAt: '2026-01-01',
      nextAction: 'Prep',
      nextActionDue: todayISO(),
    })
    service.setOpportunityStage(opportunity.id, 'rejected')
    expect(read().closedAt).toBeTruthy()
    expect(read().nextAction).toBeUndefined()
    expect(read().nextActionDue).toBeUndefined()

    service.setOpportunityStage(opportunity.id, 'applied')
    expect(read().closedAt).toBeUndefined()
    expect(read().appliedAt).toBe('2026-01-01')

    // Same stage is a no-op: the snapshot keeps its identity.
    const before = service.getSnapshot()
    service.setOpportunityStage(opportunity.id, 'applied')
    expect(service.getSnapshot()).toBe(before)
  })

  it('advances from a touch, forwards only, and never once closed', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Quillfeather' })
    const opportunity = service.addOpportunity({ companyId: company.id, title: 'Founding Intern' })
    const read = () => service.getSnapshot().opportunities[0]!
    const log = (direction: 'outbound' | 'inbound') =>
      service.addTouch({ summary: 'x', channel: 'email', direction, opportunityId: opportunity.id })

    log('outbound')
    expect(read().stage).toBe('contacted')
    log('outbound')
    expect(read().stage).toBe('contacted')
    log('inbound')
    expect(read().stage).toBe('replied')
    log('outbound')
    expect(read().stage).toBe('replied')

    service.setOpportunityStage(opportunity.id, 'interviewing')
    log('inbound')
    expect(read().stage).toBe('interviewing')

    service.setOpportunityStage(opportunity.id, 'ghosted')
    log('inbound')
    expect(read().stage).toBe('ghosted')

    // A fresh 'researching' opportunity jumps straight to 'replied' on an inbound touch.
    const second = service.addOpportunity({ companyId: company.id, title: 'Second role' })
    service.addTouch({
      summary: 'They wrote first',
      channel: 'email',
      direction: 'inbound',
      opportunityId: second.id,
    })
    expect(service.getSnapshot().opportunities.find((o) => o.id === second.id)!.stage).toBe(
      'replied',
    )
  })

  it('schedules a follow-up as a real Career task linked to the opportunity', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Northwind Labs' })
    const opportunity = service.addOpportunity({ companyId: company.id, title: 'Backend Intern' })
    const tomorrow = shiftDay(todayISO(), 1)

    const task = service.scheduleFollowUp(opportunity.id, tomorrow)

    expect(task.title).toBe('Follow up: Northwind Labs — Backend Intern')
    expect(task.categoryId).toBe('cat-career')
    expect(task.date).toBe(tomorrow)
    expect(task.link).toEqual({ kind: 'opportunity', id: opportunity.id })
    expect(service.getSnapshot().tasks.map((t) => t.id)).toContain(task.id)

    const saved = service.getSnapshot().opportunities[0]!
    expect(saved.nextActionDue).toBe(tomorrow)
    expect(saved.nextAction).toBe(task.title)
  })
})

describe('outreach: contacts and templates', () => {
  it('unlinks touches and opportunities when a contact goes', async () => {
    const service = await freshService()
    const company = service.addCompany({ name: 'Orbital Ledger' })
    const contact = service.addContact({ name: 'Leela', companyId: company.id, warmth: 'warm' })
    const opportunity = service.addOpportunity({
      companyId: company.id,
      title: 'Platform Intern',
      contactId: contact.id,
    })
    service.addTouch({
      summary: 'Hello',
      channel: 'linkedin',
      direction: 'outbound',
      contactId: contact.id,
      opportunityId: opportunity.id,
    })

    service.deleteContact(contact.id)

    const db = service.getSnapshot()
    expect(db.contacts).toHaveLength(0)
    expect(db.opportunities[0]!.contactId).toBeUndefined()
    expect(db.touches).toHaveLength(1)
    expect(db.touches[0]!.contactId).toBeUndefined()
  })

  it('keeps templateId on touches after the template is deleted', async () => {
    const service = await freshService()
    const template = service.addTemplate({ name: 'Cold', body: 'Hi {{name}}' })
    service.addTouch({
      summary: 'Sent',
      channel: 'email',
      direction: 'outbound',
      templateId: template.id,
    })

    service.deleteTemplate(template.id)

    expect(service.getSnapshot().templates.some((t) => t.id === template.id)).toBe(false)
    expect(service.getSnapshot().touches[0]!.templateId).toBe(template.id)
  })
})

describe('outreach: CSV', () => {
  it('parses quoted cells, embedded commas and CRLF', () => {
    expect(parseCsvRows('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', '2', '3'],
    ])
  })

  it('imports companies, updates duplicates by name, then imports contacts against them', async () => {
    const service = await freshService()

    const companies = [
      'Name,Website,Kind,Remote,Tags,Priority',
      'Northwind Labs,https://northwind.example.com,startup,yes,"devtools; infra",high',
      'Meridian Systems,,scaleup,no,fintech,medium',
      // A row with data but no name has nothing to key on.
      ',https://nameless.example.com,startup,,,low',
    ].join('\n')
    expect(await service.importOutreachCsv('companies', companies)).toEqual({
      added: 2,
      updated: 0,
      skipped: 1,
    })

    const northwind = service.getSnapshot().companies.find((c) => c.name === 'Northwind Labs')!
    expect(northwind.remote).toBe(true)
    expect(northwind.tags).toEqual(['devtools', 'infra'])
    expect(northwind.priority).toBe('high')

    expect(await service.importOutreachCsv('companies', 'name,kind\nnorthwind labs,mnc\n')).toEqual({
      added: 0,
      updated: 1,
      skipped: 0,
    })
    expect(service.getSnapshot().companies).toHaveLength(2)
    expect(service.getSnapshot().companies.find((c) => c.id === northwind.id)!.kind).toBe('mnc')

    const contacts = [
      'name,role,company,email,warmth',
      'Anaya,Head of Engineering,Northwind Labs,anaya@example.com,warm',
      'Sana,Founder,Quillfeather,,referral',
    ].join('\n')
    expect(await service.importOutreachCsv('contacts', contacts)).toEqual({
      added: 2,
      updated: 0,
      skipped: 0,
    })

    const db = service.getSnapshot()
    expect(db.contacts.find((c) => c.name === 'Anaya')!.companyId).toBe(northwind.id)
    const quillfeather = db.companies.find((c) => c.name === 'Quillfeather')!
    expect(quillfeather.kind).toBe('other')
    expect(db.contacts.find((c) => c.name === 'Sana')!.companyId).toBe(quillfeather.id)
  })

  it('rejects a file without a usable header row', async () => {
    const service = await freshService()
    await expect(service.importOutreachCsv('companies', '')).rejects.toThrow(/header/i)
    await expect(
      service.importOutreachCsv('contacts', 'Northwind Labs,https://x\n'),
    ).rejects.toThrow(/name/i)
    expect(service.getSnapshot().companies).toHaveLength(0)
  })

  it('exports the same columns it imports, with RFC 4180 quoting', async () => {
    const service = await freshService()
    const company = service.addCompany({
      name: 'Halden & Co',
      why: 'Large programme, safe application',
    })
    service.addContact({ name: 'Nikhil', companyId: company.id, role: 'Campus Hiring Lead' })

    const companiesCsv = service.exportOutreachCsv('companies')
    expect(companiesCsv.split('\r\n')[0]).toBe(
      'name,website,kind,stage,size,location,remote,industry,why,tags,priority',
    )
    expect(companiesCsv).toContain('"Large programme, safe application"')

    const contactsCsv = service.exportOutreachCsv('contacts')
    expect(contactsCsv.split('\r\n')[0]).toBe('name,role,company,email,linkedin,warmth,notes')
    expect(contactsCsv).toContain('Nikhil,Campus Hiring Lead,Halden & Co,,,cold,')
  })
})

describe('outreach: migration and whole-database operations', () => {
  it('upgrades a v1 export to v2 with default templates and settings', async () => {
    const service = await freshService()
    const v1 = {
      version: 1,
      categories: DEFAULT_CATEGORIES,
      tasks: [
        {
          id: 'task-1',
          date: todayISO(),
          title: 'Carried over from v1',
          categoryId: CATEGORY,
          priority: 'medium',
          status: 'not-started',
          order: 1,
          createdAt: '2026-01-01T09:00:00.000Z',
          updatedAt: '2026-01-01T09:00:00.000Z',
        },
      ],
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
        dailyTaskTarget: 5,
        displayName: '',
        seedDataCleared: true,
      },
    }

    await service.importJson(JSON.stringify(v1), 'replace')

    const db = service.getSnapshot()
    expect(db.version).toBe(2)
    expect(db.tasks.map((t) => t.title)).toEqual(['Carried over from v1'])
    expect(db.companies).toEqual([])
    expect(db.templates.map((t) => t.id)).toEqual(DEFAULT_TEMPLATES.map((t) => t.id))
    expect(db.outreach.weeklyTarget).toBe(15)
    expect(db.outreach.fitCriteria).toHaveLength(DEFAULT_FIT_CRITERIA.length)
  })

  it('drops orphaned opportunities and clears dangling references on load', () => {
    const db = migrate({
      version: 2,
      companies: [{ id: 'c1', name: 'Real Co' }],
      contacts: [{ id: 'p1', name: 'Someone', companyId: 'gone' }],
      opportunities: [
        { id: 'o1', companyId: 'c1', title: 'Kept', stage: 'rejected' },
        { id: 'o2', companyId: 'gone', title: 'Dropped' },
      ],
      touches: [
        {
          id: 't1',
          date: '2026-09-01',
          channel: 'fax',
          direction: 'inbound',
          contactId: 'ghost',
          opportunityId: 'o2',
        },
      ],
      outreach: {
        weeklyTarget: 900,
        followUpDays: [10, -2, 4, 4],
        staleAfterDays: 0,
        fitCriteria: [{ id: 'f', label: 'X', weight: 99 }],
      },
    })

    expect(db.opportunities.map((o) => o.id)).toEqual(['o1'])
    expect(db.opportunities[0]!.stageHistory.length).toBeGreaterThan(0)
    expect(db.opportunities[0]!.closedAt).toBeTruthy()
    expect(db.contacts[0]!.companyId).toBeUndefined()
    expect(db.touches[0]!.channel).toBe('other')
    expect(db.touches[0]!.contactId).toBeUndefined()
    expect(db.touches[0]!.opportunityId).toBeUndefined()
    expect(db.outreach.weeklyTarget).toBe(100)
    expect(db.outreach.followUpDays).toEqual([4, 10])
    expect(db.outreach.staleAfterDays).toBe(1)
    expect(db.outreach.fitCriteria[0]!.weight).toBe(5)
  })

  it('keeps templates and outreach settings when entries are cleared', async () => {
    const service = await freshService()
    service.addCompany({ name: 'Tessellate' })
    service.updateOutreach({ weeklyTarget: 20 })

    await service.clearAllEntries()

    const db = service.getSnapshot()
    expect(db.companies).toHaveLength(0)
    expect(db.templates.length).toBeGreaterThan(0)
    expect(db.outreach.weeklyTarget).toBe(20)
  })

  it('merges outreach collections by the newest stamp and lets the backup settle settings', async () => {
    const service = await freshService()
    service.updateOutreach({ weeklyTarget: 12 })
    const company = service.addCompany({ name: 'Local Co' })
    const backup = JSON.parse(service.exportJson())
    backup.companies[0].name = 'Renamed in backup'
    backup.companies[0].updatedAt = '2999-01-01T00:00:00.000Z'
    backup.outreach.weeklyTarget = 30

    await service.importJson(JSON.stringify(backup), 'merge')

    const db = service.getSnapshot()
    expect(db.companies.find((c) => c.id === company.id)!.name).toBe('Renamed in backup')
    expect(db.outreach.weeklyTarget).toBe(30)
  })
})
