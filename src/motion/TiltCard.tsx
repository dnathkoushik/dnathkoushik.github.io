import { useRef } from 'react'
import type { ReactNode } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { cn } from '@/lib/cn'

export interface TiltCardProps {
  children: ReactNode
  /** Maximum rotation in degrees on either axis. */
  max?: number
  /** Show the accent sheen that follows the pointer. */
  glare?: boolean
  /** Applied to the outer wrapper — pass the card's radius here (e.g. `rounded-card`). */
  className?: string
}

const CONDITIONS = {
  ...MOTION_CONDITIONS,
  fine: '(hover: hover) and (pointer: fine)',
} as const

type Conditions = MotionConditions & { fine: boolean }

/* The glare is the one place a card is allowed both accents: a glow, not a fill. */
const GLARE_GRADIENT =
  'radial-gradient(circle at var(--tilt-x, 50%) var(--tilt-y, 50%), var(--color-accent) 0%, var(--color-accent-2) 28%, transparent 62%)'

/**
 * A card that tilts toward the pointer in 3D, lifts its content slightly and
 * carries a soft accent sheen under the cursor. Everything is a transform, so
 * it stays on the compositor.
 *
 * Inert on touch devices and under reduced motion — the child card keeps its
 * own border and hover styles, which is what marks it as interactive.
 */
export function TiltCard({ children, max = 8, glare = true, className }: TiltCardProps) {
  const outer = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const sheen = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const wrap = outer.current
      const el = card.current
      const inner = content.current
      if (!wrap || !el || !inner) return

      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, (ctx) => {
        const c = ctx.conditions as Conditions
        if (!c.motion || !c.fine) return

        const highlight = sheen.current
        const rxTo = gsap.quickTo(el, 'rotationX', { duration: 0.7, ease: 'power3' })
        const ryTo = gsap.quickTo(el, 'rotationY', { duration: 0.7, ease: 'power3' })
        const zTo = gsap.quickTo(inner, 'z', { duration: 0.7, ease: 'power3' })
        const glareTo = highlight
          ? gsap.quickTo(highlight, 'opacity', { duration: 0.5, ease: 'power2' })
          : null

        const onEnter = (event: PointerEvent) => {
          if (event.pointerType === 'touch') return
          zTo(12)
          if (glareTo) {
            const dark = document.documentElement.classList.contains('dark')
            glareTo(dark ? 0.18 : 0.28)
          }
        }

        const onMove = (event: PointerEvent) => {
          if (event.pointerType === 'touch') return
          const rect = wrap.getBoundingClientRect()
          if (!rect.width || !rect.height) return
          const px = (event.clientX - rect.left) / rect.width
          const py = (event.clientY - rect.top) / rect.height
          // The corner under the pointer lifts toward the viewer.
          rxTo((py - 0.5) * 2 * max)
          ryTo((0.5 - px) * 2 * max)
          if (highlight) {
            highlight.style.setProperty('--tilt-x', `${(px * 100).toFixed(1)}%`)
            highlight.style.setProperty('--tilt-y', `${(py * 100).toFixed(1)}%`)
          }
        }

        const onLeave = () => {
          rxTo(0)
          ryTo(0)
          zTo(0)
          glareTo?.(0)
        }

        wrap.addEventListener('pointerenter', onEnter)
        wrap.addEventListener('pointermove', onMove)
        wrap.addEventListener('pointerleave', onLeave)

        return () => {
          wrap.removeEventListener('pointerenter', onEnter)
          wrap.removeEventListener('pointermove', onMove)
          wrap.removeEventListener('pointerleave', onLeave)
        }
      })
    },
    { scope: outer, dependencies: [max, glare], revertOnUpdate: true },
  )

  return (
    <div ref={outer} className={cn('relative', className)} style={{ perspective: '900px' }}>
      <div
        ref={card}
        className="relative h-full rounded-[inherit]"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div ref={content} className="relative h-full rounded-[inherit]">
          {children}
          {glare ? (
            <div
              ref={sheen}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0"
              style={{ backgroundImage: GLARE_GRADIENT }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
