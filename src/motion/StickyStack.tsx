import { Children, isValidElement, useRef } from 'react'
import type { ReactNode } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { cn } from '@/lib/cn'

export interface StickyStackProps {
  /** An array of cards. Give each some height (min-h-[60vh] reads well) so the stack has room to play. */
  children: ReactNode
  className?: string
}

/** Matches the `top-24` sticky offset below. */
const TOP_OFFSET = 96

/**
 * Cards that stick in turn: each one pins near the top and the next slides
 * over it while the one beneath eases back (scale 0.94, opacity 0.6).
 *
 * Desktop with motion only. Everywhere else — phones, reduced motion — it is
 * an ordinary vertical stack with a 1.5rem gap, which the CSS alone provides;
 * the JavaScript adds nothing but the scrubbed settle.
 *
 * ScrollTrigger positions are computed from the un-stuck layout (container
 * top plus the heights above each card) rather than measured on the sticky
 * elements, so a refresh mid-scroll cannot be fooled by a card that is
 * currently pinned.
 */
export function StickyStack({ children, className }: StickyStackProps) {
  const ref = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion || !c.desktop) return

        const cards = Array.from(el.children).filter(
          (node): node is HTMLElement => node instanceof HTMLElement,
        )
        if (cards.length < 2) return

        const naturalTop = (index: number) => {
          const style = getComputedStyle(el)
          const gap = parseFloat(style.rowGap) || 0
          let y = el.getBoundingClientRect().top + window.scrollY + (parseFloat(style.paddingTop) || 0)
          for (let k = 0; k < index; k += 1) y += cards[k].offsetHeight + gap
          return y
        }

        cards.slice(0, -1).forEach((card, i) => {
          gsap.to(card, {
            scale: 0.94,
            opacity: 0.6,
            transformOrigin: 'center top',
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              // From the next card entering the viewport to it reaching the
              // sticky offset, where it fully covers this one.
              start: () => naturalTop(i + 1) - window.innerHeight,
              end: () => naturalTop(i + 1) - TOP_OFFSET,
              scrub: true,
              invalidateOnRefresh: true,
            },
          })
        })
      })
    },
    { scope: ref, dependencies: [items.length], revertOnUpdate: true },
  )

  return (
    <div ref={ref} className={cn('flex flex-col gap-6', className)}>
      {items.map((child, i) => (
        <div
          key={isValidElement(child) && child.key != null ? child.key : i}
          className="motion-safe:lg:sticky motion-safe:lg:top-24"
          style={{ zIndex: i + 1 }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}
