import { PUBLIC_ROUTES } from '@/config/routes'
import { profile, seo } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Hero, publicHref } from '@/components/portfolio/Hero'
import { CurrentFocus } from '@/components/portfolio/CurrentFocus'
import { HomeHighlights } from '@/components/portfolio/HomeHighlights'

/**
 * The home page: who I am, what I am doing right now, and three reasons to
 * keep reading. Everything on it comes out of `src/data`.
 */
export default function HomePage() {
  useDocumentMeta({
    title: profile.name,
    description: seo.description,
    canonicalPath: PUBLIC_ROUTES.home,
  })

  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined

  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <Hero />

      <div className="space-y-16 pb-20 sm:space-y-24 sm:pb-28">
        <CurrentFocus />

        <HomeHighlights />

        <section aria-labelledby="home-closing" className="animate-rise">
          <Card>
            <CardContent className="flex flex-col gap-5 pt-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1.5">
                <h2 id="home-closing" className="text-lg font-semibold tracking-tight text-ink">
                  Want the longer version?
                </h2>
                <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
                  There is more background on the about page, and the fastest way to reach me is on
                  the contact page.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                <ButtonLink to={PUBLIC_ROUTES.about} variant="primary" iconRight="ArrowRight">
                  About me
                </ButtonLink>
                {resumeHref ? (
                  <ButtonLink href={resumeHref} variant="secondary" icon="Download">
                    Resume
                  </ButtonLink>
                ) : null}
                <ButtonLink to={PUBLIC_ROUTES.contact} variant="ghost" icon="Mail">
                  Contact
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
