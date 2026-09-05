import { useRef } from 'react'
import type { ReactNode } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'

export interface ParallaxProps {
  children: ReactNode
  /**
   * -1..1. Positive values lag behind the page (background-like, use for the
   * section numerals); negative values run ahead of it. 0.2 shifts ±8%.
   */
  speed?: number
  className?: string
}

/**
 * Scrubbed vertical drift across the element's whole journey through the
 * viewport. Desktop and motion-enabled only — on phones and under reduced
 * motion the children sit exactly where the layout puts them.
 *
 * The outer element is the ScrollTrigger reference and never moves, so
 * measurements stay honest while the inner element is translated.
 */
export function Parallax({ children, speed = 0.2, className }: ParallaxProps) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const trigger = outer.current
      const target = inner.current
      if (!trigger || !target) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion || !c.desktop) return

        const shift = gsap.utils.clamp(-1, 1, speed) * 40
        gsap.fromTo(
          target,
          { yPercent: -shift },
          {
            yPercent: shift,
            ease: 'none',
            scrollTrigger: { trigger, start: 'top bottom', end: 'bottom top', scrub: true },
          },
        )
      })
    },
    { scope: outer, dependencies: [speed], revertOnUpdate: true },
  )

  return (
    <div ref={outer} className={className}>
      <div ref={inner}>{children}</div>
    </div>
  )
}
