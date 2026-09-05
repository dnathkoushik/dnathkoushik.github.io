import { useMemo, useState } from 'react'
import type { Experience, Tone } from '@/types'
import { experience } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { TimelineItem } from '@/components/portfolio/TimelineItem'
import { yearMonthRangeLabel } from '@/utils/date'
import { pluralize } from '@/utils/format'

/*
 * `data/experience.ts` ships as clearly-labelled templates so the layout has
 * something to render on a fresh clone. Publishing those as if they were real
 * roles would be a lie told in the owner's name, so anything still carrying a
 * template marker is held back from the timeline and shown only behind an
 * explicit "preview" toggle, where every entry is labelled as a template.
 */
const TEMPLATE_MARKERS = ['example entry', 'replace me', 'template entry', 'template —']

function isTemplate(entry: Experience): boolean {
  const haystack = [entry.company, entry.position, entry.description, ...entry.achievements]
    .join(' ')
    .toLowerCase()
  return TEMPLATE_MARKERS.some((marker) => haystack.includes(marker))
}

interface TypeMeta {
  label: string
  tone: Tone
  icon: string
}

const TYPE_META: Record<Experience['type'], TypeMeta> = {
  internship: { label: 'Internship', tone: 'info', icon: 'GraduationCap' },
  'full-time': { label: 'Full-time', tone: 'positive', icon: 'Briefcase' },
  'part-time': { label: 'Part-time', tone: 'neutral', icon: 'Clock' },
  freelance: { label: 'Freelance', tone: 'warning', icon: 'Laptop' },
  'open-source': { label: 'Open source', tone: 'neutral', icon: 'GitBranch' },
}

const byNewest = (a: Experience, b: Experience) => b.startDate.localeCompare(a.startDate)

interface RoleTimelineProps {
  roles: Experience[]
  /** Marks every entry as a template in its meta line. */
  template?: boolean
}

/**
 * The timeline itself.
 *
 * `TimelineItem` takes strings, not children, so the type badge is rendered in
 * a row above each entry that repeats the item's own two-column grid — that
 * keeps the badge aligned with the role title and lets the connecting rail run
 * through the row uninterrupted.
 */
