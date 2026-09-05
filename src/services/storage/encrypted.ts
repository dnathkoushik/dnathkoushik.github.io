/**
 * A decorator that encrypts whatever another adapter stores.
 *
 * `createEncryptedAdapter(inner, key)` returns something that satisfies the same
 * `StorageAdapter` contract, so nothing above it — the data service, the hooks,
 * the pages — knows or cares that the bytes on disk are ciphertext.
 *
 * The inner adapter is used as a dumb JSON document store here: what gets
 * handed to `inner.save` is an `EncryptedEnvelope`, not a `PersonalDatabase`.
 * The contract is typed for the common case, so the two casts below are the
 * price of keeping that contract small. They are safe because every adapter in
 * this folder round-trips arbitrary JSON.
 *
 * See `services/crypto.ts` for an honest description of what this protects.
 */
import { decryptJson, encryptJson, isEncryptedEnvelope } from '@/services/crypto'
import type { EncryptedEnvelope } from '@/services/crypto'
import type { PersonalDatabase, StorageAdapter } from '@/types'

export function createEncryptedAdapter(
  inner: StorageAdapter,
  key: CryptoKey,
  /** Base64 salt the key was derived from; stored inside each envelope. */
  salt = '',
): StorageAdapter {
  return {
    name: `${inner.name}, encrypted`,

    async load() {
      const stored = (await inner.load()) as unknown as EncryptedEnvelope | PersonalDatabase | null
      if (stored === null) return null
      if (!isEncryptedEnvelope(stored)) {
        // Plaintext written before the lock was switched on. Returning it lets
        // the service re-save through this adapter, which encrypts it in place.
        return stored as PersonalDatabase
      }
      return decryptJson<PersonalDatabase>(key, stored)
    },

    async save(db) {
      const envelope = await encryptJson(key, db, salt)
      await inner.save(envelope as unknown as PersonalDatabase)
    },

    async clear() {
      await inner.clear()
    },
  }
}
