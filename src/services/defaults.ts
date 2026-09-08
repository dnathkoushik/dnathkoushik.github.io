/**
 * The shape of a brand-new private database.
 *
 * Category ids here are hand-written and STABLE (`cat-dsa`, never a generated
 * id) because `sampleData.ts`, `migrations.ts` and every future migration refer
 * to them by name. Renaming one of these ids orphans data; changing a `label`
 * or `color` is free.
 */
import { DB_VERSION } from '@/config/app'
import type { Category, CategoryColor, FitCriterion, MessageTemplate, OutreachSettings, PersonalDatabase, PersonalSettings } from '@/types'

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
/* -------------------------------------------------------------------------- *
 * Outreach defaults
 * -------------------------------------------------------------------------- */

/**
 * The fit criteria a fresh dashboard scores companies against. Weights are
 * relative (1–5); edit them in Settings -> Outreach. Stable ids, so the fit
 * values stored on companies keep meaning if a label is reworded.
 */
export const DEFAULT_FIT_CRITERIA: FitCriterion[] = [
  { id: 'fit-hiring', label: 'Hiring interns / new grads right now', weight: 5 },
  { id: 'fit-backend', label: 'Backend or infrastructure work', weight: 4 },
  { id: 'fit-stack', label: 'Stack overlaps (Python, TypeScript, FastAPI, Node)', weight: 3 },
  { id: 'fit-remote', label: 'Remote-friendly or India-based', weight: 4 },
  { id: 'fit-warm', label: 'A warm path in (alumni, referral, prior contact)', weight: 3 },
  { id: 'fit-learn', label: 'A stage where I would learn the most', weight: 2 },
]

export const DEFAULT_OUTREACH: OutreachSettings = {
  weeklyTarget: 15,
  followUpDays: [4, 10],
  staleAfterDays: 10,
  fitCriteria: DEFAULT_FIT_CRITERIA,
}

const TEMPLATE_STAMP = '2026-09-01T00:00:00.000Z'

/**
 * Four messages that are actually worth sending. `{{name}}`, `{{company}}`,
 * `{{role}}`, `{{hook}}` and `{{me}}` are filled in at compose time. These are
 * defaults, not personal data — edit them freely in Templates.
 */
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl-cold-founder',
    name: 'Cold email — founder / hiring manager',
    channel: 'email',
    purpose: 'cold',
    subject: '{{role}} at {{company}} — {{me}}',
    body: `Hi {{name}},

{{hook}}

I'm a final-year EE student at IIT Kharagpur (CS minor), currently the sole engineer on a production GTM platform at Insurge AI — schema, API, migrations and a 514-case test suite. Before that I built a rendered-output evaluation pipeline at Salesforce and got a return offer.

I'm looking for a {{role}} role where the backend has to be right every time. If {{company}} is hiring, I'd love 20 minutes to hear what you're building and whether I'd be useful. Portfolio and code: https://dnathkoushik.github.io

Thanks for reading,
{{me}}`,
    archived: false,
    createdAt: TEMPLATE_STAMP,
    updatedAt: TEMPLATE_STAMP,
  },
  {
    id: 'tpl-follow-up',
    name: 'Follow-up — short and specific',
    channel: 'email',
    purpose: 'follow-up',
    subject: 'Re: {{role}} at {{company}}',
    body: `Hi {{name}},

Following up on my note from last week about {{role}} at {{company}}. {{hook}}

If now isn't the right time, a pointer to whoever owns hiring for the team would be a big help — and if it's a no, that's useful too.

{{me}}`,
    archived: false,
    createdAt: TEMPLATE_STAMP,
    updatedAt: TEMPLATE_STAMP,
  },
  {
    id: 'tpl-referral',
    name: 'Referral request — alumni / warm contact',
    channel: 'linkedin',
    purpose: 'referral',
    body: `Hi {{name}} — fellow KGPian here. {{hook}}

I'm applying for {{role}} at {{company}} and would really value a referral, or just five minutes on what the team looks for. Happy to send a one-paragraph summary and my resume so it costs you nothing to forward.

Either way, thanks — {{me}}`,
    archived: false,
    createdAt: TEMPLATE_STAMP,
    updatedAt: TEMPLATE_STAMP,
  },
  {
    id: 'tpl-connection',
    name: 'LinkedIn connection note',
    channel: 'linkedin',
    purpose: 'connection',
    body: `Hi {{name}} — {{hook}} I'm a backend-leaning engineer (IIT KGP, ex-Salesforce, currently Insurge AI) exploring {{role}} roles and would like to follow what {{company}} is building. — {{me}}`,
    archived: false,
    createdAt: TEMPLATE_STAMP,
    updatedAt: TEMPLATE_STAMP,
  },
]

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
    companies: [],
    contacts: [],
    opportunities: [],
    touches: [],
    templates: DEFAULT_TEMPLATES.map((template) => ({ ...template })),
    outreach: { ...DEFAULT_OUTREACH, fitCriteria: DEFAULT_FIT_CRITERIA.map((c) => ({ ...c })) },
  }
}
