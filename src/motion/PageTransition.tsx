import { startTransition, useContext, useEffect, useRef, useState } from 'react'
import type { ContextType, ReactNode } from 'react'
import { UNSAFE_RouteContext, useLocation, useNavigationType } from 'react-router-dom'
import { gsap, ScrollTrigger, useGSAP, motionOK } from '@/motion/gsap'
import { useLenis } from '@/motion/SmoothScrollProvider'

/**
 * Curtain wipe between public pages.
 *
 * Sequence on a pathname change (with motion on):
 *   1. cover   – a surface-coloured curtain rises from the bottom (0.45s) while
 *                the OUTGOING page stays exactly where it was;
 *   2. covered – scroll to the top, commit the incoming page (inside a React
 *                transition, so a lazy chunk finishes loading behind the curtain
 *                instead of flashing the route fallback);
 *   3. reveal  – ScrollTrigger is refreshed and the curtain leaves through the
 *                top (0.55s).
 *
 * Holding the outgoing page is the interesting part. `children` is normally
 * `<Outlet/>`, which renders whatever the router's RouteContext says — so
 * keeping the old *element* in state would still show the new page. Instead we
 * freeze the RouteContext value itself: the Outlet under our provider keeps
 * rendering the previous route until we say otherwise.
 *
 * Hooks for other components:
 *   window events  'pos:transition-start' | 'pos:transition-covered' | 'pos:transition-done'
 *   <html data-transition="covering|covered|revealing">   present only while a wipe is in flight
 *
 * Reduced motion: children swap immediately, nothing animates.
 * Hash-only changes and the very first render never transition.
 */

// eslint-disable-next-line react-refresh/only-export-components -- event names belong beside the component that fires them
export const TRANSITION_EVENTS = {
  start: 'pos:transition-start',
  covered: 'pos:transition-covered',
  done: 'pos:transition-done',
} as const

type Phase = 'idle' | 'covering' | 'covered' | 'revealing'
type RouteContextValue = ContextType<typeof UNSAFE_RouteContext>

/** Parked below the viewport, invisible. */
const CLIP_HIDDEN = 'inset(100% 0% 0% 0%)'
/** Fully covering. */
const CLIP_COVER = 'inset(0% 0% 0% 0%)'
/** Gone out through the top, invisible. */
const CLIP_LEFT = 'inset(0% 0% 100% 0%)'

function emit(name: string) {
  window.dispatchEvent(new CustomEvent(name))
}

