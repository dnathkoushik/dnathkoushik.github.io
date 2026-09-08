// @vitest-environment jsdom
/**
 * The gate that decides whether a browser sees the dashboard or the door.
 *
 * This is not a security boundary — `/dashboard` is a public URL on static
 * hosting and always will be. It is what stops a stranger being shown something
 * that looks like the owner's private week. The rules that matter:
 *
 *   - a brand new browser is CLOSED
 *   - a browser that already holds data is OPEN (nobody gets locked out of
 *     their own dashboard by this check being introduced later)
 *   - a browser with a sync token is OPEN
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  claimDashboard,
  claimKind,
  hasAnyData,
  isDashboardOpen,
  releaseDashboard,
} from '@/services/dashboardAccess'
import { createEmptyDatabase } from '@/services/defaults'
import type { PersonalDatabase, Task } from '@/types'

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

beforeEach(() => {
  const storage = createStorage()
  for (const target of [globalThis, window] as object[]) {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })
  }
})

const withTask = (): PersonalDatabase => {
  const db = createEmptyDatabase()
  db.tasks = [{ id: 't1', title: 'Something' } as Task]
  return db
}

describe('a brand new browser', () => {
  it('is closed', () => {
    expect(isDashboardOpen(createEmptyDatabase())).toBe(false)
  })

  it('is still closed when only the default categories and templates are present', () => {
    // An empty database always ships categories, settings and the default
    // outreach templates. None of those mean the owner has used this device.
    const db = createEmptyDatabase()
    expect(db.categories.length).toBeGreaterThan(0)
    expect(db.templates.length).toBeGreaterThan(0)
    expect(hasAnyData(db)).toBe(false)
    expect(isDashboardOpen(db)).toBe(false)
  })
})

describe('a browser that has been used', () => {
  it('is open when the database holds a task', () => {
    expect(isDashboardOpen(withTask())).toBe(true)
  })

  it.each([
    ['logs', (db: PersonalDatabase) => (db.logs = [{ id: 'l1' }] as PersonalDatabase['logs'])],
    ['notes', (db: PersonalDatabase) => (db.notes = [{ id: 'n1' }] as PersonalDatabase['notes'])],
    ['habits', (db: PersonalDatabase) => (db.habits = [{ id: 'h1' }] as PersonalDatabase['habits'])],
    [
      'reviews',
      (db: PersonalDatabase) => (db.reviews = [{ id: 'r1' }] as PersonalDatabase['reviews']),
    ],
    [
      'companies',
      (db: PersonalDatabase) => (db.companies = [{ id: 'c1' }] as PersonalDatabase['companies']),
    ],
    [
      'opportunities',
      (db: PersonalDatabase) =>
        (db.opportunities = [{ id: 'o1' }] as PersonalDatabase['opportunities']),
    ],
    [
      'touches',
      (db: PersonalDatabase) => (db.touches = [{ id: 't1' }] as PersonalDatabase['touches']),
    ],
  ])('is open when the database holds %s', (_name, fill) => {
    const db = createEmptyDatabase()
    fill(db)
    expect(isDashboardOpen(db)).toBe(true)
  })

  it('is open once explicitly claimed, even with an empty database', () => {
    claimDashboard()
    expect(isDashboardOpen(createEmptyDatabase())).toBe(true)
    expect(claimKind()).toBe('owner')
  })

  it('remembers that the demo was opened, so the banner can stay up', () => {
    claimDashboard('demo')
    expect(claimKind()).toBe('demo')
    expect(isDashboardOpen(createEmptyDatabase())).toBe(true)
  })

  it('closes again when the claim is released', () => {
    claimDashboard('demo')
    releaseDashboard()
    expect(claimKind()).toBeNull()
    expect(isDashboardOpen(createEmptyDatabase())).toBe(false)
  })
})

describe('a browser holding a sync token', () => {
  it('is open, because it belongs to whoever configured sync', () => {
    localStorage.setItem(
      'pos.sync',
      JSON.stringify({ owner: 'someone', repo: 'data', token: 'github_pat_x', branch: 'main', path: 'dashboard.json' }),
    )
    expect(isDashboardOpen(createEmptyDatabase())).toBe(true)
  })

  it('is closed when the stored config is incomplete', () => {
    localStorage.setItem('pos.sync', JSON.stringify({ owner: 'someone' }))
    expect(isDashboardOpen(createEmptyDatabase())).toBe(false)
  })
})
