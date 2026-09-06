import { useEffect, useRef, useState } from 'react'
import { profile } from '@/data'
import { gsap, SplitText, useGSAP, motionOK } from '@/motion/gsap'
import { useLenis } from '@/motion/SmoothScrollProvider'

/**
 * The opening curtain. Once per browser session: the name rises in character by
 * character, a counter runs to 100 and a hairline crosses the foot of the
 * screen; then the whole overlay wipes upward and unmounts itself.
 *
 * Coordination with the hero:
 *  - `window` receives a `pos:intro-done` CustomEvent when the curtain has left,
 *    and ALSO (on the next tick) when the intro is skipped, so nothing waits on it
 *    forever.
 *  - `document.documentElement.dataset.intro === 'done'` is set at the same
 *    moment, for components that mount after the event has already fired.
 *
 * Skipped entirely under reduced motion and on every visit after the first in a
 * session (sessionStorage 'pos.intro').
 */

export const INTRO_DONE_EVENT = 'pos:intro-done'
const SESSION_KEY = 'pos.intro'

function alreadySeen(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_KEY) !== null
  } catch {
    return false
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Storage blocked: the intro may replay next load, which is harmless.
  }
}

function announceDone() {
  document.documentElement.dataset.intro = 'done'
  window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT))
}

export function Preloader() {
  const [visible, setVisible] = useState<boolean>(
    () => typeof window !== 'undefined' && motionOK() && !alreadySeen(),
  )
  const lenis = useLenis()
  const rootRef = useRef<HTMLDivElement>(null)
  const nameRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  // Mark the session at mount (not at the end) so a route change mid-intro can
  // never replay it. When the intro is skipped, announce that straight away —
  // deferred a tick so that listeners registered by sibling mount effects (which
  // run after ours in tree order) still hear it. When it plays, the timeline
  // announces instead, just before the curtain has fully left.
  const skipped = useRef(!visible)
  useEffect(() => {
    if (typeof window === 'undefined') return
    markSeen()
    if (!skipped.current) return
    const timer = window.setTimeout(announceDone, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Lock scrolling while the overlay is up. Lenis has its own stop/start that
  // also freezes wheel inertia; the body class is the plain-scroll fallback.
  useEffect(() => {
    if (!visible || typeof document === 'undefined') return
    if (lenis) {
      lenis.stop()
      return () => lenis.start()
    }
    document.body.classList.add('overflow-hidden')
    return () => document.body.classList.remove('overflow-hidden')
  }, [visible, lenis])

  useGSAP(
    () => {
      const root = rootRef.current
      const name = nameRef.current
      const counter = counterRef.current
      const line = lineRef.current
      if (!root || !name || !counter || !line) return

      let split: SplitText | null = null
      try {
        split = SplitText.create(name, { type: 'chars', mask: 'chars', aria: 'none' })
      } catch {
        split = null
      }
      const pieces: Element[] = split && split.chars.length > 0 ? split.chars : [name]

      const progress = { value: 0 }
      const tl = gsap.timeline({
        defaults: { ease: 'house' },
        onComplete: () => setVisible(false),
      })

      tl.from(pieces, { yPercent: 110, duration: 1, stagger: 0.03 }, 0)
        .fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.55, ease: 'house-in-out' }, 0)
        .to(
          progress,
          {
            value: 100,
            duration: 1.45,
            ease: 'power2.inOut',
            onUpdate: () => {
              counter.textContent = String(Math.round(progress.value)).padStart(3, '0')
            },
          },
          0.05,
        )
        .to([counter, line], { autoAlpha: 0, duration: 0.3, ease: 'power2.out' }, 1.55)
        .to(name, { yPercent: -35, duration: 0.7, ease: 'house-in-out' }, 1.6)
        .to(root, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'house-in-out' }, 1.6)
        // Let the hero begin while the last third of the screen is still being
        // uncovered, so its entrance overlaps the curtain instead of waiting on it.
        .call(announceDone, [], 2.05)

      return () => {
        split?.revert()
      }
    },
    { scope: rootRef },
  )

  if (!visible) return null

  return (
    <div
      ref={rootRef}
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas text-ink"
      style={{ clipPath: 'inset(0% 0% 0% 0%)' }}
    >
      <div
        ref={nameRef}
        aria-hidden="true"
        className="font-display px-6 text-center text-[clamp(2.5rem,9vw,7rem)] leading-[1.05] font-semibold"
      >
        {profile.name}
      </div>

      <span
        ref={counterRef}
        aria-hidden="true"
        className="absolute right-6 bottom-6 font-mono text-xs tracking-[0.18em] text-ink tabular-nums sm:right-10 sm:bottom-8"
      >
        000
      </span>

      <div
        ref={lineRef}
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-accent"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  )
}
