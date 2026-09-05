import { useCallback, useEffect, useState } from 'react'
import type { GithubProfile, GithubRepo } from '@/services/github'
import {
  clearGithubCache,
  fetchGithubProfile,
  fetchGithubRepos,
  summarizeRepos,
} from '@/services/github'
import { githubConfig } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Skeleton } from '@/components/ui/Skeleton'
import { GithubIcon } from '@/components/common/BrandIcons'
import { GithubStats } from '@/components/github/GithubStats'
import { RepoCard, languageCat } from '@/components/github/RepoCard'
import { initialsOf, numberFormat, percent, pluralize } from '@/utils/format'

/*
 * The handle ships as a placeholder, and asking api.github.com about
 * `your-username` costs a request against a 60-per-hour anonymous budget to be
 * told what we already know. So the placeholder is detected here and the page
 * renders its "not wired up yet" state without touching the network at all.
 */
const USERNAME = githubConfig.username.trim()
const IS_PLACEHOLDER = USERNAME.length === 0 || /your-|example/i.test(USERNAME)
const LIVE = githubConfig.liveStatsEnabled && !IS_PLACEHOLDER

type LoadState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'ready'; profile: GithubProfile; repos: GithubRepo[] }
  | { status: 'unavailable' }

interface LanguageBarProps {
  languages: { name: string; count: number }[]
  total: number
}

/**
 * Primary language across the fetched repositories.
 *
 * The bar is `role="img"` with the whole distribution in its label, and the
 * same numbers are repeated as text underneath — a bar chart nobody can read
 * the values out of is decoration, not data.
 */
