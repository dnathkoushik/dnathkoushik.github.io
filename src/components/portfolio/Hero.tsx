import type { CSSProperties } from 'react'
import { asset } from '@/config/app'
import { PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { GithubIcon, brandIconFor } from '@/components/common/BrandIcons'

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

/*
 * The only decorative element on the site: a dot grid that fades out before it
 * reaches the paragraph. It paints in `currentColor` so it inherits the line
 * token and re-tints itself in dark mode, and the mask keeps it away from the
 * text entirely rather than relying on low opacity to stay out of the way.
 */
const DOT_GRID: CSSProperties = {
  backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
  backgroundSize: '26px 26px',
  maskImage: 'radial-gradient(110% 78% at 28% 0%, black 0%, transparent 70%)',
  WebkitMaskImage: 'radial-gradient(110% 78% at 28% 0%, black 0%, transparent 70%)',
}

export function Hero() {
  const github = profile.socials.find((social) => social.id === 'github')
  const resumeHref = profile.resumeUrl ? publicHref(profile.resumeUrl) : undefined
  const avatarSrc = profile.avatar ? publicHref(profile.avatar) : undefined

  // GitHub already has a button of its own, and email is what /contact is for.
  const secondarySocials = profile.socials.filter(
    (social) => social.id !== 'github' && social.id !== 'email',
  )

  return (
    <section aria-labelledby="hero-name" className="relative isolate pt-14 pb-14 sm:pt-20 sm:pb-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[26rem] text-line-strong"
        style={DOT_GRID}
      />

      <div className="animate-rise">
        <div className="flex items-center gap-4">
          <Avatar src={avatarSrc} initials={profile.initials} size={72} />

          <p className="flex min-w-0 items-center gap-1.5 font-mono text-xs text-ink-faint">
            <Icon name="MapPin" size={13} />
            {profile.location}
          </p>
        </div>

        <h1
          id="hero-name"
          className="mt-7 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl"
        >
          {profile.name}
        </h1>

        <p className="mt-3 max-w-[46ch] text-lg leading-snug font-medium text-balance text-ink-muted">
          {profile.headline}
        </p>

        <p className="mt-5 max-w-[62ch] text-[15px] leading-relaxed text-ink-muted">
          {profile.intro}
        </p>

        {profile.availability ? (
          <p className="mt-6 inline-flex max-w-[46ch] items-start gap-2.5 rounded-xl bg-positive-soft px-3 py-2 text-sm leading-snug font-medium text-ink ring-1 ring-positive/25 ring-inset">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-positive"
            />
            {profile.availability}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center gap-2.5 sm:gap-3">
          <ButtonLink to={PUBLIC_ROUTES.projects} variant="primary" iconRight="ArrowRight">
            View projects
          </ButtonLink>

          {github ? (
            <ButtonLink href={github.href} variant="secondary">
              <GithubIcon className="size-4" />
              GitHub
            </ButtonLink>
          ) : null}

          {resumeHref ? (
            <ButtonLink href={resumeHref} variant="secondary" icon="Download">
              Resume
            </ButtonLink>
          ) : null}

          <ButtonLink to={PUBLIC_ROUTES.contact} variant="ghost" icon="Mail">
            Contact
          </ButtonLink>
        </div>

        {secondarySocials.length > 0 ? (
          <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            {secondarySocials.map((social) => {
              const Brand = brandIconFor(social.id)
              return (
                <li key={social.id}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md text-sm text-ink-faint transition-colors duration-150 hover:text-ink"
                  >
                    {Brand ? (
                      <Brand className="size-4" />
                    ) : (
                      <Icon name="Link" size={16} />
                    )}
                    <span className="font-mono text-xs">{social.handle}</span>
                    <span className="sr-only"> on {social.label} (opens in a new tab)</span>
                  </a>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
