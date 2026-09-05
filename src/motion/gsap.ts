/**
 * The single place GSAP is configured.
 *
 * Every motion component imports `gsap` and its plugins from HERE, never from
 * 'gsap' directly. That guarantees plugins are registered exactly once, keeps
 * the global defaults (ease, duration) consistent, and gives us one seam to
 * disable motion for people who asked for less of it.
 *
 * Nothing in this module touches the DOM at import time, so it is safe to load
 * in tests and on the server. It is only ever imported by the public portfolio;
 * the dashboard does not use GSAP at all.
 */
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { CustomEase } from 'gsap/CustomEase'
import { useGSAP } from '@gsap/react'

/*
 * ScrollTrigger reads `window.matchMedia` the moment it is registered (for its
 * reduced-motion default) and does not guard the call. jsdom has no matchMedia,
 * and neither did a generation of Android WebViews, so registering the plugin
 * there throws on import and takes every public page down with it. A minimal
 * "matches nothing" stand-in keeps the module loadable; every consumer in this
 * codebase already treats a non-matching query as "motion off / not desktop".
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  const inert = (media: string): MediaQueryList =>
    ({
      matches: false,
      media,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
  window.matchMedia = inert
}

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, CustomEase, useGSAP)

/*
 * House easing. One expressive curve used for almost every entrance so the site
 * moves like one thing rather than a collection of demos. Registered once so
 * components can say `ease: 'house'`.
 */
if (!CustomEase.get('house')) {
  CustomEase.create('house', 'M0,0 C0.16,1 0.3,1 1,1')
}
if (!CustomEase.get('house-in-out')) {
  CustomEase.create('house-in-out', 'M0,0 C0.65,0 0.35,1 1,1')
}

gsap.defaults({ ease: 'house', duration: 1 })

// Lenis drives scrolling, so ScrollTrigger must not fight it with its own
// lag-smoothing heuristics.
gsap.ticker.lagSmoothing(0)

/* -------------------------------------------------------------------------- *
 * Capability checks
 *
 * These are functions, not constants, because a media query can change while
 * the page is open (a user toggling reduce-motion in system settings) and a
 * component may mount before `window` exists.
 * -------------------------------------------------------------------------- */

/** True when the visitor has NOT asked for reduced motion. */
export function motionOK(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** True on devices where hover and a fine pointer are the norm (not phones). */
export function finePointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

/** Desktop breakpoint, kept in one place so pinned sections and the nav agree. */
export const DESKTOP_QUERY = '(min-width: 1024px)'

export function isDesktop(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(DESKTOP_QUERY).matches
}

/**
 * The conditions `gsap.matchMedia()` should branch on. Components call
 * `gsap.matchMedia().add(MOTION_CONDITIONS, (ctx) => { const { motion, desktop } = ctx.conditions })`
 * and get correct cleanup when any condition flips.
 */
export const MOTION_CONDITIONS = {
  motion: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
  desktop: DESKTOP_QUERY,
  mobile: '(max-width: 1023px)',
} as const

export type MotionConditions = { [K in keyof typeof MOTION_CONDITIONS]: boolean }

/** Selector for anything the custom cursor should react to. */
export const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, textarea, select, summary, [data-cursor], [data-magnetic]'

export { gsap, ScrollTrigger, SplitText, ScrambleTextPlugin, CustomEase, useGSAP }
