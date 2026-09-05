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

/* The house curve, for the few transitions CSS owns rather than GSAP. */
const HOUSE = 'ease-[cubic-bezier(0.16,1,0.3,1)]'

const CHIP =
  'group/chip relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 ' +
  'font-mono text-[12px] tracking-[0.12em] uppercase whitespace-nowrap select-none ' +
  'transition-[color,background-color,border-color,scale] duration-300 active:scale-[0.97] pointer-coarse:h-11'

const CHIP_ON = 'border-accent bg-accent text-accent-ink'

const CHIP_OFF = 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'

/** The hairline that slides in under an unselected chip's label on hover. */
function Underline() {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-4 bottom-[11px] h-px origin-left scale-x-0 bg-current',
        'transition-transform duration-300 group-hover/chip:scale-x-100 group-focus-visible/chip:scale-x-100',
        HOUSE,
      )}
    />
  )
}

/**
 * The technology filter for /projects.
 *
 * A horizontally scrolling chip row on a phone — the row bleeds to both screen
 * edges so it is obvious there is more to the right — and a wrapping cloud from
 * `sm` up. Selection is multiple and intersecting: a project has to use every
 * technology picked, which is what makes the counts on each chip worth reading.
 *
 * The result count is a live region, because on a filter the interesting change
 * happens somewhere else on the page. Selected chips are solid accent; the rest
 * show a sliding underline on hover, so the state is legible with motion off
 * and the intent is legible before the click.
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
    <section aria-labelledby="tech-filter-heading" className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2
          id="tech-filter-heading"
          className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase"
        >
          Filter by technology
        </h2>

        <p
          aria-live="polite"
          aria-atomic="true"
          className="font-mono text-sm text-ink-faint tabular-nums"
        >
          <span className="text-ink">{matching}</span> of {total}
          <span className="sr-only"> {total === 1 ? 'project' : 'projects'} shown</span>
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
            <Icon name={noneSelected ? 'Check' : 'Funnel'} size={12} />
            All
            <span className="text-[11px] opacity-70 tabular-nums">{total}</span>
            {noneSelected ? null : <Underline />}
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
                {active ? <Icon name="Check" size={12} /> : null}
                <span>{technology}</span>
                <span className="text-[11px] opacity-70 tabular-nums">{count}</span>
                {active ? null : <Underline />}
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
