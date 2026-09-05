import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { WeeklyTrendPoint } from '@/utils/analytics'
import { durationLabel } from '@/utils/date'
import { EmptyState } from '@/components/ui/EmptyState'

export interface TrendChartProps {
  /** Oldest week first — the newest week must be on the right. */
  points: WeeklyTrendPoint[]
  /**
   * Changes when the theme flips. Recharts resolves colours once at mount, so
   * the chart is keyed on this to force a re-render with the new tokens.
   */
  themeKey: string
}

const AXIS_TICK = { fill: 'var(--color-ink-faint)', fontSize: 11 }

function TrendTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  const point = payload[0].payload as WeeklyTrendPoint

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-overlay">
      <p className="font-mono text-[11px] font-medium text-ink">{point.label}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Completion</dt>
          <dd className="font-mono text-ink tabular-nums">{point.completionRate}%</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Tasks done</dt>
          <dd className="font-mono text-ink tabular-nums">
            {point.tasksCompleted}/{point.tasksTotal}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Logged</dt>
          <dd className="font-mono text-ink tabular-nums">{durationLabel(point.loggedMinutes)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Active days</dt>
          <dd className="font-mono text-ink tabular-nums">{point.activeDays}/7</dd>
        </div>
      </dl>
    </div>
  )
}

/** One sentence describing the whole series, for the chart's accessible name. */
function describe(points: WeeklyTrendPoint[]): string {
  const first = points[0]
  const last = points[points.length - 1]
  const direction =
    last.completionRate > first.completionRate
      ? 'rising'
      : last.completionRate < first.completionRate
        ? 'falling'
        : 'flat'

  return (
    `Weekly task completion rate and tasks completed, ${points.length} weeks from ` +
    `${first.label} to ${last.label}. Completion is ${direction}: ` +
    `${first.completionRate}% at the start, ${last.completionRate}% in the latest week.`
  )
}

/**
 * Week-over-week completion rate against the number of tasks actually finished.
 *
 * Both series are needed to read the picture honestly: a 100% completion rate
 * on two tasks is not a better week than 70% on twenty, and plotting the rate
 * alone would say it was.
 */
export function TrendChart({ points, themeKey }: TrendChartProps) {
  const hasData = points.some((point) => point.tasksTotal > 0 || point.loggedMinutes > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon="ChartLine"
        title="No weekly trend yet"
        description="Add tasks across a couple of weeks and the week-over-week shape shows up here."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div key={themeKey} className="h-64 w-full" role="img" aria-label={describe(points)}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line)' }}
              minTickGap={28}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="rate"
              domain={[0, 100]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              unit="%"
            />
            <YAxis
              yAxisId="tasks"
              orientation="right"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={32}
              allowDecimals={false}
            />
            <Tooltip content={TrendTooltip} cursor={{ stroke: 'var(--color-line-strong)' }} />
            <Area
              yAxisId="rate"
              type="monotone"
              dataKey="completionRate"
              name="Completion rate"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="var(--color-accent)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              yAxisId="tasks"
              type="monotone"
              dataKey="tasksCompleted"
              name="Tasks completed"
              stroke="var(--color-cat-2)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-accent" />
          Completion rate (left axis)
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-cat-2" />
          Tasks completed (right axis)
        </li>
      </ul>

      <details className="rounded-lg border border-line bg-surface-muted/40">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink">
          Show the weekly numbers
        </summary>
        <div className="max-h-64 overflow-auto border-t border-line">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Weekly completion rate, tasks completed and time logged
            </caption>
            <thead className="sticky top-0 bg-surface-muted text-ink-faint">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Week
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Done
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Rate
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Logged
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((point) => (
                <tr key={point.weekKey}>
                  <th scope="row" className="px-3 py-1.5 font-mono font-normal text-ink-muted">
                    {point.label}
                  </th>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {point.tasksCompleted}/{point.tasksTotal}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {point.completionRate}%
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {durationLabel(point.loggedMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
