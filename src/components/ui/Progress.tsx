import { useId } from 'react'
import type { Tone } from '@/types/ui'
import { cn } from '@/lib/cn'

/**
 * A linear progress bar. `value` is measured against `max` (default 100) and
 * always clamped into 0–100 %, including the max=0 case that would otherwise
 * divide by zero — an empty checklist reads as 0 %, not NaN.
 */

const TONE_FILL: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  accent: 'bg-accent',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

const SIZE_CLASS = {
  sm: 'h-1.5',
  md: 'h-2.5',
} as const

export interface ProgressProps {
  value: number
  max?: number
  tone?: Tone
  size?: 'sm' | 'md'
  /** Visible label; also becomes the accessible name of the bar. */
  label?: string
  showValue?: boolean
  className?: string
}

export function Progress({
  value,
  max = 100,
  tone = 'accent',
  size = 'sm',
  label,
  showValue = false,
  className,
}: ProgressProps) {
  const labelId = `progress-label-${useId()}`
  const ratio = max > 0 ? value / max : 0
  const percent = Math.min(100, Math.max(0, Number.isFinite(ratio) ? ratio * 100 : 0))
  const rounded = Math.round(percent)

  return (
    <div className={cn('w-full', className)}>
      {label || showValue ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label ? (
            <span id={labelId} className="truncate text-xs font-medium text-ink-muted">
              {label}
            </span>
          ) : (
            <span />
          )}
          {showValue ? (
            <span className="font-mono text-xs tabular-nums text-ink-faint">{rounded}%</span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${rounded}%`}
        aria-label={label ? undefined : 'Progress'}
        aria-labelledby={label ? labelId : undefined}
        className={cn('w-full overflow-hidden rounded-full bg-surface-muted', SIZE_CLASS[size])}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', TONE_FILL[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
