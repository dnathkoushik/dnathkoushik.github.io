import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface MarqueeProps {
  /** The items to loop. Each copy lays them out with `gap-8`, so they need no margins of their own. */
  children: ReactNode
  /** Travel speed in px per second. */
  speed?: number
  direction?: 'left' | 'right'
  pauseOnHover?: boolean
  className?: string
}

/**
 * A seamless horizontal loop driven entirely by CSS: two copies of the
 * children in one track, translated by half its width per cycle with the
 * global `marquee` keyframes. The duration is derived from the measured width
 * so `speed` really is px/s regardless of content.
 *
 * Under reduced motion the second copy is hidden and the first wraps into a
 * readable static list; the edge fade goes with it.
 */
export function Marquee({
  children,
  speed = 80,
  direction = 'left',
  pauseOnHover = false,
  className,
}: MarqueeProps) {
  const track = useRef<HTMLDivElement>(null)
  const copy = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const rail = track.current
    const first = copy.current
    if (!rail || !first) return

    const apply = () => {
      const width = first.getBoundingClientRect().width
      if (width > 0) {
        rail.style.setProperty('--marquee-duration', `${(width / speed).toFixed(2)}s`)
      }
    }
    apply()

    if (typeof ResizeObserver === 'undefined') return
    let observer: ResizeObserver | undefined
    try {
      observer = new ResizeObserver(apply)
      observer.observe(first)
    } catch {
      observer = undefined
    }
    return () => observer?.disconnect()
  }, [speed])

  const copyClasses = 'flex shrink-0 items-center gap-8 pr-8'

  return (
    <div
      className={cn(
        'group relative w-full overflow-hidden',
        'motion-safe:[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
        className,
      )}
    >
      <div
        ref={track}
        className={cn(
          'flex w-max',
          'motion-safe:will-change-transform motion-safe:[animation:marquee_var(--marquee-duration,40s)_linear_infinite]',
          'motion-reduce:w-full',
          direction === 'right' && 'motion-safe:[animation-direction:reverse]',
          pauseOnHover &&
            'group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]',
        )}
      >
        <div
          ref={copy}
          className={cn(copyClasses, 'motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:gap-y-3 motion-reduce:pr-0')}
        >
          {children}
        </div>
        <div className={cn(copyClasses, 'motion-reduce:hidden')} aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  )
}
