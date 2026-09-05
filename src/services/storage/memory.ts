/**
 * Last-resort adapter: the app keeps working when every form of persistence is
 * blocked, but nothing survives a reload.
 *
 * Its `name` says so out loud because Settings renders it verbatim — a user who
 * is about to write a week of journal entries into a browser that will throw
 * them away deserves to be told before, not after.
 */
import type { PersonalDatabase, StorageAdapter } from '@/types'

/** Structured clone with a JSON fallback, so callers cannot mutate the store. */
function clone(db: PersonalDatabase): PersonalDatabase {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(db)
    } catch {
      // Fall through to JSON for anything structuredClone refuses.
    }
  }
  return JSON.parse(JSON.stringify(db)) as PersonalDatabase
}

export function createMemoryAdapter(): StorageAdapter {
  let document: PersonalDatabase | null = null

  return {
    name: 'In-memory (not saved)',
    async load() {
      return document ? clone(document) : null
    },
    async save(db) {
      document = clone(db)
    },
    async clear() {
      document = null
    },
  }
}
