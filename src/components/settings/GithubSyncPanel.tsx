import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { syncManager } from '@/services/syncManager'
import { verifyAccess, type GithubSyncConfig } from '@/services/githubSync'
import { claimDashboard } from '@/services/dashboardAccess'
import { githubConfig } from '@/data'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

/** Suggested name for the private repository that holds the data. */
const DEFAULT_DATA_REPO = 'dashboard-data'

type Adopt = 'remote' | 'merge' | 'local'

const ADOPT_CHOICES: { value: Adopt; label: string; detail: string }[] = [
  {
    value: 'remote',
    label: 'Use what is on GitHub',
    detail: 'Replaces this device’s data. Pick this when setting up a second device.',
  },
  {
    value: 'merge',
    label: 'Merge both',
    detail: 'Keeps every record from both sides; the most recently edited version of each wins.',
  },
  {
    value: 'local',
    label: 'Use what is on this device',
    detail: 'Overwrites the copy on GitHub. Pick this the very first time you connect.',
  },
]

function relativeTime(iso: string | undefined): string {
  if (!iso) return 'never'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86_400)} d ago`
}

/**
 * Connects the dashboard to a GitHub repository so every change becomes a
 * commit — durable backup plus sync between devices, with no server of ours.
 */
export function GithubSyncPanel() {
  const { toast } = useToast()

  const status = useSyncExternalStore(syncManager.subscribe, syncManager.getStatus)
  const config = syncManager.getConfig()
  const connected = status.state !== 'disconnected' && config !== null

  // Pre-filled from the portfolio's own GitHub config so the only thing that
  // actually has to be typed is the token. Both stay editable.
  const [owner, setOwner] = useState(config?.owner ?? githubConfig.username)
  const [repo, setRepo] = useState(config?.repo ?? DEFAULT_DATA_REPO)
  const [branch, setBranch] = useState(config?.branch ?? 'main')
  const [path, setPath] = useState(config?.path ?? 'dashboard.json')
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [adopt, setAdopt] = useState<Adopt>('local')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()
  const [checked, setChecked] = useState<{ private: boolean; defaultBranch: string } | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  // Re-render once a minute so "3 min ago" does not go stale on an idle tab.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const draft = useMemo<GithubSyncConfig>(
    () => ({ owner: owner.trim(), repo: repo.trim(), branch: branch.trim() || 'main', path: path.trim() || 'dashboard.json', token: token.trim() }),
    [owner, repo, branch, path, token],
  )

  const canSubmit = Boolean(draft.owner && draft.repo && draft.token) && !busy

  const test = useCallback(async () => {
    setBusy(true)
    setFormError(undefined)
    setChecked(null)
    const result = await verifyAccess(draft)
    setBusy(false)
    if (result.ok) {
      setChecked({ private: result.private, defaultBranch: result.defaultBranch })
      if (!result.private) {
        toast({
          tone: 'warning',
          title: 'That repository is public',
          description: 'Anything the dashboard commits will be readable by anyone.',
          duration: 9000,
        })
      } else {
        toast({ tone: 'positive', title: 'Connection looks good', description: 'Private repository, write access confirmed.' })
      }
    } else {
      setFormError(`${result.error.message} ${result.error.hint}`)
    }
  }, [draft, toast])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setFormError(undefined)
    try {
      await syncManager.connect(draft, adopt)
      claimDashboard()
      setToken('')
      toast({ tone: 'positive', title: 'Sync connected', description: 'Your dashboard now commits to GitHub.' })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not connect.')
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    await syncManager.sync('manual')
    setBusy(false)
    const next = syncManager.getStatus()
    if (next.state === 'error') toast({ tone: 'danger', title: 'Sync failed', description: next.error })
    else toast({ tone: 'positive', title: 'Synced', description: 'GitHub is up to date.' })
  }

  const stateBadge = {
    disconnected: { tone: 'neutral' as const, icon: 'CloudOff', label: 'Not connected' },
    idle: { tone: 'positive' as const, icon: 'Check', label: status.pending ? 'Changes pending' : 'Up to date' },
    syncing: { tone: 'accent' as const, icon: 'RefreshCw', label: 'Syncing…' },
    error: { tone: 'danger' as const, icon: 'TriangleAlert', label: 'Needs attention' },
  }[status.state]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={stateBadge.tone} icon={stateBadge.icon}>
          {stateBadge.label}
        </Badge>
        {connected ? (
          <p className="text-xs text-ink-faint">
            <span className="font-mono">
              {config?.owner}/{config?.repo}
            </span>
            {' · last synced '}
            <span className="font-mono">{relativeTime(status.lastSyncedAt)}</span>
            {status.lastCommitSha ? (
              <>
                {' · '}
                <a
                  href={`https://github.com/${config?.owner}/${config?.repo}/commit/${status.lastCommitSha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline underline-offset-2 hover:text-ink"
                >
                  {status.lastCommitSha}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      {status.error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
          {status.error}
        </p>
      ) : null}

      {connected ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={syncNow} loading={busy} icon="RefreshCw" variant="secondary">
            Sync now
          </Button>
          <Button onClick={() => setConfirmDisconnect(true)} variant="ghost" icon="Unplug">
            Disconnect
          </Button>
        </div>
      ) : null}

      <form onSubmit={submit} className={cn('space-y-4', connected && 'border-t border-line pt-5')} noValidate>
        {connected ? (
          <p className="text-sm text-ink-muted">
            Point this device somewhere else, or paste a new token after rotating one.
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repository owner" htmlFor="sync-owner" hint="Your GitHub username.">
            <Input id="sync-owner" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="dnathkoushik" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Repository name" htmlFor="sync-repo" hint="A PRIVATE repo, separate from the website.">
            <Input id="sync-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="dashboard-data" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="Branch" htmlFor="sync-branch">
            <Input id="sync-branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" autoComplete="off" spellCheck={false} />
          </Field>
          <Field label="File path" htmlFor="sync-path" hint="Where the JSON document lives in that repo.">
            <Input id="sync-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="dashboard.json" autoComplete="off" spellCheck={false} />
          </Field>
        </div>

        <Field
          label="Fine-grained access token"
          htmlFor="sync-token"
          hint="Stored only in this browser. Never committed, never included in an export."
          error={formError}
        >
          <div className="flex gap-2">
            <Input
              id="sync-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={connected ? 'Paste a new token to replace the stored one' : 'github_pat_…'}
              autoComplete="off"
              spellCheck={false}
              invalid={Boolean(formError)}
              className="font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              onClick={() => setShowToken((v) => !v)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
            >
              <Icon name={showToken ? 'EyeOff' : 'Eye'} className="size-4" />
            </Button>
          </div>
        </Field>

        {checked ? (
          <p className={cn('text-sm', checked.private ? 'text-positive' : 'text-warning')}>
            <Icon name={checked.private ? 'ShieldCheck' : 'TriangleAlert'} size={14} className="mr-1.5 inline align-[-2px]" />
            {checked.private
              ? `Private repository, write access confirmed. Default branch is ${checked.defaultBranch}.`
              : `This repository is PUBLIC — everything the dashboard commits would be readable by anyone. Default branch is ${checked.defaultBranch}.`}
          </p>
        ) : null}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">If that file already has data</legend>
          {ADOPT_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className={cn(
                'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                adopt === choice.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-hover',
              )}
            >
              <input
                type="radio"
                name="sync-adopt"
                value={choice.value}
                checked={adopt === choice.value}
                onChange={() => setAdopt(choice.value)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{choice.label}</span>
                <span className="block text-xs text-ink-muted">{choice.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSubmit} loading={busy} icon="GitBranch">
            {connected ? 'Update connection' : 'Connect and sync'}
          </Button>
          <Button type="button" variant="secondary" onClick={test} disabled={!canSubmit} icon="Plug">
            Test connection
          </Button>
        </div>
      </form>

      <details className="rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-ink">How to create the token</summary>
        <ol className="mt-3 space-y-2 pl-5 text-ink-muted [&>li]:list-decimal">
          <li>
            Create a <strong>private</strong> repository for the data — separate from the website
            repo. <code className="font-mono text-xs">dashboard-data</code> is a good name.
          </li>
          <li>
            Open{' '}
            <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              GitHub → fine-grained personal access tokens
            </a>
            .
          </li>
          <li>
            Under <strong>Repository access</strong> choose <em>Only select repositories</em> and
            pick just that one repo.
          </li>
          <li>
            Under <strong>Permissions → Repository permissions</strong>, set{' '}
            <strong>Contents</strong> to <em>Read and write</em>. Leave everything else alone.
          </li>
          <li>Generate it, paste it above, and pick an expiry you are willing to renew.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-faint">
          The token lives in this browser’s local storage so the page can commit on your behalf.
          Anyone with access to this browser profile can read it — which is the honest limit of
          storing a credential in a client. Scope it to one repository, and revoke it on GitHub if
          the device is ever lost.
        </p>
      </details>

      <ConfirmDialog
        open={confirmDisconnect}
        onCancel={() => setConfirmDisconnect(false)}
        onConfirm={() => {
          syncManager.disconnect()
          setConfirmDisconnect(false)
          toast({ title: 'Sync disconnected', description: 'Your data stays on this device. Nothing on GitHub was deleted.' })
        }}
        title="Disconnect GitHub sync?"
        message="This device will stop committing. Your local data stays exactly as it is, and the copy already on GitHub is left untouched."
        confirmLabel="Disconnect"
        tone="danger"
      />
    </div>
  )
}
