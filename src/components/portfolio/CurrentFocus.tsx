import { useId, useState } from 'react'
import { currentFocus } from '@/data'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { cn } from '@/lib/cn'

export interface CurrentFocusProps {
  /** Id for the section heading, so the `<section>` can point at it. */
  id?: string
  className?: string
}

/**
 * The "currently working on" strip, shared by the home page and /about.
 *
 * Every item has a one-line detail. From `sm` up it is simply always visible;
 * below that it collapses behind a real disclosure button rather than a
 * tooltip, because a tooltip on a touch device is a detail nobody ever reads.
 */
export function CurrentFocus({ id = 'current-focus', className }: CurrentFocusProps) {
  const baseId = useId()
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section aria-labelledby={id} className={cn('animate-rise', className)}>
      <SectionHeading
        id={id}
        eyebrow="Right now"
        title="Currently working on"
        description="The four things getting my attention this season. This list changes; a stale one would be worse than none."
      />

      <div className="mt-6">
        {currentFocus.length === 0 ? (
          <EmptyState
            icon="Target"
            title="Nothing listed yet"
            description="The current-focus list is empty."
          />
        ) : (
          <Card>
            <CardContent className="p-0 first:pt-0">
              <ul className="grid sm:grid-cols-2">
                {currentFocus.map((item, index) => {
                  const detailId = `${baseId}-detail-${index}`
                  const open = openIndex === index
                  const isLast = index === currentFocus.length - 1
                  // Seams are computed rather than guessed with nth-child, so an
                  // odd number of items never leaves a border hanging in space.
                  const inLastRow = index >= currentFocus.length - (currentFocus.length % 2 || 2)
                  const inLeftColumn = index % 2 === 0 && !isLast

                  return (
                    <li
                      key={item.label}
                      className={cn(
                        'border-b border-line p-4 sm:p-5',
                        isLast && 'border-b-0',
                        !isLast && inLastRow && 'sm:border-b-0',
                        inLeftColumn && 'sm:border-r',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent tabular-nums"
                        >
                          {index + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[15px] font-medium text-ink">{item.label}</p>

                            {item.detail ? (
                              <button
                                type="button"
                                onClick={() => setOpenIndex(open ? null : index)}
                                aria-expanded={open}
                                aria-controls={detailId}
                                className="-m-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors duration-150 hover:text-ink sm:hidden"
                              >
                                <Icon
                                  name="ChevronDown"
                                  size={16}
                                  className={cn('transition-transform duration-150', open && 'rotate-180')}
                                />
                                <span className="sr-only">
                                  {open ? 'Hide' : 'Show'} details for {item.label}
                                </span>
                              </button>
                            ) : null}
                          </div>

                          {item.detail ? (
                            <p
                              id={detailId}
                              className={cn(
                                'mt-1.5 text-sm leading-relaxed text-ink-muted sm:block',
                                open ? 'block' : 'hidden',
                              )}
                            >
                              {item.detail}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
