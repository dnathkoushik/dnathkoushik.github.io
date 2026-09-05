import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '@/providers/ThemeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { cn } from '@/lib/cn'

/** light -> dark -> system -> light. Mirrors `cycle()` in ThemeProvider. */
const NEXT_MODE: Record<ThemeMode, ThemeMode> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const MODE_LABEL: Record<ThemeMode, string> = {
  light: 'light',
  dark: 'dark',
  system: 'system',
}

const ICON_BASE = 'absolute inset-0 size-4 transition-all duration-150 ease-out'
const ICON_SHOWN = 'scale-100 rotate-0 opacity-100'
const ICON_HIDDEN = '-rotate-45 scale-75 opacity-0'

/**
 * One button for the whole theme story: it shows the mode you are in and its
 * label names the mode you would move to, which is the only wording that stays
 * truthful in a three-state cycle.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, resolved, cycle } = useTheme()
  const next = NEXT_MODE[mode]

  return (
    <>
      <button
        type="button"
        onClick={cycle}
        aria-label={`Switch to ${MODE_LABEL[next]} theme`}
        title={`Switch to ${MODE_LABEL[next]} theme`}
        className={cn(
          'relative inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors',
          'hover:bg-surface-hover hover:text-ink sm:size-9',
          className,
        )}
      >
        <span className="relative block size-4">
          <Sun
            className={cn(ICON_BASE, mode === 'light' ? ICON_SHOWN : ICON_HIDDEN)}
            aria-hidden="true"
          />
          <Moon
            className={cn(ICON_BASE, mode === 'dark' ? ICON_SHOWN : ICON_HIDDEN)}
            aria-hidden="true"
          />
          <Monitor
            className={cn(ICON_BASE, mode === 'system' ? ICON_SHOWN : ICON_HIDDEN)}
            aria-hidden="true"
          />
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {mode === 'system'
          ? `Theme: follows your system setting, currently ${resolved}`
          : `Theme: ${MODE_LABEL[mode]}`}
      </span>
    </>
  )
}
