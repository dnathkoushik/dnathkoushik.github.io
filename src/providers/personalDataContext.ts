/**
 * The React context for the private dashboard — and nothing else.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * The command palette renders on BOTH sides of the site and needs to ask "is
 * there a private data layer mounted right now?". If it imported that question
 * from `PersonalDataProvider.tsx`, it would also import that file's module
 * graph — the storage service, WebCrypto, the migrations and the whole sample
 * dataset — straight into the public portfolio's first chunk. Roughly 100 kB of
 * code that a portfolio visitor must never download, on the site's most
 * performance-sensitive page.
 *
 * Keeping the context and its hooks here, with only type imports, means this
 * module compiles to a few lines. `PersonalDataProvider.tsx` imports it and
 * adds the service; the dashboard is lazily loaded, so the service travels with
 * it. Public code can hold the context without pulling the implementation.
 *
 * Rule of thumb: import from THIS file unless you are rendering the provider.
 */
import { createContext, useContext } from 'react'
import type { PersonalDataContextValue } from '@/services/contracts'

export const PersonalDataContext = createContext<PersonalDataContextValue | null>(null)

/**
 * The private database, its status, and every mutation.
 *
 * Throws outside a `<PersonalDataProvider>`, which is deliberate: a dashboard
 * component that silently renders an empty database is a bug that looks like
 * data loss.
 */
export function usePersonalData(): PersonalDataContextValue {
  const ctx = useContext(PersonalDataContext)
  if (!ctx) {
    throw new Error('usePersonalData must be used inside <PersonalDataProvider>')
  }
  return ctx
}

/**
 * Same value, or `null` when there is no provider.
 *
 * For surfaces that render on both sides of the site — the command palette
 * above all. On a public page there is no private data layer mounted and there
 * must not be one: reaching for it would boot IndexedDB and put a lock screen
 * in front of a portfolio visitor. Callers simply search the public content
 * when this returns null.
 */
export function useOptionalPersonalData(): PersonalDataContextValue | null {
  return useContext(PersonalDataContext)
}
