import { useRef } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro } from '@/motion'
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
  /** Curated icon name, shown in a small square beside the title. */
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
 *
 * Motion is owned here, not by the page: the node scales in and the content
 * rises as the entry enters, and the rail to the next entry draws itself,
 * scrubbed to scroll. Wrapping it in another `Reveal` would double the
 * entrance. Under reduced motion everything is simply present.
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
  const ref = useRef<HTMLElement>(null)
  const nodeRef = useRef<HTMLSpanElement>(null)
  const railRef = useRef<HTMLSpanElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const hasBullets = Boolean(bullets && bullets.length > 0)
  const hasTags = Boolean(tags && tags.length > 0)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const node = nodeRef.current
        const rail = railRef.current
        const body = bodyRef.current

        // Built paused so the hidden start state applies at once; released by
        // a 'top 85%' trigger once the intro curtain has gone.
        const entrance = gsap.timeline({ paused: true })
        if (node) {
          entrance.from(node, { scale: 0, duration: 0.6, ease: 'house' }, 0)
        }
        if (body && body.children.length > 0) {
          entrance.from(
            Array.from(body.children),
            { y: 20, opacity: 0, duration: 0.9, ease: 'house', stagger: 0.07 },
            0.1,
          )
        }
        const disarm = armAfterIntro(entrance, { trigger: 'scroll', element: el, once: true, ctx })

        // The rail is scrubbed, not triggered: it grows exactly as far as the
        // reader has scrolled, so it always points at the entry they are on.
        if (rail) {
          gsap.fromTo(
            rail,
            { scaleY: 0, transformOrigin: 'top center' },
            {
              scaleY: 1,
              transformOrigin: 'top center',
              ease: 'none',
              scrollTrigger: { trigger: el, start: 'top 75%', end: 'bottom 60%', scrub: 0.4 },
            },
          )
        }

        return () => disarm()
      })
    },
    { scope: ref, dependencies: [isLast], revertOnUpdate: true },
  )

  return (
    <article
      ref={ref}
      className={cn(
        'relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-5 sm:grid-cols-[1.75rem_minmax(0,1fr)] sm:gap-x-8',
        className,
      )}
    >
      {/* The rail: a node, and the line that reaches the next node. */}
      <div className="relative flex justify-center" aria-hidden="true">
        {!isLast ? (
          <span
            ref={railRef}
            className="absolute top-6 bottom-0 left-[calc(50%-0.5px)] w-px origin-top bg-line-strong"
          />
        ) : null}
        <span
          ref={nodeRef}
          className="relative z-10 mt-[0.55rem] size-2.5 rounded-full border-2 border-accent bg-canvas"
        />
      </div>

      <div ref={bodyRef} className={cn('min-w-0', isLast ? 'pb-2' : 'pb-12 sm:pb-16')}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-display text-xl leading-tight tracking-tight text-ink sm:text-2xl">
            {title}
          </h3>
          {icon ? (
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-muted"
            >
              <Icon name={icon} size={16} />
            </span>
          ) : null}
        </div>

        <p className="mt-1.5 text-[15px] font-medium text-ink-muted">{subtitle}</p>

        <p className="mt-2 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase tabular-nums">
          {meta}
        </p>

        {description ? (
          <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted sm:text-base">
            {description}
          </p>
        ) : null}

        {hasBullets ? (
          <ul className="mt-5 space-y-2.5">
            {bullets?.map((bullet) => (
              <li key={bullet} className="flex gap-3 text-[15px] leading-relaxed text-ink-muted">
                <span aria-hidden="true" className="mt-[0.8em] h-px w-3 shrink-0 bg-accent" />
                <span className="min-w-0">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {hasTags ? (
          <ul className="mt-5 flex flex-wrap gap-1.5">
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
            data-cursor="Open"
            className="group mt-5 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors duration-150 hover:decoration-ink"
          >
            {hostLabel(url)}
            <Icon
              name="ArrowUpRight"
              size={14}
              className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
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
