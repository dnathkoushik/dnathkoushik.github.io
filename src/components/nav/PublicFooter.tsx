import { createElement } from 'react'
import { Link } from 'react-router-dom'
import { PERSONAL_ROUTES, PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { profile } from '@/data'
import { brandIconFor } from '@/components/common/BrandIcons'
import { Icon } from '@/components/ui/Icon'

/**
 * Lucide fallbacks for the social ids that have no brand mark — email, a
 * personal site, a hosted CV. Anything unrecognised gets a generic link glyph
 * rather than a hole in the row.
 */
const FALLBACK_ICON: Record<string, string> = {
  email: 'Mail',
  mail: 'Mail',
  website: 'Globe',
  site: 'Globe',
  blog: 'BookOpen',
  resume: 'FileText',
  cv: 'FileText',
  phone: 'Phone',
}

/*
 * `brandIconFor` resolves a stable module-scope component, never a freshly
 * built one — it is called through `createElement` so that reads as data
 * rather than as a component defined mid-render.
 */
function SocialGlyph({ id }: { id: string }) {
  const brand = brandIconFor(id)
  if (brand) return createElement(brand, { className: 'size-4' })
  return <Icon name={FALLBACK_ICON[id.toLowerCase()] ?? 'Link'} className="size-4" />
}

/**
 * The bottom of every public page.
 *
 * Three columns on a wide screen, one on a phone. The last row is where the
 * dashboard link lives — a visitor never needs it, and the owner opens it every
 * day, so it belongs in the quietest corner of the page rather than the header
 * of a portfolio.
 */
export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          <div className="space-y-3">
            <Link
              to={PUBLIC_ROUTES.home}
              className="inline-block text-[15px] font-semibold tracking-tight text-ink transition-colors hover:text-accent"
            >
              {profile.name}
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-ink-muted">
              A portfolio of what I have built, and a private daily dashboard that never leaves this
              browser.
            </p>
          </div>

          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              Pages
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-1 sm:gap-y-2">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className="text-sm text-ink-muted transition-colors hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">
              Elsewhere
            </h2>
            <ul className="mt-4 space-y-2.5">
              {profile.socials.map((social) => {
                const external = !social.href.startsWith('mailto:')
                return (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="group inline-flex items-center gap-2.5 text-sm text-ink-muted transition-colors hover:text-ink"
                    >
                      <span className="text-ink-faint transition-colors group-hover:text-accent">
                        <SocialGlyph id={social.id} />
                      </span>
                      <span>{social.label}</span>
                      <span className="font-mono text-xs text-ink-faint">{social.handle}</span>
                      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            © <span className="tabular-nums">{year}</span> {profile.name}
          </p>
          <p className="text-xs text-ink-faint">Built with React, TypeScript and Tailwind</p>
          <Link
            to={PERSONAL_ROUTES.dashboard}
            className="inline-flex items-center gap-1.5 text-xs text-ink-faint transition-colors hover:text-ink"
          >
            <Icon name="Lock" size={12} />
            Dashboard
          </Link>
        </div>
      </div>
    </footer>
  )
}
