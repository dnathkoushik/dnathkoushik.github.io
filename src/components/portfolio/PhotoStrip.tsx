import { useRef } from 'react'
import { photos } from '@/data'
import { gsap, useGSAP, DESKTOP_QUERY, MOTION_CONDITIONS } from '@/motion/gsap'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import type { MotionConditions } from '@/motion/gsap'
import { Parallax, Reveal, SectionNumber, TextReveal, TiltCard } from '@/motion'
import { PhotoFrame } from '@/components/portfolio/PhotoFrame'
import { cn } from '@/lib/cn'

/*
 * Per-frame layout, in display order. Widths are on a 24-col feel; rotations
 * and vertical offsets alternate so the row reads as prints laid on a table
 * rather than a carousel. The landscape shot gets the widest slot.
 */
const LAYOUT: { w: string; rot: string; lift: string; focus?: string }[] = [
  { w: 'w-[15.5rem] xl:w-[17rem]', rot: '-rotate-[2.2deg]', lift: 'mt-10', focus: '65% 35%' },
  { w: 'w-[14rem] xl:w-[15.5rem]', rot: 'rotate-[1.6deg]', lift: 'mt-0' },
  { w: 'w-[16rem] xl:w-[18rem]', rot: '-rotate-[1deg]', lift: 'mt-16' },
  { w: 'w-[22rem] xl:w-[25rem]', rot: 'rotate-[1.2deg]', lift: 'mt-4' },
  { w: 'w-[14rem] xl:w-[15.5rem]', rot: '-rotate-[1.8deg]', lift: 'mt-12' },
  { w: 'w-[15rem] xl:w-[16.5rem]', rot: 'rotate-[2deg]', lift: 'mt-2', focus: '50% 70%' },
]

export interface PhotoStripProps {
  /** Outlined section numeral. */
  number?: number
  className?: string
}

/**
 * "Field notes": the owner's own photographs, full-bleed.
 *
 * This is the section that makes the site a person's rather than a product's.
 * On desktop the row is wider than the viewport and drifts sideways as you
 * scroll past it (a scrubbed translate, nothing pinned); each print tilts to
 * the pointer. On phones it is a two-column mosaic. With motion off it is a
 * static row of well-captioned photographs — which is the whole point anyway.
 */
export function PhotoStrip({ number = 3, className }: PhotoStripProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Render ONE layout, not both with the other display:none. Hidden frames
  // still create ScrollTriggers, and a `once` trigger on a zero-size element
  // fires and kills itself during ScrollTrigger's refresh pass — mutating the
  // trigger list under a sibling that is mid-construction and crashing it
  // ("Cannot read properties of undefined (reading 'end')"). One layout also
  // means six <img> elements instead of twelve.
  const desktop = useMediaQuery(DESKTOP_QUERY)

  useGSAP(
    () => {
      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion || !c.desktop) return

        // Drift the whole row from a little right of centre to a little left as
        // the section crosses the viewport. Percent-based so it scales with the
        // track, ease none so it tracks the thumb exactly.
        gsap.fromTo(
          track,
          { xPercent: 4 },
          {
            xPercent: -10,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 0.6,
              invalidateOnRefresh: true,
            },
          },
        )
      })
    },
    { scope: sectionRef },
  )

  if (photos.length === 0) return null

  return (
    <section
      ref={sectionRef}
      aria-labelledby="photos-title"
      className={cn('relative overflow-hidden py-24 sm:py-36', className)}
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <Parallax speed={-0.15}>
              <SectionNumber n={number} label="Field notes" />
            </Parallax>
          </div>
          <div className="lg:col-span-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
              Off the terminal
            </p>
            <TextReveal
              as="h2"
              id="photos-title"
              className="mt-3 font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink"
            >
              Not all of it happens in an editor.
            </TextReveal>
            <Reveal as="p" delay={0.25} className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
              A summer in Hyderabad, a desk that went up and down, a mascot that had to be
              photographed. The work is in the projects; this is the rest of it.
            </Reveal>
          </div>
        </div>
      </div>

      {desktop ? (
          /* Desktop: one long row, wider than the page, drifting with the scroll. */
          <div className="mt-14">
          <div
            ref={trackRef}
            className="flex w-max items-start gap-7 pr-[10vw] pl-[calc(50vw-40rem)] will-change-transform xl:gap-9"
          >
            {photos.map((photo, i) => {
              const slot = LAYOUT[i % LAYOUT.length]
              return (
                <TiltCard
                  key={photo.id}
                  max={5}
                  glare
                  className={cn('shrink-0', slot.w, slot.lift, slot.rot, 'transition-transform duration-500 hover:rotate-0 hover:z-10')}
                >
                  <PhotoFrame
                    photo={photo}
                    focus={slot.focus}
                    sizes="(min-width: 1280px) 25rem, 22rem"
                    className="[&_figcaption]:pr-1"
                  />
                </TiltCard>
              )
            })}
          </div>
        </div>
      ) : (
          /* Phones and tablets: a mosaic. The landscape frame takes the full row. */
          <div className="mx-auto mt-10 grid w-full max-w-7xl grid-cols-2 gap-3 px-5 sm:gap-5 sm:px-8">
          {photos.map((photo, i) => (
            <PhotoFrame
              key={photo.id}
              photo={photo}
              focus={LAYOUT[i % LAYOUT.length]?.focus}
              aspect={photo.width > photo.height ? undefined : '4 / 5'}
              sizes="(min-width: 640px) 45vw, 48vw"
              className={cn(photo.width > photo.height && 'col-span-2')}
            />
          ))}
          </div>
      )}
    </section>
  )
}
