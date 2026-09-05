import type { Achievement, AchievementKind, Tone } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { formatYearMonth } from '@/utils/date'
import { cn } from '@/lib/cn'

interface KindMeta {
  /** Section heading and filter chip. */
  label: string
  /** Singular form, used on the card badge. */
  badge: string
  icon: string
  tone: Tone
}

/** The order sections appear in, coarsest-grained proof first. */
// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENT_KIND_ORDER: AchievementKind[] = [
  'competitive-programming',
  'certification',
  'hackathon',
  'award',
  'academic',
  'milestone',
  'open-source',
]

// eslint-disable-next-line react-refresh/only-export-components
export const ACHIEVEMENT_KIND: Record<AchievementKind, KindMeta> = {
  'competitive-programming': {
    label: 'Competitive programming',
    badge: 'Contest',
    icon: 'Code',
    tone: 'info',
  },
  certification: {
    label: 'Certifications',
    badge: 'Certification',
    icon: 'ShieldCheck',
    tone: 'neutral',
  },
  hackathon: { label: 'Hackathons', badge: 'Hackathon', icon: 'Zap', tone: 'warning' },
  award: { label: 'Awards', badge: 'Award', icon: 'Trophy', tone: 'warning' },
  academic: { label: 'Academic', badge: 'Academic', icon: 'GraduationCap', tone: 'neutral' },
  milestone: { label: 'Milestones', badge: 'Milestone', icon: 'Target', tone: 'positive' },
  'open-source': {
    label: 'Open source',
    badge: 'Open source',
    icon: 'GitPullRequest',
    tone: 'info',
  },
}

/** Human label for a URL: the bare host, or a safe fallback for odd schemes. */
function hostLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host.length > 0 ? host : 'Open link'
  } catch {
    return 'Open link'
  }
}

export interface AchievementCardProps {
  achievement: Achievement
  /** Highlights row treatment: the metric carries the accent. */
  highlight?: boolean
  /** Labels the card as a shipped template rather than a claim. */
  template?: boolean
  className?: string
}

/**
 * One achievement.
 *
 * The metric leads, because a rank or a count is the only part of an
 * achievement that can be checked — and it is set in the mono face with
 * `tabular-nums` so a column of them lines up digit for digit. Everything else
 * on the card exists to say what the number was for.
 */
export function AchievementCard({
  achievement,
  highlight = false,
  template = false,
  className,
}: AchievementCardProps) {
  const kind = ACHIEVEMENT_KIND[achievement.kind]

  return (
    <Card
      interactive={Boolean(achievement.url)}
      className={cn('h-full', highlight && 'border-line-strong', className)}
    >
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
          >
            <Icon name={kind.icon} size={17} />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {template ? (
              <Badge tone="warning" size="sm" icon="TriangleAlert">
                Template
              </Badge>
            ) : null}
            <Badge tone={kind.tone} size="sm">
              {kind.badge}
            </Badge>
          </div>
        </div>

        {achievement.metric ? (
          <p
            className={cn(
              'font-mono text-2xl leading-tight font-semibold tracking-tight tabular-nums',
              highlight ? 'text-accent' : 'text-ink',
            )}
          >
            {achievement.metric}
          </p>
        ) : null}

        <div className="space-y-1">
          <h3 className="text-[15px] leading-snug font-semibold text-ink">{achievement.title}</h3>
          <p className="font-mono text-xs text-ink-faint tabular-nums">
            {achievement.issuer ? `${achievement.issuer}  ·  ` : ''}
            <time dateTime={achievement.date}>
              {formatYearMonth(achievement.date.slice(0, 7))}
            </time>
          </p>
        </div>

        {achievement.description ? (
          <p className="text-sm leading-relaxed text-ink-muted">{achievement.description}</p>
        ) : null}
      </CardContent>

      {achievement.url ? (
        <CardFooter className="py-2.5">
          <ButtonLink
            href={achievement.url}
            variant="ghost"
            size="sm"
            icon="ExternalLink"
            aria-label={`Verify "${achievement.title}" on ${hostLabel(achievement.url)}`}
          >
            {hostLabel(achievement.url)}
          </ButtonLink>
        </CardFooter>
      ) : null}
    </Card>
  )
}
