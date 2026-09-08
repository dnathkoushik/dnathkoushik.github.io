import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Opportunity, Tone } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Stat } from '@/components/ui/Stat'
import { useToast } from '@/components/ui/Toast'
import { CompanyForm } from '@/components/outreach/CompanyForm'
import { ComposeDialog } from '@/components/outreach/ComposeDialog'
import { OpportunityDetail } from '@/components/outreach/OpportunityDetail'
import { OpportunityForm } from '@/components/outreach/OpportunityForm'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { PipelineFunnel } from '@/components/outreach/PipelineFunnel'
import { StageBadge } from '@/components/outreach/StageBadge'
import { TouchForm } from '@/components/outreach/TouchForm'
import { VelocityChart } from '@/components/outreach/VelocityChart'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useCompanyMap, useOpportunityMap, useOutreachSettings } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatWeekLabel, relativeDay, shiftDay, todayISO, weekKeyOf } from '@/utils/date'
import { pluralize } from '@/utils/format'
import {
  CHANNEL_META,
  daysToFirstReply,
  dueFollowUps,
  outreachVelocity,
  pipelineSummary,
  rateByChannel,
  rateByTemplate,
  responseRate,
  staleOpportunities,
  weeklyProgress,
} from '@/utils/outreach'

/** Days a snoozed follow-up moves by. Counted from today when it was already overdue. */
const SNOOZE_DAYS = 3

interface FollowUpGroup {
  id: string
  label: string
  tone: Tone
  items: Opportunity[]
}

