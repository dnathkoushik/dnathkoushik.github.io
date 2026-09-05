import { useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { projects } from '@/data'
import { PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { ButtonLink } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Magnetic, Reveal, ScrambleText, Stagger, TextReveal } from '@/motion'
import { truncate } from '@/utils/format'
import { cn } from '@/lib/cn'

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const SECTION_TITLE =
  'font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[0.95] tracking-tight text-ink'

/*
 * Hollow type. `-webkit-text-fill-color` rather than `color: transparent`, so
 * the stroke — which reads `currentColor` — keeps the token colour.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

interface Hit {
  id: string
  to: string
  icon: string
  title: string
  hint: string
}

/**
 * 404.
 *
 * Calm rather than apologetic: it says which path was missing, offers the way
 * home, and — because the most likely reason anyone is here is a half-remembered
 * URL — searches the site's pages and projects in place. A project hit links
 * straight to that project's dialog, which /projects reads out of the query
 * string.
 */
export default function NotFoundPage() {
  const location = useLocation()
  const attempted = `${location.pathname}${location.search}`

  useDocumentMeta({
    title: 'Page not found',
    description: 'That page does not exist. Search the site or head back to the home page.',
    noindex: true,
  })

  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useKeyboardShortcut('/', (event) => {
    event.preventDefault()
    searchRef.current?.focus()
    searchRef.current?.select()
  })

  const needle = query.trim().toLowerCase()

  const hits = useMemo<Hit[]>(() => {
    if (needle.length < 2) return []

    const pages: Hit[] = PUBLIC_NAV.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(needle),
    ).map((item) => ({
      id: `page-${item.href}`,
      to: item.href,
      icon: item.icon,
      title: item.label,
      hint: item.description,
    }))

    const found: Hit[] = projects
      .filter((project) =>
        `${project.name} ${project.summary} ${project.technologies.join(' ')}`
          .toLowerCase()
          .includes(needle),
      )
      .map((project) => ({
        id: `project-${project.id}`,
        to: `${PUBLIC_ROUTES.projects}?project=${encodeURIComponent(project.id)}`,
        icon: 'FolderGit2',
        title: project.name,
        hint: truncate(project.summary, 80),
      }))

    return [...pages, ...found].slice(0, 8)
  }, [needle])

  return (
    <div>
      <section aria-label="Page not found" className="overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className={CONTAINER}>
          <p className={EYEBROW}>Error 404</p>

          <p
            aria-hidden="true"
            className="-ml-[0.03em] font-display text-[clamp(8rem,30vw,24rem)] leading-[0.85] font-medium tracking-tight text-line-strong select-none"
            style={OUTLINE}
          >
            404
          </p>

          <ScrambleText
            as="h1"
            text="That page is not here"
            trigger="mount"
            duration={1.4}
            className="mt-4 block font-display text-[clamp(2rem,5vw,4rem)] leading-[0.95] tracking-tight text-ink"
          />

          <Reveal
            as="p"
            delay={0.3}
            className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-muted"
          >
            The link is either out of date or was never real. Nothing is broken — this address just
            does not match anything on the site.
          </Reveal>

          <Reveal delay={0.4} className="mt-6 max-w-2xl">
            <p className="overflow-x-auto rounded-lg border border-line bg-surface-muted px-4 py-3 font-mono text-sm text-ink-muted">
              <span className="text-ink-faint select-none">requested&nbsp;&nbsp;</span>
              <span className="text-ink">{attempted}</span>
            </p>
          </Reveal>

          <Reveal delay={0.5} className="mt-8 flex flex-wrap gap-3">
            <Magnetic>
              <ButtonLink to={PUBLIC_ROUTES.home} variant="primary" size="lg" icon="House">
                Go home
              </ButtonLink>
            </Magnetic>
            <Magnetic>
              <ButtonLink
                to={PUBLIC_ROUTES.projects}
                variant="secondary"
                size="lg"
                icon="FolderGit2"
              >
                Browse the projects
              </ButtonLink>
            </Magnetic>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="notfound-search" className="py-12 sm:py-16">
        <div className={CONTAINER}>
          <div className="grid gap-8 border-t border-line pt-12 lg:grid-cols-12 lg:gap-12 sm:pt-16">
            <div className="lg:col-span-4">
              <TextReveal as="h2" id="notfound-search" className={SECTION_TITLE}>
                Search the site
              </TextReveal>
              <Reveal
                as="p"
                delay={0.2}
                className="mt-4 max-w-sm text-[15px] leading-relaxed text-ink-muted"
              >
                Two letters is enough. Press{' '}
                <kbd className="rounded border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-xs text-ink">
                  /
                </kbd>{' '}
                from anywhere on this page to jump here.
              </Reveal>
            </div>

            <Reveal delay={0.15} className="lg:col-span-8">
              <div className="surface-card p-5 sm:p-6">
                <Field label="Find a page or a project">
                  <div className="relative">
                    <Icon
                      name="Search"
                      size={16}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                    />
                    <Input
                      ref={searchRef}
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="projects, contact, Go, CRDT…"
                      autoComplete="off"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <div aria-live="polite" className="mt-4">
                  {needle.length < 2 ? (
                    <p className="text-sm text-ink-faint">
                      Type to search the {PUBLIC_NAV.length} public pages and every project on the
                      site.
                    </p>
                  ) : hits.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      Nothing matches “{truncate(query.trim(), 40)}”. Try a technology name, or a
                      word from a page title.
                    </p>
                  ) : (
                    <ul className="-mx-2 divide-y divide-line">
                      {hits.map((hit) => (
                        <li key={hit.id}>
                          <Link
                            to={hit.to}
                            data-cursor="Open"
                            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
                          >
                            <span
                              aria-hidden="true"
                              className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
                            >
                              <Icon name={hit.icon} size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-ink">
                                {hit.title}
                              </span>
                              <span className="block truncate text-xs text-ink-faint">
                                {hit.hint}
                              </span>
                            </span>
                            <Icon
                              name="ArrowRight"
                              size={14}
                              className="text-ink-faint transition-transform duration-200 group-hover:translate-x-1"
                            />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="notfound-sections" className="pb-24 sm:pb-36">
        <div className={CONTAINER}>
          <div className="border-t border-line pt-12 sm:pt-16">
            <TextReveal as="h2" id="notfound-sections" className={SECTION_TITLE}>
              Everything on the site
            </TextReveal>

            <Stagger as="ul" className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PUBLIC_NAV.map((item) => (
                <li key={item.href} className="flex min-w-0">
                  <Link
                    to={item.href}
                    data-cursor="Open"
                    className={cn(
                      'group flex h-full w-full items-start gap-3 rounded-card border border-line bg-surface p-4',
                      'transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover/50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
                    >
                      <Icon name={item.icon} size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg leading-none font-medium tracking-tight text-ink">
                        {item.label}
                      </span>
                      <span className="mt-1.5 block text-xs leading-relaxed text-ink-faint">
                        {item.description}
                      </span>
                    </span>
                    <Icon
                      name="ArrowUpRight"
                      size={15}
                      className="mt-0.5 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </Link>
                </li>
              ))}
            </Stagger>
          </div>
        </div>
      </section>
    </div>
  )
}
