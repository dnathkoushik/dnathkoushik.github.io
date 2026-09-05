import { useMemo, useSyncExternalStore } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PERSONAL_NAV, PUBLIC_ROUTES } from '@/config/routes'
import { usePersonalData } from '@/providers/personalDataContext'
import { useTheme } from '@/providers/ThemeProvider'
import { syncManager } from '@/services/syncManager'
import { PERSONAL_ROUTES as ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatDayLong, todayISO } from '@/utils/date'
import { initialsOf, pluralize } from '@/utils/format'
import { streakInfo } from '@/utils/analytics'
import { cn } from '@/lib/cn'

const IS_APPLE =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
const SHORTCUT_HINT = IS_APPLE ? '⌘K' : 'Ctrl K'

export interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  onOpenSearch: () => void
}

/**
 * The dashboard's permanent left rail, `lg` and up.
 *
 * Collapsed it keeps only the glyphs, each wrapped in a tooltip so the labels
 * are one hover or one focus away. The collapse state is owned by
 * `PersonalLayout` (and persisted there) because the rail's width and the
 * layout's spacing have to agree on it.
 */
export function Sidebar({ collapsed, onToggleCollapsed, onOpenSearch }: SidebarProps) {
  const { db, lock } = usePersonalData()
  const today = todayISO()

  const streak = useMemo(() => streakInfo(db, today), [db, today])
  const displayName = db.settings.displayName

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-line bg-surface lg:flex',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[4.75rem]' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2.5 border-b border-line px-4 py-4',
          collapsed && 'justify-center px-2',
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent">
          {initialsOf(displayName)}
        </span>
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="truncate font-mono text-[11px] text-ink-faint">
              <time dateTime={today}>{formatDayLong(today)}</time>
            </p>
          </div>
        )}
      </div>

      <div className={cn('px-3 pt-3', collapsed && 'px-2')}>
        {collapsed ? (
          <Tooltip content={`Search — ${SHORTCUT_HINT}`}>
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              className="flex size-11 items-center justify-center rounded-lg border border-line bg-surface-muted text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <Icon name="Search" className="size-4" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex h-10 w-full items-center gap-2.5 rounded-lg border border-line bg-surface-muted px-3 text-sm text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
          >
            <Icon name="Search" className="size-4" />
            <span className="flex-1 text-left">Search</span>
            <kbd className="rounded border border-line bg-surface px-1.5 font-mono text-[11px] leading-5 text-ink-faint">
              {SHORTCUT_HINT}
            </kbd>
          </button>
        )}
      </div>

      <nav
        aria-label="Dashboard"
        className={cn('min-h-0 flex-1 overflow-y-auto px-3 py-3', collapsed && 'px-2')}
      >
        <ul className="space-y-0.5">
          {PERSONAL_NAV.map((item) => {
            const link = (
              <NavLink
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg text-sm font-medium transition-colors',
                    collapsed ? 'size-11 justify-center' : 'h-10 gap-3 px-3',
                    isActive
                      ? 'bg-accent-soft text-accent'
                      : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
                  )
                }
              >
                {/* NavLink sets aria-current="page" on the active link itself. */}
                <Icon name={item.icon} className="size-[18px]" />
                {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
              </NavLink>
            )

            return (
              <li key={item.href}>
                {collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn('space-y-1 border-t border-line p-3', collapsed && 'px-2')}>
        <StreakBlock collapsed={collapsed} current={streak.current} best={streak.best} />

        <SyncIndicator collapsed={collapsed} />

        <ThemeFooterButton collapsed={collapsed} />

        {lock.enabled ? (
          <FooterButton
            collapsed={collapsed}
            icon="Lock"
            label="Lock dashboard"
            onClick={() => lock.lock()}
          />
        ) : null}

        <FooterLink collapsed={collapsed} icon="ArrowLeft" label="Back to portfolio" />

        <FooterButton
          collapsed={collapsed}
          icon={collapsed ? 'PanelLeft' : 'PanelLeftClose'}
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapsed}
        />
      </div>
    </aside>
  )
}

