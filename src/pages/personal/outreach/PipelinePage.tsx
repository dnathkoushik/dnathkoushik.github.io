import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Opportunity, OpportunityStage, OpportunityType, Priority } from '@/types'
import type { OpportunityInput } from '@/services/contracts'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { OpportunityCard } from '@/components/outreach/OpportunityCard'
import { OpportunityDetail } from '@/components/outreach/OpportunityDetail'
import { OpportunityForm } from '@/components/outreach/OpportunityForm'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { StageBadge } from '@/components/outreach/StageBadge'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useCompanies, useOpportunities, useOpportunityMap } from '@/hooks/outreach'
import { cn } from '@/lib/cn'
import { STAGES, STAGE_META, isTerminal } from '@/utils/outreach'

type TypeFilter = 'all' | OpportunityType

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'internship', label: 'Internship' },
  { value: 'full-time', label: 'Full-time' },
]

const PRIORITIES: Priority[] = ['high', 'medium', 'low']

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PRIORITY_DOT: Record<Priority, string> = {
  high: 'bg-danger',
  medium: 'bg-warning',
  low: 'bg-ink-faint',
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const OPEN_STAGES: OpportunityStage[] = STAGES.filter((stage) => !isTerminal(stage))

function isTypeFilter(value: string | null): value is TypeFilter {
  return value === 'all' || value === 'internship' || value === 'full-time'
}

function isPriority(value: string): value is Priority {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isStage(value: string | null): value is OpportunityStage {
  return value !== null && STAGES.includes(value as OpportunityStage)
}

/** Most urgent first: priority, then the nearest due date, then most recently touched. */
function byUrgency(a: Opportunity, b: Opportunity): number {
  return (
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.nextActionDue ?? '9999').localeCompare(b.nextActionDue ?? '9999') ||
    b.updatedAt.localeCompare(a.updatedAt)
  )
}

interface StageGroup {
  stage: OpportunityStage
  items: Opportunity[]
}

interface FormState {
  open: boolean
  defaults?: Partial<OpportunityInput>
}

export default function PipelinePage() {
  useDocumentMeta({
    title: 'Pipeline',
    description: 'Every opportunity by stage, from researching to offer.',
    noindex: true,
  })

  const [params, setParams] = useSearchParams()
  const companies = useCompanies(true)
  const all = useOpportunities()
  const opportunityMap = useOpportunityMap()
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  /* -- URL state -------------------------------------------------------- */
  const typeParam = params.get('type')
  const type: TypeFilter = isTypeFilter(typeParam) ? typeParam : 'all'
  const companyId = params.get('company') ?? ''
  const showClosedParam = params.get('closed') === '1'
  const stageParam = params.get('stage')
  const stageFilter = isStage(stageParam) ? stageParam : null
  const priorities = useMemo(
    () => new Set((params.get('priority') ?? '').split(',').filter(isPriority)),
    [params],
  )
  const detailParam = params.get('id')
  const detailId = detailParam && opportunityMap.has(detailParam) ? detailParam : null

  // A closed stage in the filter means the closed group must be visible.
  const showClosed = showClosedParam || (stageFilter !== null && isTerminal(stageFilter))

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') next.delete(key)
        else next.set(key, value)
      }
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  // A stale deep link (the record was deleted) should not linger in the URL.
  useEffect(() => {
    if (detailParam && !opportunityMap.has(detailParam)) update({ id: null })
  }, [detailParam, opportunityMap, update])

  const togglePriority = (priority: Priority) => {
    const next = new Set(priorities)
    if (next.has(priority)) next.delete(priority)
    else next.add(priority)
    update({ priority: PRIORITIES.filter((item) => next.has(item)).join(',') })
  }

  const clearFilters = () =>
    update({ type: null, company: null, priority: null, stage: null })

  const filtersActive =
    type !== 'all' || companyId !== '' || priorities.size > 0 || stageFilter !== null

  /* -- data ------------------------------------------------------------- */
  const filtered = useMemo(
    () =>
      all
        .filter((opportunity) => {
          if (type !== 'all' && opportunity.type !== type) return false
          if (companyId && opportunity.companyId !== companyId) return false
          if (priorities.size > 0 && !priorities.has(opportunity.priority)) return false
          if (stageFilter && opportunity.stage !== stageFilter) return false
          return true
        })
        .sort(byUrgency),
    [all, type, companyId, priorities, stageFilter],
  )

  const groups: StageGroup[] = useMemo(() => {
    const visible = stageFilter && !isTerminal(stageFilter) ? [stageFilter] : stageFilter ? [] : OPEN_STAGES
    return visible.map((stage) => ({
      stage,
      items: filtered.filter((opportunity) => opportunity.stage === stage),
    }))
  }, [filtered, stageFilter])

  const closed = useMemo(
    () => filtered.filter((opportunity) => isTerminal(opportunity.stage)),
    [filtered],
  )
  const closedTotal = useMemo(
    () => all.filter((opportunity) => isTerminal(opportunity.stage)).length,
    [all],
  )
  const openCount = all.length - closedTotal

  /* -- dialogs ---------------------------------------------------------- */
  const [form, setForm] = useState<FormState>({ open: false })
  const openForm = (defaults?: Partial<OpportunityInput>) => setForm({ open: true, defaults })
  const openDetail = (id: string) => update({ id })
  const closeDetail = () => update({ id: null })

  const addDefaults = (stage: OpportunityStage): Partial<OpportunityInput> => ({
    stage,
    ...(type !== 'all' ? { type } : {}),
    ...(companyId ? { companyId } : {}),
  })

  const nothingAtAll = all.length === 0
  const nothingMatches = !nothingAtAll && filtered.length === 0
  const hasCompanies = companies.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Pipeline"
        description="Every role you are pursuing, by stage. Move a card with its arrows or its menu; open it for the full record."
        actions={
          <Button
            variant="primary"
            icon="Plus"
            onClick={() => openForm(addDefaults('researching'))}
            disabled={!hasCompanies}
          >
            New opportunity
          </Button>
        }
      />

      <OutreachTabs counts={{ [PERSONAL_ROUTES.outreachPipeline]: openCount }} />

      <section aria-label="Filters" className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SegmentedControl<TypeFilter>
          value={type}
          onChange={(next) => update({ type: next === 'all' ? null : next })}
          options={TYPE_OPTIONS}
          ariaLabel="Opportunity type"
          size="sm"
          className="w-full sm:w-auto"
        />

        <Select
          aria-label="Company"
          value={companyId}
          onChange={(event) => update({ company: event.target.value })}
          wrapperClassName="w-full sm:w-60"
          className="h-9 pointer-coarse:h-11"
        >
          <option value="">All companies</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
              {company.archived ? ' (archived)' : ''}
            </option>
          ))}
        </Select>

        <div
          role="group"
          aria-label="Priority"
          className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
        >
          {PRIORITIES.map((priority) => {
            const active = priorities.has(priority)
            return (
              <button
                key={priority}
                type="button"
                aria-pressed={active}
                onClick={() => togglePriority(priority)}
                className={cn(
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors pointer-coarse:h-11',
                  'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
                  active
                    ? 'border-accent bg-accent-soft text-ink'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                <span aria-hidden="true" className={cn('size-2 rounded-full', PRIORITY_DOT[priority])} />
                {PRIORITY_LABEL[priority]}
              </button>
            )
          })}
          {stageFilter ? (
            <button
              type="button"
              onClick={() => update({ stage: null })}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-3 text-xs font-medium whitespace-nowrap text-ink outline-accent transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:h-11"
            >
              Stage: {STAGE_META[stageFilter].label}
              <Icon name="X" size={12} />
              <span className="sr-only"> (remove stage filter)</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 lg:ml-auto">
          {filtersActive ? (
            <Button size="sm" variant="ghost" icon="X" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <Switch
            checked={showClosed}
            onCheckedChange={(next) => update({ closed: next ? '1' : null })}
            label="Show closed"
            description={closedTotal > 0 ? `${closedTotal} closed` : undefined}
            disabled={stageFilter !== null && isTerminal(stageFilter)}
            className="w-auto gap-3"
          />
        </div>
      </section>

      {nothingAtAll ? (
        <EmptyState
          icon="Funnel"
          title={hasCompanies ? 'No opportunities yet' : 'Add a company before a role'}
          description={
            hasCompanies
              ? 'An opportunity is a role at one of your companies. It starts at Researching and moves right as the conversation does.'
              : 'Opportunities hang off target companies. Add one first, then the roles you are pursuing there.'
          }
          action={
            hasCompanies ? (
              <Button variant="primary" icon="Plus" onClick={() => openForm(addDefaults('researching'))}>
                New opportunity
              </Button>
            ) : (
              <ButtonLink to={PERSONAL_ROUTES.outreachCompanies} variant="primary" icon="Building2">
                Go to Companies
              </ButtonLink>
            )
          }
          className="animate-rise py-16"
        />
      ) : nothingMatches ? (
        <EmptyState
          icon="Funnel"
          title="Nothing matches these filters"
          description="Loosen a filter or clear them all to see the whole board."
          action={
            <Button variant="secondary" icon="X" onClick={clearFilters}>
              Clear filters
            </Button>
          }
          className="animate-rise py-12"
        />
      ) : isDesktop ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          <ol aria-label="Pipeline board" className="flex min-w-max gap-3">
            {groups.map((group) => (
              <li
                key={group.stage}
                className="flex w-64 shrink-0 flex-col rounded-card border border-line bg-surface-muted/40"
              >
                <header className="flex items-center gap-2 px-3 py-2">
                  <StageBadge stage={group.stage} size="sm" />
                  <span className="font-mono text-xs tabular-nums text-ink-faint" aria-live="polite">
                    {group.items.length}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="Plus"
                    aria-label={`Add an opportunity at ${STAGE_META[group.stage].label}`}
                    onClick={() => openForm(addDefaults(group.stage))}
                    className="ml-auto size-8"
                  />
                </header>
                {group.items.length === 0 ? (
                  <p className="px-3 pt-1 pb-3 text-xs leading-relaxed text-ink-faint">
                    {STAGE_META[group.stage].hint}
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2 px-2 pb-2">
                    {group.items.map((opportunity) => (
                      <li key={opportunity.id}>
                        <OpportunityCard opportunity={opportunity} onOpen={openDetail} compact />
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}

            <li
              className={cn(
                'flex shrink-0 flex-col rounded-card border border-dashed border-line',
                showClosed ? 'w-64 bg-surface-muted/40' : 'w-40',
              )}
            >
              <header className="flex items-center px-2 py-1">
                <button
                  type="button"
                  aria-expanded={showClosed}
                  onClick={() => update({ closed: showClosed ? null : '1' })}
                  className="flex min-h-9 flex-1 items-center gap-2 rounded-lg px-1 text-left text-xs font-medium text-ink-muted outline-accent transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Icon name={showClosed ? 'ChevronDown' : 'ChevronRight'} size={14} />
                  Closed
                  <span className="font-mono tabular-nums text-ink-faint">· {closed.length}</span>
                </button>
              </header>
              {showClosed ? (
                closed.length === 0 ? (
                  <p className="px-3 pt-1 pb-3 text-xs leading-relaxed text-ink-faint">
                    Nothing closed matches the current filters.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2 px-2 pb-2">
                    {closed.map((opportunity) => (
                      <li key={opportunity.id}>
                        <OpportunityCard opportunity={opportunity} onOpen={openDetail} />
                      </li>
                    ))}
                  </ol>
                )
              ) : (
                <p className="px-3 pt-1 pb-3 text-xs leading-relaxed text-ink-faint">
                  Accepted, rejected, ghosted and withdrawn.
                </p>
              )}
            </li>
          </ol>
        </div>
      ) : (
        <div className="space-y-6">
          {groups
            .filter((group) => group.items.length > 0 || stageFilter !== null)
            .map((group) => (
              <section key={group.stage} aria-labelledby={`stage-group-${group.stage}`}>
                <header className="sticky top-14 z-10 -mx-4 flex items-center gap-2 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
                  <h2 id={`stage-group-${group.stage}`} className="flex items-center gap-2">
                    <StageBadge stage={group.stage} size="sm" />
                    <span className="font-mono text-xs tabular-nums text-ink-faint">
                      {group.items.length}
                    </span>
                  </h2>
                  <Button
                    size="icon"
                    variant="ghost"
                    icon="Plus"
                    aria-label={`Add an opportunity at ${STAGE_META[group.stage].label}`}
                    onClick={() => openForm(addDefaults(group.stage))}
                    className="ml-auto"
                  />
                </header>
                {group.items.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">{STAGE_META[group.stage].hint}</p>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {group.items.map((opportunity) => (
                      <li key={opportunity.id}>
                        <OpportunityCard opportunity={opportunity} onOpen={openDetail} compact />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

          {groups.every((group) => group.items.length === 0) && stageFilter === null ? (
            <p className="text-sm text-ink-muted">Every matching opportunity is closed.</p>
          ) : null}

          {showClosed ? (
            <section aria-labelledby="stage-group-closed">
              <header className="sticky top-14 z-10 -mx-4 flex items-center gap-2 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
                <h2 id="stage-group-closed" className="flex items-center gap-2 text-sm font-semibold text-ink">
                  Closed
                  <span className="font-mono text-xs font-normal tabular-nums text-ink-faint">
                    {closed.length}
                  </span>
                </h2>
              </header>
              {closed.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">
                  Nothing closed matches the current filters.
                </p>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {closed.map((opportunity) => (
                    <li key={opportunity.id}>
                      <OpportunityCard opportunity={opportunity} onOpen={openDetail} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : closed.length > 0 ? (
            <Button
              variant="subtle"
              icon="ChevronRight"
              onClick={() => update({ closed: '1' })}
              fullWidth
            >
              Show {closed.length} closed
            </Button>
          ) : null}
        </div>
      )}

      <OpportunityDetail opportunityId={detailId} onClose={closeDetail} />
      <OpportunityForm
        open={form.open}
        onClose={() => setForm((prev) => ({ ...prev, open: false }))}
        defaults={form.defaults}
      />
    </div>
  )
}
