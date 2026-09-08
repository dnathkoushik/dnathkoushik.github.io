/**
 * Message templates and compose links.
 *
 * Nothing here sends anything. `composeLinks` builds `mailto:` and Gmail
 * "compose" URLs that open the user's own client pre-filled; the touch is
 * logged separately by the page. Pure functions only — no DOM, no storage.
 */
import type { Company } from '@/types'

/** The placeholders a template may use, as `{{name}}` etc. */
export const TEMPLATE_VARIABLES = ['name', 'company', 'role', 'hook', 'me'] as const
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]

/** Values for the placeholders. Keys are matched case-insensitively; blanks count as missing. */
export type TemplateVars = Record<string, string | undefined>

export interface RenderedTemplate {
  subject: string
  body: string
  /** Placeholder names (lower-case) that had no value. Their tokens are left in the text. */
  missing: string[]
}

export interface ComposeLinks {
  mailto: string
  gmail: string
}

export interface ResearchLink {
  label: string
  href: string
  /** Icon name from `components/ui/Icon.tsx`. */
  icon: string
}

/** `{{ name }}` — whitespace inside the braces is tolerated. */
const TOKEN_RE = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g

/** Unique placeholder names in order of first appearance, lower-cased. */
export function extractVariables(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of text.matchAll(TOKEN_RE)) {
    const key = match[1].toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}

function normaliseNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

/** Three or more consecutive blank lines become two. */
function collapseBlankLines(text: string): string {
  return normaliseNewlines(text).replace(/\n(?:[ \t]*\n){3,}/g, '\n\n\n')
}

/**
 * Fills every `{{var}}` from `vars`. Keys match case-insensitively and values
 * are trimmed; a variable with no (non-blank) value is reported in `missing`
 * and its token is left in place so the user can see what still needs filling.
 */
export function renderTemplate(
  template: { subject?: string; body: string },
  vars: TemplateVars,
): RenderedTemplate {
  const lookup = new Map<string, string>()
  for (const [key, raw] of Object.entries(vars)) {
    const value = (raw ?? '').trim()
    if (value) lookup.set(key.trim().toLowerCase(), value)
  }

  const missing: string[] = []
  const fill = (text: string): string =>
    text.replace(TOKEN_RE, (token: string, name: string) => {
      const key = name.toLowerCase()
      const value = lookup.get(key)
      if (value === undefined) {
        if (!missing.includes(key)) missing.push(key)
        return token
      }
      return value
    })

  const subject = fill(template.subject ?? '')
  const body = collapseBlankLines(fill(template.body))
  return { subject, body, missing }
}

/**
 * Pre-filled compose URLs. Everything is `encodeURIComponent`-ed, so newlines
 * travel as `%0A` and `&` in the text cannot break the query string. The
 * recipient keeps `@` and `,` readable in the `mailto:` path, where they are
 * legal as-is.
 */
export function composeLinks(input: { to?: string; subject: string; body: string }): ComposeLinks {
  const to = (input.to ?? '').trim()
  const subject = encodeURIComponent(normaliseNewlines(input.subject))
  const body = encodeURIComponent(normaliseNewlines(input.body))
  const encodedTo = encodeURIComponent(to)
  const mailtoTo = encodedTo.replace(/%40/g, '@').replace(/%2C/g, ',')

  return {
    mailto: `mailto:${mailtoTo}?subject=${subject}&body=${body}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${subject}&body=${body}`,
  }
}

/** "acme.com" → "https://acme.com"; anything already carrying a scheme is untouched. */
function withScheme(url: string): string {
  const value = url.trim()
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
}

/**
 * Where to look a company up, in the order worth clicking. Entries that need
 * a URL the company record does not have are omitted rather than left broken.
 * The Wellfound entry goes through a site-restricted Google search because
 * Wellfound's own search URLs are not stable.
 */
export function researchLinks(company: Company): ResearchLink[] {
  const name = company.name.trim()
  const q = encodeURIComponent
  const links: ResearchLink[] = []

  if (name) {
    links.push({
      label: 'People on LinkedIn',
      href: `https://www.linkedin.com/search/results/people/?keywords=${q(`${name} software engineer`)}`,
      icon: 'Users',
    })
  }

  if (company.linkedinUrl?.trim()) {
    links.push({ label: 'LinkedIn page', href: withScheme(company.linkedinUrl), icon: 'Building2' })
  } else if (name) {
    links.push({
      label: 'Company on LinkedIn',
      href: `https://www.linkedin.com/search/results/companies/?keywords=${q(name)}`,
      icon: 'Building2',
    })
  }

  if (company.careersUrl?.trim()) {
    links.push({ label: 'Careers page', href: withScheme(company.careersUrl), icon: 'Briefcase' })
  }
  if (company.website?.trim()) {
    links.push({ label: 'Website', href: withScheme(company.website), icon: 'Globe' })
  }

  if (name) {
    links.push(
      { label: 'Google News', href: `https://news.google.com/search?q=${q(name)}`, icon: 'Search' },
      { label: 'Crunchbase', href: `https://www.crunchbase.com/textsearch?q=${q(name)}`, icon: 'Rocket' },
      {
        label: 'Wellfound',
        href: `https://www.google.com/search?q=${q(`site:wellfound.com ${name}`)}`,
        icon: 'Compass',
      },
    )
  }

  return links
}
