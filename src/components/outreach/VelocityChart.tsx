import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useTheme } from '@/providers/ThemeProvider'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { todayISO, weekKeyOf } from '@/utils/date'
import { catVar } from '@/utils/format'
import { outreachVelocity } from '@/utils/outreach'
import type { VelocityPoint } from '@/utils/outreach'

export interface VelocityChartProps {
  /** How many weeks to show, ending with the current one. */
  weeks?: number
  className?: string
}

const AXIS_TICK = { fill: 'var(--color-ink-faint)', fontSize: 11 }
const REPLY_COLOR = catVar(2)

function VelocityTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  const point = payload[0].payload as VelocityPoint

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-overlay">
      <p className="font-mono text-[11px] font-medium text-ink">{point.label}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Outbound</dt>
          <dd className="font-mono text-ink tabular-nums">{point.outbound}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Replies</dt>
          <dd className="font-mono text-ink tabular-nums">{point.replies}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">All inbound</dt>
          <dd className="font-mono text-ink tabular-nums">{point.inbound}</dd>
        </div>
      </dl>
    </div>
  )
}

/** One sentence for the chart's accessible name. */
function describe(points: VelocityPoint[], target: number): string {
  const first = points[0]
  const last = points[points.length - 1]
  const outbound = points.reduce((sum, point) => sum + point.outbound, 0)
  const replies = points.reduce((sum, point) => sum + point.replies, 0)
  const targetNote = target > 0 ? ` against a weekly target of ${target}` : ''
  return (
    `Outbound touches and replies per week, ${points.length} weeks from ${first.label} to ` +
    `${last.label}. ${outbound} outbound and ${replies} replies in total. The latest week ` +
    `has ${last.outbound} outbound and ${last.replies} replies${targetNote}.`
  )
}

/**
 * Outbound touches against replies, week by week.
 *
 * Both series share one axis because they are the same unit — a count of
 * touches — which is what makes the gap between the bars readable as a rate.
 * The dashed line is the weekly target from Outreach settings, never a
 * hard-coded number. Recharts resolves CSS colours once at mount, so the chart
 * is keyed on the resolved theme and redraws when it flips.
 */
export function VelocityChart({ weeks = 8, className }: VelocityChartProps) {
  const { db } = usePersonalData()
  const { resolved } = useTheme()
  const weekStartsOn = db.settings.weekStartsOn
  const target = db.outreach.weeklyTarget
  const today = todayISO()

  const points = useMemo(
    () => outreachVelocity(db, weekKeyOf(today, weekStartsOn), weeks, weekStartsOn),
    [db, today, weekStartsOn, weeks],
  )
  const hasData = points.some((point) => point.outbound > 0 || point.inbound > 0)
  const peak = Math.max(target, ...points.map((point) => Math.max(point.outbound, point.replies)))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle as="h2">Velocity</CardTitle>
        <CardDescription>
          Outbound touches against replies, the last {weeks} weeks.
          {target > 0 ? ` The dashed line is your target of ${target} a week.` : ''}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {!hasData ? (
          <EmptyState
            icon="ChartColumn"
            title="Nothing sent yet"
            description="Log your first outbound touch and the weekly rhythm starts drawing itself."
            className="py-8"
          />
        ) : (
          <>
            <div
              key={resolved}
              className="h-56 w-full"
              role="img"
              aria-label={describe(points, target)}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={points}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                  barCategoryGap="28%"
                  barGap={2}
                  accessibilityLayer={false}
                >
                  <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-line)' }}
                    minTickGap={20}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    allowDecimals={false}
                    domain={[0, Math.max(1, peak)]}
                  />
                  <Tooltip
                    content={VelocityTooltip}
                    cursor={{ fill: 'var(--color-surface-hover)' }}
                  />
                  {target > 0 ? (
                    <ReferenceLine
                      y={target}
                      stroke="var(--color-ink-faint)"
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                    />
                  ) : null}
                  <Bar
                    dataKey="outbound"
                    name="Outbound"
                    fill="var(--color-accent)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="replies"
                    name="Replies"
                    fill={REPLY_COLOR}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
                Outbound
              </li>
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-cat-2" />
                Replies
              </li>
              {target > 0 ? (
                <li className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className="h-0 w-4 border-t border-dashed border-ink-faint"
                  />
                  Weekly target ({target})
                </li>
              ) : null}
            </ul>

            <details className="rounded-lg border border-line bg-surface-muted/40">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink">
                Show the weekly numbers
              </summary>
              <div className="max-h-64 overflow-auto border-t border-line">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Outbound touches, inbound touches and replies per week
                  </caption>
                  <thead className="sticky top-0 bg-surface-muted text-ink-faint">
                    <tr>
                      <th scope="col" className="px-3 py-1.5 font-medium">
                        Week
                      </th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">
                        Outbound
                      </th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">
                        Inbound
                      </th>
                      <th scope="col" className="px-3 py-1.5 text-right font-medium">
                        Replies
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {[...points].reverse().map((point) => (
                      <tr key={point.weekKey}>
                        <th scope="row" className="px-3 py-1.5 font-mono font-normal text-ink-muted">
                          {point.label}
                        </th>
                        <td
                          className={cn(
                            'px-3 py-1.5 text-right font-mono tabular-nums',
                            target > 0 && point.outbound >= target ? 'text-positive' : 'text-ink',
                          )}
                        >
                          {point.outbound}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                          {point.inbound}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                          {point.replies}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  )
}
