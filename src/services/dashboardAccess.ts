/**
 * Whether this browser should be shown the dashboard at all.
 *
 * `/dashboard` is a public URL, so this is not — and cannot be — a security
 * boundary. It is an honesty boundary: a visitor who has never used this
 * dashboard must not be dropped into something that looks like the owner's
 * private week. The actual data is protected by GitHub's auth on a private
 * repository, which is real.
 *
 * A browser counts as claimed when any of these is true:
 *   - it already holds dashboard data (the owner has used it here before)
 *   - GitHub sync is configured (a token for the private repo is present)
 *   - someone explicitly opened the demo
 */
import { STORAGE_PREFIX } from '@/config/app'
import { readSyncConfig } from '@/services/githubSync'
import type { PersonalDatabase } from '@/types'

const CLAIM_KEY = `${STORAGE_PREFIX}.claimed`

export type ClaimKind = 'owner' | 'demo'

export function claimDashboard(kind: ClaimKind = 'owner'): void {
  try {
    localStorage.setItem(CLAIM_KEY, kind)
  } catch {
    // Storage blocked. The gate will reappear on reload, which is the safe way
    // to fail — it never wrongly opens.
  }
}

export function releaseDashboard(): void {
  try {
    localStorage.removeItem(CLAIM_KEY)
  } catch {
    /* nothing to do */
  }
}

export function claimKind(): ClaimKind | null {
  try {
    const value = localStorage.getItem(CLAIM_KEY)
    return value === 'owner' || value === 'demo' ? value : null
  } catch {
    return null
  }
}

/** True when the database holds anything the owner actually put there. */
export function hasAnyData(db: PersonalDatabase): boolean {
  return (
    db.tasks.length > 0 ||
    db.logs.length > 0 ||
    db.weeklyGoals.length > 0 ||
    db.monthlyGoals.length > 0 ||
    db.habits.length > 0 ||
    db.notes.length > 0 ||
    db.reviews.length > 0 ||
    db.days.length > 0 ||
    // Outreach (v2). Templates are excluded: the defaults ship with an empty DB.
    db.companies.length > 0 ||
    db.contacts.length > 0 ||
    db.opportunities.length > 0 ||
    db.touches.length > 0
  )
}

/**
 * Data already on the device implies the owner, so an existing user is never
 * locked out of their own dashboard by this check being added later.
 */
export function isDashboardOpen(db: PersonalDatabase): boolean {
  return claimKind() !== null || readSyncConfig() !== null || hasAnyData(db)
}
