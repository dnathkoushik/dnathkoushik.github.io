import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { gsap, useGSAP, motionOK, finePointer, INTERACTIVE_SELECTOR } from '@/motion/gsap'

/**
 * Custom cursor: an accent dot that tracks the pointer exactly and a hairline
 * ring that lags behind it.
 *
 * Over anything interactive the ring grows and the dot shrinks. Elements that
 * carry `data-cursor="Label"` grow the ring further, fill it with accent and
 * print the label inside; `data-cursor-size="lg"` makes it larger still.
 *
 * Renders nothing on touch devices, under reduced motion, and anywhere inside
 * the dashboard. It never blocks a click: every layer is pointer-events: none.
 * Native cursor hiding is a single class on <html> (see index.css).
 */

const RING_BASE = 36
const SIZE = { idle: 36, hover: 56, label: 88, lg: 120 } as const
const QUERIES = ['(prefers-reduced-motion: reduce)', '(hover: hover) and (pointer: fine)']

function cursorAllowed(): boolean {
  return motionOK() && finePointer()
}

export function Cursor() {
  const { pathname } = useLocation()
  const [allowed, setAllowed] = useState<boolean>(cursorAllowed)

  // Docking a laptop to a touch screen, or flipping reduce-motion, changes the
  // answer while the page is open.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const lists = QUERIES.map((query) => window.matchMedia(query)).filter(
      (list) => typeof list.addEventListener === 'function',
    )
    const onChange = () => setAllowed(cursorAllowed())
    lists.forEach((list) => list.addEventListener('change', onChange))
    return () => lists.forEach((list) => list.removeEventListener('change', onChange))
  }, [])

  if (!allowed || pathname.startsWith('/dashboard')) return null
  return <CursorLayer />
}

function CursorLayer() {
  const rootRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('has-custom-cursor')
    return () => root.classList.remove('has-custom-cursor')
  }, [])

  useGSAP(
    () => {
      const root = rootRef.current
      const dot = dotRef.current
      const ring = ringRef.current
      const fill = fillRef.current
      const label = labelRef.current
      if (!root || !dot || !ring || !fill || !label) return

      gsap.set([dot, ring, label], { xPercent: -50, yPercent: -50 })
      gsap.set(root, { autoAlpha: 0 })
      gsap.set([fill, label], { autoAlpha: 0 })

      const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' })
      const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' })
      const ringX = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' })
      const ringY = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' })
      const labelX = gsap.quickTo(label, 'x', { duration: 0.35, ease: 'power3' })
      const labelY = gsap.quickTo(label, 'y', { duration: 0.35, ease: 'power3' })

      let size: number = SIZE.idle
      let pressed = false
      let labelled = false
      let shown = false

      const applyRing = () => {
        gsap.to(ring, {
          scale: (size / RING_BASE) * (pressed ? 0.9 : 1),
          duration: 0.35,
          ease: 'power3.out',
          overwrite: 'auto',
        })
      }

      const apply = (next: number, text: string) => {
        const hasLabel = text.length > 0
        if (hasLabel) label.textContent = text
        if (next !== size || hasLabel !== labelled) {
          size = next
          labelled = hasLabel
          gsap.to([fill, label], {
            autoAlpha: hasLabel ? 1 : 0,
            duration: 0.3,
            ease: 'power3.out',
            overwrite: 'auto',
          })
          gsap.to(dot, {
            scale: hasLabel ? 0 : next === SIZE.idle ? 1 : 0.5,
            duration: 0.3,
            ease: 'power3.out',
            overwrite: 'auto',
          })
          applyRing()
        }
      }

      const resolve = (target: EventTarget | null) => {
        const el = target instanceof Element ? target : null
        const labelHost = el?.closest('[data-cursor]') ?? null
        const text = labelHost?.getAttribute('data-cursor')?.trim() ?? ''
        const sizeHost = el?.closest('[data-cursor-size]') ?? null
        const large = sizeHost?.getAttribute('data-cursor-size') === 'lg'
        const interactive = el?.closest(INTERACTIVE_SELECTOR) ?? null

        if (text) apply(large ? SIZE.lg : SIZE.label, text)
        else if (interactive) apply(large ? SIZE.lg : SIZE.hover, '')
        else apply(SIZE.idle, '')
      }

      const onMove = (event: MouseEvent) => {
        const { clientX: x, clientY: y } = event
        dotX(x)
        dotY(y)
        ringX(x)
        ringY(y)
        labelX(x)
        labelY(y)
        if (!shown) {
          shown = true
          gsap.to(root, { autoAlpha: 1, duration: 0.25, ease: 'power3.out', overwrite: 'auto' })
        }
      }
      const onOver = (event: MouseEvent) => resolve(event.target)
      const onLeave = () => {
        shown = false
        gsap.to(root, { autoAlpha: 0, duration: 0.25, ease: 'power3.out', overwrite: 'auto' })
      }
      const onDown = () => {
        pressed = true
        applyRing()
      }
      const onUp = () => {
        pressed = false
        applyRing()
      }

      const html = document.documentElement
      window.addEventListener('mousemove', onMove, { passive: true })
      document.addEventListener('mouseover', onOver, { passive: true })
      html.addEventListener('mouseleave', onLeave)
      window.addEventListener('mousedown', onDown, { passive: true })
      window.addEventListener('mouseup', onUp, { passive: true })
      window.addEventListener('blur', onLeave)

      return () => {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseover', onOver)
        html.removeEventListener('mouseleave', onLeave)
        window.removeEventListener('mousedown', onDown)
        window.removeEventListener('mouseup', onUp)
        window.removeEventListener('blur', onLeave)
      }
    },
    { scope: rootRef },
  )

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[110] opacity-0"
      style={{ visibility: 'hidden' }}
    >
      <div
        ref={ringRef}
        className="absolute top-0 left-0 size-9 rounded-full border border-ink-faint will-change-transform"
      >
        <div ref={fillRef} className="absolute inset-0 rounded-full bg-accent opacity-0" />
      </div>
      <div
        ref={dotRef}
        className="absolute top-0 left-0 size-2 rounded-full bg-accent will-change-transform"
      />
      <div
        ref={labelRef}
        className="absolute top-0 left-0 font-mono text-[11px] font-medium tracking-[0.18em] whitespace-nowrap uppercase text-accent-ink opacity-0"
      />
    </div>
  )
}