function RoleTimeline({ roles, template = false }: RoleTimelineProps) {
  return (
    <div className="mt-8">
      {roles.map((role, index) => {
        const type = TYPE_META[role.type]
        const dates = yearMonthRangeLabel(role.startDate, role.endDate)
        const meta = [template ? 'TEMPLATE' : null, dates, role.location]
          .filter(Boolean)
          .join('  ·  ')

        return (
          <div key={role.id}>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 sm:gap-x-5">
              <div className="relative flex w-9 justify-center" aria-hidden="true">
                {index > 0 ? (
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" />
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <Badge tone={type.tone} icon={type.icon} size="sm">
                  {type.label}
                </Badge>
                {!role.endDate ? (
                  <Badge tone="accent" size="sm" icon="Dot">
                    Current
                  </Badge>
                ) : null}
                {template ? (
                  <Badge tone="warning" size="sm" icon="TriangleAlert">
                    Template entry
                  </Badge>
                ) : null}
              </div>
            </div>

            <TimelineItem
              title={role.position}
              subtitle={role.company}
              meta={meta}
              description={role.description}
              bullets={role.achievements}
              tags={role.technologies}
              url={role.url}
              icon={type.icon}
              isLast={index === roles.length - 1}
            />
          </div>
        )
      })}
    </div>
  )
}

export default function ExperiencePage() {
  useDocumentMeta({
    title: 'Experience',
    description:
      'Roles, internships and open-source work — what each team owned, what I built inside it, and the stack it ran on.',
    canonicalPath: PUBLIC_ROUTES.experience,
  })

  const [previewing, setPreviewing] = useState(false)

  const { real, templates } = useMemo(() => {
    const sorted = [...experience].sort(byNewest)
    return {
      real: sorted.filter((role) => !isTemplate(role)),
      templates: sorted.filter(isTemplate),
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <PageHeader
        eyebrow="Experience"
        title="Where I have worked"
        description="Roles in reverse order, with what the team owned and where my work sat inside it."
        actions={
          <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" icon="FolderGit2">
            See the projects
          </ButtonLink>
        }
      />

      {real.length > 0 ? (
        <section aria-labelledby="experience-timeline" className="mt-12 animate-rise">
          <SectionHeading
            id="experience-timeline"
            title="Timeline"
            description={`${pluralize(real.length, 'role')}, newest first.`}
          />
          <RoleTimeline roles={real} />
        </section>
      ) : (
        <section aria-labelledby="experience-empty" className="mt-12 animate-rise">
          <Card>
            <CardHeader>
              <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                <Icon name="Briefcase" size={20} />
              </span>
              <CardTitle as="h2" id="experience-empty" className="pt-1">
                Nothing published here yet
              </CardTitle>
              <CardDescription>
                {experience.length === 0
                  ? 'This timeline is empty on purpose. It stays empty until there is a real role to put in it.'
                  : `The repository ships with ${pluralize(
                      templates.length,
                      'labelled template entry',
                      'labelled template entries',
                    )} so the layout has something to lay out. They are held back from the published page rather than shown as a career that did not happen.`}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="rounded-lg border border-line bg-surface-muted/60 p-4">
                <h3 className="text-sm font-semibold text-ink">To fill this page in</h3>
                <ol className="mt-2 space-y-2 text-sm leading-relaxed text-ink-muted">
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">1</span>
                    <span>
                      Open <code className="font-mono text-[13px] text-ink">src/data/experience.ts</code>.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">2</span>
                    <span>
                      Replace each template object with a real role, or delete the array down to{' '}
                      <code className="font-mono text-[13px] text-ink">[]</code>.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <span className="font-mono text-xs text-ink-faint tabular-nums">3</span>
                    <span>
                      Drop the words <em>EXAMPLE ENTRY</em>, <em>TEMPLATE</em> and{' '}
                      <em>replace me</em> — this page hides any entry that still carries one.
                    </span>
                  </li>
                </ol>
              </div>

              <p className="text-sm leading-relaxed text-ink-muted">
                An entry reads best as: what the team owned, what you built inside it, and the
                number that changed because of it. Until then, the projects and the GitHub page are
                the honest version of the same question.
              </p>
            </CardContent>

            <CardFooter>
              {templates.length > 0 ? (
                <Button
                  variant="secondary"
                  icon={previewing ? 'EyeOff' : 'Eye'}
                  onClick={() => setPreviewing((open) => !open)}
                  aria-expanded={previewing}
                  aria-controls="experience-template-preview"
                >
                  {previewing ? 'Hide the template entries' : 'Preview the template entries'}
                </Button>
              ) : null}
              <ButtonLink to={PUBLIC_ROUTES.projects} variant="ghost" icon="FolderGit2">
                Projects
              </ButtonLink>
              <ButtonLink to={PUBLIC_ROUTES.github} variant="ghost" icon="GitBranch">
                GitHub
              </ButtonLink>
            </CardFooter>
          </Card>

          <div id="experience-template-preview" hidden={!previewing} className="mt-6">
            <div className="rounded-card border border-dashed border-warning/50 bg-warning-soft/30 p-4 sm:p-6">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                <Icon name="TriangleAlert" size={15} className="mt-0.5 text-warning" />
                <span>
                  <strong className="font-semibold text-ink">Template preview.</strong> None of the
                  entries below describe a real job. They exist so the layout can be checked before
                  real roles replace them.
                </span>
              </p>
              {previewing ? <RoleTimeline roles={templates} template /> : null}
            </div>
          </div>
        </section>
      )}

      {real.length > 0 && templates.length > 0 ? (
        <p className="mt-8 flex items-center gap-2 text-xs text-ink-faint">
          <Icon name="Info" size={13} />
          Hiding {pluralize(templates.length, 'template entry', 'template entries')} from{' '}
          <code className="font-mono text-ink-muted">src/data/experience.ts</code> until replaced
          with a real role.
        </p>
      ) : null}
    </div>
  )
}
