/**
 * An honest account of where the dashboard's data lives.
 *
 * The wording here is deliberately unglamorous. "Local-only" is a real
 * privacy property — nothing typed into this dashboard is uploaded, committed
 * or deployed — but it is also a real durability risk, because a browser
 * cleanup deletes it without asking. Both halves are stated, in that order,
 * and the notice never implies more protection than the design actually
 * provides.
 *
 * `banner` is the compact, dismissible version for the dashboard overview.
 * `inline` is the fuller version for Settings, which is where someone reads it
 * on purpose.
 */
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { STORAGE_PREFIX } from '@/config/app'
import { PERSONAL_ROUTES } from '@/config/routes'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { Link } from 'react-router-dom'

const DISMISS_KEY = `${STORAGE_PREFIX}.privacy-notice.dismissed`

interface Point {
  icon: string
  title: string
  body: string
}

const POINTS: Point[] = [
  {
    icon: 'HardDrive',
    title: 'It stays in this browser',
    body: 'Tasks, logs, goals, habits and notes are written to IndexedDB on this device, under this browser profile. Another browser or another laptop starts empty.',
  },
  {
    icon: 'Ban',
    title: 'Nothing is uploaded',
    body: 'There is no account, no server and no sync. The site is a static build, so none of this data is in the public repository or in anything that gets deployed.',
  },
  {
    icon: 'Trash',
    title: 'Clearing site data deletes it',
    body: 'Clearing cookies and site data, a privacy cleaner, or using a private window will remove everything permanently. There is no copy anywhere else to restore from.',
  },
  {
    icon: 'Download',
    title: 'Export is the backup',
    body: 'The JSON export in Settings is the only backup that exists. Save one somewhere you trust, and import it to move the dashboard to a new device.',
  },
]

const CAVEAT =
  'This is privacy from the network, not security on a shared machine: anyone using this unlocked device can open the dashboard. The optional passphrase encrypts the stored copy at rest — it is not a login.'

export interface PrivacyNoticeProps {
  variant: 'banner' | 'inline'
}

export function PrivacyNotice({ variant }: PrivacyNoticeProps) {
  const [dismissed, setDismissed] = useLocalStorage<boolean>(DISMISS_KEY, false)

  if (variant === 'banner') {
    if (dismissed) return null

    return (
      <aside
        aria-label="Privacy notice"
        className="animate-fade-in flex items-start gap-3 rounded-card border border-line bg-surface-muted px-4 py-3"
      >
        <Icon name="ShieldCheck" size={17} className="mt-0.5 text-accent" />

        <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-muted">
          Everything in this dashboard is stored only in this browser — never uploaded, and never
          part of the public site. Clearing site data deletes it, so keep a{' '}
          <Link
            to={PERSONAL_ROUTES.settings}
            className="font-medium text-ink underline decoration-line-strong underline-offset-2 transition-colors duration-150 hover:text-accent hover:decoration-accent"
          >
            JSON export
          </Link>{' '}
          as your backup.
        </p>

        <Button
          variant="ghost"
          size="icon"
          icon="X"
          aria-label="Dismiss privacy notice"
          onClick={() => setDismissed(true)}
          className="-mr-1.5 -mt-1 shrink-0"
        />
      </aside>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"
          >
            <Icon name="ShieldCheck" size={18} />
          </span>
          <div className="space-y-1">
            <CardTitle>Where this data lives</CardTitle>
            <p className="text-sm leading-relaxed text-ink-muted">
              The dashboard is private by construction rather than by permission. Here is exactly
              what that does and does not mean.
            </p>
          </div>
        </div>

        <ul className="space-y-4">
          {POINTS.map((point) => (
            <li key={point.title} className="flex items-start gap-3">
              <Icon name={point.icon} size={16} className="mt-0.5 text-ink-faint" />
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium text-ink">{point.title}</p>
                <p className="text-sm leading-relaxed text-ink-muted">{point.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="flex items-start gap-2.5 rounded-lg bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-ink-faint">
          <Icon name="Info" size={14} className="mt-px" />
          <span>{CAVEAT}</span>
        </p>
      </CardContent>
    </Card>
  )
}
