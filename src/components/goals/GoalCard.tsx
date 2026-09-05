import type { AnyGoal, Category, Tone } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { Progress } from '@/components/ui/Progress'
import { cn } from '@/lib/cn'
import { goalProgress, isGoalReached } from '@/utils/analytics'
import { formatDayLong, relativeDay, todayISO } from '@/utils/date'
import { catClasses, goalStatusTone, priorityTone } from '@/utils/format'
import type { GoalPatch } from '@/components/goals/GoalProgressControl'
import { GoalProgressControl } from '@/components/goals/GoalProgressControl'

export interface GoalCardProps {
  goal: AnyGoal
  category?: Category
  onUpdate: (patch: GoalPatch) => void
  onEdit: () => void
  onDelete: () => void
  className?: string
}

const PRIORITY_LABEL = { high: 'High', medium: 'Medium', low: 'Low' } as const
const STATUS_LABEL = {
  active: 'Active',
  completed: 'Completed',
  missed: 'Missed',
  archived: 'Archived',
} as const

export function GoalCard({ goal, category, onUpdate, onEdit, onDelete, className }: GoalCardProps) {
  const progress = goalProgress(goal)
  const completed = isGoalReached(goal)
  const overdue = goal.deadline !== undefined && goal.deadline < todayISO() && !completed
  const swatch = catClasses(category?.color)

  const barTone: Tone = completed ? 'positive' : overdue ? 'danger' : 'accent'

  const menuItems: DropdownMenuItem[] = [
    { id: 'edit', label: 'Edit goal', icon: 'Pencil', onSelect: onEdit },
    completed
      ? {
          id: 'reopen',
          label: 'Mark as active',
          icon: 'Undo2',
          onSelect: () => onUpdate({ status: 'active' }),
        }
      : {
          id: 'missed',
          label: 'Mark as missed',
          icon: 'CircleX',
          onSelect: () => onUpdate({ status: 'missed' }),
        },
    {
      id: 'archive',
      label: 'Archive goal',
      icon: 'Archive',
      onSelect: () => onUpdate({ status: 'archived' }),
      disabled: goal.status === 'archived',
    },
    { id: 'delete', label: 'Delete goal', icon: 'Trash', tone: 'danger', onSelect: onDelete },
  ]

  return (
    <Card
      className={cn('animate-rise', goal.status === 'archived' && 'opacity-70', className)}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-full', swatch.bg)}
              />
              <span className="font-mono text-[11px] tracking-wide text-ink-faint uppercase">
                {category?.label ?? 'Uncategorised'}
              </span>
              <Badge tone={priorityTone(goal.priority)} size="sm">
                {PRIORITY_LABEL[goal.priority]}
              </Badge>
              {goal.status !== 'active' ? (
                <Badge tone={goalStatusTone(goal.status)} size="sm">
                  {STATUS_LABEL[goal.status]}
                </Badge>
              ) : null}
            </div>

            <h3
              className={cn(
                'mt-2 text-[15px] leading-snug font-semibold text-balance text-ink',
                completed && 'line-through decoration-ink-faint',
              )}
            >
              {goal.title}
            </h3>

            {goal.description ? (
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">{goal.description}</p>
            ) : null}
          </div>

          <DropdownMenu
            items={menuItems}
            label={`Actions for ${goal.title}`}
            className="-mt-1 -mr-1 shrink-0"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-sm font-medium text-ink tabular-nums">
              {goal.currentValue}
              <span className="text-ink-faint"> / {goal.targetValue}</span>
              {goal.unit ? <span className="ml-1 text-ink-muted">{goal.unit}</span> : null}
            </p>
            <p className="font-mono text-xs text-ink-faint tabular-nums">{progress}%</p>
          </div>

          {/*
            The bar is named after the goal so a screen reader hears
            "Progress on Solve 30 graph problems, 45%" rather than a bare
            "Progress". Its own caption row is visually hidden because the
            numbers above already say the same thing on screen.
          */}
          <Progress
            value={progress}
            tone={barTone}
            label={`Progress on ${goal.title}`}
            className="[&>div:first-child]:sr-only"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <GoalProgressControl goal={goal} onUpdate={onUpdate} />

          {goal.deadline ? (
            <p
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-medium',
                overdue ? 'text-danger' : 'text-ink-faint',
              )}
            >
              <Icon name={overdue ? 'TriangleAlert' : 'CalendarClock'} className="size-3.5" />
              <time dateTime={goal.deadline} title={formatDayLong(goal.deadline)}>
                {overdue ? `Overdue — ${relativeDay(goal.deadline)}` : relativeDay(goal.deadline)}
              </time>
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
