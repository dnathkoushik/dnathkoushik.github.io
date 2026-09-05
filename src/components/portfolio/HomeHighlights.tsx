import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Experience, Project, Tone } from '@/types'
import { PUBLIC_ROUTES } from '@/config/routes'
import { education, experience, projects, skillCategories } from '@/data'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { yearMonthRangeLabel } from '@/utils/date'
import { truncate } from '@/utils/format'

const PROJECT_STATUS: Record<Project['status'], { label: string; tone: Tone; icon: string }> = {
  shipped: { label: 'Shipped', tone: 'positive', icon: 'CircleCheckBig' },
  'in-progress': { label: 'In progress', tone: 'accent', icon: 'CircleDashed' },
  archived: { label: 'Archived', tone: 'neutral', icon: 'Archive' },
}

const ROLE_TYPE: Record<Experience['type'], string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  freelance: 'Freelance',
  'open-source': 'Open source',
}

const SEPARATOR = '  ·  '

interface HighlightProps {
  id: string
  eyebrow: string
  title: string
  description: string
  seeAllTo: string
  seeAllLabel: string
  children: ReactNode
}

/** A titled block with a "see all" escape hatch to the page that owns it. */
function Highlight({
  id,
  eyebrow,
  title,
  description,
  seeAllTo,
  seeAllLabel,
  children,
}: HighlightProps) {
  return (
    <section aria-labelledby={id} className="animate-rise">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <SectionHeading
          id={id}
          eyebrow={eyebrow}
          title={title}
          description={description}
          className="min-w-0 flex-1"
        />
        <ButtonLink to={seeAllTo} variant="ghost" size="sm" iconRight="ArrowRight">
          {seeAllLabel}
        </ButtonLink>
      </div>

      <div className="mt-6">{children}</div>
    </section>
  )
}

