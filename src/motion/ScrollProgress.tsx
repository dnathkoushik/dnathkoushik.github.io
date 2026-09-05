import { useRef, useState } from 'react'
import { gsap, useGSAP, motionOK } from '@/motion/gsap'

/**
 * Two-pixel accent bar along the very top of the viewport whose width is the
 * reader's progress through the document. Scrubbed with a little lag so it
 * glides rather than ticks. Not rendered at all under reduced motion.
 */
export function ScrollProgress() {
  const [enabled] = useState<boolean>(() => motionOK())
  const barRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const bar = barRef.current
      if (!bar || !enabled) return
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        },
      )
    },
    { scope: barRef },
  )

  if (!enabled) return null

  return (
    <div
      ref={barRef}
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[95] h-[2px] w-full origin-left bg-accent"
      style={{ transform: 'scaleX(0)' }}
    />
  )
}
