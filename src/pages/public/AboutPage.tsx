import { PUBLIC_ROUTES } from '@/config/routes'
import { education, experience, profile, projects, seo, skillCategories } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Prose } from '@/components/common/Prose'
import { CurrentFocus } from '@/components/portfolio/CurrentFocus'
import { PhilosophyList } from '@/components/portfolio/PhilosophyList'
import { TimelineItem } from '@/components/portfolio/TimelineItem'
import { publicHref } from '@/components/portfolio/Hero'
import { yearMonthRangeLabel } from '@/utils/date'
import { pluralize, truncate } from '@/utils/format'

const SEPARATOR = '  ·  '

interface DirectionRow {
  term: string
  detail: string
  icon: string
}

/**
 * "Career direction" is assembled from the data files rather than written out,
 * so it can never drift from the rest of the site. A row that has no data
 * simply does not appear.
 */
function directionRows(): DirectionRow[] {
  const rows: DirectionRow[] = []

  if (profile.availability) {
    rows.push({ term: 'Looking for', detail: profile.availability, icon: 'Target' })
  }

  rows.push({ term: 'Based in', detail: profile.location, icon: 'MapPin' })

  const school = education[0]
  if (school) {
    rows.push({
      term: 'Studying',
      detail: [school.degree, school.field, school.institution].filter(Boolean).join(SEPARATOR),
      icon: 'GraduationCap',
    })
  }

  const role = experience[0]
  if (role) {
    rows.push({
      term: 'Most recently',
      detail: `${role.position} at ${role.company}${SEPARATOR}${yearMonthRangeLabel(role.startDate, role.endDate)}`,
      icon: 'Briefcase',
    })
  }

  if (projects.length > 0) {
    const shipped = projects.filter((project) => project.status === 'shipped').length
    rows.push({
      term: 'Built so far',
      detail: `${pluralize(projects.length, 'project')} on this site, ${shipped} of them shipped`,
      icon: 'FolderGit2',
    })
  }

  return rows
}

/** Interests, derived from the skills file: what I am strongest in, per area. */
function interestGroups() {
  return skillCategories
    .map((category) => {
      const strong = category.skills.filter((skill) => skill.level === 'strong')
      const names = (strong.length > 0 ? strong : category.skills.slice(0, 3)).map(
        (skill) => skill.name,
      )
      return { id: category.id, title: category.title, icon: category.icon, names }
    })
    .filter((group) => group.names.length > 0)
}

export default function AboutPage() {
  useDocumentMeta({
    title: 'About',
    description: truncate(profile.bio[0] ?? seo.description, 155),
    canonicalPath: PUBLIC_ROUTES.about,
  })

  const rows = directionRows()
  const groups = interestGroups()
  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined

  return (
    <div className="mx-auto w-full max-w-5xl px-5 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-28">
      <PageHeader
        eyebrow="About"
        title={profile.name}
        description={profile.headline}
        className="animate-rise"
      />

      <div className="mt-14 space-y-16 sm:mt-16 sm:space-y-24">
        <section aria-labelledby="about-background" className="animate-rise">
          <SectionHeading id="about-background" eyebrow="Background" title="The long version" />

          <Prose className="mt-6">
            {profile.bio.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </Prose>
        </section>

        <section aria-labelledby="about-direction" className="animate-rise">
          <SectionHeading
            id="about-direction"
            eyebrow="Direction"
            title="Where this is going"
            description="The short answer to the questions a recruiter usually opens with."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="pt-5">
                {/*
                  Each row is a grid rather than nested divs: <dt> and <dd> must
                  be direct children of the <div> inside the <dl>, so the icon
                  sits alongside them via `row-span-2` instead of wrapping the
                  pair in another element.
                */}
                <dl className="divide-y divide-line">
                  {rows.map((row) => (
                    <div
                      key={row.term}
                      className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 py-3 first:pt-0 last:pb-0"
                    >
                      <span
                        aria-hidden="true"
                        className="row-span-2 mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-surface-muted text-ink-muted"
                      >
                        <Icon name={row.icon} size={14} />
                      </span>
                      <dt className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase">
                        {row.term}
                      </dt>
                      <dd className="mt-1 text-[15px] leading-relaxed text-ink">{row.detail}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5">
                <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase">
                  Technical interests
                </p>

                {groups.length === 0 ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                    No skills are listed yet.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {groups.map((group) => (
                      <li key={group.id}>
                        <p className="flex items-center gap-2 text-sm font-medium text-ink">
                          <Icon name={group.icon} size={15} className="text-ink-faint" />
                          {group.title}
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {group.names.map((name) => (
                            <li key={name}>
                              <Badge size="sm">{name}</Badge>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}

                <ButtonLink
                  to={PUBLIC_ROUTES.skills}
                  variant="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                  className="mt-5 -ml-3"
                >
                  Every skill, with levels
                </ButtonLink>
              </CardContent>
            </Card>
          </div>
        </section>

        <CurrentFocus id="about-focus" />

        <section aria-labelledby="about-education" className="animate-rise">
          <SectionHeading
            id="about-education"
            eyebrow="Education"
            title="Where I studied"
            description="Degrees, and the coursework that actually backs up the skills page."
          />

          <div className="mt-8">
            {education.length === 0 ? (
              <EmptyState
                icon="GraduationCap"
                title="No education listed yet"
                description="Degrees live in src/data/education.ts."
              />
            ) : (
              education.map((entry, index) => (
                <TimelineItem
                  key={entry.id}
                  icon="GraduationCap"
                  title={entry.institution}
                  subtitle={[entry.degree, entry.field].filter(Boolean).join(SEPARATOR)}
                  meta={[
                    yearMonthRangeLabel(entry.startDate, entry.endDate),
                    entry.location,
                    entry.score,
                  ]
                    .filter(Boolean)
                    .join(SEPARATOR)}
                  bullets={entry.highlights}
                  tags={entry.coursework}
                  isLast={index === education.length - 1}
                />
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="about-philosophy" className="animate-rise">
          <SectionHeading
            id="about-philosophy"
            eyebrow="How I work"
            title="Three things I keep coming back to"
            description="Opinions I have actually changed my behaviour over, not slogans."
          />

          <PhilosophyList className="mt-6" />
        </section>

        <section aria-labelledby="about-next" className="animate-rise">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <h2 id="about-next" className="text-lg font-semibold tracking-tight text-ink">
                  Where to go next
                </h2>
                <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
                  The projects page has the write-ups; the contact page has every way to reach me.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                <ButtonLink to={PUBLIC_ROUTES.projects} variant="primary" iconRight="ArrowRight">
                  View projects
                </ButtonLink>
                {resumeHref ? (
                  <ButtonLink href={resumeHref} variant="secondary" icon="Download">
                    Resume
                  </ButtonLink>
                ) : null}
                <ButtonLink to={PUBLIC_ROUTES.contact} variant="ghost" icon="Mail">
                  Contact
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
