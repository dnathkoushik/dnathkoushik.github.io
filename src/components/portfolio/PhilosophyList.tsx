import { philosophy } from '@/data'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface PhilosophyListProps {
  className?: string
}

/**
 * How I work, in three short notes.
 *
 * Rendered as a plain list so the caller owns the surrounding `<section>` and
 * its heading — that keeps the page's heading outline in one place instead of
 * splitting it across a component boundary.
 */
export function PhilosophyList({ className }: PhilosophyListProps) {
  if (philosophy.length === 0) {
    return (
      <EmptyState
        icon="Quote"
        title="Nothing written down yet"
        description="These notes live in src/data/focus.ts."
        className={className}
      />
    )
  }

  return (
    <ul className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {philosophy.map((note, index) => (
        <li key={note.title} className="flex">
          <Card className="w-full animate-rise p-5">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-muted text-ink-faint"
              >
                <Icon name="Quote" size={14} />
              </span>
              <span className="font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
            </div>

            <h3 className="mt-4 text-base font-semibold tracking-tight text-balance text-ink">
              {note.title}
            </h3>

            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{note.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  )
}