function ProjectHighlights() {
  const featured = projects.filter((project) => project.featured)
  const shown = (featured.length > 0 ? featured : projects).slice(0, 3)

  if (shown.length === 0) {
    return (
      <EmptyState
        icon="FolderGit2"
        title="No projects listed yet"
        description="Projects live in src/data/projects.ts and show up here the moment there is one."
      />
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {shown.map((project) => {
        const status = PROJECT_STATUS[project.status]
        const extra = project.technologies.length - 4

        return (
          <li key={project.id} className="flex">
            <Card interactive className="w-full">
              <CardHeader
                actions={
                  <Badge tone={status.tone} size="sm" icon={status.icon}>
                    {status.label}
                  </Badge>
                }
              >
                <CardTitle as="h3" className="text-base">
                  {/* Stretched link: one focus stop, whole card clickable. */}
                  <Link
                    to={PUBLIC_ROUTES.projects}
                    className="rounded-sm outline-accent after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {project.name}
                  </Link>
                </CardTitle>
                <CardDescription>{project.summary}</CardDescription>
              </CardHeader>

              <CardContent className="mt-auto">
                <ul className="flex flex-wrap gap-1.5">
                  {project.technologies.slice(0, 4).map((tech) => (
                    <li key={tech}>
                      <Badge size="sm" className="font-mono">
                        {tech}
                      </Badge>
                    </li>
                  ))}
                  {extra > 0 ? (
                    <li>
                      <Badge size="sm" className="font-mono">
                        +{extra} more
                      </Badge>
                    </li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}

function namesAtLevel(level: 'strong' | 'working'): string[] {
  return skillCategories.flatMap((category) =>
    category.skills.filter((skill) => skill.level === level).map((skill) => skill.name),
  )
}

function SkillHighlights() {
  const groups = [
    { label: 'Reach for by default', tone: 'accent' as Tone, names: namesAtLevel('strong') },
    {
      label: 'Comfortable building with',
      tone: 'neutral' as Tone,
      names: namesAtLevel('working').slice(0, 8),
    },
  ].filter((group) => group.names.length > 0)

  if (groups.length === 0) {
    return (
      <EmptyState
        icon="Layers"
        title="No skills listed yet"
        description="Categories and honest proficiency levels live in src/data/skills.ts."
      />
    )
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <dl className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <dt className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase">
                {group.label}
              </dt>
              <dd className="mt-2.5">
                <ul className="flex flex-wrap gap-1.5">
                  {group.names.map((name) => (
                    <li key={name}>
                      <Badge tone={group.tone}>{name}</Badge>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

interface LatestEntry {
  icon: string
  title: string
  subtitle: string
  meta: string
  description: string
  tags: string[]
  eyebrow: string
  heading: string
  blurb: string
  seeAllTo: string
  seeAllLabel: string
}

/** The newest role — or the newest degree, when there is no role yet. */
function latestEntry(): LatestEntry | null {
  const role = experience[0]
  if (role) {
    return {
      icon: 'Briefcase',
      title: role.position,
      subtitle: role.company,
      meta: [yearMonthRangeLabel(role.startDate, role.endDate), role.location, ROLE_TYPE[role.type]]
        .filter(Boolean)
        .join(SEPARATOR),
      description: truncate(role.description, 240),
      tags: role.technologies,
      eyebrow: 'Experience',
      heading: 'Most recent role',
      blurb:
        'The newest entry on the timeline. What I actually did in each role is on the experience page.',
      seeAllTo: PUBLIC_ROUTES.experience,
      seeAllLabel: 'All experience',
    }
  }

  const school = education[0]
  if (school) {
    return {
      icon: 'GraduationCap',
      title: school.institution,
      subtitle: [school.degree, school.field].filter(Boolean).join(SEPARATOR),
      meta: [yearMonthRangeLabel(school.startDate, school.endDate), school.location, school.score]
        .filter(Boolean)
        .join(SEPARATOR),
      description: truncate(school.highlights[0] ?? '', 240),
      tags: school.coursework ?? [],
      eyebrow: 'Education',
      heading: 'Where I am studying',
      blurb: 'The current degree. Coursework and the rest of the background sit on the about page.',
      seeAllTo: PUBLIC_ROUTES.about,
      seeAllLabel: 'More about me',
    }
  }

  return null
}

/**
 * The reasons to keep scrolling past the hero: what I have shipped, what I
 * build with, and where I have been most recently.
 *
 * Every block links onward to the page that owns it, and every block either
 * degrades to an empty state or removes itself when its data file is empty —
 * nothing here invents content it does not have.
 */
export function HomeHighlights() {
  const latest = latestEntry()

  return (
    <div className="space-y-14 sm:space-y-20">
      <Highlight
        id="highlight-projects"
        eyebrow="Selected work"
        title="Projects I learned the most from"
        description="Each of these forced me to understand something I had been treating as magic."
        seeAllTo={PUBLIC_ROUTES.projects}
        seeAllLabel="All projects"
      >
        <ProjectHighlights />
      </Highlight>

      <Highlight
        id="highlight-skills"
        eyebrow="Toolkit"
        title="What I work with"
        description="Grouped by how well I know it, not by how long the list can be made to look."
        seeAllTo={PUBLIC_ROUTES.skills}
        seeAllLabel="All skills"
      >
        <SkillHighlights />
      </Highlight>

      {latest ? (
        <Highlight
          id="highlight-latest"
          eyebrow={latest.eyebrow}
          title={latest.heading}
          description={latest.blurb}
          seeAllTo={latest.seeAllTo}
          seeAllLabel={latest.seeAllLabel}
        >
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
                >
                  <Icon name={latest.icon} size={18} />
                </span>

                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-ink">{latest.title}</h3>
                  <p className="mt-0.5 text-sm font-medium text-ink-muted">{latest.subtitle}</p>
                  <p className="mt-1.5 font-mono text-xs text-ink-faint tabular-nums">
                    {latest.meta}
                  </p>

                  {latest.description ? (
                    <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
                      {latest.description}
                    </p>
                  ) : null}

                  {latest.tags.length > 0 ? (
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {latest.tags.slice(0, 6).map((tag) => (
                        <li key={tag}>
                          <Badge size="sm" className="font-mono">
                            {tag}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </Highlight>
      ) : null}
    </div>
  )
}
