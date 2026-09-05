import { useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Category, CategoryColor, Habit } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { CATEGORY_COLORS, FALLBACK_CATEGORY_ID } from '@/services/defaults'
import { CAT_CLASSES } from '@/utils/format'

export interface HabitFormValues {
  name: string
  categoryId: string
  color: CategoryColor
  targetPerWeek: number
  dailyTarget: number
  unit: string
}

export interface HabitFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (values: HabitFormValues) => void
  categories: Category[]
  /** Present when editing; absent when creating. */
  habit?: Habit
}

/**
 * The palette tokens are hue-only, so each one is given the name a person would
 * actually use. Without it the swatches would announce as "Colour 4", which
 * tells a screen-reader user nothing about what they are picking.
 */
const COLOR_NAMES: Record<CategoryColor, string> = {
  1: 'Indigo',
  2: 'Teal',
  3: 'Amber',
  4: 'Magenta',
  5: 'Sky',
  6: 'Orange',
  7: 'Violet',
  8: 'Lime',
}

const WEEK_TARGETS = [1, 2, 3, 4, 5, 6, 7]

function emptyValues(categories: Category[]): HabitFormValues {
  const category = categories[0]
  return {
    name: '',
    categoryId: category?.id ?? FALLBACK_CATEGORY_ID,
    color: category?.color ?? 1,
    targetPerWeek: 5,
    dailyTarget: 1,
    unit: '',
  }
}

function valuesOf(habit: Habit): HabitFormValues {
  return {
    name: habit.name,
    categoryId: habit.categoryId,
    color: habit.color,
    targetPerWeek: habit.targetPerWeek,
    dailyTarget: habit.dailyTarget,
    unit: habit.unit ?? '',
  }
}

interface Errors {
  name?: string
  dailyTarget?: string
}

function ColorPicker({
  value,
  onChange,
}: {
  value: CategoryColor
  onChange: (color: CategoryColor) => void
}) {
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(0, CATEGORY_COLORS.indexOf(value))

  const move = (delta: number) => {
    const next = (activeIndex + delta + CATEGORY_COLORS.length) % CATEGORY_COLORS.length
    onChange(CATEGORY_COLORS[next])
    swatchRefs.current[next]?.focus()
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Habit colour"
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      {CATEGORY_COLORS.map((color, index) => {
        const selected = color === value
        return (
          <button
            key={color}
            ref={(node) => {
              swatchRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={COLOR_NAMES[color]}
            tabIndex={selected || (activeIndex === 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(color)}
            className={cn(
              'inline-flex size-10 items-center justify-center rounded-lg border transition-colors',
              'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
              selected ? 'border-ink-faint' : 'border-line hover:border-line-strong',
            )}
          >
            <span
              aria-hidden="true"
              className={cn('grid size-6 place-items-center rounded-full', CAT_CLASSES[color].bg)}
            >
              {selected ? <Icon name="Check" size={13} className="text-canvas" /> : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function HabitForm({ open, onClose, onSubmit, categories, habit }: HabitFormProps) {
  const formId = `habit-form-${useId()}`

  const [values, setValues] = useState<HabitFormValues>(() =>
    habit ? valuesOf(habit) : emptyValues(categories),
  )
  const [errors, setErrors] = useState<Errors>({})

  // Reset on the way in, keyed by the record being edited — see GoalForm.
  const session = open ? (habit?.id ?? 'new') : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setValues(habit ? valuesOf(habit) : emptyValues(categories))
      setErrors({})
    }
  }

  const patch = (next: Partial<HabitFormValues>) => setValues((prev) => ({ ...prev, ...next }))

  const handleSubmit = () => {
    const name = values.name.trim()
    const nextErrors: Errors = {}

    if (!name) nextErrors.name = 'Name the habit so you can spot it in the grid.'
    if (!Number.isFinite(values.dailyTarget) || values.dailyTarget < 1) {
      nextErrors.dailyTarget = 'A day counts as done at 1 or more.'
    }

    setErrors(nextErrors)
    if (nextErrors.name || nextErrors.dailyTarget) return

    onSubmit({
      ...values,
      name,
      unit: values.unit.trim(),
      dailyTarget: Math.round(values.dailyTarget),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? 'Edit habit' : 'New habit'}
      description="Habits are counted per day and scored per week."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="Check">
            {habit ? 'Save changes' : 'Add habit'}
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
        <Field label="Habit" required error={errors.name}>
          <Input
            value={values.name}
            onChange={(event) => patch({ name: event.target.value })}
            placeholder="Solve two problems"
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={values.categoryId}
              onChange={(event) => {
                const categoryId = event.target.value
                const category = categories.find((entry) => entry.id === categoryId)
                patch({ categoryId, color: category?.color ?? values.color })
              }}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Days per week"
            hint="How many days count as staying on track."
            htmlFor={`${formId}-per-week`}
          >
            <Select
              id={`${formId}-per-week`}
              value={String(values.targetPerWeek)}
              onChange={(event) => patch({ targetPerWeek: Number(event.target.value) })}
            >
              {WEEK_TARGETS.map((days) => (
                <option key={days} value={days}>
                  {days} {days === 1 ? 'day' : 'days'} a week
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Daily target"
            error={errors.dailyTarget}
            hint="What a full day looks like. Use 1 for done / not done."
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={Number.isFinite(values.dailyTarget) ? values.dailyTarget : ''}
              onChange={(event) => patch({ dailyTarget: Number.parseInt(event.target.value, 10) })}
            />
          </Field>

          <Field label="Unit" hint="Optional. What the daily target counts.">
            <Input
              value={values.unit}
              onChange={(event) => patch({ unit: event.target.value })}
              placeholder="problems"
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-ink">Colour</p>
          <ColorPicker value={values.color} onChange={(color) => patch({ color })} />
          <p className="text-xs leading-relaxed text-ink-faint">
            Currently {COLOR_NAMES[values.color]}. Used for this habit's dot and its heatmap.
          </p>
        </div>
      </form>
    </Dialog>
  )
}
