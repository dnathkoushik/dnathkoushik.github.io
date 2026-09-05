import type { CSSProperties } from 'react'
import { achievements, education, experience, profile, skillCategories } from '@/data'
import { Marquee } from '@/motion'
import { cn } from '@/lib/cn'

/*
 * Hollow type for the personal line. Fill is cleared with
 * `-webkit-text-fill-color` rather than `color: transparent` so the stroke,
 * which reads `currentColor`, keeps the token colour.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

/** Every skill name, in category order, split into two rows of equal length. */
function skillRows(): [string[], string[]] {
  const all = skillCategories.flatMap((category) => category.skills.map((skill) => skill.name))
  const half = Math.ceil(all.length / 2)
  return [all.slice(0, half), all.slice(half)]
}

/** The personal line: where I am, what I compete as, where I have worked, where I study. */
function personalLine(): string[] {
  const city = profile.location.split(',')[0]?.trim()
  const titles = achievements
    .filter((entry) => entry.kind === 'competitive-programming' && entry.featured)
    .map((entry) => entry.title)
  const companies = experience.map((role) => role.company)
  const school = education[0]?.institution

  const seen = new Set<string>()
  return [city, ...titles, ...companies, school].filter((item): item is string => {
    if (!item || seen.has(item)) return false
    seen.add(item)
    return true
  })
}

interface RowProps {
  items: string[]
  itemClassName: string
  itemStyle?: CSSProperties
}

/**
 * One row's content as a real list. The Marquee duplicates it (aria-hidden) for
 * the loop; under reduced motion it wraps into a static, readable list.
 */
function Row({ items, itemClassName, itemStyle }: RowProps) {
  return (
    <ul className="flex items-center gap-8 motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:gap-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex shrink-0 items-center gap-8">
          <span className={itemClassName} style={itemStyle}>
            {item}
          </span>
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
        </li>
      ))}
    </ul>
  )
}

const MONO_ITEM = 'font-mono text-xs uppercase tracking-[0.18em] whitespace-nowrap text-ink-muted'

/**
 * Three marquee bands between the focus list and the selected work: the skills
 * in two counter-rotating mono rows, then the personal line in large hollow
 * display type. Purely a texture — every name here has a proper home on
 * /skills, /achievements or /experience.
 */
export function SkillsMarquee({ className }: { className?: string }) {
  const [first, second] = skillRows()
  const personal = personalLine()

  if (first.length === 0 && personal.length === 0) return null

  return (
    <section
      aria-label="Technologies and interests"
      className={cn('border-y border-line', className)}
    >
      <div className="divide-y divide-line">
        {first.length > 0 ? (
          <Marquee speed={70} direction="left" className="py-5">
            <Row items={first} itemClassName={MONO_ITEM} />
          </Marquee>
        ) : null}

        {second.length > 0 ? (
          <Marquee speed={95} direction="right" className="py-5">
            <Row items={second} itemClassName={MONO_ITEM} />
          </Marquee>
        ) : null}

        {personal.length > 0 ? (
          <Marquee speed={55} direction="left" className="py-6 sm:py-8">
            <Row
              items={personal}
              itemClassName="font-display text-[clamp(1.75rem,4vw,3.25rem)] leading-none font-semibold tracking-tight whitespace-nowrap text-ink-muted"
              itemStyle={OUTLINE}
            />
          </Marquee>
        ) : null}
      </div>
    </section>
  )
}
