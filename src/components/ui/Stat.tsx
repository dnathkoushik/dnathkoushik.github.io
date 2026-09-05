import type { ReactNode } from 'react'
import type { Tone } from '@/types'
import { TONE_SOFT_BG_CLASS, TONE_TEXT_CLASS } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface StatProps {
  label: string
  value: ReactNode
  /** The context that makes the number mean something: a delta, a target. */
  sublabel?: string
  /** Curated icon name, shown in a soft disc on the trailing edge. */
  icon?: string
  tone?: Tone
  className?: string
}

/**
 * One number, with just enough around it to be readable at a glance.
 *
 * `tone` deliberately colours only the icon and the sublabel. Tinting the whole
 * tile turns a row of stats into a traffic light where every value shouts, and
 * the number itself — the thing you are actually here to read — loses against
 * its own background. The value stays `text-ink` in every tone.
 */
export function Stat({ label, value, sublabel, icon, tone = 'neutral', className }: StatProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-card border border-line bg-surface p-4 shadow-subtle',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-ink-faint uppercase">{label}</p>
        {icon ? (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg',
              TONE_SOFT_BG_CLASS[tone],
              TONE_TEXT_CLASS[tone],
            )}
          >
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 font-mono text-2xl leading-none font-semibold tracking-tight text-ink tabular-nums">
        {value}
      </p>

      {sublabel ? (
        <p className={cn('mt-1.5 text-xs leading-relaxed', TONE_TEXT_CLASS[tone])}>{sublabel}</p>
      ) : null}
    </div>
  )
}
