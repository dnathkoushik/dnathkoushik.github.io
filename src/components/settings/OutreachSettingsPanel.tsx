import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { FitCriterion, OutreachSettings } from '@/types'
import { DEFAULT_FIT_CRITERIA } from '@/services/defaults'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'
import { usePersonalData } from '@/providers/personalDataContext'
import { uid } from '@/utils/ids'
import { pluralize } from '@/utils/format'

type Weight = '1' | '2' | '3' | '4' | '5'

const WEIGHT_OPTIONS: { value: Weight; label: string }[] = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
]

interface TargetsDraft {
  weeklyTarget: string
  staleAfterDays: string
  defaultResumeVersion: string
  followUpDays: number[]
}

interface TargetsErrors {
  weeklyTarget?: string
  staleAfterDays?: string
  followUpDays?: string
}

function draftOf(outreach: OutreachSettings): TargetsDraft {
  return {
    weeklyTarget: String(outreach.weeklyTarget),
    staleAfterDays: String(outreach.staleAfterDays),
    defaultResumeVersion: outreach.defaultResumeVersion ?? '',
    followUpDays: [...outreach.followUpDays],
  }
}

/** Only the target-ish fields, so a criteria edit does not wipe an unsaved target. */
function targetsKey(outreach: OutreachSettings): string {
  return JSON.stringify([
    outreach.weeklyTarget,
    outreach.staleAfterDays,
    outreach.defaultResumeVersion ?? '',
    outreach.followUpDays,
  ])
}

