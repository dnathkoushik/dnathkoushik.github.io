import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Project } from '@/types'
import { projects } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ScrollTrigger, useGSAP, motionOK } from '@/motion/gsap'
import {
  HorizontalScroll,
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  Stagger,
  TextReveal,
  TiltCard,
} from '@/motion'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { GithubIcon } from '@/components/common/BrandIcons'
import {
  PROJECT_STATUS,
  ProjectCard,
  ProjectCover,
  ProjectLink,
} from '@/components/projects/ProjectCard'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { TechFilter } from '@/components/projects/TechFilter'
import { formatYearMonth } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/** The filter lives here, so a filtered view can be linked and survives reload. */
const TECH_PARAM = 'tech'

/** The open project lives here too, which makes one project a shareable URL. */
const PROJECT_PARAM = 'project'

/** Newest first — the sort the list is read in. */
const byNewest = (a: Project, b: Project) => b.date.localeCompare(a.date)

function usesEvery(project: Project, technologies: string[]): boolean {
  return technologies.every((technology) => project.technologies.includes(technology))
}

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const TITLE = 'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'
const LEDE = 'text-[15px] leading-relaxed text-ink-muted sm:text-[17px]'

/*
 * Hollow numerals. The fill is cleared and the stroke reads `currentColor`, so
 * the outline keeps whatever token colour the element is given.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

interface SectionIntroProps {
  n: number
  label: string
  id: string
  title: string
  lede: string
}

/** Numeral, title and lede for a major section — one row on desktop, stacked below. */
function SectionIntro({ n, label, id, title, lede }: SectionIntroProps) {
  return (
    <div className={CONTAINER}>
      <Parallax speed={-0.15}>
        <SectionNumber n={n} label={label} />
      </Parallax>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-end lg:gap-12">
        <TextReveal as="h2" id={id} className={TITLE}>
          {title}
        </TextReveal>
        <Reveal delay={0.25}>
          <p className={cn(LEDE, 'lg:pb-2')}>{lede}</p>
        </Reveal>
      </div>
    </div>
  )
}

/** Every technology on the page, looping between sections. Decorative — the filter lists them for real. */
function TechMarquee({ technologies }: { technologies: string[] }) {
  return (
    <div aria-hidden="true" className="border-y border-line py-5 sm:py-6">
      <Marquee speed={60} pauseOnHover>
        {technologies.map((technology) => (
          <span
            key={technology}
            className="flex items-center gap-8 font-mono text-[12px] tracking-[0.18em] text-ink-faint uppercase sm:text-[13px]"
          >
            {technology}
            <span className="size-1.5 rounded-full bg-accent" />
          </span>
        ))}
      </Marquee>
    </div>
  )
}

interface FeaturedSlideProps {
  project: Project
  index: number
  eager: boolean
  onOpen: (project: Project) => void
}

/**
 * One slide of the featured rail: the cover fills the card, the name sits
 * bottom-left in display type over a scrim, the index hangs hollow top-right.
 * Like the small card it is one stretched button plus two real links.
 */
