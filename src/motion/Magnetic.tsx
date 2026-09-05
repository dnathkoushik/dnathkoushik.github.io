import { Children, useRef } from 'react'
import type { ReactElement } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { cn } from '@/lib/cn'

export interface MagneticProps {
  /** Exactly one element — the button or link that should follow the pointer. */
  children: ReactElement
  /** How far toward the pointer the element travels, as a fraction of the offset. */
  strength?: number
  className?: string
}

type Tween = ReturnType<typeof gsap.to>

const CONDITIONS = {
  ...MOTION_CONDITIONS,
  fine: '(hover: hover) and (pointer: fine)',
} as const

type Conditions = MotionConditions & { fine: boolean }

/**
 * Pulls its single child toward the pointer while hovered and snaps it back
 * with a short elastic settle on leave — the one place on the site elastic
 * easing is used, because this is a button, not type.
 *
 * Does nothing on touch devices or under reduced motion: the child is rendered
 * untouched inside an inline-block wrapper, so it keeps its own affordances.
 */
export function Magnetic({ children, strength = 0.35, className }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const child = Children.only(children)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, (ctx) => {
        const c = ctx.conditions as Conditions
        if (!c.motion || !c.fine) return

        const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' })
        const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' })
        let release: Tween | undefined

        const onMove = (event: PointerEvent) => {
          if (event.pointerType === 'touch') return
          release?.kill()
          release = undefined
          const rect = el.getBoundingClientRect()
          const dx = event.clientX - (rect.left + rect.width / 2)
          const dy = event.clientY - (rect.top + rect.height / 2)
          // Starting from the element's actual position keeps the hand-off from
          // an interrupted release tween seamless.
          xTo(dx * strength, Number(gsap.getProperty(el, 'x')) || 0)
          yTo(dy * strength, Number(gsap.getProperty(el, 'y')) || 0)
        }

        const onLeave = () => {
          xTo.tween.pause()
          yTo.tween.pause()
          release?.kill()
          release = gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' })
        }

        el.addEventListener('pointermove', onMove)
        el.addEventListener('pointerleave', onLeave)

        return () => {
          el.removeEventListener('pointermove', onMove)
          el.removeEventListener('pointerleave', onLeave)
          release?.kill()
          gsap.set(el, { clearProps: 'transform' })
        }
      })
    },
    { scope: ref, dependencies: [strength], revertOnUpdate: true },
  )

  return (
    <span ref={ref} data-magnetic="" className={cn('inline-block', className)}>
      {child}
    </span>
  )
}