export default function OutreachOverviewPage() {
  useDocumentMeta({
    title: 'Outreach',
    description: 'Pipeline health, follow-ups due and this week’s outreach, computed from private data.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const settings = useOutreachSettings()
  const companyMap = useCompanyMap()
  const opportunityMap = useOpportunityMap()

  const weekStartsOn = db.settings.weekStartsOn
  const today = todayISO()
  const weekKey = weekKeyOf(today, weekStartsOn)

  const summary = useMemo(() => pipelineSummary(db, today), [db, today])
  const week = useMemo(() => weeklyProgress(db, weekKey, weekStartsOn), [db, weekKey, weekStartsOn])
  const thisWeek = useMemo(
    () => outreachVelocity(db, weekKey, 1, weekStartsOn)[0],
    [db, weekKey, weekStartsOn],
  )
  const overall = useMemo(() => responseRate(db.touches, db.touches), [db.touches])
  const latency = useMemo(() => daysToFirstReply(db), [db])
  const due = useMemo(() => dueFollowUps(db, today), [db, today])
  const stale = useMemo(
    () => staleOpportunities(db, today, settings.staleAfterDays),
    [db, today, settings.staleAfterDays],
  )
  const channels = useMemo(() => rateByChannel(db), [db])
  const templates = useMemo(() => rateByTemplate(db), [db])

  const openCount = summary.open
  const hasCompanies = db.companies.length > 0
  const wholeDatabaseEmpty =
    !hasCompanies &&
    db.contacts.length === 0 &&
    db.opportunities.length === 0 &&
    db.touches.length === 0 &&
    db.tasks.length === 0 &&
    db.logs.length === 0 &&
    db.notes.length === 0

  const [touchFormOpen, setTouchFormOpen] = useState(false)
  const [opportunityFormOpen, setOpportunityFormOpen] = useState(false)
  const [companyFormOpen, setCompanyFormOpen] = useState(false)
  const [composeFor, setComposeFor] = useState<Opportunity | null>(null)
  const [seeding, setSeeding] = useState(false)

  /* Deep link: `?id=<opportunityId>` opens that record's dialog. */
  const detailParam = params.get('id')
  const detailId = detailParam && opportunityMap.has(detailParam) ? detailParam : null

  const openDetail = useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      next.set('id', id)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(params)
    next.delete('id')
    setParams(next, { replace: true })
  }, [params, setParams])

  const linkedTask = (opportunity: Opportunity) =>
    db.tasks.find(
      (task) =>
        task.link?.kind === 'opportunity' &&
        task.link.id === opportunity.id &&
        task.date === opportunity.nextActionDue &&
        task.status !== 'completed',
    )

  const nameOf = (opportunity: Opportunity) =>
    `${companyMap.get(opportunity.companyId)?.name ?? 'Unknown company'} · ${opportunity.title}`

  const markDone = (opportunity: Opportunity) => {
    const task = linkedTask(opportunity)
    if (task) actions.setTaskStatus(task.id, 'completed')
    actions.updateOpportunity(opportunity.id, { nextAction: undefined, nextActionDue: undefined })
    toast({
      title: 'Follow-up done',
      description: task
        ? `${nameOf(opportunity)} — the task on Today is completed too.`
        : `${nameOf(opportunity)} — next action cleared.`,
      tone: 'positive',
    })
  }

  const snooze = (opportunity: Opportunity) => {
    const current = opportunity.nextActionDue ?? today
    const base = current < today ? today : current
    const next = shiftDay(base, SNOOZE_DAYS)
    const task = linkedTask(opportunity)
    if (task) actions.updateTask(task.id, { date: next })
    actions.updateOpportunity(opportunity.id, { nextActionDue: next })
    toast({
      title: `Snoozed to ${relativeDay(next).toLowerCase()}`,
      description: task
        ? `${nameOf(opportunity)} — the task on Today moved with it.`
        : nameOf(opportunity),
    })
  }

  async function loadSample() {
    setSeeding(true)
    try {
      await actions.loadSampleData()
      toast({
        title: 'Sample data loaded',
        description: 'Every screen now has something real to show. Clear it any time from Settings.',
        tone: 'positive',
        duration: 5000,
      })
    } catch {
      toast({
        title: 'Could not load the sample data',
        description: 'This browser refused to write to its own storage. Try again in a normal window.',
        tone: 'danger',
        duration: 6000,
      })
    } finally {
      setSeeding(false)
    }
  }

  const followUpGroups: FollowUpGroup[] = [
    { id: 'overdue', label: 'Overdue', tone: 'danger', items: due.overdue },
    { id: 'today', label: 'Due today', tone: 'accent', items: due.today },
    { id: 'upcoming', label: 'Next 7 days', tone: 'neutral', items: due.upcoming },
  ]
  const followUpTotal = due.overdue.length + due.today.length + due.upcoming.length

  const ringTone: Tone = week.pct >= 100 ? 'positive' : week.pct > 0 ? 'accent' : 'neutral'
  const lateStage = summary.interviewing + summary.offers

  const tabCounts = {
    [PERSONAL_ROUTES.outreachPipeline]: openCount,
    [PERSONAL_ROUTES.outreachCompanies]: db.companies.filter((company) => !company.archived).length,
    [PERSONAL_ROUTES.outreachContacts]: db.contacts.length,
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Job search, today"
        description="What to do next about the internship and full-time search. Nothing here sends anything by itself — composing opens Gmail or your mail app pre-filled, and you log what happened."
        actions={
          <ButtonLink to={PERSONAL_ROUTES.outreachPipeline} variant="secondary" icon="Funnel">
            Open the pipeline
          </ButtonLink>
        }
      />

      <OutreachTabs counts={tabCounts} />

      {!hasCompanies ? (
        <EmptyState
          icon="Building2"
          title="Start with a company you actually want to work at"
          description="Everything here hangs off target companies: the people in them, the roles you pursue, and every message you send. Add one, or import a list you already keep."
          action={
            <>
              <Button variant="primary" icon="Plus" onClick={() => setCompanyFormOpen(true)}>
                Add your first company
              </Button>
              <ButtonLink
                to={`${PERSONAL_ROUTES.outreachCompanies}?import=1`}
                variant="secondary"
                icon="Upload"
              >
                Import CSV
              </ButtonLink>
              {wholeDatabaseEmpty ? (
                <Button variant="ghost" icon="Sparkles" loading={seeding} onClick={loadSample}>
                  Load sample data
                </Button>
              ) : null}
            </>
          }
          className="animate-rise py-16"
        />
      ) : (
        <>
          <section aria-labelledby="outreach-stats-heading" className="space-y-3 animate-rise">
            <h2 id="outreach-stats-heading" className="sr-only">
              Pipeline at a glance
            </h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat
                label="Open"
                value={summary.open}
                sublabel={
                  summary.open === 1 ? 'opportunity in play' : 'opportunities in play'
                }
                icon="Funnel"
                tone="accent"
              />
              <Stat
                label="Late stage"
                value={lateStage}
                sublabel={`${summary.interviewing} interviewing · ${summary.offers} ${summary.offers === 1 ? 'offer' : 'offers'}`}
                icon="Star"
                tone={lateStage > 0 ? 'positive' : 'neutral'}
              />
              <Stat
                label="Reply rate"
                value={`${summary.replyRate}%`}
                sublabel={
                  overall.sent > 0
                    ? `${overall.replied} of ${overall.sent} outbound answered${latency.avg !== null ? ` · ${latency.avg}d to first reply` : ''}`
                    : 'No outbound touches yet'
                }
                icon="Percent"
                tone="info"
              />
              <Stat
                label="Due today"
                value={summary.dueToday}
                sublabel={
                  summary.overdue > 0
                    ? `${pluralize(summary.overdue, 'follow-up')} overdue`
                    : 'Nothing overdue'
                }
                icon="CalendarCheck"
                tone={summary.overdue > 0 ? 'danger' : 'neutral'}
              />
              <Stat
                label="Going stale"
                value={summary.stale}
                sublabel={`No touch in ${settings.staleAfterDays}+ days`}
                icon="Hourglass"
                tone={summary.stale > 0 ? 'warning' : 'neutral'}
                className="col-span-2 lg:col-span-1"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section aria-labelledby="outreach-week-heading">
              <Card className="h-full animate-rise">
                <CardHeader>
                  <CardTitle as="h2" id="outreach-week-heading">
                    This week
                  </CardTitle>
                  <CardDescription>{formatWeekLabel(weekKey, weekStartsOn)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex items-center gap-4">
                    <ProgressRing
                      value={week.pct}
                      size={76}
                      thickness={7}
                      tone={ringTone}
                      label={`Outbound touches this week against a target of ${week.target}`}
                    >
                      <span className="font-mono text-sm font-semibold text-ink tabular-nums">
                        {week.outbound}
                        <span className="text-ink-faint">/{week.target}</span>
                      </span>
                    </ProgressRing>
                    <div className="min-w-0" aria-live="polite">
                      <p className="text-sm font-medium text-ink">
                        {pluralize(week.outbound, 'outbound touch', 'outbound touches')}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                        {week.target > 0
                          ? week.outbound >= week.target
                            ? 'Target met. Anything more is a bonus.'
                            : `${week.target - week.outbound} more to hit your weekly target.`
                          : 'Set a weekly target in Settings → Outreach.'}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Outbound', value: thisWeek?.outbound ?? 0 },
                      { label: 'Inbound', value: thisWeek?.inbound ?? 0 },
                      { label: 'Replies', value: thisWeek?.replies ?? 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg bg-surface-muted px-2 py-2.5">
                        <dt className="text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                          {item.label}
                        </dt>
                        <dd className="mt-0.5 font-mono text-lg font-semibold text-ink tabular-nums">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="flex flex-col gap-2">
                    <Button variant="primary" icon="Send" onClick={() => setTouchFormOpen(true)}>
                      Log a touch
                    </Button>
                    <Button
                      variant="secondary"
                      icon="Plus"
                      onClick={() => setOpportunityFormOpen(true)}
                    >
                      New opportunity
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="outreach-followups-heading" className="lg:col-span-2">
              <Card className="h-full animate-rise">
                <CardHeader
                  actions={
                    followUpTotal > 0 ? (
                      <Badge tone={due.overdue.length > 0 ? 'danger' : 'neutral'}>
                        {followUpTotal} due
                      </Badge>
                    ) : undefined
                  }
                >
                  <CardTitle as="h2" id="outreach-followups-heading">
                    Follow-ups
                  </CardTitle>
                  <CardDescription>
                    Scheduled follow-ups are real tasks on Today. Done completes the task; snooze
                    moves it {SNOOZE_DAYS} days.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {followUpTotal === 0 ? (
                    <EmptyState
                      icon="CalendarCheck"
                      title="Nothing due in the next week"
                      description="Open an opportunity and schedule a follow-up. It lands here and on the Today page under Career."
                      className="py-8"
                    />
                  ) : (
                    <div className="space-y-4">
                      {followUpGroups
                        .filter((group) => group.items.length > 0)
                        .map((group) => (
                          <div key={group.id}>
                            <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-faint uppercase">
                              <Badge tone={group.tone} size="sm">
                                {group.label}
                              </Badge>
                              <span className="font-mono tabular-nums">{group.items.length}</span>
                            </h3>
                            <ul className="divide-y divide-line">
                              {group.items.map((opportunity) => {
                                const company = companyMap.get(opportunity.companyId)
                                const dueDate = opportunity.nextActionDue
                                const overdue = group.id === 'overdue'
                                return (
                                  <li
                                    key={opportunity.id}
                                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => openDetail(opportunity.id)}
                                        className="max-w-full truncate rounded-sm text-left text-sm font-medium text-ink outline-accent transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                                      >
                                        {company?.name ?? 'Unknown company'}
                                        <span className="font-normal text-ink-muted"> · {opportunity.title}</span>
                                      </button>
                                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                                        <span className="truncate">{opportunity.nextAction ?? 'Follow up'}</span>
                                        {dueDate ? (
                                          <span
                                            className={cn(
                                              'font-mono tabular-nums',
                                              overdue ? 'text-danger' : 'text-ink-faint',
                                            )}
                                          >
                                            {overdue ? `overdue · ${relativeDay(dueDate).toLowerCase()}` : relativeDay(dueDate)}
                                          </span>
                                        ) : null}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        icon="Check"
                                        onClick={() => markDone(opportunity)}
                                        aria-label={`Mark follow-up done: ${nameOf(opportunity)}`}
                                      >
                                        Done
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        icon="Clock"
                                        onClick={() => snooze(opportunity)}
                                        aria-label={`Snooze ${SNOOZE_DAYS} days: ${nameOf(opportunity)}`}
                                      >
                                        Snooze +{SNOOZE_DAYS}d
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        icon="ArrowUpRight"
                                        onClick={() => openDetail(opportunity.id)}
                                        aria-label={`Open ${nameOf(opportunity)}`}
                                      >
                                        Open
                                      </Button>
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>

          <section aria-labelledby="outreach-stale-heading">
            <Card className="animate-rise">
              <CardHeader
                actions={
                  stale.length > 0 ? <Badge tone="warning">{stale.length} quiet</Badge> : undefined
                }
              >
                <CardTitle as="h2" id="outreach-stale-heading">
                  Going stale
                </CardTitle>
                <CardDescription>
                  Open opportunities past Researching with no touch in {settings.staleAfterDays}{' '}
                  days or more. One short note keeps a thread alive.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stale.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    Nothing is going quiet. Every open thread has been touched recently.
                  </p>
                ) : (
                  <ul className="divide-y divide-line">
                    {stale.map(({ opportunity, daysSinceTouch }) => {
                      const company = companyMap.get(opportunity.companyId)
                      return (
                        <li
                          key={opportunity.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4"
                        >
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => openDetail(opportunity.id)}
                              className="max-w-full truncate rounded-sm text-left text-sm font-medium text-ink outline-accent transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                              {company?.name ?? 'Unknown company'}
                              <span className="font-normal text-ink-muted"> · {opportunity.title}</span>
                            </button>
                            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                              <StageBadge stage={opportunity.stage} size="sm" />
                              <span className="font-mono tabular-nums text-warning">
                                {daysSinceTouch}d since last touch
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="Send"
                              onClick={() => setComposeFor(opportunity)}
                              aria-label={`Compose a follow-up to ${nameOf(opportunity)}`}
                            >
                              Follow up
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="ArrowUpRight"
                              onClick={() => openDetail(opportunity.id)}
                              aria-label={`Open ${nameOf(opportunity)}`}
                            >
                              Open
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PipelineFunnel className="animate-rise" />
            <VelocityChart className="animate-rise" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section aria-labelledby="outreach-channels-heading">
              <Card className="h-full animate-rise">
                <CardHeader>
                  <CardTitle as="h2" id="outreach-channels-heading">
                    Response rate by channel
                  </CardTitle>
                  <CardDescription>
                    An outbound touch counts as answered when you marked it replied or a later
                    inbound touch exists on the same thread.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {channels.length === 0 ? (
                    <p className="text-sm text-ink-muted">No outbound touches logged yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Outbound touches, replies and reply rate per channel</caption>
                        <thead className="text-xs text-ink-faint">
                          <tr>
                            <th scope="col" className="py-1.5 pr-3 font-medium">Channel</th>
                            <th scope="col" className="px-3 py-1.5 text-right font-medium">Sent</th>
                            <th scope="col" className="px-3 py-1.5 text-right font-medium">Replied</th>
                            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {channels.map((row) => (
                            <tr key={row.channel}>
                              <th scope="row" className="py-2 pr-3 font-medium text-ink">
                                <span className="inline-flex items-center gap-2">
                                  <Icon name={CHANNEL_META[row.channel].icon} size={14} className="text-ink-faint" />
                                  {CHANNEL_META[row.channel].label}
                                </span>
                              </th>
                              <td className="px-3 py-2 text-right font-mono text-ink tabular-nums">{row.sent}</td>
                              <td className="px-3 py-2 text-right font-mono text-ink tabular-nums">{row.replied}</td>
                              <td className="py-2 pl-3 text-right font-mono text-ink tabular-nums">{row.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section aria-labelledby="outreach-templates-heading">
              <Card className="h-full animate-rise">
                <CardHeader
                  actions={
                    <ButtonLink to={PERSONAL_ROUTES.outreachTemplates} variant="ghost" size="sm" iconRight="ArrowRight">
                      Templates
                    </ButtonLink>
                  }
                >
                  <CardTitle as="h2" id="outreach-templates-heading">
                    Response rate by template
                  </CardTitle>
                  <CardDescription>
                    Only touches composed from a template count. Deleted templates keep their history.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {templates.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      Nothing composed from a template yet. Compose from an opportunity to start
                      measuring which message works.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <caption className="sr-only">Outbound touches, replies and reply rate per template</caption>
                        <thead className="text-xs text-ink-faint">
                          <tr>
                            <th scope="col" className="py-1.5 pr-3 font-medium">Template</th>
                            <th scope="col" className="px-3 py-1.5 text-right font-medium">Sent</th>
                            <th scope="col" className="px-3 py-1.5 text-right font-medium">Replied</th>
                            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {templates.map((row) => (
                            <tr key={row.templateId}>
                              <th scope="row" className="max-w-56 truncate py-2 pr-3 font-medium text-ink">
                                {row.name}
                              </th>
                              <td className="px-3 py-2 text-right font-mono text-ink tabular-nums">{row.sent}</td>
                              <td className="px-3 py-2 text-right font-mono text-ink tabular-nums">{row.replied}</td>
                              <td className="py-2 pl-3 text-right font-mono text-ink tabular-nums">{row.rate}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </div>
        </>
      )}

      <OpportunityDetail opportunityId={detailId} onClose={closeDetail} />
      <TouchForm open={touchFormOpen} onClose={() => setTouchFormOpen(false)} />
      <OpportunityForm open={opportunityFormOpen} onClose={() => setOpportunityFormOpen(false)} />
      <CompanyForm open={companyFormOpen} onClose={() => setCompanyFormOpen(false)} />
      <ComposeDialog
        open={composeFor !== null}
        onClose={() => setComposeFor(null)}
        opportunityId={composeFor?.id}
        contactId={composeFor?.contactId}
        companyId={composeFor?.companyId}
      />
    </div>
  )
}
