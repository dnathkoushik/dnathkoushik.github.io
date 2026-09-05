import { useRef } from 'react'
import type { ComponentType, HTMLAttributes, ReactNode, RefAttributes } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro } from '@/motion/TextReveal'

export interface StaggerProps {
  /** Element for the container — pass 'ul' when the children are list items. */
  as?: keyof HTMLElementTagNameMap
  children: ReactNode
  /** Seconds between consecutive children. */
  stagger?: number
  /** Starting offset in px. */
  y?: number
  className?: string
}

/**
 * Reveals its direct children one after another when the container enters
 * the viewport. The container itself is the trigger, so a grid of cards moves
 * as one choreographed group rather than card-by-card as each scrolls in.
 */
export function Stagger({ as = 'div', children, stagger = 0.08, y = 24, className }: StaggerProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const items = Array.from(el.children)
        if (items.length === 0) return

        const entrance = gsap.from(items, {
          y,
          opacity: 0,
          duration: 1,
          ease: 'house',
          stagger,
          paused: true,
        })

        return armAfterIntro(entrance, { trigger: 'scroll', element: el, once: true, ctx })
      })
    },
    { scope: ref, dependencies: [stagger, y], revertOnUpdate: true },
  )

  const props: HTMLAttributes<HTMLElement> = {
    className,
  }

  // A typed JSX element rather than createElement(as, { ref, ... }): passing a
  // ref inside a props object to a function call is what the React hooks lint
  // flags as "reading a ref during render". JSX's ref prop is the sanctioned form.
  const Tag = as as unknown as ComponentType<HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>>
  return (
    <Tag ref={ref} {...props}>
      {children}
    </Tag>
  )
}
