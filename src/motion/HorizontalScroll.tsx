import { useRef } from 'react'
import type { ReactNode } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface HorizontalScrollProps {
  /** The slides. Give each an explicit width (e.g. `w-[80vw] lg:w-[36rem]`); they never shrink. */
  children: ReactNode
  className?: string
}

/**
 * On desktop with motion, the section pins for as long as its track is wide
 * and vertical scrolling drives the track sideways — a cinematic row of
 * projects without a single horizontal wheel event.
 *
 * Everywhere else it is a native, scroll-snapping row with a hidden scrollbar
 * and a visible "Scroll →" hint. Both modes feed the same hairline progress
 * bar, so the layout never changes shape between them.
 */
export function HorizontalScroll({ children, className }: HorizontalScrollProps) {
  const root = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const section = root.current
      const rail = track.current
      const progress = bar.current
      if (!section || !rail) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions

        if (c.motion && c.desktop) {
          const distance = () => Math.max(0, rail.scrollWidth - section.clientWidth)
          const tl = gsap.timeline({
            defaults: { ease: 'none' },
            scrollTrigger: {
              trigger: section,
              pin: true,
              scrub: 1,
              start: 'top top',
              end: () => `+=${distance()}`,
              invalidateOnRefresh: true,
              anticipatePin: 1,
            },
          })
          tl.to(rail, { x: () => -distance() }, 0)
          if (progress) tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1 }, 0)
          return
        }

        // Native row: the bar follows the track's own scroll position.
        if (!progress) return
        const update = () => {
          const max = rail.scrollWidth - rail.clientWidth
          const ratio = max > 0 ? gsap.utils.clamp(0, 1, rail.scrollLeft / max) : 1
          progress.style.transform = `scaleX(${ratio.toFixed(4)})`
        }
        update()
        rail.addEventListener('scroll', update, { passive: true })
        return () => rail.removeEventListener('scroll', update)
      })
    },
    { scope: root },
  )

  return (
    <div
      ref={root}
      className={cn(
        'relative',
        'motion-safe:lg:flex motion-safe:lg:min-h-screen motion-safe:lg:flex-col motion-safe:lg:justify-center motion-safe:lg:overflow-x-clip',
        className,
      )}
    >
      <div
        ref={track}
        className={cn(
          'no-scrollbar flex snap-x snap-mandatory gap-8 overflow-x-auto px-6 scroll-px-6 sm:px-10 sm:scroll-px-10',
          '[&>*]:shrink-0 [&>*]:snap-start',
          'motion-safe:lg:w-max motion-safe:lg:snap-none motion-safe:lg:overflow-visible motion-safe:lg:will-change-transform',
        )}
      >
        {children}
      </div>

      <div className="mt-8 flex items-center gap-4 px-6 sm:px-10" aria-hidden="true">
        <div className="h-px flex-1 bg-line">
          <div
            ref={bar}
            className="h-full w-full bg-accent"
            style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
          />
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase motion-safe:lg:hidden">
          Scroll
          <Icon name="ArrowRight" size={12} />
        </span>
      </div>
    </div>
  )
}
