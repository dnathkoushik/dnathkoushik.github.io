import type { Company, FitValue } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { ButtonLink } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'
import { useOutreachSettings } from '@/hooks/outreach'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { fitBreakdown, fitScore } from '@/utils/outreach'

export interface FitEditorProps {
  company: Company
  className?: string
}

type FitChoice = 'no' | 'partly' | 'yes'

const CHOICE_TO_VALUE: Record<FitChoice, FitValue> = { no: 0, partly: 1, yes: 2 }
const VALUE_TO_CHOICE: Record<FitValue, FitChoice> = { 0: 'no', 1: 'partly', 2: 'yes' }

const CHOICES: { value: FitChoice; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'partly', label: 'Partly' },
  { value: 'yes', label: 'Yes' },
]

/**
 * One three-state control per fit criterion. Every change is written straight
 * to the company, so the ring next to it moves as you go — the score is a
 * derivation, never something you type in.
 */
export function FitEditor({ company, className }: FitEditorProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const { fitCriteria } = useOutreachSettings()

  if (fitCriteria.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col gap-3 rounded-xl border border-dashed border-line bg-surface-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between',
          className,
        )}
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          No fit criteria yet. Define what a good company looks like for you and every company
          gets a score.
        </p>
        <ButtonLink to={PERSONAL_ROUTES.settings} variant="secondary" size="sm" icon="Settings">
          Open settings
        </ButtonLink>
      </div>
    )
  }

  const rows = fitBreakdown(company, fitCriteria)

  const setValue = (criterionId: string, label: string, choice: FitChoice) => {
    const value = CHOICE_TO_VALUE[choice]
    actions.setCompanyFit(company.id, criterionId, value)
    const next = fitScore({ fit: { ...company.fit, [criterionId]: value } }, fitCriteria)
    toast({
      title: `Fit ${next}`,
      description: `${label}: ${CHOICES.find((c) => c.value === choice)?.label ?? choice}.`,
      duration: 1800,
    })
  }

  return (
    <ul className={cn('divide-y divide-line', className)}>
      {rows.map(({ criterion, value, points, max }) => (
        <li
          key={criterion.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0">
            <p className="text-sm leading-snug text-ink">{criterion.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-faint tabular-nums">
              weight ×{criterion.weight} · {points}/{max} pts
            </p>
          </div>
          <SegmentedControl<FitChoice>
            size="sm"
            ariaLabel={`${criterion.label} — fit`}
            value={VALUE_TO_CHOICE[value]}
            onChange={(choice) => setValue(criterion.id, criterion.label, choice)}
            options={CHOICES}
            className="shrink-0"
          />
        </li>
      ))}
    </ul>
  )
}
