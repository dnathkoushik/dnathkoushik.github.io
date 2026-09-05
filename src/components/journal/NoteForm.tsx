import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ISODate, Note } from '@/types'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

export interface NoteFormValues {
  title: string
  body: string
  tags: string[]
  date: ISODate
}

export interface NoteFormProps {
  open: boolean
  /** Omit to create a new note. */
  note?: Note
  /** Date a new note starts on. */
  defaultDate: ISODate
  onClose: () => void
  onSubmit: (values: NoteFormValues) => void
}

/** "react, notes ,,  idea" → ["react", "notes", "idea"], order preserved. */
// eslint-disable-next-line react-refresh/only-export-components
export function parseTags(raw: string): string[] {
  const seen = new Set<string>()
  const tags: string[] = []
  for (const part of raw.split(',')) {
    const tag = part.trim()
    if (!tag) continue
    const key = tag.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
  }
  return tags
}

/**
 * The note editor.
 *
 * State is re-seeded whenever the dialog opens rather than held across closes,
 * so reopening after a cancel never resurrects a half-typed note from an hour
 * ago — the one behaviour that makes a quick-capture form untrustworthy.
 */
export function NoteForm({ open, note, defaultDate, onClose, onSubmit }: NoteFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [date, setDate] = useState<ISODate>(defaultDate)
  const [error, setError] = useState<string | undefined>(undefined)

  /*
   * Seeding happens during render, keyed on what the dialog was opened with, so
   * the very first painted frame already shows the right note instead of the
   * previous one for a tick.
   */
  const seedKey = open ? `${note ? `${note.id}:${note.updatedAt}` : 'new'}:${defaultDate}` : null
  const [lastSeedKey, setLastSeedKey] = useState<string | null>(seedKey)

  if (seedKey !== lastSeedKey) {
    setLastSeedKey(seedKey)
    if (seedKey !== null) {
      setTitle(note?.title ?? '')
      setBody(note?.body ?? '')
      setTags(note?.tags.join(', ') ?? '')
      setDate(note?.date ?? defaultDate)
      setError(undefined)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Give the note a title so you can find it again.')
      return
    }
    onSubmit({ title: trimmed, body: body.trim(), tags: parseTags(tags), date })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={note ? 'Edit note' : 'New note'}
      description={
        note
          ? 'Changes are saved to this browser only.'
          : 'Anything worth remembering: a decision, a bug, a link, a thought.'
      }
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon="Save" type="submit" form="note-form">
            {note ? 'Save changes' : 'Add note'}
          </Button>
        </>
      }
    >
      <form id="note-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Title" required error={error}>
          <Input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError(undefined)
            }}
            placeholder="What is this about?"
            autoComplete="off"
          />
        </Field>

        <Field label="Body" hint="Plain text. Line breaks are kept exactly as you type them.">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={6}
            autoGrow
            placeholder="Write it out…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags" hint="Comma separated, e.g. system-design, postgres">
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="react, debugging"
              autoComplete="off"
            />
          </Field>

          <Field label="Date">
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              max="9999-12-31"
            />
          </Field>
        </div>

        {parseTags(tags).length > 0 ? (
          <p className="text-xs text-ink-faint">
            Will be saved as:{' '}
            <span className="font-mono text-ink-muted">{parseTags(tags).join(' · ')}</span>
          </p>
        ) : null}
      </form>
    </Dialog>
  )
}
