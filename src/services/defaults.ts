/**
 * The shape of a brand-new private database.
 *
 * Category ids here are hand-written and STABLE (`cat-dsa`, never a generated
 * id) because `sampleData.ts`, `migrations.ts` and every future migration refer
 * to them by name. Renaming one of these ids orphans data; changing a `label`
 * or `color` is free.
 */
import { DB_VERSION } from '@/config/app'
import type { Category, CategoryColor, PersonalDatabase, PersonalSettings } from '@/types'

/**
 * Eight starting buckets, one per `--color-cat-*` token so a fresh database is
 * already legible in charts. The user can rename, recolour or delete any of
 * them from Settings.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-dsa', label: 'DSA', color: 1, icon: 'Binary' },
  { id: 'cat-dev', label: 'Development', color: 2, icon: 'Code' },
  { id: 'cat-system-design', label: 'System Design', color: 3, icon: 'Network' },
  { id: 'cat-learning', label: 'Learning', color: 4, icon: 'BookOpen' },
  { id: 'cat-career', label: 'Career', color: 5, icon: 'Briefcase' },
  { id: 'cat-health', label: 'Health', color: 6, icon: 'HeartPulse' },
  { id: 'cat-personal', label: 'Personal', color: 7, icon: 'User' },
  { id: 'cat-admin', label: 'Admin', color: 8, icon: 'Inbox' },
]

/**
 * Used whenever a record arrives without a usable category — an import from an
 * older export, or a quick-add that skipped the picker.
 */
export const FALLBACK_CATEGORY_ID = 'cat-dsa'

export const DEFAULT_SETTINGS: PersonalSettings = {
  weekStartsOn: 1,
  dailyHoursTarget: 6,
  dailyTaskTarget: 5,
  // Intentionally blank: the greeting must not address a stranger by the
  // owner's name. Set in Settings once, then it is stored per device.
  displayName: '',
  seedDataCleared: false,
}

/** Every colour token, in order. Used when auto-assigning a new category. */
export const CATEGORY_COLORS: CategoryColor[] = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Picks the colour that is used least among `existing`, so adding categories
 * one at a time still produces a readable palette instead of eight blues.
 */
export function nextCategoryColor(existing: { color: CategoryColor }[]): CategoryColor {
  const counts = new Map<CategoryColor, number>(CATEGORY_COLORS.map((color) => [color, 0]))
  for (const item of existing) {
    counts.set(item.color, (counts.get(item.color) ?? 0) + 1)
  }
  let best: CategoryColor = CATEGORY_COLORS[0]
  let bestCount = Number.POSITIVE_INFINITY
  for (const color of CATEGORY_COLORS) {
    const count = counts.get(color) ?? 0
    if (count < bestCount) {
      best = color
      bestCount = count
    }
  }
  return best
}

/** A valid, empty `PersonalDatabase` at the current schema version. */
export function createEmptyDatabase(): PersonalDatabase {
  return {
    version: DB_VERSION,
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    tasks: [],
    logs: [],
    weeklyGoals: [],
    monthlyGoals: [],
    habits: [],
    habitEntries: [],
    reviews: [],
    notes: [],
    days: [],
    settings: { ...DEFAULT_SETTINGS },
  }
}