function FeaturedSlide({ project, index, eager, onOpen }: FeaturedSlideProps) {
  const status = PROJECT_STATUS[project.status]
  const headingId = `featured-${project.id}`

  return (
    <TiltCard
      max={4}
      className="h-[min(62vh,44rem)] w-[min(78vw,64rem)] rounded-card sm:h-[min(70vh,46rem)]"
    >
      <article
        data-cursor="View"
        aria-labelledby={headingId}
        className={cn(
          'group relative isolate h-full overflow-hidden rounded-card border border-line bg-surface',
          'transition-colors duration-300 hover:border-line-strong focus-within:border-accent',
        )}
      >
        <ProjectCover
          project={project}
          eager={eager}
          delay={index * 0.12}
          className="absolute inset-0 aspect-auto h-full"
        />

        {/* Scrim: whatever the cover is, the type at the foot stays legible. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[72%] bg-gradient-to-t from-canvas via-canvas/75 to-transparent"
        />

        <span
          aria-hidden="true"
          className="absolute top-4 right-5 font-display text-[clamp(4rem,12vw,11rem)] leading-none font-medium text-ink/40 select-none sm:top-6 sm:right-8"
          style={OUTLINE}
        >
          {String(index + 1).padStart(2, '0')}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 sm:gap-5 sm:p-10">
          <p className={cn(EYEBROW, 'flex flex-wrap items-center gap-3')}>
            <Badge tone={status.tone} icon={status.icon} size="sm">
              {status.label}
            </Badge>
            <time dateTime={project.date} className="tabular-nums">
              {formatYearMonth(project.date.slice(0, 7))}
            </time>
          </p>

          <h3
            id={headingId}
            className="font-display text-[clamp(2rem,4vw,3.5rem)] leading-[0.95] tracking-tight text-ink"
          >
            {/* Stretched button: `after:` gets its content from Tailwind v4 automatically. */}
            <button
              type="button"
              onClick={() => onOpen(project)}
              className="cursor-pointer text-left break-words after:absolute after:inset-0 after:z-0"
            >
              {project.name}
              <span className="sr-only"> — open project details</span>
            </button>
          </h3>

          <p className="max-w-xl text-[15px] leading-relaxed text-ink-muted sm:text-base">
            {project.summary}
          </p>

          <ul className="flex flex-wrap gap-1.5" aria-label={`Technologies used in ${project.name}`}>
            {project.technologies.map((tech) => (
              <li
                key={tech}
                className="rounded-full border border-line-strong/70 bg-canvas/70 px-2.5 py-1 font-mono text-[11px] tracking-[0.12em] text-ink-muted uppercase"
              >
                {tech}
              </li>
            ))}
          </ul>

          <div className="relative z-10 -mx-2 flex flex-wrap items-center gap-1">
            {project.githubUrl ? (
              <ProjectLink
                href={project.githubUrl}
                label={`Source code for ${project.name} on GitHub`}
                cursor="Code"
                icon={<GithubIcon className="size-3.5" />}
              >
                Code
              </ProjectLink>
            ) : null}
            {project.liveUrl ? (
              <ProjectLink
                href={project.liveUrl}
                label={`Live demo of ${project.name}`}
                cursor="Live"
                icon={<Icon name="Globe" size={14} />}
              >
                Live
              </ProjectLink>
            ) : null}
          </div>
        </div>
      </article>
    </TiltCard>
  )
}

