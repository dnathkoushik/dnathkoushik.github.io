import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { DailyMinutesPoint } from '@/utils/analytics'
import { durationLabel, formatDayLong } from '@/utils/date'
import { EmptyState } from '@/components/ui/EmptyState'

export interface ScoreChartProps {
  /** One point per day in the range, oldest first. */
  points: DailyMinutesPoint[]
  /** Changes when the theme flips, forcing Recharts to re-read the tokens. */
  themeKey: string
}

const AXIS_TICK = { fill: 'var(--color-ink-faint)', fontSize: 11 }

/**
 * Bars earn their weight: a strong day reads as full accent, a weak one
 * recedes. Opacity rather than a mixed colour, so the ramp holds up against
 * both the light and the dark canvas without a second palette.
 */
function barOpacity(score: number): number {
  if (score >= 75) return 1
  if (score >= 50) return 0.7
  if (score > 0) return 0.4
  return 0.1
}

function ScoreTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  const point = payload[0].payload as DailyMinutesPoint

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-overlay">
      <p className="font-mono text-[11px] font-medium text-ink">{formatDayLong(point.date)}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Score</dt>
          <dd className="font-mono text-ink tabular-nums">{point.score}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Logged</dt>
          <dd className="font-mono text-ink tabular-nums">{durationLabel(point.minutes)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Tasks done</dt>
          <dd className="font-mono text-ink tabular-nums">{point.tasksCompleted}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * The daily productivity score across the selected range.
 *
 * Days with nothing recorded are drawn as an empty slot rather than dropped, so
 * the gaps in a week are as visible as the peaks — which is the only reason to
 * look at this chart rather than at the average.
 */
export function ScoreChart({ points, themeKey }: ScoreChartProps) {
  const scored = points.filter((point) => point.score > 0)

  if (scored.length === 0) {
    return (
      <EmptyState
        icon="ChartColumn"
        title="No scored days in this range"
        description="A day gets a score once it has a task, a work-log entry or a habit on it."
      />
    )
  }

  const best = scored.reduce((top, point) => (point.score > top.score ? point : top), scored[0])
  const average = Math.round(scored.reduce((sum, point) => sum + point.score, 0) / scored.length)
  const label =
    `Daily productivity score for ${points.length} days. ` +
    `${scored.length} days scored, averaging ${average} out of 100. ` +
    `Best day ${formatDayLong(best.date)} at ${best.score}.`

  return (
    <div className="space-y-3">
      <div key={themeKey} className="h-56 w-full" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
              domain={[0, 100]}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              content={ScoreTooltip}
              cursor={{ fill: 'var(--color-surface-hover)', fillOpacity: 0.6 }}
            />
            <Bar dataKey="score" name="Productivity score" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {points.map((point) => (
                <Cell
                  key={point.date}
                  fill="var(--color-accent)"
                  fillOpacity={barOpacity(point.score)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-surface-muted px-3 py-2">
          <dt className="text-[11px] text-ink-faint">Average score</dt>
          <dd className="font-mono text-sm font-medium text-ink tabular-nums">{average}/100</dd>
        </div>
        <div className="rounded-lg bg-surface-muted px-3 py-2">
          <dt className="text-[11px] text-ink-faint">Days scored</dt>
          <dd className="font-mono text-sm font-medium text-ink tabular-nums">
            {scored.length}/{points.length}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-surface-muted px-3 py-2 sm:col-span-1">
          <dt className="text-[11px] text-ink-faint">Best day</dt>
          <dd className="font-mono text-sm font-medium text-ink tabular-nums">
            {best.label} · {best.score}
          </dd>
        </div>
      </dl>

      <details className="rounded-lg border border-line bg-surface-muted/40">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink">
          Show the daily numbers
        </summary>
        <div className="max-h-64 overflow-auto border-t border-line">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              Productivity score, time logged and tasks completed for each day in the range
            </caption>
            <thead className="sticky top-0 bg-surface-muted text-ink-faint">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">
                  Day
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Score
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Logged
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium">
                  Tasks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...points].reverse().map((point) => (
                <tr key={point.date}>
                  <th scope="row" className="px-3 py-1.5 font-mono font-normal text-ink-muted">
                    <time dateTime={point.date}>{point.label}</time>
                  </th>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {point.score}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {durationLabel(point.minutes)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                    {point.tasksCompleted}
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
