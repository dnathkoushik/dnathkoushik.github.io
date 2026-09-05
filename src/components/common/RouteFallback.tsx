import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'

/** Below this, the chunk almost always arrives before anything is painted. */
const REVEAL_DELAY_MS = 150

/**
 * Suspense fallback for lazily loaded routes.
 *
 * Deliberately blank for the first moment: on a warm cache a route resolves in
 * a handful of milliseconds, and a spinner that appears and vanishes reads as a
 * glitch. The live region is mounted from the start so assistive technology is
 * told about the wait even when nothing is drawn yet.
 */
export function RouteFallback() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), REVEAL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[100svh] w-full flex-col items-center justify-center gap-4 bg-canvas px-6 py-24"
    >
      <span className="sr-only">Loading page</span>
      {visible ? (
        <div className="flex w-full max-w-xs flex-col items-center gap-5 animate-fade-in">
          <LoaderCircle
            className="size-5 animate-spin text-ink-faint motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div className="w-full space-y-2.5" aria-hidden="true">
            <div className="skeleton h-2.5 w-1/2" />
            <div className="skeleton h-2.5 w-full" />
            <div className="skeleton h-2.5 w-4/5" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
