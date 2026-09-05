import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, ISODate, Priority } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { TaskForm } from '@/components/tasks/TaskForm'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { durationLabel, formatDayLong } from '@/utils/date'
import { CAT_CLASSES, priorityTone, truncate } from '@/utils/format'

export interface QuickAddTaskProps {
  date: ISODate
  categories: Category[]
  /** Set by `?focus=task`, so a quick action from the overview lands typing. */
  autoFocus?: boolean
  className?: string
}

export interface ParsedQuickAdd {
  title: string
  priority?: Priority
  category?: Category
  estimatedMinutes?: number
  /** A `#token` that matched no category. Kept in the title and reported. */
  unmatchedCategory?: string
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  h: 'high',
  hi: 'high',
  high: 'high',
  urgent: 'high',
  p1: 'high',
  m: 'medium',
  med: 'medium',
  medium: 'medium',
  p2: 'medium',
  l: 'low',
  low: 'low',
  p3: 'low',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
}

const MAX_ESTIMATE_MINUTES = 1440

/** Lower-cased and stripped of punctuation, so `#system-design` finds "System Design". */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** `45`, `45m`, `1h`, `1h30`, `1h30m` and `1.5h` all mean what you would expect. */
function parseDurationToken(raw: string): number | undefined {
  const text = normalise(raw)
  if (text === '') return undefined

  const hoursAndMinutes = /^(\d+(?:\.\d+)?)h(?:([0-5]?\d)m?)?$/.exec(text)
  if (hoursAndMinutes) {
    const minutes =
      Number(hoursAndMinutes[1]) * 60 + (hoursAndMinutes[2] ? Number(hoursAndMinutes[2]) : 0)
    return Math.round(minutes)
  }

  const plainMinutes = /^(\d+(?:\.\d+)?)m?$/.exec(text)
  if (plainMinutes) return Math.round(Number(plainMinutes[1]))

  return undefined
}

/**
 * Pulls `!priority`, `#category` and `~duration` out of a typed line.
 *
 * A token is only removed from the title when it actually resolves to
 * something. An unrecognised `#token` stays in the title — silently deleting
 * text a person typed is far worse than ignoring a shorthand they got wrong.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function parseQuickAdd(input: string, categories: Category[]): ParsedQuickAdd {
  const words = input.split(/\s+/).filter((word) => word.length > 0)
  const kept: string[] = []

  let priority: Priority | undefined
  let category: Category | undefined
  let estimatedMinutes: number | undefined
  let unmatchedCategory: string | undefined

  for (const word of words) {
    const body = word.slice(1)

    if (word.startsWith('!') && body !== '') {
      const match = PRIORITY_TOKENS[normalise(body)]
      if (match) {
        priority = match
        continue
      }
    }

    if (word.startsWith('#') && body !== '') {
      const wanted = normalise(body)
      const found =
        categories.find(
          (item) => normalise(item.label) === wanted || normalise(item.id) === wanted,
        ) ??
        categories.find((item) => normalise(item.label).startsWith(wanted)) ??
        categories.find((item) => normalise(item.label).includes(wanted))

      if (found) {
        category = found
        continue
      }
      unmatchedCategory = body
    }

    if (word.startsWith('~') && body !== '') {
      const minutes = parseDurationToken(body)
      if (minutes !== undefined && minutes > 0 && minutes <= MAX_ESTIMATE_MINUTES) {
        estimatedMinutes = minutes
        continue
      }
    }

    kept.push(word)
  }

  return { title: kept.join(' ').trim(), priority, category, estimatedMinutes, unmatchedCategory }
}

/**
 * The fastest path into the day: type, press Enter, keep typing.
 *
 * The input keeps focus after every add so a morning plan is one uninterrupted
 * burst, and everything the shorthand understood is shown underneath before it
 * is committed — a parser you cannot see is a parser you cannot trust.
 */
export function QuickAddTask({
  date,
  categories,
  autoFocus = false,
  className,
}: QuickAddTaskProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()

  const [value, setValue] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = `quick-add-task-${useId()}`

  const parsed = useMemo(() => parseQuickAdd(value, categories), [value, categories])
  const hasHints =
    parsed.priority !== undefined ||
    parsed.category !== undefined ||
    parsed.estimatedMinutes !== undefined ||
    parsed.unmatchedCategory !== undefined

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (parsed.title === '') return

    const task = actions.addTask({
      date,
      title: parsed.title,
      categoryId: parsed.category?.id,
      priority: parsed.priority,
      estimatedMinutes: parsed.estimatedMinutes,
    })

    setValue('')
    inputRef.current?.focus()
    toast({
      title: 'Task added',
      description: truncate(task.title, 60),
      tone: 'positive',
      duration: 2500,
    })
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-2.5 shadow-subtle',
        className,
      )}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={inputId} className="sr-only">
          Add a task to this day
        </label>
        <Input
          ref={inputRef}
          id={inputId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Add a task and press Enter"
          autoComplete="off"
          enterKeyHint="done"
          className="flex-1"
        />
        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            icon="Plus"
            disabled={parsed.title === ''}
            className="flex-1 sm:flex-none"
          >
            Add
          </Button>
          <Button
            variant="secondary"
            size="icon"
            icon="SlidersHorizontal"
            aria-label="Add a task with all the options"
            onClick={() => setDialogOpen(true)}
          />
        </div>
      </form>

      <div
        aria-live="polite"
        className="mt-2 flex min-h-5 flex-wrap items-center gap-1.5 px-0.5 text-xs"
      >
        {hasHints ? (
          <>
            {parsed.priority ? (
              <Badge tone={priorityTone(parsed.priority)} size="sm">
                {PRIORITY_LABEL[parsed.priority]}
              </Badge>
            ) : null}

            {parsed.category ? (
              <span className="inline-flex items-center gap-1.5 text-ink-muted">
                <span
                  aria-hidden="true"
                  className={cn('size-2 rounded-full', CAT_CLASSES[parsed.category.color].bg)}
                />
                {parsed.category.label}
              </span>
            ) : null}

            {parsed.estimatedMinutes !== undefined ? (
              <span className="inline-flex items-center gap-1 font-mono text-ink-muted tabular-nums">
                <Icon name="Timer" size={12} />
                {durationLabel(parsed.estimatedMinutes)}
              </span>
            ) : null}

            {parsed.unmatchedCategory ? (
              <span className="text-warning">
                No category matches #{parsed.unmatchedCategory}
              </span>
            ) : null}
          </>
        ) : (
          <p className="font-mono text-[11px] text-ink-faint">
            !high · #category · ~45m
          </p>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="New task"
        description={formatDayLong(date)}
        size="md"
      >
        <TaskForm
          categories={categories}
          initial={{
            title: parsed.title,
            categoryId: parsed.category?.id,
            priority: parsed.priority,
            estimatedMinutes: parsed.estimatedMinutes,
          }}
          submitLabel="Add task"
          onSubmit={(draft) => {
            const task = actions.addTask({ date, ...draft })
            setDialogOpen(false)
            setValue('')
            toast({
              title: 'Task added',
              description: truncate(task.title, 60),
              tone: 'positive',
              duration: 2500,
            })
          }}
          onCancel={() => setDialogOpen(false)}
        />
      </Dialog>
    </div>
  )
}
