import { useCallback, useSyncExternalStore } from 'react'

function supported(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

/**
 * Subscribes to a media query.
 *
 * Built on `useSyncExternalStore` so the first render already reflects the real
 * viewport — no post-mount correction, which is what causes layout to flicker
 * between the mobile and desktop shells. Safe where `window` does not exist
 * (tests, any future prerender): it reports `false`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(
    () => (supported() ? window.matchMedia(query).matches : false),
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
