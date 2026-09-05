import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, ISODate } from '@/types'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { durationLabel, nowClockTime } from '@/utils/date'
import { truncate } from '@/utils/format'

export interface QuickAddLogProps {
  date: ISODate
  categories: Category[]
  /** Set by `?focus=log`, so "Log work" from the overview lands typing. */
  autoFocus?: boolean
  className?: string
}

const PRESETS = [15, 30, 45, 60, 90, 120]
const MAX_MINUTES = 1440
const TIME_RE = /^\d{2}:\d{2}$/

interface Errors {
  activity?: string
  minutes?: string
}

/**
 * Adds one work-log entry.
 *
 * The time defaults to now because the log is almost always written just after
 * the thing happened, and the duration presets exist because "how long was
 * that?" is answered in fifteen-minute chunks, not in exact minutes.
 */
export function QuickAddLog({ date, categories, autoFocus = false, className }: QuickAddLogProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()

  const [activity, setActivity] = useState('')
  const [time, setTime] = useState(() => nowClockTime())
  const [minutes, setMinutes] = useState('30')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const activityRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) activityRef.current?.focus()
  }, [autoFocus])

  /*
   * A category can be archived or deleted from Settings while this form is
   * open. Resolving the selection during render, rather than correcting it in
   * an effect, means the `<select>` is never briefly pointing at a value that
   * is no longer one of its options.
   */
  const activeCategoryId = categories.some((category) => category.id === categoryId)
    ? categoryId
    : (categories[0]?.id ?? '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmed = activity.trim()
    const duration = Number(minutes)
    const next: Errors = {}

    if (trimmed === '') next.activity = 'Describe what you worked on.'
    if (
      !Number.isFinite(duration) ||
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > MAX_MINUTES
    ) {
      next.minutes = `Enter whole minutes between 1 and ${MAX_MINUTES}.`
    }

    setErrors(next)
    if (next.activity || next.minutes) return

    const entry = actions.addLog({
      date,
      activity: trimmed,
      time: TIME_RE.test(time) ? time : nowClockTime(),
      categoryId: activeCategoryId,
      durationMinutes: duration,
    })

    setActivity('')
    setTime(nowClockTime())
    activityRef.current?.focus()
    toast({
      title: `Logged ${durationLabel(entry.durationMinutes)}`,
      description: truncate(entry.activity, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={cn('space-y-3 rounded-xl border border-line bg-surface p-3 shadow-subtle', className)}
    >
      <Field label="What did you work on?" error={errors.activity} required>
        <Input
          ref={activityRef}
          value={activity}
          onChange={(event) => {
            setActivity(event.target.value)
            setErrors((prev) => ({ ...prev, activity: undefined }))
          }}
          placeholder="Four graph problems on Codeforces"
          autoComplete="off"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Started at">
          <Input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className="font-mono tabular-nums"
          />
        </Field>

        <Field label="Minutes" error={errors.minutes}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_MINUTES}
            step={5}
            value={minutes}
            onChange={(event) => {
              setMinutes(event.target.value)
              setErrors((prev) => ({ ...prev, minutes: undefined }))
            }}
            className="font-mono tabular-nums"
          />
        </Field>

        <Field label="Category">
          <Select value={activeCategoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Common durations" className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const active = minutes === String(preset)
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMinutes(String(preset))
                  setErrors((prev) => ({ ...prev, minutes: undefined }))
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-xs tabular-nums transition-colors duration-150',
                  active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink',
                )}
              >
                {durationLabel(preset)}
              </button>
            )
          })}
        </div>

        <Button type="submit" variant="primary" icon="Plus">
          Log work
        </Button>
      </div>
    </form>
  )
}