export default function ProjectsPage() {
  useDocumentMeta({
    title: 'Projects',
    description:
      'Things I have designed, built and shipped — what each one does, the stack behind it, and the engineering decisions I would defend in an interview.',
    canonicalPath: PUBLIC_ROUTES.projects,
  })

  const [searchParams, setSearchParams] = useSearchParams()
  /*
   * The project that was on screen most recently. It exists only so the dialog
   * still has something to draw while it animates shut, after the query string
   * has already been cleared.
   */
  const [closing, setClosing] = useState<Project | null>(null)

  const sorted = useMemo(() => [...projects].sort(byNewest), [])

  const allTechnologies = useMemo(() => {
    const seen = new Map<string, string>()
    for (const project of sorted) {
      for (const technology of project.technologies) {
        const key = technology.toLowerCase()
        if (!seen.has(key)) seen.set(key, technology)
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [sorted])

  /*
   * Anything in the query string that is not a technology some project actually
   * uses is dropped: a stale link should degrade to a wider list, never to a
   * page that looks broken.
   */
  const raw = searchParams.get(TECH_PARAM) ?? ''
  const selected = useMemo(() => {
    const known = new Map(allTechnologies.map((technology) => [technology.toLowerCase(), technology]))
    const picked: string[] = []
    for (const entry of raw.split(',')) {
      const match = known.get(entry.trim().toLowerCase())
      if (match && !picked.includes(match)) picked.push(match)
    }
    return picked
  }, [raw, allTechnologies])

  const filtered = useMemo(
    () => (selected.length === 0 ? sorted : sorted.filter((project) => usesEvery(project, selected))),
    [sorted, selected],
  )

  /* Per-chip counts are what the list would become, not a static total. */
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const technology of allTechnologies) {
      result[technology] = selected.includes(technology)
        ? filtered.length
        : sorted.filter((project) => usesEvery(project, [...selected, technology])).length
    }
    return result
  }, [allTechnologies, selected, sorted, filtered])

  const commit = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams)
      if (next.length === 0) params.delete(TECH_PARAM)
      else params.set(TECH_PARAM, next.join(','))
      // `replace` keeps the back button useful: it leaves the page, rather than
      // stepping back through every chip that was ever tapped.
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const toggle = useCallback(
    (technology: string) => {
      commit(
        selected.includes(technology)
          ? selected.filter((entry) => entry !== technology)
          : [...selected, technology],
      )
    },
    [commit, selected],
  )

  const clear = useCallback(() => commit([]), [commit])

  /*
   * The open dialog is a URL, so a single project can be linked to — the 404
   * page's search does exactly that. Opening pushes a history entry, which is
   * what makes the Android back gesture close the dialog instead of leaving the
   * page; closing replaces it, so the history does not fill up with reopenings.
   */
  const active = useMemo(() => {
    const id = searchParams.get(PROJECT_PARAM)
    return id ? (sorted.find((project) => project.id === id) ?? null) : null
  }, [searchParams, sorted])

  const openProject = useCallback(
    (project: Project) => {
      const params = new URLSearchParams(searchParams)
      params.set(PROJECT_PARAM, project.id)
      setSearchParams(params)
    },
    [searchParams, setSearchParams],
  )

  const closeProject = useCallback(() => {
    setClosing(active)
    const params = new URLSearchParams(searchParams)
    params.delete(PROJECT_PARAM)
    setSearchParams(params, { replace: true })
  }, [active, searchParams, setSearchParams])

  const featured = filtered.filter((project) => project.featured)
  const rest = filtered.filter((project) => !project.featured)
  const filtering = selected.length > 0

  /*
   * One key for "what is on screen". The result grids remount on it so their
   * entrance replays as a visible answer to the click, and every ScrollTrigger
   * on the page re-measures: swapping the pinned rail for a flat grid (or back)
   * moves everything below it, and a trigger left with stale positions would
   * hold its cards invisible until the visitor happened to scroll past a start
   * that no longer exists.
   */
  const selectionKey = selected.join('|')
  useGSAP(
    () => {
      if (!motionOK()) return
      const frame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
      return () => window.cancelAnimationFrame(frame)
    },
    { dependencies: [selectionKey], revertOnUpdate: true },
  )

  return (
    <div>
      <section aria-labelledby="projects-title" className="pt-20 pb-14 sm:pt-28 sm:pb-20">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="Projects" />
          </Parallax>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
            <div className="min-w-0 max-w-5xl">
              <p className={EYEBROW}>{pluralize(sorted.length, 'project')} · newest first</p>
              <TextReveal
                as="h1"
                id="projects-title"
                trigger="mount"
                className="mt-4 font-display text-[clamp(3rem,10vw,9rem)] leading-[0.95] tracking-tight text-ink"
              >
                Things I have <span className="text-gradient">built</span>
              </TextReveal>
              <Reveal trigger="mount" delay={0.35}>
                <p className={cn(LEDE, 'mt-6 max-w-2xl')}>
                  Ordered newest first. Open any of them for the full write-up: what it does,
                  what was hard, and the decisions behind it.
                </p>
              </Reveal>
            </div>

            <Reveal trigger="mount" delay={0.45} className="shrink-0">
              <Magnetic>
                <ButtonLink
                  to={PUBLIC_ROUTES.github}
                  variant="secondary"
                  size="lg"
                  icon="GitBranch"
                  data-cursor="Open"
                >
                  GitHub activity
                </ButtonLink>
              </Magnetic>
            </Reveal>
          </div>

          {sorted.length > 0 ? (
            <Reveal trigger="mount" delay={0.55} className="mt-14 border-t border-line pt-8 sm:mt-16">
              <TechFilter
                technologies={allTechnologies}
                selected={selected}
                counts={counts}
                total={sorted.length}
                matching={filtered.length}
                onToggle={toggle}
                onClear={clear}
              />
            </Reveal>
          ) : null}
        </div>
      </section>

      {sorted.length === 0 ? (
        <section aria-label="Projects" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal trigger="mount">
              <EmptyState
                icon="FolderGit2"
                title="No projects listed yet"
                description="Projects are content, not code: add them to src/data/projects.ts and they appear here, in the filter, and on the home page."
              />
            </Reveal>
          </div>
        </section>
      ) : filtered.length === 0 ? (
        <section aria-label="Filtered results" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal key={selectionKey} trigger="mount">
              <EmptyState
                icon="Funnel"
                title="No project uses all of those together"
                description={`Nothing here combines ${selected.join(', ')}. Drop a technology, or start again from the full list.`}
                action={
                  <Magnetic>
                    <Button variant="primary" icon="RotateCcw" onClick={clear} data-cursor="Reset">
                      Clear filters
                    </Button>
                  </Magnetic>
                }
              />
            </Reveal>
          </div>
        </section>
      ) : filtering ? (
        <>
          <TechMarquee technologies={allTechnologies} />

          <section aria-labelledby="projects-results" className="py-20 sm:py-28">
            <SectionIntro
              n={2}
              label="Results"
              id="projects-results"
              title="Filtered results"
              lede={`${filtered.length} of ${sorted.length} projects use ${selected.join(' and ')}.`}
            />
            <div className={CONTAINER}>
              <Stagger
                key={selectionKey}
                as="ul"
                className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3"
              >
                {filtered.map((project, index) => (
                  <li key={project.id} className="flex min-w-0">
                    <ProjectCard
                      project={project}
                      eager={index < 3}
                      onOpen={openProject}
                      className="w-full"
                    />
                  </li>
                ))}
              </Stagger>
            </div>
          </section>
        </>
      ) : (
        <>
          {featured.length > 0 ? (
            <section
              aria-labelledby="projects-featured"
              className="border-t border-line py-20 sm:py-28"
            >
              <SectionIntro
                n={2}
                label="Featured"
                id="projects-featured"
                title="The ones I learned the most from"
                lede="Each of these started as something I did not know how to build."
              />
              <HorizontalScroll className="mt-12 sm:mt-16">
                {featured.map((project, index) => (
                  <FeaturedSlide
                    key={project.id}
                    project={project}
                    index={index}
                    eager={index < 2}
                    onOpen={openProject}
                  />
                ))}
              </HorizontalScroll>
            </section>
          ) : null}

          <TechMarquee technologies={allTechnologies} />

          {rest.length > 0 ? (
            <section aria-labelledby="projects-rest" className="py-20 sm:py-28">
              <SectionIntro
                n={featured.length > 0 ? 3 : 2}
                label="Everything else"
                id="projects-rest"
                title="Everything else"
                lede="Smaller builds, work still in progress, and older projects kept for the record."
              />
              <div className={CONTAINER}>
                <Stagger as="ul" className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((project) => (
                    <li key={project.id} className="flex min-w-0">
                      <ProjectCard project={project} onOpen={openProject} className="w-full" />
                    </li>
                  ))}
                </Stagger>
              </div>
            </section>
          ) : null}
        </>
      )}

      <ProjectDialog project={active ?? closing} open={active !== null} onClose={closeProject} />
    </div>
  )
}