export function PageTransition({ children }: { children: ReactNode }) {
  const live = useContext(UNSAFE_RouteContext)
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()
  const lenis = useLenis()

  const [shownPath, setShownPath] = useState(pathname)
  const navigating = shownPath !== pathname

  // Motion off: no curtain, so there is nothing to hide the swap behind.
  // Committing during render keeps it to a single paint.
  if (navigating && !motionOK()) {
    setShownPath(pathname)
  }

  // The RouteContext of the page that is on screen. While the curtain is down
  // the OLD route keeps rendering underneath it, so the settled value is held in
  // state and only re-synced when nothing is in flight. Adjusting it during
  // render (rather than in an effect) is React's documented pattern for state
  // derived from previous renders; it converges in one extra pass because the
  // context value is stable across this component's own re-renders.
  const [frozen, setFrozen] = useState<RouteContextValue>(live)
  if (!navigating && frozen !== live) setFrozen(live)
  const routeContext = navigating ? frozen : live

  const containerRef = useRef<HTMLDivElement>(null)
  const curtainRef = useRef<HTMLDivElement>(null)
  const phase = useRef<Phase>('idle')

  // Values the async steps need to read at the moment they run, not at the
  // moment they were scheduled.
  const latest = useRef({ pathname, hash, navigationType, lenis, shownPath })
  useEffect(() => {
    latest.current = { pathname, hash, navigationType, lenis, shownPath }
  })

  const api = useRef<{ cover: () => void; afterCommit: () => void } | null>(null)

  useGSAP(
    (_context, contextSafe) => {
      const curtain = curtainRef.current
      if (!curtain || !contextSafe) return

      gsap.set(curtain, { clipPath: CLIP_HIDDEN })

      const setDocState = (value: Phase) => {
        const root = document.documentElement
        if (value === 'idle') delete root.dataset.transition
        else root.dataset.transition = value
      }

      const reveal = contextSafe(() => {
        phase.current = 'revealing'
        setDocState('revealing')
        gsap.to(curtain, {
          clipPath: CLIP_LEFT,
          duration: 0.55,
          ease: 'house-in-out',
          overwrite: true,
          onComplete: () => {
            phase.current = 'idle'
            setDocState('idle')
            containerRef.current?.removeAttribute('aria-busy')
            gsap.set(curtain, { clipPath: CLIP_HIDDEN })
            emit(TRANSITION_EVENTS.done)
          },
        })
      })

      const onCovered = contextSafe(() => {
        phase.current = 'covered'
        setDocState('covered')
        const {
          pathname: target,
          hash: targetHash,
          navigationType: nav,
          lenis: scroller,
          shownPath: shown,
        } = latest.current

        // Back/forward keeps the browser's restored position; a hash lets the
        // anchor decide. Everything else starts the new page at the top.
        if (nav !== 'POP' && !targetHash) {
          if (scroller) scroller.scrollTo(0, { immediate: true, force: true })
          else window.scrollTo(0, 0)
        }
        emit(TRANSITION_EVENTS.covered)

        // The user came straight back to the page that is already showing:
        // there is nothing to commit, so lift the curtain.
        if (target === shown) {
          reveal()
          return
        }
        startTransition(() => setShownPath(target))
      })

      const cover = contextSafe(() => {
        phase.current = 'covering'
        setDocState('covering')
        emit(TRANSITION_EVENTS.start)
        containerRef.current?.setAttribute('aria-busy', 'true')

        // ScrollToTop (App.tsx) has just asked the window for a smooth scroll to
        // the top. An instant scroll to the current position aborts it, so the
        // outgoing page holds still under the rising curtain; we scroll for real
        // once it is covered.
        window.scrollTo(0, window.scrollY)

        gsap.to(curtain, {
          clipPath: CLIP_COVER,
          duration: 0.45,
          ease: 'house-in-out',
          overwrite: true,
          onComplete: onCovered,
        })
      })

      const afterCommit = contextSafe(() => {
        const { hash: targetHash, lenis: scroller } = latest.current
        if (targetHash) {
          const target = document.getElementById(decodeURIComponent(targetHash.slice(1)))
          if (target) {
            if (scroller) scroller.scrollTo(target, { immediate: true, force: true })
            else target.scrollIntoView({ block: 'start' })
          }
        }
        ScrollTrigger.refresh()
        reveal()
      })

      api.current = { cover, afterCommit }
      return () => {
        api.current = null
      }
    },
    { scope: containerRef },
  )

  // 1. The URL moved on while the old page is still showing: start covering.
  // Without a curtain to drive (no GSAP context yet, for whatever reason) the
  // page must still change hands — a navigation can never be left stranded.
  useEffect(() => {
    if (!navigating) return
    if (api.current) api.current.cover()
    else setShownPath(pathname)
  }, [navigating, pathname])

  // 2./3. The incoming page has committed under the curtain.
  useEffect(() => {
    if (phase.current !== 'covered') return
    api.current?.afterCommit()
  }, [shownPath])

  return (
    <>
      <div ref={containerRef} className="relative">
        <UNSAFE_RouteContext.Provider value={routeContext}>{children}</UNSAFE_RouteContext.Provider>
      </div>
      <div
        ref={curtainRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[90] bg-surface"
        style={{ clipPath: CLIP_HIDDEN }}
      />
    </>
  )
}
