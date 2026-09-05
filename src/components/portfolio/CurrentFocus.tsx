import { useId, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { currentFocus } from '@/data'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Parallax, Reveal, SectionNumber, Stagger, TextReveal, armAfterIntro } from '@/motion'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { cn } from '@/lib/cn'

export interface CurrentFocusProps {
  /** Id for the section heading, so the `<section>` can point at it. */
  id?: string
  className?: string
  /** Outlined section numeral above the heading. Omit (as /about does) to show the eyebrow alone. */
  number?: number
}

/* Hollow numerals: fill cleared with text-fill-color so the currentColor stroke survives. */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

const OPEN_EASE = 'ease-[cubic-bezier(0.16,1,0.3,1)]'

/**
 * The "currently working on" list, shared by the home page and /about.
 *
 * A full-bleed section that owns its own container and vertical rhythm. The
 * four items are numbered rows; each row's detail is folded away and opens on
 * hover, on keyboard focus and on tap (a real disclosure button, so it is
 * reachable everywhere). The fold is a CSS grid-rows transition — it needs no
 * JavaScript, and under reduced motion it snaps.
 *
 * Motion layer: the rows stagger in, each label slides out of a line mask,
 * and the hairline above every row draws in from the left as it enters.
 */
export function CurrentFocus({ id = 'current-focus', className, number }: CurrentFocusProps) {
  const baseId = useId()
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const list = listRef.current
      if (!list) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const rules = gsap.utils.toArray<HTMLElement>('[data-rule]', list)
        if (rules.length === 0) return

        const cancels = rules.map((rule) => {
          const draw = gsap.from(rule, {
            scaleX: 0,
            transformOrigin: 'left center',
            duration: 1.4,
            ease: 'house-in-out',
            paused: true,
          })
          return armAfterIntro(draw, { trigger: 'scroll', element: rule, once: true, ctx })
        })

        return () => cancels.forEach((cancel) => cancel())
      })
    },
    { scope: listRef },
  )

  return (
    <section aria-labelledby={id} className={cn('relative py-24 sm:py-36', className)}>
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-4">
            {number !== undefined ? (
              <Parallax speed={-0.15}>
                <SectionNumber n={number} label="Right now" />
              </Parallax>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                Right now
              </p>
            )}

            <TextReveal
              as="h2"
              id={id}
              className="mt-6 font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink"
            >
              Currently working on
            </TextReveal>

            <Reveal
              as="p"
              delay={0.2}
              className="mt-5 max-w-[38ch] text-[15px] leading-relaxed text-ink-muted"
            >
              The four things getting my attention this season. This list changes; a stale one
              would be worse than none.
            </Reveal>
          </div>

          <div className="min-w-0 lg:col-span-8">
            {currentFocus.length === 0 ? (
              <EmptyState
                icon="Target"
                title="Nothing listed yet"
                description="The current-focus list is empty."
              />
            ) : (
              <div ref={listRef} className="relative">
                <Stagger as="ol" stagger={0.1} y={28} className="list-none">
                  {currentFocus.map((item, index) => {
                    const detailId = `${baseId}-detail-${index}`
                    const open = openIndex === index

                    return (
                      <li
                        key={item.label}
                        data-open={open || undefined}
                        className="group relative"
                      >
                        <span
                          data-rule=""
                          aria-hidden="true"
                          className="absolute inset-x-0 top-0 h-px bg-line-strong"
                        />

                        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-4 py-7 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:gap-x-8 sm:py-9">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'pt-1.5 font-mono text-xl leading-none text-ink-muted transition-colors duration-300 sm:text-2xl',
                              'group-hover:text-accent group-focus-within:text-accent group-data-open:text-accent',
                            )}
                            style={OUTLINE}
                          >
                            {String(index + 1).padStart(2, '0')}
                          </span>

                          <h3 className="min-w-0 font-display text-[clamp(1.5rem,3vw,2.5rem)] leading-[1.05] font-medium tracking-tight text-ink">
                            <TextReveal as="span" delay={index * 0.08} className="block">
                              {item.label}
                            </TextReveal>
                          </h3>

                          {item.detail ? (
                            /*
                             * Stretched over the whole row (the `li` is the
                             * positioned ancestor) so a tap anywhere toggles it,
                             * while the focus stop stays a sensible 44px disc.
                             */
                            <button
                              type="button"
                              onClick={() => setOpenIndex(open ? null : index)}
                              aria-expanded={open}
                              aria-controls={detailId}
                              className={cn(
                                'grid size-11 place-items-center rounded-full text-ink-faint transition-colors duration-200',
                                'group-hover:text-ink group-focus-within:text-ink group-data-open:text-ink',
                                "after:absolute after:inset-0 after:content-['']",
                              )}
                            >
                              <Icon
                                name="Plus"
                                size={18}
                                className={cn(
                                  'transition-transform duration-500',
                                  OPEN_EASE,
                                  'group-hover:rotate-45 group-focus-within:rotate-45 group-data-open:rotate-45',
                                )}
                              />
                              <span className="sr-only">
                                {open ? 'Hide' : 'Show'} details for {item.label}
                              </span>
                            </button>
                          ) : null}

                          {item.detail ? (
                            <div
                              id={detailId}
                              className={cn(
                                'col-span-2 col-start-2 grid grid-rows-[0fr] transition-[grid-template-rows] duration-500',
                                OPEN_EASE,
                                'group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] group-data-open:grid-rows-[1fr]',
                              )}
                            >
                              <div className="min-h-0 overflow-hidden">
                                <p
                                  className={cn(
                                    'max-w-[58ch] pt-4 text-[15px] leading-relaxed text-ink-muted opacity-0 transition-opacity duration-500 sm:pt-5',
                                    'group-hover:opacity-100 group-focus-within:opacity-100 group-data-open:opacity-100',
                                  )}
                                >
                                  {item.detail}
                                </p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </Stagger>

                {/* Closing hairline, drawn like the others. */}
                <span
                  data-rule=""
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px bg-line-strong"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
