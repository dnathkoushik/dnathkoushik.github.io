import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CATEGORY_COLORS } from '@/services/defaults'
import type { Category, CategoryColor, PersonalDatabase } from '@/types'
import { CAT_CLASSES, pluralize } from '@/utils/format'
import { usePersonalData } from '@/providers/personalDataContext'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'

interface Usage {
  tasks: number
  logs: number
  goals: number
  habits: number
  total: number
}

function usageOf(db: PersonalDatabase, id: string): Usage {
  const tasks = db.tasks.filter((task) => task.categoryId === id).length
  const logs = db.logs.filter((entry) => entry.categoryId === id).length
  const goals =
    db.weeklyGoals.filter((goal) => goal.categoryId === id).length +
    db.monthlyGoals.filter((goal) => goal.categoryId === id).length
  const habits = db.habits.filter((habit) => habit.categoryId === id).length
  return { tasks, logs, goals, habits, total: tasks + logs + goals + habits }
}

/** "12 tasks, 3 log entries and 1 habit" — only the parts that are non-zero. */
function usageSentence(usage: Usage): string {
  const parts: string[] = []
  if (usage.tasks) parts.push(pluralize(usage.tasks, 'task'))
  if (usage.logs) parts.push(pluralize(usage.logs, 'log entry', 'log entries'))
  if (usage.goals) parts.push(pluralize(usage.goals, 'goal'))
  if (usage.habits) parts.push(pluralize(usage.habits, 'habit'))
  if (parts.length === 0) return 'nothing'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * Categories are the spine of every chart on the dashboard, so this is a real
 * editor rather than a settings afterthought: rename in place, recolour from
 * the eight palette tokens, archive what you have stopped using, and delete
 * only what nothing points at.
 */
export function CategoryManager() {
  const { db, actions } = usePersonalData()
  const { toast } = useToast()

  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [paletteFor, setPaletteFor] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [addError, setAddError] = useState<string | undefined>(undefined)

  const usage = useMemo(() => {
    const map = new Map<string, Usage>()
    for (const category of db.categories) map.set(category.id, usageOf(db, category.id))
    return map
  }, [db])

  function commitLabel(category: Category) {
    const draft = drafts[category.id]
    setDrafts((current) => {
      const next = { ...current }
      delete next[category.id]
      return next
    })
    if (draft === undefined) return

    const label = draft.trim()
    if (!label || label === category.label) return
    actions.updateCategory(category.id, { label })
    toast({ title: 'Category renamed', description: `“${category.label}” is now “${label}”.` })
  }

  function setColor(category: Category, color: CategoryColor) {
    actions.updateCategory(category.id, { color })
    setPaletteFor(null)
  }

  function toggleArchived(category: Category) {
    const archived = !category.archived
    actions.updateCategory(category.id, { archived })
    toast({
      title: archived ? 'Category archived' : 'Category restored',
      description: archived
        ? `“${category.label}” stays on old records but is out of the pickers.`
        : `“${category.label}” is selectable again.`,
      tone: archived ? 'neutral' : 'positive',
    })
  }

  function requestDelete(category: Category) {
    const used = usage.get(category.id)
    if (used && used.total > 0) {
      toast({
        title: `“${category.label}” is still in use`,
        description: `${usageSentence(used)} still reference it. Archive it instead, or move those records to another category first.`,
        tone: 'danger',
        duration: 8000,
      })
      return
    }
    if (db.categories.length <= 1) {
      toast({
        title: 'Keep at least one category',
        description: 'Every task, log entry and goal needs somewhere to live.',
        tone: 'warning',
      })
      return
    }
    setPendingDelete(category)
  }

  function confirmDelete() {
    const category = pendingDelete
    setPendingDelete(null)
    if (!category) return

    const removed = actions.deleteCategory(category.id)
    if (removed) {
      toast({ title: 'Category deleted', description: `“${category.label}” is gone.` })
    } else {
      const used = usage.get(category.id)
      toast({
        title: 'Could not delete that category',
        description: used && used.total > 0
          ? `${usageSentence(used)} still reference it.`
          : 'The database keeps at least one category at all times.',
        tone: 'danger',
      })
    }
  }

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) {
      setAddError('Give the category a name.')
      return
    }
    if (db.categories.some((category) => category.label.toLowerCase() === label.toLowerCase())) {
      setAddError('You already have a category with that name.')
      return
    }
    const created = actions.addCategory({ label })
    setNewLabel('')
    setAddError(undefined)
    toast({ title: 'Category added', description: `“${created.label}” is ready to use.` })
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-line rounded-card border border-line">
        {db.categories.map((category) => {
          const used = usage.get(category.id) ?? { tasks: 0, logs: 0, goals: 0, habits: 0, total: 0 }
          const open = paletteFor === category.id

          return (
            <li key={category.id} className="px-3 py-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPaletteFor(open ? null : category.id)}
                  aria-expanded={open}
                  aria-label={`Change the colour of ${category.label}`}
                  className={cn(
                    'grid size-9 shrink-0 place-items-center rounded-lg border transition-colors',
                    CAT_CLASSES[category.color].softBg,
                    CAT_CLASSES[category.color].border,
                    CAT_CLASSES[category.color].text,
                    'hover:bg-surface-hover',
                  )}
                >
                  <Icon name={category.icon ?? 'Dot'} size={16} />
                </button>

                <label className="sr-only" htmlFor={`category-${category.id}`}>
                  Name of the {category.label} category
                </label>
                <Input
                  id={`category-${category.id}`}
                  value={drafts[category.id] ?? category.label}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                  }
                  onBlur={() => commitLabel(category)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      event.currentTarget.blur()
                    }
                    if (event.key === 'Escape') {
                      setDrafts((current) => {
                        const next = { ...current }
                        delete next[category.id]
                        return next
                      })
                    }
                  }}
                  className="h-9"
                />

                {category.archived ? (
                  <Badge tone="neutral" size="sm" icon="Archive">
                    Archived
                  </Badge>
                ) : null}

                <span className="hidden w-24 shrink-0 text-right font-mono text-[11px] text-ink-faint tabular-nums sm:block">
                  {used.total > 0 ? `${used.total} records` : 'unused'}
                </span>

                <DropdownMenu
                  label={`Actions for ${category.label}`}
                  align="end"
                  items={[
                    {
                      id: 'colour',
                      label: open ? 'Hide colours' : 'Change colour',
                      icon: 'Palette',
                      onSelect: () => setPaletteFor(open ? null : category.id),
                    },
                    {
                      id: 'archive',
                      label: category.archived ? 'Restore' : 'Archive',
                      icon: category.archived ? 'ArchiveRestore' : 'Archive',
                      onSelect: () => toggleArchived(category),
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: 'Trash',
                      tone: 'danger',
                      onSelect: () => requestDelete(category),
                    },
                  ]}
                />
              </div>

              {open ? (
                <div
                  className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-surface-muted p-2.5"
                  aria-label={`Colour options for ${category.label}`}
                >
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setColor(category, color)}
                      aria-pressed={category.color === color}
                      aria-label={`Colour ${color}${category.color === color ? ' (current)' : ''}`}
                      className={cn(
                        'grid size-8 place-items-center rounded-lg transition-transform hover:scale-105',
                        CAT_CLASSES[color].bg,
                        category.color === color && 'ring-2 ring-ink ring-offset-2 ring-offset-surface-muted',
                      )}
                    >
                      {category.color === color ? (
                        <Icon name="Check" size={14} className="text-accent-ink" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              {used.total > 0 ? (
                <p className="mt-1.5 pl-11 text-[11px] text-ink-faint sm:hidden">
                  Used by {usageSentence(used)}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field
          label="Add a category"
          hint="A colour is picked from whichever palette token you use least."
          error={addError}
          className="flex-1"
        >
          <Input
            value={newLabel}
            onChange={(event) => {
              setNewLabel(event.target.value)
              if (addError) setAddError(undefined)
            }}
            placeholder="e.g. Open source"
            autoComplete="off"
          />
        </Field>
        <Button type="submit" variant="secondary" icon="Plus" className="sm:mb-0">
          Add
        </Button>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete “${pendingDelete?.label ?? ''}”?`}
        message="Nothing references this category, so removing it changes no records. You can add it back at any time."
        confirmLabel="Delete category"
        tone="danger"
      />
    </div>
  )
}
