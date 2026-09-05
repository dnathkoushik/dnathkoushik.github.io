import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { STORAGE_KEYS } from '@/config/app'
import { PERSONAL_NAV, PERSONAL_ROUTES, PUBLIC_ROUTES } from '@/config/routes'
import { PersonalDataProvider } from '@/providers/PersonalDataProvider'
import { syncManager } from '@/services/syncManager'
import { usePersonalData } from '@/providers/personalDataContext'
import { LockScreen } from '@/components/personal/LockScreen'
import { DashboardGate } from '@/components/personal/DashboardGate'
import { DemoBanner } from '@/components/personal/DemoBanner'
import { claimDashboard, claimKind, isDashboardOpen } from '@/services/dashboardAccess'
import { SkipLink } from '@/components/common/SkipLink'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { CommandPalette } from '@/components/nav/CommandPalette'
import { MobileTabBar } from '@/components/nav/MobileTabBar'
import { Sidebar } from '@/components/nav/Sidebar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { todayISO } from '@/utils/date'

/** Hrefs already reachable from the bottom bar; the rest go in the "More" menu. */
const TAB_HREFS: string[] = [
  PERSONAL_ROUTES.dashboard,
  PERSONAL_ROUTES.today,
  PERSONAL_ROUTES.calendar,
  PERSONAL_ROUTES.goals,
  PERSONAL_ROUTES.habits,
]

/** The nav entry that owns a path, used for the mobile bar's title. */
function activeNavLabel(pathname: string): string {
  const match = PERSONAL_NAV.find((item) =>
    item.end ? pathname === item.href : pathname.startsWith(item.href),
  )
  return match?.label ?? 'Dashboard'
}

/**
 * Everything behind `/dashboard`.
 *
 * The provider is mounted here rather than in `App` so that the private data
 * layer — and the IndexedDB adapter it drags in — is only ever constructed for
 * someone who actually opened the dashboard. A visitor reading the portfolio
 * never touches it.
 */
export function PersonalLayout() {
  return (
    <PersonalDataProvider>
      <PersonalShell />
    </PersonalDataProvider>
  )
}

function PersonalShell() {
  const { status, db } = usePersonalData()

  // Start GitHub sync only once the local database is actually readable — there
  // is nothing to push while we are still loading, and pushing over a locked
  // (and therefore empty) document would wipe the copy on GitHub.
  useEffect(() => {
    if (status !== 'ready') return
    void syncManager.start()
    return () => syncManager.stop()
  }, [status])

  const open = status === 'ready' && isDashboardOpen(db)

  // Once a browser has legitimately been inside, remember it. Without this,
  // emptying the dashboard — Settings -> Clear entries, or finishing the last
  // task of the day on a device with no sync — would make `hasAnyData` false
  // and bounce the owner out to the gate. Access must not depend on there
  // being something to look at.
  useEffect(() => {
    if (open && claimKind() === null) claimDashboard('owner')
  }, [open])

  if (status === 'locked') return <LockScreen />
  if (status === 'error') return <RecoveryScreen />
  if (status === 'loading') return <LoadingShell />

  // A browser that has never used this dashboard sees the door, not the room.
  if (!open) return <DashboardGate />

  return <DashboardChrome />
}

