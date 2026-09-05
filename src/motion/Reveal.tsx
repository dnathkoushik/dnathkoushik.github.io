import { useRef } from 'react'
import type { ComponentType, HTMLAttributes, ReactNode, RefAttributes } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro } from '@/motion/TextReveal'
import type { RevealTrigger } from '@/motion/TextReveal'

export type RevealClip = 'up' | 'left' | 'none'

export interface RevealProps {
  as?: keyof HTMLElementTagNameMap
  children: ReactNode
  /** Seconds to wait before moving — use it to sequence body copy after a headline. */
  delay?: number
  /** Starting offset in px for the default fade-and-rise. */
  y?: number
  duration?: number
  /**
   * 'up' / 'left' swap the fade for a clip-path wipe plus a 1.08→1 settle on
   * the first child — the treatment for images and covers. 'none' (default)
   * is the plain rise.
   */
  clip?: RevealClip
  trigger?: RevealTrigger
  once?: boolean
  className?: string
}

const CLIP_HIDDEN: Record<Exclude<RevealClip, 'none'>, string> = {
  up: 'inset(100% 0% 0% 0%)',
  left: 'inset(0% 100% 0% 0%)',
}
const CLIP_SHOWN = 'inset(0% 0% 0% 0%)'

/**
 * Body-copy and media entrance. Renders its children in their final state and
 * animates *from* a hidden one, so a visitor with reduced motion (or without
 * JavaScript) sees the finished page immediately. With motion on, the hidden
 * state is applied at once and released after the intro curtain.
 */
export function Reveal({
  as = 'div',
  children,
  delay = 0,
  y = 24,
  duration = 1,
  clip = 'none',
  trigger = 'scroll',
  once = true,
  className,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        let entrance: gsap.core.Animation
        if (clip === 'none') {
          entrance = gsap.from(el, { y, opacity: 0, duration, delay, ease: 'house', paused: true })
        } else {
          const tl = gsap.timeline({
            paused: true,
            delay,
            // A resting clip-path would keep clipping shadows and focus rings.
            onComplete: () => gsap.set(el, { clearProps: 'clipPath' }),
          })
          tl.fromTo(
            el,
            { clipPath: CLIP_HIDDEN[clip] },
            { clipPath: CLIP_SHOWN, duration, ease: 'house-in-out' },
            0,
          )
          const cover = el.firstElementChild
          if (cover) {
            tl.from(cover, { scale: 1.08, duration: duration * 1.2, ease: 'house' }, 0)
          }
          entrance = tl
        }

        return armAfterIntro(entrance, { trigger, element: el, once, ctx })
      })
    },
    {
      scope: ref,
      dependencies: [delay, y, duration, clip, trigger, once],
      revertOnUpdate: true,
    },
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
