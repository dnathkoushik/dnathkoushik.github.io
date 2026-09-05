import { useId, useMemo, useState } from 'react'
import type { Category, ISODate, Task, TaskStatus } from '@/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { TaskForm } from '@/components/tasks/TaskForm'
import type { TaskDraft } from '@/components/tasks/TaskForm'
import { TaskRow } from '@/components/tasks/TaskRow'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { formatDayLong } from '@/utils/date'
import { truncate } from '@/utils/format'

export interface TaskListProps {
  date: ISODate
  tasks: Task[]
  categories: Category[]
  className?: string
}

/**
 * Display order of the status groups. Unfinished work sits above finished work,
 * so the list always opens on what is left rather than on what is done.
 */
const GROUPS: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'in-progress', label: 'In progress', icon: 'Play' },
  { status: 'not-started', label: 'To do', icon: 'Circle' },
  { status: 'completed', label: 'Completed', icon: 'CircleCheckBig' },
  { status: 'skipped', label: 'Skipped', icon: 'CircleMinus' },
]

const STATUS_TOAST: Record<TaskStatus, string> = {
  'not-started': 'Task reopened',
  'in-progress': 'Task started',
  completed: 'Task completed',
  skipped: 'Task skipped',
}

const STATUS_TONE = {
  'not-started': 'neutral',
  'in-progress': 'accent',
  completed: 'positive',
  skipped: 'warning',
} as const

/**
 * The day's tasks, grouped by status.
 *
 * Ordering is deliberately two-layered: the groups impose "unfinished first",
 * and inside a group the owner's own manual order is preserved. Moving a task
 * swaps it with its neighbour *in the same group* and then writes back the full
 * day order, so completing something never scrambles the sequence you set.
 */
export function TaskList({ date, tasks, categories, className }: TaskListProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const baseId = useId()

  const [editing, setEditing] = useState<Task | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null)

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>()
    for (const category of categories) map.set(category.id, category)
    return map
  }, [categories])

  const ordered = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt),
      ),
    [tasks],
  )

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        items: ordered.filter((task) => task.status === group.status),
      })).filter((group) => group.items.length > 0),
    [ordered],
  )

  function handleStatusChange(task: Task, status: TaskStatus) {
    if (task.status === status) return
    const previous = task.status
    actions.setTaskStatus(task.id, status)
    toast({
      title: STATUS_TOAST[status],
      description: truncate(task.title, 60),
      tone: STATUS_TONE[status],
      duration: 3000,
      action: {
        label: 'Undo',
        onClick: () => actions.setTaskStatus(task.id, previous),
      },
    })
  }

  function handleMove(task: Task, direction: -1 | 1) {
    const siblings = ordered.filter((candidate) => candidate.status === task.status)
    const index = siblings.findIndex((candidate) => candidate.id === task.id)
    const target = siblings[index + direction]
    if (!target) return

    const ids = ordered.map((candidate) => candidate.id)
    const from = ids.indexOf(task.id)
    const to = ids.indexOf(target.id)
    ids[from] = target.id
    ids[to] = task.id

    actions.reorderTasks(date, ids)
    toast({
      title: direction === -1 ? 'Moved up' : 'Moved down',
      description: truncate(task.title, 60),
      duration: 1600,
    })
  }

  function handleDuplicate(task: Task) {
    const copy = actions.addTask({
      date: task.date,
      title: `${task.title} (copy)`,
      description: task.description,
      categoryId: task.categoryId,
      priority: task.priority,
      estimatedMinutes: task.estimatedMinutes,
      notes: task.notes,
    })
    toast({
      title: 'Task duplicated',
      description: truncate(copy.title, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  function handleDelete(task: Task) {
    setPendingDelete(null)
    actions.deleteTask(task.id)
    toast({
      title: 'Task deleted',
      description: truncate(task.title, 60),
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          actions.addTask({
            date: task.date,
            title: task.title,
            description: task.description,
            categoryId: task.categoryId,
            priority: task.priority,
            status: task.status,
            estimatedMinutes: task.estimatedMinutes,
            actualMinutes: task.actualMinutes,
            notes: task.notes,
            order: task.order,
          })
          toast({ title: 'Task restored', tone: 'positive', duration: 2000 })
        },
      },
    })
  }

  function handleEditSubmit(task: Task, draft: TaskDraft) {
    setEditing(null)
    actions.updateTask(task.id, draft)
    toast({
      title: 'Task updated',
      description: truncate(draft.title, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon="ListTodo"
        title="Nothing planned for this day yet"
        description="Type a title in the box and press Enter. Add !high, #category or ~45m as you type and they are pulled out of the title for you."
        className={className}
      />
    )
  }

  return (
    <div className={cn('space-y-5', className)}>
      {groups.map((group) => {
        const headingId = `${baseId}-${group.status}`
        return (
          <section key={group.status} aria-labelledby={headingId}>
            <div className="mb-2 flex items-center gap-2">
              <Icon name={group.icon} size={13} className="text-ink-faint" />
              <h3
                id={headingId}
                className="text-xs font-semibold tracking-wide text-ink-muted uppercase"
              >
                {group.label}
              </h3>
              <span className="font-mono text-xs text-ink-faint tabular-nums">
                {group.items.length}
              </span>
            </div>

            <ul className="space-y-2">
              {group.items.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  category={categoryById.get(task.categoryId)}
                  canMoveUp={index > 0}
                  canMoveDown={index < group.items.length - 1}
                  onStatusChange={(status) => handleStatusChange(task, status)}
                  onEdit={() => setEditing(task)}
                  onDuplicate={() => handleDuplicate(task)}
                  onDelete={() => setPendingDelete(task)}
                  onMove={(direction) => handleMove(task, direction)}
                />
              ))}
            </ul>
          </section>
        )
      })}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit task"
        description={formatDayLong(date)}
        size="md"
      >
        {editing ? (
          <TaskForm
            categories={categories}
            initial={{
              title: editing.title,
              description: editing.description,
              categoryId: editing.categoryId,
              priority: editing.priority,
              status: editing.status,
              estimatedMinutes: editing.estimatedMinutes,
              actualMinutes: editing.actualMinutes,
              notes: editing.notes,
            }}
            submitLabel="Save changes"
            onSubmit={(draft) => handleEditSubmit(editing, draft)}
            onCancel={() => setEditing(null)}
          />
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) handleDelete(pendingDelete)
        }}
        title="Delete this task?"
        message={
          pendingDelete
            ? `“${truncate(pendingDelete.title, 80)}” will be removed from this day. You can undo it from the notification that follows.`
            : ''
        }
        confirmLabel="Delete task"
        tone="danger"
      />
    </div>
  )
}
