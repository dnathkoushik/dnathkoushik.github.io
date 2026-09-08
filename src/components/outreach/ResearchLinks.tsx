import type { Company } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { researchLinks } from '@/utils/templates'

export interface ResearchLinksProps {
  company: Company
  className?: string
}

/**
 * Where to go look a company up, as a row of chips.
 *
 * Every chip is a plain external link that opens in a new tab: nothing here is
 * fetched or scraped, the point is to get the owner to the right search page
 * in one click and then log what they found as a fact.
 */
export function ResearchLinks({ company, className }: ResearchLinksProps) {
  const links = researchLinks(company)
  if (links.length === 0) {
    return (
      <p className={cn('text-sm text-ink-faint', className)}>
        Give the company a name to get research shortcuts.
      </p>
    )
  }

  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label={`Research ${company.name}`}>
      {links.map((link) => (
        <li key={link.label}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink-muted',
              'transition-colors duration-150 outline-accent hover:border-line-strong hover:bg-surface-hover hover:text-ink',
              'focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:h-11',
            )}
          >
            <Icon name={link.icon} size={14} />
            {link.label}
            <Icon name="ArrowUpRight" size={12} className="text-ink-faint" />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