function sameDraft(a: TargetsDraft, b: TargetsDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function asWeight(weight: number): Weight {
  const clamped = Math.min(5, Math.max(1, Math.round(weight)))
  return String(clamped) as Weight
}

type PendingCriteriaAction = { kind: 'remove'; criterion: FitCriterion } | { kind: 'restore' } | null

/**
 * The job-search dials: how many touches a week count as on target, when to
 * follow up, when a thread is stale — and the criteria every company's fit
 * score is computed from. Targets save as one form; the criteria save on each
 * change, because each change re-scores the whole list and should say so.
 */
export function OutreachSettingsPanel() {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()
  const outreach = db.outreach

  /* -- targets ------------------------------------------------------------ */

  const [draft, setDraft] = useState<TargetsDraft>(() => draftOf(outreach))
  const [errors, setErrors] = useState<TargetsErrors>({})
  const [newDay, setNewDay] = useState('')

  // Re-seed when the stored targets change under us (save, import, reset).
  const key = targetsKey(outreach)
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setDraft(draftOf(outreach))
    setErrors({})
  }

  const dirty = !sameDraft(draft, draftOf(outreach))

  const addFollowUpDay = () => {
    const parsed = Number(newDay)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
      setErrors((current) => ({ ...current, followUpDays: 'Whole days, between 1 and 365.' }))
      return
    }
    if (draft.followUpDays.includes(parsed)) {
      setErrors((current) => ({ ...current, followUpDays: `Day ${parsed} is already in the list.` }))
      return
    }
    setDraft((current) => ({
      ...current,
      followUpDays: [...current.followUpDays, parsed].sort((a, b) => a - b),
    }))
    setErrors((current) => ({ ...current, followUpDays: undefined }))
    setNewDay('')
  }

  const removeFollowUpDay = (day: number) => {
    setDraft((current) => ({
      ...current,
      followUpDays: current.followUpDays.filter((item) => item !== day),
    }))
  }

  const saveTargets = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next: TargetsErrors = {}

    const weekly = Number(draft.weeklyTarget)
    if (!Number.isInteger(weekly) || weekly < 1 || weekly > 100) {
      next.weeklyTarget = 'Between 1 and 100 outbound touches a week.'
    }
    const stale = Number(draft.staleAfterDays)
    if (!Number.isInteger(stale) || stale < 1 || stale > 90) {
      next.staleAfterDays = 'Between 1 and 90 days.'
    }
    if (draft.followUpDays.length === 0) {
      next.followUpDays = 'Keep at least one follow-up, or the pipeline never suggests a date.'
    }

    setErrors(next)
    if (next.weeklyTarget || next.staleAfterDays || next.followUpDays) return

    const followUpDays = [...draft.followUpDays].sort((a, b) => a - b)
    actions.updateOutreach({
      weeklyTarget: weekly,
      staleAfterDays: stale,
      followUpDays,
      defaultResumeVersion: draft.defaultResumeVersion.trim() || undefined,
    })
    toast({
      title: 'Outreach targets saved',
      description: `${weekly} a week, follow up after ${followUpDays.join(', ')} days, stale after ${stale}.`,
      tone: 'positive',
    })
  }

  /* -- fit criteria ------------------------------------------------------- */

  const criteria = outreach.fitCriteria
  const [labelDrafts, setLabelDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<PendingCriteriaAction>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newWeight, setNewWeight] = useState<Weight>('3')
  const [addError, setAddError] = useState<string | undefined>(undefined)

  /** How many companies have scored each criterion — what a removal would drop. */
  const scoredCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const criterion of criteria) {
      let count = 0
      for (const company of db.companies) {
        if (company.fit[criterion.id] !== undefined) count += 1
      }
      map.set(criterion.id, count)
    }
    return map
  }, [criteria, db.companies])

  const commitCriteria = (next: FitCriterion[]) => actions.updateOutreach({ fitCriteria: next })

  const dropLabelDraft = (id: string) =>
    setLabelDrafts((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })

  const commitLabel = (criterion: FitCriterion) => {
    const value = labelDrafts[criterion.id]
    dropLabelDraft(criterion.id)
    if (value === undefined) return
    const label = value.trim()
    if (!label || label === criterion.label) return
    commitCriteria(criteria.map((item) => (item.id === criterion.id ? { ...item, label } : item)))
    toast({ title: 'Criterion renamed', description: `“${criterion.label}” is now “${label}”.` })
  }

  const setWeight = (criterion: FitCriterion, weight: Weight) => {
    const value = Number(weight)
    if (value === criterion.weight) return
    commitCriteria(
      criteria.map((item) => (item.id === criterion.id ? { ...item, weight: value } : item)),
    )
    toast({
      title: `Weight set to ${value}`,
      description: `“${criterion.label}” — every company's fit score has been recomputed.`,
      duration: 2500,
    })
  }

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    if (target < 0 || target >= criteria.length) return
    const next = [...criteria]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    commitCriteria(next)
    toast({
      title: 'Criteria reordered',
      description: 'Order only changes how the breakdown reads; scores are unchanged.',
      duration: 2000,
    })
  }

  const confirmPending = () => {
    const action = pending
    setPending(null)
    if (!action) return

    if (action.kind === 'remove') {
      const dropped = scoredCount.get(action.criterion.id) ?? 0
      commitCriteria(criteria.filter((item) => item.id !== action.criterion.id))
      toast({
        title: 'Criterion removed',
        description:
          dropped > 0
            ? `“${action.criterion.label}” is gone and ${pluralize(dropped, 'company', 'companies')} lost their stored value for it.`
            : `“${action.criterion.label}” is gone. No company had scored it yet.`,
      })
      return
    }

    commitCriteria(DEFAULT_FIT_CRITERIA.map((criterion) => ({ ...criterion })))
    toast({
      title: 'Default criteria restored',
      description: 'Values companies stored for the default criteria count again.',
      tone: 'positive',
    })
  }

  const addCriterion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) {
      setAddError('Describe the criterion in a few words.')
      return
    }
    if (criteria.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
      setAddError('That criterion is already in the list.')
      return
    }
    commitCriteria([...criteria, { id: uid('fit'), label, weight: Number(newWeight) }])
    setNewLabel('')
    setNewWeight('3')
    setAddError(undefined)
    toast({
      title: 'Criterion added',
      description: `“${label}” starts at 0 for every company until you score it.`,
      tone: 'positive',
    })
  }

  const totalWeight = criteria.reduce((total, criterion) => total + criterion.weight, 0)

  /** The confirm copy states exactly what a removal or restore will drop. */
  const pendingMessage = (): string => {
    if (!pending) return ''
    if (pending.kind === 'restore') {
      return 'Replaces the list above with the six defaults. Values companies stored for the default criteria count again; values for any custom criterion are dropped.'
    }
    const dropped = scoredCount.get(pending.criterion.id) ?? 0
    return dropped > 0
      ? `${pluralize(dropped, 'company has', 'companies have')} a stored value for it. Those values are dropped and every fit score is recomputed without this line. This cannot be undone.`
      : 'No company has scored it yet, so nothing stored is lost. Every fit score is recomputed without this line.'
  }

  return (
    <div className="space-y-8">
      {/* -- Targets ------------------------------------------------------ */}
      <form onSubmit={saveTargets} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Weekly outbound target"
            hint="Outbound touches per week that count as on target. Drives the progress bar on Overview and Outreach."
            error={errors.weeklyTarget}
          >
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              value={draft.weeklyTarget}
              onChange={(event) =>
                setDraft((current) => ({ ...current, weeklyTarget: event.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>

          <Field
            label="Stale after"
            hint="Days without a touch before an open opportunity is flagged as stale."
            error={errors.staleAfterDays}
          >
            <Input
              type="number"
              min={1}
              max={90}
              step={1}
              inputMode="numeric"
              value={draft.staleAfterDays}
              onChange={(event) =>
                setDraft((current) => ({ ...current, staleAfterDays: event.target.value }))
              }
              className="font-mono tabular-nums"
            />
          </Field>
        </div>

        <Field
          label="Follow-up schedule"
          htmlFor="outreach-follow-up-day"
          hint="Days after an unanswered outbound touch to follow up, in order. With 4 and 10, the first follow-up is suggested four days after the last message and the second ten."
          error={errors.followUpDays}
        >
          <div className="flex flex-col gap-2">
            {draft.followUpDays.length > 0 ? (
              <ul aria-label="Follow-up days" className="flex flex-wrap gap-1.5">
                {draft.followUpDays.map((day, index) => (
                  <li key={day}>
                    <span className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-surface-muted pr-1 pl-3 text-sm text-ink">
                      <span className="text-ink-faint">#{index + 1}</span>
                      <span className="font-mono tabular-nums">day {day}</span>
                      <button
                        type="button"
                        onClick={() => removeFollowUpDay(day)}
                        aria-label={`Remove day ${day}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-faint">No follow-ups scheduled.</p>
            )}
            <div className="flex gap-2">
              <Input
                id="outreach-follow-up-day"
                type="number"
                min={1}
                max={365}
                step={1}
                inputMode="numeric"
                value={newDay}
                onChange={(event) => {
                  setNewDay(event.target.value)
                  if (errors.followUpDays) {
                    setErrors((current) => ({ ...current, followUpDays: undefined }))
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addFollowUpDay()
                  }
                }}
                placeholder="e.g. 21"
                className="w-32 font-mono tabular-nums"
              />
              <Button type="button" variant="secondary" icon="Plus" onClick={addFollowUpDay}>
                Add day
              </Button>
            </div>
          </div>
        </Field>

        <Field
          label="Default resume version"
          hint="Pre-fills the resume field on new opportunities, e.g. backend-v3. Optional."
        >
          <Input
            value={draft.defaultResumeVersion}
            onChange={(event) =>
              setDraft((current) => ({ ...current, defaultResumeVersion: event.target.value }))
            }
            placeholder="backend-v3"
            autoComplete="off"
            spellCheck={false}
            className="sm:w-64"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" icon="Save" disabled={!dirty}>
            Save targets
          </Button>
          {dirty ? (
            <Button
              type="button"
              variant="ghost"
              icon="Undo2"
              onClick={() => {
                setDraft(draftOf(outreach))
                setErrors({})
                setNewDay('')
              }}
            >
              Discard changes
            </Button>
          ) : (
            <span className="text-xs text-ink-faint">Saved.</span>
          )}
        </div>
      </form>

      {/* -- Fit criteria ------------------------------------------------- */}
      <section aria-labelledby="outreach-fit-heading" className="space-y-4 border-t border-line pt-6">
        <div className="space-y-1">
          <h3 id="outreach-fit-heading" className="text-base font-semibold tracking-tight text-ink">
            Fit criteria
          </h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            Every company is scored yes / partly / no against each line below; the weights (1–5)
            say how much each answer counts and the result is normalised to 0–100. Changing a
            weight re-scores every company instantly. Removing a criterion drops the values
            companies stored for it.
          </p>
        </div>

        {criteria.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-surface-muted/40 px-4 py-6 text-center text-sm text-ink-muted">
            No criteria — every company scores 0. Add one below or restore the defaults.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line">
            {criteria.map((criterion, index) => {
              const inputId = `fit-criterion-${criterion.id}`
              const scored = scoredCount.get(criterion.id) ?? 0
              return (
                <li key={criterion.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
                  <span
                    aria-hidden="true"
                    className="hidden w-5 shrink-0 text-center font-mono text-xs text-ink-faint tabular-nums sm:block"
                  >
                    {index + 1}
                  </span>

                  <label className="sr-only" htmlFor={inputId}>
                    Label of criterion {index + 1}
                  </label>
                  <Input
                    id={inputId}
                    value={labelDrafts[criterion.id] ?? criterion.label}
                    onChange={(event) =>
                      setLabelDrafts((current) => ({ ...current, [criterion.id]: event.target.value }))
                    }
                    onBlur={() => commitLabel(criterion)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        event.currentTarget.blur()
                      }
                      if (event.key === 'Escape') dropLabelDraft(criterion.id)
                    }}
                    className="h-9 sm:flex-1"
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl<Weight>
                      value={asWeight(criterion.weight)}
                      onChange={(weight) => setWeight(criterion, weight)}
                      options={WEIGHT_OPTIONS}
                      size="sm"
                      ariaLabel={`Weight for ${criterion.label}`}
                    />
                    <Badge tone="neutral" size="sm" className="hidden font-mono tabular-nums md:inline-flex">
                      {totalWeight > 0 ? `${Math.round((criterion.weight / totalWeight) * 100)}%` : '0%'}
                    </Badge>
                    <div className="flex items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        icon="ArrowUp"
                        aria-label={`Move ${criterion.label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        icon="ArrowDown"
                        aria-label={`Move ${criterion.label} down`}
                        disabled={index === criteria.length - 1}
                        onClick={() => move(index, 1)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        icon="Trash"
                        aria-label={`Remove ${criterion.label}`}
                        onClick={() => setPending({ kind: 'remove', criterion })}
                        className="text-danger hover:text-danger"
                      />
                    </div>
                  </div>

                  <span className="text-[11px] text-ink-faint sm:hidden">
                    {scored > 0 ? `Scored on ${pluralize(scored, 'company', 'companies')}` : 'Not scored yet'}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={addCriterion} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Add a criterion"
            hint="A yes / partly / no question you can answer about any company."
            error={addError}
            className="flex-1"
          >
            <Input
              value={newLabel}
              onChange={(event) => {
                setNewLabel(event.target.value)
                if (addError) setAddError(undefined)
              }}
              placeholder="e.g. Ships to production weekly"
              autoComplete="off"
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">Weight</span>
            <SegmentedControl<Weight>
              value={newWeight}
              onChange={setNewWeight}
              options={WEIGHT_OPTIONS}
              ariaLabel="Weight for the new criterion"
            />
          </div>
          <Button type="submit" variant="secondary" icon="Plus">
            Add
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-faint">
            {pluralize(criteria.length, 'criterion', 'criteria')} · total weight{' '}
            <span className="font-mono tabular-nums">{totalWeight}</span>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon="RotateCcw"
            onClick={() => setPending({ kind: 'restore' })}
          >
            Restore default criteria
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={pending !== null}
        onCancel={() => setPending(null)}
        onConfirm={confirmPending}
        title={
          pending?.kind === 'remove'
            ? `Remove “${pending.criterion.label}”?`
            : 'Restore the default criteria?'
        }
        message={pendingMessage()}
        confirmLabel={pending?.kind === 'remove' ? 'Remove criterion' : 'Restore defaults'}
        tone={pending?.kind === 'remove' ? 'danger' : 'accent'}
      />
    </div>
  )
}
