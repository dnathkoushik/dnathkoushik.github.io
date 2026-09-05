/**
 * ============================================================================
 * THE ONE PLACE WHERE "WHERE DOES PRIVATE DATA LIVE" IS DECIDED
 * ============================================================================
 *
 * Everything above this file — the data service, the hooks, every dashboard
 * page — talks to a `StorageAdapter` (see `types/personal.ts`): three methods,
 * one JSON document, no knowledge of the backing store. That seam exists so
 * that moving this dashboard onto a real backend is a single-file change.
 *
 * To swap in Supabase / Firebase / a REST API later:
 *
 *   1. Write `services/storage/remote.ts` exporting a factory that returns
 *      `{ name, load, save, clear }`. `load()` resolves `null` when the user
 *      has no document yet; `save()` writes the whole document (the shape is
 *      small and writes are debounced, so this stays cheap).
 *   2. Return it from `createStorageAdapter()` below — probably behind a check
 *      for a signed-in session, falling through to the local chain when the
 *      user is signed out so the dashboard still works offline.
 *   3. Change nothing else. No component imports anything from this folder.
 *
 * Until then the chain is local-only and degrades on purpose:
 *
 *   IndexedDB  →  localStorage  →  memory
 *   (durable)     (durable, 5MB)   (this session only, and it says so)
 *
 * The last rung is what keeps the app usable in a locked-down browser instead
 * of showing an error page. Settings surfaces `adapter.name` so the user can
 * always see which rung they landed on.
 */
import { createIndexedDbAdapter } from '@/services/storage/indexedDb'
import { createLocalStorageAdapter } from '@/services/storage/localStorage'
import { createMemoryAdapter } from '@/services/storage/memory'
import type { StorageAdapter } from '@/types'

export { createIndexedDbAdapter, idbDelete, idbGet, idbSet } from '@/services/storage/indexedDb'
export {
  createLocalStorageAdapter,
  isLocalStorageAvailable,
} from '@/services/storage/localStorage'
export { createMemoryAdapter } from '@/services/storage/memory'
export { createEncryptedAdapter } from '@/services/storage/encrypted'

/** Picks the best storage this browser will actually allow. Never rejects. */
export async function createStorageAdapter(): Promise<StorageAdapter> {
  try {
    return await createIndexedDbAdapter()
  } catch {
    // Private mode, blocked site data, or a browser without IndexedDB.
  }

  try {
    return createLocalStorageAdapter()
  } catch {
    // Storage is blocked entirely.
  }

  return createMemoryAdapter()
}
