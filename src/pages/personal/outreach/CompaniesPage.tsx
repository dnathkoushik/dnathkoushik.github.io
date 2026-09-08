import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { MouseEvent, ReactNode } from 'react'
import type { Company, CompanyKind, Priority, Touch } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { CompanyDetail } from '@/components/outreach/CompanyDetail'
import { CompanyForm } from '@/components/outreach/CompanyForm'
import { CsvImportDialog, downloadCsv } from '@/components/outreach/CsvImportDialog'
import { FitScore } from '@/components/outreach/FitScore'
import { OpportunityForm } from '@/components/outreach/OpportunityForm'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { useOutreachSettings } from '@/hooks/outreach'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayLong, relativeDay, todayISO } from '@/utils/date'
import { pluralize, priorityTone } from '@/utils/format'
import { CHANNEL_META, fitScore, isTerminal, KIND_META } from '@/utils/outreach'

type SortKey = 'fit' | 'name' | 'priority' | 'touched'
type KindFilter = CompanyKind | 'all'
type PriorityFilter = Priority | 'all'

interface CompanyRow {
  company: Company
  fit: number
  openOpportunities: number
  contacts: number
  lastTouch?: Touch
}

const KINDS: CompanyKind[] = ['startup', 'scaleup', 'mnc', 'other']
const PRIORITIES: Priority[] = ['high', 'medium', 'low']
const SORTS: SortKey[] = ['fit', 'name', 'priority', 'touched']

const SORT_LABEL: Record<SortKey, string> = {
  fit: 'Fit score',
  name: 'Name',
  priority: 'Priority',
  touched: 'Recently touched',
}
const PRIORITY_LABEL: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' }
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function isKind(value: string | null): value is CompanyKind {
  return value !== null && (KINDS as string[]).includes(value)
}
function isPriority(value: string | null): value is Priority {
  return value !== null && (PRIORITIES as string[]).includes(value)
}
function isSort(value: string | null): value is SortKey {
  return value !== null && (SORTS as string[]).includes(value)
}

/** Ascending: oldest first. Date, then time, then when it was logged. */
function compareTouches(a: Touch, b: Touch): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    a.createdAt.localeCompare(b.createdAt)
  )
}

function compareRows(a: CompanyRow, b: CompanyRow, sort: SortKey): number {
  const byName = a.company.name.localeCompare(b.company.name)
  switch (sort) {
    case 'name':
      return byName
    case 'priority':
      return (
        PRIORITY_RANK[a.company.priority] - PRIORITY_RANK[b.company.priority] ||
        b.fit - a.fit ||
        byName
      )
    case 'touched': {
      if (a.lastTouch && b.lastTouch) return compareTouches(b.lastTouch, a.lastTouch) || byName
      if (a.lastTouch) return -1
      if (b.lastTouch) return 1
      return byName
    }
    case 'fit':
      return (
        b.fit - a.fit ||
        PRIORITY_RANK[a.company.priority] - PRIORITY_RANK[b.company.priority] ||
        byName
      )
    default:
      return byName
  }
}

/** True when the click landed on something that has its own behaviour. */
function isInteractive(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target
  return target instanceof Element && target.closest('a, button, [role="menu"], input, select') !== null
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
        'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:h-11',
        selected
          ? 'border-accent bg-accent-soft text-ink'
          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function LastTouch({ touch }: { touch?: Touch }) {
  if (!touch) return <span className="text-xs text-ink-faint">Never</span>
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-ink-muted tabular-nums">
      <Icon
        name={CHANNEL_META[touch.channel].icon}
        size={12}
        className="text-ink-faint"
        title={`${CHANNEL_META[touch.channel].label}, ${touch.direction}`}
      />
      <time dateTime={touch.date} title={formatDayLong(touch.date)}>
        {relativeDay(touch.date)}
      </time>
    </span>
  )
}

