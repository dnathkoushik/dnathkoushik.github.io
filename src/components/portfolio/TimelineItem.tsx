import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface TimelineItemProps {
  /** The headline of the entry: a role, an institution, a milestone. */
  title: string
  /** Who or where it happened — the company, the degree, the issuer. */
  subtitle: string
  /** Dates, location, score. Rendered small and monospaced. */
  meta: string
  description?: string
  /** One achievement per string. Rendered as a real list. */
  bullets?: string[]
  /** Technologies, coursework, keywords. */
  tags?: string[]
  /** External destination for the entry. Opens in a new tab. */
  url?: string
  /** Stops the connecting rail so the last node does not dangle. */
  isLast?: boolean
  /** Curated icon name for the node. Defaults to a small dot. */
  icon?: string
  className?: string
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

/**
 * One entry on a vertical timeline: a node on a rail, then the content.
 *
 * Shared by the education list on /about and the role timeline on /experience,
 * so it stays deliberately generic — it knows about a title, a subtitle and a
 * meta line, not about jobs or degrees. The root element is an `<article>`, so
 * wrap a collection of these in a plain container rather than a `<ul>`.
 */
export function TimelineItem({
  title,
  subtitle,
  meta,
  description,
  bullets,
  tags,
  url,
  isLast = false,
  icon,
  className,
}: TimelineItemProps) {
  const hasBullets = Boolean(bullets && bullets.length > 0)
  const hasTags = Boolean(tags && tags.length > 0)

  return (
    <article
      className={cn(
        'relative grid grid-cols-[auto_1fr] gap-x-4 animate-rise sm:gap-x-5',
        className,
      )}
    >
      {/* The rail: a node, and the line that reaches the next node. */}
      <div className="relative flex justify-center" aria-hidden="true">
        {!isLast ? (
          <span className="absolute top-10 bottom-0 left-1/2 w-px -translate-x-1/2 bg-line" />
        ) : null}
        <span className="relative z-10 grid size-9 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-subtle">
          {icon ? (
            <Icon name={icon} size={16} />
          ) : (
            <span className="size-2 rounded-full bg-ink-faint" />
          )}
        </span>
      </div>

      <div className={cn('min-w-0', isLast ? 'pb-1' : 'pb-9 sm:pb-11')}>
        <h3 className="text-base font-semibold tracking-tight text-ink sm:text-lg">{title}</h3>

        <p className="mt-0.5 text-sm font-medium text-ink-muted">{subtitle}</p>

        <p className="mt-1.5 font-mono text-xs tracking-tight text-ink-faint tabular-nums">{meta}</p>

        {description ? (
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
            {description}
          </p>
        ) : null}

        {hasBullets ? (
          <ul className="mt-3 space-y-2">
            {bullets?.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-[15px] leading-relaxed text-ink-muted">
                <Icon name="Check" size={15} className="mt-1 text-positive" />
                <span className="min-w-0">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {hasTags ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {tags?.map((tag) => (
              <li key={tag}>
                <Badge size="sm" className="font-mono">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-accent transition-colors duration-150 hover:text-accent-hover"
          >
            <Icon name="ExternalLink" size={14} />
            {hostLabel(url)}
            <span className="sr-only">
              {' '}
              — {title} (opens in a new tab)
            </span>
          </a>
        ) : null}
      </div>
    </article>
  )
}
