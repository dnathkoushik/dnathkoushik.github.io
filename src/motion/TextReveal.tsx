import { useRef } from 'react'
import type { ComponentType, HTMLAttributes, ReactNode } from 'react'
import { gsap, ScrollTrigger, SplitText, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { INTRO_DONE_EVENT } from '@/motion/Preloader'

export type TextRevealType = 'lines' | 'words' | 'chars'
export type RevealTrigger = 'scroll' | 'mount'

type Tween = ReturnType<typeof gsap.from>

/* -------------------------------------------------------------------------- *
 * Intro coordination — shared by every entrance primitive.
 *
 * The Preloader curtain covers the page for ~2.3s on a first visit. An entrance
 * that played at mount would finish behind it, and one that merely waited would
 * flash its final state during the wipe. So entrances are BUILT paused (their
 * hidden start state applies at once — the curtain lifts on an empty stage) and
 * RELEASED when the intro announces it has gone.
 * -------------------------------------------------------------------------- */

/** Longest anything waits for an intro that may never be mounted. */
const INTRO_MAX_WAIT = 3000

/**
 * Calls `callback` once the Preloader has left: immediately if it already has
 * (or was skipped), otherwise on its `pos:intro-done` event, with a safety
 * timeout so a page without a Preloader still animates. Returns a cancel.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared by every primitive; splitting it out buys nothing but a file
export function onIntroDone(callback: () => void, maxWait = INTRO_MAX_WAIT): () => void {
  if (typeof window === 'undefined') return () => {}
  if (document.documentElement.dataset.intro === 'done') {
    callback()
    return () => {}
  }

  let settled = false
  let timer = 0
  const stop = () => {
    settled = true
    window.clearTimeout(timer)
    window.removeEventListener(INTRO_DONE_EVENT, fire)
  }
  function fire() {
    if (settled) return
    stop()
    callback()
  }
  timer = window.setTimeout(fire, maxWait)
  window.addEventListener(INTRO_DONE_EVENT, fire)
  return stop
}

export interface ArmOptions {
  trigger: RevealTrigger
  /** The element whose position drives a 'scroll' trigger. */
  element: Element
  /** Play once and kill the trigger, or reset and replay on re-entry. */
  once: boolean
  /** The gsap context (matchMedia / useGSAP) that must own the ScrollTrigger. */
  ctx: gsap.Context
}

/**
 * Releases a paused entrance after the intro: `play()` for `trigger: 'mount'`,
 * or a ScrollTrigger at 'top 85%' for `'scroll'`. Returns a cancel.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function armAfterIntro(
  animation: gsap.core.Animation,
  { trigger, element, once, ctx }: ArmOptions,
): () => void {
  return onIntroDone(() => {
    if (trigger === 'mount') {
      animation.play()
      return
    }
    // Runs asynchronously, so it must be added to the context by hand to be
    // reverted with it.
    ctx.add(() => {
      ScrollTrigger.create({
        trigger: element,
        start: 'top 85%',
        once,
        animation,
        toggleActions: once ? 'play none none none' : 'play none none reset',
      })
    })
  })
}

/* -------------------------------------------------------------------------- *
 * TextReveal
 * -------------------------------------------------------------------------- */

export interface TextRevealProps {
  /** Element to render. Headlines must pass their real heading level. */
  as?: keyof HTMLElementTagNameMap
  /** A plain string, or inline JSX (a `<span className="text-gradient">`, a `<br />`). */
  children: ReactNode
  /** Which pieces move. Lines are always the mask, whatever moves inside them. */
  type?: TextRevealType
  /** Seconds between pieces. Defaults per type: lines 0.08, words 0.04, chars 0.015. */
  stagger?: number
  /** Seconds to wait before the first piece moves. */
  delay?: number
  /** 'scroll' plays when the element reaches 85% of the viewport; 'mount' plays once the intro has gone. */
  trigger?: RevealTrigger
  /** With `trigger="scroll"`: play once (default) or reset and replay on every re-entry. */
  once?: boolean
  className?: string
  /** Forwarded so a heading can be the target of `aria-labelledby`. */
  id?: string
}

const DEFAULT_STAGGER: Record<TextRevealType, number> = {
  lines: 0.08,
  words: 0.04,
  chars: 0.015,
}

