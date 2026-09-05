import { createElement, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PERSONAL_ROUTES, PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { brandIconFor } from '@/components/common/BrandIcons'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { gsap, useGSAP, motionOK, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { Stagger, useLenis } from '@/motion'

/**
 * Lucide fallbacks for the social ids that have no brand mark — email, a
 * personal site, a hosted CV. Anything unrecognised gets a generic link glyph
 * rather than a hole in the row.
 */
const FALLBACK_ICON: Record<string, string> = {
  email: 'Mail',
  mail: 'Mail',
  website: 'Globe',
  site: 'Globe',
  blog: 'BookOpen',
  resume: 'FileText',
  cv: 'FileText',
  phone: 'Phone',
}

/*
 * `brandIconFor` resolves a stable module-scope component, never a freshly
 * built one — it is called through `createElement` so that reads as data
 * rather than as a component defined mid-render.
 */
function SocialGlyph({ id }: { id: string }) {
  const brand = brandIconFor(id)
  if (brand) return createElement(brand, { className: 'size-4' })
  return <Icon name={FALLBACK_ICON[id.toLowerCase()] ?? 'Link'} className="size-4" />
}

const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'

/* -------------------------------------------------------------------------- *
 * Local time in Kharagpur
 * -------------------------------------------------------------------------- */

const TIME_ZONE = 'Asia/Kolkata'

function makeTimeFormatter(): Intl.DateTimeFormat {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: TIME_ZONE })
  } catch {
    // An ICU build without zone data: show the visitor's own clock rather than nothing.
    return new Intl.DateTimeFormat('en-GB', options)
  }
}

const timeFormatter = makeTimeFormatter()

function formatNow(): string {
  return timeFormatter.format(new Date())
}

/** "14:32" in Kharagpur, re-rendered on every minute boundary. */
function useKharagpurTime(): string {
  const [time, setTime] = useState<string>(formatNow)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let interval = 0
    const now = new Date()
    const untilNextMinute = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds())

    const timeout = window.setTimeout(() => {
      setTime(formatNow())
      interval = window.setInterval(() => setTime(formatNow()), 60_000)
    }, untilNextMinute)

    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [])

  return time
}

/* -------------------------------------------------------------------------- *
 * Back to top
 * -------------------------------------------------------------------------- */

const RING_RADIUS = 26.5
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/**
 * A round button whose rim draws itself as the reader moves down the page. The
 * markup ships with the ring complete (the state you see at the foot of the
 * page, and the only state under reduced motion); with motion on, a scrubbed
 * tween pulls the dash offset back to empty at the top of the document.
 */
function BackToTop() {
  const lenis = useLenis()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)

  useGSAP(
    () => {
      const ring = ringRef.current
      if (!ring) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        gsap.fromTo(
          ring,
          { attr: { 'stroke-dashoffset': RING_CIRCUMFERENCE } },
          {
            attr: { 'stroke-dashoffset': 0 },
            ease: 'none',
            scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
          },
        )
      })
    },
    { scope: buttonRef },
  )

  const scrollToTop = () => {
    if (typeof window === 'undefined') return
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.4 })
      return
    }
    window.scrollTo({ top: 0, left: 0, behavior: motionOK() ? 'smooth' : 'auto' })
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      data-cursor="Top"
      className={cn(
        'group relative inline-flex size-14 shrink-0 items-center justify-center rounded-full',
        'text-ink-muted transition-colors hover:text-ink',
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-line transition-colors group-hover:text-line-strong"
        />
        <circle
          ref={ringRef}
          cx="28"
          cy="28"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={0}
          className="text-accent"
        />
      </svg>
      <Icon
        name="ArrowUp"
        className="relative size-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
      />
    </button>
  )
}

/* -------------------------------------------------------------------------- *
 * Links with a travelling arrow
 * -------------------------------------------------------------------------- */

const ARROW = 'size-3.5 shrink-0 text-ink-faint transition-[transform,color] duration-300 ease-out'

function PageLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex min-h-8 items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
    >
      <span>{children}</span>
      <Icon name="ArrowRight" className={cn(ARROW, 'group-hover:translate-x-1 group-hover:text-accent')} />
    </Link>
  )
}

/* -------------------------------------------------------------------------- *
 * Footer
 * -------------------------------------------------------------------------- */

/**
 * The bottom of every public page.
 *
 * Three columns, a hello line with the back-to-top ring, then the name at the
 * size of a billboard — hollow until the pointer crosses it, when it fills with
 * ink. The last row is the quiet corner where the dashboard link lives: a
 * visitor never needs it, and the owner opens it every day.
 *
 * The whole thing rises in four beats (`Stagger`) as it enters the viewport;
 * under reduced motion it is simply there.
 */
