import { useCallback, useEffect, useRef, useState } from 'react'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    // Private mode, blocked cookies, or a value written by an older build.
    return fallback
  }
}

/**
 * `useState` backed by localStorage.
 *
 * Every access is guarded, so a browser with storage disabled degrades to
 * ordinary component state instead of throwing. The `storage` event keeps two
 * open tabs of the dashboard showing the same sidebar/theme/pref state.
 */
export function useLocalStorage<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial))

  // Latest-value refs, read only from effects and event handlers. The fallback
  // is consulted just when nothing is stored, so it does not need to be stable
  // across renders — which callers passing an inline object rely on.
  const initialRef = useRef(initial)
  const keyRef = useRef(key)
  useEffect(() => {
    initialRef.current = initial
  })

  useEffect(() => {
    if (keyRef.current === key) return
    keyRef.current = key
    setValue(read(key, initialRef.current))
  }, [key])

  const write = useCallback(
    (next: T) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Quota or private mode: the value still applies for this session.
      }
    },
    [key],
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return
      // A null key means the whole area was cleared.
      if (event.key !== null && event.key !== key) return
      setValue(read(key, initialRef.current))
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, write]
}
