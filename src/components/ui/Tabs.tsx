import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * The tab strip only — the caller owns the panel.
 *
 * Element ids follow a fixed scheme so the two halves can be wired up without
 * threading refs around:
 *
 *   tab button  ->  id={`${item.id}-tab`}    aria-controls={`${item.id}-panel`}
 *   panel       ->  id={`${value}-panel`}    aria-labelledby={`${value}-tab`}
 *
 * So a caller writes:
 *
 *   <Tabs items={items} value={tab} onChange={setTab} ariaLabel="Views" />
 *   <div role="tabpanel" id={`${tab}-panel`} aria-labelledby={`${tab}-tab`} tabIndex={0}>
 *
 * Activation follows focus (the pattern the APG recommends when switching a
 * panel is cheap), and the strip scrolls sideways instead of wrapping on
 * narrow screens.
 */

export interface TabItem {
  id: string
  label: string
  /** Lucide icon name resolved through components/ui/Icon.tsx. */
  icon?: string
  badge?: string | number
}

export interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  ariaLabel: string
  className?: string
}

export function Tabs({ items, value, onChange, ariaLabel, className }: TabsProps) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const selectedIndex = items.findIndex((item) => item.id === value)

  // Keep the active tab in view when it changes from outside (deep link, keyboard).
  useEffect(() => {
    if (selectedIndex < 0) return
    tabRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedIndex])

  const activate = (index: number) => {
    const item = items[index]
    if (!item) return
    onChange(item.id)
    tabRefs.current[index]?.focus()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return
    const current = selectedIndex < 0 ? 0 : selectedIndex

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        activate((current + 1) % items.length)
        break
      case 'ArrowLeft':
        event.preventDefault()
        activate((current - 1 + items.length) % items.length)
        break
      case 'Home':
        event.preventDefault()
        activate(0)
        break
      case 'End':
        event.preventDefault()
        activate(items.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'no-scrollbar flex w-full items-stretch gap-1 overflow-x-auto border-b border-line',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            ref={(node) => {
              tabRefs.current[index] = node
            }}
            id={`${item.id}-tab`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${item.id}-panel`}
            tabIndex={selected || (selectedIndex < 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              selected
                ? 'border-accent text-ink'
                : 'border-transparent text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {item.icon ? <Icon name={item.icon} className="size-4 shrink-0" /> : null}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== '' ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums',
                  selected ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-ink-faint',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
