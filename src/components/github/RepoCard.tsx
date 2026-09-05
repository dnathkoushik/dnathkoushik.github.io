import type { GithubRepo } from '@/services/github'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { numberFormat } from '@/utils/format'
import { cn } from '@/lib/cn'

/*
 * Language colours come out of the category palette rather than GitHub's own
 * hex values: those are tuned for a white page and several of them disappear
 * against the dark theme. The map covers what actually shows up on a student's
 * profile; anything else is hashed to a stable slot so a language never changes
 * colour between renders.
 */
const LANGUAGE_CAT: Record<string, number> = {
  typescript: 1,
  javascript: 3,
  python: 8,
  go: 5,
  java: 6,
  'c++': 4,
  c: 7,
  'c#': 7,
  rust: 6,
  ruby: 6,
  kotlin: 4,
  swift: 6,
  php: 7,
  dart: 5,
  html: 6,
  css: 7,
  scss: 7,
  shell: 2,
  lua: 1,
  vue: 2,
  svelte: 6,
  'jupyter notebook': 3,
  dockerfile: 5,
  makefile: 2,
  cmake: 2,
  sql: 5,
}

function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/** The category slot (1-8) a language is drawn in. */
// eslint-disable-next-line react-refresh/only-export-components
export function languageCat(language: string): number {
  const key = language.trim().toLowerCase()
  return LANGUAGE_CAT[key] ?? (hashString(key) % 8) + 1
}

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const UNITS: { limit: number; ms: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { limit: 60_000, ms: 1_000, unit: 'second' },
  { limit: 3_600_000, ms: 60_000, unit: 'minute' },
  { limit: 86_400_000, ms: 3_600_000, unit: 'hour' },
  { limit: 2_592_000_000, ms: 86_400_000, unit: 'day' },
  { limit: 31_536_000_000, ms: 2_592_000_000, unit: 'month' },
  { limit: Number.POSITIVE_INFINITY, ms: 31_536_000_000, unit: 'year' },
]

/**
 * "3 days ago" for an ISO instant.
 *
 * `pushedAt` is a UTC timestamp rather than a calendar date, so it is formatted
 * here instead of through `utils/date` — that module deliberately only speaks
 * local calendar days.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function relativeInstant(iso: string): string {
  const parsed = Date.parse(iso)
  if (!Number.isFinite(parsed)) return ''
  const delta = parsed - Date.now()
  const magnitude = Math.abs(delta)
  const scale = UNITS.find((entry) => magnitude < entry.limit) ?? UNITS[UNITS.length - 1]
  return RELATIVE.format(Math.round(delta / scale.ms), scale.unit)
}

export interface RepoCardProps {
  repo: GithubRepo
  className?: string
}

/**
 * One public repository.
 *
 * The repository name is the only link, so the card is one tab stop; stars,
 * forks and the last push sit under it as plain text, because they are facts to
 * read rather than things to click.
 */
export function RepoCard({ repo, className }: RepoCardProps) {
  const updated = relativeInstant(repo.pushedAt)
  const topics = repo.topics.slice(0, 4)
  const extraTopics = repo.topics.length - topics.length

  return (
    <Card interactive className={cn('h-full', className)}>
      <CardContent className="flex flex-1 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-[15px] font-semibold tracking-tight">
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1.5 text-ink transition-colors duration-150 hover:text-accent"
            >
              <Icon name="FolderGit2" size={15} className="shrink-0 text-ink-faint" />
              {/* Repository names have no spaces, so without min-w-0 the flex
                  row refuses to shrink and pushes the card past the viewport. */}
              <span className="min-w-0 truncate font-mono">{repo.name}</span>
              <span className="sr-only"> — open on GitHub (opens in a new tab)</span>
            </a>
          </h3>
          {repo.pinned ? (
            <Badge tone="accent" size="sm" icon="Pin" className="shrink-0">
              Pinned
            </Badge>
          ) : null}
        </div>

        {repo.description ? (
          <p className="text-sm leading-relaxed text-ink-muted">{repo.description}</p>
        ) : (
          <p className="text-sm text-ink-faint italic">No description on GitHub.</p>
        )}

        {topics.length > 0 ? (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {topics.map((topic) => (
              <li key={topic}>
                <Badge size="sm" className="font-mono">
                  {topic}
                </Badge>
              </li>
            ))}
            {extraTopics > 0 ? (
              <li>
                <Badge size="sm" className="font-mono">
                  +{extraTopics}
                  <span className="sr-only"> more topics</span>
                </Badge>
              </li>
            ) : null}
          </ul>
        ) : null}
      </CardContent>

      <CardFooter className="gap-x-4 gap-y-2 py-3 text-xs text-ink-faint">
        {repo.language ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: `var(--color-cat-${languageCat(repo.language)})` }}
            />
            {repo.language}
          </span>
        ) : null}

        <span className="flex items-center gap-1 font-mono tabular-nums">
          <Icon name="Star" size={12} />
          {numberFormat(repo.stars)}
          <span className="sr-only"> stars</span>
        </span>

        <span className="flex items-center gap-1 font-mono tabular-nums">
          <Icon name="GitBranch" size={12} />
          {numberFormat(repo.forks)}
          <span className="sr-only"> forks</span>
        </span>

        {updated ? (
          <span className="ml-auto flex items-center gap-1">
            <Icon name="Clock" size={12} />
            <time dateTime={repo.pushedAt}>{updated}</time>
          </span>
        ) : null}
      </CardFooter>
    </Card>
  )
}
