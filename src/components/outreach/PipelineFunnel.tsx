import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Tone } from '@/types'
import { PERSONAL_ROUTES } from '@/config/routes'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { STAGE_META, funnel } from '@/utils/outreach'

export interface PipelineFunnelProps {
  className?: string
}

/** Solid fill per tone. Mirrors `Progress` so a funnel bar and a progress bar match. */
const BAR_FILL: Record<Tone, string> = {
  neutral: 'bg-ink-faint',
  accent: 'bg-accent',
  positive: 'bg-positive',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

/**
 * How many opportunities sit at each stage, as one horizontal bar per stage.
 *
 * Every row is a real link into the pipeline filtered to that stage, so the
 * chart is also the navigation. Closed stages are summarised underneath rather
 * than drawn as bars: they are outcomes, not work in progress, and a tall
 * "Rejected" bar would dominate a picture that is meant to show what is live.
 */
export function PipelineFunnel({ className }: PipelineFunnelProps) {
  const { db } = usePersonalData()
  const steps = useMemo(() => funnel(db), [db])

  const openSteps = steps.filter((step) => !STAGE_META[step.stage].terminal)
  const closedSteps = steps.filter((step) => STAGE_META[step.stage].terminal && step.count > 0)
  const openTotal = openSteps.reduce((sum, step) => sum + step.count, 0)
  const max = Math.max(1, ...openSteps.map((step) => step.count))

  return (
    <Card className={className}>
      <CardHeader
        actions={
          openTotal > 0 ? (
            <Badge tone="accent">{openTotal} open</Badge>
          ) : undefined
        }
      >
        <CardTitle as="h2">Pipeline</CardTitle>
        <CardDescription>Where every open opportunity sits. Click a stage to see them.</CardDescription>
      </CardHeader>

      <CardContent>
        {db.opportunities.length === 0 ? (
          <EmptyState
            icon="Funnel"
            title="No opportunities yet"
            description="Add a role at one of your companies and it shows up here at Researching."
            action={
              <ButtonLink to={PERSONAL_ROUTES.outreachPipeline} variant="secondary" icon="Funnel">
                Open the pipeline
              </ButtonLink>
            }
            className="py-8"
          />
        ) : (
          <>
            <ol className="space-y-1">
              {openSteps.map((step) => {
                const meta = STAGE_META[step.stage]
                const pct = Math.round((step.count / max) * 100)
                return (
                  <li key={step.stage}>
                    <Link
                      to={`${PERSONAL_ROUTES.outreachPipeline}?stage=${step.stage}`}
                      className="group -mx-2 flex min-h-9 items-center gap-3 rounded-lg px-2 py-1 outline-accent transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span className="w-24 shrink-0 truncate text-xs font-medium text-ink-muted transition-colors group-hover:text-ink">
                        {meta.label}
                      </span>
                      <span
                        aria-hidden="true"
                        className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
                      >
                        <span
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out',
                            step.count > 0 ? BAR_FILL[meta.tone] : 'bg-transparent',
                          )}
                          style={{ width: `${step.count > 0 ? Math.max(pct, 4) : 0}%` }}
                        />
                      </span>
                      <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-ink">
                        {step.count}
                        <span className="sr-only"> {step.count === 1 ? 'opportunity' : 'opportunities'}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>

            {closedSteps.length > 0 ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-ink-faint">
                <span>Closed</span>
                {closedSteps.map((step) => (
                  <Link
                    key={step.stage}
                    to={`${PERSONAL_ROUTES.outreachPipeline}?stage=${step.stage}&closed=1`}
                    className="inline-flex min-h-6 items-center gap-1 rounded-md text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                  >
                    {STAGE_META[step.stage].label}
                    <span className="font-mono tabular-nums">{step.count}</span>
                  </Link>
                ))}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
