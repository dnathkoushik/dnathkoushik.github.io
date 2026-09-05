import type { Skill, SkillCategory, SkillLevel } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * The level scale, written out once.
 *
 * `filled` drives the meter and `label` drives the text beside it, because a
 * three-segment bar on its own is colour-and-shape only — which is exactly the
 * kind of thing that disappears for a colour-blind reader or in a screen
 * reader. Both always ship together.
 */
const LEVELS: Record<SkillLevel, { label: string; filled: number; bar: string }> = {
  strong: { label: 'Strong', filled: 3, bar: 'bg-positive' },
  working: { label: 'Working knowledge', filled: 2, bar: 'bg-info' },
  learning: { label: 'Learning', filled: 1, bar: 'bg-warning' },
}

function LevelMeter({ level }: { level: SkillLevel }) {
  const { filled, bar } = LEVELS[level]

  return (
    <span aria-hidden="true" className="flex items-center gap-1">
      {[0, 1, 2].map((segment) => (
        <span
          key={segment}
          className={cn(
            'h-1.5 w-4 rounded-full transition-colors duration-150',
            segment < filled ? bar : 'bg-surface-hover',
          )}
        />
      ))}
    </span>
  )
}

export interface SkillCardProps {
  category: SkillCategory
  /**
   * The skills to render — already filtered by the page. Falls back to every
   * skill in the category.
   */
  skills?: Skill[]
  className?: string
}

/** One category of skills: what it is, and how well I actually know each one. */
export function SkillCard({ category, skills, className }: SkillCardProps) {
  const visible = skills ?? category.skills

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name={category.icon} size={18} />
          </span>
          <CardTitle>{category.title}</CardTitle>
        </div>
        {category.description ? <CardDescription>{category.description}</CardDescription> : null}
      </CardHeader>

      <CardContent>
        <ul className="divide-y divide-line">
          {visible.map((skill) => (
            <li
              key={skill.name}
              className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{skill.name}</p>
                {skill.note ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{skill.note}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                <LevelMeter level={skill.level} />
                <span className="font-mono text-[10px] tracking-wide whitespace-nowrap text-ink-faint uppercase">
                  <span className="sr-only">Proficiency: </span>
                  {LEVELS[skill.level].label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
