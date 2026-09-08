import type { OpportunityStage } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { STAGE_META } from '@/utils/outreach'

export interface StageBadgeProps {
  stage: OpportunityStage
  size?: 'sm' | 'md'
  className?: string
}

/** Closed stages carry a glyph as well as a tone, so "how did it end" never rests on colour. */
const TERMINAL_ICON: Partial<Record<OpportunityStage, string>> = {
  accepted: 'CircleCheckBig',
  rejected: 'CircleX',
  ghosted: 'CircleDashed',
  withdrawn: 'CircleMinus',
}

/**
 * The stage of an opportunity as a chip.
 *
 * Tone and label both come from `STAGE_META`, so the board, the detail dialog,
 * the funnel and the activity feed agree on what "Screening" looks like. The
 * label is always text; the tone only reinforces it.
 */
export function StageBadge({ stage, size = 'md', className }: StageBadgeProps) {
  const meta = STAGE_META[stage]
  return (
    <Badge tone={meta.tone} size={size} icon={TERMINAL_ICON[stage]} className={className}>
      {meta.label}
    </Badge>
  )
}
