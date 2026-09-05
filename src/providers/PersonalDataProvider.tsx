/**
 * The bridge between the private data service and the React tree.
 *
 * WHY IT LOOKS LIKE THIS
 *
 * `PersonalDataService` is a plain singleton store, so the whole provider is
 * four `useSyncExternalStore` reads and a memo. Three rules matter:
 *
 *  1. The store functions are read ONCE at module scope. `useSyncExternalStore`
 *     resubscribes whenever the `subscribe` identity changes, so passing
 *     `personalData.subscribe` inline would tear down and rebuild the
 *     subscription on every render. They are arrow-function class properties,
 *     so they are already bound and safe to detach.
 *  2. `db` is the only object snapshot; `status`, `error` and `storageName` are
 *     primitives. The service bumps the document identity on every status or
 *     lock transition too, so a single subscription keeps all four in step and
 *     there is nothing to tear.
 *  3. `actions` and `lock` are the service itself and its stable `lockApi`
 *     object, so they never change identity and pages can safely list them in
 *     effect dependency arrays.
 *
 * While `status` is 'loading' or 'locked', `db` is a valid empty database — no
 * page ever has to null-check it.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { personalData } from '@/services/personalData'
import { PersonalDataContext } from '@/providers/personalDataContext'
import type { PersonalDataContextValue, PersonalStatus } from '@/services/contracts'

/*
 * Detached once, never re-read. See rule 1 above.
 */
const subscribe = personalData.subscribe
const getDatabase = personalData.getSnapshot
const getStatus = personalData.getStatus
const getError = personalData.getError
const getStorageName = personalData.getStorageName

/**
 * Bootstrap is kept at module scope rather than in a ref so that React 19
 * StrictMode's deliberate double-invoke of effects — and a second provider
 * mounted anywhere else in the tree — share one and the same startup.
 */
let bootPromise: Promise<void> | null = null

function boot(): Promise<void> {
  if (!bootPromise) bootPromise = personalData.init()
  return bootPromise
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'The private data layer could not start in this browser.'
}

export function PersonalDataProvider({ children }: { children: ReactNode }) {
  const db = useSyncExternalStore(subscribe, getDatabase, getDatabase)
  const serviceStatus = useSyncExternalStore(subscribe, getStatus, getStatus)
  const serviceError = useSyncExternalStore(subscribe, getError, getError)
  const storageName = useSyncExternalStore(subscribe, getStorageName, getStorageName)

  /*
   * The service reports its own failures through `status`, but a rejection
   * thrown before it can do that would leave the dashboard spinning forever.
   * This is the seatbelt for that one case.
   */
  const [bootFailure, setBootFailure] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    boot().catch((error: unknown) => {
      if (!cancelled) setBootFailure(messageOf(error))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const stuck = bootFailure !== null && serviceStatus === 'loading'
  const status: PersonalStatus = stuck ? 'error' : serviceStatus
  const error = stuck ? (bootFailure ?? undefined) : serviceError

  const value = useMemo<PersonalDataContextValue>(
    () => ({
      db,
      status,
      error,
      actions: personalData,
      lock: personalData.lockApi,
      storageName,
    }),
    [db, status, error, storageName],
  )

  return <PersonalDataContext.Provider value={value}>{children}</PersonalDataContext.Provider>
}
