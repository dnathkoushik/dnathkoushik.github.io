import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Opportunity } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Progress } from '@/components/ui/Progress'
import { useCompanyMap } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { relativeDay, todayISO, weekKeyOf } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { daysSince, dueFollowUps, outreachVelocity, weeklyProgress } from '@/utils/outreach'

type Urgency = 'overdue' | 'today' | 'upcoming'

const URGENCY_CLASS: Record<Urgency, string> = {
  overdue: 'text-danger',
  today: 'text-warning',
  upcoming: 'text-ink-muted',
}

interface DueRow {
  opportunity: Opportunity
  urgency: Urgency
}

/**
 * The job search at a glance, for the Overview page: follow-ups due, this
 * week's outbound against the target, and replies in. Renders nothing until
 * there is a company or an opportunity — there is nothing to nag about yet.
 */
export function OutreachPulse() {
  const { db } = usePersonalData()
  const companyMap = useCompanyMap()

  const today = todayISO()
  const weekStartsOn = db.settings.weekStartsOn
  const weekKey = weekKeyOf(today, weekStartsOn)

  const due = useMemo(() => dueFollowUps(db, today), [db, today])
  const progress = useMemo(
    () => weeklyProgress(db, weekKey, weekStartsOn),
    [db, weekKey, weekStartsOn],
  )
  const replies = useMemo(
    () => outreachVelocity(db, weekKey, 1, weekStartsOn)[0]?.replies ?? 0,
    [db, weekKey, weekStartsOn],
  )

  const rows = useMemo<DueRow[]>(
    () =>
      [
        ...due.overdue.map((opportunity): DueRow => ({ opportunity, urgency: 'overdue' })),
        ...due.today.map((opportunity): DueRow => ({ opportunity, urgency: 'today' })),
        ...due.upcoming.map((opportunity): DueRow => ({ opportunity, urgency: 'upcoming' })),
      ].slice(0, 3),
    [due],
  )

  if (db.companies.length === 0 && db.opportunities.length === 0) return null

  const dueCount = due.overdue.length + due.today.length
  const onTarget = progress.target > 0 && progress.outbound >= progress.target

  return (
    <section aria-labelledby="overview-outreach">
      <Card>
        <CardHeader>
          <CardTitle as="h2" id="overview-outreach">
            Job search
          </CardTitle>
          <CardDescription>
            Follow-ups due, this week against target, and replies in. Nothing is sent from here.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <dl className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Follow-ups due</dt>
              <dd
                className={cn(
                  'mt-0.5 font-mono text-xl leading-none font-semibold tabular-nums',
                  due.overdue.length > 0 ? 'text-danger' : 'text-ink',
                )}
              >
                {dueCount}
              </dd>
              <dd className={cn('mt-1 text-[11px]', due.overdue.length > 0 ? 'text-danger' : 'text-ink-faint')}>
                {due.overdue.length > 0
                  ? `${due.overdue.length} overdue`
                  : dueCount > 0
                    ? 'all for today'
                    : 'none today'}
              </dd>
            </div>

            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Sent this week</dt>
              <dd className="mt-0.5 font-mono text-xl leading-none font-semibold text-ink tabular-nums">
                {progress.outbound}
                <span className="text-sm font-normal text-ink-faint">/{progress.target}</span>
              </dd>
              <dd className="mt-1.5">
                <Progress
                  value={progress.outbound}
                  max={Math.max(progress.target, 1)}
                  tone={onTarget ? 'positive' : 'accent'}
                  size="sm"
                />
                <span className="sr-only">
                  {progress.outbound} of {progress.target} outbound touches this week
                </span>
              </dd>
            </div>

            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Replies this week</dt>
              <dd className="mt-0.5 font-mono text-xl leading-none font-semibold text-ink tabular-nums">
                {replies}
              </dd>
              <dd className="mt-1 text-[11px] text-ink-faint">
                {replies > 0 ? 'answering earlier touches' : 'none yet'}
              </dd>
            </div>
          </dl>

          {rows.length > 0 ? (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {rows.map(({ opportunity, urgency }) => {
                const company = companyMap.get(opportunity.companyId)
                return (
                  <li key={opportunity.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon
                      name={urgency === 'upcoming' ? 'CalendarClock' : 'TriangleAlert'}
                      size={15}
                      className={cn('shrink-0', URGENCY_CLASS[urgency])}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {opportunity.title}
                        {company ? (
                          <span className="font-normal text-ink-muted"> · {company.name}</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-ink-faint">
                        {opportunity.nextAction?.trim() ? opportunity.nextAction : 'Follow up'}
                        {opportunity.nextActionDue ? (
                          <>
                            {' · '}
                            <time
                              dateTime={opportunity.nextActionDue}
                              className={cn('font-mono tabular-nums', URGENCY_CLASS[urgency])}
                            >
                              {urgency === 'overdue'
                                ? `${pluralize(daysSince(opportunity.nextActionDue, today), 'day')} overdue`
                                : relativeDay(opportunity.nextActionDue)}
                            </time>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Link
                      to={`${PERSONAL_ROUTES.outreachPipeline}?id=${encodeURIComponent(opportunity.id)}`}
                      className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-sm font-medium text-accent transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      Open
                      <span className="sr-only"> {opportunity.title}</span>
                      <Icon name="ArrowRight" size={14} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-ink-muted">
              No follow-ups due in the next week. Pick a quiet thread on the pipeline and give it a
              date.
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Link
            to={PERSONAL_ROUTES.outreach}
            className="inline-flex items-center gap-1 text-sm font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Open outreach
            <Icon name="ArrowRight" size={14} />
          </Link>
        </CardFooter>
      </Card>
    </section>
  )
}
