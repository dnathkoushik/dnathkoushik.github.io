import { Fragment, useMemo, useState } from 'react'
import type { Experience } from '@/types'
import { experience } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
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
import { ExperienceCard } from '@/components/experience/ExperienceCard'
import {
  Counter,
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  SectionNumber,
  StickyStack,
  TextReveal,
} from '@/motion'
import { pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

/*
 * `data/experience.ts` ships as clearly-labelled templates so the layout has
 * something to render on a fresh clone. Publishing those as if they were real
 * roles would be a lie told in the owner's name, so anything still carrying a
 * template marker is held back from the stack and shown only behind an
 * explicit "preview" toggle, where every entry is labelled as a template.
 */
const TEMPLATE_MARKERS = ['example entry', 'replace me', 'template entry', 'template —']

function isTemplate(entry: Experience): boolean {
  const haystack = [entry.company, entry.position, entry.description, ...entry.achievements]
    .join(' ')
    .toLowerCase()
  return TEMPLATE_MARKERS.some((marker) => haystack.includes(marker))
}

const byNewest = (a: Experience, b: Experience) => b.startDate.localeCompare(a.startDate)

const CONTAINER = 'mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12'
const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'
const TITLE = 'font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.95] tracking-tight text-ink'

/** The technologies across every published role, as a slow band between sections. */
function TechnologyBand({ items }: { items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="border-y border-line py-5">
      <Marquee speed={60}>
        {items.map((item) => (
          <Fragment key={item}>
            <span className={cn(EYEBROW, 'whitespace-nowrap')}>{item}</span>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
          </Fragment>
        ))}
      </Marquee>
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

  const technologies = useMemo(
    () => Array.from(new Set(real.flatMap((role) => role.technologies))),
    [real],
  )

  return (
    <div>
      <section aria-labelledby="experience-title" className="pt-20 pb-14 sm:pt-32 sm:pb-20">
        <div className={CONTAINER}>
          <Parallax speed={-0.15}>
            <SectionNumber n={1} label="Experience" />
          </Parallax>

          <TextReveal as="h1" id="experience-title" className={cn(TITLE, 'mt-6 max-w-5xl')}>
            Where I have worked
          </TextReveal>

          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <Reveal
              as="p"
              delay={0.35}
              className="max-w-2xl text-[17px] leading-relaxed text-ink-muted lg:col-span-7"
            >
              Roles in reverse order, with what the team owned and where my work sat inside it.
            </Reveal>

            <Reveal
              delay={0.45}
              className="flex flex-wrap items-center gap-x-8 gap-y-4 lg:col-span-5 lg:justify-end"
            >
              <p className={EYEBROW}>
                <Counter to={real.length} className="text-ink" />{' '}
                {real.length === 1 ? 'role' : 'roles'}, newest first
              </p>
              <Magnetic>
                <ButtonLink to={PUBLIC_ROUTES.projects} variant="secondary" iconRight="ArrowRight">
                  See the projects
                </ButtonLink>
              </Magnetic>
            </Reveal>
          </div>
        </div>
      </section>

      {real.length > 0 ? (
        <>
          <TechnologyBand items={technologies} />

          <section aria-labelledby="experience-timeline" className="py-16 sm:py-24">
            <div className={CONTAINER}>
              <h2 id="experience-timeline" className="sr-only">
                Timeline
              </h2>
              <StickyStack>
                {real.map((role, index) => (
                  <ExperienceCard key={role.id} role={role} index={index + 1} />
                ))}
              </StickyStack>
            </div>
          </section>
        </>
      ) : (
        <section aria-labelledby="experience-empty" className="pb-24 sm:pb-36">
          <div className={CONTAINER}>
            <Reveal>
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
                          Open{' '}
                          <code className="font-mono text-[13px] text-ink">
                            src/data/experience.ts
                          </code>
                          .
                        </span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="font-mono text-xs text-ink-faint tabular-nums">2</span>
                        <span>
                          Replace each template object with a real role, or delete the array down
                          to <code className="font-mono text-[13px] text-ink">[]</code>.
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
                    number that changed because of it. Until then, the projects and the GitHub page
                    are the honest version of the same question.
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
            </Reveal>

            <div id="experience-template-preview" hidden={!previewing} className="mt-6">
              <div className="rounded-card border border-dashed border-warning/50 bg-warning-soft/30 p-4 sm:p-6">
                <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                  <Icon name="TriangleAlert" size={15} className="mt-0.5 text-warning" />
                  <span>
                    <strong className="font-semibold text-ink">Template preview.</strong> None of
                    the entries below describe a real job. They exist so the layout can be checked
                    before real roles replace them.
                  </span>
                </p>
                {previewing ? (
                  <div className="mt-6 flex flex-col gap-6">
                    {templates.map((role, index) => (
                      <ExperienceCard key={role.id} role={role} index={index + 1} template />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}

      {real.length > 0 && templates.length > 0 ? (
        <div className={cn(CONTAINER, 'pb-16 sm:pb-24')}>
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <Icon name="Info" size={13} />
            Hiding {pluralize(templates.length, 'template entry', 'template entries')} from{' '}
            <code className="font-mono text-ink-muted">src/data/experience.ts</code> until
            replaced with a real role.
          </p>
        </div>
      ) : null}
    </div>
  )
}
