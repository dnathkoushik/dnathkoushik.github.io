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
import { DEFAULT_CATEGORIES } from '@/services/defaults'

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
  it('seeds the sample dataset on a first run so the dashboard is never empty', async () => {
    const service = new PersonalDataService()
    await service.init()

    // No IndexedDB in this environment, so the chain must have fallen through
    // to localStorage rather than giving up and losing the user's data.
    expect(service.getStorageName().toLowerCase()).toContain('local')
    expect(service.getStatus()).toBe('ready')
    expect(service.getSnapshot().tasks.length).toBeGreaterThan(0)
    expect(service.getSnapshot().habits.length).toBeGreaterThan(0)
  })

  it('does not re-seed once the user has cleared the demo data', async () => {
    const first = new PersonalDataService()
    await first.init()
    await first.clearAllEntries()

    const second = new PersonalDataService()
    await second.init()

    expect(second.getSnapshot().tasks).toHaveLength(0)
    expect(second.getSnapshot().settings.seedDataCleared).toBe(true)
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