function DashboardChrome() {
  const [collapsed, setCollapsed] = useLocalStorage<boolean>(STORAGE_KEYS.sidebar, false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { lock } = usePersonalData()
  const location = useLocation()
  const navigate = useNavigate()

  const title = activeNavLabel(location.pathname)

  const moreItems = useMemo<DropdownMenuItem[]>(() => {
    const rest: DropdownMenuItem[] = PERSONAL_NAV.filter(
      (item) => !TAB_HREFS.includes(item.href),
    ).map((item) => ({
      id: item.href,
      label: item.label,
      icon: item.icon,
      onSelect: () => navigate(item.href),
    }))

    if (lock.enabled) {
      rest.push({ id: 'lock', label: 'Lock dashboard', icon: 'Lock', onSelect: () => lock.lock() })
    }

    rest.push({
      id: 'exit',
      label: 'Back to portfolio',
      icon: 'ArrowLeft',
      onSelect: () => navigate(PUBLIC_ROUTES.home),
    })

    return rest
  }, [lock, navigate])

  return (
    <div className="flex min-h-[100dvh] bg-canvas">
      <SkipLink />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact app bar — phones and tablets only. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-canvas/90 px-3 backdrop-blur lg:hidden">
          <Link
            to={PUBLIC_ROUTES.home}
            aria-label="Leave the dashboard and return to the portfolio"
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="ArrowLeft" className="size-[18px]" />
          </Link>

          {/* Not a heading: the page below owns the document's single h1. */}
          <p className="mr-auto ml-1 truncate text-base font-semibold tracking-tight text-ink">
            {title}
          </p>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="inline-flex size-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="Search" className="size-[18px]" />
          </button>

          <ThemeToggle />

          <DropdownMenu items={moreItems} label="More dashboard sections" triggerIcon="Ellipsis" />
        </header>

        <DemoBanner />

        <main
          id="main-content"
          className="flex-1 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-12"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileTabBar />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}

/**
 * What the dashboard looks like while the database is being read.
 *
 * It draws the real chrome with placeholders inside it, so the first paint is
 * already the right shape and nothing jumps when the data lands.
 */
function LoadingShell() {
  return (
    <div className="flex min-h-[100dvh] bg-canvas" aria-busy="true">
      {/* The shell owns the heading only while it is standing in for a page. */}
      <h1 className="sr-only">Dashboard</h1>
      <p role="status" aria-live="polite" className="sr-only">
        Loading your dashboard
      </p>

      <aside
        aria-hidden="true"
        className="sticky top-0 hidden h-[100dvh] w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <div className="skeleton size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-2.5 w-32" />
          </div>
        </div>
        <div className="space-y-1.5 p-3">
          <div className="skeleton h-10 w-full" />
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="skeleton h-9 w-full" />
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          aria-hidden="true"
          className="flex h-14 items-center gap-3 border-b border-line px-4 lg:hidden"
        >
          <div className="skeleton size-8 rounded-lg" />
          <div className="skeleton h-3.5 w-28" />
        </div>

        <div aria-hidden="true" className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          <div className="space-y-2">
            <div className="skeleton h-7 w-56" />
            <div className="skeleton h-3.5 w-72" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-24 rounded-card border border-line bg-surface p-4">
                <div className="skeleton h-3 w-16" />
                <div className="skeleton mt-3 h-6 w-12" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="h-64 rounded-card border border-line bg-surface p-5 lg:col-span-2">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton mt-4 h-40 w-full" />
            </div>
            <div className="h-64 rounded-card border border-line bg-surface p-5">
              <div className="skeleton h-4 w-24" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="skeleton h-8 w-full" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * The database could not be read.
 *
 * The two things that matter here are getting a copy of whatever did load out
 * of the browser, and knowing exactly which switch to throw next — so both are
 * on screen, with the destructive one behind a confirmation.
 */
function RecoveryScreen() {
  const { error, actions, storageName } = usePersonalData()
  const { toast } = useToast()
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleExport = () => {
    try {
      const json = actions.exportJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `dashboard-backup-${todayISO()}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
      toast({ title: 'Backup downloaded', tone: 'positive' })
    } catch {
      toast({
        title: 'Could not build a backup',
        description: 'Nothing readable was recovered from storage.',
        tone: 'danger',
      })
    }
  }

  const handleReset = () => {
    setResetting(true)
    actions
      .resetEverything()
      .then(() => window.location.reload())
      .catch(() => {
        setResetting(false)
        setConfirmReset(false)
        toast({
          title: 'Reset failed',
          description: 'Clear this site’s data from your browser settings instead.',
          tone: 'danger',
        })
      })
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <SkipLink />
      <main id="main-content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 sm:px-6">
        <div className="rounded-card border border-line bg-surface p-6 shadow-subtle animate-rise sm:p-8">
          <span className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
            <Icon name="TriangleAlert" size={20} />
          </span>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
            Your dashboard data could not be loaded
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Nothing has been deleted. The stored document in{' '}
            <span className="font-mono text-ink">{storageName}</span> could not be read back, which
            usually means the browser blocked storage for this site, or a write was interrupted
            partway through.
          </p>

          {error ? (
            <p
              className="mt-4 rounded-lg bg-surface-muted px-3.5 py-3 font-mono text-xs break-words text-ink-muted"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <h2 className="mt-8 text-lg font-semibold text-ink">What to try, in order</h2>
          <ol className="mt-3 space-y-3 text-sm leading-relaxed text-ink-muted">
            <li className="flex gap-3">
              <span className="font-mono text-ink-faint tabular-nums">1.</span>
              <span>
                <strong className="font-medium text-ink">Take a backup first.</strong> It exports
                whatever was readable, so you lose nothing by experimenting after it.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-ink-faint tabular-nums">2.</span>
              <span>
                <strong className="font-medium text-ink">Reload the page.</strong> A single
                interrupted write usually clears on the next read.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-ink-faint tabular-nums">3.</span>
              <span>
                <strong className="font-medium text-ink">Check the browser.</strong> Private
                windows, blocked cookies and “clear site data on exit” all stop this app from
                keeping anything. Open the site in a normal window and try again.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-ink-faint tabular-nums">4.</span>
              <span>
                <strong className="font-medium text-ink">Start clean.</strong> A reset empties this
                browser’s copy and rebuilds an empty database. Restore your backup from{' '}
                <span className="font-mono">Settings → Data</span> afterwards.
              </span>
            </li>
          </ol>

          <div className="mt-8 flex flex-wrap gap-2">
            <Button variant="primary" icon="Download" onClick={handleExport}>
              Download a backup
            </Button>
            <Button icon="RefreshCw" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <Button variant="danger" icon="Trash" onClick={() => setConfirmReset(true)}>
              Reset this browser’s data
            </Button>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <Link
              to={PUBLIC_ROUTES.home}
              className="inline-flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <Icon name="ArrowLeft" className="size-4" />
              Back to the portfolio
            </Link>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={confirmReset}
        onCancel={() => {
          if (!resetting) setConfirmReset(false)
        }}
        onConfirm={handleReset}
        title="Reset this browser’s dashboard data?"
        message="Every task, log, goal, habit, note and review stored in this browser is deleted and the database is rebuilt empty. This cannot be undone — download a backup first if you have not already."
        confirmLabel={resetting ? 'Resetting…' : 'Reset everything'}
        tone="danger"
      />
    </div>
  )
}
