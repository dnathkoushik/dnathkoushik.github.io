import { Fragment, useCallback, useEffect, useState } from 'react'
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
import { Skeleton } from '@/components/ui/Skeleton'
import { Stat } from '@/components/ui/Stat'
import { GithubIcon } from '@/components/common/BrandIcons'
import { RepoCard, languageCat } from '@/components/github/RepoCard'
import {
  Counter,
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  Stagger,
  TextReveal,
  TiltCard,
} from '@/motion'
import { initialsOf, percent, pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/*
 * The handle ships as a placeholder, and asking api.github.com about
 * `your-username` costs a request against a 60-per-hour anonymous budget to be
 * told what we already know. So the placeholder is detected here and the page
 * renders its "not wired up yet" state without touching the network at all.
 */
const USERNAME = githubConfig.username.trim()
const IS_PLACEHOLDER = USERNAME.length === 0 || /your-|example/i.test(USERNAME)
const LIVE = githubConfig.liveStatsEnabled && !IS_PLACEHOLDER

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const TITLE = 'font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] tracking-tight text-ink'
const SECTION_TITLE =
  'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'

type LoadState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'ready'; profile: GithubProfile; repos: GithubRepo[] }
  | { status: 'unavailable' }

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

interface Age {
  /** "3y 4m", or "7m" for an account under a year old. */
  label: string
  since: string
}

/** Null when the API sent no usable `created_at` — the stat is then dropped. */
function accountAge(createdAt: string): Age | null {
  const parsed = Date.parse(createdAt)
  if (!Number.isFinite(parsed)) return null

  const start = new Date(parsed)
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return null

  const years = Math.floor(months / 12)
  const rest = months % 12

  return {
    label: years > 0 ? (rest > 0 ? `${years}y ${rest}m` : `${years}y`) : `${months}m`,
    since: `Joined ${MONTH_YEAR.format(start)}`,
  }
}

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
  const summary = languages.map((entry) => `${entry.name} ${entry.count}`).join(', ')

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
    <div className="space-y-8" aria-hidden="true">
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

