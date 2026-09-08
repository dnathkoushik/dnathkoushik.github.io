import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { MouseEvent, ReactNode } from 'react'
import type { Company, Contact, ContactWarmth, Touch } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
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
import { useToast } from '@/components/ui/Toast'
import { ComposeDialog } from '@/components/outreach/ComposeDialog'
import { ContactDetail } from '@/components/outreach/ContactDetail'
import { ContactForm } from '@/components/outreach/ContactForm'
import { CsvImportDialog, downloadCsv } from '@/components/outreach/CsvImportDialog'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { TouchForm } from '@/components/outreach/TouchForm'
import { WarmthBadge } from '@/components/outreach/WarmthBadge'
import { useCompanies, useCompanyMap } from '@/hooks/outreach'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayLong, relativeDay, todayISO } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { CHANNEL_META, isTerminal, WARMTH_META } from '@/utils/outreach'

type SortKey = 'touch' | 'name' | 'warmth'
type WarmthFilter = ContactWarmth | 'all'
/** 'all', 'none' (no company), or a company id. */
type CompanyFilter = string

interface ContactRow {
  contact: Contact
  company?: Company
  openOpportunities: number
  lastTouch?: Touch
}

const WARMTHS: ContactWarmth[] = ['cold', 'warm', 'referral', 'alumni']
const SORTS: SortKey[] = ['touch', 'name', 'warmth']
const SORT_LABEL: Record<SortKey, string> = {
  touch: 'Last touch',
  name: 'Name',
  warmth: 'Warmth',
}
/** Warmest first. */
const WARMTH_RANK: Record<ContactWarmth, number> = { referral: 0, alumni: 1, warm: 2, cold: 3 }

function isWarmth(value: string | null): value is ContactWarmth {
  return value !== null && (WARMTHS as string[]).includes(value)
}
function isSort(value: string | null): value is SortKey {
  return value !== null && (SORTS as string[]).includes(value)
}

function compareTouches(a: Touch, b: Touch): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time ?? '').localeCompare(b.time ?? '') ||
    a.createdAt.localeCompare(b.createdAt)
  )
}

function compareRows(a: ContactRow, b: ContactRow, sort: SortKey): number {
  const byName = a.contact.name.localeCompare(b.contact.name)
  switch (sort) {
    case 'name':
      return byName
    case 'warmth':
      return WARMTH_RANK[a.contact.warmth] - WARMTH_RANK[b.contact.warmth] || byName
    case 'touch': {
      if (a.lastTouch && b.lastTouch) return compareTouches(b.lastTouch, a.lastTouch) || byName
      if (a.lastTouch) return -1
      if (b.lastTouch) return 1
      return byName
    }
    default:
      return byName
  }
}

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

