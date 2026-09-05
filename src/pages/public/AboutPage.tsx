import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PUBLIC_ROUTES } from '@/config/routes'
import { education, experience, profile, projects, seo, skillCategories } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import {
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  Stagger,
  TextReveal,
  armAfterIntro,
} from '@/motion'
import { ButtonLink } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PhilosophyList } from '@/components/portfolio/PhilosophyList'
import { TimelineItem } from '@/components/portfolio/TimelineItem'
import { publicHref } from '@/components/portfolio/Hero'
import { cn } from '@/lib/cn'
import { yearMonthRangeLabel } from '@/utils/date'
import { pluralize, truncate } from '@/utils/format'

const SEPARATOR = '  ·  '

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const SECTION_TITLE =
  'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'
const SECTION_LEAD = 'mt-5 max-w-[36ch] text-base leading-relaxed text-ink-muted'

/* Hollow type for the initials fallback; see SectionNumber for the reasoning. */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

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

/** Every course across every degree, deduplicated, in data order. */
function courseworkItems(): string[] {
  const seen = new Set<string>()
  for (const entry of education) {
    for (const course of entry.coursework ?? []) seen.add(course)
  }
  return Array.from(seen)
}

/** Mono, uppercase items for a marquee band, each followed by an accent dot. */
function BandItems({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <span
          key={item}
          className="flex items-center gap-8 font-mono text-xs tracking-[0.18em] whitespace-nowrap text-ink-muted uppercase sm:text-[13px]"
        >
          {item}
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
        </span>
      ))}
    </>
  )
}

/**
 * A full-bleed marquee between two sections. The visually hidden label gives
 * the list a name for screen readers, which otherwise hear a bare run of items.
 * Under reduced motion the marquee wraps into a static list, so it gets the
 * page gutter back.
 */
function MarqueeBand({
  items,
  label,
  direction,
}: {
  items: string[]
  label: string
  direction?: 'left' | 'right'
}) {
  if (items.length === 0) return null

  return (
    <div className="border-y border-line py-5 motion-reduce:px-5 sm:py-6">
      <span className="sr-only">{label}: </span>
      <Marquee speed={60} direction={direction}>
        <BandItems items={items} />
      </Marquee>
    </div>
  )
}

/**
 * The tall portrait. Falls back to outlined initials when there is no image or
 * the image fails, so the frame never shows a broken `<img>`.
 */
