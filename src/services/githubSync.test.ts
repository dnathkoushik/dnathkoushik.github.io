// @vitest-environment jsdom
/**
 * The GitHub Contents API takes base64, and `btoa` throws on anything outside
 * latin1. A journal entry with an em dash, a rupee sign or an emoji is exactly
 * that — so this is the one part of the sync path that silently breaks on real
 * writing rather than on test data.
 */
import { describe, expect, it } from 'vitest'
import { commitMessage, decodeBase64, encodeBase64 } from '@/services/githubSync'
import { createEmptyDatabase } from '@/services/defaults'

describe('base64 transport', () => {
  const cases: [string, string][] = [
    ['plain ascii', 'Solved two array problems today.'],
    ['em dash and quotes', 'Read the paper — it was “denser” than expected.'],
    ['emoji', 'Shipped it 🚀 finally 😮‍💨'],
    ['rupee and accents', '₹1,200 for the café résumé printing'],
    ['devanagari', 'आज का लक्ष्य पूरा हुआ'],
    ['bengali', 'আজকের কাজ শেষ'],
    ['json with newlines', '{\n  "note": "line one\\nline two"\n}\n'],
  ]

  it.each(cases)('round-trips %s', (_name, text) => {
    expect(decodeBase64(encodeBase64(text))).toBe(text)
  })

  it('produces base64 that GitHub will accept', () => {
    const encoded = encodeBase64('Shipped it 🚀')
    expect(encoded).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('survives a payload larger than one chunk', () => {
    // The encoder batches through String.fromCharCode, which blows the argument
    // limit if the chunking is wrong. A year of entries is comfortably past it.
    const big = 'কাজ — 🚀 '.repeat(20_000)
    expect(decodeBase64(encodeBase64(big))).toBe(big)
  })

  it('tolerates the newlines GitHub puts in the content it returns', () => {
    const encoded = encodeBase64('hello world')
    const wrapped = encoded.replace(/(.{4})/g, '$1\n')
    expect(decodeBase64(wrapped)).toBe('hello world')
  })
})

describe('commit messages', () => {
  it('summarises what is in the database', () => {
    const db = createEmptyDatabase()
    const message = commitMessage(db, new Date('2026-09-05T09:30:00Z'))
    expect(message).toContain('dashboard: sync 2026-09-05 09:30')
    expect(message).toContain('empty')
  })

  it('counts records once there are some', () => {
    const db = createEmptyDatabase()
    db.tasks = [{ id: 't1' }] as unknown as typeof db.tasks
    db.notes = [{ id: 'n1' }, { id: 'n2' }] as unknown as typeof db.notes
    const message = commitMessage(db, new Date('2026-09-05T09:30:00Z'))
    expect(message).toContain('1 tasks')
    expect(message).toContain('2 notes')
  })
})
