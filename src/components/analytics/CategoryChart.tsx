import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TooltipContentProps } from 'recharts'
import type { CategoryBreakdownItem } from '@/utils/analytics'
import { durationLabel } from '@/utils/date'
import { CAT_CLASSES, catVar, truncate } from '@/utils/format'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'

export interface CategoryChartProps {
  items: CategoryBreakdownItem[]
  /** Changes when the theme flips, forcing Recharts to re-read the tokens. */
  themeKey: string
}

const AXIS_TICK = { fill: 'var(--color-ink-faint)', fontSize: 11 }

function CategoryTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null
  const item = payload[0].payload as CategoryBreakdownItem

  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-overlay">
      <p className="text-[11px] font-medium text-ink">{item.label}</p>
      <dl className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Logged</dt>
          <dd className="font-mono text-ink tabular-nums">{durationLabel(item.minutes)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Share</dt>
          <dd className="font-mono text-ink tabular-nums">{item.share}%</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-muted">Tasks</dt>
          <dd className="font-mono text-ink tabular-nums">
            {item.tasksCompleted}/{item.tasksTotal}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * Where the logged hours actually went, as a horizontal bar chart.
 *
 * Deliberately not a pie: the values here are exact minutes, and comparing bar
 * lengths against a shared baseline is far easier than comparing wedge angles —
 * especially once two categories land within a few percent of each other.
 */
export function CategoryChart({ items, themeKey }: CategoryChartProps) {
  const charted = items.filter((item) => item.minutes > 0)

  if (charted.length === 0) {
    return (
      <EmptyState
        icon="ChartNoAxesColumn"
        title="Nothing logged in this range"
        description="Work-log entries carry the category, so the split appears once you log some time."
      />
    )
  }

  const totalMinutes = charted.reduce((sum, item) => sum + item.minutes, 0)
  const label =
    `Time logged by category over the range, total ${durationLabel(totalMinutes)}. ` +
    charted
      .map((item) => `${item.label} ${durationLabel(item.minutes)}, ${item.share} percent`)
      .join('. ')

  return (
    <div className="space-y-3">
      <div
        key={themeKey}
        role="img"
        aria-label={label}
        className="w-full"
        style={{ height: Math.max(160, charted.length * 38 + 32) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={charted}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-line)' }}
              tickFormatter={(value: number) => durationLabel(value)}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={96}
              tickFormatter={(value: string) => truncate(value, 14)}
            />
            <Tooltip
              content={CategoryTooltip}
              cursor={{ fill: 'var(--color-surface-hover)', fillOpacity: 0.6 }}
            />
            <Bar dataKey="minutes" name="Minutes logged" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {charted.map((item) => (
                <Cell key={item.categoryId} fill={catVar(item.color)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-xs">
          <caption className="sr-only">Time logged and tasks completed per category</caption>
          <thead className="text-ink-faint">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Category
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">
                Logged
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">
                Share
              </th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">
                Tasks
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.categoryId}>
                <th scope="row" className="py-1.5 pr-3 font-normal text-ink">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn('size-2 shrink-0 rounded-full', CAT_CLASSES[item.color].bg)}
                    />
                    {item.label}
                  </span>
                </th>
                <td className="px-3 py-1.5 text-right font-mono text-ink tabular-nums">
                  {durationLabel(item.minutes)}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-ink-muted tabular-nums">
                  {item.share}%
                </td>
                <td className="py-1.5 pl-3 text-right font-mono text-ink-muted tabular-nums">
                  {item.tasksCompleted}/{item.tasksTotal}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong">
              <th scope="row" className="py-1.5 pr-3 font-medium text-ink">
                Total
              </th>
              <td className="px-3 py-1.5 text-right font-mono font-medium text-ink tabular-nums">
                {durationLabel(totalMinutes)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-ink-faint tabular-nums">100%</td>
              <td className="py-1.5 pl-3 text-right font-mono font-medium text-ink tabular-nums">
                {items.reduce((sum, item) => sum + item.tasksCompleted, 0)}/
                {items.reduce((sum, item) => sum + item.tasksTotal, 0)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
