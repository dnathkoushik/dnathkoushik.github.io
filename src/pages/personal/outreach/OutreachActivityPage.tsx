import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Touch, TouchChannel, TouchDirection } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { OutreachTabs } from '@/components/outreach/OutreachTabs'
import { TouchForm } from '@/components/outreach/TouchForm'
import { TouchList } from '@/components/outreach/TouchList'
import { DIRECTION_META } from '@/components/outreach/TouchRow'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import {
  useCompanies,
  useCompanyMap,
  useContactMap,
  useOpportunities,
  useOpportunityMap,
  useTouches,
} from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { shiftDay, todayISO } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { CHANNEL_META, responseRate } from '@/utils/outreach'

type DirectionFilter = 'all' | TouchDirection
type ChannelFilter = 'all' | TouchChannel
type RangeFilter = '7d' | '30d' | 'all'

/** Rows rendered before "Show more" is needed. */
const PAGE_SIZE = 60

const CHANNELS = Object.keys(CHANNEL_META) as TouchChannel[]

const DIRECTION_OPTIONS: { value: DirectionFilter; label: string; icon?: string }[] = [
  { value: 'all', label: 'Both ways' },
  { value: 'outbound', label: DIRECTION_META.outbound.label, icon: DIRECTION_META.outbound.icon },
  { value: 'inbound', label: DIRECTION_META.inbound.label, icon: DIRECTION_META.inbound.icon },
]

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
]

const CSV_COLUMNS = [
  'date',
  'time',
  'direction',
  'channel',
  'company',
  'contact',
  'role',
  'summary',
  'outcome',
] as const

function readDirection(raw: string | null): DirectionFilter {
  return raw === 'outbound' || raw === 'inbound' ? raw : 'all'
}

function readChannel(raw: string | null): ChannelFilter {
  return raw && (CHANNELS as string[]).includes(raw) ? (raw as TouchChannel) : 'all'
}

function readRange(raw: string | null): RangeFilter {
  return raw === '7d' || raw === '30d' ? raw : 'all'
}

/** RFC 4180: wrap in quotes when the value carries a comma, quote or line break. */
function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return /[",\r\n]/.test(value) ? `"${escaped}"` : escaped
}

interface FormState {
  open: boolean
  touchId?: string
}

/**
 * Every touch, newest first, with the filters kept in the URL so a view can be
 * bookmarked or handed to the command palette. Reply rates and follow-up
 * timing are computed from this list — it is the module's ground truth.
 */
