/**
 * Identifier generation.
 *
 * Ids are opaque — nothing in the app ever parses one. `crypto.randomUUID()` is
 * used wherever it exists (every browser this project targets, plus Node 19+);
 * the fallback combines a base-36 timestamp, a per-tick counter and random
 * characters so ids stay unique even in a non-secure context where
 * `crypto.randomUUID` is unavailable.
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Guarantees uniqueness for ids minted inside the same millisecond. */
let sequence = 0

function randomChars(length: number): string {
  let out = ''

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    for (let i = 0; i < length; i += 1) {
      out += ALPHABET[bytes[i] % ALPHABET.length]
    }
    return out
  }

  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

function fallbackId(): string {
  sequence = (sequence + 1) % 1_000_000
  return `${Date.now().toString(36)}${sequence.toString(36)}${randomChars(8)}`
}

/**
 * A collision-resistant identifier.
 *
 * @param prefix Optional namespace, joined with an underscore — `uid('task')`
 *   returns something like `task_9f1c8d0a...`. Prefixed ids make a raw JSON
 *   export readable without changing any behaviour.
 */
export function uid(prefix?: string): string {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : fallbackId()

  return prefix ? `${prefix}_${id}` : id
}
