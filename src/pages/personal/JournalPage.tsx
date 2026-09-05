import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PERSONAL_ROUTES } from '@/config/routes'
import type { Category, ISODate, LogEntry, Note } from '@/types'
import {
  durationLabel,
  formatDayLong,
  monthKeyOf,
  monthRange,
  nowClockTime,
  relativeDay,
  todayISO,
  weekKeyOf,
  weekRange,
} from '@/utils/date'
import { CAT_CLASSES, pluralize } from '@/utils/format'
import { usePersonalData } from '@/providers/personalDataContext'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { NoteCard } from '@/components/journal/NoteCard'
import { NoteForm } from '@/components/journal/NoteForm'
import type { NoteFormValues } from '@/components/journal/NoteForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Tabs } from '@/components/ui/Tabs'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const PAGE_SIZE = 50

type TabKey = 'log' | 'notes'
type RangeKey = 'week' | 'month' | 'all'

const RANGE_OPTIONS: { value: RangeKey; label: string; icon?: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

interface LogDraft {
  id?: string
  date: ISODate
  time: string
  activity: string
  categoryId: string
  durationMinutes: string
  notes: string
}

function emptyDraft(date: ISODate, categoryId: string): LogDraft {
  return {
    date,
    time: nowClockTime(),
    activity: '',
    categoryId,
    durationMinutes: '30',
    notes: '',
  }
}

function draftFrom(entry: LogEntry): LogDraft {
  return {
    id: entry.id,
    date: entry.date,
    time: entry.time,
    activity: entry.activity,
    categoryId: entry.categoryId,
    durationMinutes: String(entry.durationMinutes),
    notes: entry.notes ?? '',
  }
}

function matches(haystack: (string | undefined)[], needle: string): boolean {
  if (!needle) return true
  const query = needle.toLowerCase()
  return haystack.some((value) => value?.toLowerCase().includes(query))
}

/**
 * The written record: what you did, and what you thought about it.
 *
 * Work-log entries and notes share a page because they answer the same
 * question a week later — "what actually happened?" — and searching one
 * without the other is how you lose an hour looking for something you wrote.
 */
export default function JournalPage() {
  useDocumentMeta({
    title: 'Journal',
    description: 'Work log entries and notes from your private dashboard.',
    noindex: true,
    canonicalPath: PERSONAL_ROUTES.journal,
  })

  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()

  const rawDate = params.get('date')
  const pinnedDate = rawDate && ISO_DATE.test(rawDate) ? rawDate : null

  const [tab, setTab] = useState<TabKey>('log')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState('all')
  const [rangeKey, setRangeKey] = useState<RangeKey>('month')
  const [limit, setLimit] = useState(PAGE_SIZE)

  const [logDraft, setLogDraft] = useState<LogDraft | null>(null)
  const [logError, setLogError] = useState<string | undefined>(undefined)
  const [logToDelete, setLogToDelete] = useState<LogEntry | null>(null)

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteBeingEdited, setNoteBeingEdited] = useState<Note | undefined>(undefined)
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)

  const debouncedQuery = useDebouncedValue(query, 200)
  const today = todayISO()

  const categories = useMemo(
    () => new Map<string, Category>(db.categories.map((category) => [category.id, category])),
    [db.categories],
  )

  const bounds = useMemo(() => {
    if (pinnedDate) return { from: pinnedDate, to: pinnedDate }
    if (rangeKey === 'week') {
      const { start, end } = weekRange(weekKeyOf(today, db.settings.weekStartsOn), db.settings.weekStartsOn)
      return { from: start, to: end }
    }
    if (rangeKey === 'month') {
      const { start, end } = monthRange(monthKeyOf(today))
      return { from: start, to: end }
    }
    return null
  }, [pinnedDate, rangeKey, today, db.settings.weekStartsOn])

  const logs = useMemo(() => {
    const withinRange = (date: ISODate) =>
      !bounds || (date >= bounds.from && date <= bounds.to)

    return db.logs
      .filter(
        (entry) =>
          withinRange(entry.date) &&
          (categoryId === 'all' || entry.categoryId === categoryId) &&
          matches(
            [entry.activity, entry.notes, categories.get(entry.categoryId)?.label],
            debouncedQuery,
          ),
      )
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  }, [db.logs, bounds, categoryId, debouncedQuery, categories])

  const notes = useMemo(() => {
    const withinRange = (date: ISODate) =>
      !bounds || (date >= bounds.from && date <= bounds.to)

    return db.notes
      .filter(
        (note) =>
          withinRange(note.date) && matches([note.title, note.body, ...note.tags], debouncedQuery),
      )
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.date.localeCompare(a.date) ||
          b.updatedAt.localeCompare(a.updatedAt),
      )
  }, [db.notes, bounds, debouncedQuery])

  // Changing what is being filtered starts the list over at the first page.
  const filterKey = `${tab}|${debouncedQuery}|${categoryId}|${rangeKey}|${pinnedDate ?? ''}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setLimit(PAGE_SIZE)
  }

  const visibleLogs = logs.slice(0, limit)
  const visibleNotes = notes.slice(0, limit)

  const logDays = useMemo(() => {
    const groups = new Map<ISODate, LogEntry[]>()
    for (const entry of visibleLogs) {
      const bucket = groups.get(entry.date)
      if (bucket) bucket.push(entry)
      else groups.set(entry.date, [entry])
    }
    return [...groups.entries()].map(([date, entries]) => ({
      date,
      entries,
      minutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    }))
  }, [visibleLogs])

  const totalMinutes = logs.reduce((sum, entry) => sum + entry.durationMinutes, 0)

  function submitLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!logDraft) return

    const activity = logDraft.activity.trim()
    if (!activity) {
      setLogError('Say what you worked on.')
      return
    }
    const minutes = Number(logDraft.durationMinutes)
    if (!Number.isFinite(minutes) || minutes < 0) {
      setLogError('Duration must be a number of minutes.')
      return
    }

    const payload = {
      date: logDraft.date,
      time: logDraft.time || nowClockTime(),
      activity,
      categoryId: logDraft.categoryId,
      durationMinutes: Math.round(minutes),
      notes: logDraft.notes.trim() || undefined,
    }

    if (logDraft.id) {
      actions.updateLog(logDraft.id, payload)
      toast({ title: 'Entry updated', description: `${activity} · ${durationLabel(payload.durationMinutes)}` })
    } else {
      actions.addLog(payload)
      toast({
        title: 'Entry logged',
        description: `${activity} · ${durationLabel(payload.durationMinutes)}`,
        tone: 'positive',
      })
    }

    setLogDraft(null)
    setLogError(undefined)
  }

  function submitNote(values: NoteFormValues) {
    if (noteBeingEdited) {
      actions.updateNote(noteBeingEdited.id, values)
      toast({ title: 'Note updated', description: values.title })
    } else {
      actions.addNote(values)
      toast({ title: 'Note added', description: values.title, tone: 'positive' })
    }
    setNoteOpen(false)
    setNoteBeingEdited(undefined)
  }

  const filtersActive =
    Boolean(debouncedQuery) || categoryId !== 'all' || rangeKey !== 'month' || Boolean(pinnedDate)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Journal"
        title="Work log and notes"
        description={`${pluralize(logs.length, 'entry', 'entries')} · ${durationLabel(totalMinutes)} · ${pluralize(notes.length, 'note')} in view.`}
        actions={
          tab === 'log' ? (
            <Button
              variant="primary"
              icon="Plus"
              onClick={() => {
                setLogError(undefined)
                setLogDraft(
                  emptyDraft(pinnedDate ?? today, db.categories[0]?.id ?? ''),
                )
              }}
            >
              Log an entry
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="Plus"
              onClick={() => {
                setNoteBeingEdited(undefined)
                setNoteOpen(true)
              }}
            >
              New note
            </Button>
          )
        }
      />

      <Tabs
        items={[
          { id: 'log', label: 'Work log', icon: 'Clock', badge: logs.length },
          { id: 'notes', label: 'Notes', icon: 'StickyNote', badge: notes.length },
        ]}
        value={tab}
        onChange={(id) => setTab(id as TabKey)}
        ariaLabel="Journal view"
      />

      <section aria-label="Filters" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="journal-search">
              Search the journal
            </label>
            <Icon
              name="Search"
              size={15}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
            />
            <Input
              id="journal-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === 'log' ? 'Search activities and notes' : 'Search notes and tags'}
              className="pl-9"
              autoComplete="off"
            />
          </div>

          {tab === 'log' ? (
            <div className="sm:w-52">
              <label className="sr-only" htmlFor="journal-category">
                Filter by category
              </label>
              <Select
                id="journal-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="all">All categories</option>
                {db.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                    {category.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<RangeKey>
            value={rangeKey}
            onChange={setRangeKey}
            options={RANGE_OPTIONS}
            size="sm"
            ariaLabel="Date range"
            className={pinnedDate ? 'opacity-50' : undefined}
          />

          {pinnedDate ? (
            <span className="flex items-center gap-1.5">
              <Badge tone="accent" icon="CalendarDays">
                {formatDayLong(pinnedDate)}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                icon="X"
                onClick={() => {
                  setParams({}, { replace: true })
                }}
              >
                Clear day
              </Button>
            </span>
          ) : null}

          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              icon="RotateCcw"
              onClick={() => {
                setQuery('')
                setCategoryId('all')
                setRangeKey('month')
                setParams({}, { replace: true })
              }}
            >
              Reset filters
            </Button>
          ) : null}
        </div>
      </section>

      {tab === 'log' ? (
        <section
          id="log-panel"
          role="tabpanel"
          aria-labelledby="log-tab"
          tabIndex={0}
          className="space-y-4"
        >
          <h2 id="journal-log-heading" className="sr-only">
            Work log entries
          </h2>

          {logDays.length === 0 ? (
            <EmptyState
              icon="Clock"
              title={filtersActive ? 'No entries match these filters' : 'No work logged yet'}
              description={
                filtersActive
                  ? 'Widen the date range or clear the search to see more.'
                  : 'Log what you actually did, with how long it took. It is the only honest input the analytics have.'
              }
              action={
                <Button
                  variant="primary"
                  icon="Plus"
                  onClick={() =>
                    setLogDraft(emptyDraft(pinnedDate ?? today, db.categories[0]?.id ?? ''))
                  }
                >
                  Log an entry
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {logDays.map((group) => (
                <li key={group.date}>
                  <Card className="animate-fade-in">
                    <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-ink">
                        <time dateTime={group.date}>{formatDayLong(group.date)}</time>
                      </h3>
                      <p className="shrink-0 font-mono text-xs text-ink-faint tabular-nums">
                        {pluralize(group.entries.length, 'entry', 'entries')} ·{' '}
                        {durationLabel(group.minutes)}
                      </p>
                    </div>

                    <ul className="divide-y divide-line">
                      {group.entries.map((entry) => {
                        const category = categories.get(entry.categoryId)
                        return (
                          <li
                            key={entry.id}
                            className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60"
                          >
                            <time
                              dateTime={`${entry.date}T${entry.time}`}
                              className="w-11 shrink-0 pt-0.5 font-mono text-xs text-ink-faint tabular-nums"
                            >
                              {entry.time}
                            </time>

                            <div className="min-w-0 flex-1">
                              <p className="text-sm leading-snug break-words text-ink">
                                {entry.activity}
                              </p>
                              {entry.notes ? (
                                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                                  {entry.notes}
                                </p>
                              ) : null}
                              {category ? (
                                <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'size-1.5 rounded-full',
                                      CAT_CLASSES[category.color].bg,
                                    )}
                                  />
                                  {category.label}
                                </p>
                              ) : null}
                            </div>

                            <span className="shrink-0 pt-0.5 font-mono text-xs font-medium text-ink tabular-nums">
                              {durationLabel(entry.durationMinutes)}
                            </span>

                            <DropdownMenu
                              label={`Actions for ${entry.activity}`}
                              align="end"
                              items={[
                                {
                                  id: 'edit',
                                  label: 'Edit entry',
                                  icon: 'Pencil',
                                  onSelect: () => {
                                    setLogError(undefined)
                                    setLogDraft(draftFrom(entry))
                                  },
                                },
                                {
                                  id: 'delete',
                                  label: 'Delete entry',
                                  icon: 'Trash',
                                  tone: 'danger',
                                  onSelect: () => setLogToDelete(entry),
                                },
                              ]}
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {logs.length > visibleLogs.length ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                icon="ChevronDown"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
              >
                Show more ({logs.length - visibleLogs.length} left)
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        <section
          id="notes-panel"
          role="tabpanel"
          aria-labelledby="notes-tab"
          tabIndex={0}
          className="space-y-4"
        >
          <h2 id="journal-notes-heading" className="sr-only">
            Notes
          </h2>

          {visibleNotes.length === 0 ? (
            <EmptyState
              icon="StickyNote"
              title={filtersActive ? 'No notes match these filters' : 'No notes yet'}
              description={
                filtersActive
                  ? 'Widen the date range or clear the search to see more.'
                  : 'Decisions, bugs that cost you an afternoon, things worth remembering next month.'
              }
              action={
                <Button
                  variant="primary"
                  icon="Plus"
                  onClick={() => {
                    setNoteBeingEdited(undefined)
                    setNoteOpen(true)
                  }}
                >
                  New note
                </Button>
              }
            />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {visibleNotes.map((note) => (
                <li key={note.id} className="min-w-0">
                  <NoteCard
                    note={note}
                    onTogglePin={(target) => {
                      actions.updateNote(target.id, { pinned: !target.pinned })
                      toast({
                        title: target.pinned ? 'Note unpinned' : 'Note pinned',
                        description: target.title,
                      })
                    }}
                    onEdit={(target) => {
                      setNoteBeingEdited(target)
                      setNoteOpen(true)
                    }}
                    onDelete={setNoteToDelete}
                  />
                </li>
              ))}
            </ul>
          )}

          {notes.length > visibleNotes.length ? (
            <div className="flex justify-center">
              <Button
                variant="secondary"
                icon="ChevronDown"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
              >
                Show more ({notes.length - visibleNotes.length} left)
              </Button>
            </div>
          ) : null}
        </section>
      )}

      <Dialog
        open={logDraft !== null}
        onClose={() => {
          setLogDraft(null)
          setLogError(undefined)
        }}
        title={logDraft?.id ? 'Edit log entry' : 'Log an entry'}
        description={
          logDraft?.id
            ? 'Fix the time, the duration or the wording.'
            : 'What you did, for how long, and which bucket it belongs in.'
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setLogDraft(null)
                setLogError(undefined)
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" icon="Save" type="submit" form="log-form">
              {logDraft?.id ? 'Save changes' : 'Add entry'}
            </Button>
          </>
        }
      >
        {logDraft ? (
          <form id="log-form" onSubmit={submitLog} className="space-y-4" noValidate>
            <Field label="Activity" required error={logError}>
              <Input
                value={logDraft.activity}
                onChange={(event) => {
                  const activity = event.target.value
                  setLogDraft((draft) => (draft ? { ...draft, activity } : draft))
                  if (logError) setLogError(undefined)
                }}
                placeholder="e.g. Rewrote the retry logic in the queue worker"
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date">
                <Input
                  type="date"
                  value={logDraft.date}
                  onChange={(event) => {
                    const date = event.target.value
                    setLogDraft((draft) => (draft ? { ...draft, date } : draft))
                  }}
                />
              </Field>
              <Field label="Time">
                <Input
                  type="time"
                  value={logDraft.time}
                  onChange={(event) => {
                    const time = event.target.value
                    setLogDraft((draft) => (draft ? { ...draft, time } : draft))
                  }}
                />
              </Field>
              <Field label="Minutes">
                <Input
                  type="number"
                  min={0}
                  step={5}
                  inputMode="numeric"
                  value={logDraft.durationMinutes}
                  onChange={(event) => {
                    const durationMinutes = event.target.value
                    setLogDraft((draft) => (draft ? { ...draft, durationMinutes } : draft))
                  }}
                />
              </Field>
            </div>

            <Field label="Category">
              <Select
                value={logDraft.categoryId}
                onChange={(event) => {
                  const value = event.target.value
                  setLogDraft((draft) => (draft ? { ...draft, categoryId: value } : draft))
                }}
              >
                {db.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Notes" hint="Optional. What worked, what did not, what to try next.">
              <Textarea
                value={logDraft.notes}
                onChange={(event) => {
                  const notes = event.target.value
                  setLogDraft((draft) => (draft ? { ...draft, notes } : draft))
                }}
                rows={3}
                autoGrow
              />
            </Field>
          </form>
        ) : null}
      </Dialog>

      <NoteForm
        open={noteOpen}
        note={noteBeingEdited}
        defaultDate={pinnedDate ?? today}
        onClose={() => {
          setNoteOpen(false)
          setNoteBeingEdited(undefined)
        }}
        onSubmit={submitNote}
      />

      <ConfirmDialog
        open={logToDelete !== null}
        onCancel={() => setLogToDelete(null)}
        onConfirm={() => {
          if (logToDelete) {
            actions.deleteLog(logToDelete.id)
            toast({ title: 'Entry deleted', description: logToDelete.activity })
          }
          setLogToDelete(null)
        }}
        title="Delete this log entry?"
        message={
          logToDelete
            ? `“${logToDelete.activity}” (${durationLabel(logToDelete.durationMinutes)} on ${relativeDay(logToDelete.date)}) will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete entry"
        tone="danger"
      />

      <ConfirmDialog
        open={noteToDelete !== null}
        onCancel={() => setNoteToDelete(null)}
        onConfirm={() => {
          if (noteToDelete) {
            actions.deleteNote(noteToDelete.id)
            toast({ title: 'Note deleted', description: noteToDelete.title })
          }
          setNoteToDelete(null)
        }}
        title="Delete this note?"
        message={
          noteToDelete
            ? `“${noteToDelete.title}” will be removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete note"
        tone="danger"
      />
    </div>
  )
}
