import { useMemo, useState } from 'react'
import type { SkillLevel } from '@/types'
import { PUBLIC_ROUTES } from '@/config/routes'
import { skillCategories } from '@/data'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { SegmentedOption } from '@/components/ui/SegmentedControl'
import { SkillCard } from '@/components/portfolio/SkillCard'
import { pluralize } from '@/utils/format'

type LevelFilter = 'all' | SkillLevel

const LEVEL_OPTIONS: SegmentedOption<LevelFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'strong', label: 'Strong' },
  { value: 'working', label: 'Working' },
  { value: 'learning', label: 'Learning' },
]

const TOTAL_SKILLS = skillCategories.reduce((count, category) => count + category.skills.length, 0)

const SUMMARY = `${pluralize(TOTAL_SKILLS, 'skill')} across ${pluralize(
  skillCategories.length,
  'category',
  'categories',
)}`

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
    <div className="mx-auto w-full max-w-5xl px-5 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-28">
      <PageHeader
        eyebrow="Skills"
        title="What I know, and how well"
        description="A three-point scale kept deliberately honest: everything on this page is fair game in an interview."
        className="animate-rise"
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[15px] font-medium text-ink tabular-nums">{SUMMARY}</p>
          <p aria-live="polite" className="text-sm text-ink-muted">
            {level === 'all'
              ? 'Showing every skill.'
              : `Showing ${pluralize(shownSkills, 'skill')} in ${pluralize(
                  groups.length,
                  'category',
                  'categories',
                )}.`}
          </p>
        </div>

        <SegmentedControl
          value={level}
          onChange={setLevel}
          options={LEVEL_OPTIONS}
          ariaLabel="Filter skills by proficiency level"
          className="w-full sm:w-auto"
        />
      </div>

      <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-ink-faint">
        The meter beside each skill reads the same as the label next to it: three segments for
        strong, two for working knowledge, one for still learning.
      </p>

      <section aria-labelledby="skills-by-category" className="mt-8">
        <h2 id="skills-by-category" className="sr-only">
          Skills by category
        </h2>

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
          <ul className="grid gap-5 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.category.id} className="flex animate-rise">
                <SkillCard category={group.category} skills={group.skills} className="w-full" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
