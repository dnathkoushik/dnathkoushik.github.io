/**
 * Keeps the local database and the GitHub copy in step.
 *
 * Local IndexedDB stays the source of truth for everything the UI reads — the
 * dashboard must stay instant and must keep working on a train with no signal.
 * This layer sits above it and pushes the document to GitHub on a debounce,
 * pulls on load, and polls gently while the tab is visible so a second device's
 * commits arrive without a manual refresh.
 */
import { personalData } from '@/services/personalData'
import {
  commitMessage,
  fetchRemote,
  pushRemote,
  readSyncConfig,
  writeSyncConfig,
  GithubSyncError,
  type GithubSyncConfig,
  type SyncStatus,
} from '@/services/githubSync'
import { STORAGE_PREFIX } from '@/config/app'
import type { PersonalDatabase } from '@/types'

const STATE_KEY = `${STORAGE_PREFIX}.sync.state`

/** Idle time after a change before we commit. Long enough that typing a note
 *  is one commit, short enough that closing the laptop rarely loses a push. */
const PUSH_DEBOUNCE_MS = 8_000

/** How often to look for another device's commits while the tab is visible. */
const POLL_INTERVAL_MS = 5 * 60_000

/** Pretty-printed so the GitHub diff of a day's work is actually readable. */
function serialize(db: PersonalDatabase): string {
  return `${JSON.stringify(db, null, 2)}\n`
}

interface PersistedState {
  sha?: string
  lastSyncedAt?: string
}

function readState(): PersistedState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}') as PersistedState
  } catch {
    return {}
  }
}

function writeState(state: PersistedState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Non-fatal: we lose fast-forward detection and fall back to merging.
  }
}

export class SyncManager {
  private config: GithubSyncConfig | null = readSyncConfig()
  private status: SyncStatus = {
    state: this.config ? 'idle' : 'disconnected',
    pending: false,
    lastSyncedAt: readState().lastSyncedAt,
  }

  /** Blob sha of the version this device last agreed with. */
  private remoteSha: string | undefined = readState().sha
  /** Exact bytes we last pushed, so an unchanged database is never re-committed. */
  private lastPushed: string | undefined
  private listeners = new Set<() => void>()
  private pushTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private running: Promise<void> | null = null
  private started = false

  /* -- store surface ----------------------------------------------------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getStatus = (): SyncStatus => this.status

  getConfig = (): GithubSyncConfig | null => this.config

  private emit(patch: Partial<SyncStatus> = {}) {
    this.status = { ...this.status, ...patch }
    for (const listener of this.listeners) listener()
  }

  /* -- lifecycle --------------------------------------------------------- */

  /**
   * Called once the dashboard mounts. Pulls anything newer from GitHub, then
   * starts watching for local changes.
   */
  start = async (): Promise<void> => {
    if (this.started) return
    this.started = true

    personalData.subscribe(this.onLocalChange)

    document.addEventListener('visibilitychange', this.onVisibilityChange)
    window.addEventListener('pagehide', this.onPageHide)

    if (this.config) {
      this.pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void this.sync('poll')
      }, POLL_INTERVAL_MS)
      await this.sync('startup')
    }
  }

  stop = (): void => {
    document.removeEventListener('visibilitychange', this.onVisibilityChange)
    window.removeEventListener('pagehide', this.onPageHide)
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.started = false
  }

  private onVisibilityChange = () => {
    if (document.visibilityState === 'hidden' && this.status.pending) void this.sync('hidden')
  }

  private onPageHide = () => {
    // Best effort only — a fetch started here may not survive the unload.
    if (this.status.pending) void this.sync('unload')
  }

  private onLocalChange = () => {
    if (!this.config) return
    if (serialize(personalData.getSnapshot()) === this.lastPushed) return

    this.emit({ pending: true })
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => void this.sync('debounce'), PUSH_DEBOUNCE_MS)
  }

  /* -- connection management --------------------------------------------- */

  /**
   * Points this device at a repository.
   *
   * `adopt` decides what happens when the repository already holds data:
   *   'remote' — take GitHub's copy (what you want on a second device)
   *   'merge'  — combine both, newest edit per record winning
   *   'local'  — overwrite GitHub with what is on this device
   */
  connect = async (
    config: GithubSyncConfig,
    adopt: 'remote' | 'merge' | 'local',
  ): Promise<void> => {
    this.config = config
    writeSyncConfig(config)
    this.remoteSha = undefined
    this.lastPushed = undefined
    this.emit({ state: 'syncing', error: undefined })

    try {
      const remote = await fetchRemote(config)

      if (remote && remote.content.trim() && adopt !== 'local') {
        await personalData.importJson(remote.content, adopt === 'remote' ? 'replace' : 'merge')
        this.remoteSha = remote.sha
      } else if (remote) {
        this.remoteSha = remote.sha
      }

      await this.push(remote?.sha)

      if (!this.pollTimer) {
        this.pollTimer = setInterval(() => {
          if (document.visibilityState === 'visible') void this.sync('poll')
        }, POLL_INTERVAL_MS)
      }
    } catch (error) {
      this.fail(error)
      throw error
    }
  }

  disconnect = (): void => {
    this.config = null
    this.remoteSha = undefined
    this.lastPushed = undefined
    writeSyncConfig(null)
    writeState({})
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = null
    this.emit({ state: 'disconnected', pending: false, error: undefined, lastSyncedAt: undefined })
  }

  /* -- the sync itself ---------------------------------------------------- */

  /** Serialised: overlapping calls await the one already in flight. */
  sync = (reason: string): Promise<void> => {
    if (!this.config) return Promise.resolve()
    if (this.running) return this.running

    this.running = this.runSync(reason).finally(() => {
      this.running = null
    })
    return this.running
  }

  private async runSync(reason: string): Promise<void> {
    const config = this.config
    if (!config) return

    if (this.pushTimer) {
      clearTimeout(this.pushTimer)
      this.pushTimer = null
    }
    this.emit({ state: 'syncing', error: undefined })

    try {
      const remote = await fetchRemote(config)

      if (remote && remote.sha !== this.remoteSha && remote.content.trim()) {
        // Another device committed since we last agreed with GitHub. Merge
        // rather than clobber; newest `updatedAt` per record wins.
        await personalData.importJson(remote.content, 'merge')
      }

      await this.push(remote?.sha, reason)
    } catch (error) {
      this.fail(error)
    }
  }

  /** Writes the current local document, unless it is byte-identical already. */
  private async push(baseSha: string | undefined, reason = 'manual'): Promise<void> {
    const config = this.config
    if (!config) return

    const content = serialize(personalData.getSnapshot())

    if (content === this.lastPushed && baseSha === this.remoteSha) {
      this.remoteSha = baseSha
      this.emit({ state: 'idle', pending: false })
      return
    }

    const result = await pushRemote(
      config,
      content,
      baseSha,
      `${commitMessage(personalData.getSnapshot(), new Date())}\n\n[${reason}]`,
    )

    this.remoteSha = result.sha
    this.lastPushed = content
    const lastSyncedAt = new Date().toISOString()
    writeState({ sha: result.sha, lastSyncedAt })
    this.emit({
      state: 'idle',
      pending: false,
      error: undefined,
      lastSyncedAt,
      lastCommitSha: result.commitSha.slice(0, 7),
    })
  }

  private fail(error: unknown): void {
    const message =
      error instanceof GithubSyncError
        ? `${error.message} ${error.hint}`
        : error instanceof Error
          ? error.message
          : 'Sync failed for an unknown reason.'
    this.emit({ state: 'error', error: message })
  }
}

export const syncManager = new SyncManager()
