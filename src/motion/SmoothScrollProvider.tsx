import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Lenis from 'lenis'
import { useLocation, useNavigationType } from 'react-router-dom'
import { gsap, ScrollTrigger, motionOK } from '@/motion/gsap'

/**
 * Smooth scrolling for the public site.
 *
 * Lenis owns the wheel; GSAP's ticker owns the clock. Driving Lenis from
 * `gsap.ticker` (instead of its own requestAnimationFrame) means every scrubbed
 * ScrollTrigger and every Lenis frame land in the same tick, which is what stops
 * pinned sections from stuttering a frame behind the scroll.
 *
 * Under reduced motion nothing here is created: the page scrolls natively,
 * `useLenis()` returns null, and children render exactly as they are.
 *
 * Nesting: mount this OUTSIDE `<PageTransition>` (it is in PublicLayout, above
 * `<main>`). PageTransition flags the document while it is choreographing a
 * navigation, and this provider reads that flag to stay out of its way.
 */

const LenisContext = createContext<Lenis | null>(null)

/** The live Lenis instance, or null under reduced motion / before it mounts. */
// eslint-disable-next-line react-refresh/only-export-components -- the hook has to live beside the provider that owns its context
export function useLenis(): Lenis | null {
  return useContext(LenisContext)
}

const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(motionOK)
  const [lenis, setLenis] = useState<Lenis | null>(null)
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  // The preference can flip while the page is open; tear Lenis down or bring it
  // up accordingly instead of sampling once at mount.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(REDUCE_QUERY)
    if (typeof query.addEventListener !== 'function') return
    const onChange = () => setEnabled(motionOK())
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let instance: Lenis
    try {
      instance = new Lenis({
        lerp: 0.09,
        wheelMultiplier: 1,
        smoothWheel: true,
        syncTouch: false,
        autoRaf: false,
      })
    } catch {
      // No scroll container to speak of (jsdom, an exotic embed): native scroll it is.
      return
    }

    const root = document.documentElement
    root.classList.add('lenis')

    const unsubscribe = instance.on('scroll', () => ScrollTrigger.update())
    const tick = (time: number) => instance.raf(time * 1000)
    gsap.ticker.add(tick)
    // Lenis can only be constructed once the DOM exists, so publishing the
    // instance to context from this effect is the one honest way to expose it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(instance)

    return () => {
      gsap.ticker.remove(tick)
      unsubscribe()
      try {
        instance.destroy()
      } catch {
        // Already torn down by a lost document; nothing left to release.
      }
      root.classList.remove('lenis')
      setLenis(null)
    }
  }, [enabled])

  // SplitText decides line breaks from the metrics of whichever font is on
  // screen; once the real faces arrive every trigger position has moved.
  useEffect(() => {
    if (typeof document === 'undefined') return
    const fonts: FontFaceSet | undefined = document.fonts
    if (!fonts) return
    let cancelled = false
    fonts.ready
      .then(() => {
        if (!cancelled) ScrollTrigger.refresh()
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  // Route changes. Only the pathname should re-run this: a hash-only change has
  // to leave the anchor alone, and back/forward keeps the browser's own position.
  const latest = useRef({ hash, navigationType, lenis })
  useEffect(() => {
    latest.current = { hash, navigationType, lenis }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    // A PageTransition is running this navigation: it scrolls to the top while
    // the curtain covers the page and refreshes ScrollTrigger once the new page
    // has committed. Jumping here would move the outgoing page in plain sight.
    if (document.documentElement.dataset.transition) return

    const current = latest.current
    if (current.navigationType !== 'POP' && !current.hash) {
      if (current.lenis) current.lenis.scrollTo(0, { immediate: true, force: true })
      else window.scrollTo(0, 0)
    }

    // Refresh once the new page has painted (not in this tick, when its layout
    // is still settling). setTimeout is the frame-safe fallback for runtimes
    // that have no animation frame.
    if (typeof window.requestAnimationFrame === 'function') {
      const frame = window.requestAnimationFrame(() => ScrollTrigger.refresh())
      return () => window.cancelAnimationFrame(frame)
    }
    const timer = window.setTimeout(() => ScrollTrigger.refresh(), 16)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}
