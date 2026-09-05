import { useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { Skill, SkillCategory, SkillLevel } from '@/types'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { TiltCard, armAfterIntro } from '@/motion'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * The level scale, written out once.
 *
 * `filled` drives the meter and `label` drives the word beside it, because a
 * three-segment bar on its own is colour-and-shape only — which is exactly the
 * kind of thing that disappears for a colour-blind reader or in a screen
 * reader. Both always ship together.
 */
const LEVELS: Record<SkillLevel, { label: string; filled: number }> = {
  strong: { label: 'Strong', filled: 3 },
  working: { label: 'Working', filled: 2 },
  learning: { label: 'Learning', filled: 1 },
}

/*
 * The pointer-following glow. `--mx` / `--my` are written straight onto the
 * card element from `pointermove`, so no React state is involved and nothing
 * re-renders while the pointer moves.
 */
const GLOW: CSSProperties = {
  backgroundImage:
    'radial-gradient(240px circle at var(--mx, 50%) var(--my, 50%), color-mix(in oklab, var(--color-accent) 12%, transparent), transparent 70%)',
}

function LevelMeter({ level }: { level: SkillLevel }) {
  const { filled } = LEVELS[level]

  return (
    <span aria-hidden="true" className="flex items-center gap-1">
      {[0, 1, 2].map((segment) => {
        const on = segment < filled
        return (
          <span
            key={segment}
            data-segment={on ? 'on' : 'off'}
            className={cn('h-1 w-5 rounded-full', on ? 'bg-accent' : 'bg-line')}
          />
        )
      })}
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

/**
 * One category of skills: what it is, and how well I actually know each one.
 *
 * Tilts gently toward the pointer and carries a soft accent glow under it;
 * the filled meter segments draw in with a stagger when the card enters. All
 * of that is a layer on top of a plain bordered card — on touch devices and
 * under reduced motion the card is simply there, with its final meters.
 */
export function SkillCard({ category, skills, className }: SkillCardProps) {
  const visible = skills ?? category.skills
  const ref = useRef<HTMLDivElement>(null)
  // A stable key for the visible set, so the meters replay when the filter changes.
  const visibleKey = visible.map((skill) => `${skill.name}:${skill.level}`).join('|')

  useGSAP(
    () => {
      const el = ref.current
      if (!el) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const segments = gsap.utils.toArray<HTMLElement>('[data-segment="on"]', el)
        if (segments.length === 0) return

        const fill = gsap.from(segments, {
          scaleX: 0,
          transformOrigin: 'left center',
          duration: 0.7,
          ease: 'house',
          stagger: 0.045,
          paused: true,
        })

        return armAfterIntro(fill, { trigger: 'scroll', element: el, once: true, ctx })
      })
    },
    { scope: ref, dependencies: [visibleKey], revertOnUpdate: true },
  )

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    // Only a real pointer can hover; a finger never gets a glow to chase.
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return
    const el = event.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${(event.clientX - rect.left).toFixed(1)}px`)
    el.style.setProperty('--my', `${(event.clientY - rect.top).toFixed(1)}px`)
  }

  return (
    <TiltCard max={5} glare={false} className={cn('w-full rounded-card', className)}>
      <div
        ref={ref}
        onPointerMove={handlePointerMove}
        data-cursor=""
        className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface p-6 transition-colors duration-200 hover:border-line-strong sm:p-7"
      >
        <span
          aria-hidden="true"
          style={GLOW}
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <Icon name={category.icon} size={20} />
            </span>
            <h3 className="font-display text-[1.375rem] leading-tight tracking-tight text-ink sm:text-2xl">
              {category.title}
            </h3>
          </div>
          <span className="shrink-0 pt-1.5 font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase tabular-nums">
            {String(visible.length).padStart(2, '0')}
            <span className="sr-only"> skills</span>
          </span>
        </div>

        {category.description ? (
          <p className="relative mt-4 text-sm leading-relaxed text-ink-muted">{category.description}</p>
        ) : null}

        <ul className="relative mt-6 divide-y divide-line border-t border-line">
          {visible.map((skill) => (
            <li
              key={skill.name}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 py-3.5"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-medium break-words text-ink">{skill.name}</p>
                {skill.note ? (
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{skill.note}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
                <LevelMeter level={skill.level} />
                <span className="font-mono text-[10px] tracking-[0.18em] whitespace-nowrap text-ink-faint uppercase">
                  <span className="sr-only">Proficiency: </span>
                  {LEVELS[skill.level].label}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </TiltCard>
  )
}
