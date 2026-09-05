import type { ReactNode } from 'react'
import type { Tone } from '@/types/ui'
import { cn } from '@/lib/cn'

/**
 * A circular progress indicator. `value` is a percentage and is clamped to
 * 0–100, so a caller that computes 4/3 completed tasks still draws a full ring
 * rather than winding past the start.
 *
 * `children` renders in the middle — usually the percentage in tabular-nums.
 */

const TONE_STROKE: Record<Tone, string> = {
  neutral: 'stroke-ink-faint',
  accent: 'stroke-accent',
  positive: 'stroke-positive',
  warning: 'stroke-warning',
  danger: 'stroke-danger',
  info: 'stroke-info',
}

export interface ProgressRingProps {
  /** Percentage, 0–100. Values outside the range are clamped. */
  value: number
  /** Outer diameter in pixels. */
  size?: number
  /** Stroke width in pixels. */
  thickness?: number
  tone?: Tone
  /** Accessible name, e.g. "Tasks completed today". */
  label?: string
  children?: ReactNode
  className?: string
}

export function ProgressRing({
  value,
  size = 64,
  thickness = 6,
  tone = 'accent',
  label,
  children,
  className,
}: ProgressRingProps) {
  const safeThickness = Math.max(1, Math.min(thickness, size / 2 - 1))
  const radius = Math.max(1, (size - safeThickness) / 2)
  const circumference = 2 * Math.PI * radius

  const percent = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))
  const rounded = Math.round(percent)
  const dashOffset = circumference * (1 - percent / 100)

  return (
    <div
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${rounded}%`}
      aria-label={label ?? 'Progress'}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={safeThickness}
          className="stroke-surface-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={safeThickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(
            'transition-[stroke-dashoffset] duration-300 ease-out',
            TONE_STROKE[tone],
          )}
        />
      </svg>

      {children ? (
        <span className="absolute inset-0 flex items-center justify-center text-center leading-none">
          {children}
        </span>
      ) : null}
    </div>
  )
}