function Portrait() {
  const [failed, setFailed] = useState(false)
  const src = profile.avatar && !failed ? publicHref(profile.avatar) : undefined

  if (!src) {
    return (
      <span aria-hidden="true" className="grid size-full place-items-center bg-surface-muted">
        <span
          style={OUTLINE}
          className="font-display text-[clamp(5rem,14vw,12rem)] leading-none font-medium text-line-strong select-none"
        >
          {profile.initials}
        </span>
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={profile.name}
      width={800}
      height={1000}
      decoding="async"
      onError={() => setFailed(true)}
      className="size-full object-cover"
    />
  )
}

/**
 * The direction rows as a definition list.
 *
 * Each row is a `<div>` whose only children are the `<dt>` and `<dd>`, which
 * is what the `<dl>` content model requires. The hairline above each row is a
 * pseudo-element scaled by a CSS variable, so it can draw itself without an
 * extra decorative element inside the group. Without JavaScript or with
 * reduced motion the variable falls back to 1 and the rule is simply there.
 */
function DirectionRows({ rows }: { rows: DirectionRow[] }) {
  const ref = useRef<HTMLDListElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const groups = Array.from(el.children) as HTMLElement[]
        if (groups.length === 0) return

        const tl = gsap.timeline({ paused: true })
        tl.fromTo(
          groups,
          { '--rule': 0 },
          { '--rule': 1, duration: 1.1, ease: 'house-in-out', stagger: 0.12 },
          0,
        )
        groups.forEach((group, index) => {
          tl.from(
            Array.from(group.children),
            { y: 18, opacity: 0, duration: 0.9, ease: 'house', stagger: 0.08 },
            index * 0.12 + 0.15,
          )
        })

        return armAfterIntro(tl, { trigger: 'scroll', element: el, once: true, ctx })
      })
    },
    { scope: ref, dependencies: [rows.length], revertOnUpdate: true },
  )

  return (
    <dl ref={ref} className="border-b border-line">
      {rows.map((row) => (
        <div
          key={row.term}
          className={cn(
            'relative grid gap-y-2 py-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-10 sm:py-7',
            'before:absolute before:inset-x-0 before:top-0 before:h-px before:origin-left before:bg-line-strong before:[transform:scaleX(var(--rule,1))]',
          )}
        >
          <dt className={cn(EYEBROW, 'flex items-center gap-2.5 pt-1')}>
            <Icon name={row.icon} size={13} />
            {row.term}
          </dt>
          <dd className="text-[clamp(1.0625rem,1.4vw,1.25rem)] leading-[1.5] text-ink">
            {row.detail}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function AboutPage() {
  useDocumentMeta({
    title: 'About',
    description: truncate(profile.bio[0] ?? seo.description, 155),
    canonicalPath: PUBLIC_ROUTES.about,
  })

  const rows = directionRows()
  const groups = interestGroups()
  const coursework = courseworkItems()
  const strongest = Array.from(new Set(groups.flatMap((group) => group.names)))
  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined

  return (
    <div>
      {/* 01 — the long version */}
      <section aria-labelledby="about-title" className="relative pt-16 pb-24 sm:pt-24 sm:pb-36">
        <div className={cn(CONTAINER, 'grid gap-14 lg:grid-cols-12 lg:gap-16')}>
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div data-cursor="" className="rounded-card">
                <Parallax speed={0.1}>
                  <Reveal
                    clip="up"
                    duration={1.2}
                    trigger="mount"
                    className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-surface-muted"
                  >
                    <Portrait />
                  </Reveal>
                </Parallax>
              </div>
              <Reveal delay={0.6} y={12} trigger="mount">
                <p className={cn(EYEBROW, 'mt-4 flex flex-wrap items-center gap-x-3 gap-y-1')}>
                  <span className="text-ink">{profile.name}</span>
                  <span aria-hidden="true" className="size-1 rounded-full bg-accent" />
                  <span>{profile.location}</span>
                </p>
              </Reveal>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <Parallax speed={-0.15}>
              <SectionNumber n={1} label="About" />
            </Parallax>

            <TextReveal
              as="h1"
              id="about-title"
              trigger="mount"
              className="mt-6 font-display text-[clamp(3rem,9vw,8rem)] leading-[0.95] tracking-tight text-ink"
            >
              The long version
            </TextReveal>

            <Reveal delay={0.35} trigger="mount">
              <p className="mt-6 max-w-[42ch] text-lg leading-relaxed text-ink-muted">
                {profile.headline}
              </p>
            </Reveal>

            <div className="mt-12 space-y-8 sm:mt-16">
              {profile.bio.map((paragraph) => (
                <TextReveal
                  key={paragraph.slice(0, 48)}
                  as="p"
                  type="lines"
                  className="text-[clamp(1.125rem,1.6vw,1.375rem)] leading-[1.5] text-ink"
                >
                  {paragraph}
                </TextReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MarqueeBand label="Strongest in" items={strongest} />

      {/* 02 — direction */}
      <section aria-labelledby="about-direction" className="py-24 sm:py-36">
        <div className={cn(CONTAINER, 'grid gap-12 lg:grid-cols-12 lg:gap-16')}>
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Parallax speed={-0.15}>
                <SectionNumber n={2} label="Direction" />
              </Parallax>
              <TextReveal as="h2" id="about-direction" className={cn(SECTION_TITLE, 'mt-6')}>
                Where this is going
              </TextReveal>
              <Reveal delay={0.25}>
                <p className={SECTION_LEAD}>
                  The short answer to the questions a recruiter usually opens with.
                </p>
              </Reveal>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-8">
            <DirectionRows rows={rows} />

            <div className="mt-16 sm:mt-20">
              <Reveal>
                <p className={EYEBROW}>Technical interests</p>
              </Reveal>

              {groups.length === 0 ? (
                <Reveal delay={0.1}>
                  <p className="mt-4 text-[15px] leading-relaxed text-ink-muted">
                    No skills are listed yet.
                  </p>
                </Reveal>
              ) : (
                <Stagger as="ul" className="mt-6 grid gap-x-10 gap-y-8 sm:grid-cols-2">
                  {groups.map((group) => (
                    <li key={group.id} className="min-w-0">
                      <p className="flex items-center gap-2.5 font-display text-xl leading-tight tracking-tight text-ink">
                        <Icon name={group.icon} size={16} className="text-ink-faint" />
                        {group.title}
                      </p>
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {group.names.map((name) => (
                          <li key={name}>
                            <Badge size="sm" className="font-mono">
                              {name}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </Stagger>
              )}

              <Reveal delay={0.2}>
                <ButtonLink
                  to={PUBLIC_ROUTES.skills}
                  variant="ghost"
                  size="sm"
                  iconRight="ArrowRight"
                  className="mt-8 -ml-3 [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-0.5"
                >
                  Every skill, with levels
                </ButtonLink>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* 03 — how I work */}
      <section aria-labelledby="about-philosophy" className="border-t border-line py-24 sm:py-36">
        <div className={CONTAINER}>
          <div className="max-w-3xl">
            <Parallax speed={-0.15}>
              <SectionNumber n={3} label="How I work" />
            </Parallax>
            <TextReveal as="h2" id="about-philosophy" className={cn(SECTION_TITLE, 'mt-6')}>
              What I keep coming back to
            </TextReveal>
            <Reveal delay={0.25}>
              <p className={cn(SECTION_LEAD, 'max-w-[44ch]')}>
                Opinions I have actually changed my behaviour over, not slogans.
              </p>
            </Reveal>
          </div>

          <PhilosophyList className="mt-14 sm:mt-20" />
        </div>
      </section>

      <MarqueeBand label="Coursework" items={coursework} direction="right" />

      {/* 04 — education */}
      <section aria-labelledby="about-education" className="py-24 sm:py-36">
        <div className={cn(CONTAINER, 'grid gap-12 lg:grid-cols-12 lg:gap-16')}>
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-28">
              <Parallax speed={-0.15}>
                <SectionNumber n={4} label="Education" />
              </Parallax>
              <TextReveal as="h2" id="about-education" className={cn(SECTION_TITLE, 'mt-6')}>
                Where I studied
              </TextReveal>
              <Reveal delay={0.25}>
                <p className={SECTION_LEAD}>
                  Degrees, and the coursework that actually backs up the skills page.
                </p>
              </Reveal>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-8">
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
        </div>
      </section>

      {/* 05 — next */}
      <section aria-labelledby="about-next" className="border-t border-line py-24 sm:py-36">
        <div
          className={cn(CONTAINER, 'flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between')}
        >
          <div className="max-w-3xl">
            <Reveal>
              <p className={EYEBROW}>Next</p>
            </Reveal>
            <TextReveal as="h2" id="about-next" className={cn(SECTION_TITLE, 'mt-4')}>
              Where to go next
            </TextReveal>
            <Reveal delay={0.25}>
              <p className={cn(SECTION_LEAD, 'max-w-[48ch]')}>
                The projects page has the write-ups; the contact page has every way to reach me.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.35}>
            <div className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <ButtonLink
                  to={PUBLIC_ROUTES.projects}
                  variant="primary"
                  size="lg"
                  iconRight="ArrowRight"
                  data-cursor="View"
                >
                  View projects
                </ButtonLink>
              </Magnetic>
              {resumeHref ? (
                <Magnetic>
                  <ButtonLink
                    href={resumeHref}
                    variant="secondary"
                    size="lg"
                    icon="Download"
                    data-cursor="Open"
                  >
                    Resume
                  </ButtonLink>
                </Magnetic>
              ) : null}
              <Magnetic strength={0.25}>
                <ButtonLink to={PUBLIC_ROUTES.contact} variant="ghost" size="lg" icon="Mail">
                  Contact
                </ButtonLink>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
