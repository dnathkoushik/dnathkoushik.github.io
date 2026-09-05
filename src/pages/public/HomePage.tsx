import { PUBLIC_ROUTES } from '@/config/routes'
import { profile, seo } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { Hero, publicHref } from '@/components/portfolio/Hero'
import { StatsBand } from '@/components/portfolio/StatsBand'
import { CurrentFocus } from '@/components/portfolio/CurrentFocus'
import { SkillsMarquee } from '@/components/portfolio/SkillsMarquee'
import { HomeHighlights } from '@/components/portfolio/HomeHighlights'
import { Magnetic, Reveal, Stagger, TextReveal } from '@/motion'

/**
 * The closing invitation. One line of display type — the last word carries the
 * only gradient on the page — and two ways forward.
 */
function ClosingCta() {
  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined

  return (
    <section
      aria-labelledby="home-closing"
      className="relative overflow-hidden border-t border-line py-28 sm:py-40"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint">Next</p>

        <TextReveal
          as="h2"
          id="home-closing"
          className="mt-6 max-w-[16ch] font-display text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] font-semibold tracking-tight text-ink"
        >
          Let’s build something <span className="text-gradient">deterministic.</span>
        </TextReveal>

        <Reveal
          as="p"
          delay={0.25}
          className="mt-8 max-w-[52ch] text-[15px] leading-relaxed text-ink-muted sm:text-base"
        >
          There is more background on the about page, and the fastest way to reach me is the
          contact page — or the address below.
        </Reveal>

        <Stagger className="mt-10 flex flex-wrap items-center gap-3">
          <div>
            <Magnetic>
              <ButtonLink
                to={PUBLIC_ROUTES.contact}
                variant="primary"
                size="lg"
                iconRight="ArrowRight"
              >
                Get in touch
              </ButtonLink>
            </Magnetic>
          </div>
          <div>
            <Magnetic>
              <ButtonLink to={PUBLIC_ROUTES.about} variant="secondary" size="lg">
                More about me
              </ButtonLink>
            </Magnetic>
          </div>
          {resumeHref ? (
            <div>
              <Magnetic strength={0.25}>
                <ButtonLink href={resumeHref} variant="ghost" size="lg" icon="Download">
                  Resume
                </ButtonLink>
              </Magnetic>
            </div>
          ) : null}
        </Stagger>

        <Reveal as="p" delay={0.4} className="mt-12 font-mono text-xs text-ink-muted">
          <a
            href={`mailto:${profile.email}`}
            data-cursor="Email"
            className="group relative inline-flex min-h-11 items-center rounded-sm transition-colors duration-200 hover:text-ink"
          >
            <span className="relative py-0.5">
              {profile.email}
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-px bg-line-strong"
              />
              <span
                aria-hidden="true"
                className="absolute inset-x-0 -bottom-px h-px origin-left scale-x-0 bg-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
              />
            </span>
          </a>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * The home page: the hero, four numbers, what I am doing right now, a band of
 * what I build with, three pieces of selected work, and an invitation.
 * Every word on it comes out of `src/data`; every section is full-bleed and
 * owns its own container.
 */
export default function HomePage() {
  useDocumentMeta({
    title: profile.name,
    description: seo.description,
    canonicalPath: PUBLIC_ROUTES.home,
  })

  return (
    <div>
      <Hero />
      <StatsBand />
      <CurrentFocus number={1} />
      <SkillsMarquee />
      <HomeHighlights />
      <ClosingCta />
    </div>
  )
}