export default function CompaniesPage() {
  useDocumentMeta({
    title: 'Companies · Outreach',
    description: 'Target companies with source-cited facts and fit scores.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const { fitCriteria } = useOutreachSettings()
  const [params, setParams] = useSearchParams()
  const isPhone = useMediaQuery('(max-width: 639px)')

  /* -- URL state ---------------------------------------------------------- */
  const kind: KindFilter = isKind(params.get('kind')) ? (params.get('kind') as CompanyKind) : 'all'
  const priority: PriorityFilter = isPriority(params.get('priority'))
    ? (params.get('priority') as Priority)
    : 'all'
  const sort: SortKey = isSort(params.get('sort')) ? (params.get('sort') as SortKey) : 'fit'
  const showArchived = params.get('archived') === '1'
  const selectedId = params.get('id')
  const importOpen = params.get('import') === '1'

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const draft = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') draft.delete(key)
            else draft.set(key, value)
          }
          return draft
        },
        { replace: true },
      )
    },
    [setParams],
  )

  // The search box is local state so typing stays instant; the URL trails it.
  // Only a *change* in the debounced value is written back, so a back/forward
  // navigation that alters `?q=` is not immediately overwritten.
  const [query, setQuery] = useState(params.get('q') ?? '')
  const debouncedQuery = useDebouncedValue(query, 200)
  const lastSyncedQuery = useRef(debouncedQuery)
  useEffect(() => {
    if (lastSyncedQuery.current === debouncedQuery) return
    lastSyncedQuery.current = debouncedQuery
    updateParams({ q: debouncedQuery })
  }, [debouncedQuery, updateParams])

  /* -- Derived rows -------------------------------------------------------- */
  const rows = useMemo<CompanyRow[]>(() => {
    const opportunityCompany = new Map<string, string>()
    const openByCompany = new Map<string, number>()
    for (const opportunity of db.opportunities) {
      opportunityCompany.set(opportunity.id, opportunity.companyId)
      if (!isTerminal(opportunity.stage)) {
        openByCompany.set(opportunity.companyId, (openByCompany.get(opportunity.companyId) ?? 0) + 1)
      }
    }
    const contactCompany = new Map<string, string | undefined>()
    const contactsByCompany = new Map<string, number>()
    for (const contact of db.contacts) {
      contactCompany.set(contact.id, contact.companyId)
      if (contact.companyId) {
        contactsByCompany.set(contact.companyId, (contactsByCompany.get(contact.companyId) ?? 0) + 1)
      }
    }
    // A touch counts for a company when it names the company, one of its
    // opportunities or one of its contacts — the same rule as `lastTouch()`.
    const latest = new Map<string, Touch>()
    for (const touch of db.touches) {
      const ids = new Set<string>()
      if (touch.companyId) ids.add(touch.companyId)
      if (touch.opportunityId) {
        const id = opportunityCompany.get(touch.opportunityId)
        if (id) ids.add(id)
      }
      if (touch.contactId) {
        const id = contactCompany.get(touch.contactId)
        if (id) ids.add(id)
      }
      for (const id of ids) {
        const current = latest.get(id)
        if (!current || compareTouches(touch, current) > 0) latest.set(id, touch)
      }
    }
    return db.companies.map((company) => ({
      company,
      fit: fitScore(company, fitCriteria),
      openOpportunities: openByCompany.get(company.id) ?? 0,
      contacts: contactsByCompany.get(company.id) ?? 0,
      lastTouch: latest.get(company.id),
    }))
  }, [db.companies, db.opportunities, db.contacts, db.touches, fitCriteria])

  const visibleRows = useMemo(
    () => rows.filter((row) => showArchived || !row.company.archived),
    [rows, showArchived],
  )
  const archivedCount = useMemo(() => rows.filter((row) => row.company.archived).length, [rows])

  const kindCounts = useMemo(() => {
    const counts = new Map<CompanyKind, number>(KINDS.map((k) => [k, 0]))
    for (const row of visibleRows) {
      counts.set(row.company.kind, (counts.get(row.company.kind) ?? 0) + 1)
    }
    return counts
  }, [visibleRows])

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase()
    return visibleRows
      .filter(({ company }) => {
        if (kind !== 'all' && company.kind !== kind) return false
        if (priority !== 'all' && company.priority !== priority) return false
        if (needle) {
          const haystack = [
            company.name,
            company.industry ?? '',
            company.location ?? '',
            company.stage ?? '',
            ...company.tags,
          ]
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => compareRows(a, b, sort))
  }, [visibleRows, debouncedQuery, kind, priority, sort])

  const hasFilters = kind !== 'all' || priority !== 'all' || debouncedQuery.trim() !== '' || showArchived

  const tabCounts = useMemo(
    () => ({
      [PERSONAL_ROUTES.outreachPipeline]: db.opportunities.filter((o) => !isTerminal(o.stage)).length,
      [PERSONAL_ROUTES.outreachCompanies]: db.companies.filter((c) => !c.archived).length,
      [PERSONAL_ROUTES.outreachContacts]: db.contacts.length,
      [PERSONAL_ROUTES.outreachTemplates]: db.templates.filter((t) => !t.archived).length,
    }),
    [db.opportunities, db.companies, db.contacts, db.templates],
  )

  /* -- Dialogs ------------------------------------------------------------- */
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>(undefined)
  const [opportunityCompanyId, setOpportunityCompanyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Company | null>(null)

  const openDetail = (id: string) => updateParams({ id })
  const closeDetail = () => updateParams({ id: null })

  const openCreate = () => {
    setEditingId(undefined)
    setFormOpen(true)
  }

  const toggleArchived = (company: Company) => {
    const archived = !company.archived
    actions.updateCompany(company.id, { archived })
    toast({
      title: archived ? 'Company archived' : 'Company restored',
      description: archived
        ? `${company.name} is hidden from the list. Turn on "Show archived" to see it.`
        : `${company.name} is back on the list.`,
    })
  }

  const footprint = pendingDelete ? actions.companyFootprint(pendingDelete.id) : null

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    const removed = actions.deleteCompany(pendingDelete.id)
    setPendingDelete(null)
    if (selectedId === pendingDelete.id) closeDetail()
    toast({
      title: 'Company deleted',
      description: `${name} removed, along with ${pluralize(removed.opportunities, 'opportunity', 'opportunities')} and ${pluralize(removed.touches, 'touch', 'touches')}.`,
    })
  }

  const exportCsv = () => {
    downloadCsv(`outreach-companies-${todayISO()}.csv`, actions.exportOutreachCsv('companies'))
    toast({
      title: 'CSV exported',
      description: `${pluralize(db.companies.length, 'company', 'companies')}, including archived ones.`,
      tone: 'positive',
    })
  }

  const clearFilters = () => {
    setQuery('')
    updateParams({ q: null, kind: null, priority: null, archived: null })
  }

  const menuFor = (company: Company): DropdownMenuItem[] => [
    { id: 'open', label: 'Open', icon: 'ArrowUpRight', onSelect: () => openDetail(company.id) },
    {
      id: 'opportunity',
      label: 'New opportunity',
      icon: 'Briefcase',
      onSelect: () => setOpportunityCompanyId(company.id),
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: 'Pencil',
      onSelect: () => {
        setEditingId(company.id)
        setFormOpen(true)
      },
    },
    {
      id: 'archive',
      label: company.archived ? 'Unarchive' : 'Archive',
      icon: company.archived ? 'ArchiveRestore' : 'Archive',
      onSelect: () => toggleArchived(company),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'Trash',
      tone: 'danger',
      onSelect: () => setPendingDelete(company),
    },
  ]

  const pipelineLink = (companyId: string) =>
    `${PERSONAL_ROUTES.outreachPipeline}?company=${encodeURIComponent(companyId)}`

  /* -- Render -------------------------------------------------------------- */
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Companies"
        description="Target accounts, scored against your own criteria. Facts carry their sources so a hook is never invented."
        actions={
          <>
            <Button
              variant="secondary"
              icon="Download"
              onClick={exportCsv}
              disabled={db.companies.length === 0}
            >
              Export CSV
            </Button>
            <Button variant="secondary" icon="Upload" onClick={() => updateParams({ import: '1' })}>
              Import CSV
            </Button>
            <Button variant="primary" icon="Plus" onClick={openCreate}>
              Add company
            </Button>
          </>
        }
      />

      <OutreachTabs counts={tabCounts} />

      {db.companies.length === 0 ? (
        <EmptyState
          icon="Building2"
          title="No target companies yet"
          description="Start with five you would genuinely want to work at. Score each against your fit criteria, add one fact with a source, then find one person there."
          action={
            <>
              <Button variant="primary" icon="Plus" onClick={openCreate}>
                Add your first company
              </Button>
              <Button variant="secondary" icon="Upload" onClick={() => updateParams({ import: '1' })}>
                Import a CSV
              </Button>
            </>
          }
        />
      ) : (
        <>
          <section aria-label="Filters" className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="companies-search" className="sr-only">
                  Search companies
                </label>
                <Icon
                  name="Search"
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                />
                <Input
                  id="companies-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, industry, location, tags"
                  autoComplete="off"
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
                <div>
                  <label htmlFor="companies-priority" className="sr-only">
                    Filter by priority
                  </label>
                  <Select
                    id="companies-priority"
                    value={priority}
                    onChange={(event) => updateParams({ priority: event.target.value === 'all' ? null : event.target.value })}
                    wrapperClassName="sm:w-40"
                  >
                    <option value="all">Any priority</option>
                    {PRIORITIES.map((value) => (
                      <option key={value} value={value}>
                        {PRIORITY_LABEL[value]} priority
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="companies-sort" className="sr-only">
                    Sort by
                  </label>
                  <Select
                    id="companies-sort"
                    value={sort}
                    onChange={(event) => updateParams({ sort: event.target.value === 'fit' ? null : event.target.value })}
                    wrapperClassName="sm:w-44"
                  >
                    {SORTS.map((value) => (
                      <option key={value} value={value}>
                        Sort: {SORT_LABEL[value]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="group"
                aria-label="Filter by kind"
                className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
              >
                <Chip selected={kind === 'all'} onClick={() => updateParams({ kind: null })}>
                  All
                  <span className="font-mono text-[11px] text-ink-faint tabular-nums">{visibleRows.length}</span>
                </Chip>
                {KINDS.map((value) => (
                  <Chip key={value} selected={kind === value} onClick={() => updateParams({ kind: value })}>
                    {KIND_META[value].label}
                    <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                      {kindCounts.get(value) ?? 0}
                    </span>
                  </Chip>
                ))}
              </div>

              {archivedCount > 0 ? (
                <Switch
                  checked={showArchived}
                  onCheckedChange={(next) => updateParams({ archived: next ? '1' : null })}
                  label={`Show archived (${archivedCount})`}
                  className="w-auto shrink-0 sm:items-center"
                />
              ) : null}
            </div>

            <p role="status" aria-live="polite" className="font-mono text-xs text-ink-faint tabular-nums">
              {pluralize(filtered.length, 'company', 'companies')}
              {hasFilters && filtered.length !== visibleRows.length
                ? ` of ${visibleRows.length}`
                : ''}
              {!showArchived && archivedCount > 0 ? ` · ${archivedCount} archived hidden` : ''}
            </p>
          </section>

          {filtered.length === 0 ? (
            <EmptyState
              icon="Search"
              title="Nothing matches"
              description="Try a shorter search, another kind, or include archived companies."
              action={
                <Button variant="secondary" icon="X" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : isPhone ? (
            <ul className="grid grid-cols-1 gap-3" aria-label="Companies">
              {filtered.map((row) => (
                <li key={row.company.id}>
                  <Card interactive className="p-4">
                    <div className="flex items-start gap-3">
                      <FitScore company={row.company} size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openDetail(row.company.id)}
                          className="rounded-sm text-left text-[15px] font-semibold text-ink hover:text-accent"
                        >
                          {row.company.name}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-ink-faint">
                          {[KIND_META[row.company.kind].label, row.company.location].filter(Boolean).join(' · ')}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                          <Badge tone={priorityTone(row.company.priority)} size="sm">
                            {PRIORITY_LABEL[row.company.priority]}
                          </Badge>
                          {row.company.archived ? (
                            <Badge tone="warning" size="sm" icon="Archive">
                              Archived
                            </Badge>
                          ) : null}
                          <span className="font-mono tabular-nums">
                            {row.openOpportunities} open · {pluralize(row.contacts, 'contact')}
                          </span>
                          <LastTouch touch={row.lastTouch} />
                        </div>
                      </div>
                      <DropdownMenu items={menuFor(row.company)} label={`Actions for ${row.company.name}`} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface-muted/60 text-left text-xs text-ink-faint">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-medium">
                        Company
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Fit
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Priority
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Open opps
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Contacts
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Last touch
                      </th>
                      <th scope="col" className="px-2 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((row) => (
                      <tr
                        key={row.company.id}
                        onClick={(event) => {
                          if (!isInteractive(event)) openDetail(row.company.id)
                        }}
                        className={cn(
                          'cursor-pointer transition-colors duration-150 hover:bg-surface-hover/60',
                          row.company.archived && 'text-ink-muted',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openDetail(row.company.id)}
                              className="rounded-sm text-left font-medium text-ink hover:text-accent"
                            >
                              {row.company.name}
                              <span className="sr-only"> — open details</span>
                            </button>
                            {row.company.archived ? (
                              <Badge tone="warning" size="sm" icon="Archive">
                                Archived
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {[KIND_META[row.company.kind].label, row.company.location].filter(Boolean).join(' · ')}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <FitScore company={row.company} size="sm" />
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={priorityTone(row.company.priority)} size="sm">
                            {PRIORITY_LABEL[row.company.priority]}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {row.openOpportunities > 0 ? (
                            <Link
                              to={pipelineLink(row.company.id)}
                              className="rounded-sm text-ink underline-offset-2 hover:text-accent hover:underline"
                              aria-label={`${pluralize(row.openOpportunities, 'open opportunity', 'open opportunities')} at ${row.company.name} — view in pipeline`}
                            >
                              {row.openOpportunities}
                            </Link>
                          ) : (
                            <span className="text-ink-faint">–</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {row.contacts > 0 ? (
                            <span className="text-ink">{row.contacts}</span>
                          ) : (
                            <span className="text-ink-faint">–</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <LastTouch touch={row.lastTouch} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <DropdownMenu items={menuFor(row.company)} label={`Actions for ${row.company.name}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <CompanyDetail companyId={selectedId} onClose={closeDetail} />
      <CompanyForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        companyId={editingId}
        onSaved={(id) => {
          if (!editingId) openDetail(id)
        }}
      />
      <OpportunityForm
        open={opportunityCompanyId !== null}
        onClose={() => setOpportunityCompanyId(null)}
        defaults={opportunityCompanyId ? { companyId: opportunityCompanyId } : undefined}
      />
      <CsvImportDialog open={importOpen} onClose={() => updateParams({ import: null })} kind="companies" />
      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this company?"
        message={
          pendingDelete && footprint
            ? `${pendingDelete.name} will be removed from this device. This also removes ${pluralize(footprint.opportunities, 'opportunity', 'opportunities')} and ${pluralize(footprint.touches, 'touch', 'touches')}; ${pluralize(footprint.contacts, 'contact')} will be kept and unlinked. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete company"
        tone="danger"
      />
    </div>
  )
}
