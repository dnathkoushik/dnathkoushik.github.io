import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ISODate } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useDayMeta } from '@/hooks/personal'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { truncate } from '@/utils/format'

export interface ObjectiveCardProps {
  date: ISODate
  className?: string
}

interface RatingOption {
  value: number
  label: string
  icon?: string
}

const MOOD_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Rough', icon: 'FaceAngry' },
  { value: 2, label: 'Low', icon: 'FaceSlightlyFrowning' },
  { value: 3, label: 'Okay', icon: 'FaceNeutral' },
  { value: 4, label: 'Good', icon: 'FaceSlightlySmiling' },
  { value: 5, label: 'Great', icon: 'FaceGrinning' },
]

const ENERGY_OPTIONS: RatingOption[] = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Steady' },
  { value: 4, label: 'Strong' },
  { value: 5, label: 'Peak' },
]

const MAX_OBJECTIVE_LENGTH = 140

/**
 * Toggle buttons rather than a radiogroup: `aria-pressed` needs no roving
 * tabindex to be correct, so every option stays reachable with Tab alone and
 * there is no half-implemented arrow-key contract to get wrong.
 */
function RatingRow({
  legend,
  hint,
  options,
  value,
  onSelect,
}: {
  legend: string
  hint: string
  options: RatingOption[]
  value?: number
  onSelect: (next: number) => void
}) {
  const labelId = `rating-${useId()}`
  const current = options.find((option) => option.value === value)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium text-ink">
          {legend}
        </p>
        <p className="text-xs text-ink-faint">
          {current ? `${current.value} / 5 — ${current.label}` : hint}
        </p>
      </div>

      <div role="group" aria-labelledby={labelId} className="flex items-center gap-1">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              aria-label={`${legend}: ${option.value} of 5, ${option.label}`}
              onClick={() => onSelect(option.value)}
              className={cn(
                'inline-flex size-10 items-center justify-center rounded-lg border transition-colors duration-150',
                'pointer-coarse:size-11',
                selected
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line bg-surface text-ink-faint hover:border-line-strong hover:text-ink',
              )}
            >
              {option.icon ? (
                <Icon name={option.icon} size={18} />
              ) : (
                <span className="font-mono text-sm tabular-nums">{option.value}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The objective for one day, plus how the day actually felt.
 *
 * The objective is a real button that swaps to an input rather than a
 * permanently editable field: a day usually has one objective, set once, so the
 * resting state should read as a sentence instead of an empty form.
 */
export function ObjectiveCard({ date, className }: ObjectiveCardProps) {
  const { actions } = usePersonalData()
  const meta = useDayMeta(date)
  const { toast } = useToast()

  const objective = meta?.objective ?? ''
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [lastDate, setLastDate] = useState(date)
  const inputRef = useRef<HTMLInputElement>(null)

  /*
   * Moving to another day must never carry a half-typed objective with it.
   * Adjusting during render rather than in an effect means the new day never
   * paints a frame with the previous day's editor open.
   */
  if (date !== lastDate) {
    setLastDate(date)
    setEditing(false)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function startEditing() {
    setDraft(objective)
    setEditing(true)
  }

  function save() {
    const next = draft.trim()
    setEditing(false)
    if (next === objective) return

    actions.setDayMeta(date, { objective: next })
    toast({
      title: next ? 'Objective saved' : 'Objective cleared',
      description: next ? truncate(next, 70) : undefined,
      tone: next ? 'positive' : 'neutral',
      duration: 2500,
    })
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      save()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    }
  }

  function setMood(value: number) {
    actions.setDayMeta(date, { mood: value })
    const label = MOOD_OPTIONS.find((option) => option.value === value)?.label ?? ''
    toast({ title: `Mood recorded — ${label.toLowerCase()}`, duration: 2000 })
  }

  function setEnergy(value: number) {
    actions.setDayMeta(date, { energy: value })
    const label = ENERGY_OPTIONS.find((option) => option.value === value)?.label ?? ''
    toast({ title: `Energy recorded — ${label.toLowerCase()}`, duration: 2000 })
  }

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle as="h2">Objective for this day</CardTitle>
        <CardDescription>
          The one outcome that would make the day count. Select it to rewrite it.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-5">
        {editing ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={MAX_OBJECTIVE_LENGTH}
              aria-label="Objective for this day"
              placeholder="Ship the graph module and review two pull requests"
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button variant="primary" icon="Check" onClick={save} className="flex-1 sm:flex-none">
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            aria-label={
              objective ? `Edit objective: ${objective}` : 'Set an objective for this day'
            }
            className={cn(
              'group/objective flex w-full items-start gap-2.5 rounded-lg border px-3 py-3 text-left',
              'transition-colors duration-150',
              objective
                ? 'border-transparent bg-surface-muted/70 hover:bg-surface-hover'
                : 'border-dashed border-line hover:border-line-strong hover:bg-surface-hover/50',
            )}
          >
            <Icon
              name="Target"
              size={16}
              className={cn('mt-0.5', objective ? 'text-accent' : 'text-ink-faint')}
            />
            <span
              className={cn(
                'flex-1 text-[15px] leading-relaxed',
                objective ? 'text-ink' : 'text-ink-faint',
              )}
            >
              {objective || 'Set the one thing that would make this day a win.'}
            </span>
            <Icon
              name="Pencil"
              size={14}
              className="mt-1 text-ink-faint opacity-0 transition-opacity duration-150 group-hover/objective:opacity-100 group-focus-visible/objective:opacity-100"
            />
          </button>
        )}

        <div className="space-y-4 border-t border-line pt-4">
          <RatingRow
            legend="Mood"
            hint="How the day felt — not recorded yet"
            options={MOOD_OPTIONS}
            value={meta?.mood}
            onSelect={setMood}
          />
          <RatingRow
            legend="Energy"
            hint="How much was in the tank — not recorded yet"
            options={ENERGY_OPTIONS}
            value={meta?.energy}
            onSelect={setEnergy}
          />
        </div>
      </CardContent>
    </Card>
  )
}
