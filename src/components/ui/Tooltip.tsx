import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * A supplementary label that appears on hover and on keyboard focus.
 *
 * Deliberately does not appear for touch input — there is no hover on a phone,
 * and a tooltip that only opens on long-press is a trap. Anything a user must
 * know is written in the interface itself; a tooltip only ever repeats or
 * expands on something already visible.
 */

/** Pointer dwell before the tooltip appears. Focus shows it immediately. */
const HOVER_DELAY_MS = 140

export interface TooltipProps {
  content: string
  side?: 'top' | 'bottom'
  children: ReactNode
}

export function Tooltip({ content, side = 'top', children }: TooltipProps) {
  const id = `tooltip-${useId()}`
  const [open, setOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const show = (delay: number) => {
    cancelTimer()
    if (delay === 0) {
      setOpen(true)
      return
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setOpen(true)
    }, delay)
  }

  const hide = () => {
    cancelTimer()
    setOpen(false)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape' && open) {
      // Do not stop propagation: dismissing a tooltip should never swallow the
      // Escape that was meant to close a dialog behind it.
      hide()
    }
  }

  // The description has to sit on the interactive element itself, so the child
  // is cloned when it is a single element and wrapped only as a fallback.
  const described = open ? id : undefined
  const trigger = isValidElement(children) ? (
    cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
      'aria-describedby': described,
    })
  ) : (
    <span aria-describedby={described}>{children}</span>
  )

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(event) => {
        if (event.pointerType === 'touch') return
        show(HOVER_DELAY_MS)
      }}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocusCapture={() => show(0)}
      onBlurCapture={hide}
      onKeyDown={handleKeyDown}
    >
      {trigger}
      <span
        role="tooltip"
        id={id}
        aria-hidden={open ? undefined : 'true'}
        className={cn(
          'pointer-events-none absolute left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5',
          'text-xs leading-snug font-medium text-ink shadow-raised transition-opacity duration-150',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          open ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        {content}
      </span>
    </span>
  )
}
