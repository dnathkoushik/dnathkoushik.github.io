import { Link } from 'react-router-dom'
import type { ActivityEvent, ActivityKind, Category, Tone } from '@/types'
import { CAT_CLASSES } from '@/utils/format'
import { TONE_SOFT_BG_CLASS, TONE_TEXT_CLASS } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface ActivityItemProps {
  event: ActivityEvent
  /** Resolved from `event.categoryId` by the page, which owns the lookup map. */
  category?: Category
  className?: string
}

interface KindStyle {
  icon: string
  tone: Tone
  /** Read aloud before the title so the row makes sense without the icon. */
  label: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const KIND_STYLE: Record<ActivityKind, KindStyle> = {
  'task-completed': { icon: 'CircleCheckBig', tone: 'positive', label: 'Task completed' },
  log: { icon: 'Clock', tone: 'info', label: 'Work logged' },
  'goal-completed': { icon: 'Target', tone: 'accent', label: 'Goal completed' },
  habit: { icon: 'Flame', tone: 'warning', label: 'Habit done' },
  note: { icon: 'StickyNote', tone: 'neutral', label: 'Note' },
  review: { icon: 'ClipboardList', tone: 'accent', label: 'Weekly review' },
  'day-objective': { icon: 'Crosshair', tone: 'neutral', label: 'Objective set' },
  touch: { icon: 'Send', tone: 'info', label: 'Outreach' },
}

/** Local wall-clock time of an instant, `HH:mm`. */
function clockOf(timestamp?: string): string | undefined {
  if (!timestamp) return undefined
  const value = new Date(timestamp)
  if (Number.isNaN(value.getTime())) return undefined
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
}

/**
 * One thing that happened, as a row in the day's timeline.
 *
 * The whole row is a link because every event has somewhere it came from, and
 * following it is the reason to scroll this page at all. The kind is carried by
 * both the icon and a visually-hidden label, so "Task completed" is announced
 * rather than left to a green tick.
 */
export function ActivityItem({ event, category, className }: ActivityItemProps) {
  const style = KIND_STYLE[event.kind]
  const time = clockOf(event.timestamp)

  const body = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',
          TONE_SOFT_BG_CLASS[style.tone],
          TONE_TEXT_CLASS[style.tone],
        )}
      >
        <Icon name={style.icon} size={14} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="sr-only">{style.label}: </span>
          <span className="min-w-0 text-sm leading-snug font-medium text-ink">{event.title}</span>
          {time ? (
            <time
              dateTime={event.timestamp}
              className="font-mono text-[11px] text-ink-faint tabular-nums"
            >
              {time}
            </time>
          ) : null}
        </span>

        {event.detail ? (
          <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {event.detail}
          </span>
        ) : null}

        {category ? (
          <span className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-ink-faint">
            <span
              aria-hidden="true"
              className={cn('size-1.5 rounded-full', CAT_CLASSES[category.color].bg)}
            />
            {category.label}
          </span>
        ) : null}
      </span>
    </>
  )

  return (
    <li className={className}>
      {event.href ? (
        <Link
          to={event.href}
          className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-hover"
        >
          {body}
          <Icon
            name="ChevronRight"
            size={15}
            className="mt-1.5 shrink-0 text-ink-faint"
          />
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-3 py-2.5">{body}</div>
      )}
    </li>
  )
}