export default function ContactsPage() {
  useDocumentMeta({
    title: 'Contacts · Outreach',
    description: 'People at target companies, their warmth and the last touch.',
    noindex: true,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const companies = useCompanies(true)
  const companyMap = useCompanyMap()
  const [params, setParams] = useSearchParams()
  const isPhone = useMediaQuery('(max-width: 639px)')

  /* -- URL state ---------------------------------------------------------- */
  const warmth: WarmthFilter = isWarmth(params.get('warmth'))
    ? (params.get('warmth') as ContactWarmth)
    : 'all'
  const rawCompany = params.get('company')
  const companyFilter: CompanyFilter =
    rawCompany === 'none' || (rawCompany !== null && companyMap.has(rawCompany)) ? rawCompany : 'all'
  const sort: SortKey = isSort(params.get('sort')) ? (params.get('sort') as SortKey) : 'touch'
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

  // Local state for instant typing; only a change in the debounced value is
  // written to the URL, so back/forward navigation is not fought over.
  const [query, setQuery] = useState(params.get('q') ?? '')
  const debouncedQuery = useDebouncedValue(query, 200)
  const lastSyncedQuery = useRef(debouncedQuery)
  useEffect(() => {
    if (lastSyncedQuery.current === debouncedQuery) return
    lastSyncedQuery.current = debouncedQuery
    updateParams({ q: debouncedQuery })
  }, [debouncedQuery, updateParams])

  /* -- Derived rows -------------------------------------------------------- */
  const rows = useMemo<ContactRow[]>(() => {
    const openByContact = new Map<string, number>()
    for (const opportunity of db.opportunities) {
      if (!opportunity.contactId || isTerminal(opportunity.stage)) continue
      openByContact.set(opportunity.contactId, (openByContact.get(opportunity.contactId) ?? 0) + 1)
    }
    const latest = new Map<string, Touch>()
    for (const touch of db.touches) {
      if (!touch.contactId) continue
      const current = latest.get(touch.contactId)
      if (!current || compareTouches(touch, current) > 0) latest.set(touch.contactId, touch)
    }
    return db.contacts.map((contact) => ({
      contact,
      company: contact.companyId ? companyMap.get(contact.companyId) : undefined,
      openOpportunities: openByContact.get(contact.id) ?? 0,
      lastTouch: latest.get(contact.id),
    }))
  }, [db.contacts, db.opportunities, db.touches, companyMap])

  const warmthCounts = useMemo(() => {
    const counts = new Map<ContactWarmth, number>(WARMTHS.map((w) => [w, 0]))
    for (const row of rows) counts.set(row.contact.warmth, (counts.get(row.contact.warmth) ?? 0) + 1)
    return counts
  }, [rows])

  const filtered = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (warmth !== 'all' && row.contact.warmth !== warmth) return false
        if (companyFilter === 'none' && row.contact.companyId) return false
        if (companyFilter !== 'all' && companyFilter !== 'none' && row.contact.companyId !== companyFilter) {
          return false
        }
        if (needle) {
          const haystack = [
            row.contact.name,
            row.contact.role ?? '',
            row.contact.email ?? '',
            row.company?.name ?? '',
          ]
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => compareRows(a, b, sort))
  }, [rows, debouncedQuery, warmth, companyFilter, sort])

  const hasFilters = warmth !== 'all' || companyFilter !== 'all' || debouncedQuery.trim() !== ''

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
  const [composeFor, setComposeFor] = useState<Contact | null>(null)
  const [touchFor, setTouchFor] = useState<Contact | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null)

  const openDetail = (id: string) => updateParams({ id })
  const closeDetail = () => updateParams({ id: null })

  const openCreate = () => {
    setEditingId(undefined)
    setFormOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setFormOpen(true)
  }

  const deleteFootprint = useMemo(() => {
    if (!pendingDelete) return null
    return {
      touches: db.touches.filter((t) => t.contactId === pendingDelete.id).length,
      opportunities: db.opportunities.filter((o) => o.contactId === pendingDelete.id).length,
    }
  }, [pendingDelete, db.touches, db.opportunities])

  const confirmDelete = () => {
    if (!pendingDelete) return
    const name = pendingDelete.name
    actions.deleteContact(pendingDelete.id)
    setPendingDelete(null)
    if (selectedId === pendingDelete.id) closeDetail()
    toast({
      title: 'Contact deleted',
      description: `${name} removed. Their touches and opportunities were kept and unlinked.`,
    })
  }

  const exportCsv = () => {
    downloadCsv(`outreach-contacts-${todayISO()}.csv`, actions.exportOutreachCsv('contacts'))
    toast({
      title: 'CSV exported',
      description: pluralize(db.contacts.length, 'contact'),
      tone: 'positive',
    })
  }

  const clearFilters = () => {
    setQuery('')
    updateParams({ q: null, warmth: null, company: null })
  }

  const menuFor = (contact: Contact): DropdownMenuItem[] => [
    { id: 'open', label: 'Open', icon: 'ArrowUpRight', onSelect: () => openDetail(contact.id) },
    { id: 'edit', label: 'Edit', icon: 'Pencil', onSelect: () => openEdit(contact) },
    { id: 'compose', label: 'Compose', icon: 'Send', onSelect: () => setComposeFor(contact) },
    { id: 'touch', label: 'Log touch', icon: 'MessageSquare', onSelect: () => setTouchFor(contact) },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'Trash',
      tone: 'danger',
      onSelect: () => setPendingDelete(contact),
    },
  ]

  const quickActions = (row: ContactRow) => (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        icon="Send"
        aria-label={`Compose a message to ${row.contact.name}`}
        onClick={() => setComposeFor(row.contact)}
      />
      <Button
        variant="ghost"
        size="icon"
        icon="MessageSquare"
        aria-label={`Log a touch with ${row.contact.name}`}
        onClick={() => setTouchFor(row.contact)}
      />
      {row.contact.linkedinUrl ? (
        <a
          href={row.contact.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${row.contact.name} on LinkedIn (opens in a new tab)`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink pointer-coarse:size-11"
        >
          <Icon name="ExternalLink" size={16} />
        </a>
      ) : null}
      <DropdownMenu items={menuFor(row.contact)} label={`Actions for ${row.contact.name}`} />
    </div>
  )

  /* -- Render -------------------------------------------------------------- */
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Contacts"
        description="The people behind the pipeline. Composing opens Gmail or your mail client pre-filled — nothing is sent from here, and every message you do send gets logged as a touch."
        actions={
          <>
            <Button
              variant="secondary"
              icon="Download"
              onClick={exportCsv}
              disabled={db.contacts.length === 0}
            >
              Export CSV
            </Button>
            <Button variant="secondary" icon="Upload" onClick={() => updateParams({ import: '1' })}>
              Import CSV
            </Button>
            <Button variant="primary" icon="Plus" onClick={openCreate}>
              Add contact
            </Button>
          </>
        }
      />

      <OutreachTabs counts={tabCounts} />

      {db.contacts.length === 0 ? (
        <EmptyState
          icon="Users"
          title="No contacts yet"
          description="One real person at each target company beats a hundred portal applications. Start with an engineer or hiring manager you can name a reason for writing to."
          action={
            <>
              <Button variant="primary" icon="Plus" onClick={openCreate}>
                Add your first contact
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
                <label htmlFor="contacts-search" className="sr-only">
                  Search contacts
                </label>
                <Icon
                  name="Search"
                  size={15}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                />
                <Input
                  id="contacts-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, role, company, email"
                  autoComplete="off"
                  className="pl-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
                <div>
                  <label htmlFor="contacts-company" className="sr-only">
                    Filter by company
                  </label>
                  <Select
                    id="contacts-company"
                    value={companyFilter}
                    onChange={(event) => updateParams({ company: event.target.value === 'all' ? null : event.target.value })}
                    wrapperClassName="sm:w-48"
                  >
                    <option value="all">Any company</option>
                    <option value="none">No company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                        {company.archived ? ' (archived)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label htmlFor="contacts-sort" className="sr-only">
                    Sort by
                  </label>
                  <Select
                    id="contacts-sort"
                    value={sort}
                    onChange={(event) => updateParams({ sort: event.target.value === 'touch' ? null : event.target.value })}
                    wrapperClassName="sm:w-40"
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

            <div
              role="group"
              aria-label="Filter by warmth"
              className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0"
            >
              <Chip selected={warmth === 'all'} onClick={() => updateParams({ warmth: null })}>
                All
                <span className="font-mono text-[11px] text-ink-faint tabular-nums">{rows.length}</span>
              </Chip>
              {WARMTHS.map((value) => (
                <Chip key={value} selected={warmth === value} onClick={() => updateParams({ warmth: value })}>
                  {WARMTH_META[value].label}
                  <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                    {warmthCounts.get(value) ?? 0}
                  </span>
                </Chip>
              ))}
            </div>

            <p role="status" aria-live="polite" className="font-mono text-xs text-ink-faint tabular-nums">
              {pluralize(filtered.length, 'contact')}
              {hasFilters && filtered.length !== rows.length ? ` of ${rows.length}` : ''}
            </p>
          </section>

          {filtered.length === 0 ? (
            <EmptyState
              icon="Search"
              title="Nothing matches"
              description="Try a shorter search, another warmth, or any company."
              action={
                <Button variant="secondary" icon="X" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : isPhone ? (
            <ul className="grid grid-cols-1 gap-3" aria-label="Contacts">
              {filtered.map((row) => (
                <li key={row.contact.id}>
                  <Card interactive className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openDetail(row.contact.id)}
                          className="rounded-sm text-left text-[15px] font-semibold text-ink hover:text-accent"
                        >
                          {row.contact.name}
                        </button>
                        <p className="mt-0.5 truncate text-xs text-ink-faint">
                          {[row.contact.role, row.company?.name].filter(Boolean).join(' · ') || 'No role or company'}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                          <WarmthBadge warmth={row.contact.warmth} size="sm" />
                          <span className="font-mono tabular-nums">
                            {row.openOpportunities} open
                          </span>
                          <LastTouch touch={row.lastTouch} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end border-t border-line pt-2">
                      {quickActions(row)}
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
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Company
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Warmth
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-medium">
                        Last touch
                      </th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">
                        Open opps
                      </th>
                      <th scope="col" className="px-2 py-2.5 text-right">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filtered.map((row) => (
                      <tr
                        key={row.contact.id}
                        onClick={(event) => {
                          if (!isInteractive(event)) openDetail(row.contact.id)
                        }}
                        className="cursor-pointer transition-colors duration-150 hover:bg-surface-hover/60"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openDetail(row.contact.id)}
                            className="rounded-sm text-left font-medium text-ink hover:text-accent"
                          >
                            {row.contact.name}
                            <span className="sr-only"> — open details</span>
                          </button>
                          {row.contact.role ? (
                            <p className="mt-0.5 text-xs text-ink-faint">{row.contact.role}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {row.company ? (
                            <span className={cn('text-sm', row.company.archived ? 'text-ink-faint' : 'text-ink-muted')}>
                              {row.company.name}
                              {row.company.archived ? ' (archived)' : ''}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-faint">–</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <WarmthBadge warmth={row.contact.warmth} size="sm" />
                        </td>
                        <td className="px-3 py-3">
                          <LastTouch touch={row.lastTouch} />
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm tabular-nums">
                          {row.openOpportunities > 0 ? (
                            <span className="text-ink">{row.openOpportunities}</span>
                          ) : (
                            <span className="text-ink-faint">–</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex justify-end">{quickActions(row)}</div>
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

      <ContactDetail contactId={selectedId} onClose={closeDetail} />
      <ContactForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        contactId={editingId}
        onSaved={(id) => {
          if (!editingId) openDetail(id)
        }}
      />
      <ComposeDialog
        open={composeFor !== null}
        onClose={() => setComposeFor(null)}
        contactId={composeFor?.id}
        companyId={composeFor?.companyId}
      />
      <TouchForm
        open={touchFor !== null}
        onClose={() => setTouchFor(null)}
        defaults={
          touchFor
            ? { contactId: touchFor.id, companyId: touchFor.companyId, direction: 'outbound' }
            : undefined
        }
      />
      <CsvImportDialog open={importOpen} onClose={() => updateParams({ import: null })} kind="contacts" />
      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete this contact?"
        message={
          pendingDelete && deleteFootprint
            ? `${pendingDelete.name} will be removed from this device. ${pluralize(deleteFootprint.touches, 'touch', 'touches')} and ${pluralize(deleteFootprint.opportunities, 'opportunity', 'opportunities')} that mention them are kept and unlinked, not deleted.`
            : ''
        }
        confirmLabel="Delete contact"
        tone="danger"
      />
    </div>
  )
}
