import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { PERSONAL_ROUTES, PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Icon } from '@/components/ui/Icon'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'

/*
 * The hint printed on the search button. Resolved once, at module scope: the
 * platform cannot change between renders, and reading `navigator` while
 * rendering would make the value differ between the first and second paint.
 */
const IS_APPLE =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
const SHORTCUT_HINT = IS_APPLE ? '⌘K' : 'Ctrl K'

/** Distance scrolled before the header grows its hairline. */
const SCROLL_THRESHOLD_PX = 4

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  )
}

export interface PublicHeaderProps {
  /** Opens the command palette. The open state is owned by `PublicLayout`. */
  onOpenSearch: () => void
}

/**
 * The public site's masthead.
 *
 * Sticky and translucent, with the bottom hairline appearing only once the page
 * has actually moved — at rest the header dissolves into the canvas, which is
 * what stops the hero from looking boxed in.
 */
export function PublicHeader({ onOpenSearch }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const isTouch = useMediaQuery('(pointer: coarse)')

  // rAF-throttled: scroll fires far more often than the browser paints, and all
  // this listener does is flip one boolean.
  useEffect(() => {
    let frame = 0
    let queued = false

    const update = () => {
      queued = false
      setScrolled(window.scrollY > SCROLL_THRESHOLD_PX)
    }

    const onScroll = () => {
      if (queued) return
      queued = true
      frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-canvas/85 backdrop-blur transition-colors duration-150',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-5 sm:px-8">
        <Link
          to={PUBLIC_ROUTES.home}
          className="mr-auto shrink-0 rounded-lg text-[15px] font-semibold tracking-tight text-ink transition-colors hover:text-accent"
        >
          {profile.name}
        </Link>

        <nav aria-label="Primary" className="hidden xl:block">
          <ul className="flex items-center gap-0.5">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'relative block rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      isActive ? 'text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-x-3 bottom-0.5 h-0.5 origin-left rounded-full bg-accent',
                          'transition-transform duration-200 ease-out',
                          isActive ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-1 flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search the site"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg text-ink-muted transition-colors',
              'hover:bg-surface-hover hover:text-ink',
              'max-sm:size-10 max-sm:justify-center',
              'sm:border sm:border-line sm:bg-surface sm:px-2.5 sm:shadow-subtle',
            )}
          >
            <Icon name="Search" className="size-4" />
            <span className="hidden text-sm sm:inline">Search</span>
            {isTouch ? null : (
              <kbd className="hidden rounded border border-line bg-surface-muted px-1.5 font-mono text-[11px] leading-5 text-ink-faint sm:inline-block">
                {SHORTCUT_HINT}
              </kbd>
            )}
          </button>

          <ThemeToggle />

          {/* The private space is fenced off from the portfolio tabs on
              purpose: a divider, then a lock. It is not another page about me. */}
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-line max-xl:hidden" />

          <Link
            to={PERSONAL_ROUTES.dashboard}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5',
              'text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink',
              'max-xl:hidden',
            )}
          >
            <Icon name="Lock" className="size-3.5" />
            Dashboard
          </Link>

          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink xl:hidden"
          >
            <Icon name="Menu" className="size-5" />
          </button>
        </div>
      </div>

      <MobileMenu
        open={menuOpen}
        onClose={closeMenu}
        onOpenSearch={() => {
          closeMenu()
          onOpenSearch()
        }}
        triggerRef={menuButtonRef}
      />
    </header>
  )
}

interface MobileMenuProps {
  open: boolean
  onClose: () => void
  onOpenSearch: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

/**
 * The full-screen menu under `lg`.
 *
 * Portalled out of the sticky header so its backdrop cannot be clipped by the
 * header's own stacking context, focus-trapped while open, and dismissed by
 * Escape, a backdrop tap, or navigating anywhere.
 */
function MobileMenu({ open, onClose, onOpenSearch, triggerRef }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const location = useLocation()
  const pathname = location.pathname
  const hash = location.hash

  // `onClose` is read through a ref so the navigation effect below depends only
  // on the location — otherwise a new closure identity would close the menu the
  // instant it opened.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  // Any navigation dismisses the menu, including the browser's back button.
  useEffect(() => {
    onCloseRef.current()
  }, [pathname, hash])

  useEffect(() => {
    if (!open) return
    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open])

  // Move focus in on open; hand it back to the hamburger on close.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      const first = panelRef.current ? focusableWithin(panelRef.current)[0] : undefined
      if (first) first.focus({ preventScroll: true })
      return
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [open, triggerRef])

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return
    const items = focusableWithin(panel)
    if (items.length === 0) return

    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 xl:hidden" onKeyDown={handleKeyDown}>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 size-full cursor-default bg-[oklch(0%_0_0_/_0.45)] dark:bg-[oklch(0%_0_0_/_0.7)]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto border-b border-line bg-canvas pb-6 shadow-overlay animate-rise"
      >
        <div className="flex h-16 items-center justify-between px-5">
          <span className="text-[15px] font-semibold tracking-tight text-ink">{profile.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        <nav aria-label="Primary (mobile)" className="px-3">
          <ul className="space-y-0.5">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  to={item.href}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-12 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors',
                      isActive
                        ? 'bg-accent-soft text-accent'
                        : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                    )
                  }
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-4 space-y-2 border-t border-line px-5 pt-5">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 text-[15px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="Search" size={18} />
            Search everything
          </button>

          <Link
            to={PERSONAL_ROUTES.dashboard}
            onClick={onClose}
            className="flex min-h-12 w-full items-center gap-3 rounded-lg border border-line bg-surface-muted px-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface-hover"
          >
            <Icon name="Lock" size={18} />
            <span className="flex-1 text-left">Dashboard</span>
            <span className="text-xs font-normal text-ink-faint">Private</span>
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  )
}
