/**
 * Syncing the private database to a GitHub repository.
 *
 * WHY IT WORKS THIS WAY
 *
 * GitHub Pages is static, so there is no server of ours to hold the data. The
 * GitHub REST API is CORS-enabled, though, which means the browser can commit
 * the database straight to a repository as long as the person sitting at it
 * supplies a token. That gives multi-device sync and durable backup without a
 * backend, and every write is an ordinary commit you can read, diff or revert.
 *
 * THE TOKEN
 *
 * It is entered by hand in Settings and kept in this browser's localStorage. It
 * is NEVER bundled, committed, or included in an export. A fine-grained PAT
 * scoped to a single repository with `Contents: read and write` is all this
 * needs — do not give it more. Anyone with access to this browser profile can
 * read it, which is the honest limit of a tokens-in-the-client design.
 *
 * CONFLICTS
 *
 * The whole database is one JSON document, and every write carries the blob
 * `sha` we last saw:
 *
 *   - remote sha unchanged  -> fast-forward. We push our document wholesale,
 *                              so deletions propagate correctly.
 *   - remote sha changed    -> a genuine concurrent edit on another device. We
 *                              pull, merge record-by-record with the newest
 *                              `updatedAt` winning, then push the result.
 *
 * The merge path cannot distinguish "deleted here" from "not yet seen here", so
 * a record deleted on device A while device B was editing offline can come
 * back. That is the one trade of a document-per-user design, it only applies to
 * true concurrent edits, and the UI says so.
 */
import type { PersonalDatabase } from '@/types'
import { STORAGE_PREFIX } from '@/config/app'

const API = 'https://api.github.com'
const API_VERSION = '2022-11-28'

export const SYNC_STORAGE_KEY = `${STORAGE_PREFIX}.sync`

export interface GithubSyncConfig {
  owner: string
  repo: string
  branch: string
  /** Path of the JSON document inside the repository. */
  path: string
  /** Fine-grained PAT. Lives only in this browser. */
  token: string
}

export type SyncState = 'disconnected' | 'idle' | 'syncing' | 'error'

export interface SyncStatus {
  state: SyncState
  /** ISO timestamp of the last successful push or pull. */
  lastSyncedAt?: string
  /** Human-readable failure, shown in Settings. */
  error?: string
  /** True when local changes have not reached GitHub yet. */
  pending: boolean
  /** Short sha of the last commit we made, for the "view on GitHub" link. */
  lastCommitSha?: string
}

export class GithubSyncError extends Error {
  readonly status: number
  readonly hint: string

  constructor(message: string, status: number, hint: string) {
    super(message)
    this.name = 'GithubSyncError'
    this.status = status
    this.hint = hint
  }
}

/* -------------------------------------------------------------------------- *
 * Base64 that survives non-ASCII
 *
 * `btoa` throws on anything outside latin1, and a journal entry with an em dash
 * or an emoji is exactly that. Round-tripping through TextEncoder keeps the
 * bytes intact.
 * -------------------------------------------------------------------------- */

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/* -------------------------------------------------------------------------- *
 * Config persistence
 * -------------------------------------------------------------------------- */

export function readSyncConfig(): GithubSyncConfig | null {
  try {
    const raw = localStorage.getItem(SYNC_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<GithubSyncConfig>
    if (!parsed.owner || !parsed.repo || !parsed.token) return null
    return {
      owner: parsed.owner,
      repo: parsed.repo,
      branch: parsed.branch || 'main',
      path: parsed.path || 'dashboard.json',
      token: parsed.token,
    }
  } catch {
    return null
  }
}

export function writeSyncConfig(config: GithubSyncConfig | null): void {
  try {
    if (config) localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(config))
    else localStorage.removeItem(SYNC_STORAGE_KEY)
  } catch {
    // Storage blocked. Sync simply will not be remembered across reloads.
  }
}

/* -------------------------------------------------------------------------- *
 * REST helpers
 * -------------------------------------------------------------------------- */

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': API_VERSION,
  }
}