/**
 * The house headline entrance: SplitText lines behind a mask, each line sliding
 * up from 110% with the house ease.
 *
 * The markup always contains the real text — the split happens after the fonts
 * have loaded (so line breaks are final) and `autoSplit` re-splits on resize,
 * carrying the animation's progress across. Under reduced motion nothing is
 * split and the text simply renders.
 *
 * Accessibility: SplitText's `aria: 'auto'` labels the container with its own
 * text and hides the fragments, so a screen reader hears one heading, not a
 * hundred characters. (Its `'hidden'` setting would hide the container itself,
 * which is why it is not used here.)
 */
export function TextReveal({
  as = 'div',
  children,
  type = 'lines',
  stagger,
  delay = 0,
  trigger = 'scroll',
  once = true,
  className,
  id,
}: TextRevealProps) {
  const ref = useRef<HTMLElement>(null)
  const isString = typeof children === 'string'
  const eachStagger = stagger ?? DEFAULT_STAGGER[type]

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        let cancelled = false
        let introDone = false
        let pending: Tween | undefined
        let split: SplitText | undefined

        const release = (tween: Tween) => {
          if (trigger === 'mount') {
            tween.play()
            return
          }
          ctx.add(() => {
            ScrollTrigger.create({
              trigger: el,
              start: 'top 85%',
              once,
              animation: tween,
              toggleActions: once ? 'play none none none' : 'play none none reset',
            })
          })
        }

        const build = () => {
          if (cancelled) return
          // `ctx.add` executes inside this context, so the SplitText instance
          // and its tween are reverted with it even though this runs after the
          // fonts promise, outside the synchronous callback.
          ctx.add(() => {
            split = SplitText.create(el, {
              type: type === 'lines' ? 'lines' : `lines,${type}`,
              mask: 'lines',
              autoSplit: true,
              linesClass: 'line',
              // 'none': accessibility is handled in the render below (an sr-only
              // twin of the text), because aria-label — which 'auto' would add — is
              // prohibited on generic elements like <p> and <span>.
              aria: 'none',
              onSplit: (self) => {
                // Room for descenders inside the clipping mask.
                self.masks.forEach((mask) => mask.classList.add('mask-lines'))
                // Paused: the hidden start state is applied right away.
                const tween = gsap.from(self[type], {
                  yPercent: 110,
                  opacity: type === 'lines' ? 1 : 0,
                  duration: 1.1,
                  ease: 'house',
                  stagger: eachStagger,
                  delay,
                  paused: true,
                })
                if (introDone) release(tween)
                else pending = tween
                return tween
              },
            })
          })
        }

        // Splitting before the display font arrives measures the fallback font
        // and produces wrong line breaks; autoSplit only fixes widths later.
        const fonts: FontFaceSet | undefined =
          typeof document !== 'undefined' ? document.fonts : undefined
        if (fonts && fonts.ready) {
          fonts.ready.then(build, build)
        } else {
          build()
        }

        const disarm = onIntroDone(() => {
          introDone = true
          if (pending) {
            release(pending)
            pending = undefined
          }
        })

        return () => {
          cancelled = true
          disarm()
          split?.revert()
        }
      })
    },
    {
      scope: ref,
      dependencies: [type, eachStagger, delay, trigger, once, isString],
      revertOnUpdate: true,
    },
  )

  const props: HTMLAttributes<HTMLElement> = { id, className }

  // A typed JSX element rather than createElement(as, { ref, ... }): passing a
  // ref inside a props object to a function call is what the React hooks lint
  // flags as "reading a ref during render". JSX's ref prop is the sanctioned form.
  const Tag = as as unknown as ComponentType<HTMLAttributes<HTMLElement>>
  const inner = as === 'span' ? 'inline-block' : 'block'

  // The heading/paragraph itself stays a normal, readable element for assistive
  // tech. SplitText only ever touches the INNER span: when the text is a plain
  // string that span is aria-hidden and a visually-hidden twin carries the words
  // in reading order, so a screen reader never meets per-character fragments.
  // JSX children cannot be duplicated safely, so they stay readable as-is.
  return (
    <Tag {...props}>
      {isString ? <span className="sr-only">{children}</span> : null}
      <span ref={ref} aria-hidden={isString ? true : undefined} className={inner}>
        {children}
      </span>
    </Tag>
  )
}
