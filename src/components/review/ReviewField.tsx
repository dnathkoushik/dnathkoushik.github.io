import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'

/** Quiet time before an edit is written through. */
const DEBOUNCE_MS = 700
/** How long the "Saved" confirmation stays on screen. */
const SAVED_VISIBLE_MS = 2200

export interface ReviewFieldProps {
  /** Unique id for the textarea; the prompt is wired to it by description. */
  id: string
  label: string
  /** The question under the label — what this box is actually asking for. */
  prompt: string
  icon: string
  value: string
  /** Called on a debounce while typing, on blur, and on unmount. */
  onCommit: (next: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

interface DraftState {
  /** What is in the textarea right now. */
  text: string
  /** The last text handed to `onCommit`. */
  sent: string
  /** The last `value` prop this component reacted to. */
  seen: string
}

/**
 * One prompt of the weekly review.
 *
 * A writing surface must never lose a sentence, so an edit reaches storage
 * three different ways: 700 ms after the last keystroke, the moment the field
 * loses focus, and once more if the component is torn down (navigating away,
 * switching weeks) while an edit is still pending.
 *
 * `sent` is what keeps the debounce from fighting the keyboard. The parent
 * re-renders with the value this field just emitted; without that record the
 * incoming prop would look like an edit from elsewhere and would overwrite
 * whatever was typed in the meantime.
 */
export function ReviewField({
  id,
  label,
  prompt,
  icon,
  value,
  onCommit,
  placeholder,
  rows = 3,
  className,
}: ReviewFieldProps) {
  const promptId = `${id}-prompt`

  const [state, setState] = useState<DraftState>({ text: value, sent: value, seen: value })
  /** Non-zero while the "Saved" flag is showing; bumped on every write. */
  const [savedTick, setSavedTick] = useState(0)

  // Reconcile a value that changed somewhere else (an import, a reset) without
  // ever discarding keystrokes that have not been written through yet.
  if (value !== state.seen) {
    setState((prev) =>
      value === prev.sent
        ? { ...prev, seen: value }
        : { text: value, sent: value, seen: value },
    )
  }

  const dirty = state.text !== state.sent
  const showSaved = savedTick > 0 && !dirty

  const commitRef = useRef(onCommit)
  const pendingRef = useRef({ text: value, sent: value })
  useEffect(() => {
    commitRef.current = onCommit
    pendingRef.current = { text: state.text, sent: state.sent }
  })

  useEffect(() => {
    if (state.text === state.sent) return
    const text = state.text
    const timer = window.setTimeout(() => {
      commitRef.current(text)
      setState((prev) => (prev.text === text ? { ...prev, sent: text } : prev))
      setSavedTick((tick) => tick + 1)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state.text, state.sent])

  // Declared after the debounce so its cleanup runs second: the pending timer
  // is cancelled first, then the final value is written exactly once.
  useEffect(
    () => () => {
      const { text, sent } = pendingRef.current
      if (text !== sent) commitRef.current(text)
    },
    [],
  )

  useEffect(() => {
    if (savedTick === 0) return
    const timer = window.setTimeout(() => setSavedTick(0), SAVED_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [savedTick])

  const flush = () => {
    if (state.text === state.sent) return
    const text = state.text
    onCommit(text)
    setState((prev) => ({ ...prev, sent: text }))
    setSavedTick((tick) => tick + 1)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium text-ink">
          <Icon name={icon} className="size-4 text-ink-faint" />
          {label}
        </label>

        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
          {dirty ? (
            <span aria-hidden="true" className="text-ink-faint">
              Saving…
            </span>
          ) : null}
          <span
            aria-live="polite"
            className={cn(
              'inline-flex items-center gap-1 text-positive transition-opacity duration-150',
              showSaved ? 'opacity-100' : 'opacity-0',
            )}
          >
            {showSaved ? (
              <>
                <Icon name="Check" className="size-3" />
                Saved
              </>
            ) : (
              ''
            )}
          </span>
        </span>
      </div>

      <p id={promptId} className="text-xs leading-relaxed text-ink-faint">
        {prompt}
      </p>

      <Textarea
        id={id}
        autoGrow
        rows={rows}
        value={state.text}
        placeholder={placeholder}
        aria-describedby={promptId}
        onChange={(event) => {
          const text = event.target.value
          setState((prev) => ({ ...prev, text }))
        }}
        onBlur={flush}
        className="text-[15px]"
      />
    </div>
  )
}
