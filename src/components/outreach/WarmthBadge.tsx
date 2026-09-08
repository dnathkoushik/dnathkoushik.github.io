import type { ContactWarmth } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { WARMTH_META } from '@/utils/outreach'

export interface WarmthBadgeProps {
  warmth: ContactWarmth
  size?: 'sm' | 'md'
  className?: string
}

/** Icon names are checked against the curated map in `components/ui/Icon.tsx`. */
const WARMTH_ICON: Record<ContactWarmth, string> = {
  cold: 'CircleDashed',
  warm: 'Flame',
  referral: 'Users',
  alumni: 'GraduationCap',
}

/**
 * How warm a contact is, as a chip. The label is always spelled out — the
 * colour and glyph only reinforce it — and the one-line hint from
 * `WARMTH_META` rides along as a tooltip for pointer users.
 */
export function WarmthBadge({ warmth, size = 'md', className }: WarmthBadgeProps) {
  const meta = WARMTH_META[warmth]
  return (
    <Badge tone={meta.tone} size={size} icon={WARMTH_ICON[warmth]} title={meta.hint} className={className}>
      {meta.label}
    </Badge>
  )
}
