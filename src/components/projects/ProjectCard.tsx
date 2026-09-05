import type { ReactNode } from 'react'
import type { Project, Tone } from '@/types'
import type { RevealTrigger } from '@/motion'
import { Reveal, TiltCard } from '@/motion'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { GithubIcon } from '@/components/common/BrandIcons'
import { asset } from '@/config/app'
import { formatYearMonth } from '@/utils/date'
import { initialsOf, pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/**
 * One project, as a card.
 *
 * The card body is a single activation target — a button whose `::after`
 * stretches across the whole card — while the GitHub and live links sit above
 * it on their own layer. That is what keeps "click anywhere to read more"
 * working without nesting an anchor inside an anchor, and it leaves the
 * keyboard three sensible stops instead of one giant one.
 *
 * Motion is layered on, never relied on: the cover wipes up and settles from a
 * slight zoom, the card tilts toward the pointer, the arrow travels on hover.
 * With motion off the border, the arrow and the underlines still say "this
 * opens".
 */

interface StatusMeta {
  label: string
  tone: Tone
  icon: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const PROJECT_STATUS: Record<Project['status'], StatusMeta> = {
  shipped: { label: 'Shipped', tone: 'positive', icon: 'CircleCheckBig' },
  'in-progress': { label: 'In progress', tone: 'warning', icon: 'Hourglass' },
  archived: { label: 'Archived', tone: 'neutral', icon: 'Archive' },
}

/* The house curve, for the few transitions CSS owns rather than GSAP. */
const HOUSE = 'ease-[cubic-bezier(0.16,1,0.3,1)]'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'

/** Stable 32-bit hash, so a generated cover never changes between builds. */
function hashId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  // Unsigned, so every shift below stays positive whatever the top bit is.
  return hash >>> 0
}

/** Anything already absolute is handed to the browser untouched. */
function isAbsolute(path: string): boolean {
  return /^(https?:)?\/\//.test(path) || path.startsWith('data:')
}

/** Resolves a cover path against the deployed base path. */
// eslint-disable-next-line react-refresh/only-export-components
export function coverSrc(image: string): string {
  return isAbsolute(image) ? image : asset(image)
}

const DOT_GRID = {
  backgroundImage:
    'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-ink) 12%, transparent) 1px, transparent 0)',
  backgroundSize: '14px 14px',
} as const

/**
 * The cover a project gets when it ships without a screenshot: two category
 * hues bloom from points chosen by a hash of the id, over a fine dot grid, with
 * the project's monogram drawn hollow across the middle. The monogram is SVG
 * text in a viewBox, so it scales with whatever box the cover is given — a card
 * strip or a 70vh slide — without a media query or a container unit.
 */
function GeneratedCover({ project }: { project: Project }) {
  const seed = hashId(project.id)
  const first = (seed % 8) + 1
  const offset = ((seed >>> 4) % 7) + 1
  const second = offset >= first ? offset + 1 : offset
  const angle = 105 + (seed % 70)
  const x1 = 12 + ((seed >>> 8) % 36)
  const y1 = 16 + ((seed >>> 12) % 40)
  const x2 = 58 + ((seed >>> 16) % 32)
  const y2 = 44 + ((seed >>> 20) % 46)

  const backgroundImage = [
    `radial-gradient(circle at ${x1}% ${y1}%, color-mix(in oklab, var(--color-cat-${first}) 46%, transparent) 0%, transparent 58%)`,
    `radial-gradient(circle at ${x2}% ${y2}%, color-mix(in oklab, var(--color-cat-${second}) 38%, transparent) 0%, transparent 62%)`,
    `linear-gradient(${angle}deg, color-mix(in oklab, var(--color-cat-${first}) 14%, var(--color-surface)) 0%, color-mix(in oklab, var(--color-cat-${second}) 10%, var(--color-surface)) 100%)`,
  ].join(', ')

  return (
    <div aria-hidden="true" className="relative h-full w-full" style={{ backgroundImage }}>
      <span className="absolute inset-0" style={DOT_GRID} />
      <svg
        viewBox="0 0 160 90"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
        className="absolute inset-0 h-full w-full font-display font-semibold"
      >
        <text
          x="80"
          y="46"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="60"
          paintOrder="stroke"
          strokeWidth="0.55"
          className="fill-ink/6 stroke-ink/25"
        >
          {initialsOf(project.name)}
        </text>
      </svg>
    </div>
  )
}

export interface ProjectCoverProps {
  project: Project
  /** Covers above the fold load eagerly; everything else waits. */
  eager?: boolean
  className?: string
  /**
   * How the cover enters: wiping up as it scrolls into view (default), the
   * moment it mounts (inside a dialog, where the page does not scroll), or not
   * at all when a parent choreographs it.
   */
  reveal?: RevealTrigger | 'none'
  /** Seconds to hold before the wipe — offsets neighbouring slides in a row. */
  delay?: number
}

/**
 * The cover strip.
 *
 * No cover images ship with the repository, so a project without one gets a
 * generated cover rather than a broken `<img>`. Either way it wipes in from the
 * bottom and settles from a 1.08 zoom, then zooms gently on hover.
 *
 * Three layers, on purpose: the outer one is what the wipe clips; its first
 * child is what the wipe scales (GSAP owns that transform); the inner one
 * carries the CSS hover zoom. Keeping them apart means a CSS transition never
 * fights a GSAP tween over the same property.
 */
export function ProjectCover({
  project,
  eager = false,
  className,
  reveal = 'scroll',
  delay = 0,
}: ProjectCoverProps) {
  const shell = cn(
    'relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-surface-muted',
    className,
  )

  const layers = (
    <div className="absolute inset-0">
      <div
        className={cn(
          'h-full w-full transition-transform duration-700 group-hover:scale-[1.04]',
          HOUSE,
        )}
      >
        {project.image ? (
          <img
            src={coverSrc(project.image)}
            alt={`Cover image for ${project.name}`}
            width={1280}
            height={720}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <GeneratedCover project={project} />
        )}
      </div>
    </div>
  )

  if (reveal === 'none') {
    return <div className={shell}>{layers}</div>
  }

  return (
    <Reveal clip="up" duration={1.1} delay={delay} trigger={reveal} className={shell}>
      {layers}
    </Reveal>
  )
}

export interface ProjectLinkProps {
  href: string
  /** Full accessible name — the visible label is a single word. */
  label: string
  /** What the custom cursor says over this link. */
  cursor: string
  icon: ReactNode
  children: ReactNode
  className?: string
}

/**
 * An external link inside a card: mono label, a mark, an underline that slides
 * in from the left and an arrow that travels on hover. Rendered above the
 * card's stretched button so it is never a link inside a button.
 */
export function ProjectLink({ href, label, cursor, icon, children, className }: ProjectLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (opens in a new tab)`}
      data-cursor={cursor}
      className={cn(
        'group/link relative inline-flex h-9 items-center gap-2 rounded-md px-2',
        'font-mono text-[11px] tracking-[0.18em] text-ink-muted uppercase',
        'transition-colors duration-300 hover:text-ink pointer-coarse:h-11',
        className,
      )}
    >
      <span className="text-ink-faint transition-colors duration-300 group-hover/link:text-ink">
        {icon}
      </span>
      <span className="relative">
        {children}
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-current',
            'transition-transform duration-300 group-hover/link:scale-x-100 group-focus-visible/link:scale-x-100',
            HOUSE,
          )}
        />
      </span>
      <Icon
        name="ArrowUpRight"
        size={12}
        className={cn(
          'transition-transform duration-300 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5',
          HOUSE,
        )}
      />
    </a>
  )
}

export interface ProjectCardProps {
  project: Project
  /** Larger type and a wider cover. */
  featured?: boolean
  eager?: boolean
  onOpen: (project: Project) => void
  className?: string
}

export function ProjectCard({
  project,
  featured = false,
  eager = false,
  onOpen,
  className,
}: ProjectCardProps) {
  const status = PROJECT_STATUS[project.status]
  const visibleTech = project.technologies.slice(0, featured ? 5 : 3)
  const hiddenTech = project.technologies.slice(visibleTech.length)

  return (
    <TiltCard max={6} className={cn('h-full rounded-card', className)}>
      <Card interactive data-cursor="View" className="group relative isolate h-full overflow-hidden">
        <ProjectCover
          project={project}
          eager={eager}
          className={cn('border-b border-line', featured && 'sm:aspect-[2.4/1]')}
        />

        <div className="flex flex-1 flex-col gap-4 px-5 pt-5 pb-6 sm:px-6 sm:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className={cn(EYEBROW, 'tabular-nums')}>
              <time dateTime={project.date}>{formatYearMonth(project.date.slice(0, 7))}</time>
            </p>
            <Badge tone={status.tone} icon={status.icon} size="sm">
              {status.label}
            </Badge>
          </div>

          <h3
            className={cn(
              'flex items-start justify-between gap-3 font-display leading-[1.02] tracking-tight text-ink',
              featured ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl',
            )}
          >
            {/* Stretched button: `after:` gets its content from Tailwind v4 automatically. */}
            <button
              type="button"
              onClick={() => onOpen(project)}
              className="min-w-0 cursor-pointer text-left break-words after:absolute after:inset-0 after:z-0"
            >
              {project.name}
              <span className="sr-only"> — open project details</span>
            </button>
            <Icon
              name="ArrowUpRight"
              size={22}
              className={cn(
                'mt-0.5 shrink-0 text-ink-faint transition-[translate,color] duration-500',
                'group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-ink',
                HOUSE,
              )}
            />
          </h3>

          <p
            className={cn(
              'leading-relaxed text-ink-muted',
              featured ? 'text-[15px] sm:text-base' : 'text-[15px]',
            )}
          >
            {project.summary}
          </p>

          <ul
            className="mt-auto flex flex-wrap gap-1.5 pt-1"
            aria-label={`Technologies used in ${project.name}`}
          >
            {visibleTech.map((tech) => (
              <li key={tech}>
                <Badge size="sm" className="font-mono">
                  {tech}
                </Badge>
              </li>
            ))}
            {hiddenTech.length > 0 ? (
              <li>
                <Badge size="sm" className="font-mono">
                  +{hiddenTech.length}
                  <span className="sr-only"> more: {hiddenTech.join(', ')}</span>
                </Badge>
              </li>
            ) : null}
          </ul>
        </div>

        <footer className="relative z-10 flex flex-wrap items-center gap-1 border-t border-line px-3 py-2 sm:px-4">
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

          <span className={cn(EYEBROW, 'ml-auto flex items-center gap-1.5 pr-1')}>
            <Icon name="Sparkles" size={12} />
            {pluralize(project.keyFeatures.length, 'highlight')}
          </span>
        </footer>
      </Card>
    </TiltCard>
  )
}
