/**
 * Live GitHub data for the public /github page.
 *
 * Unauthenticated on purpose. This bundle is served from a public URL, so any
 * token committed here would be a token given away — there is no such thing as
 * a "hidden" secret in a static site. The anonymous REST API allows 60 requests
 * per hour per IP, which is why every response is cached in sessionStorage for
 * an hour: a visitor clicking around the site pays for one request, not one per
 * page view.
 *
 * Nothing here ever throws. Offline, rate limited (403), unknown user (404),
 * malformed payload — every path resolves to `null` or `[]`, and the page
 * renders the static fallback from `data/github.ts` instead. A portfolio that
 * shows an error box because someone else's API is having a bad day is worse
 * than a portfolio that quietly shows what it already knows.
 *
 * WHEN 60/HOUR IS NOT ENOUGH: this is the file to change. The two options that
 * do not leak a token are (a) a scheduled GitHub Action that writes a
 * `public/github-stats.json` at build time, fetched here instead of the API, or
 * (b) a tiny serverless proxy holding the token, called from `request()` below.
 * Either way, only this file changes; the page reads the same two functions.
 */
import { STORAGE_PREFIX } from '@/config/app'

const API_ROOT = 'https://api.github.com'
const CACHE_TTL_MS = 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000
const CACHE_PREFIX = `${STORAGE_PREFIX}.gh`

export interface GithubProfile {
  login: string
  name: string | null
  avatarUrl: string
  htmlUrl: string
  bio: string | null
  company: string | null
  location: string | null
  blog: string | null
  publicRepos: number
  followers: number
  following: number
  /** ISO instant the account was created. */
  createdAt: string
}

export interface GithubRepo {
  id: number
  name: string
  fullName: string
  description: string | null
  htmlUrl: string
  homepage: string | null
  language: string | null
  stars: number
  forks: number
  openIssues: number
  topics: string[]
  isFork: boolean
  isArchived: boolean
  /** ISO instant of the last push. */
  pushedAt: string
  /** True when the repo was named in `pinnedRepos`. */
  pinned: boolean
}

/* -------------------------------------------------------------------------- *
 * Session cache
 * -------------------------------------------------------------------------- */

interface CacheEntry<T> {
  at: number
  value: T
}

function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}.${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry<T>
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > CACHE_TTL_MS) return null
    return parsed.value
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    const entry: CacheEntry<T> = { at: Date.now(), value }
    sessionStorage.setItem(`${CACHE_PREFIX}.${key}`, JSON.stringify(entry))
  } catch {
    // Storage blocked or full: the only cost is another request next time.
  }
}

/** Drops the cached responses, so the next call goes to the network. */
export function clearGithubCache(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key)
    }
  } catch {
    // Nothing cached, nothing to clear.
  }
}

/* -------------------------------------------------------------------------- *
 * Fetching
 * -------------------------------------------------------------------------- */

