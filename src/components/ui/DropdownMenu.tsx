import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * An icon-triggered action menu with the full WAI-ARIA menu button keyboard
 * contract: arrows move the active item, Home/End jump, Escape closes and
 * returns focus to the trigger, and an outside click or a blur out of the menu
 * dismisses it.
 *
 * Items are real <button> elements, so Enter and Space activate them natively.
 */

export interface DropdownMenuItem {
  id: string
  label: string
  /** Lucide icon name resolved through components/ui/Icon.tsx. */
  icon?: string
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[]
  /** Accessible name for the trigger, e.g. "Task actions". */
  label: string
  triggerIcon?: string
  align?: 'start' | 'end'
  className?: string
  triggerClassName?: string
}

/** Distance kept between the menu and the edge of the viewport. */
const EDGE_GUTTER = 8

export function DropdownMenu({
  items,
  label,
  triggerIcon = 'Ellipsis',
  align = 'end',
  className,
  triggerClassName,
}: DropdownMenuProps) {
  const menuId = `menu-${useId()}`
  const triggerId = `${menuId}-trigger`

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const enabledIndexes = items.reduce<number[]>((acc, item, index) => {
    if (!item.disabled) acc.push(index)
    return acc
  }, [])

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    setActiveIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const openWith = useCallback(
    (position: 'first' | 'last') => {
      if (enabledIndexes.length === 0) return
      setOpen(true)
      setActiveIndex(
        position === 'first' ? enabledIndexes[0] : enabledIndexes[enabledIndexes.length - 1],
      )
    },
    [enabledIndexes],
  )

  // Dismiss on a click that lands anywhere outside the trigger or the menu.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && rootRef.current?.contains(target)) return
      setOpen(false)
      setActiveIndex(-1)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  /*
   * Placement is written straight onto the node instead of into state: it is
   * layout that belongs to the DOM, and keeping it out of React means the menu
   * is measured and corrected before the browser paints, with no second render
   * and no visible jump. The node is created fresh on every open, so the inline
   * styles never leak between openings, and React leaves them alone because the
   * element has no `style` prop of its own.
   */
  useLayoutEffect(() => {
    if (!open) return
    const menu = menuRef.current
    const trigger = triggerRef.current
    if (!menu || !trigger) return

    const menuRect = menu.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()

    let nudge = 0
    if (menuRect.left < EDGE_GUTTER) nudge = EDGE_GUTTER - menuRect.left
    else if (menuRect.right > window.innerWidth - EDGE_GUTTER) {
      nudge = window.innerWidth - EDGE_GUTTER - menuRect.right
    }
    if (nudge !== 0) {
      const shift = Math.round(nudge)
      // The menu is anchored to one edge, so shifting it right means pulling
      // that edge in the opposite direction when it is the right edge.
      if (align === 'end') menu.style.right = `${-shift}px`
      else menu.style.left = `${shift}px`
    }

    const needed = menuRect.height + EDGE_GUTTER * 2
    if (window.innerHeight - triggerRect.bottom < needed && triggerRect.top > needed) {
      menu.style.top = 'auto'
      menu.style.bottom = '100%'
      menu.style.marginTop = '0'
      menu.style.marginBottom = '0.25rem'
    }
  }, [open, align])

  // Roving focus: the active item is the only one that ever holds focus.
  useEffect(() => {
    if (!open || activeIndex < 0) return
    itemRefs.current[activeIndex]?.focus()
  }, [open, activeIndex])

  const moveActive = (direction: 1 | -1) => {
    if (enabledIndexes.length === 0) return
    const current = enabledIndexes.indexOf(activeIndex)
    const next =
      current === -1
        ? direction === 1
          ? 0
          : enabledIndexes.length - 1
        : (current + direction + enabledIndexes.length) % enabledIndexes.length
    setActiveIndex(enabledIndexes[next])
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openWith('first')
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openWith('last')
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      close(true)
    }
  }

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        moveActive(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        moveActive(-1)
        break
      case 'Home':
        event.preventDefault()
        if (enabledIndexes.length > 0) setActiveIndex(enabledIndexes[0])
        break
      case 'End':
        event.preventDefault()
        if (enabledIndexes.length > 0) setActiveIndex(enabledIndexes[enabledIndexes.length - 1])
        break
      case 'Escape':
        event.preventDefault()
        event.stopPropagation()
        close(true)
        break
      case 'Tab':
        // Never leave an orphaned menu behind; focus goes back to the trigger so
        // the next Tab continues from a sensible place in the page order.
        event.preventDefault()
        close(true)
        break
      default:
        break
    }
  }

  const select = (item: DropdownMenuItem) => {
    if (item.disabled) return
    close(true)
    item.onSelect()
  }

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-flex', className)}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (next instanceof Node && rootRef.current?.contains(next)) return
        setOpen(false)
        setActiveIndex(-1)
      }}
    >
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : openWith('first'))}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-faint transition-colors',
          'hover:bg-surface-hover hover:text-ink sm:min-h-9 sm:min-w-9',
          open && 'bg-surface-hover text-ink',
          triggerClassName,
        )}
      >
        <Icon name={triggerIcon} className="size-4" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute top-full z-40 mt-1 min-w-48 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-overlay',
            'animate-pop',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          <ul className="flex flex-col">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  ref={(node) => {
                    itemRefs.current[index] = node
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={activeIndex === index ? 0 : -1}
                  disabled={item.disabled}
                  onClick={() => select(item)}
                  onMouseEnter={() => {
                    if (!item.disabled) setActiveIndex(index)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors sm:py-2',
                    item.tone === 'danger' ? 'text-danger' : 'text-ink-muted',
                    item.disabled
                      ? 'cursor-not-allowed opacity-45'
                      : item.tone === 'danger'
                        ? 'hover:bg-danger-soft focus:bg-danger-soft'
                        : 'hover:bg-surface-hover hover:text-ink focus:bg-surface-hover focus:text-ink',
                  )}
                >
                  {item.icon ? (
                    <Icon name={item.icon} className="size-4 shrink-0 opacity-80" />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
