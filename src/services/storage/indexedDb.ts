/**
 * The primary storage adapter: a small hand-rolled IndexedDB key/value wrapper.
 *
 * IndexedDB is the right home for this data — it survives reloads, has no
 * practical size ceiling for a text database, and never travels to a server.
 * A library would be four lines shorter and one more dependency, so this is
 * written out by hand against `IDB` from `@/config/app`.
 *
 * Everything here is defensive on purpose. Firefox in permanent private mode,
 * Safari with "prevent cross-site tracking" in an iframe, and Chrome with site
 * data blocked all fail in different ways — some throw, some fire `onerror`,
 * some simply never call any callback. A missing record resolves to `null`; a
 * hostile environment rejects promptly, which is what lets
 * `storage/index.ts` fall back to localStorage and then to memory.
 */
import { IDB, STORAGE_KEYS } from '@/config/app'
import type { PersonalDatabase, StorageAdapter } from '@/types'

/** Some browsers open IndexedDB and then never settle. Do not hang the app. */
const OPEN_TIMEOUT_MS = 4000

let connection: Promise<IDBDatabase> | null = null

function indexedDbFactory(): IDBFactory | null {
  try {
    return typeof indexedDB === 'undefined' ? null : indexedDB
  } catch {
    // Accessing the global itself throws in some locked-down configurations.
    return null
  }
}

function openConnection(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const factory = indexedDbFactory()
    if (!factory) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }

    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }
    const timer = setTimeout(() => {
      finish(() => reject(new Error('Timed out while opening IndexedDB.')))
    }, OPEN_TIMEOUT_MS)

    let request: IDBOpenDBRequest
    try {
      request = factory.open(IDB.database, IDB.version)
    } catch (error) {
      finish(() => reject(toError(error, 'IndexedDB refused to open.')))
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(IDB.store)) {
        db.createObjectStore(IDB.store)
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // Another tab requested a version change: drop this handle so the next
      // call reopens instead of using a connection that is about to close.
      db.onversionchange = () => {
        db.close()
        connection = null
      }
      db.onclose = () => {
        connection = null
      }
      finish(() => resolve(db))
    }
    request.onerror = () => {
      finish(() => reject(toError(request.error, 'IndexedDB could not be opened.')))
    }
    request.onblocked = () => {
      finish(() => reject(new Error('Another tab is blocking an IndexedDB upgrade.')))
    }
  })
}

function getConnection(): Promise<IDBDatabase> {
  if (!connection) {
    connection = openConnection().catch((error: unknown) => {
      connection = null
      throw toError(error, 'IndexedDB is unavailable.')
    })
  }
  return connection
}

function toError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value
  if (typeof value === 'string' && value) return new Error(value)
  return new Error(fallback)
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return getConnection().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let transaction: IDBTransaction
        try {
          transaction = db.transaction(IDB.store, mode)
        } catch (error) {
          reject(toError(error, 'Could not start an IndexedDB transaction.'))
          return
        }
        let request: IDBRequest<T>
        try {
          request = body(transaction.objectStore(IDB.store))
        } catch (error) {
          reject(toError(error, 'IndexedDB rejected the request.'))
          return
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(toError(request.error, 'IndexedDB request failed.'))
        transaction.onabort = () =>
          reject(toError(transaction.error, 'IndexedDB transaction was aborted.'))
      }),
  )
}

export function idbGet<T>(key: string): Promise<T | null> {
  return runTransaction<T | undefined>('readonly', (store) => store.get(key)).then((value) =>
    value === undefined ? null : value,
  )
}

export function idbSet(key: string, value: unknown): Promise<void> {
  return runTransaction('readwrite', (store) => store.put(value, key)).then(() => undefined)
}

export function idbDelete(key: string): Promise<void> {
  return runTransaction('readwrite', (store) => store.delete(key)).then(() => undefined)
}

/**
 * Resolves an adapter only when IndexedDB is genuinely usable — the probe read
 * proves the store exists and can be queried, not merely that the global is
 * defined. Rejects otherwise so the caller can fall back.
 */
export async function createIndexedDbAdapter(): Promise<StorageAdapter> {
  // Probe first: a browser that blocks storage typically fails right here.
  await idbGet<unknown>(`${STORAGE_KEYS.database}.probe`)

  return {
    name: 'IndexedDB (this browser)',
    async load() {
      const value = await idbGet<PersonalDatabase>(STORAGE_KEYS.database)
      return value ?? null
    },
    async save(db) {
      await idbSet(STORAGE_KEYS.database, db)
    },
    async clear() {
      await idbDelete(STORAGE_KEYS.database)
    },
  }
}
