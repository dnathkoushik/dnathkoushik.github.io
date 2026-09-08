import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * A hand-rolled modal dialog: portalled to <body>, focus-trapped, scroll-locked
 * without the layout shift a naive `overflow: hidden` causes, and shaped as a
 * bottom sheet on phones.
 *
 * No headless UI library is used on purpose. The behaviour below is small
 * enough to own outright, and owning it is what lets the sheet/panel split and
 * the scrollbar compensation work exactly the way this product needs.
 */

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

/** Visible, focusable descendants in DOM order. */
function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true',
  )
}

/*
 * Scroll locking is reference counted so a dialog opened from inside another
 * dialog does not release the lock early on the way out.
 */
let lockDepth = 0
let restoreOverflow = ''
let restorePaddingRight = ''

function lockBodyScroll() {
  if (lockDepth === 0) {
    const body = document.body
    const gutter = window.innerWidth - document.documentElement.clientWidth
    restoreOverflow = body.style.overflow
    restorePaddingRight = body.style.paddingRight
    body.style.overflow = 'hidden'
    // Replace the scrollbar with padding so the page does not jump sideways.
    if (gutter > 0) {
      const current = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0
      body.style.paddingRight = `${current + gutter}px`
    }
  }
  lockDepth += 1
}

function unlockBodyScroll() {
  lockDepth = Math.max(0, lockDepth - 1)
  if (lockDepth === 0) {
    document.body.style.overflow = restoreOverflow
    document.body.style.paddingRight = restorePaddingRight
  }
}

/*
 * Open dialogs, oldest first. Escape is handled on `document` so it still works
 * when focus has slipped onto <body>, and only the topmost dialog reacts.
 */
const openStack: string[] = []

const SIZE_CLASS = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
} as const

/** Milliseconds the panel stays mounted after closing so it can animate out. */
const EXIT_MS = 180

export interface DialogProps {
  open: boolean
  onClose: () => void
  /** Becomes the accessible name of the dialog. */
  title: string
  description?: string
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
  /** Extra classes for the panel itself. */
  className?: string
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  className,
}: DialogProps) {
  const reactId = useId()
  const titleId = `dialog-title-${reactId}`
  const descriptionId = `dialog-description-${reactId}`

  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const backdropArmedRef = useRef(false)

  const [mounted, setMounted] = useState(open)
  const [entered, setEntered] = useState(false)
  const [lastOpen, setLastOpen] = useState(open)

  /*
   * The animation phase is derived while rendering rather than in an effect, so
   * an opening dialog never paints a frame in the wrong state. Opening mounts
   * immediately; closing only drops `entered`, and the unmount waits for the
   * transition below.
   */
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) setMounted(true)
    else setEntered(false)
  }

  // Keep the panel around briefly after `open` flips so it can animate out.
  useEffect(() => {
    if (open || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [open, mounted])

  // The page stays locked for as long as anything is on screen, including the
  // exit transition — releasing it early makes the scrollbar flash back.
  useEffect(() => {
    if (!mounted) return
    lockBodyScroll()
    return unlockBodyScroll
  }, [mounted])

  // Remember where focus came from and hand it back the moment the dialog closes.
  useEffect(() => {
    if (!open) return
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    openStack.push(reactId)
    return () => {
      const index = openStack.indexOf(reactId)
      if (index !== -1) openStack.splice(index, 1)
      const target = returnFocusRef.current
      returnFocusRef.current = null
      if (target && document.contains(target)) {
        target.focus({ preventScroll: true })
      }
    }
  }, [open, reactId])

  // Escape closes, but only for the dialog on top of the stack.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (openStack[openStack.length - 1] !== reactId) return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, reactId, onClose])

  // Move focus inside once the panel exists, then start the entrance transition.
  useEffect(() => {
    if (!open || !mounted) return
    const panel = panelRef.current
    if (!panel) return

    const candidates = focusableWithin(panel)
    const target = candidates.find((el) => el !== closeRef.current) ?? closeRef.current ?? panel
    target.focus({ preventScroll: true })

    const frame = window.requestAnimationFrame(() => setEntered(true))
    return () => window.cancelAnimationFrame(frame)
  }, [open, mounted])

  // Tab and Shift+Tab cycle inside the panel instead of escaping to the page.
  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return
    // A dialog opened from inside this one is portalled elsewhere in the DOM but
    // still bubbles through the React tree. Its Tab presses are its own to trap.
    if (event.target instanceof Node && !panel.contains(event.target)) return
    const items = focusableWithin(panel)
    if (items.length === 0) {
      event.preventDefault()
      panel.focus({ preventScroll: true })
      return
    }

    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    const inside = active instanceof Node && panel.contains(active)

    if (event.shiftKey && (!inside || active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (!inside || active === last)) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  /** True for the scrim and the flex container behind it, false for the panel. */
  const isBackdrop = (target: EventTarget) =>
    target === backdropRef.current || target === overlayRef.current

  if (!mounted) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden sm:items-center sm:p-6"
      onKeyDown={handleKeyDown}
      // A drag that starts inside the panel and ends on the backdrop must not close it.
      onPointerDown={(event) => {
        backdropArmedRef.current = isBackdrop(event.target)
      }}
      onClick={(event) => {
        if (backdropArmedRef.current && isBackdrop(event.target)) onClose()
        backdropArmedRef.current = false
      }}
    >
      <div
        ref={backdropRef}
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-[oklch(0%_0_0_/_0.45)] transition-opacity duration-200 dark:bg-[oklch(0%_0_0_/_0.7)]',
          entered ? 'opacity-100' : 'opacity-0',
        )}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full flex-col overflow-hidden border border-line bg-surface shadow-overlay',
          'max-h-[calc(100dvh-1.5rem)] rounded-t-2xl sm:max-h-[calc(100dvh-6rem)] sm:rounded-card',
          'transition-[opacity,transform] duration-200 ease-out',
          SIZE_CLASS[size],
          entered ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 sm:translate-y-2',
          className,
        )}
      >
        {/* Grab handle: a purely visual affordance for the mobile sheet. */}
        <div aria-hidden="true" className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <header className="flex items-start gap-4 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mt-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="X" className="size-4" />
          </button>
        </header>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 sm:px-6',
            footer ? 'pb-4' : 'pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6',
          )}
        >
          {children}
        </div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
