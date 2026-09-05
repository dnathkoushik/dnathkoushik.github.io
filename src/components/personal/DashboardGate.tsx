import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PUBLIC_ROUTES } from '@/config/routes'
import { githubConfig, profile } from '@/data'
import { usePersonalData } from '@/providers/personalDataContext'
import { syncManager } from '@/services/syncManager'
import { verifyAccess, type GithubSyncConfig } from '@/services/githubSync'
import { claimDashboard } from '@/services/dashboardAccess'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

/**
 * What a visitor sees at `/dashboard` when this browser holds no data.
 *
 * `/dashboard` is a public URL — on static hosting it cannot be anything else,
 * and pretending otherwise would be dishonest. What it must never do is *look*
 * like someone's private dashboard to a stranger. Before this screen existed
 * the app seeded demo data on first load, so an incognito window landed in a
 * fully populated dashboard greeting the owner by name: nothing had actually
 * leaked, but it was indistinguishable from a leak.
 *
 * So the door is shut by default. The real data lives in a private GitHub
 * repository and needs a real GitHub credential to reach; everyone else gets
 * a clearly-labelled demo or nothing at all.
 */
export function DashboardGate() {
  const { actions } = usePersonalData()
  const [mode, setMode] = useState<'closed' | 'signin'>('closed')
  const [owner, setOwner] = useState(githubConfig.username)
  const [repo, setRepo] = useState('dashboard-data')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const config: GithubSyncConfig = {
      owner: owner.trim(),
      repo: repo.trim(),
      branch: 'main',
      path: 'dashboard.json',
      token: token.trim(),
    }
    if (!config.owner || !config.repo || !config.token) return

    setBusy(true)
    setError(undefined)
    const check = await verifyAccess(config)
    if (!check.ok) {
      setError(`${check.error.message} ${check.error.hint}`)
      setBusy(false)
      return
    }

    try {
      // 'remote' — this device is joining an existing dashboard, so GitHub wins.
      await syncManager.connect(config, 'remote')
      claimDashboard()
      // The provider re-renders from the imported database on the next tick.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your data.')
      setBusy(false)
    }
  }

  async function preview() {
    setBusy(true)
    await actions.loadSampleData()
    claimDashboard('demo')
    setBusy(false)
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-16">
      <div className="w-full max-w-md animate-rise">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-muted text-ink-faint ring-1 ring-line">
            <Icon name="Lock" className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-ink">A private dashboard</h1>
            <p className="text-sm text-ink-muted">{profile.name}&rsquo;s daily planner</p>
          </div>
        </div>

        <p className="mt-6 text-[15px] leading-relaxed text-ink-muted">
          This is the private half of the site — daily targets, work logs, goals and a journal.
          The data is not part of this website: it lives in a private repository, and in the owner&rsquo;s
          own browser. There is nothing here for this browser to show.
        </p>

        {mode === 'closed' ? (
          <div className="mt-7 space-y-3">
            <Button fullWidth variant="primary" icon="GitBranch" onClick={() => setMode('signin')}>
              Sign in with GitHub
            </Button>
            <Button fullWidth variant="secondary" icon="Play" onClick={preview} loading={busy}>
              Take a look with sample data
            </Button>
            <p className="text-center text-xs text-ink-faint">
              Sample data is invented for the demo. It is nobody&rsquo;s real week.
            </p>
          </div>
        ) : (
          <form onSubmit={signIn} className="mt-7 space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="GitHub username" htmlFor="gate-owner">
                <Input
                  id="gate-owner"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  autoFocus
                />
              </Field>
              <Field label="Data repository" htmlFor="gate-repo">
                <Input
                  id="gate-repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="dashboard-data"
                  spellCheck={false}
                />
              </Field>
            </div>

            <Field
              label="Access token"
              htmlFor="gate-token"
              hint="Fine-grained token with Contents: read and write on that one repository."
              error={error}
            >
              <Input
                id="gate-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="github_pat_…"
                autoComplete="current-password"
                spellCheck={false}
                invalid={Boolean(error)}
                className="font-mono"
              />
            </Field>

            <div className="flex gap-2">
              <Button type="submit" loading={busy} icon="LogIn" fullWidth>
                Load my dashboard
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('closed')}>
                Back
              </Button>
            </div>

            <p className="text-xs text-ink-faint">
              Need a token?{' '}
              <a
                href={TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                Create one on GitHub
              </a>{' '}
              scoped to that repository only. It is stored in this browser and never sent anywhere
              but GitHub.
            </p>
          </form>
        )}

        <div className="mt-8 border-t border-line pt-5">
          <Link
            to={PUBLIC_ROUTES.home}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <Icon name="ArrowLeft" size={16} />
            Back to the portfolio
          </Link>
        </div>
      </div>
    </main>
  )
}
