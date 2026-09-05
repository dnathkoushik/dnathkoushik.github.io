import { useRef } from 'react'
import type { Project } from '@/types'
import { gsap, useGSAP, MOTION_CONDITIONS } from '@/motion/gsap'
import type { MotionConditions } from '@/motion/gsap'
import { armAfterIntro, Magnetic } from '@/motion'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { GithubIcon } from '@/components/common/BrandIcons'
import { PROJECT_STATUS, ProjectCover } from '@/components/projects/ProjectCard'
import { formatYearMonth } from '@/utils/date'
import { pluralize } from '@/utils/format'
import { cn } from '@/lib/cn'

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

const EYEBROW = 'font-mono text-[11px] uppercase tracking-[0.18em] text-ink-faint'

/**
 * The write-up itself, keyed by project so every open starts from a clean
 * entrance.
 *
 * The dialog is a fixed overlay whose content scrolls inside its own panel, so
 * nothing in here can be driven by the page's ScrollTrigger — a block below the
 * panel's fold would never be "scrolled to" and would stay hidden. Instead one
 * timeline plays at mount: the cover wipes up (its own Reveal, on 'mount'), then
 * the metadata, description and sections rise in turn, and the numbered notes
 * cascade inside theirs. Under reduced motion the timeline is never built and
 * the markup is already in its final state.
 */
function DialogBody({ project }: { project: Project }) {
  const ref = useRef<HTMLDivElement>(null)
  const status = PROJECT_STATUS[project.status]

  useGSAP(
    () => {
      const root = ref.current
      if (!root) return

      const mm = gsap.matchMedia()
      mm.add(MOTION_CONDITIONS, (ctx) => {
        const c = ctx.conditions as MotionConditions
        if (!c.motion) return

        const blocks = gsap.utils.toArray<HTMLElement>('[data-reveal]', root)
        const notes = gsap.utils.toArray<HTMLElement>('[data-reveal-note]', root)
        if (blocks.length === 0 && notes.length === 0) return

        const tl = gsap.timeline({ paused: true, defaults: { ease: 'house' } })
        if (blocks.length > 0) {
          tl.from(blocks, { y: 20, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.2)
        }
        if (notes.length > 0) {
          tl.from(notes, { y: 16, opacity: 0, duration: 0.8, stagger: 0.06 }, 0.45)
        }

        return armAfterIntro(tl, { trigger: 'mount', element: root, once: true, ctx })
      })
    },
    { scope: ref },
  )

  return (
    <div ref={ref} className="space-y-7 pt-1">
      <ProjectCover
        project={project}
        eager
        reveal="mount"
        delay={0.1}
        className="rounded-lg border border-line"
      />

      <div data-reveal="" className={cn(EYEBROW, 'flex flex-wrap items-center gap-x-3 gap-y-2')}>
        <Badge tone={status.tone} icon={status.icon} size="sm">
          {status.label}
        </Badge>
        <time dateTime={project.date} className="tabular-nums">
          {formatYearMonth(project.date.slice(0, 7))}
        </time>
        <span aria-hidden="true" className="size-1 rounded-full bg-line-strong" />
        <span>{pluralize(project.technologies.length, 'technology', 'technologies')}</span>
      </div>

      <p data-reveal="" className="text-[15px] leading-relaxed text-ink-muted sm:text-base">
        {project.description}
      </p>

      {project.keyFeatures.length > 0 ? (
        <section data-reveal="" aria-labelledby={`project-features-${project.id}`}>
          <h3 id={`project-features-${project.id}`} className={EYEBROW}>
            Engineering notes
          </h3>
          <ol className="mt-4 divide-y divide-line border-y border-line">
            {project.keyFeatures.map((feature, index) => (
              <li
                key={feature}
                data-reveal-note=""
                className="flex gap-4 py-3.5 text-[15px] leading-relaxed text-ink"
              >
                <span className="mt-[3px] shrink-0 font-mono text-[11px] tracking-[0.18em] text-ink-faint tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">{feature}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {project.technologies.length > 0 ? (
        <section data-reveal="" aria-labelledby={`project-stack-${project.id}`}>
          <h3 id={`project-stack-${project.id}`} className={EYEBROW}>
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
  )
}

/** The full write-up for one project: cover, description, numbered notes, stack, links. */
export function ProjectDialog({ project, open, onClose }: ProjectDialogProps) {
  if (!project) return null

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
            <Magnetic strength={0.25}>
              <ButtonLink href={project.githubUrl} variant="secondary" size="sm" data-cursor="Code">
                <GithubIcon className="size-3.5" />
                Source code
              </ButtonLink>
            </Magnetic>
          ) : null}
          {project.liveUrl ? (
            <Magnetic strength={0.25}>
              <ButtonLink
                href={project.liveUrl}
                variant="primary"
                size="sm"
                icon="Globe"
                data-cursor="Live"
              >
                Open live site
              </ButtonLink>
            </Magnetic>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <DialogBody key={project.id} project={project} />
    </Dialog>
  )
}
