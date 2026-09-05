import { Link } from 'react-router-dom'
import type { Experience, Project } from '@/types'
import { PUBLIC_ROUTES } from '@/config/routes'
import { experience, projects } from '@/data'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PROJECT_STATUS, ProjectCover } from '@/components/projects/ProjectCard'
import { Magnetic, Parallax, Reveal, SectionNumber, Stagger, TextReveal, TiltCard } from '@/motion'
import { yearMonthRangeLabel } from '@/utils/date'
import { truncate } from '@/utils/format'
import { cn } from '@/lib/cn'

const ROLE_TYPE: Record<Experience['type'], string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  freelance: 'Freelance',
  'open-source': 'Open source',
}

/**
 * Deep link into /projects. The projects page reads `?project=<id>` and opens
 * that project's dialog; an unknown id simply shows the full list.
 */
function projectHref(project: Project): string {
  return `${PUBLIC_ROUTES.projects}?project=${encodeURIComponent(project.id)}`
}

/** The three featured projects — or the three newest, when none is flagged. */
function featuredProjects(): Project[] {
  const featured = projects.filter((project) => project.featured)
  return (featured.length > 0 ? featured : projects).slice(0, 3)
}

interface FeatureCardProps {
  project: Project
  /** The first card: spans seven columns and two rows, gets the bigger type and a taller cover. */
  lead: boolean
}

/**
 * One featured project. A tilting card whose whole face is a single link —
 * the name carries the accessible label and a stretched pseudo-element makes
 * the rest of the card clickable. The border and the arrow are what mark it
 * as interactive when motion is off.
 */
function FeatureCard({ project, lead }: FeatureCardProps) {
  const status = PROJECT_STATUS[project.status]
  const visibleTech = project.technologies.slice(0, lead ? 5 : 3)
  const hiddenTech = project.technologies.length - visibleTech.length

  return (
    <TiltCard
      max={5}
      className={cn('h-full rounded-card', lead ? 'lg:col-span-7 lg:row-span-2' : 'lg:col-span-5')}
    >
      <article
        data-cursor="View"
        className={cn(
          'group relative isolate flex h-full min-w-0 flex-col overflow-hidden rounded-card border border-line bg-surface',
          'transition-colors duration-200 hover:border-line-strong focus-within:border-accent',
        )}
      >
        <Reveal clip="up" className="overflow-hidden">
          <ProjectCover
            project={project}
            eager={lead}
            className={cn(lead && 'lg:aspect-[4/3]')}
          />
        </Reveal>

        <div className="flex flex-1 flex-col gap-4 p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <h3
              className={cn(
                'min-w-0 font-display leading-[1.05] font-semibold tracking-tight text-ink',
                lead ? 'text-[clamp(1.75rem,3vw,2.75rem)]' : 'text-[clamp(1.5rem,2.2vw,2rem)]',
              )}
            >
              <Link
                to={projectHref(project)}
                className="break-words rounded-sm outline-accent after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {project.name}
              </Link>
            </h3>
            <Icon
              name="ArrowUpRight"
              size={22}
              className="mt-1 shrink-0 text-ink-faint transition-[transform,color] duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-ink"
            />
          </div>

          <p
            className={cn(
              'leading-relaxed text-ink-muted',
              lead ? 'max-w-[56ch] text-base' : 'text-[15px]',
            )}
          >
            {project.summary}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
            <Badge tone={status.tone} size="sm" icon={status.icon}>
              {status.label}
            </Badge>
            <ul className="flex flex-wrap gap-1.5" aria-label={`Technologies used in ${project.name}`}>
              {visibleTech.map((tech) => (
                <li key={tech}>
                  <Badge size="sm" className="font-mono">
                    {tech}
                  </Badge>
                </li>
              ))}
              {hiddenTech > 0 ? (
                <li>
                  <Badge size="sm" className="font-mono">
                    +{hiddenTech}
                    <span className="sr-only">
                      {' '}
                      more: {project.technologies.slice(visibleTech.length).join(', ')}
                    </span>
                  </Badge>
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      </article>
    </TiltCard>
  )
}

/** The newest role, as a single wide row under the project grid. */
function LatestRole({ role }: { role: Experience }) {
  const meta = [yearMonthRangeLabel(role.startDate, role.endDate), role.location, ROLE_TYPE[role.type]]
    .filter(Boolean)
    .join(' · ')

  return (
    <Reveal className="mt-20 grid gap-8 border-t border-line pt-10 lg:grid-cols-12 lg:gap-10 lg:pt-12">
      <div className="lg:col-span-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
          Most recent role
        </p>
        <p className="mt-3 font-mono text-xs leading-relaxed text-ink-muted tabular-nums">{meta}</p>
      </div>

      <div className="min-w-0 lg:col-span-8">
        <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.05] font-semibold tracking-tight text-ink">
          {role.position} <span className="font-normal text-ink-muted">at</span> {role.company}
        </h3>

        {role.description ? (
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
            {truncate(role.description, 240)}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          {role.technologies.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={`Technologies at ${role.company}`}>
              {role.technologies.slice(0, 6).map((tech) => (
                <li key={tech}>
                  <Badge size="sm" className="font-mono">
                    {tech}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          <Magnetic strength={0.25}>
            <ButtonLink
              to={PUBLIC_ROUTES.experience}
              variant="ghost"
              iconRight="ArrowRight"
              className="-mx-2"
            >
              See all experience
            </ButtonLink>
          </Magnetic>
        </div>
      </div>
    </Reveal>
  )
}

/**
 * "Selected work": the three featured projects as large tilting cards in a
 * 7 / 5 / 5 grid, followed by the most recent role. Every block links onward
 * to the page that owns it, and the grid degrades to an empty state when the
 * projects file is empty rather than inventing content.
 */
export function HomeHighlights() {
  const shown = featuredProjects()
  const role = experience[0]

  return (
    <section aria-labelledby="highlight-projects" className="relative py-24 sm:py-36">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-8">
          <div className="min-w-0">
            <Parallax speed={-0.15}>
              <SectionNumber n={2} label="Projects" />
            </Parallax>

            <TextReveal
              as="h2"
              id="highlight-projects"
              className="mt-6 font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink"
            >
              Selected work
            </TextReveal>

            <Reveal
              as="p"
              delay={0.2}
              className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-ink-muted"
            >
              Each of these forced me to understand something I had been treating as magic.
            </Reveal>
          </div>

          <Reveal delay={0.3} className="pb-1">
            <Magnetic>
              <ButtonLink
                to={PUBLIC_ROUTES.projects}
                variant="secondary"
                size="lg"
                iconRight="ArrowRight"
              >
                All projects
              </ButtonLink>
            </Magnetic>
          </Reveal>
        </div>

        <div className="mt-14 sm:mt-20">
          {shown.length === 0 ? (
            <EmptyState
              icon="FolderGit2"
              title="No projects listed yet"
              description="Projects live in src/data/projects.ts and show up here the moment there is one."
            />
          ) : (
            <Stagger stagger={0.1} y={32} className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {shown.map((project, index) => (
                <FeatureCard key={project.id} project={project} lead={index === 0} />
              ))}
            </Stagger>
          )}
        </div>

        {role ? <LatestRole role={role} /> : null}
      </div>
    </section>
  )
}
