import { useMemo, useRef } from 'react'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro } from '@/motion/TextReveal'
import { cn } from '@/lib/cn'

export interface CounterProps {
  to: number
  from?: number
  /** Seconds for the full count. */
  duration?: number
  decimals?: number
  /** Rendered as plain siblings of the number, outside the mono span. */
  prefix?: string
  suffix?: string
  className?: string
}

/** Writes into React's own text node when possible so a later re-render still lands. */
function writeText(el: HTMLElement, value: string) {
  const node = el.firstChild
  if (node && node.nodeType === Node.TEXT_NODE && !node.nextSibling) {
    node.nodeValue = value
  } else {
    el.textContent = value
  }
}

/**
 * Counts up to `to` when it scrolls into view.
 *
 * The markup always contains the final, formatted value. With motion enabled
 * the effect rewinds the text to `from` and lets a ScrollTrigger drive it
 * upward; under reduced motion (or in a test DOM) that effect never runs and
 * the correct number is simply there.
 */
export function Counter({
  to,
  from = 0,
  duration = 1.6,
  decimals = 0,
  prefix,
  suffix,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
    [decimals],
  )

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const state = { value: from }
        writeText(el, formatter.format(from))

        const count = gsap.to(state, {
          value: to,
          duration,
          ease: 'power2.out',
          paused: true,
          onUpdate: () => writeText(el, formatter.format(state.value)),
        })
        const disarm = armAfterIntro(count, { trigger: 'scroll', element: el, once: true, ctx })

        return () => {
          disarm()
          writeText(el, formatter.format(to))
        }
      })
    },
    { scope: ref, dependencies: [to, from, duration, formatter], revertOnUpdate: true },
  )

  return (
    <span className={cn('inline-flex items-baseline', className)}>
      {prefix ? <span>{prefix}</span> : null}
      <span ref={ref} className="font-mono tabular-nums">
        {formatter.format(to)}
      </span>
      {suffix ? <span>{suffix}</span> : null}
    </span>
  )
}
