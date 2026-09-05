/**
 * Fallback adapter for browsers where IndexedDB is blocked or broken.
 *
 * localStorage is synchronous and capped at roughly 5 MB per origin, which is
 * plenty for a text database but not endless — a `QuotaExceededError` is
 * surfaced as a readable message so the UI can tell the user to export and
 * prune rather than silently losing a write.
 */
import { STORAGE_KEYS } from '@/config/app'
import type { PersonalDatabase, StorageAdapter } from '@/types'

const PROBE_KEY = `${STORAGE_KEYS.database}.probe`

/** Safari in private mode exposes `localStorage` and then throws on write. */
export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(PROBE_KEY, '1')
    localStorage.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}

/** Throws when localStorage cannot be written, so the caller can fall back. */
export function createLocalStorageAdapter(): StorageAdapter {
  if (!isLocalStorageAvailable()) {
    throw new Error('Local storage is not available in this browser.')
  }

  return {
    name: 'Local storage (this browser)',
    async load() {
      const raw = localStorage.getItem(STORAGE_KEYS.database)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as PersonalDatabase
      } catch {
        // Corrupt JSON is treated as "nothing stored". The service seeds a
        // fresh database rather than leaving the dashboard permanently broken.
        return null
      }
    },
    async save(db) {
      try {
        localStorage.setItem(STORAGE_KEYS.database, JSON.stringify(db))
      } catch (error) {
        const name = error instanceof Error ? error.name : ''
        if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
          throw new Error(
            'This browser ran out of local storage. Export a backup, then clear older entries.',
            { cause: error },
          )
        }
        throw error instanceof Error
          ? error
          : new Error('Local storage refused the write.', { cause: error })
      }
    },
    async clear() {
      localStorage.removeItem(STORAGE_KEYS.database)
    },
  }
}
