import { Fragment, useMemo, useState } from 'react'
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
import {
  ACHIEVEMENT_KIND,
  ACHIEVEMENT_KIND_ORDER,
  AchievementCard,
} from '@/components/achievements/AchievementCard'
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

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const TITLE = 'font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] tracking-tight text-ink'
const SECTION_TITLE =
  'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'
const KIND_TITLE =
  'font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[0.95] tracking-tight text-ink'

const CHIP =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ' +
  'whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11 cursor-pointer'

const CHIP_ON =
  'border-accent/50 bg-accent-soft font-medium ' +
  'text-[color:color-mix(in_oklab,var(--color-accent)_70%,var(--color-ink))]'

const CHIP_OFF = 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'

/** The bodies that issued the published entries, as a slow band between sections. */
function IssuerBand({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="border-y border-line py-5">
      <Marquee speed={60}>
        {items.map((item) => (
          <Fragment key={item}>
            <span className={cn(EYEBROW, 'whitespace-nowrap')}>{item}</span>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          </Fragment>
        ))}
      </Marquee>
    </div>
  )
}

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

  const issuers = useMemo(
    () =>
      Array.from(
        new Set(real.map((entry) => entry.issuer).filter((issuer): issuer is string => !!issuer)),
      ),
    [real],
  )

  const visible = filter === 'all' ? real : real.filter((entry) => entry.kind === filter)
  const highlights = real.filter((entry) => entry.featured)
  const shownKinds = filter === 'all' ? kinds : kinds.filter((kind) => kind === filter)

  return (
    <div>
      <section aria-labelledby="achievements-title" className="pt-20 pb-14 sm:pt-32 sm:pb-20">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="Achievements" />
          </Parallax>

          <TextReveal as="h1" id="achievements-title" className={cn(TITLE, 'mt-6 max-w-5xl')}>
            Contests, certifications and milestones
          </TextReveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <Reveal
              as="p"
              delay={0.35}
              className="max-w-2xl text-[17px] leading-relaxed text-ink-muted lg:col-span-7"
            >
              Every entry here is something with a number or a link behind it. Anything I cannot
              show proof of is not on this page.
            </Reveal>

            <Reveal
              delay={0.45}
              className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:col-span-5 lg:justify-end"
            >
              <p className={EYEBROW}>
                <Counter to={real.length} className="text-ink" />{' '}
                {real.length === 1 ? 'entry' : 'entries'}, each one checkable
              </p>
              <Magnetic>
                <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" iconRight="ArrowRight">
                  See the projects
                </ButtonLink>
              </Magnetic>
            </Reveal>
          </div>
        </div>
      </section>

      {real.length === 0 ? (
        <section aria-labelledby="achievements-empty" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal>
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
                          Keep the kinds you have real results for, delete the rest. An empty
                          section is fine and honest.
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="font-mono text-xs text-ink-faint tabular-nums">3</span>
                        <span>
                          Put the checkable figure in{' '}
                          <code className="font-mono text-[13px] text-ink">metric</code> and link
                          the profile or certificate in{' '}
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
            </Reveal>

            <div id="achievements-template-preview" hidden={!previewing} className="mt-6">
              <div className="rounded-card border border-dashed border-warning/50 bg-warning-soft/30 p-4 sm:p-6">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                  <Icon name="TriangleAlert" size={15} className="mt-0.5 text-warning" />
                  <span>
                    <strong className="font-semibold text-ink">Template preview.</strong> Every
                    rank, score and issuer below is a placeholder. Nothing here is claimed as a
                    result.
                  </span>
                </p>
                {previewing ? (
                  <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templates.map((entry) => (
                      <li key={entry.id} className="flex min-w-0">
                        <AchievementCard achievement={entry} template className="w-full" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {highlights.length > 0 && filter === 'all' ? (
            <section aria-labelledby="achievements-highlights" className="pb-16 sm:pb-24">
              <div className={CONTAINER}>
                <p className={EYEBROW}>Highlights</p>
                <TextReveal
                  as="h2"
                  id="achievements-highlights"
                  className={cn(SECTION_TITLE, 'mt-3 max-w-4xl')}
                >
                  The ones worth leading with
                </TextReveal>

                <Stagger as="ul" className="mt-10 grid gap-4 sm:gap-5 lg:grid-cols-2">
                  {highlights.map((entry) => (
                    <li key={entry.id} className="flex min-w-0">
                      <TiltCard max={6} className="w-full rounded-card">
                        <AchievementCard achievement={entry} highlight className="w-full" />
                      </TiltCard>
                    </li>
                  ))}
                </Stagger>
              </div>
            </section>
          ) : null}

          <IssuerBand items={issuers} />

          <div className={cn(CONTAINER, 'py-16 sm:py-24')}>
            <Reveal>
              <div role="group" aria-label="Filter achievements by kind" className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-semibold tracking-tight text-ink">Filter by kind</p>
                  <p aria-live="polite" className={cn(EYEBROW, 'tabular-nums')}>
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
            </Reveal>

            {shownKinds.map((kind) => {
              const meta = ACHIEVEMENT_KIND[kind]
              const entries = real.filter((entry) => entry.kind === kind)
              return (
                /*
                 * Keyed on the filter as well as the kind, so a section that
                 * survives a filter change remounts where it now sits instead
                 * of keeping scroll triggers measured against the old layout.
                 */
                <section
                  key={`${kind}-${filter}`}
                  aria-labelledby={`achievements-${kind}`}
                  className="mt-16 sm:mt-20"
                >
                  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
                    <TextReveal as="h2" id={`achievements-${kind}`} className={KIND_TITLE}>
                      {meta.label}
                    </TextReveal>
                    <p className={cn(EYEBROW, 'tabular-nums')}>
                      {pluralize(entries.length, 'entry', 'entries')}
                    </p>
                  </div>
                  <Stagger as="ul" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex min-w-0">
                        <AchievementCard achievement={entry} className="w-full" />
                      </li>
                    ))}
                  </Stagger>
                </section>
              )
            })}

            {templates.length > 0 ? (
              <p className="mt-12 flex items-center gap-2 text-xs text-ink-faint">
                <Icon name="Info" size={13} />
                Hiding {pluralize(templates.length, 'template entry', 'template entries')} from{' '}
                <code className="font-mono text-ink-muted">src/data/achievements.ts</code> until
                replaced with a real result.
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
