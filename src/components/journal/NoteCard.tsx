import { useId, useState } from 'react'
import type { Note } from '@/types'
import { formatDayLong, formatDayShort, relativeDay } from '@/utils/date'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface NoteCardProps {
  note: Note
  onTogglePin: (note: Note) => void
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
  className?: string
}

/** Longer than this and the body collapses behind a "Read more". */
const EXCERPT_LIMIT = 260

/**
 * One note.
 *
 * The body is collapsed rather than truncated: the full text stays in the DOM
 * and is revealed by a real button with `aria-expanded`, so find-in-page and
 * screen readers can still reach a long note without opening the editor.
 */
export function NoteCard({ note, onTogglePin, onEdit, onDelete, className }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const long = note.body.length > EXCERPT_LIMIT

  return (
    <Card
      className={cn(
        'animate-fade-in',
        note.pinned && 'border-warning/40 ring-1 ring-warning/15',
        className,
      )}
    >
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="flex items-center gap-1.5 text-[15px] leading-snug font-semibold text-ink">
              {note.pinned ? (
                <Icon name="Pin" size={14} className="shrink-0 text-warning" title="Pinned" />
              ) : null}
              <span className="min-w-0 break-words">{note.title}</span>
            </h3>
            <p className="font-mono text-[11px] text-ink-faint">
              <time dateTime={note.date} title={formatDayLong(note.date)}>
                {formatDayShort(note.date)}
              </time>
              <span aria-hidden="true"> · </span>
              {relativeDay(note.date)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              icon={note.pinned ? 'PinOff' : 'Pin'}
              aria-pressed={note.pinned}
              aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`}
              onClick={() => onTogglePin(note)}
              className={note.pinned ? 'text-warning' : undefined}
            />
            <DropdownMenu
              label={`Actions for ${note.title}`}
              align="end"
              items={[
                { id: 'edit', label: 'Edit note', icon: 'Pencil', onSelect: () => onEdit(note) },
                {
                  id: 'delete',
                  label: 'Delete note',
                  icon: 'Trash',
                  tone: 'danger',
                  onSelect: () => onDelete(note),
                },
              ]}
            />
          </div>
        </div>

        {note.body ? (
          <div className="space-y-1.5">
            <p
              id={bodyId}
              className={cn(
                'text-sm leading-relaxed whitespace-pre-wrap text-ink-muted',
                long && !expanded && 'line-clamp-4',
              )}
            >
              {note.body}
            </p>
            {long ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                aria-controls={bodyId}
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-accent transition-colors hover:text-accent-hover"
              >
                {expanded ? 'Show less' : 'Read more'}
                <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={13} />
              </button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-ink-faint italic">No body — the title says it all.</p>
        )}

        {note.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="neutral" size="sm" icon="Tag">
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
