import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Restores a sane scroll position on navigation.
 *
 * Three cases, in order:
 *  - the URL carries a hash  -> bring that element into view (it may belong to
 *    a lazily loaded route, so we retry for a few frames);
 *  - back/forward ('POP')    -> leave it alone, the browser already restored
 *    where the reader was;
 *  - anything else           -> top of the page.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth'

    if (hash) {
      const id = decodeURIComponent(hash.slice(1))
      let frame = 0
      let attempts = 0

      const tryScroll = () => {
        const target = document.getElementById(id)
        if (target) {
          target.scrollIntoView({ behavior, block: 'start' })
          return
        }
        attempts += 1
        if (attempts < 6) frame = requestAnimationFrame(tryScroll)
      }

      frame = requestAnimationFrame(tryScroll)
      return () => cancelAnimationFrame(frame)
    }

    if (navigationType === 'POP') return

    window.scrollTo({ top: 0, left: 0, behavior })
  }, [pathname, hash, key, navigationType])

  return null
}
