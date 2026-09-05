import type { Project, Tone } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
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

/** Stable 32-bit hash, so a generated cover never changes between builds. */
function hashId(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
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

export interface ProjectCoverProps {
  project: Project
  /** Covers above the fold load eagerly; everything else waits. */
  eager?: boolean
  className?: string
}

/**
 * The cover strip.
 *
 * No cover images ship with the repository, so a project without one gets a
 * generated cover rather than a broken `<img>`: two category hues chosen from a
 * hash of the project id, a fine dot grid, and the project's monogram. It is
 * deterministic, costs no request, and renders identically every time.
 */
export function ProjectCover({ project, eager = false, className }: ProjectCoverProps) {
  if (project.image) {
    return (
      <img
        src={coverSrc(project.image)}
        alt={`Cover image for ${project.name}`}
        width={1280}
        height={720}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={cn('aspect-[16/9] w-full bg-surface-muted object-cover', className)}
      />
    )
  }

  const seed = hashId(project.id)
  const first = (seed % 8) + 1
  const offset = ((seed >> 4) % 7) + 1
  const second = offset >= first ? offset + 1 : offset
  const angle = 105 + (seed % 70)

  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-[16/9] w-full overflow-hidden bg-surface-muted', className)}
      style={{
        backgroundImage:
          `linear-gradient(${angle}deg, ` +
          `color-mix(in oklab, var(--color-cat-${first}) 30%, var(--color-surface)) 0%, ` +
          `color-mix(in oklab, var(--color-cat-${second}) 18%, var(--color-surface)) 100%)`,
      }}
    >
      <span
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--color-ink) 13%, transparent) 1px, transparent 0)',
          backgroundSize: '13px 13px',
        }}
      />
      <span className="absolute right-4 bottom-3 font-mono text-4xl font-semibold tracking-tight text-ink/20">
        {initialsOf(project.name)}
      </span>
    </div>
  )
}

export interface ProjectCardProps {
  project: Project
  /** Larger type and more room. Used by the featured row. */
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
    <Card interactive className={cn('group relative isolate overflow-hidden', className)}>
      <ProjectCover
        project={project}
        eager={eager}
        className={featured ? 'sm:aspect-[2.6/1]' : undefined}
      />

      <CardHeader
        className="pb-3"
        actions={
          <Badge tone={status.tone} icon={status.icon} size="sm">
            {status.label}
          </Badge>
        }
      >
        <CardTitle
          as="h3"
          className={cn('flex items-start gap-1.5', featured ? 'text-xl' : 'text-lg')}
        >
          <button
            type="button"
            onClick={() => onOpen(project)}
            className="cursor-pointer text-left after:absolute after:inset-0 after:z-0 after:content-['']"
          >
            {project.name}
            <span className="sr-only"> — open project details</span>
          </button>
          <Icon
            name="ArrowUpRight"
            size={16}
            className="mt-1 text-ink-faint transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </CardTitle>

        <CardDescription className={cn(featured && 'text-[15px]')}>
          {project.summary}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 pb-4">
        <ul className="flex flex-wrap gap-1.5" aria-label={`Technologies used in ${project.name}`}>
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

        <p className="font-mono text-xs text-ink-faint tabular-nums">
          <time dateTime={project.date}>{formatYearMonth(project.date.slice(0, 7))}</time>
        </p>
      </CardContent>

      <CardFooter className="relative z-10 gap-1">
        {project.githubUrl ? (
          <ButtonLink
            href={project.githubUrl}
            variant="ghost"
            size="sm"
            icon="Code"
            aria-label={`Source code for ${project.name} on GitHub`}
          >
            Code
          </ButtonLink>
        ) : null}

        {project.liveUrl ? (
          <ButtonLink
            href={project.liveUrl}
            variant="ghost"
            size="sm"
            icon="Globe"
            aria-label={`Live demo of ${project.name}`}
          >
            Live
          </ButtonLink>
        ) : null}

        <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-faint">
          <Icon name="Sparkles" size={12} />
          {pluralize(project.keyFeatures.length, 'highlight')}
        </span>
      </CardFooter>
    </Card>
  )
}
