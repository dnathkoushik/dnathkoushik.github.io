import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, LogEntry } from '@/types'
import { Button } from '@/components/ui/Button'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'
import { durationLabel } from '@/utils/date'
import { CAT_CLASSES } from '@/utils/format'

export interface WorkLogRowProps {
  entry: LogEntry
  category?: Category
  categories: Category[]
  onSave: (patch: Partial<LogEntry>) => void
  onDuplicate: () => void
  onDelete: () => void
}

const MAX_MINUTES = 1440
const TIME_RE = /^\d{2}:\d{2}$/

/**
 * One work-log entry, editable in place.
 *
 * Editing happens inside the row rather than in a dialog: a log entry is four
 * short fields, and correcting the duration of something you just typed should
 * not cost a modal, a focus trap and a round trip back to where you were.
 */
export function WorkLogRow({
  entry,
  category,
  categories,
  onSave,
  onDuplicate,
  onDelete,
}: WorkLogRowProps) {
  const [editing, setEditing] = useState(false)
  const [activity, setActivity] = useState(entry.activity)
  const [time, setTime] = useState(entry.time)
  const [minutes, setMinutes] = useState(String(entry.durationMinutes))
  const [categoryId, setCategoryId] = useState(entry.categoryId)
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [error, setError] = useState<string | undefined>(undefined)

  const catClass = CAT_CLASSES[category?.color ?? 1]

  function startEditing() {
    setActivity(entry.activity)
    setTime(entry.time)
    setMinutes(String(entry.durationMinutes))
    setCategoryId(entry.categoryId)
    setNotes(entry.notes ?? '')
    setError(undefined)
    setEditing(true)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = activity.trim()
    const duration = Number(minutes)

    if (trimmed === '') {
      setError('Describe what you worked on.')
      return
    }
    if (!Number.isFinite(duration) || !Number.isInteger(duration) || duration < 1 || duration > MAX_MINUTES) {
      setError(`Enter whole minutes between 1 and ${MAX_MINUTES}.`)
      return
    }

    setEditing(false)
    onSave({
      activity: trimmed,
      time: TIME_RE.test(time) ? time : entry.time,
      durationMinutes: duration,
      categoryId,
      notes: notes.trim() || undefined,
    })
  }

  const menuItems: DropdownMenuItem[] = [
    { id: 'edit', label: 'Edit entry', icon: 'Pencil', onSelect: startEditing },
    { id: 'duplicate', label: 'Duplicate', icon: 'Copy', onSelect: onDuplicate },
    { id: 'delete', label: 'Delete', icon: 'Trash', tone: 'danger', onSelect: onDelete },
  ]

  if (editing) {
    return (
      <li className="rounded-xl border border-accent/40 bg-surface p-3 shadow-subtle">
        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <Field label="Activity" error={error} required>
            <Input
              value={activity}
              onChange={(event) => {
                setActivity(event.target.value)
                setError(undefined)
              }}
              autoComplete="off"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Time">
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Minutes">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_MINUTES}
                step={5}
                value={minutes}
                onChange={(event) => {
                  setMinutes(event.target.value)
                  setError(undefined)
                }}
                className="font-mono tabular-nums"
              />
            </Field>
            <Field label="Category">
              <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notes">
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              autoGrow
              rows={2}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon="Check">
              Save entry
            </Button>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 transition-colors duration-150 hover:border-line-strong">
      <time
        dateTime={`${entry.date}T${entry.time}`}
        className="w-11 shrink-0 pt-0.5 font-mono text-xs text-ink-faint tabular-nums"
      >
        {entry.time}
      </time>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{entry.activity}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2 rounded-full', catClass.bg)} />
            {category?.label ?? 'Uncategorised'}
          </span>
          <span className="font-mono tabular-nums">{durationLabel(entry.durationMinutes)}</span>
        </p>
        {entry.notes ? (
          <p className="mt-1 text-xs leading-relaxed text-ink-faint">{entry.notes}</p>
        ) : null}
      </div>

      <DropdownMenu items={menuItems} label={`Actions for log entry: ${entry.activity}`} />
    </li>
  )
}
