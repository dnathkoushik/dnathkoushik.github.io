/**
 * The command palette's index.
 *
 * One query runs over two very different corpora: the public portfolio content
 * that ships in the bundle, and — only when a database is handed in — the
 * owner's private records. Private hits are flagged so the UI can mark them,
 * and nothing here ever reads storage: if the dashboard is locked the caller
 * passes `null` and the palette silently degrades to public results.
 */
import { PERSONAL_NAV, PERSONAL_ROUTES, PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { achievements, experience, projects, skillCategories } from '@/data'
import type { PersonalDatabase, SearchResult, SearchResultKind } from '@/types'
import { formatWeekLabel } from '@/utils/date'
import { truncate } from '@/utils/format'
import { KIND_META, STAGE_META, WARMTH_META } from '@/utils/outreach'

/** Lower is better, so these read as ranks rather than relevance. */
const SCORE_EXACT = 0
const SCORE_PREFIX = 1
const SCORE_SUBSTRING = 2
const SCORE_BODY = 3

/** How many characters of free text are worth searching per record. */
const BODY_LIMIT = 2000

function normalise(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Rank one record. Title matches always beat body matches; among equal ranks a
 * shorter title wins, which keeps "React" above "React Native internals".
 */
function scoreOf(query: string, title: string, body?: string): number | null {
  const haystack = normalise(title)

  let base: number | null = null
  if (haystack === query) base = SCORE_EXACT
  else if (haystack.startsWith(query)) base = SCORE_PREFIX
  else if (haystack.includes(query)) base = SCORE_SUBSTRING
  else if (body && normalise(body).slice(0, BODY_LIMIT).includes(query)) base = SCORE_BODY

  if (base === null) return null
  return base + Math.min(haystack.length, 200) / 1000
}

interface Candidate {
  id: string
  kind: SearchResultKind
  title: string
  subtitle?: string
  href: string
  date?: string
  private: boolean
  /** Extra free text that is searched but not displayed. */
  body?: string
}

function collect(query: string, candidates: Candidate[], into: SearchResult[]): void {
  for (const candidate of candidates) {
    const score = scoreOf(query, candidate.title, candidate.body)
    if (score === null) continue
    into.push({
      id: candidate.id,
      kind: candidate.kind,
      title: candidate.title,
      subtitle: candidate.subtitle,
      href: candidate.href,
      private: candidate.private,
      score,
      date: candidate.date,
    })
  }
}

/**
 * Round-robin across kinds so a query like "react" cannot return twenty
 * projects and hide the one matching task. Kinds are visited in order of their
 * best hit, so the single most relevant result is still first.
 */
function interleave(results: SearchResult[], limit: number): SearchResult[] {
  const queues = new Map<SearchResultKind, SearchResult[]>()
  for (const result of [...results].sort((a, b) => a.score - b.score)) {
    const queue = queues.get(result.kind)
    if (queue) queue.push(result)
    else queues.set(result.kind, [result])
  }

  const ordered = [...queues.values()].sort((a, b) => a[0].score - b[0].score)
  const out: SearchResult[] = []
  let cursor = 0

  while (out.length < limit) {
    let took = false
    for (const queue of ordered) {
      const item = queue[cursor]
      if (!item) continue
      out.push(item)
      took = true
      if (out.length >= limit) break
    }
    if (!took) break
    cursor += 1
  }

  return out
}

function publicCandidates(): Candidate[] {
  const candidates: Candidate[] = []

  for (const item of PUBLIC_NAV) {
    candidates.push({
      id: `page:${item.href}`,
      kind: 'page',
      title: item.label,
      subtitle: item.description,
      href: item.href,
      private: false,
      body: item.description,
    })
  }

  for (const item of PERSONAL_NAV) {
    candidates.push({
      id: `page:${item.href}`,
      kind: 'page',
      title: item.label,
      subtitle: item.description,
      href: item.href,
      // A dashboard page is private surface even though the menu itself is not
      // derived from the database, so the palette badges it the same way.
      private: true,
      body: item.description,
    })
  }

  for (const project of projects) {
    candidates.push({
      id: `project:${project.id}`,
      kind: 'project',
      title: project.name,
      subtitle: project.summary,
      href: `${PUBLIC_ROUTES.projects}#${project.id}`,
      date: project.date,
      private: false,
      body: [project.summary, project.description, ...project.technologies, ...project.keyFeatures].join(' '),
    })
  }

  for (const category of skillCategories) {
    for (const skill of category.skills) {
      candidates.push({
        id: `skill:${category.id}:${skill.name}`,
        kind: 'skill',
        title: skill.name,
        subtitle: skill.note ?? category.title,
        href: `${PUBLIC_ROUTES.skills}#${category.id}`,
        private: false,
        body: [category.title, skill.note ?? ''].join(' '),
      })
    }
  }

  for (const role of experience) {
    candidates.push({
      id: `experience:${role.id}`,
      kind: 'experience',
      title: role.position,
      subtitle: role.company,
      href: `${PUBLIC_ROUTES.experience}#${role.id}`,
      date: role.startDate,
      private: false,
      body: [role.company, role.description, ...role.achievements, ...role.technologies].join(' '),
    })
  }

  for (const achievement of achievements) {
    candidates.push({
      id: `achievement:${achievement.id}`,
      kind: 'achievement',
      title: achievement.title,
      subtitle: achievement.metric ?? achievement.issuer,
      href: `${PUBLIC_ROUTES.achievements}#${achievement.id}`,
      date: achievement.date,
      private: false,
      body: [achievement.issuer ?? '', achievement.description ?? ''].join(' '),
    })
  }

  return candidates
}

function privateCandidates(db: PersonalDatabase): Candidate[] {
  const candidates: Candidate[] = []
  const categoryLabel = new Map(db.categories.map((category) => [category.id, category.label]))
  const { weekStartsOn } = db.settings

  for (const task of db.tasks) {
    candidates.push({
      id: `task:${task.id}`,
      kind: 'task',
      title: task.title,
      subtitle: categoryLabel.get(task.categoryId),
      href: `${PERSONAL_ROUTES.calendar}?date=${task.date}`,
      date: task.date,
      private: true,
      body: [task.description ?? '', task.notes ?? ''].join(' '),
    })
  }

  for (const log of db.logs) {
    candidates.push({
      id: `log:${log.id}`,
      kind: 'log',
      title: log.activity,
      subtitle: log.notes ? truncate(log.notes, 80) : categoryLabel.get(log.categoryId),
      href: `${PERSONAL_ROUTES.journal}?date=${log.date}`,
      date: log.date,
      private: true,
      body: log.notes,
    })
  }

  for (const goal of db.weeklyGoals) {
    candidates.push({
      id: `goal:${goal.id}`,
      kind: 'goal',
      title: goal.title,
      subtitle: formatWeekLabel(goal.weekKey, weekStartsOn),
      href: `${PERSONAL_ROUTES.goals}?week=${goal.weekKey}`,
      date: goal.deadline,
      private: true,
      body: goal.description,
    })
  }

  for (const goal of db.monthlyGoals) {
    candidates.push({
      id: `goal:${goal.id}`,
      kind: 'goal',
      title: goal.title,
      subtitle: goal.monthKey,
      href: `${PERSONAL_ROUTES.goals}?month=${goal.monthKey}`,
      date: goal.deadline,
      private: true,
      body: goal.description,
    })
  }

  for (const note of db.notes) {
    candidates.push({
      id: `note:${note.id}`,
      kind: 'note',
      title: note.title,
      subtitle: note.tags.length > 0 ? note.tags.join(', ') : truncate(note.body, 80),
      href: `${PERSONAL_ROUTES.journal}?date=${note.date}`,
      date: note.date,
      private: true,
      body: [note.body, ...note.tags].join(' '),
    })
  }

  for (const review of db.reviews) {
    candidates.push({
      id: `review:${review.id}`,
      kind: 'review',
      title: `Weekly review · ${formatWeekLabel(review.weekKey, weekStartsOn)}`,
      subtitle: review.biggestAchievement || review.nextWeekFocus || undefined,
      href: `${PERSONAL_ROUTES.review}?week=${review.weekKey}`,
      private: true,
      body: [
        review.wentWell,
        review.wentWrong,
        review.learned,
        review.improve,
        review.biggestAchievement,
        review.biggestMistake,
        review.nextWeekFocus,
      ].join(' '),
    })
  }

  for (const habit of db.habits) {
    candidates.push({
      id: `habit:${habit.id}`,
      kind: 'habit',
      title: habit.name,
      subtitle: categoryLabel.get(habit.categoryId),
      href: PERSONAL_ROUTES.habits,
      private: true,
      body: habit.unit,
    })
  }

  // Outreach. Each href carries `?id=` so the page can open the record.
  const companyName = new Map(db.companies.map((company) => [company.id, company.name]))

  for (const company of db.companies) {
    candidates.push({
      id: `company:${company.id}`,
      kind: 'company',
      title: company.name,
      subtitle: [KIND_META[company.kind].label, company.location].filter(Boolean).join(' · '),
      href: `${PERSONAL_ROUTES.outreachCompanies}?id=${encodeURIComponent(company.id)}`,
      private: true,
      body: [
        company.industry ?? '',
        company.stage ?? '',
        company.location ?? '',
        company.website ?? '',
        company.why ?? '',
        ...company.tags,
        ...company.facts.map((fact) => fact.text),
      ].join(' '),
    })
  }

  for (const contact of db.contacts) {
    const employer = contact.companyId ? companyName.get(contact.companyId) : undefined
    candidates.push({
      id: `contact:${contact.id}`,
      kind: 'contact',
      title: contact.name,
      subtitle: [contact.role, employer].filter(Boolean).join(' · ') || WARMTH_META[contact.warmth].label,
      href: `${PERSONAL_ROUTES.outreachContacts}?id=${encodeURIComponent(contact.id)}`,
      private: true,
      body: [
        contact.role ?? '',
        employer ?? '',
        contact.email ?? '',
        contact.notes ?? '',
        WARMTH_META[contact.warmth].label,
      ].join(' '),
    })
  }

  for (const opportunity of db.opportunities) {
    const employer = companyName.get(opportunity.companyId)
    candidates.push({
      id: `opportunity:${opportunity.id}`,
      kind: 'opportunity',
      title: opportunity.title,
      subtitle: [employer, STAGE_META[opportunity.stage].label].filter(Boolean).join(' · '),
      href: `${PERSONAL_ROUTES.outreachPipeline}?id=${encodeURIComponent(opportunity.id)}`,
      date: opportunity.nextActionDue ?? opportunity.appliedAt,
      private: true,
      body: [
        employer ?? '',
        opportunity.type,
        opportunity.source,
        opportunity.nextAction ?? '',
        opportunity.notes ?? '',
        opportunity.compensation ?? '',
        opportunity.resumeVersion ?? '',
      ].join(' '),
    })
  }

  return candidates
}

/**
 * Searches the public portfolio and, when `db` is supplied, the private
 * dashboard. Returns at most `limit` results, interleaved across kinds.
 */
export function searchEverything(
  query: string,
  db: PersonalDatabase | null,
  limit = 20,
): SearchResult[] {
  const needle = normalise(query)
  if (needle.length === 0 || limit <= 0) return []

  const results: SearchResult[] = []
  collect(needle, publicCandidates(), results)
  if (db) collect(needle, privateCandidates(db), results)

  return interleave(results, limit)
}
