/**
 * Application-level constants. Content lives in `src/data/`; this file is for
 * wiring only.
 */

export const APP_NAME = 'Portfolio OS'

/** Namespace for every browser-storage key this app owns. */
export const STORAGE_PREFIX = 'pos'

export const STORAGE_KEYS = {
  /** 'light' | 'dark' | 'system'. Also read by the inline script in index.html. */
  theme: `${STORAGE_PREFIX}.theme`,
  /** The private database document (IndexedDB primary, localStorage fallback). */
  database: `${STORAGE_PREFIX}.db`,
  /** Unencrypted metadata about the privacy lock. Never holds the passphrase. */
  lock: `${STORAGE_PREFIX}.lock`,
  /** Session flag set after a successful unlock, cleared when the tab closes. */
  unlocked: `${STORAGE_PREFIX}.unlocked`,
  /** Collapsed/expanded state of the dashboard sidebar. */
  sidebar: `${STORAGE_PREFIX}.sidebar`,
} as const

/** IndexedDB database and object-store names. */
export const IDB = {
  database: `${STORAGE_PREFIX}-store`,
  store: 'keyval',
  version: 1,
} as const

/**
 * Schema version of `PersonalDatabase`. Bump this and add a migration in
 * `services/migrations.ts` whenever the stored shape changes.
 */
export const DB_VERSION = 2 // v2: outreach (companies, contacts, opportunities, touches, templates)

/** Milliseconds of inactivity before a mutated database is flushed to storage. */
export const PERSIST_DEBOUNCE_MS = 250

/**
 * `import.meta.env.BASE_URL` is what Vite substitutes for the configured base
 * path. Router basename must not carry the trailing slash.
 */
export const BASE_URL: string = import.meta.env.BASE_URL
export const ROUTER_BASENAME: string = BASE_URL.replace(/\/$/, '')

/** Resolves a path in `public/` against the deployed base path. */
export function asset(path: string): string {
  return `${BASE_URL}${path.replace(/^\//, '')}`
}
