import { describe, expect, it } from 'vitest'
import type { Company } from '@/types'
import {
  TEMPLATE_VARIABLES,
  composeLinks,
  extractVariables,
  renderTemplate,
  researchLinks,
} from '@/utils/templates'

function company(overrides: Partial<Company> = {}): Company {
  return {
    id: 'acme',
    name: 'Acme Labs',
    kind: 'startup',
    remote: true,
    facts: [],
    fit: {},
    priority: 'medium',
    tags: [],
    archived: false,
    createdAt: '2026-08-01T06:30:00.000Z',
    updatedAt: '2026-08-01T06:30:00.000Z',
    ...overrides,
  }
}

describe('extractVariables', () => {
  it('returns unique names in order of appearance, case-insensitively', () => {
    expect(extractVariables('Hi {{name}}, {{ Company }} wants {{role}} — {{NAME}}')).toEqual([
      'name',
      'company',
      'role',
    ])
    expect(extractVariables('no tokens here')).toEqual([])
    expect(TEMPLATE_VARIABLES).toEqual(['name', 'company', 'role', 'hook', 'me'])
  })
})

describe('renderTemplate', () => {
  it('fills known variables and leaves missing tokens in place', () => {
    const out = renderTemplate(
      { subject: '{{role}} at {{company}}', body: 'Hi {{name}},\n\n{{hook}}\n\n{{me}}' },
      { Name: '  Jane ', company: 'Acme', role: 'Backend Intern', hook: '', me: 'Koushik' },
    )
    expect(out.subject).toBe('Backend Intern at Acme')
    expect(out.body).toBe('Hi Jane,\n\n{{hook}}\n\nKoushik')
    expect(out.missing).toEqual(['hook'])
  })

  it('collapses three or more blank lines to two and keeps two as-is', () => {
    const three = renderTemplate({ body: 'a\n\n\n\nb' }, {})
    expect(three.body).toBe('a\n\n\nb')
    const two = renderTemplate({ body: 'a\n\n\nb' }, {})
    expect(two.body).toBe('a\n\n\nb')
    const whitespace = renderTemplate({ body: 'a\r\n  \r\n\r\n\t\r\nb' }, {})
    expect(whitespace.body).toBe('a\n\n\nb')
    expect(three.subject).toBe('')
  })
})

describe('composeLinks', () => {
  it('encodes newlines and ampersands in both links', () => {
    const links = composeLinks({
      to: 'jane@acme.com',
      subject: 'R&D intern',
      body: 'Hi Jane,\nLine two & three',
    })
    expect(links.mailto).toBe(
      'mailto:jane@acme.com?subject=R%26D%20intern&body=Hi%20Jane%2C%0ALine%20two%20%26%20three',
    )
    expect(links.gmail).toBe(
      'https://mail.google.com/mail/?view=cm&fs=1&to=jane%40acme.com&su=R%26D%20intern&body=Hi%20Jane%2C%0ALine%20two%20%26%20three',
    )
    expect(links.mailto).not.toContain('\n')
  })

  it('tolerates a missing recipient and CRLF bodies', () => {
    const links = composeLinks({ subject: 's', body: 'a\r\nb' })
    expect(links.mailto).toBe('mailto:?subject=s&body=a%0Ab')
    expect(links.gmail).toContain('&to=&su=s&body=a%0Ab')
  })
})

describe('researchLinks', () => {
  it('omits links whose URL is not on the record', () => {
    const labels = researchLinks(company()).map((link) => link.label)
    expect(labels).toEqual([
      'People on LinkedIn',
      'Company on LinkedIn',
      'Google News',
      'Crunchbase',
      'Wellfound',
    ])
  })

  it('adds careers and website when set, normalising a bare domain', () => {
    const links = researchLinks(
      company({ website: 'acme.com', careersUrl: 'https://acme.com/jobs', linkedinUrl: 'https://www.linkedin.com/company/acme' }),
    )
    expect(links.find((link) => link.label === 'Website')?.href).toBe('https://acme.com')
    expect(links.find((link) => link.label === 'Careers page')?.href).toBe('https://acme.com/jobs')
    expect(links.find((link) => link.label === 'LinkedIn page')?.href).toBe(
      'https://www.linkedin.com/company/acme',
    )
    expect(links[0].href).toContain(encodeURIComponent('Acme Labs software engineer'))
    expect(links.every((link) => link.icon.length > 0)).toBe(true)
  })
})
