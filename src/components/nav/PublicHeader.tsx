import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { PERSONAL_ROUTES, PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { Icon } from '@/components/ui/Icon'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { gsap, ScrollTrigger, useGSAP, motionOK, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { onIntroDone, useLenis } from '@/motion'

/*
 * The hint printed on the search button. Resolved once, at module scope: the
 * platform cannot change between renders, and reading `navigator` while
 * rendering would make the value differ between the first and second paint.
 */
const IS_APPLE =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
const SHORTCUT_HINT = IS_APPLE ? '⌘K' : 'Ctrl K'

/** Within this distance of the top the header never hides, whatever the scroll direction. */
const REVEAL_ZONE_PX = 80

/** The three floating pills share one glass treatment. */
const GLASS = 'border border-line bg-surface/70 shadow-raised backdrop-blur-xl'

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
 * The public site's masthead: three glass pills floating over the page.
 *
 * Left, the name. Centre (xl and up), the primary nav with one indicator that
 * slides between items rather than eight underlines that blink on and off.
 * Right, search, theme and — behind a divider, because it is a different place
 * and not another page about me — the lock into the private dashboard.
 *
 * With motion on it drops in once the intro curtain has gone, hides when the
 * reader scrolls down and returns the moment they scroll up (or focus anything
 * inside it). Under reduced motion it is simply fixed, always there.
 *
 * The bar itself is `pointer-events-none`: only the pills catch the pointer, so
 * the empty width between them never blocks a click on the hero beneath.
 */
export function PublicHeader({ onOpenSearch }: PublicHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const isTouch = useMediaQuery('(pointer: coarse)')
  const { pathname } = useLocation()

  // Read by the ScrollTrigger callback, which must not be rebuilt per render.
  const menuOpenRef = useRef(menuOpen)
  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])

  /** Brings a hidden header back. A no-op until the motion context installs it. */
  const showRef = useRef<() => void>(() => {})
  /** Re-measures the sliding indicator. Installed by the GSAP context below. */
  const measureRef = useRef<((animate: boolean) => void) | null>(null)

  /* ---- entrance + hide-on-scroll --------------------------------------- */
  useGSAP(
    () => {
      const header = headerRef.current
      if (!header) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        // Built paused so the hidden start state applies at once; released when
        // the preloader announces it has left (or right away when it was skipped).
        const entrance = gsap.from(header, {
          y: -24,
          opacity: 0,
          duration: 1,
          ease: 'house',
          paused: true,
        })
        const cancelIntro = onIntroDone(() => entrance.play())

        let hidden = false
        const setHidden = (next: boolean) => {
          if (next === hidden) return
          hidden = next
          // -200%: the bar sits 1rem below the viewport edge, so -100% would
          // leave its bottom (and its shadow) peeking out.
          gsap.to(header, {
            yPercent: next ? -200 : 0,
            duration: 0.6,
            ease: 'house-in-out',
            overwrite: 'auto',
          })
        }
        showRef.current = () => setHidden(false)

        ScrollTrigger.create({
          start: 0,
          end: 'max',
          onUpdate: (self) => {
            if (menuOpenRef.current) return
            if (self.scroll() < REVEAL_ZONE_PX) {
              setHidden(false)
              return
            }
            setHidden(self.direction === 1)
          },
        })

        return () => {
          cancelIntro()
          showRef.current = () => {}
        }
      })
    },
    { scope: headerRef },
  )

  /* ---- sliding active indicator ----------------------------------------- */
  useGSAP(
    () => {
      const pill = pillRef.current
      const indicator = indicatorRef.current
      if (!pill || !indicator) return

      // `x` is a transform. `width` is the one layout property animated on the
      // site: the indicator is absolutely positioned inside the pill, so the
      // only box it lays out is its own.
      const xTo = gsap.quickTo(indicator, 'x', { duration: 0.55, ease: 'expo.out' })
      const widthTo = gsap.quickTo(indicator, 'width', { duration: 0.55, ease: 'expo.out' })
      let shown = false

      const measure = (animate: boolean) => {
        const active = pill.querySelector<HTMLElement>('a[aria-current="page"]')
        const rect = active?.getBoundingClientRect()

        // No active tab (a 404), or the pill is display:none below xl.
        if (!active || !rect || rect.width === 0) {
          if (!shown) return
          shown = false
          gsap.to(indicator, { opacity: 0, duration: 0.2, ease: 'power2.out', overwrite: 'auto' })
          return
        }

        // Rect difference rather than offsetLeft: independent of which
        // ancestor is positioned, and both rects move with the header together.
        const x = rect.left - pill.getBoundingClientRect().left - pill.clientLeft

        if (animate && shown && motionOK()) {
          xTo(x, Number(gsap.getProperty(indicator, 'x')) || 0)
          widthTo(rect.width, Number(gsap.getProperty(indicator, 'width')) || 0)
        } else {
          xTo.tween.pause()
          widthTo.tween.pause()
          gsap.set(indicator, { x, width: rect.width })
        }

        if (!shown) {
          shown = true
          gsap.to(indicator, { opacity: 1, duration: 0.25, ease: 'power2.out', overwrite: 'auto' })
        }
      }

      const onResize = () => measure(false)
      window.addEventListener('resize', onResize)

      let observer: ResizeObserver | undefined
      if (typeof ResizeObserver !== 'undefined') {
        try {
          observer = new ResizeObserver(onResize)
          observer.observe(pill)
        } catch {
          observer = undefined
        }
      }

      // Tab widths change when the real typeface arrives.
      let cancelled = false
      const fonts: FontFaceSet | undefined = document.fonts
      if (fonts) {
        fonts.ready
          .then(() => {
            if (!cancelled) measure(false)
          })
          .catch(() => undefined)
      }

      measureRef.current = measure
      measure(false)

      return () => {
        cancelled = true
        window.removeEventListener('resize', onResize)
        observer?.disconnect()
        measureRef.current = null
      }
    },
    { scope: headerRef },
  )

  // NavLink has already flipped `aria-current` in this commit; slide to it.
  useEffect(() => {
    measureRef.current?.(true)
  }, [pathname])

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    showRef.current()
  }, [])

  return (
    <header
      ref={headerRef}
      onFocus={() => showRef.current()}
      className="pointer-events-none fixed inset-x-0 top-4 z-40"
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8',
          'xl:grid xl:grid-cols-[1fr_auto_1fr]',
        )}
      >
        <Link
          to={PUBLIC_ROUTES.home}
          className={cn(
            'pointer-events-auto inline-flex h-11 shrink-0 items-center rounded-full px-4',
            'font-display text-[15px] font-semibold text-ink transition-colors',
            'hover:border-line-strong hover:text-accent',
            GLASS,
          )}
        >
          {profile.name}
        </Link>

        <nav aria-label="Primary" className="pointer-events-auto hidden xl:block xl:justify-self-center">
          <div
            ref={pillRef}
            className={cn('relative flex items-center rounded-full px-2 py-1.5', GLASS)}
          >
            <span
              ref={indicatorRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1.5 left-0 w-0 rounded-full bg-surface-hover opacity-0"
            />
            <ul className="flex items-center gap-0.5">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <NavLink
                    to={item.href}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'relative block rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                        isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div
          className={cn(
            'pointer-events-auto flex h-11 items-center gap-0.5 rounded-full p-1 xl:justify-self-end',
            GLASS,
          )}
        >
          <button
            type="button"
            onClick={onOpenSearch}
            aria-label="Search the site"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-2.5 text-ink-muted transition-colors',
              'hover:bg-surface-hover hover:text-ink',
            )}
          >
            <Icon name="Search" className="size-4" />
            {isTouch ? null : (
              <kbd className="hidden rounded-full border border-line bg-surface-muted px-2 font-mono text-[10px] leading-5 tracking-[0.08em] text-ink-faint sm:inline-block">
                {SHORTCUT_HINT}
              </kbd>
            )}
          </button>

          <ThemeToggle className="size-9 rounded-full sm:size-9" />

          {/* The private space is fenced off from the portfolio tabs on
              purpose: a divider, then a lock. It is not another page about me. */}
          <span aria-hidden="true" className="mx-1 hidden h-5 w-px bg-line xl:block" />

          <Link
            to={PERSONAL_ROUTES.dashboard}
            className={cn(
              'hidden h-9 items-center gap-2 rounded-full border border-line bg-surface-muted px-3',
              'text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink',
              'xl:inline-flex',
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
            className="inline-flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink xl:hidden"
          >
            <Icon name="Menu" className="size-5" />
          </button>
        </div>
      </div>

      <FullscreenMenu
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

interface FullscreenMenuProps {
  open: boolean
  onClose: () => void
  onOpenSearch: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
}

/** Fully covering. */
const CLIP_SHOWN = 'inset(0% 0% 0% 0%)'
/** Collapsed to the top edge — the curtain before it drops and after it lifts. */
const CLIP_UP = 'inset(0% 0% 100% 0%)'

/**
 * The full-screen menu below `xl`.
 *
 * Portalled to the body so the header's transform can never clip it. With
 * motion on, a canvas-coloured curtain drops from the top while each link
 * slides up out of its own mask; on close the curtain lifts again and only
 * then does the menu unmount. Under reduced motion it appears and disappears
 * in one frame.
 *
 * Focus is trapped while open and handed back to the hamburger on close.
 * Dismissed by Escape, a tap on empty space, the close button, or navigating
 * anywhere (including the browser's back button). Scrolling is locked through
 * Lenis when it is running, through the body otherwise; the menu itself may
 * scroll natively on a short landscape phone (`data-lenis-prevent`).
 */
function FullscreenMenu({ open, onClose, onOpenSearch, triggerRef }: FullscreenMenuProps) {
  // Stays mounted through the exit animation; `open` says which way it is going.
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)
  const lenis = useLenis()
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

  // Escape closes from anywhere, not only while focus is inside the panel.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Lock the page behind the menu.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    if (lenis) {
      lenis.stop()
      return () => lenis.start()
    }
    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open, lenis])

  // Move focus in on open; hand it back to the hamburger on close.
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      const panel = panelRef.current
      const first = panel ? focusableWithin(panel)[0] : undefined
      ;(first ?? panel)?.focus({ preventScroll: true })
      return
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [open, triggerRef])

  // Curtain in / curtain out. `revertOnUpdate` clears the entrance before the
  // exit runs (and kills a half-finished exit if the menu is reopened mid-way).
  useGSAP(
    () => {
      const panel = panelRef.current
      if (!panel || !mounted) return

      if (!motionOK()) {
        if (!open) setMounted(false)
        return
      }

      if (open) {
        const items = gsap.utils.toArray<HTMLElement>('[data-menu-item]', panel)
        const meta = gsap.utils.toArray<HTMLElement>('[data-menu-meta]', panel)
        const tl = gsap.timeline({ defaults: { ease: 'house' } })
        tl.fromTo(
          panel,
          { clipPath: CLIP_UP },
          { clipPath: CLIP_SHOWN, duration: 0.7, ease: 'house-in-out' },
        )
        if (items.length > 0) tl.from(items, { yPercent: 110, duration: 1, stagger: 0.06 }, 0.3)
        if (meta.length > 0) tl.from(meta, { y: 16, opacity: 0, duration: 0.8, stagger: 0.08 }, 0.7)
        return
      }

      gsap.to(panel, {
        clipPath: CLIP_UP,
        duration: 0.5,
        ease: 'house-in-out',
        onComplete: () => setMounted(false),
      })
    },
    { scope: panelRef, dependencies: [open, mounted], revertOnUpdate: true },
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab') return

    const panel = panelRef.current
    if (!panel) return
    const items = focusableWithin(panel)
    if (items.length === 0) return

    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement

    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // A tap on the canvas between the links (not on a link) closes the menu.
  const handleBackdrop = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div
      ref={panelRef}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      aria-hidden={!open}
      tabIndex={-1}
      data-lenis-prevent=""
      onKeyDown={handleKeyDown}
      onClick={handleBackdrop}
      className={cn(
        'fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-canvas text-ink xl:hidden',
        !open && 'pointer-events-none',
      )}
      style={{ clipPath: CLIP_SHOWN }}
    >
      <div
        onClick={handleBackdrop}
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 sm:px-8 lg:px-12"
      >
        <div className="flex h-[4.75rem] shrink-0 items-center justify-between">
          <span className="font-display text-[15px] font-semibold text-ink">{profile.name}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        <nav
          aria-label="Primary (mobile)"
          className="flex flex-1 flex-col justify-center py-8"
          onClick={handleBackdrop}
        >
          <ol className="flex flex-col border-t border-line">
            {PUBLIC_NAV.map((item, index) => (
              <li key={item.href} className="overflow-hidden border-b border-line">
                <NavLink
                  to={item.href}
                  end={item.end}
                  onClick={onClose}
                  data-menu-item=""
                  data-cursor="Open"
                  className={({ isActive }) =>
                    cn(
                      'group flex min-h-11 items-baseline gap-4 py-[0.15em] sm:gap-6',
                      'font-display text-[clamp(2.5rem,9vw,6rem)] leading-[0.95] font-medium transition-colors',
                      isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'font-mono text-[11px] tracking-[0.18em] tabular-nums',
                          isActive ? 'text-accent' : 'text-ink-faint',
                        )}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 break-words">{item.label}</span>
                      <Icon
                        name="ArrowUpRight"
                        className={cn(
                          'ml-auto size-[0.4em] self-center text-ink-faint',
                          'transition-[transform,color] duration-300 ease-out',
                          'group-hover:translate-x-[0.06em] group-hover:-translate-y-[0.06em] group-hover:text-ink',
                        )}
                      />
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        </nav>

        <div className="grid shrink-0 gap-3 pb-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onOpenSearch}
            data-menu-meta=""
            className="flex min-h-12 w-full items-center gap-3 rounded-full border border-line bg-surface px-5 text-[15px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Icon name="Search" size={18} />
            Search everything
            <kbd className="ml-auto hidden font-mono text-[11px] tracking-[0.08em] text-ink-faint sm:inline-block">
              {SHORTCUT_HINT}
            </kbd>
          </button>

          <Link
            to={PERSONAL_ROUTES.dashboard}
            onClick={onClose}
            data-menu-meta=""
            className="flex min-h-12 w-full items-center gap-3 rounded-full border border-line bg-surface-muted px-5 text-[15px] font-medium text-ink transition-colors hover:border-line-strong"
          >
            <Icon name="Lock" size={18} />
            <span className="flex-1 text-left">Dashboard</span>
            <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
              Private
            </span>
          </Link>
        </div>

        <div
          data-menu-meta=""
          className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line py-5"
        >
          <a
            href={`mailto:${profile.email}`}
            className="font-mono text-xs text-ink-faint transition-colors hover:text-ink"
          >
            {profile.email}
          </a>
          <span className="font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
            {profile.location}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
