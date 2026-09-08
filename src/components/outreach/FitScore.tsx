import type { Company, Tone } from '@/types'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useOutreachSettings } from '@/hooks/outreach'
import { cn } from '@/lib/cn'
import { fitScore } from '@/utils/outreach'

export interface FitScoreProps {
  company: Company
  size?: 'sm' | 'md' | 'lg'
  /** Adds a small "Fit" caption beside the ring. */
  showLabel?: boolean
  className?: string
}

const SIZES = {
  sm: { ring: 34, thickness: 3, text: 'text-[11px]' },
  md: { ring: 48, thickness: 4, text: 'text-sm' },
  lg: { ring: 88, thickness: 7, text: 'text-2xl' },
} as const

/** ≥70 reads as a strong fit, 40–69 as worth a look, anything lower as weak. */
// eslint-disable-next-line react-refresh/only-export-components
export function fitTone(score: number): Tone {
  if (score >= 70) return 'positive'
  if (score >= 40) return 'warning'
  return 'neutral'
}

// eslint-disable-next-line react-refresh/only-export-components
export function fitBandLabel(score: number): string {
  if (score >= 70) return 'Strong fit'
  if (score >= 40) return 'Possible fit'
  return 'Weak fit'
}

/**
 * The company's fit score as a ring with the number inside.
 *
 * The score is recomputed from the criteria in Outreach settings on every
 * render, so editing a weight in Settings changes every ring on the page at
 * once — nothing is cached on the company record.
 */
export function FitScore({ company, size = 'md', showLabel = false, className }: FitScoreProps) {
  const { fitCriteria } = useOutreachSettings()
  const scored = fitCriteria.length > 0
  const score = fitScore(company, fitCriteria)
  const skin = SIZES[size]

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <ProgressRing
        value={score}
        size={skin.ring}
        thickness={skin.thickness}
        tone={scored ? fitTone(score) : 'neutral'}
        label={
          scored
            ? `Fit score for ${company.name}: ${score} out of 100, ${fitBandLabel(score).toLowerCase()}`
            : `Fit score for ${company.name}: no criteria configured`
        }
      >
        <span
          className={cn(
            'font-mono font-semibold text-ink tabular-nums',
            skin.text,
            !scored && 'text-ink-faint',
          )}
        >
          {scored ? score : '–'}
        </span>
      </ProgressRing>
      {showLabel ? (
        <span className="flex flex-col leading-tight">
          <span className="font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase">
            Fit
          </span>
          <span className="text-xs text-ink-muted">
            {scored ? fitBandLabel(score) : 'Not scored'}
          </span>
        </span>
      ) : null}
    </div>
  )
}
