import type { HTMLAttributes, ReactNode } from 'react'
import type { Tone } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/*
 * Foreground colours are mixed 65% toward the tone and 35% toward `--color-ink`
 * rather than used raw.
 *
 * The raw tokens are tuned to read as *fills* against a card, not as text on a
 * tinted chip: `--color-warning` on `--color-warning-soft` lands around 2.4:1,
 * which is unreadable. Mixing with `--color-ink` fixes both themes with one
 * declaration, because ink is dark in the light theme and light in the dark
 * theme — so the same formula darkens the text on a pale chip and lightens it
 * on a deep one. Measured, every tone below clears 4.5:1 in both themes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const TONE_TEXT_CLASS: Record<Tone, string> = {
  neutral: 'text-ink-muted',
  accent: 'text-[color:color-mix(in_oklab,var(--color-accent)_65%,var(--color-ink))]',
  positive: 'text-[color:color-mix(in_oklab,var(--color-positive)_65%,var(--color-ink))]',
  warning: 'text-[color:color-mix(in_oklab,var(--color-warning)_65%,var(--color-ink))]',
  danger: 'text-[color:color-mix(in_oklab,var(--color-danger)_65%,var(--color-ink))]',
  info: 'text-[color:color-mix(in_oklab,var(--color-info)_65%,var(--color-ink))]',
}

// eslint-disable-next-line react-refresh/only-export-components
export const TONE_SOFT_BG_CLASS: Record<Tone, string> = {
  neutral: 'bg-surface-muted',
  accent: 'bg-accent-soft',
  positive: 'bg-positive-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-info-soft',
}

const TONE_RING_CLASS: Record<Tone, string> = {
  neutral: 'ring-line',
  accent: 'ring-accent/25',
  positive: 'ring-positive/25',
  warning: 'ring-warning/30',
  danger: 'ring-danger/25',
  info: 'ring-info/25',
}

const SIZES = {
  sm: 'h-5 gap-1 px-2 text-[11px]',
  md: 'h-6 gap-1.5 px-2.5 text-xs',
} as const

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: Tone
  size?: 'sm' | 'md'
  /** Curated icon name rendered before the label. */
  icon?: string
  className?: string
  children?: ReactNode
}

/**
 * A small status chip: priority, task state, category, tag count.
 *
 * Badges are supplementary by design — they never carry information that is
 * not also available as text or through a control nearby.
 */
export function Badge({
  tone = 'neutral',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-flex max-w-full items-center rounded-full font-medium ring-1 ring-inset',
        SIZES[size],
        TONE_SOFT_BG_CLASS[tone],
        TONE_TEXT_CLASS[tone],
        TONE_RING_CLASS[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 11 : 13} /> : null}
      <span className="truncate">{children}</span>
    </span>
  )
}
