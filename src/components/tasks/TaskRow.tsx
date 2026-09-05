import type { Category, Priority, Task, TaskStatus } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import type { DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'
import { durationLabel } from '@/utils/date'
import { CAT_CLASSES, priorityTone } from '@/utils/format'

export interface TaskRowProps {
  task: Task
  category?: Category
  canMoveUp: boolean
  canMoveDown: boolean
  onStatusChange: (status: TaskStatus) => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (direction: -1 | 1) => void
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/**
 * One task.
 *
 * Reordering is done with buttons rather than drag-and-drop: buttons work with
 * a keyboard, work with a screen reader, and — the part that actually decides
 * it — work with a thumb on a phone, which HTML5 drag never has. The arrows are
 * shown from `sm` up and the same two moves live in the menu at every width, so
 * the capability is never touch-only or pointer-only.
 */
export function TaskRow({
  task,
  category,
  canMoveUp,
  canMoveDown,
  onStatusChange,
  onEdit,
  onDuplicate,
  onDelete,
  onMove,
}: TaskRowProps) {
  const done = task.status === 'completed'
  const skipped = task.status === 'skipped'
  const catClass = CAT_CLASSES[category?.color ?? 1]

  const menuItems: DropdownMenuItem[] = [
    { id: 'edit', label: 'Edit task', icon: 'Pencil', onSelect: onEdit },
    {
      id: 'start',
      label: 'Start now',
      icon: 'Play',
      disabled: task.status === 'in-progress' || done,
      onSelect: () => onStatusChange('in-progress'),
    },
    {
      id: 'complete',
      label: 'Mark complete',
      icon: 'CircleCheckBig',
      disabled: done,
      onSelect: () => onStatusChange('completed'),
    },
    {
      id: 'skip',
      label: 'Skip for today',
      icon: 'CircleMinus',
      disabled: skipped,
      onSelect: () => onStatusChange('skipped'),
    },
    {
      id: 'move-up',
      label: 'Move up',
      icon: 'ArrowUp',
      disabled: !canMoveUp,
      onSelect: () => onMove(-1),
    },
    {
      id: 'move-down',
      label: 'Move down',
      icon: 'ArrowDown',
      disabled: !canMoveDown,
      onSelect: () => onMove(1),
    },
    { id: 'duplicate', label: 'Duplicate', icon: 'Copy', onSelect: onDuplicate },
    { id: 'delete', label: 'Delete', icon: 'Trash', tone: 'danger', onSelect: onDelete },
  ]

  return (
    <li
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 transition-colors duration-150',
        done || skipped
          ? 'border-transparent bg-surface-muted/60'
          : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={(next) => onStatusChange(next ? 'completed' : 'not-started')}
        ariaLabel={
          done ? `Reopen task: ${task.title}` : `Mark task complete: ${task.title}`
        }
        className="pt-0.5"
      />

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            'rounded-sm text-left text-sm font-medium transition-colors duration-150',
            done ? 'text-ink-faint line-through' : 'text-ink hover:text-accent',
            skipped && 'text-ink-faint',
          )}
        >
          {task.title}
          <span className="sr-only"> — open the task editor</span>
        </button>

        {task.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {task.description}
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-2 rounded-full', catClass.bg)} />
            {category?.label ?? 'Uncategorised'}
          </span>

          <Badge tone={priorityTone(task.priority)} size="sm">
            {PRIORITY_LABEL[task.priority]}
          </Badge>

          {task.status === 'in-progress' ? (
            <Badge tone="accent" size="sm" icon="Play">
              In progress
            </Badge>
          ) : null}

          {skipped ? (
            <Badge tone="neutral" size="sm" icon="CircleMinus">
              Skipped
            </Badge>
          ) : null}

          {task.estimatedMinutes !== undefined ? (
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              <Icon name="Timer" size={12} />
              {durationLabel(task.estimatedMinutes)}
              <span className="sr-only"> estimated</span>
            </span>
          ) : null}

          {task.actualMinutes !== undefined ? (
            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-ink-faint">
              <Icon name="Hourglass" size={12} />
              {durationLabel(task.actualMinutes)}
              <span className="sr-only"> actually spent</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <div className="hidden sm:flex sm:flex-col">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            aria-label={`Move up: ${task.title}`}
            className="inline-flex size-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <Icon name="ChevronUp" size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            aria-label={`Move down: ${task.title}`}
            className="inline-flex size-6 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          >
            <Icon name="ChevronDown" size={14} />
          </button>
        </div>

        {task.status === 'not-started' ? (
          <Button
            variant="ghost"
            size="icon"
            icon="Play"
            aria-label={`Start now: ${task.title}`}
            onClick={() => onStatusChange('in-progress')}
            className="hidden sm:inline-flex"
          />
        ) : null}

        <DropdownMenu items={menuItems} label={`Actions for task: ${task.title}`} />
      </div>
    </li>
  )
}
