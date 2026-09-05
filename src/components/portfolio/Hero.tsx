import { useRef } from 'react'
import type { CSSProperties } from 'react'
import { asset } from '@/config/app'
import { PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { GithubIcon, brandIconFor } from '@/components/common/BrandIcons'
import { HeroCanvas, Magnetic, Reveal, ScrambleText, TextReveal, onIntroDone } from '@/motion'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'

/**
 * Resolves a path that came out of `src/data`.
 *
 * Anything with a scheme (`https:`, `mailto:`) is already absolute and passes
 * straight through; everything else is a file in `public/` and has to be
 * resolved against the deployed base path, or it breaks on a project page.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function publicHref(path: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : asset(path)
}

/** The mono line above the name. Display copy, in the same register as the section eyebrows. */
const EYEBROW = 'Software Engineer · IIT Kharagpur'

/*
 * The avatar's halo: both accents, but only ever inside this gradient. It is
 * spun by GSAP (one long linear rotation), so the gradient itself is static.
 */
const RING: CSSProperties = {
  backgroundImage:
    'conic-gradient(from 0deg, var(--color-accent) 0deg, var(--color-accent-2) 130deg, transparent 210deg, transparent 300deg, var(--color-accent) 360deg)',
}

/**
 * The opening screen.
 *
 * Everything below is real content in its final state; motion is layered on
 * top. With motion on, `useGSAP` applies the hidden start states before the
 * first paint (so nothing flashes while the Preloader curtain is up) and the
 * entrance timeline is released by `onIntroDone` — immediately when the intro
 * has already run this session, or the moment the curtain announces it has
 * gone. The name, headline and intro are choreographed by their own TextReveal
 * / Reveal primitives, which coordinate with the intro the same way; this
 * component only owns the avatar, the status line, the CTA row, the socials
 * and the scroll cue.
 *
 * Under reduced motion none of this runs: every element is simply present.
 */
export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLParagraphElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)
  const cueInnerRef = useRef<HTMLDivElement>(null)
  const cueLineRef = useRef<HTMLSpanElement>(null)

  const github = profile.socials.find((social) => social.id === 'github')
  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined
  const avatarSrc = profile.avatar ? publicHref(profile.avatar) : undefined

  // GitHub already has a button of its own, and email is what /contact is for.
  const secondarySocials = profile.socials.filter(
    (social) => social.id !== 'github' && social.id !== 'email',
  )

  useGSAP(
    () => {
      const root = sectionRef.current
      if (!root) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const avatar = avatarRef.current
        const ring = ringRef.current
        const status = statusRef.current
        const cue = cueRef.current
        const cueInner = cueInnerRef.current
        const cueLine = cueLineRef.current
        const ctas = gsap.utils.toArray<HTMLElement>('[data-hero-cta]', root)
        const socials = gsap.utils.toArray<HTMLElement>('[data-hero-social]', root)

        /*
         * Entrance. Built paused: `fromTo` renders its start values at once, so
         * the hidden states are on screen before the intro curtain lifts. Times
         * are offsets from intro-done and interleave with the TextReveal delays
         * on the name (0.1), headline (0.5) and intro paragraph (0.8).
         */
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'house' } })
        if (avatar) {
          tl.fromTo(avatar, { scale: 0.72, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2 }, 0)
        }
        if (status) {
          tl.fromTo(status, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.25)
        }
        if (ctas.length > 0) {
          tl.fromTo(
            ctas,
            { y: 28, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, stagger: 0.08 },
            1.0,
          )
        }
        if (socials.length > 0) {
          tl.fromTo(
            socials,
            { y: 14, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.9, stagger: 0.06 },
            1.2,
          )
        }
        if (cueInner) {
          tl.fromTo(cueInner, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: 'power2.out' }, 1.6)
        }

        // The halo turns once every 24 seconds, forever.
        if (ring) {
          gsap.to(ring, { rotation: 360, duration: 24, ease: 'none', repeat: -1 })
        }

        // Scroll cue: a hairline that travels down its track and leaves through
        // the bottom, then repeats.
        if (cueLine) {
          gsap
            .timeline({ repeat: -1, repeatDelay: 0.35, defaults: { ease: 'house-in-out', duration: 0.9 } })
            .set(cueLine, { transformOrigin: 'top center', scaleY: 0 })
            .to(cueLine, { scaleY: 1 })
            .set(cueLine, { transformOrigin: 'bottom center' })
            .to(cueLine, { scaleY: 0 })
        }

        // The cue has done its job once the visitor scrolls; fade it over the
        // first 120px. A separate element from the entrance fade so the two
        // opacity tweens never fight.
        if (cue) {
          gsap.fromTo(
            cue,
            { autoAlpha: 1 },
            {
              autoAlpha: 0,
              ease: 'none',
              immediateRender: false,
              scrollTrigger: { start: 40, end: 160, scrub: true },
            },
          )
        }

        return onIntroDone(() => tl.play())
      })
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-name"
      className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden pt-28 pb-24"
    >
      <HeroCanvas />

      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        {/* Avatar with its halo, and the eyebrow row. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div ref={avatarRef} className="relative size-24 shrink-0">
            <div
              ref={ringRef}
              aria-hidden="true"
              className="absolute inset-0 rounded-full will-change-transform"
              style={RING}
            />
            <div aria-hidden="true" className="absolute inset-[3px] rounded-full bg-canvas" />
            <Avatar
              src={avatarSrc}
              initials={profile.initials}
              size={88}
              className="absolute inset-1 ring-0"
            />
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
            <ScrambleText
              as="p"
              text={EYEBROW}
              trigger="mount"
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint"
            />

            {profile.availability ? (
              <p
                ref={statusRef}
                className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted"
              >
                <span aria-hidden="true" className="relative flex size-2 shrink-0">
                  <span className="absolute inset-0 rounded-full bg-positive opacity-60 motion-safe:animate-ping" />
                  <span className="relative size-2 rounded-full bg-positive" />
                </span>
                {profile.availability}
              </p>
            ) : null}
          </div>
        </div>

        {/* The name. One word per line on phones, one line from lg — the wrap is natural. */}
        <TextReveal
          as="h1"
          id="hero-name"
          type="chars"
          trigger="mount"
          stagger={0.028}
          delay={0.1}
          className="mt-8 font-display text-[clamp(3.5rem,12vw,11rem)] leading-[0.9] font-bold tracking-[-0.045em] text-ink"
        >
          {profile.name}
        </TextReveal>

        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="min-w-0 lg:col-span-7">
            <TextReveal
              as="p"
              type="lines"
              trigger="mount"
              delay={0.5}
              className="max-w-[32ch] font-display text-[clamp(1.375rem,2.4vw,1.875rem)] leading-[1.15] font-medium tracking-tight text-ink"
            >
              {profile.headline}
            </TextReveal>

            <Reveal
              as="p"
              trigger="mount"
              delay={0.8}
              className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-ink-muted sm:text-base"
            >
              {profile.intro}
            </Reveal>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <div data-hero-cta="">
                <Magnetic>
                  <ButtonLink
                    to={PUBLIC_ROUTES.projects}
                    variant="primary"
                    size="lg"
                    iconRight="ArrowRight"
                  >
                    View projects
                  </ButtonLink>
                </Magnetic>
              </div>

              {github ? (
                <div data-hero-cta="">
                  <Magnetic>
                    <ButtonLink href={github.href} variant="secondary" size="lg">
                      <GithubIcon className="size-[18px]" />
                      GitHub
                    </ButtonLink>
                  </Magnetic>
                </div>
              ) : null}

              {resumeHref ? (
                <div data-hero-cta="">
                  <Magnetic>
                    <ButtonLink href={resumeHref} variant="secondary" size="lg" icon="Download">
                      Resume
                    </ButtonLink>
                  </Magnetic>
                </div>
              ) : null}

              <div data-hero-cta="">
                <Magnetic strength={0.25}>
                  <ButtonLink to={PUBLIC_ROUTES.contact} variant="ghost" size="lg" icon="Mail">
                    Contact
                  </ButtonLink>
                </Magnetic>
              </div>
            </div>
          </div>

          {secondarySocials.length > 0 ? (
            <ul
              aria-label="Elsewhere"
              className="flex flex-wrap items-center gap-x-7 gap-y-1 lg:col-span-5 lg:justify-end"
            >
              {secondarySocials.map((social) => {
                const Brand = brandIconFor(social.id)
                return (
                  <li key={social.id} data-hero-social="">
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex min-h-11 items-center gap-2 rounded-sm font-mono text-xs text-ink-muted transition-colors duration-200 hover:text-ink"
                    >
                      {Brand ? (
                        <Brand className="size-3.5" />
                      ) : (
                        <Icon name="Link" size={14} />
                      )}
                      <span className="relative py-0.5">
                        {social.handle}
                        {/* Resting underline: the affordance that survives motion-off. */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 -bottom-px h-px bg-line-strong"
                        />
                        {/* Accent underline that slides in from the left on hover / focus. */}
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
                        />
                      </span>
                      <span className="sr-only"> on {social.label} (opens in a new tab)</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Scroll cue. Decorative, desktop-and-motion only; fades as soon as the page moves. */}
      <div
        ref={cueRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-6 hidden justify-center sm:motion-safe:flex"
      >
        <div ref={cueInnerRef} className="flex flex-col items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-faint">
            scroll
          </span>
          <span className="block h-10 w-px overflow-hidden bg-line">
            <span ref={cueLineRef} className="block h-full w-px bg-ink will-change-transform" />
          </span>
        </div>
      </div>
    </section>
  )
}
