import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  /** Curated icon name. Pick one that describes what *would* be here. */
  icon: string
  title: string
  description?: string
  /** Usually the button that fills the emptiness. */
  action?: ReactNode
  className?: string
}

/**
 * What a list looks like before it has anything in it.
 *
 * A dashboard you use daily starts empty every time you open a new week, so
 * this is a high-traffic screen rather than an error path. It reads as an
 * invitation — a dashed outline that says "this space is reserved", an icon in
 * a soft accent disc, and the action that fills it — never as an apology.
 * The title is a `<p>`, not a heading, so dropping one into a card can never
 * break the page's heading outline.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line',
        'bg-surface-muted/40 px-6 py-12 text-center animate-fade-in',
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} size={22} />
      </span>

      <div className="space-y-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