export default function OutreachActivityPage() {
  useDocumentMeta({ title: 'Outreach activity', noindex: true })

  const { db } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const touches = useTouches()
  const companies = useCompanies(true)
  const companyMap = useCompanyMap()
  const contactMap = useContactMap()
  const opportunityMap = useOpportunityMap()
  const openOpportunities = useOpportunities({ open: true })

  const today = todayISO()

  const query = params.get('q') ?? ''
  const direction = readDirection(params.get('dir'))
  const channel = readChannel(params.get('ch'))
  const range = readRange(params.get('range'))
  const companyParam = params.get('company')
  const companyId = companyParam && companyMap.has(companyParam) ? companyParam : 'all'

  const setFilter = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params)
    if (value === defaultValue || value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const clearFilters = () => {
    const next = new URLSearchParams(params)
    for (const key of ['q', 'dir', 'ch', 'range', 'company']) next.delete(key)
    setParams(next, { replace: true })
  }

  const anyFilter =
    query.trim() !== '' || direction !== 'all' || channel !== 'all' || range !== 'all' || companyId !== 'all'

  /** The company a touch belongs to, following its opportunity or contact when the touch itself is unlinked. */
  const companyOf = (touch: Touch): string | undefined =>
    touch.companyId ??
    (touch.opportunityId ? opportunityMap.get(touch.opportunityId)?.companyId : undefined) ??
    (touch.contactId ? contactMap.get(touch.contactId)?.companyId : undefined)

  const filtered = useMemo(() => {
    const from = range === '7d' ? shiftDay(today, -6) : range === '30d' ? shiftDay(today, -29) : undefined
    const needle = query.trim().toLowerCase()
    return touches.filter((touch) => {
      if (direction !== 'all' && touch.direction !== direction) return false
      if (channel !== 'all' && touch.channel !== channel) return false
      if (from && touch.date < from) return false
      const touchCompanyId =
        touch.companyId ??
        (touch.opportunityId ? opportunityMap.get(touch.opportunityId)?.companyId : undefined) ??
        (touch.contactId ? contactMap.get(touch.contactId)?.companyId : undefined)
      if (companyId !== 'all' && touchCompanyId !== companyId) return false
      if (needle) {
        const haystack = [
          touch.summary,
          touch.contactId ? contactMap.get(touch.contactId)?.name : undefined,
          touchCompanyId ? companyMap.get(touchCompanyId)?.name : undefined,
          touch.opportunityId ? opportunityMap.get(touch.opportunityId)?.title : undefined,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return true
    })
  }, [touches, direction, channel, range, companyId, query, today, companyMap, contactMap, opportunityMap])

  const summary = useMemo(() => {
    const rate = responseRate(filtered, db.touches)
    const inbound = filtered.filter((touch) => touch.direction === 'inbound').length
    return { ...rate, inbound }
  }, [filtered, db.touches])

  // The visible cap resets whenever the filter set changes.
  const [visible, setVisible] = useState(PAGE_SIZE)
  const filterKey = [direction, channel, range, companyId, query].join('|')
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setVisible(PAGE_SIZE)
  }

  // `?id=` deep link opens that touch's editor; the param is cleared on close.
  const idParam = params.get('id')
  const [form, setForm] = useState<FormState>(() =>
    idParam && db.touches.some((touch) => touch.id === idParam)
      ? { open: true, touchId: idParam }
      : { open: false },
  )
  const [lastIdParam, setLastIdParam] = useState(idParam)
  if (idParam !== lastIdParam) {
    setLastIdParam(idParam)
    if (idParam && db.touches.some((touch) => touch.id === idParam)) {
      setForm({ open: true, touchId: idParam })
    }
  }

  const closeForm = () => {
    setForm((prev) => ({ ...prev, open: false }))
    if (params.has('id')) {
      const next = new URLSearchParams(params)
      next.delete('id')
      setParams(next, { replace: true })
    }
  }

  const exportCsv = () => {
    const lines = [
      CSV_COLUMNS.join(','),
      ...filtered.map((touch) => {
        const touchCompanyId = companyOf(touch)
        const cells: Record<(typeof CSV_COLUMNS)[number], string> = {
          date: touch.date,
          time: touch.time ?? '',
          direction: touch.direction,
          channel: touch.channel,
          company: touchCompanyId ? (companyMap.get(touchCompanyId)?.name ?? '') : '',
          contact: touch.contactId ? (contactMap.get(touch.contactId)?.name ?? '') : '',
          role: touch.opportunityId ? (opportunityMap.get(touch.opportunityId)?.title ?? '') : '',
          summary: touch.summary,
          outcome: touch.outcome ?? '',
        }
        return CSV_COLUMNS.map((column) => csvCell(cells[column])).join(',')
      }),
    ]
    // A byte-order mark so spreadsheets read the UTF-8 correctly; CRLF per RFC 4180.
    const bom = String.fromCharCode(0xfeff)
    const blob = new Blob([`${bom}${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const filename = `outreach-activity-${today}.csv`
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoking immediately can race the download in Safari; a tick is enough.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast({
      title: 'CSV downloaded',
      description: `${pluralize(filtered.length, 'touch', 'touches')} · ${filename}`,
      tone: 'positive',
    })
  }

  const counts = {
    [PERSONAL_ROUTES.outreachPipeline]: openOpportunities.length,
    [PERSONAL_ROUTES.outreachCompanies]: db.companies.filter((company) => !company.archived).length,
    [PERSONAL_ROUTES.outreachContacts]: db.contacts.length,
    [PERSONAL_ROUTES.outreachTemplates]: db.templates.filter((template) => !template.archived).length,
    [PERSONAL_ROUTES.outreachActivity]: db.touches.length,
  }

  const logButton = (
    <Button variant="primary" icon="Plus" onClick={() => setForm({ open: true, touchId: undefined })}>
      Log touch
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Outreach"
        title="Activity"
        description="Every interaction, newest first. Reply rates and follow-up timing are computed from this list, so log the small ones too — nothing here is sent anywhere."
        actions={
          <>
            <Button
              variant="secondary"
              icon="Download"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
            {logButton}
          </>
        }
      />

      <OutreachTabs counts={counts} />

      {touches.length === 0 ? (
        <EmptyState
          icon="Inbox"
          title="Nothing logged yet"
          description="Compose from a template or log a touch by hand. Every response rate in this module starts here."
          action={logButton}
        />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Search" hint="Matches the summary and the linked names.">
                  <div className="relative">
                    <Icon
                      name="Search"
                      size={15}
                      className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
                    />
                    <Input
                      type="search"
                      value={query}
                      onChange={(event) => setFilter('q', event.target.value, '')}
                      placeholder="schema migration, Priya, Acme…"
                      autoComplete="off"
                      className="pl-9"
                    />
                  </div>
                </Field>
                <Field label="Channel">
                  <Select
                    value={channel}
                    onChange={(event) => setFilter('ch', event.target.value, 'all')}
                  >
                    <option value="all">Every channel</option>
                    {CHANNELS.map((item) => (
                      <option key={item} value={item}>
                        {CHANNEL_META[item].label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Company">
                  <Select
                    value={companyId}
                    onChange={(event) => setFilter('company', event.target.value, 'all')}
                  >
                    <option value="all">Every company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                        {company.archived ? ' (archived)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <SegmentedControl<DirectionFilter>
                  value={direction}
                  onChange={(value) => setFilter('dir', value, 'all')}
                  options={DIRECTION_OPTIONS}
                  size="sm"
                  ariaLabel="Direction"
                />
                <SegmentedControl<RangeFilter>
                  value={range}
                  onChange={(value) => setFilter('range', value, 'all')}
                  options={RANGE_OPTIONS}
                  size="sm"
                  ariaLabel="Date range"
                />
                {anyFilter ? (
                  <Button variant="ghost" size="sm" icon="X" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : null}
              </div>

              <p aria-live="polite" className="text-sm text-ink-muted">
                <span className="font-mono font-medium text-ink tabular-nums">{filtered.length}</span>{' '}
                {filtered.length === 1 ? 'touch' : 'touches'}
                {filtered.length > 0 ? (
                  <>
                    {' · '}
                    <span className="font-mono tabular-nums">{summary.sent}</span> sent
                    {' · '}
                    <span className="font-mono tabular-nums">{summary.inbound}</span> received
                    {summary.sent > 0 ? (
                      <>
                        {' · '}
                        <span className="font-mono tabular-nums">{summary.rate}%</span> reply rate
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
            </CardContent>
          </Card>

          <section aria-labelledby="activity-list-heading" className="space-y-4">
            <h2 id="activity-list-heading" className="sr-only">
              Touches
            </h2>

            {filtered.length === 0 ? (
              <EmptyState
                icon="Funnel"
                title="No touches match these filters"
                description="Widen the date range or clear a filter. The touches are still there."
                action={
                  <Button variant="secondary" icon="X" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <TouchList
                  touches={filtered}
                  limit={visible}
                  showLinks
                  onEdit={(id) => setForm({ open: true, touchId: id })}
                />
                {filtered.length > visible ? (
                  <div className="flex flex-col items-center gap-2 pt-1">
                    <p className="font-mono text-xs text-ink-faint tabular-nums">
                      Showing {Math.min(visible, filtered.length)} of {filtered.length}
                    </p>
                    <Button
                      variant="secondary"
                      icon="ChevronDown"
                      onClick={() => setVisible((current) => current + PAGE_SIZE)}
                    >
                      Show {Math.min(PAGE_SIZE, filtered.length - visible)} more
                    </Button>
                  </div>
                ) : filtered.length > PAGE_SIZE ? (
                  <p className="text-center font-mono text-xs text-ink-faint tabular-nums">
                    All {filtered.length} shown
                  </p>
                ) : null}
              </>
            )}
          </section>
        </>
      )}

      <TouchForm open={form.open} onClose={closeForm} touchId={form.touchId} />
    </div>
  )
}
