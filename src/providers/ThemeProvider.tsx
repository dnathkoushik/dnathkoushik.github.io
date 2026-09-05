import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '@/config/app'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  /** What the user chose. */
  mode: ThemeMode
  /** What is actually on screen right now. */
  resolved: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
  /** Cycles light -> dark -> system. */
  cycle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const MEDIA = '(prefers-color-scheme: dark)'

function readStoredMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.theme)
    if (!raw) return 'system'
    const value = JSON.parse(raw) as unknown
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(MEDIA).matches
}

function applyTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle('dark', dark)
  // Keeps native form controls, scrollbars and the URL bar in the right palette.
  root.style.colorScheme = dark ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode)
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark)

  // Track the OS preference so "system" stays live rather than being sampled once.
  useEffect(() => {
    const mql = window.matchMedia(MEDIA)
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    applyTheme(resolved === 'dark')
  }, [resolved])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(next))
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). The theme
      // still applies for this session; it just will not be remembered.
    }
  }, [])

  const cycle = useCallback(() => {
    setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light')
  }, [mode, setMode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, setMode, cycle }),
    [mode, resolved, setMode, cycle],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