export function PublicFooter() {
  const year = new Date().getFullYear()
  const time = useKharagpurTime()
  const footerRef = useRef<HTMLElement>(null)
  const nameRef = useRef<HTMLParagraphElement>(null)
  const nameWords = profile.name.split(' ')

  // The billboard name drifts up a little slower than the page carrying it.
  useGSAP(
    () => {
      const name = nameRef.current
      if (!name) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion || !c.desktop) return

        gsap.fromTo(
          name,
          { yPercent: 12 },
          {
            yPercent: 0,
            ease: 'none',
            scrollTrigger: { trigger: name, start: 'top bottom', end: 'bottom bottom', scrub: true },
          },
        )
      })
    },
    { scope: footerRef },
  )

  return (
    <footer ref={footerRef} className="relative mt-auto overflow-hidden border-t border-line bg-canvas">
      <Stagger className="mx-auto w-full max-w-7xl px-5 pt-20 pb-8 sm:px-8 sm:pt-28 lg:px-12">
        {/* 1 — columns */}
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-8">
          <div className="min-w-0">
            <Link
              to={PUBLIC_ROUTES.home}
              className="inline-block font-display text-xl font-semibold text-ink transition-colors hover:text-accent"
            >
              {profile.name}
            </Link>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-muted">
              {profile.headline}
            </p>
            {profile.availability ? (
              <p className="mt-5 inline-flex items-center gap-2.5 text-sm text-ink-muted">
                <span aria-hidden="true" className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-positive" />
                </span>
                {profile.availability}
              </p>
            ) : null}
          </div>

          <nav aria-labelledby="footer-nav-heading" className="min-w-0">
            <h2 id="footer-nav-heading" className={EYEBROW}>
              Pages
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-1">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <PageLink to={item.href}>{item.label}</PageLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <h2 className={EYEBROW}>Elsewhere</h2>
            <ul className="mt-4 space-y-1">
              {profile.socials.map((social) => {
                const external = !social.href.startsWith('mailto:')
                return (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="group inline-flex min-h-8 max-w-full items-center gap-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      <span className="text-ink-faint transition-colors group-hover:text-accent">
                        <SocialGlyph id={social.id} />
                      </span>
                      <span>{social.label}</span>
                      <span className="truncate font-mono text-xs text-ink-faint">{social.handle}</span>
                      <Icon
                        name="ArrowUpRight"
                        className={cn(
                          ARROW,
                          'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent',
                        )}
                      />
                      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        {/* 2 — hello line + back to top */}
        <div className="mt-20 flex flex-wrap items-end justify-between gap-6 border-t border-line pt-10 sm:mt-24">
          <div className="min-w-0">
            <p className={EYEBROW}>Say hello</p>
            <a
              href={`mailto:${profile.email}`}
              data-cursor="Write"
              className={cn(
                'group mt-3 inline-flex max-w-full items-center gap-3 break-all',
                'font-display text-[clamp(1.375rem,3.5vw,2.75rem)] leading-none font-medium text-ink',
                'transition-colors hover:text-accent',
              )}
            >
              <span>{profile.email}</span>
              <Icon
                name="ArrowUpRight"
                className="size-[0.7em] shrink-0 text-ink-faint transition-[transform,color] duration-300 ease-out group-hover:translate-x-[0.1em] group-hover:-translate-y-[0.1em] group-hover:text-accent"
              />
            </a>
          </div>
          <BackToTop />
        </div>

        {/* 3 — the billboard */}
        <div className="mt-10 sm:mt-14">
          <h2 className="sr-only">{profile.name}</h2>
          <p
            ref={nameRef}
            aria-hidden="true"
            className={cn(
              'font-display text-center text-[clamp(4rem,18vw,16rem)] leading-none font-semibold text-ink select-none',
              // Hollow by default, solid on hover. Fill colour rather than
              // `color: transparent`, so the stroke — which reads currentColor —
              // keeps the ink token.
              '[-webkit-text-stroke:1px_currentColor] [-webkit-text-fill-color:transparent]',
              'transition-[-webkit-text-fill-color] duration-700 ease-out',
              'hover:[-webkit-text-fill-color:currentColor]',
            )}
          >
            {nameWords.map((word, index) => (
              <span key={`${word}-${index}`} className="block whitespace-nowrap">
                {word}
              </span>
            ))}
          </p>
        </div>

        {/* 4 — the quiet row */}
        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-ink-faint sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
          <p>
            © <span className="tabular-nums">{year}</span> {profile.name}
          </p>
          <p>Built with React, TypeScript, GSAP</p>
          <p className={cn(EYEBROW, 'tabular-nums')}>
            Kharagpur <span aria-hidden="true">·</span> {time} IST
          </p>
          <Link
            to={PERSONAL_ROUTES.dashboard}
            className="inline-flex min-h-8 items-center gap-1.5 transition-colors hover:text-ink"
          >
            <Icon name="Lock" size={12} />
            Dashboard
          </Link>
        </div>
      </Stagger>
    </footer>
  )
}
