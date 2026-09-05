import { useEffect, useState } from 'react'

/**
 * Trails `value` by `ms` of quiet time. Used to keep search and filter inputs
 * responsive while the work they trigger runs at most once per pause.
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), Math.max(0, ms))
    return () => window.clearTimeout(timer)
  }, [value, ms])

  return debounced
}
