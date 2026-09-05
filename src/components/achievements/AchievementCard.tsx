import type { Achievement, AchievementKind, Tone } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardFooter } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Counter } from '@/motion'
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

interface ParsedMetric {
  value: number
  decimals: number
  /** Whatever touches the number with no space: "+", "%". */
  attached: string
  /** The words after it: "rating", "students reached". */
  trailing: string
}

/**
 * Splits a metric that opens with a number — "2300+ rating", "99.34 percentile",
 * "2,000+ students reached" — into the number and the words around it, so the
 * number can count up. Compound tokens such as "4-digit" are left as text: a
 * count from zero to four would say nothing true about a rank.
 */
function parseLeadingNumber(text: string): ParsedMetric | null {
  const source = text.trim()
  const match = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?=$|[\s+%/×])/.exec(source)
  if (!match) return null

  const fraction = match[2] ?? ''
  const value = Number(`${match[1].replace(/,/g, '')}${fraction}`)
  if (!Number.isFinite(value)) return null

  const rest = /^(\S*)\s*([\s\S]*)$/.exec(source.slice(match[0].length))
  return {
    value,
    decimals: fraction.length > 0 ? fraction.length - 1 : 0,
    attached: rest?.[1] ?? '',
    trailing: rest?.[2] ?? '',
  }
}

/* A tint of the accent, never a fill — the bar slides across the card on hover. */
const SHINE =
  'linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--color-accent) 16%, transparent) 50%, transparent 100%)'

function Shine() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
    >
      <span
        className={cn(
          'absolute inset-y-[-30%] left-0 w-[40%] -translate-x-[220%] rotate-[14deg]',
          'transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          'group-hover:translate-x-[330%]',
        )}
        style={{ backgroundImage: SHINE }}
      />
    </span>
  )
}

/**
 * The highlight treatment for a metric. The first segment (before " · ") is
 * the hero; anything after it becomes a mono footnote. A leading number counts
 * up on enter; a metric that does not open with one is set as plain text.
 */
function HeroMetric({ metric }: { metric: string }) {
  const [lead = '', ...rest] = metric.split(' · ')
  const parsed = parseLeadingNumber(lead)

  return (
    <div>
      <p className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] tracking-tight text-balance text-ink">
        {parsed ? (
          <>
            <Counter
              to={parsed.value}
              decimals={parsed.decimals}
              suffix={parsed.attached || undefined}
            />
            {parsed.trailing ? ` ${parsed.trailing}` : null}
          </>
        ) : (
          lead
        )}
      </p>
      {rest.length > 0 ? (
        <p className="mt-3 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
          {rest.join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

export interface AchievementCardProps {
  achievement: Achievement
  /** Highlights row treatment: the metric is the hero and counts up. */
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
      className={cn('group h-full', highlight && 'border-line-strong', className)}
    >
      <CardContent
        className={cn(
          'flex flex-1 flex-col gap-3',
          highlight && 'gap-5 sm:px-7 sm:pb-7 sm:first:pt-7',
        )}
      >
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
          highlight ? (
            <HeroMetric metric={achievement.metric} />
          ) : (
            <p className="font-mono text-2xl leading-tight font-semibold tracking-tight text-ink tabular-nums">
              {achievement.metric}
            </p>
          )
        ) : null}

        <div className="space-y-1.5">
          <h3
            className={cn(
              'leading-snug text-ink',
              highlight
                ? 'font-display text-xl font-medium tracking-tight sm:text-2xl'
                : 'text-[15px] font-semibold',
            )}
          >
            {achievement.title}
          </h3>
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink-faint uppercase tabular-nums">
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
        <CardFooter className={cn('py-2.5', highlight && 'sm:px-7')}>
          <ButtonLink
            href={achievement.url}
            variant="ghost"
            size="sm"
            iconRight="ArrowUpRight"
            data-cursor="Verify"
            aria-label={`Verify "${achievement.title}" on ${hostLabel(achievement.url)}`}
          >
            {hostLabel(achievement.url)}
          </ButtonLink>
        </CardFooter>
      ) : null}

      {highlight ? <Shine /> : null}
    </Card>
  )
}
