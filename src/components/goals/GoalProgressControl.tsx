import { useState } from 'react'
import type { AnyGoal, GoalStatus } from '@/types'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

/**
 * The only fields a progress interaction ever changes. Narrower than
 * `Partial<WeeklyGoal>` on purpose: the same object has to be accepted by both
 * `updateWeeklyGoal` and `updateMonthlyGoal`, and this shape is assignable to
 * either without a cast.
 */
export interface GoalPatch {
  currentValue?: number
  status?: GoalStatus
}

export interface GoalProgressControlProps {
  goal: AnyGoal
  onUpdate: (patch: GoalPatch) => void
  className?: string
}

/**
 * The fast path for logging progress: two steppers, a direct number entry and
 * a single "Done" button.
 *
 * Writes go straight through — the data layer is synchronous and debounces its
 * own persistence, so there is nothing to gain from batching here and a lot to
 * lose: a stepper that lags behind the finger feels broken.
 */
export function GoalProgressControl({ goal, onUpdate, className }: GoalProgressControlProps) {
  const { toast } = useToast()

  // Free text while the field has focus, so a half-typed "1" on the way to "12"
  // is never rewritten under the cursor. Reconciled whenever the record moves.
  const [draft, setDraft] = useState(String(goal.currentValue))
  const [syncedValue, setSyncedValue] = useState(goal.currentValue)
  if (goal.currentValue !== syncedValue) {
    setSyncedValue(goal.currentValue)
    setDraft(String(goal.currentValue))
  }

  const done = goal.status === 'completed'

  /** Applies a new tally and keeps `status` honest in both directions. */
  const commit = (next: number) => {
    const value = Math.max(0, Math.round(Number.isFinite(next) ? next : 0))
    if (value === goal.currentValue) {
      setDraft(String(goal.currentValue))
      return
    }

    const reachedTarget = value >= goal.targetValue
    const patch: GoalPatch = { currentValue: value }

    // Falling back under the target reopens a goal that was ticked off; the
    // service completes it again on the way up, so only the reopen is explicit.
    if (!reachedTarget && goal.status === 'completed') patch.status = 'active'

    onUpdate(patch)

    if (reachedTarget && goal.status === 'active') {
      toast({
        title: 'Goal completed',
        description: `${goal.title} — ${value} / ${goal.targetValue} ${goal.unit}`.trim(),
        tone: 'positive',
      })
    }
  }

  const markDone = () => {
    onUpdate({ currentValue: goal.targetValue, status: 'completed' })
    toast({
      title: 'Goal completed',
      description: goal.title,
      tone: 'positive',
    })
  }

  const reopen = () => {
    onUpdate({
      status: 'active',
      currentValue: Math.min(goal.currentValue, Math.max(0, goal.targetValue - 1)),
    })
    toast({ title: 'Goal reopened', description: goal.title, tone: 'accent' })
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="inline-flex items-center rounded-lg border border-line bg-surface-muted p-0.5">
        <button
          type="button"
          onClick={() => commit(goal.currentValue - 1)}
          disabled={goal.currentValue <= 0}
          aria-label={`Decrease progress on ${goal.title} by one`}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:pointer-events-none disabled:opacity-40 pointer-coarse:size-10"
        >
          <Icon name="Minus" className="size-4" />
        </button>

        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={draft}
          aria-label={`Progress on ${goal.title}${goal.unit ? ` in ${goal.unit}` : ''}`}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit(Number.parseInt(draft, 10))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          className="h-9 w-14 [appearance:textfield] rounded-md border border-transparent bg-transparent text-center font-mono text-sm font-medium text-ink tabular-nums outline-accent focus-visible:border-line focus-visible:bg-surface focus-visible:outline-2 focus-visible:outline-offset-1 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none pointer-coarse:h-10"
        />

        <button
          type="button"
          onClick={() => commit(goal.currentValue + 1)}
          aria-label={`Increase progress on ${goal.title} by one`}
          className="inline-flex size-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink pointer-coarse:size-10"
        >
          <Icon name="Plus" className="size-4" />
        </button>
      </div>

      {done ? (
        <Button variant="ghost" size="sm" icon="Undo2" onClick={reopen}>
          Reopen
        </Button>
      ) : (
        <Button variant="secondary" size="sm" icon="Check" onClick={markDone}>
          Done
        </Button>
      )}
    </div>
  )
}
