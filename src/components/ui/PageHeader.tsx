import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  /** Small uppercase kicker above the title: a date, a section, a week key. */
  eyebrow?: string
  title: string
  description?: string
  /** Buttons and menus for this page. Right-aligned from `sm` up. */
  actions?: ReactNode
  className?: string
}

/**
 * The `<h1>` block at the top of a page.
 *
 * On a phone the actions sit below the title where a thumb can reach them; from
 * `sm` up they move to the trailing edge and align to the baseline of the
 * title block. Exactly one of these per page — it owns the page's only `<h1>`.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{actions}</div>
      ) : null}
    </header>
  )
}
