import type { Project } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { PROJECT_STATUS, ProjectCover } from '@/components/projects/ProjectCard'
import { formatYearMonth } from '@/utils/date'

export interface ProjectDialogProps {
  /**
   * What to render. While the panel animates out this is still the project that
   * was open, even though `open` has already gone false — the caller keeps hold
   * of it so the content does not blink away a beat before the panel does.
   */
  project: Project | null
  open: boolean
  onClose: () => void
}

/** The full write-up for one project: description, key features, stack, links. */
export function ProjectDialog({ project, open, onClose }: ProjectDialogProps) {
  if (!project) return null

  const status = PROJECT_STATUS[project.status]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={project.name}
      description={project.summary}
      size="lg"
      footer={
        <>
          {project.githubUrl ? (
            <ButtonLink href={project.githubUrl} variant="secondary" size="sm" icon="Code">
              Source code
            </ButtonLink>
          ) : null}
          {project.liveUrl ? (
            <ButtonLink href={project.liveUrl} variant="primary" size="sm" icon="Globe">
              Open live site
            </ButtonLink>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        <ProjectCover project={project} eager className="rounded-lg border border-line" />

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} icon={status.icon} size="sm">
            {status.label}
          </Badge>
          <span className="font-mono text-xs text-ink-faint tabular-nums">
            <time dateTime={project.date}>{formatYearMonth(project.date.slice(0, 7))}</time>
          </span>
        </div>

        <p className="text-[15px] leading-relaxed text-ink-muted">{project.description}</p>

        {project.keyFeatures.length > 0 ? (
          <section aria-labelledby={`project-features-${project.id}`}>
            <h3
              id={`project-features-${project.id}`}
              className="text-sm font-semibold tracking-tight text-ink"
            >
              Engineering notes
            </h3>
            <ul className="mt-3 space-y-2.5">
              {project.keyFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-2.5 text-[15px] leading-relaxed text-ink-muted"
                >
                  <Icon name="Check" size={15} className="mt-1 text-positive" />
                  <span className="min-w-0">{feature}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {project.technologies.length > 0 ? (
          <section aria-labelledby={`project-stack-${project.id}`}>
            <h3
              id={`project-stack-${project.id}`}
              className="text-sm font-semibold tracking-tight text-ink"
            >
              Built with
            </h3>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {project.technologies.map((tech) => (
                <li key={tech}>
                  <Badge size="sm" className="font-mono">
                    {tech}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
