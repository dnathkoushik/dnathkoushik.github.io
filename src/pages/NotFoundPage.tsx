import { useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { projects } from '@/data'
import { PUBLIC_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { truncate } from '@/utils/format'

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
    <div className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="max-w-2xl">
        <PageHeader
          eyebrow="Error 404"
          title="That page is not here"
          description="The link is either out of date or was never real. Nothing is broken — this address just does not match anything on the site."
        />

        <p className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface-muted px-4 py-3 font-mono text-sm text-ink-muted">
          <span className="text-ink-faint select-none">requested&nbsp;&nbsp;</span>
          <span className="text-ink">{attempted}</span>
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink to={PUBLIC_ROUTES.home} variant="primary" icon="House">
            Go home
          </ButtonLink>
          <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
            Browse the projects
          </ButtonLink>
        </div>
      </div>

      <section aria-labelledby="notfound-search" className="mt-14 animate-rise">
        <h2 id="notfound-search" className="text-lg font-semibold tracking-tight text-ink">
          Search the site
        </h2>

        <Card className="mt-4">
          <CardContent className="space-y-4">
            <Field
              label="Find a page or a project"
              hint="Two letters is enough. Press / from anywhere on this page to jump here."
            >
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

            <div aria-live="polite">
              {needle.length < 2 ? (
                <p className="text-sm text-ink-faint">
                  Type to search the {PUBLIC_NAV.length} public pages and every project on the
                  site.
                </p>
              ) : hits.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Nothing matches “{truncate(query.trim(), 40)}”. Try a technology name, or a word
                  from a page title.
                </p>
              ) : (
                <ul className="-mx-2 divide-y divide-line">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        to={hit.to}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
                      >
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
                        >
                          <Icon name={hit.icon} size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink">{hit.title}</span>
                          <span className="block truncate text-xs text-ink-faint">{hit.hint}</span>
                        </span>
                        <Icon name="ArrowRight" size={14} className="text-ink-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="notfound-sections" className="mt-14 animate-rise">
        <h2 id="notfound-sections" className="text-lg font-semibold tracking-tight text-ink">
          Everything on the site
        </h2>

        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PUBLIC_NAV.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className="flex h-full items-start gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover/50"
              >
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
                >
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
