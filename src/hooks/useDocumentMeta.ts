import { useEffect } from 'react'
import { BASE_URL } from '@/config/app'
import { profile, seo } from '@/data'

export interface DocumentMeta {
  /** Page title. ' | <profile name>' is appended unless it is already there. */
  title: string
  description?: string
  /** Dashboard pages pass true so the private surface is never indexed. */
  noindex?: boolean
  /** Route path, e.g. '/projects'. Omit when the page has no canonical URL. */
  canonicalPath?: string
}

/** Undoes exactly one head mutation. */
type Restore = () => void

const TITLE_SUFFIX = ` | ${profile.name}`

/**
 * Absolute URL for a route: deployment origin + the Vite base path + the route.
 * Both halves are normalised so a base of '/' and of '/repo/' behave the same.
 */
function absoluteUrl(path: string): string {
  const origin = seo.siteUrl.replace(/\/+$/, '')
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  return `${origin}${base.startsWith('/') ? base : `/${base}`}${path.replace(/^\/+/, '')}`
}

/**
 * Points an existing head element at a new value, or creates one, and hands
 * back the function that puts things exactly as they were.
 */
function setHeadValue(
  selector: string,
  create: () => HTMLElement,
  attribute: string,
  value: string,
): Restore {
  const existing = document.head.querySelector<HTMLElement>(selector)
  if (existing) {
    const previous = existing.getAttribute(attribute)
    existing.setAttribute(attribute, value)
    return () => {
      if (previous === null) existing.removeAttribute(attribute)
      else existing.setAttribute(attribute, previous)
    }
  }

  const element = create()
  element.setAttribute(attribute, value)
  document.head.appendChild(element)
  return () => element.remove()
}

function namedMeta(name: string, content: string): Restore {
  return setHeadValue(
    `meta[name="${name}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute('name', name)
      return el
    },
    'content',
    content,
  )
}

function propertyMeta(property: string, content: string): Restore {
  return setHeadValue(
    `meta[property="${property}"]`,
    () => {
      const el = document.createElement('meta')
      el.setAttribute('property', property)
      return el
    },
    'content',
    content,
  )
}

function canonicalLink(href: string): Restore {
  return setHeadValue(
    'link[rel="canonical"]',
    () => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      return el
    },
    'href',
    href,
  )
}

/**
 * Owns the document head for the page that calls it. Every tag it touches is
 * restored on unmount, so navigating away can never leave a stale description,
 * a stale canonical URL, or — the one that actually matters — a stale
 * `noindex` from the dashboard on a public page.
 */
export function useDocumentMeta({ title, description, noindex, canonicalPath }: DocumentMeta) {
  useEffect(() => {
    const restores: Restore[] = []

    const previousTitle = document.title
    const fullTitle =
      title === profile.name || title.endsWith(TITLE_SUFFIX) ? title : `${title}${TITLE_SUFFIX}`
    document.title = fullTitle
    restores.push(() => {
      document.title = previousTitle
    })

    restores.push(namedMeta('robots', noindex ? 'noindex, nofollow' : 'index, follow'))
    restores.push(propertyMeta('og:title', fullTitle))

    if (description) {
      restores.push(namedMeta('description', description))
      restores.push(propertyMeta('og:description', description))
    }

    if (canonicalPath !== undefined) {
      const url = absoluteUrl(canonicalPath)
      restores.push(canonicalLink(url))
      restores.push(propertyMeta('og:url', url))
    }

    return () => {
      // Unwind in reverse so nested creations are removed before their edits.
      for (let i = restores.length - 1; i >= 0; i -= 1) restores[i]()
    }
  }, [title, description, noindex, canonicalPath])
}