function StreakBlock({
  collapsed,
  current,
  best,
}: {
  collapsed: boolean
  current: number
  best: number
}) {
  const summary =
    current > 0
      ? `${current} day streak, best ${best}`
      : `No active streak — best so far is ${pluralize(best, 'day')}`

  if (collapsed) {
    return (
      <Tooltip content={summary}>
        <span className="flex size-11 flex-col items-center justify-center rounded-lg text-ink-muted">
          <Icon name="Flame" className={cn('size-4', current > 0 ? 'text-accent' : 'text-ink-faint')} />
          <span className="font-mono text-[11px] tabular-nums">{current}</span>
          <span className="sr-only">{summary}</span>
        </span>
      </Tooltip>
    )
  }

  return (
    <div className="mb-1 flex items-center gap-2.5 rounded-lg bg-surface-muted px-3 py-2.5">
      <Icon name="Flame" className={cn('size-4', current > 0 ? 'text-accent' : 'text-ink-faint')} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          <span className="font-mono tabular-nums">{current}</span> day streak
        </p>
        <p className="text-[11px] text-ink-faint">
          Best <span className="font-mono tabular-nums">{best}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * At-a-glance answer to "is today's work actually saved anywhere but here?".
 * Silent when sync was never set up — it should not nag someone who chose to
 * keep everything local.
 */
function SyncIndicator({ collapsed }: { collapsed: boolean }) {
  const status = useSyncExternalStore(syncManager.subscribe, syncManager.getStatus)
  if (status.state === 'disconnected') return null

  const look = {
    idle: status.pending
      ? { icon: 'CloudUpload', tone: 'text-ink-faint', label: 'Changes pending' }
      : { icon: 'Cloud', tone: 'text-positive', label: 'Synced to GitHub' },
    syncing: { icon: 'RefreshCw', tone: 'text-accent', label: 'Syncing…' },
    error: { icon: 'TriangleAlert', tone: 'text-danger', label: 'Sync needs attention' },
  }[status.state as 'idle' | 'syncing' | 'error']

  const content = (
    <Link
      to={`${ROUTES.settings}#settings-sync`}
      aria-label={look.label}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium transition-colors hover:bg-surface-hover',
        collapsed ? 'size-11 justify-center' : 'h-10 w-full gap-3 px-3',
        look.tone,
      )}
    >
      <Icon name={look.icon} className="size-[18px]" />
      {collapsed ? null : <span className="truncate">{look.label}</span>}
    </Link>
  )

  return collapsed ? <Tooltip content={look.label}>{content}</Tooltip> : content
}

/** Cycles light -> dark -> system, naming the current mode so it is discoverable. */
function ThemeFooterButton({ collapsed }: { collapsed: boolean }) {
  const { mode, resolved, cycle } = useTheme()
  const icon = mode === 'system' ? 'Monitor' : resolved === 'dark' ? 'Moon' : 'Sun'
  const label = mode === 'system' ? 'Theme: system' : mode === 'dark' ? 'Theme: dark' : 'Theme: light'

  return <FooterButton collapsed={collapsed} icon={icon} label={label} onClick={cycle} />
}

function FooterButton({
  collapsed,
  icon,
  label,
  onClick,
}: {
  collapsed: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink',
        collapsed ? 'size-11 justify-center' : 'h-10 w-full gap-3 px-3',
      )}
    >
      <Icon name={icon} className="size-[18px]" />
      {collapsed ? null : label}
    </button>
  )

  return collapsed ? <Tooltip content={label}>{button}</Tooltip> : button
}

function FooterLink({
  collapsed,
  icon,
  label,
}: {
  collapsed: boolean
  icon: string
  label: string
}) {
  const link = (
    <Link
      to={PUBLIC_ROUTES.home}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-lg text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink',
        collapsed ? 'size-11 justify-center' : 'h-10 w-full gap-3 px-3',
      )}
    >
      <Icon name={icon} className="size-[18px]" />
      {collapsed ? null : label}
    </Link>
  )

  return collapsed ? <Tooltip content={label}>{link}</Tooltip> : link
}