async function request<T>(path: string): Promise<T | null> {
  if (typeof fetch !== 'function') return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
    // 403 is the rate limit, 404 an unknown user, 5xx their bad day. All of
    // them mean the same thing here: render the static fallback.
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------------------------------------------------------- *
 * Raw payload shapes — only the fields actually used
 * -------------------------------------------------------------------------- */

interface RawUser {
  login?: unknown
  name?: unknown
  avatar_url?: unknown
  html_url?: unknown
  bio?: unknown
  company?: unknown
  location?: unknown
  blog?: unknown
  public_repos?: unknown
  followers?: unknown
  following?: unknown
  created_at?: unknown
}

interface RawRepo {
  id?: unknown
  name?: unknown
  full_name?: unknown
  description?: unknown
  html_url?: unknown
  homepage?: unknown
  language?: unknown
  stargazers_count?: unknown
  forks_count?: unknown
  open_issues_count?: unknown
  topics?: unknown
  fork?: unknown
  archived?: unknown
  pushed_at?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/* -------------------------------------------------------------------------- *
 * Public API
 * -------------------------------------------------------------------------- */

/** Resolves `null` on any failure — the caller renders static content instead. */
export async function fetchGithubProfile(username: string): Promise<GithubProfile | null> {
  const handle = username.trim()
  if (!handle) return null

  const cacheKey = `profile.${handle.toLowerCase()}`
  const cached = readCache<GithubProfile>(cacheKey)
  if (cached) return cached

  const raw = await request<RawUser>(`/users/${encodeURIComponent(handle)}`)
  if (!raw || typeof raw !== 'object' || !text(raw.login)) return null

  const profile: GithubProfile = {
    login: text(raw.login),
    name: nullableText(raw.name),
    avatarUrl: text(raw.avatar_url),
    htmlUrl: text(raw.html_url) || `https://github.com/${handle}`,
    bio: nullableText(raw.bio),
    company: nullableText(raw.company),
    location: nullableText(raw.location),
    blog: nullableText(raw.blog),
    publicRepos: count(raw.public_repos),
    followers: count(raw.followers),
    following: count(raw.following),
    createdAt: text(raw.created_at),
  }
  writeCache(cacheKey, profile)
  return profile
}

/**
 * Public repositories, pinned ones first and in the order given.
 *
 * `pinned` holds `"owner/name"` strings from `data/github.ts`. Forks and
 * archived repositories are hidden unless they were explicitly pinned, because
 * a wall of forks says nothing about what someone has built.
 *
 * Resolves `[]` on any failure.
 */
export async function fetchGithubRepos(username: string, pinned: string[]): Promise<GithubRepo[]> {
  const handle = username.trim()
  if (!handle) return []

  const cacheKey = `repos.${handle.toLowerCase()}`
  const cached = readCache<GithubRepo[]>(cacheKey)
  const pinnedOrder = new Map(
    pinned.map((entry, index) => [entry.trim().toLowerCase(), index] as const),
  )

  const rank = (repo: GithubRepo): number =>
    pinnedOrder.get(repo.fullName.toLowerCase()) ??
    pinnedOrder.get(repo.name.toLowerCase()) ??
    Number.POSITIVE_INFINITY

  const decorate = (repos: GithubRepo[]): GithubRepo[] =>
    repos
      .map((repo) => ({ ...repo, pinned: rank(repo) !== Number.POSITIVE_INFINITY }))
      .filter((repo) => repo.pinned || (!repo.isFork && !repo.isArchived))
      .sort((a, b) => {
        const byPin = rank(a) - rank(b)
        if (byPin !== 0 && Number.isFinite(byPin)) return byPin
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        if (b.stars !== a.stars) return b.stars - a.stars
        return Date.parse(b.pushedAt) - Date.parse(a.pushedAt)
      })

  if (cached) return decorate(cached)

  const raw = await request<RawRepo[]>(
    `/users/${encodeURIComponent(handle)}/repos?per_page=100&sort=updated`,
  )
  if (!Array.isArray(raw)) return []

  const repos: GithubRepo[] = raw
    .filter((entry): entry is RawRepo => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      id: count(entry.id),
      name: text(entry.name),
      fullName: text(entry.full_name) || `${handle}/${text(entry.name)}`,
      description: nullableText(entry.description),
      htmlUrl: text(entry.html_url),
      homepage: nullableText(entry.homepage),
      language: nullableText(entry.language),
      stars: count(entry.stargazers_count),
      forks: count(entry.forks_count),
      openIssues: count(entry.open_issues_count),
      topics: Array.isArray(entry.topics)
        ? entry.topics.filter((topic): topic is string => typeof topic === 'string')
        : [],
      isFork: entry.fork === true,
      isArchived: entry.archived === true,
      pushedAt: text(entry.pushed_at),
      pinned: false,
    }))
    .filter((repo) => repo.name.length > 0)

  writeCache(cacheKey, repos)
  return decorate(repos)
}

/**
 * Totals worth putting on the page. Derived from what was already fetched, so
 * it costs no extra request.
 */
export function summarizeRepos(repos: GithubRepo[]): {
  repos: number
  stars: number
  forks: number
  languages: { name: string; count: number }[]
} {
  const languages = new Map<string, number>()
  let stars = 0
  let forks = 0
  for (const repo of repos) {
    stars += repo.stars
    forks += repo.forks
    if (repo.language) languages.set(repo.language, (languages.get(repo.language) ?? 0) + 1)
  }
  return {
    repos: repos.length,
    stars,
    forks,
    languages: [...languages.entries()]
      .map(([name, value]) => ({ name, count: value }))
      .sort((a, b) => b.count - a.count),
  }
}
