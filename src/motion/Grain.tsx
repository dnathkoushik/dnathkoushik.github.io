import { useState } from 'react'
import { motionOK } from '@/motion/gsap'
import { cn } from '@/lib/cn'

/**
 * Film grain over the whole page. A single SVG turbulence tile, repeated on a
 * layer three times the viewport, nudged around by the `grain` keyframes in
 * index.css in ten discrete steps — the jump is what reads as grain rather than
 * as a drifting texture.
 *
 * Purely decorative: aria-hidden, pointer-events none, overlay-blended, and low
 * enough in opacity that it never touches contrast. Under reduced motion the
 * tile is still there, static and at half strength.
 */

const NOISE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>" +
  "<filter id='n' x='0' y='0' width='100%' height='100%'>" +
  "<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/>" +
  "<feColorMatrix type='saturate' values='0'/>" +
  '</filter>' +
  "<rect width='100%' height='100%' filter='url(#n)'/>" +
  '</svg>'

const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`

export function Grain() {
  const [animate] = useState<boolean>(() => motionOK())

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-0 z-[80] overflow-hidden mix-blend-overlay',
        animate ? 'opacity-[0.035] dark:opacity-[0.055]' : 'opacity-[0.018] dark:opacity-[0.028]',
      )}
    >
      <div
        className="absolute -inset-full h-[300%] w-[300%]"
        style={{
          backgroundImage: NOISE_URL,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
          animation: animate ? 'grain 8s steps(10) infinite' : 'none',
          willChange: animate ? 'transform' : undefined,
        }}
      />
    </div>
  )
}
