import { useRef } from 'react'
import type { ComponentType, HTMLAttributes, RefAttributes } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro } from '@/motion/TextReveal'

export interface ScrambleTextProps {
  text: string
  as?: keyof HTMLElementTagNameMap
  /** When to run: after the intro on mount, on scrolling into view, or each time the pointer enters. */
  trigger?: 'mount' | 'scroll' | 'hover'
  /** Seconds for the resolve. */
  duration?: number
  className?: string
}

type Tween = ReturnType<typeof gsap.to>

const CONDITIONS = {
  ...MOTION_CONDITIONS,
  fine: '(hover: hover) and (pointer: fine)',
} as const

type Conditions = MotionConditions & { fine: boolean }

/**
 * Resolves `text` out of a scramble of random letters. Best on mono labels,
 * where the churn does not reflow the line.
 *
 * The element's content is always the real text, and `aria-label` pins the
 * accessible name while the letters churn. Under reduced motion nothing runs;
 * on touch devices the hover trigger is not bound at all.
 */
export function ScrambleText({
  text,
  as = 'span',
  trigger = 'scroll',
  duration = 1.2,
  className,
}: ScrambleTextProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(CONDITIONS, (ctx) => {
        const c = ctx.conditions as Conditions
        if (!c.motion) return

        const vars = {
          duration,
          ease: 'none',
          scrambleText: { text, chars: 'upperAndLowerCase', speed: 0.6, revealDelay: 0.2 },
        }

        // The plugin rewrites innerHTML, so keep the DOM authoritative here.
        el.textContent = text

        if (trigger === 'hover') {
          if (!c.fine) return
          let tween: Tween | undefined
          const onEnter = (event: PointerEvent) => {
            if (event.pointerType === 'touch') return
            tween?.kill()
            tween = gsap.to(el, vars)
          }
          el.addEventListener('pointerenter', onEnter)
          return () => {
            el.removeEventListener('pointerenter', onEnter)
            tween?.kill()
            el.textContent = text
          }
        }

        const resolve = gsap.to(el, { ...vars, paused: true })
        const disarm = armAfterIntro(resolve, { trigger, element: el, once: true, ctx })

        return () => {
          disarm()
          el.textContent = text
        }
      })
    },
    { scope: ref, dependencies: [text, trigger, duration], revertOnUpdate: true },
  )

  const props: HTMLAttributes<HTMLElement> = {
    className,
    'aria-label': text,
  }

  // A typed JSX element rather than createElement(as, { ref, ... }): passing a
  // ref inside a props object to a function call is what the React hooks lint
  // flags as "reading a ref during render". JSX's ref prop is the sanctioned form.
  const Tag = as as unknown as ComponentType<HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>>
  return (
    <Tag ref={ref} {...props}>
      {text}
    </Tag>
  )
}
