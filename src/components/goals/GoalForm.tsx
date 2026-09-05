import { useId, useState } from 'react'
import type { AnyGoal, Category, GoalStatus, ISODate, Priority } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { FALLBACK_CATEGORY_ID } from '@/services/defaults'
import { formatDayShort } from '@/utils/date'

/** Everything the form owns. Assignable to `Partial<WeeklyGoal | MonthlyGoal>`. */
export interface GoalFormValues {
  title: string
  description: string
  categoryId: string
  priority: Priority
  targetValue: number
  unit: string
  deadline?: ISODate
  status: GoalStatus
}

export interface GoalFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: GoalFormValues) => void
  categories: Category[]
  /** Present when editing; absent when creating. */
  goal?: AnyGoal
  /** "1 – 7 Sep" or "September 2026" — names the period being planned. */
  periodLabel: string
  /** Bounds the deadline picker to the period it belongs to. */
  periodRange: { start: ISODate; end: ISODate }
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'archived', label: 'Archived' },
]

function emptyValues(categories: Category[]): GoalFormValues {
  return {
    title: '',
    description: '',
    categoryId: categories[0]?.id ?? FALLBACK_CATEGORY_ID,
    priority: 'medium',
    targetValue: 1,
    unit: '',
    deadline: undefined,
    status: 'active',
  }
}

function valuesOf(goal: AnyGoal): GoalFormValues {
  return {
    title: goal.title,
    description: goal.description ?? '',
    categoryId: goal.categoryId,
    priority: goal.priority,
    targetValue: goal.targetValue,
    unit: goal.unit,
    deadline: goal.deadline,
    status: goal.status,
  }
}

interface Errors {
  title?: string
  targetValue?: string
}

export function GoalForm({
  open,
  onClose,
  onSubmit,
  categories,
  goal,
  periodLabel,
  periodRange,
}: GoalFormProps) {
  const formId = `goal-form-${useId()}`

  const [values, setValues] = useState<GoalFormValues>(() =>
    goal ? valuesOf(goal) : emptyValues(categories),
  )
  const [errors, setErrors] = useState<Errors>({})

  /*
   * The dialog stays mounted while it animates out, so the fields are reset on
   * the way *in* — keyed by which record is being edited, which also covers
   * clicking "Edit" on a second goal without closing the dialog in between.
   */
  const session = open ? (goal?.id ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(goal ? valuesOf(goal) : emptyValues(categories))
      setErrors({})
    }
  }

  const patch = (next: Partial<GoalFormValues>) => setValues((prev) => ({ ...prev, ...next }))

  const handleSubmit = () => {
    const title = values.title.trim()
    const nextErrors: Errors = {}

    if (!title) nextErrors.title = 'Give the goal a name so you recognise it later.'
    if (!Number.isFinite(values.targetValue) || values.targetValue < 1) {
      nextErrors.targetValue = 'The target has to be at least 1.'
    }

    setErrors(nextErrors)
    if (nextErrors.title || nextErrors.targetValue) return

    onSubmit({
      ...values,
      title,
      description: values.description.trim(),
      unit: values.unit.trim(),
      targetValue: Math.round(values.targetValue),
      deadline: values.deadline ? values.deadline : undefined,
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      description={`For ${periodLabel}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {goal ? 'Save changes' : 'Add goal'}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          handleSubmit()
        }}
        className="flex flex-col gap-4 pb-1"
      >
        <Field label="Goal" required error={errors.title}>
          <Input
            value={values.title}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder="Solve 30 graph problems"
            autoComplete="off"
          />
        </Field>

        <Field label="Why it matters" hint="Optional. One line you will actually read back.">
          <Textarea
            autoGrow
            rows={2}
            value={values.description}
            onChange={(event) => patch({ description: event.target.value })}
            placeholder="Graphs are the weakest area in my last three mock interviews."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={values.categoryId}
              onChange={(event) => patch({ categoryId: event.target.value })}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Priority">
            <Select
              value={values.priority}
              onChange={(event) => patch({ priority: event.target.value as Priority })}
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Target"
            required
            error={errors.targetValue}
            hint="Use 1 for a plain done / not done goal."
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={Number.isFinite(values.targetValue) ? values.targetValue : ''}
              onChange={(event) => patch({ targetValue: Number.parseInt(event.target.value, 10) })}
            />
          </Field>

          <Field label="Unit" hint="What the number counts: problems, hours, chapters.">
            <Input
              value={values.unit}
              onChange={(event) => patch({ unit: event.target.value })}
              placeholder="problems"
              autoComplete="off"
            />
          </Field>

          <Field
            label="Deadline"
            hint={`Optional. Within ${formatDayShort(periodRange.start)} – ${formatDayShort(periodRange.end)}.`}
          >
            <Input
              type="date"
              min={periodRange.start}
              max={periodRange.end}
              value={values.deadline ?? ''}
              onChange={(event) => patch({ deadline: event.target.value || undefined })}
            />
          </Field>

          <Field label="Status">
            <Select
              value={values.status}
              onChange={(event) => patch({ status: event.target.value as GoalStatus })}
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
