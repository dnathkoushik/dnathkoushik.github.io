import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, Priority, TaskStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'

/** Everything the form produces, already parsed into the shape `actions` want. */
export interface TaskDraft {
  title: string
  description?: string
  categoryId: string
  priority: Priority
  status: TaskStatus
  estimatedMinutes?: number
  actualMinutes?: number
  notes?: string
}

export interface TaskFormProps {
  categories: Category[]
  /** Seeds the fields — an existing task when editing, quick-add parse when new. */
  initial?: Partial<TaskDraft>
  submitLabel?: string
  onSubmit: (draft: TaskDraft) => void
  onCancel: () => void
}

const PRIORITY_OPTIONS: { value: Priority; label: string; icon: string }[] = [
  { value: 'high', label: 'High', icon: 'ArrowUp' },
  { value: 'medium', label: 'Medium', icon: 'Minus' },
  { value: 'low', label: 'Low', icon: 'ArrowDown' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'skipped', label: 'Skipped' },
]

const MAX_TITLE = 140
const MAX_MINUTES = 1440

interface Errors {
  title?: string
  estimatedMinutes?: string
  actualMinutes?: string
}

/** `''` means "not set", which is different from an invalid number. */
function parseMinutes(raw: string, min: number): { ok: true; value?: number } | { ok: false } {
  const text = raw.trim()
  if (text === '') return { ok: true, value: undefined }

  const value = Number(text)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < min || value > MAX_MINUTES) {
    return { ok: false }
  }
  return { ok: true, value }
}

function minutesToInput(value?: number): string {
  return value === undefined ? '' : String(value)
}

/**
 * The full task editor, used for both create and edit.
 *
 * Validation runs on submit and then clears per field as it is corrected, so a
 * half-typed number never turns red while it is still being typed.
 */
export function TaskForm({
  categories,
  initial,
  submitLabel = 'Save task',
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories[0]?.id ?? '',
  )
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'not-started')
  const [estimated, setEstimated] = useState(minutesToInput(initial?.estimatedMinutes))
  const [actual, setActual] = useState(minutesToInput(initial?.actualMinutes))
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [errors, setErrors] = useState<Errors>({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = title.trim()
    const estimatedResult = parseMinutes(estimated, 1)
    const actualResult = parseMinutes(actual, 0)
    const next: Errors = {}

    if (trimmed === '') next.title = 'Give the task a title.'
    else if (trimmed.length > MAX_TITLE) next.title = `Keep the title under ${MAX_TITLE} characters.`
    if (!estimatedResult.ok) next.estimatedMinutes = `Enter whole minutes between 1 and ${MAX_MINUTES}.`
    if (!actualResult.ok) next.actualMinutes = `Enter whole minutes between 0 and ${MAX_MINUTES}.`

    setErrors(next)
    if (Object.keys(next).length > 0) return
    if (!estimatedResult.ok || !actualResult.ok) return

    onSubmit({
      title: trimmed,
      description: description.trim() || undefined,
      categoryId,
      priority,
      status,
      estimatedMinutes: estimatedResult.value,
      actualMinutes: actualResult.value,
      notes: notes.trim() || undefined,
    })
  }

  function clearError(key: keyof Errors) {
    setErrors((prev) => (prev[key] === undefined ? prev : { ...prev, [key]: undefined }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-1" noValidate>
      <Field label="Title" error={errors.title} required>
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            clearError('title')
          }}
          maxLength={MAX_TITLE + 20}
          placeholder="Finish the segment tree chapter"
          autoComplete="off"
        />
      </Field>

      <Field label="Description" hint="Optional context you want to see on the row.">
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          autoGrow
          rows={2}
          placeholder="Two problems on range queries, then write up the pattern."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as TaskStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Priority">
        <SegmentedControl
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
          ariaLabel="Priority"
          className="w-full"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Estimated minutes"
          hint="How long you think it takes."
          error={errors.estimatedMinutes}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MINUTES}
            step={5}
            value={estimated}
            onChange={(event) => {
              setEstimated(event.target.value)
              clearError('estimatedMinutes')
            }}
            className="font-mono tabular-nums"
            placeholder="45"
          />
        </Field>

        <Field
          label="Actual minutes"
          hint="Filled in for you when you start and complete a task."
          error={errors.actualMinutes}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_MINUTES}
            step={5}
            value={actual}
            onChange={(event) => {
              setActual(event.target.value)
              clearError('actualMinutes')
            }}
            className="font-mono tabular-nums"
            placeholder="60"
          />
        </Field>
      </div>

      <Field label="Notes" hint="Anything worth remembering after it is done.">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          autoGrow
          rows={2}
          placeholder="Stuck on lazy propagation — revisit tomorrow."
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" icon="Check">
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
