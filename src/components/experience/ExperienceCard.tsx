import type { CSSProperties } from 'react'
import type { Experience, Tone } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Stagger } from '@/motion'
import { photosFor } from '@/data'
import { PhotoFrame } from '@/components/portfolio/PhotoFrame'
import { yearMonthRangeLabel } from '@/utils/date'
import { cn } from '@/lib/cn'

interface TypeMeta {
  label: string
  tone: Tone
  icon: string
}

const TYPE_META: Record<Experience['type'], TypeMeta> = {
  internship: { label: 'Internship', tone: 'info', icon: 'GraduationCap' },
  'full-time': { label: 'Full-time', tone: 'positive', icon: 'Briefcase' },
  'part-time': { label: 'Part-time', tone: 'neutral', icon: 'Clock' },
  freelance: { label: 'Freelance', tone: 'warning', icon: 'Laptop' },
  'open-source': { label: 'Open source', tone: 'neutral', icon: 'GitBranch' },
}

/*
 * Hollow type. `-webkit-text-fill-color` rather than `color: transparent`, so
 * the stroke — which reads `currentColor` — keeps the token colour.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

/** Human label for a URL: the bare host, or a safe fallback for odd schemes. */
function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.length > 0 ? host : 'Open link'
  } catch {
    return 'Open link'
  }
}

export interface ExperienceCardProps {
  role: Experience
  /** 1-based position in the stack; rendered as the outlined "01" index. */
  index: number
  /** Labels the card as a shipped template rather than a real role. */
  template?: boolean
  className?: string
}

/**
 * One role, as a full-width card built for the sticky stack.
 *
 * Left column: who, what, when, with what. Right column: what the team owned,
 * then the numbered list of what changed — each item revealed in sequence, its
 * numeral hollow so the text stays the loudest thing on the card. The card is
 * not itself a link; when a role has a URL, the button in the left column is
 * the single focus stop for it.
 */
export function ExperienceCard({ role, index, template = false, className }: ExperienceCardProps) {
  const shots = photosFor(role.id).slice(0, 3)
  const type = TYPE_META[role.type]
  const current = !role.endDate
  const headingId = `experience-${role.id}`
  const dates = yearMonthRangeLabel(role.startDate, role.endDate)

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        'surface-card relative isolate overflow-hidden shadow-raised transition-colors duration-200',
        'hover:border-line-strong lg:min-h-[70vh]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-3 right-5 font-display text-[clamp(4.5rem,10vw,9rem)] leading-none font-medium text-line select-none sm:top-5 sm:right-8"
        style={OUTLINE}
      >
        {String(index).padStart(2, '0')}
      </span>

      <div className="relative grid gap-10 p-6 sm:p-10 lg:grid-cols-12 lg:gap-12 lg:p-12 xl:p-14">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={type.tone} icon={type.icon} size="sm">
              {type.label}
            </Badge>
            {current ? (
              <Badge tone="accent" size="sm" icon="Dot">
                Current
              </Badge>
            ) : null}
            {template ? (
              <Badge tone="warning" size="sm" icon="TriangleAlert">
                Template entry
              </Badge>
            ) : null}
          </div>

          <div>
            <h3
              id={headingId}
              className="font-display text-[clamp(2rem,4vw,3.25rem)] leading-[0.95] tracking-tight text-balance text-ink"
            >
              {role.company}
            </h3>
            <p className="mt-3 text-[17px] leading-snug font-medium text-ink-muted">
              {role.position}
            </p>
          </div>

          <dl className="grid gap-2.5 border-t border-line pt-5 font-mono text-xs text-ink-faint">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[11px] tracking-[0.18em] uppercase">Dates</dt>
              <dd className="text-right text-ink tabular-nums">{dates}</dd>
            </div>
            {role.location ? (
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[11px] tracking-[0.18em] uppercase">Location</dt>
                <dd className="text-right text-ink">{role.location}</dd>
              </div>
            ) : null}
          </dl>

          {role.technologies.length > 0 ? (
            <ul aria-label="Technologies" className="flex flex-wrap gap-1.5">
              {role.technologies.map((tech) => (
                <li key={tech}>
                  <Badge size="sm" className="font-mono">
                    {tech}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {shots.length > 0 ? (
            <div aria-label={`Photographs from ${role.company}`} role="group" className="pt-1">
              {/* A small stack of prints. Each sits a little askew; hovering the
                  stack straightens and lifts the one under the pointer. */}
              <div className="flex items-end">
                {shots.map((photo, i) => (
                  <PhotoFrame
                    key={photo.id}
                    photo={photo}
                    aspect="4 / 5"
                    focus={i === 0 ? '65% 35%' : undefined}
                    caption={false}
                    still
                    sizes="8rem"
                    className={cn(
                      'w-24 shrink-0 transition-transform duration-500 ease-out sm:w-28',
                      'hover:z-10 hover:-translate-y-2 hover:rotate-0',
                      i === 0 && '-rotate-[4deg]',
                      i === 1 && '-ml-6 rotate-[2deg] sm:-ml-7',
                      i === 2 && '-ml-6 -rotate-[1.5deg] sm:-ml-7',
                    )}
                  />
                ))}
              </div>
              <p className="mt-3 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                {shots.length} {shots.length === 1 ? 'photo' : 'photos'} · {shots[0]?.place}
              </p>
            </div>
          ) : null}

          {role.url ? (
            <div>
              <ButtonLink
                href={role.url}
                variant="secondary"
                size="sm"
                iconRight="ArrowUpRight"
                data-cursor="Open"
                aria-label={`Open ${role.company} on ${hostLabel(role.url)}`}
              >
                {hostLabel(role.url)}
              </ButtonLink>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 lg:col-span-8">
          <p className="max-w-[62ch] text-[17px] leading-relaxed text-ink-muted lg:pr-28">
            {role.description}
          </p>

          {role.achievements.length > 0 ? (
            <>
              <p className="mt-10 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
                What changed
              </p>
              <Stagger
                as="ol"
                stagger={0.08}
                className="mt-4 grid gap-x-8 border-t border-line lg:grid-cols-2"
              >
                {role.achievements.map((item, position) => (
                  <li
                    key={item}
                    className="grid grid-cols-[2.75rem_1fr] gap-3 border-b border-line py-5"
                  >
                    <span
                      aria-hidden="true"
                      className="font-mono text-2xl leading-none font-semibold text-ink-muted tabular-nums"
                      style={OUTLINE}
                    >
                      {String(position + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[15px] leading-relaxed text-ink-muted">{item}</p>
                  </li>
                ))}
              </Stagger>
            </>
          ) : null}
        </div>
      </div>
    </article>
  )
}