/** Turns GitHub's status codes into something a person can act on. */
function explain(status: number, body: string, config: GithubSyncConfig): GithubSyncError {
  const where = `${config.owner}/${config.repo}`
  if (status === 401) {
    return new GithubSyncError(
      'GitHub rejected the token.',
      status,
      'It may be expired or mistyped. Generate a new fine-grained token and paste it again.',
    )
  }
  if (status === 403) {
    return new GithubSyncError(
      'GitHub refused the request.',
      status,
      `The token is valid but not allowed to write to ${where}. Check that its Repository access includes this repo and that Contents is set to "Read and write".`,
    )
  }
  if (status === 404) {
    return new GithubSyncError(
      `Could not find ${where}.`,
      status,
      'Check the owner and repository name. A fine-grained token also returns 404 for a private repo it has not been granted access to.',
    )
  }
  if (status === 409 || status === 422) {
    return new GithubSyncError(
      'The file changed on GitHub while this device was writing.',
      status,
      'This is handled automatically by merging and retrying.',
    )
  }
  return new GithubSyncError(
    `GitHub returned ${status}.`,
    status,
    body.slice(0, 200) || 'No further detail was provided.',
  )
}

interface RemoteFile {
  content: string
  sha: string
}

/** Reads the document. Resolves null when the file does not exist yet. */
export async function fetchRemote(config: GithubSyncConfig): Promise<RemoteFile | null> {
  const url = `${API}/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(config.path)}?ref=${encodeURIComponent(config.branch)}`
  const response = await fetch(url, { headers: headers(config.token) })

  if (response.status === 404) return null
  if (!response.ok) throw explain(response.status, await response.text(), config)

  const json = (await response.json()) as { content?: string; sha: string; encoding?: string }
  if (!json.content) return { content: '', sha: json.sha }
  return { content: decodeBase64(json.content), sha: json.sha }
}

/** Writes the document. `sha` must be the blob we based this edit on. */
export async function pushRemote(
  config: GithubSyncConfig,
  content: string,
  sha: string | undefined,
  message: string,
): Promise<{ sha: string; commitSha: string }> {
  const url = `${API}/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(config.path)}`
  const response = await fetch(url, {
    method: 'PUT',
    headers: { ...headers(config.token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      branch: config.branch,
      ...(sha ? { sha } : {}),
    }),
  })

  if (!response.ok) throw explain(response.status, await response.text(), config)

  const json = (await response.json()) as {
    content: { sha: string }
    commit: { sha: string }
  }
  return { sha: json.content.sha, commitSha: json.commit.sha }
}

/** Cheap credential check for the "Test connection" button in Settings. */
export async function verifyAccess(
  config: GithubSyncConfig,
): Promise<{ ok: true; private: boolean; defaultBranch: string } | { ok: false; error: GithubSyncError }> {
  try {
    const response = await fetch(`${API}/repos/${config.owner}/${config.repo}`, {
      headers: headers(config.token),
    })
    if (!response.ok) {
      return { ok: false, error: explain(response.status, await response.text(), config) }
    }
    const json = (await response.json()) as {
      private: boolean
      default_branch: string
      permissions?: { push?: boolean }
    }
    if (json.permissions && json.permissions.push === false) {
      return {
        ok: false,
        error: new GithubSyncError(
          'The token can read this repository but not write to it.',
          403,
          'Set Contents to "Read and write" on the token.',
        ),
      }
    }
    return { ok: true, private: json.private, defaultBranch: json.default_branch }
  } catch (error) {
    return {
      ok: false,
      error: new GithubSyncError(
        'Could not reach GitHub.',
        0,
        error instanceof Error ? error.message : 'Check your network connection.',
      ),
    }
  }
}

/** A commit message that says what actually changed. */
export function commitMessage(db: PersonalDatabase, at: Date): string {
  const counts = [
    db.tasks.length && `${db.tasks.length} tasks`,
    db.logs.length && `${db.logs.length} logs`,
    db.weeklyGoals.length + db.monthlyGoals.length &&
      `${db.weeklyGoals.length + db.monthlyGoals.length} goals`,
    db.notes.length && `${db.notes.length} notes`,
  ].filter(Boolean)

  const stamp = at.toISOString().slice(0, 16).replace('T', ' ')
  return `dashboard: sync ${stamp}\n\n${counts.join(', ') || 'empty'}`
}
