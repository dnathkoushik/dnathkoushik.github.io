import { useMemo, useState } from 'react'
import type { Achievement, AchievementKind } from '@/types'
import { achievements } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
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
import {
  ACHIEVEMENT_KIND,
  ACHIEVEMENT_KIND_ORDER,
  AchievementCard,
} from '@/components/achievements/AchievementCard'
import { pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/*
 * Same rule as /experience: `data/achievements.ts` ships one labelled example
 * of every kind so the layouts can be checked, and a rank or a certificate
 * number nobody earned must never reach the published page. Anything still
 * carrying a template marker is held back behind an explicit preview.
 */
const TEMPLATE_MARKERS = ['example entry', 'replace me', 'template entry', 'template —']

function isTemplate(entry: Achievement): boolean {
  const haystack = [entry.title, entry.issuer, entry.description, entry.metric]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return TEMPLATE_MARKERS.some((marker) => haystack.includes(marker))
}

const byNewest = (a: Achievement, b: Achievement) => b.date.localeCompare(a.date)

type Filter = AchievementKind | 'all'

const CHIP =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ' +
  'whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11 cursor-pointer'

const CHIP_ON =
  'border-accent/50 bg-accent-soft font-medium ' +
  'text-[color:color-mix(in_oklab,var(--color-accent)_70%,var(--color-ink))]'

const CHIP_OFF = 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'

export default function AchievementsPage() {
  useDocumentMeta({
    title: 'Achievements',
    description:
      'Contests, certifications, hackathons and milestones — with the metric that makes each one checkable.',
    canonicalPath: PUBLIC_ROUTES.achievements,
  })

  const [filter, setFilter] = useState<Filter>('all')
  const [previewing, setPreviewing] = useState(false)

  const { real, templates } = useMemo(() => {
    const sorted = [...achievements].sort(byNewest)
    return {
      real: sorted.filter((entry) => !isTemplate(entry)),
      templates: sorted.filter(isTemplate),
    }
  }, [])

  const kinds = useMemo(
    () => ACHIEVEMENT_KIND_ORDER.filter((kind) => real.some((entry) => entry.kind === kind)),
    [real],
  )

  const counts = useMemo(() => {
    const result = {} as Record<AchievementKind, number>
    for (const kind of ACHIEVEMENT_KIND_ORDER) {
      result[kind] = real.filter((entry) => entry.kind === kind).length
    }
    return result
  }, [real])

  const visible = filter === 'all' ? real : real.filter((entry) => entry.kind === filter)
  const highlights = real.filter((entry) => entry.featured)
  const shownKinds = filter === 'all' ? kinds : kinds.filter((kind) => kind === filter)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <PageHeader
        eyebrow="Achievements"
        title="Contests, certifications and milestones"
        description="Every entry here is something with a number or a link behind it. Anything I cannot show proof of is not on this page."
        actions={
          <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
            See the projects
          </ButtonLink>
        }
      />

      {real.length === 0 ? (
        <section aria-labelledby="achievements-empty" className="mt-12 animate-rise">
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name="Trophy" size={20} />
              </span>
              <CardTitle as="h2" id="achievements-empty" className="pt-1">
                Nothing published here yet
              </CardTitle>
              <CardDescription>
                {achievements.length === 0
                  ? 'This page is empty on purpose. A contest rank you did not earn is the one mistake on a portfolio you cannot walk back.'
                  : `The repository ships with ${pluralize(
                      templates.length,
                      'labelled template entry',
                      'labelled template entries',
                    )} — one per kind, so every layout can be checked. None of them is a real result, so none of them is published.`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg border border-line bg-surface-muted/60 p-4">
                <h3 className="text-sm font-semibold text-ink">To fill this page in</h3>
                <ol className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">1</span>
                    <span>
                      Open{' '}
                      <code className="font-mono text-[13px] text-ink">
                        src/data/achievements.ts
                      </code>
                      .
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">2</span>
                    <span>
                      Keep the kinds you have real results for, delete the rest. An empty section is
                      fine and honest.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">3</span>
                    <span>
                      Put the checkable figure in <code className="font-mono text-[13px] text-ink">metric</code>{' '}
                      and link the profile or certificate in{' '}
                      <code className="font-mono text-[13px] text-ink">url</code>.
                    </span>
                  </li>
                </ol>
              </div>

              <p className="text-sm leading-relaxed text-ink-muted">
                Entries still containing <em>EXAMPLE ENTRY</em>, <em>TEMPLATE</em> or{' '}
                <em>replace me</em> are hidden from this page automatically.
              </p>
            </CardContent>

            <CardFooter>
              {templates.length > 0 ? (
                <Button
                  variant="secondary"
                  icon={previewing ? 'EyeOff' : 'Eye'}
                  onClick={() => setPreviewing((open) => !open)}
                  aria-expanded={previewing}
                  aria-controls="achievements-template-preview"
                >
                  {previewing ? 'Hide the template entries' : 'Preview the template entries'}
                </Button>
              ) : null}
              <ButtonLink to={PUBLIC_ROUTES.github} variant="ghost" icon="GitBranch">
                GitHub activity
              </ButtonLink>
            </CardFooter>
          </Card>

          <div id="achievements-template-preview" hidden={!previewing} className="mt-6">
            <div className="rounded-card border border-dashed border-warning/50 bg-warning-soft/30 p-4 sm:p-6">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                <Icon name="TriangleAlert" size={15} className="mt-0.5 text-warning" />
                <span>
                  <strong className="font-semibold text-ink">Template preview.</strong> Every rank,
                  score and issuer below is a placeholder. Nothing here is claimed as a result.
                </span>
              </p>
              {previewing ? (
                <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((entry) => (
                    <li key={entry.id} className="flex">
                      <AchievementCard achievement={entry} template className="w-full" />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <>
          {highlights.length > 0 && filter === 'all' ? (
            <section aria-labelledby="achievements-highlights" className="mt-12 animate-rise">
              <SectionHeading
                id="achievements-highlights"
                eyebrow="Highlights"
                title="The ones worth leading with"
              />
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highlights.map((entry) => (
                  <li key={entry.id} className="flex">
                    <AchievementCard achievement={entry} highlight className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div
            role="group"
            aria-label="Filter achievements by kind"
            className="mt-12 space-y-3 animate-rise"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-sm font-semibold tracking-tight text-ink">Filter by kind</p>
              <p aria-live="polite" className="font-mono text-xs text-ink-faint tabular-nums">
                {visible.length} of {pluralize(real.length, 'entry', 'entries')}
              </p>
            </div>

            <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              <li>
                <button
                  type="button"
                  aria-pressed={filter === 'all'}
                  onClick={() => setFilter('all')}
                  className={cn(CHIP, filter === 'all' ? CHIP_ON : CHIP_OFF)}
                >
                  <Icon name={filter === 'all' ? 'Check' : 'Funnel'} size={13} />
                  All
                  <span className="font-mono text-[11px] tabular-nums opacity-70">
                    {real.length}
                  </span>
                </button>
              </li>
              {kinds.map((kind) => {
                const meta = ACHIEVEMENT_KIND[kind]
                const active = filter === kind
                return (
                  <li key={kind}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(active ? 'all' : kind)}
                      aria-label={`${meta.label}, ${pluralize(counts[kind], 'entry', 'entries')}`}
                      className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
                    >
                      <Icon name={active ? 'Check' : meta.icon} size={13} />
                      {meta.label}
                      <span className="font-mono text-[11px] tabular-nums opacity-70">
                        {counts[kind]}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          {shownKinds.map((kind) => {
            const meta = ACHIEVEMENT_KIND[kind]
            const entries = real.filter((entry) => entry.kind === kind)
            return (
              <section
                key={kind}
                aria-labelledby={`achievements-${kind}`}
                className="mt-12 animate-rise"
              >
                <SectionHeading
                  id={`achievements-${kind}`}
                  title={meta.label}
                  description={pluralize(entries.length, 'entry', 'entries')}
                />
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {entries.map((entry) => (
                    <li key={entry.id} className="flex">
                      <AchievementCard achievement={entry} className="w-full" />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          {templates.length > 0 ? (
            <p className="mt-10 flex items-center gap-2 text-xs text-ink-faint">
              <Icon name="Info" size={13} />
              Hiding {pluralize(templates.length, 'template entry', 'template entries')} from{' '}
              <code className="font-mono text-ink-muted">src/data/achievements.ts</code> until
              replaced with a real result.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