/** The repository names, as a slow mono band between the numbers and the grid. */
function RepoBand({ repos }: { repos: GithubRepo[] }) {
  if (repos.length === 0) return null
  return (
    <div className="border-y border-line py-5">
      <Marquee speed={60}>
        {repos.map((repo) => (
          <Fragment key={repo.id}>
            <span className={cn(EYEBROW, 'whitespace-nowrap')}>{repo.name}</span>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          </Fragment>
        ))}
      </Marquee>
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
    <div>
      <section aria-labelledby="github-title" className="pt-20 pb-14 sm:pt-32 sm:pb-20">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="GitHub" />
          </Parallax>

          <TextReveal as="h1" id="github-title" className={cn(TITLE, 'mt-6 max-w-5xl')}>
            Public repositories
          </TextReveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <Reveal
              as="p"
              delay={0.35}
              className="max-w-2xl text-[17px] leading-relaxed text-ink-muted lg:col-span-7"
            >
              Read straight from the GitHub REST API when you open this page — no token, no
              analytics, and cached for an hour so a click around the site costs one request.
            </Reveal>

            {IS_PLACEHOLDER ? null : (
              <Reveal delay={0.45} className="flex lg:col-span-5 lg:justify-end">
                <Magnetic>
                  <ButtonLink href={githubConfig.profileUrl} variant="secondary" data-cursor="Open">
                    <GithubIcon className="size-4" />
                    Open profile
                  </ButtonLink>
                </Magnetic>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {state.status === 'loading' ? (
        <div className={cn(CONTAINER, 'pb-24 sm:pb-36')}>
          <LoadingSkeleton />
        </div>
      ) : null}

      {state.status === 'off' ? (
        <section aria-labelledby="github-off" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal>
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
                        <code className="font-mono text-[13px] text-ink">
                          {USERNAME || '(empty)'}
                        </code>
                        , so nothing was requested — asking the API about a name that does not
                        exist would spend one of the sixty anonymous requests an hour to be told
                        so.
                      </>
                    ) : (
                      <>
                        <code className="font-mono text-[13px] text-ink">liveStatsEnabled</code>{' '}
                        is set to <code className="font-mono text-[13px] text-ink">false</code>,
                        so this page makes no third-party request at all. That is a deliberate
                        setting, not a fault.
                      </>
                    )}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <div className="rounded-lg border border-line bg-surface-muted/60 p-4">
                    <h3 className="text-sm font-semibold text-ink">To switch it on</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      Open <code className="font-mono text-[13px] text-ink">src/data/github.ts</code>
                      , set <code className="font-mono text-[13px] text-ink">username</code> to a
                      real GitHub handle, point{' '}
                      <code className="font-mono text-[13px] text-ink">profileUrl</code> at the
                      same account, list the repositories to spotlight in{' '}
                      <code className="font-mono text-[13px] text-ink">pinnedRepos</code>, and
                      leave{' '}
                      <code className="font-mono text-[13px] text-ink">liveStatsEnabled: true</code>
                      . This page then fills itself in on the next load.
                    </p>
                  </div>
                </CardContent>

                <CardFooter>
                  <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
                    See the projects instead
                  </ButtonLink>
                </CardFooter>
              </Card>
            </Reveal>
          </div>
        </section>
      ) : null}

      {state.status === 'unavailable' ? (
        <section aria-labelledby="github-unavailable" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal>
              <Card>
                <CardHeader>
                  <span className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning">
                    <Icon name="CloudDownload" size={20} />
                  </span>
                  <CardTitle as="h2" id="github-unavailable" className="pt-1">
                    GitHub did not answer
                  </CardTitle>
                  <CardDescription>
                    The request for{' '}
                    <code className="font-mono text-[13px] text-ink">{USERNAME}</code> came back
                    empty. The usual reasons are the anonymous rate limit — sixty requests an hour,
                    shared by everyone on your network — or simply being offline. Nothing is broken
                    on the site, and no partial numbers are shown, because a zero here would be a
                    guess rather than a fact.
                  </CardDescription>
                </CardHeader>

                {githubConfig.pinnedRepos.length > 0 ? (
                  <CardContent>
                    <h3 className="text-sm font-semibold text-ink">
                      The repositories this page pins
                    </h3>
                    <ul className="mt-3 space-y-1.5">
                      {githubConfig.pinnedRepos.map((repo) => (
                        <li key={repo} className="min-w-0">
                          <a
                            href={`https://github.com/${repo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 font-mono text-sm break-all text-ink-muted transition-colors duration-150 hover:text-accent"
                          >
                            <Icon name="FolderGit2" size={14} className="shrink-0 text-ink-faint" />
                            {repo}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                ) : null}

                <CardFooter>
                  <Magnetic>
                    <Button variant="primary" icon="RefreshCw" onClick={retry}>
                      Try again
                    </Button>
                  </Magnetic>
                  <ButtonLink href={githubConfig.profileUrl} variant="secondary">
                    <GithubIcon className="size-4" />
                    Open the profile directly
                  </ButtonLink>
                </CardFooter>
              </Card>
            </Reveal>
          </div>
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
  const age = accountAge(profile.createdAt)

  return (
    <>
      <section aria-labelledby="github-account" className="pb-16 sm:pb-24">
        <div className={CONTAINER}>
          <h2 id="github-account" className="sr-only">
            Account
          </h2>

          <Reveal>
            <div className="surface-card flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:p-8">
              <Avatar
                src={profile.avatarUrl}
                initials={initialsOf(profile.name ?? profile.login)}
                size={72}
                alt={`Avatar of ${profile.name ?? profile.login}`}
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p className="font-display text-2xl leading-none font-medium tracking-tight text-ink sm:text-3xl">
                    {profile.name ?? profile.login}
                  </p>
                  <a
                    href={profile.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cursor="Open"
                    className="font-mono text-sm text-ink-faint transition-colors duration-150 hover:text-accent"
                  >
                    @{profile.login}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>

                {profile.bio ? (
                  <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
                    {profile.bio}
                  </p>
                ) : null}

                <ul className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-xs text-ink-faint">
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
                    <li className="flex min-w-0 items-center gap-1.5">
                      <Icon name="Link" size={13} className="shrink-0" />
                      <a
                        href={
                          profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate transition-colors duration-150 hover:text-accent"
                      >
                        {profile.blog.replace(/^https?:\/\//, '')}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="github-numbers" className="pb-16 sm:pb-24">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={2} label="By the numbers" />
          </Parallax>
          <TextReveal as="h2" id="github-numbers" className={cn(SECTION_TITLE, 'mt-4 max-w-4xl')}>
            What the public API says
          </TextReveal>

          <Stagger className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat
              label="Public repos"
              value={<Counter to={profile.publicRepos} />}
              sublabel="Everything visible on the profile"
              icon="FolderGit2"
              tone="accent"
            />
            <Stat
              label="Followers"
              value={<Counter to={profile.followers} />}
              icon="Users"
              sublabel={profile.followers === 0 ? 'Nobody yet — early days' : undefined}
            />
            <Stat label="Following" value={<Counter to={profile.following} />} icon="User" />
            {age ? (
              <Stat label="Account age" value={age.label} sublabel={age.since} icon="CalendarDays" />
            ) : null}
          </Stagger>

          {repos.length > 0 ? (
            <Reveal delay={0.2} className="mt-5 flex flex-wrap gap-3">
              <Badge tone="neutral" icon="Star">
                <Counter to={summary.stars} /> stars across the repositories below
              </Badge>
              <Badge tone="neutral" icon="GitBranch">
                <Counter to={summary.forks} /> forks
              </Badge>
            </Reveal>
          ) : null}

          {languageTotal > 0 ? (
            <Reveal delay={0.3} className="mt-10">
              <div className="surface-card p-5 sm:p-6">
                <h3 className="text-sm font-semibold text-ink">Languages by repository</h3>
                <p className="mt-1 mb-4 text-xs text-ink-faint">
                  Primary language of each repository shown on this page.
                </p>
                <LanguageBar languages={languages} total={languageTotal} />
              </div>
            </Reveal>
          ) : null}
        </div>
      </section>

      <RepoBand repos={repos} />

      <section aria-labelledby="github-repos" className="py-16 sm:py-24">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={3} label="Repositories" />
          </Parallax>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
            <TextReveal as="h2" id="github-repos" className={cn(SECTION_TITLE, 'max-w-3xl')}>
              Repositories
            </TextReveal>
            {repos.length > 0 ? (
              <Reveal as="p" delay={0.2} className="max-w-sm text-sm leading-relaxed text-ink-muted">
                {pluralize(repos.length, 'repository', 'repositories')}, pinned ones first. Forks
                and archived repositories are left out unless they were pinned.
              </Reveal>
            ) : null}
          </div>

          {repos.length > 0 ? (
            <Stagger as="ul" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* min-w-0 on each item: a grid item defaults to min-width:auto, so
                  without it the longest repository name sets the column width and
                  pushes the page sideways on a phone. */}
              {repos.map((repo) => (
                <li key={repo.id} className="flex min-w-0">
                  <TiltCard max={4} className="w-full min-w-0 rounded-card">
                    <RepoCard repo={repo} className="w-full" />
                  </TiltCard>
                </li>
              ))}
            </Stagger>
          ) : (
            <p className="mt-10 rounded-card border border-dashed border-line bg-surface-muted/40 px-5 py-8 text-center text-sm text-ink-muted">
              The repository list came back empty. That means either this account has no public
              repositories, or the second request was rate limited while the profile request
              succeeded.
            </p>
          )}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
            <p className="text-xs text-ink-faint">
              Responses are cached in this tab for an hour. Refreshing clears that cache and asks
              again.
            </p>
            <Button variant="ghost" size="sm" icon="RefreshCw" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
