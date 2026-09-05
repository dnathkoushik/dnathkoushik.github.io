/**
 * Number, string and design-token formatting.
 *
 * The `CAT_CLASSES` table below is deliberately written out as complete literal
 * class names rather than built with template strings. Tailwind v4 scans source
 * files for whole class names, so `bg-cat-${color}` would generate nothing and
 * every category would render colourless in production.
 */
import type { CategoryColor, GoalStatus, Priority, TaskStatus, Tone } from '@/types'

const NUMBER_FORMAT = new Intl.NumberFormat('en-US')

/**
 * `value` as a whole-number percentage of `total`.
 * Returns 0 rather than NaN when `total` is 0 — an empty day is 0% done, not
 * "not a number".
 */
export function percent(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0) return 0
  return Math.round((value / total) * 100)
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

/**
 * A count and its noun: `pluralize(3, 'task')` → `"3 tasks"`,
 * `pluralize(1, 'entry', 'entries')` → `"1 entry"`.
 * The number is part of the returned string — do not print it again.
 */
export function pluralize(n: number, singular: string, plural?: string): string {
  const word = Math.abs(n) === 1 ? singular : (plural ?? `${singular}s`)
  return `${numberFormat(n)} ${word}`
}

/** "Koushik Debnath" → "KD". At most two letters, always upper case. */
export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word))

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

/** Cuts to `max` characters and appends an ellipsis. Never returns "…" alone. */
export function truncate(text: string, max: number): string {
  const value = text.trim()
  if (max <= 0) return ''
  if (value.length <= max) return value
  return `${value.slice(0, max).trimEnd()}…`
}

/** Thousands separators, using a fixed locale so output is deterministic. */
export function numberFormat(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return NUMBER_FORMAT.format(n)
}

/** The CSS custom property behind a category colour, for inline chart fills. */
export function catVar(color: CategoryColor): string {
  return `var(--color-cat-${color})`
}

/**
 * Every Tailwind class a category colour can produce, written out in full so
 * the scanner can see them.
 */
export const CAT_CLASSES: Record<
  CategoryColor,
  { text: string; bg: string; softBg: string; border: string; ring: string }
> = {
  1: {
    text: 'text-cat-1',
    bg: 'bg-cat-1',
    softBg: 'bg-cat-1/12',
    border: 'border-cat-1/30',
    ring: 'ring-cat-1/30',
  },
  2: {
    text: 'text-cat-2',
    bg: 'bg-cat-2',
    softBg: 'bg-cat-2/12',
    border: 'border-cat-2/30',
    ring: 'ring-cat-2/30',
  },
  3: {
    text: 'text-cat-3',
    bg: 'bg-cat-3',
    softBg: 'bg-cat-3/12',
    border: 'border-cat-3/30',
    ring: 'ring-cat-3/30',
  },
  4: {
    text: 'text-cat-4',
    bg: 'bg-cat-4',
    softBg: 'bg-cat-4/12',
    border: 'border-cat-4/30',
    ring: 'ring-cat-4/30',
  },
  5: {
    text: 'text-cat-5',
    bg: 'bg-cat-5',
    softBg: 'bg-cat-5/12',
    border: 'border-cat-5/30',
    ring: 'ring-cat-5/30',
  },
  6: {
    text: 'text-cat-6',
    bg: 'bg-cat-6',
    softBg: 'bg-cat-6/12',
    border: 'border-cat-6/30',
    ring: 'ring-cat-6/30',
  },
  7: {
    text: 'text-cat-7',
    bg: 'bg-cat-7',
    softBg: 'bg-cat-7/12',
    border: 'border-cat-7/30',
    ring: 'ring-cat-7/30',
  },
  8: {
    text: 'text-cat-8',
    bg: 'bg-cat-8',
    softBg: 'bg-cat-8/12',
    border: 'border-cat-8/30',
    ring: 'ring-cat-8/30',
  },
}

/** Falls back to the first palette entry when a category has no colour set. */
export function catClasses(color?: CategoryColor) {
  return CAT_CLASSES[color ?? 1]
}

export function priorityTone(priority: Priority): Tone {
  switch (priority) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function statusTone(status: TaskStatus): Tone {
  switch (status) {
    case 'completed':
      return 'positive'
    case 'in-progress':
      return 'accent'
    case 'skipped':
      return 'neutral'
    case 'not-started':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function goalStatusTone(status: GoalStatus): Tone {
  switch (status) {
    case 'completed':
      return 'positive'
    case 'active':
      return 'accent'
    case 'missed':
      return 'danger'
    case 'archived':
      return 'neutral'
    default:
      return 'neutral'
  }
}
