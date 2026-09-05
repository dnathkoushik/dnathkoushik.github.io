import { useMemo, useState } from 'react'
import type { SkillLevel } from '@/types'
import { PUBLIC_ROUTES } from '@/config/routes'
import { skillCategories } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import {
  Counter,
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  Stagger,
  TextReveal,
} from '@/motion'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { SegmentedOption } from '@/components/ui/SegmentedControl'
import { SkillCard } from '@/components/portfolio/SkillCard'
import { cn } from '@/lib/cn'
import { pluralize } from '@/utils/format'

type LevelFilter = 'all' | SkillLevel

const LEVEL_OPTIONS: SegmentedOption<LevelFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'strong', label: 'Strong' },
  { value: 'working', label: 'Working' },
  { value: 'learning', label: 'Learning' },
]

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const SECTION_TITLE =
  'font-display text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] tracking-tight text-ink'

const TOTAL_SKILLS = skillCategories.reduce((count, category) => count + category.skills.length, 0)

const SUMMARY = `${pluralize(TOTAL_SKILLS, 'skill')} across ${pluralize(
  skillCategories.length,
  'category',
  'categories',
)}`

/*
 * The closing "Also" band. By convention the last category in skills.ts is the
 * catch-all — the things that do not fit a language or a framework column —
 * so its skills are the ones worth a second pass at the bottom of the page.
 */
const ALSO_ITEMS: string[] =
  skillCategories.length > 0
    ? skillCategories[skillCategories.length - 1].skills.map((skill) => skill.name)
    : []

/** Mono, uppercase items for a marquee band, each followed by an accent dot. */
function BandItems({ items, lead }: { items: string[]; lead?: string }) {
  const all = lead ? [lead, ...items] : items
  return (
    <>
      {all.map((item, index) => (
        <span
          key={`${index}-${item}`}
          className={cn(
            'flex items-center gap-8 font-mono text-xs tracking-[0.18em] whitespace-nowrap uppercase sm:text-[13px]',
            lead && index === 0 ? 'text-ink' : 'text-ink-muted',
          )}
        >
          {item}
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
        </span>
      ))}
    </>
  )
}

export default function SkillsPage() {
  useDocumentMeta({
    title: 'Skills',
    description: `${SUMMARY} — languages, frameworks, CS fundamentals and tooling, each with an honest proficiency level and a note on how I actually use it.`,
    canonicalPath: PUBLIC_ROUTES.skills,
  })

  const [level, setLevel] = useState<LevelFilter>('all')

  const groups = useMemo(
    () =>
      skillCategories
        .map((category) => ({
          category,
          skills:
            level === 'all'
              ? category.skills
              : category.skills.filter((skill) => skill.level === level),
        }))
        .filter((group) => group.skills.length > 0),
    [level],
  )

  const shownSkills = groups.reduce((count, group) => count + group.skills.length, 0)

  return (
    <div>
      {/* 01 — the headline and the numbers */}
      <section aria-labelledby="skills-title" className="pt-16 pb-16 sm:pt-24 sm:pb-24">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="Skills" />
          </Parallax>

          <TextReveal
            as="h1"
            id="skills-title"
            trigger="mount"
            className="mt-6 max-w-[14ch] font-display text-[clamp(3rem,9vw,8rem)] leading-[0.95] tracking-tight text-ink"
          >
            What I know, and how well
          </TextReveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:gap-16">
            <Reveal delay={0.35} trigger="mount" className="lg:col-span-5">
              <p className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] leading-[1.05] tracking-tight text-ink">
                <Counter to={TOTAL_SKILLS} /> {TOTAL_SKILLS === 1 ? 'skill' : 'skills'} across{' '}
                <Counter to={skillCategories.length} />{' '}
                {skillCategories.length === 1 ? 'category' : 'categories'}
              </p>
            </Reveal>

            <Reveal delay={0.45} trigger="mount" className="lg:col-span-7">
              <p className="max-w-[58ch] text-[clamp(1.0625rem,1.4vw,1.25rem)] leading-[1.5] text-ink-muted">
                A three-point scale kept deliberately honest: everything on this page is fair game
                in an interview.
              </p>
              <p className="mt-4 max-w-[58ch] text-sm leading-relaxed text-ink-faint">
                The meter beside each skill reads the same as the label next to it: three segments
                for strong, two for working knowledge, one for still learning.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* 02 — the grid */}
      <section aria-labelledby="skills-by-category" className="border-t border-line py-16 sm:py-24">
        <div className={CONTAINER}>
          <h2 id="skills-by-category" className="sr-only">
            Skills by category
          </h2>

          <Reveal>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite" className={EYEBROW}>
                {level === 'all'
                  ? 'Showing every skill'
                  : `Showing ${pluralize(shownSkills, 'skill')} in ${pluralize(
                      groups.length,
                      'category',
                      'categories',
                    )}`}
              </p>

              <SegmentedControl
                value={level}
                onChange={setLevel}
                options={LEVEL_OPTIONS}
                ariaLabel="Filter skills by proficiency level"
                className="w-full sm:w-auto"
              />
            </div>
          </Reveal>

          <div className="mt-10">
            {groups.length === 0 ? (
              <EmptyState
                icon="Layers"
                title="Nothing at that level yet"
                description="No skill in any category is marked at this level right now."
                action={
                  <Button variant="secondary" icon="RotateCcw" onClick={() => setLevel('all')}>
                    Show every skill
                  </Button>
                }
              />
            ) : (
              /*
               * Keyed by the filter so a new selection remounts the grid and the
               * cards choreograph in again, meters and all, instead of popping.
               */
              <Stagger
                key={level}
                as="ul"
                stagger={0.1}
                y={32}
                className="grid gap-5 md:grid-cols-2"
              >
                {groups.map((group) => (
                  <li key={group.category.id} className="flex min-w-0">
                    <SkillCard category={group.category} skills={group.skills} />
                  </li>
                ))}
              </Stagger>
            )}
          </div>
        </div>
      </section>

      {/* Also — the odd items, on a loop */}
      {ALSO_ITEMS.length > 0 ? (
        <div className="border-y border-line py-5 motion-reduce:px-5 sm:py-6">
          <span className="sr-only">Also: </span>
          <Marquee speed={60} direction="right">
            <BandItems items={ALSO_ITEMS} lead="Also" />
          </Marquee>
        </div>
      ) : null}

      {/* 03 — where they were used */}
      <section aria-labelledby="skills-next" className="py-24 sm:py-36">
        <div
          className={cn(CONTAINER, 'flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between')}
        >
          <div className="max-w-3xl">
            <Reveal>
              <p className={EYEBROW}>Proof</p>
            </Reveal>
            <TextReveal as="h2" id="skills-next" className={cn(SECTION_TITLE, 'mt-4')}>
              See them used
            </TextReveal>
            <Reveal delay={0.25}>
              <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-ink-muted">
                The projects page shows what these built; the experience page shows where they
                were used for real.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.35}>
            <div className="flex flex-wrap items-center gap-3">
              <Magnetic>
                <ButtonLink
                  to={PUBLIC_ROUTES.projects}
                  variant="primary"
                  size="lg"
                  iconRight="ArrowRight"
                  data-cursor="View"
                >
                  Projects
                </ButtonLink>
              </Magnetic>
              <Magnetic strength={0.25}>
                <ButtonLink to={PUBLIC_ROUTES.experience} variant="secondary" size="lg">
                  Experience
                </ButtonLink>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
