import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface TechFilterProps {
  /** Every technology named by at least one project, already sorted. */
  technologies: string[]
  selected: string[]
  /**
   * Projects that would remain if this chip were toggled on — or, for a chip
   * that is already on, the current number of results. Zero means the chip
   * narrows the list to nothing, so it is dimmed rather than hidden.
   */
  counts: Record<string, number>
  total: number
  matching: number
  onToggle: (technology: string) => void
  onClear: () => void
  className?: string
}

const CHIP =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] ' +
  'whitespace-nowrap transition-colors duration-150 pointer-coarse:h-11 cursor-pointer'

const CHIP_ON =
  'border-accent/50 bg-accent-soft font-medium ' +
  'text-[color:color-mix(in_oklab,var(--color-accent)_70%,var(--color-ink))]'

const CHIP_OFF = 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'

/**
 * The technology filter for /projects.
 *
 * A horizontally scrolling chip row on a phone — the row bleeds to both screen
 * edges so it is obvious there is more to the right — and a wrapping cloud from
 * `sm` up. Selection is multiple and intersecting: a project has to use every
 * technology picked, which is what makes the counts on each chip worth reading.
 *
 * The result count is a live region, because on a filter the interesting change
 * happens somewhere else on the page.
 */
export function TechFilter({
  technologies,
  selected,
  counts,
  total,
  matching,
  onToggle,
  onClear,
  className,
}: TechFilterProps) {
  const noneSelected = selected.length === 0
  const projects = (count: number) => `${count} ${count === 1 ? 'project' : 'projects'}`

  return (
    <section aria-labelledby="tech-filter-heading" className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="tech-filter-heading" className="text-sm font-semibold tracking-tight text-ink">
          Filter by technology
        </h2>

        <p
          aria-live="polite"
          className="font-mono text-xs text-ink-faint tabular-nums"
        >
          {matching} of {projects(total)}
        </p>
      </div>

      <ul className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <li>
          <button
            type="button"
            aria-pressed={noneSelected}
            onClick={onClear}
            aria-label={`All technologies, ${projects(total)}`}
            className={cn(CHIP, noneSelected ? CHIP_ON : CHIP_OFF)}
          >
            {noneSelected ? <Icon name="Check" size={13} /> : <Icon name="Funnel" size={13} />}
            All
            <span className="font-mono text-[11px] tabular-nums opacity-70">{total}</span>
          </button>
        </li>

        {technologies.map((technology) => {
          const active = selected.includes(technology)
          const count = counts[technology] ?? 0
          return (
            <li key={technology}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onToggle(technology)}
                aria-label={`${technology}, ${projects(count)}`}
                className={cn(
                  CHIP,
                  active ? CHIP_ON : CHIP_OFF,
                  !active && count === 0 && 'opacity-55',
                )}
              >
                {active ? <Icon name="Check" size={13} /> : null}
                <span className="font-mono">{technology}</span>
                <span className="font-mono text-[11px] tabular-nums opacity-70">{count}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="text-xs leading-relaxed text-ink-faint">
        {noneSelected
          ? 'Pick one or more technologies. The filter lives in the URL, so a filtered view can be shared.'
          : 'Showing projects that use every selected technology.'}
      </p>
    </section>
  )
}
