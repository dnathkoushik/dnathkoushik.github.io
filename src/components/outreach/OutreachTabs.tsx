import { NavLink } from 'react-router-dom'
import { OUTREACH_NAV } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface OutreachTabsProps {
  /** Optional per-href counts, e.g. { [PERSONAL_ROUTES.outreachPipeline]: 7 }. */
  counts?: Record<string, number>
  className?: string
}

/**
 * The Outreach module's section strip, rendered at the top of each of its pages.
 *
 * Real links rather than tabs-with-state so every section has a URL, the back
 * button works, and the command palette can deep-link. Scrolls horizontally on
 * phones; the active item is announced with aria-current.
 */
export function OutreachTabs({ counts, className }: OutreachTabsProps) {
  return (
    <nav aria-label="Outreach sections" className={cn('-mx-4 sm:mx-0', className)}>
      <ul className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line px-4 sm:px-0">
        {OUTREACH_NAV.map((item) => {
          const count = counts?.[item.href]
          return (
            <li key={item.href} className="shrink-0">
              <NavLink
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    '-mb-px inline-flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-accent text-ink'
                      : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
                  )
                }
              >
                <Icon name={item.icon} size={15} />
                {item.label}
                {typeof count === 'number' && count > 0 ? (
                  <span className="rounded-full bg-surface-muted px-1.5 font-mono text-[11px] tabular-nums text-ink-faint">
                    {count}
                  </span>
                ) : null}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
