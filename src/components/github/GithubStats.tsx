import type { GithubProfile } from '@/services/github'
import { Stat } from '@/components/ui/Stat'
import { numberFormat } from '@/utils/format'
import { cn } from '@/lib/cn'

const MONTH_YEAR = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' })

interface Age {
  /** "3y 4m", or "7m" for an account under a year old. */
  label: string
  since: string
}

/** Null when the API sent no usable `created_at` — the stat is then dropped. */
function accountAge(createdAt: string): Age | null {
  const parsed = Date.parse(createdAt)
  if (!Number.isFinite(parsed)) return null

  const start = new Date(parsed)
  const now = new Date()
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return null

  const years = Math.floor(months / 12)
  const rest = months % 12

  return {
    label: years > 0 ? (rest > 0 ? `${years}y ${rest}m` : `${years}y`) : `${months}m`,
    since: `Joined ${MONTH_YEAR.format(start)}`,
  }
}

export interface GithubStatsProps {
  profile: GithubProfile
  className?: string
}

/**
 * The four numbers the public API actually gives you about an account.
 *
 * Anything the payload did not carry is left out rather than shown as a zero —
 * a missing value and a real zero look identical once they are on the page, and
 * only one of them is true.
 */
export function GithubStats({ profile, className }: GithubStatsProps) {
  const age = accountAge(profile.createdAt)

  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4', className)}>
      <Stat
        label="Public repos"
        value={numberFormat(profile.publicRepos)}
        sublabel="Everything visible on the profile"
        icon="FolderGit2"
        tone="accent"
      />
      <Stat
        label="Followers"
        value={numberFormat(profile.followers)}
        icon="Users"
        sublabel={profile.followers === 0 ? 'Nobody yet — early days' : undefined}
      />
      <Stat label="Following" value={numberFormat(profile.following)} icon="User" />
      {age ? <Stat label="Account age" value={age.label} sublabel={age.since} icon="CalendarDays" /> : null}
    </div>
  )
}
