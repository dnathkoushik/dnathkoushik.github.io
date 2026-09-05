import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Project } from '@/types'
import { projects } from '@/data'
import { PUBLIC_ROUTES } from '@/config/routes'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ProjectCard } from '@/components/projects/ProjectCard'
import { ProjectDialog } from '@/components/projects/ProjectDialog'
import { TechFilter } from '@/components/projects/TechFilter'

/** The filter lives here, so a filtered view can be linked and survives reload. */
const TECH_PARAM = 'tech'

/** The open project lives here too, which makes one project a shareable URL. */
const PROJECT_PARAM = 'project'

/** Newest first — the sort the list is read in. */
const byNewest = (a: Project, b: Project) => b.date.localeCompare(a.date)

function usesEvery(project: Project, technologies: string[]): boolean {
  return technologies.every((technology) => project.technologies.includes(technology))
}

export default function ProjectsPage() {
  useDocumentMeta({
    title: 'Projects',
    description:
      'Things I have designed, built and shipped — what each one does, the stack behind it, and the engineering decisions I would defend in an interview.',
    canonicalPath: PUBLIC_ROUTES.projects,
  })

  const [searchParams, setSearchParams] = useSearchParams()
  /*
   * The project that was on screen most recently. It exists only so the dialog
   * still has something to draw while it animates shut, after the query string
   * has already been cleared.
   */
  const [closing, setClosing] = useState<Project | null>(null)

  const sorted = useMemo(() => [...projects].sort(byNewest), [])

  const allTechnologies = useMemo(() => {
    const seen = new Map<string, string>()
    for (const project of sorted) {
      for (const technology of project.technologies) {
        const key = technology.toLowerCase()
        if (!seen.has(key)) seen.set(key, technology)
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [sorted])

  /*
   * Anything in the query string that is not a technology some project actually
   * uses is dropped: a stale link should degrade to a wider list, never to a
   * page that looks broken.
   */
  const raw = searchParams.get(TECH_PARAM) ?? ''
  const selected = useMemo(() => {
    const known = new Map(allTechnologies.map((technology) => [technology.toLowerCase(), technology]))
    const picked: string[] = []
    for (const entry of raw.split(',')) {
      const match = known.get(entry.trim().toLowerCase())
      if (match && !picked.includes(match)) picked.push(match)
    }
    return picked
  }, [raw, allTechnologies])

  const filtered = useMemo(
    () => (selected.length === 0 ? sorted : sorted.filter((project) => usesEvery(project, selected))),
    [sorted, selected],
  )

  /* Per-chip counts are what the list would become, not a static total. */
  const counts = useMemo(() => {
    const result: Record<string, number> = {}
    for (const technology of allTechnologies) {
      result[technology] = selected.includes(technology)
        ? filtered.length
        : sorted.filter((project) => usesEvery(project, [...selected, technology])).length
    }
    return result
  }, [allTechnologies, selected, sorted, filtered])

  const commit = useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams)
      if (next.length === 0) params.delete(TECH_PARAM)
      else params.set(TECH_PARAM, next.join(','))
      // `replace` keeps the back button useful: it leaves the page, rather than
      // stepping back through every chip that was ever tapped.
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const toggle = useCallback(
    (technology: string) => {
      commit(
        selected.includes(technology)
          ? selected.filter((entry) => entry !== technology)
          : [...selected, technology],
      )
    },
    [commit, selected],
  )

  const clear = useCallback(() => commit([]), [commit])

  /*
   * The open dialog is a URL, so a single project can be linked to — the 404
   * page's search does exactly that. Opening pushes a history entry, which is
   * what makes the Android back gesture close the dialog instead of leaving the
   * page; closing replaces it, so the history does not fill up with reopenings.
   */
  const active = useMemo(() => {
    const id = searchParams.get(PROJECT_PARAM)
    return id ? (sorted.find((project) => project.id === id) ?? null) : null
  }, [searchParams, sorted])

  const openProject = useCallback(
    (project: Project) => {
      const params = new URLSearchParams(searchParams)
      params.set(PROJECT_PARAM, project.id)
      setSearchParams(params)
    },
    [searchParams, setSearchParams],
  )

  const closeProject = useCallback(() => {
    setClosing(active)
    const params = new URLSearchParams(searchParams)
    params.delete(PROJECT_PARAM)
    setSearchParams(params, { replace: true })
  }, [active, searchParams, setSearchParams])

  const featured = filtered.filter((project) => project.featured)
  const rest = filtered.filter((project) => !project.featured)
  const filtering = selected.length > 0

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <PageHeader
        eyebrow="Projects"
        title="Things I have built"
        description="Ordered newest first. Open any of them for the full write-up: what it does, what was hard, and the decisions behind it."
        actions={
          <ButtonLink to={PUBLIC_ROUTES.github} variant="secondary" icon="GitBranch">
            GitHub activity
          </ButtonLink>
        }
      />

      {sorted.length > 0 ? (
        <TechFilter
          className="mt-10"
          technologies={allTechnologies}
          selected={selected}
          counts={counts}
          total={sorted.length}
          matching={filtered.length}
          onToggle={toggle}
          onClear={clear}
        />
      ) : null}

      {sorted.length === 0 ? (
        <EmptyState
          className="mt-10 animate-rise"
          icon="FolderGit2"
          title="No projects listed yet"
          description="Projects are content, not code: add them to src/data/projects.ts and they appear here, in the filter, and on the home page."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-10 animate-rise"
          icon="Funnel"
          title="No project uses all of those together"
          description={`Nothing here combines ${selected.join(', ')}. Drop a technology, or start again from the full list.`}
          action={
            <Button variant="primary" icon="RotateCcw" onClick={clear}>
              Clear filters
            </Button>
          }
        />
      ) : filtering ? (
        <section aria-labelledby="projects-results" className="mt-12 animate-rise">
          <SectionHeading
            id="projects-results"
            title="Filtered results"
            description={`${filtered.length} of ${sorted.length} projects use ${selected.join(' and ')}.`}
          />
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project, index) => (
              <li key={project.id} className="flex">
                <ProjectCard
                  project={project}
                  eager={index < 2}
                  onOpen={openProject}
                  className="w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {featured.length > 0 ? (
            <section aria-labelledby="projects-featured" className="mt-12 animate-rise">
              <SectionHeading
                id="projects-featured"
                eyebrow="Featured"
                title="The ones I learned the most from"
                description="Each of these started as something I did not know how to build."
              />
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {featured.map((project, index) => (
                  <li
                    key={project.id}
                    className={index === 0 ? 'flex sm:col-span-2' : 'flex'}
                  >
                    <ProjectCard
                      project={project}
                      featured
                      eager={index < 2}
                      onOpen={openProject}
                      className="w-full"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {rest.length > 0 ? (
            <section aria-labelledby="projects-rest" className="mt-16 animate-rise">
              <SectionHeading
                id="projects-rest"
                title="Everything else"
                description="Smaller builds, work still in progress, and older projects kept for the record."
              />
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((project) => (
                  <li key={project.id} className="flex">
                    <ProjectCard project={project} onOpen={openProject} className="w-full" />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <ProjectDialog project={active ?? closing} open={active !== null} onClose={closeProject} />
    </div>
  )
}