function LanguageBar({ languages, total }: LanguageBarProps) {
  const summary = languages
    .map((entry) => `${entry.name} ${entry.count}`)
    .join(', ')

  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={`Primary language across ${pluralize(total, 'repository', 'repositories')}: ${summary}.`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted"
      >
        {languages.map((entry) => (
          <span
            key={entry.name}
            style={{
              width: `${percent(entry.count, total)}%`,
              backgroundColor: `var(--color-cat-${languageCat(entry.name)})`,
            }}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {languages.map((entry) => (
          <li key={entry.name} className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: `var(--color-cat-${languageCat(entry.name)})` }}
            />
            {entry.name}
            <span className="font-mono text-ink-faint tabular-nums">
              {entry.count} · {percent(entry.count, total)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="mt-12 space-y-8" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-6 w-14" />
            <Skeleton className="mt-3 h-3 w-24" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="rounded-card border border-line bg-surface p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-3 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <Skeleton className="mt-5 h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GithubPage() {
  useDocumentMeta({
    title: 'GitHub',
    description:
      'Public repositories and account activity, read live from the GitHub REST API with no token and no tracking.',
    canonicalPath: PUBLIC_ROUTES.github,
  })

  const [state, setState] = useState<LoadState>(LIVE ? { status: 'loading' } : { status: 'off' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!LIVE) return

    let cancelled = false

    void (async () => {
      const [profile, repos] = await Promise.all([
        fetchGithubProfile(USERNAME),
        fetchGithubRepos(USERNAME, githubConfig.pinnedRepos),
      ])
      if (cancelled) return
      // A null profile is the only unambiguous failure: an empty repo list can
      // legitimately mean "this account has no public repositories".
      setState(profile ? { status: 'ready', profile, repos } : { status: 'unavailable' })
    })()

    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    clearGithubCache()
    setState({ status: 'loading' })
    setAttempt((count) => count + 1)
  }, [])

  const announcement =
    state.status === 'loading'
      ? 'Loading GitHub activity.'
      : state.status === 'ready'
        ? `GitHub activity loaded: ${pluralize(state.repos.length, 'repository', 'repositories')}.`
        : state.status === 'unavailable'
          ? 'GitHub activity could not be loaded.'
          : 'Live GitHub statistics are switched off.'

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <PageHeader
        eyebrow="GitHub"
        title="Public repositories"
        description="Read straight from the GitHub REST API when you open this page — no token, no analytics, and cached for an hour so a click around the site costs one request."
        actions={
          IS_PLACEHOLDER ? undefined : (
            <ButtonLink href={githubConfig.profileUrl} variant="secondary">
              <GithubIcon className="size-4" />
              Open profile
            </ButtonLink>
          )
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {state.status === 'loading' ? <LoadingSkeleton /> : null}

      {state.status === 'off' ? (
        <section aria-labelledby="github-off" className="mt-12 animate-rise">
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                <GithubIcon className="size-5" />
              </span>
              <CardTitle as="h2" id="github-off" className="pt-1">
                {IS_PLACEHOLDER
                  ? 'This page is not wired to an account yet'
                  : 'Live statistics are switched off'}
              </CardTitle>
              <CardDescription>
                {IS_PLACEHOLDER ? (
                  <>
                    The handle in the repository is still the placeholder{' '}
                    <code className="font-mono text-[13px] text-ink">{USERNAME || '(empty)'}</code>,
                    so nothing was requested — asking the API about a name that does not exist would
                    spend one of the sixty anonymous requests an hour to be told so.
                  </>
                ) : (
                  <>
                    <code className="font-mono text-[13px] text-ink">liveStatsEnabled</code> is set
                    to <code className="font-mono text-[13px] text-ink">false</code>, so this page
                    makes no third-party request at all. That is a deliberate setting, not a fault.
                  </>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="rounded-lg border border-line bg-surface-muted/60 p-4">
                <h3 className="text-sm font-semibold text-ink">To switch it on</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Open <code className="font-mono text-[13px] text-ink">src/data/github.ts</code>,
                  set <code className="font-mono text-[13px] text-ink">username</code> to a real
                  GitHub handle, point{' '}
                  <code className="font-mono text-[13px] text-ink">profileUrl</code> at the same
                  account, list the repositories to spotlight in{' '}
                  <code className="font-mono text-[13px] text-ink">pinnedRepos</code>, and leave{' '}
                  <code className="font-mono text-[13px] text-ink">liveStatsEnabled: true</code>.
                  This page then fills itself in on the next load.
                </p>
              </div>
            </CardContent>

            <CardFooter>
              <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
                See the projects instead
              </ButtonLink>
            </CardFooter>
          </Card>
        </section>
      ) : null}

      {state.status === 'unavailable' ? (
        <section aria-labelledby="github-unavailable" className="mt-12 animate-rise">
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning">
                <Icon name="CloudDownload" size={20} />
              </span>
              <CardTitle as="h2" id="github-unavailable" className="pt-1">
                GitHub did not answer
              </CardTitle>
              <CardDescription>
                The request for <code className="font-mono text-[13px] text-ink">{USERNAME}</code>{' '}
                came back empty. The usual reasons are the anonymous rate limit — sixty requests an
                hour, shared by everyone on your network — or simply being offline. Nothing is
                broken on the site, and no partial numbers are shown, because a zero here would be
                a guess rather than a fact.
              </CardDescription>
            </CardHeader>

            {githubConfig.pinnedRepos.length > 0 ? (
              <CardContent>
                <h3 className="text-sm font-semibold text-ink">The repositories this page pins</h3>
                <ul className="mt-3 space-y-1.5">
                  {githubConfig.pinnedRepos.map((repo) => (
                    <li key={repo}>
                      <a
                        href={`https://github.com/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-sm text-ink-muted transition-colors duration-150 hover:text-accent"
                      >
                        <Icon name="FolderGit2" size={14} className="text-ink-faint" />
                        {repo}
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}

            <CardFooter>
              <Button variant="primary" icon="RefreshCw" onClick={retry}>
                Try again
              </Button>
              <ButtonLink href={githubConfig.profileUrl} variant="secondary">
                <GithubIcon className="size-4" />
                Open the profile directly
              </ButtonLink>
            </CardFooter>
          </Card>
        </section>
      ) : null}

      {state.status === 'ready' ? (
        <ReadyView profile={state.profile} repos={state.repos} onRefresh={retry} />
      ) : null}
    </div>
  )
}

interface ReadyViewProps {
  profile: GithubProfile
  repos: GithubRepo[]
  onRefresh: () => void
}

function ReadyView({ profile, repos, onRefresh }: ReadyViewProps) {
  const summary = summarizeRepos(repos)
  const languages = summary.languages.slice(0, 6)
  const languageTotal = languages.reduce((total, entry) => total + entry.count, 0)

  return (
    <>
      <section aria-labelledby="github-account" className="mt-12 animate-rise">
        <h2 id="github-account" className="sr-only">
          Account
        </h2>

        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar
              src={profile.avatarUrl}
              initials={initialsOf(profile.name ?? profile.login)}
              size={64}
              alt={`Avatar of ${profile.name ?? profile.login}`}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="text-lg font-semibold tracking-tight text-ink">
                  {profile.name ?? profile.login}
                </p>
                <a
                  href={profile.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm text-ink-faint transition-colors duration-150 hover:text-accent"
                >
                  @{profile.login}
                </a>
              </div>

              {profile.bio ? (
                <p className="text-sm leading-relaxed text-ink-muted">{profile.bio}</p>
              ) : null}

              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-faint">
                {profile.company ? (
                  <li className="flex items-center gap-1.5">
                    <Icon name="Building2" size={13} />
                    {profile.company}
                  </li>
                ) : null}
                {profile.location ? (
                  <li className="flex items-center gap-1.5">
                    <Icon name="MapPin" size={13} />
                    {profile.location}
                  </li>
                ) : null}
                {profile.blog ? (
                  <li className="flex items-center gap-1.5">
                    <Icon name="Link" size={13} />
                    <a
                      href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors duration-150 hover:text-accent"
                    >
                      {profile.blog.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="github-numbers" className="mt-10 animate-rise">
        <SectionHeading id="github-numbers" title="By the numbers" />
        <GithubStats profile={profile} className="mt-6" />

        {repos.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge tone="neutral" icon="Star">
              {numberFormat(summary.stars)} stars across the repositories below
            </Badge>
            <Badge tone="neutral" icon="GitBranch">
              {numberFormat(summary.forks)} forks
            </Badge>
          </div>
        ) : null}

        {languageTotal > 0 ? (
          <div className="mt-8 rounded-card border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold text-ink">Languages by repository</h3>
            <p className="mt-1 mb-4 text-xs text-ink-faint">
              Primary language of each repository shown on this page.
            </p>
            <LanguageBar languages={languages} total={languageTotal} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="github-repos" className="mt-14 animate-rise">
        <SectionHeading
          id="github-repos"
          title="Repositories"
          description={
            repos.length > 0
              ? `${pluralize(repos.length, 'repository', 'repositories')}, pinned ones first. Forks and archived repositories are left out unless they were pinned.`
              : undefined
          }
        />

        {repos.length > 0 ? (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* min-w-0 on each item: a grid item defaults to min-width:auto, so
                without it the longest repository name sets the column width and
                pushes the page sideways on a phone. */}
            {repos.map((repo) => (
              <li key={repo.id} className="flex min-w-0">
                <RepoCard repo={repo} className="w-full" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-card border border-dashed border-line bg-surface-muted/40 px-5 py-8 text-center text-sm text-ink-muted">
            The repository list came back empty. That means either this account has no public
            repositories, or the second request was rate limited while the profile request
            succeeded.
          </p>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-xs text-ink-faint">
          Responses are cached in this tab for an hour. Refreshing clears that cache and asks
          again.
        </p>
        <Button variant="ghost" size="sm" icon="RefreshCw" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </>
  )
}
