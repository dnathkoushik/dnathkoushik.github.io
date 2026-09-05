/**
 * The optional at-rest privacy lock.
 *
 * WHAT THIS ACTUALLY PROTECTS — read this before trusting it with anything:
 *
 *   It encrypts the private database *while it is sitting in this browser's
 *   IndexedDB / localStorage*. If someone opens your laptop, opens DevTools and
 *   reads the storage for this origin, they see ciphertext instead of your
 *   journal. That is the whole of it.
 *
 *   It is NOT authentication. This site is a static bundle served from a CDN;
 *   there is no server, no session and no access control. Anyone can open
 *   /dashboard — the lock only means the database they find there is unreadable
 *   without the passphrase. It cannot protect you from malicious code running
 *   on this origin, from a compromised machine, or from someone watching you
 *   type.
 *
 *   The key is derived in the browser and never leaves it. There is no
 *   recovery: lose the passphrase and the data is gone. Export a JSON backup
 *   from Settings before turning the lock on.
 *
 * Implementation: WebCrypto only, zero dependencies. PBKDF2-SHA256 with
 * 310,000 iterations (OWASP's floor for PBKDF2-HMAC-SHA256) derives an
 * AES-GCM-256 key. `crypto.subtle` needs a secure context, which GitHub Pages
 * (https) and localhost both are.
 */

/** Envelope version. Bump alongside any change to the wire format below. */
export const CRYPTO_VERSION = 1

export const PBKDF2_ITERATIONS = 310_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256

/** Plaintext round-tripped through the verifier blob to detect a bad key. */
const VERIFIER_PLAINTEXT = 'pos.lock.v1'

/**
 * Self-describing ciphertext. The salt travels with the payload so a backup can
 * still be opened after the local lock metadata is gone. Every field is base64.
 */
export interface EncryptedEnvelope {
  v: typeof CRYPTO_VERSION
  salt: string
  iv: string
  data: string
}

export type CryptoErrorCode = 'unsupported' | 'wrong-passphrase' | 'malformed'

/** Typed failure so the UI can tell "wrong passphrase" from "broken file". */
export class CryptoError extends Error {
  readonly code: CryptoErrorCode

  constructor(message: string, code: CryptoErrorCode) {
    super(message)
    this.name = 'CryptoError'
    this.code = code
  }
}

/* -------------------------------------------------------------------------- *
 * Primitives
 * -------------------------------------------------------------------------- */

function subtle(): SubtleCrypto {
  const webcrypto = globalThis.crypto
  if (!webcrypto || !webcrypto.subtle) {
    throw new CryptoError(
      'This browser does not expose Web Crypto, so the privacy lock is unavailable.',
      'unsupported',
    )
  }
  return webcrypto.subtle
}

/** True when the privacy lock can be offered at all. */
export function isCryptoAvailable(): boolean {
  try {
    return Boolean(globalThis.crypto && globalThis.crypto.subtle)
  } catch {
    return false
  }
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const webcrypto = globalThis.crypto
  if (!webcrypto || typeof webcrypto.getRandomValues !== 'function') {
    throw new CryptoError('This browser cannot generate secure random values.', 'unsupported')
  }
  const bytes = new Uint8Array(length)
  webcrypto.getRandomValues(bytes)
  return bytes
}

/** A fresh PBKDF2 salt, base64 encoded and ready to store. */
export function randomSalt(): string {
  return toBase64(randomBytes(SALT_BYTES))
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new CryptoError('Encrypted payload is not valid base64.', 'malformed')
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/* -------------------------------------------------------------------------- *
 * Key derivation
 * -------------------------------------------------------------------------- */

/**
 * PBKDF2-SHA256 to AES-GCM-256. `salt` is either raw bytes or the base64 string
 * kept in the lock metadata.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array | string): Promise<CryptoKey> {
  if (!passphrase) {
    throw new CryptoError('A passphrase is required.', 'malformed')
  }
  // Copied into a fresh buffer so the type is the ArrayBuffer-backed view
  // WebCrypto insists on, whatever the caller handed us.
  const saltBytes = typeof salt === 'string' ? fromBase64(salt) : new Uint8Array(salt)
  const material = await subtle().importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle().deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: KEY_BITS },
    // Extractable, so an unlocked key can be parked in sessionStorage for the
    // life of the tab. personalData.ts documents that trade-off.
    true,
    ['encrypt', 'decrypt'],
  )
}

/** Serialises a derived key so a reload inside the same tab can reuse it. */
export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await subtle().exportKey('raw', key)
  return toBase64(new Uint8Array(raw))
}

export async function importKey(value: string): Promise<CryptoKey> {
  return subtle().importKey('raw', fromBase64(value), { name: 'AES-GCM', length: KEY_BITS }, true, [
    'encrypt',
    'decrypt',
  ])
}

/* -------------------------------------------------------------------------- *
 * Envelopes
 * -------------------------------------------------------------------------- */

export function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<EncryptedEnvelope>
  return (
    candidate.v === CRYPTO_VERSION &&
    typeof candidate.iv === 'string' &&
    typeof candidate.data === 'string' &&
    typeof candidate.salt === 'string'
  )
}

/**
 * Encrypts any JSON-serialisable value. `salt` is carried through untouched so
 * the envelope records which salt derived its key.
 */
export async function encryptJson<T>(
  key: CryptoKey,
  value: T,
  salt = '',
): Promise<EncryptedEnvelope> {
  const iv = randomBytes(IV_BYTES)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const cipher = await subtle().encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return {
    v: CRYPTO_VERSION,
    salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  }
}

/** Throws a `CryptoError` rather than returning garbage when the key is wrong. */
export async function decryptJson<T>(key: CryptoKey, envelope: EncryptedEnvelope): Promise<T> {
  if (!isEncryptedEnvelope(envelope)) {
    throw new CryptoError('This does not look like an encrypted payload.', 'malformed')
  }
  let plaintext: ArrayBuffer
  try {
    plaintext = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.data),
    )
  } catch (error) {
    if (error instanceof CryptoError) throw error
    // AES-GCM authentication failed: a wrong key, or tampered ciphertext.
    throw new CryptoError('That passphrase does not unlock this data.', 'wrong-passphrase')
  }
  try {
    return JSON.parse(new TextDecoder().decode(plaintext)) as T
  } catch {
    throw new CryptoError('Decrypted payload was not valid JSON.', 'malformed')
  }
}

/* -------------------------------------------------------------------------- *
 * Verifier
 *
 * A tiny blob encrypted with the same key and stored beside the lock metadata.
 * Checking it makes a wrong passphrase fail in milliseconds with a clear
 * message, instead of dragging the whole database through AES-GCM first.
 * -------------------------------------------------------------------------- */

export async function createVerifier(key: CryptoKey, salt: string): Promise<EncryptedEnvelope> {
  return encryptJson(key, VERIFIER_PLAINTEXT, salt)
}

export async function checkVerifier(key: CryptoKey, verifier: EncryptedEnvelope): Promise<boolean> {
  try {
    const value = await decryptJson<string>(key, verifier)
    return value === VERIFIER_PLAINTEXT
  } catch {
    return false
  }
}
