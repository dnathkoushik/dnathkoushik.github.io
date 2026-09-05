import { useId } from 'react'
import type { ChangeEvent } from 'react'
import type { ISODate } from '@/types'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { cn } from '@/lib/cn'
import { formatDayLong, isToday, relativeDay, shiftDay, todayISO } from '@/utils/date'

export interface DayNavigatorProps {
  date: ISODate
  onChange: (next: ISODate) => void
  className?: string
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Moves the day workspace between calendar days.
 *
 * Nothing here is ever disabled: a plan is written in the future and reviewed in
 * the past, so both directions stay open. The left and right arrow keys move a
 * day as long as focus is not inside a field — `useKeyboardShortcut` suppresses
 * bare keys while typing, which is what keeps arrowing through a task title
 * from silently changing the day underneath it.
 */
export function DayNavigator({ date, onChange, className }: DayNavigatorProps) {
  const inputId = `day-jump-${useId()}`
  const viewingToday = isToday(date)

  useKeyboardShortcut('left', () => {
    onChange(shiftDay(date, -1))
  })
  useKeyboardShortcut('right', () => {
    onChange(shiftDay(date, 1))
  })

  function handleJump(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    // An empty or half-typed value fires change events too; ignore those.
    if (ISO_DATE_RE.test(next)) onChange(next)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-card border border-line bg-surface p-3 shadow-subtle',
        'sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-xl',
            viewingToday ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-ink-faint',
          )}
        >
          <Icon name="CalendarDays" size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-ink">
            <time dateTime={date}>{formatDayLong(date)}</time>
          </p>
          <p className="font-mono text-xs text-ink-faint tabular-nums">
            {relativeDay(date)} · {date}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div role="group" aria-label="Change day" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            icon="ChevronLeft"
            aria-label="Previous day"
            onClick={() => onChange(shiftDay(date, -1))}
          />
          <Button
            variant={viewingToday ? 'subtle' : 'secondary'}
            size="sm"
            onClick={() => onChange(todayISO())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            icon="ChevronRight"
            aria-label="Next day"
            onClick={() => onChange(shiftDay(date, 1))}
          />
        </div>

        <label htmlFor={inputId} className="sr-only">
          Jump to a date
        </label>
        <Input
          id={inputId}
          type="date"
          value={date}
          onChange={handleJump}
          className="w-[9.5rem] font-mono text-xs tabular-nums"
        />
      </div>

      <p className="sr-only">
        Press the left and right arrow keys to move to the previous or next day.
      </p>
    </div>
  )
}
