import { forwardRef, useCallback, useLayoutEffect, useRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { useFieldControl } from '@/components/ui/Field'
import { controlClasses } from '@/components/ui/Input'
import { cn } from '@/lib/cn'

/** Whatever the installed React typings call a textarea's input event. */
type InputHandler = NonNullable<TextareaHTMLAttributes<HTMLTextAreaElement>['onInput']>

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Draws the error border and sets `aria-invalid`. `Field` sets it for you. */
  invalid?: boolean
  /**
   * Grows to fit its content instead of scrolling. Journal entries and review
   * answers are long and unpredictable; an inner scrollbar hides what you just
   * wrote, which is the fastest way to make a writing surface feel hostile.
   */
  autoGrow?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, autoGrow = false, className, onInput, rows = 3, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) (ref as { current: HTMLTextAreaElement | null }).current = node
    },
    [ref],
  )

  const resize = useCallback(() => {
    const el = innerRef.current
    if (!el || !autoGrow) return
    // Collapse first, otherwise scrollHeight can only ever grow.
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [autoGrow])

  // Covers the first paint and any controlled value change (reset, load, undo).
  useLayoutEffect(resize, [resize, rest.value, rest.defaultValue])

  const handleInput: InputHandler = (event) => {
    resize()
    onInput?.(event)
  }

  return (
    <textarea
      {...field}
      {...rest}
      ref={attachRef}
      rows={rows}
      onInput={handleInput}
      aria-invalid={isInvalid || undefined}
      className={cn(
        controlClasses(isInvalid),
        'min-h-20 py-2 leading-relaxed',
        autoGrow ? 'resize-none overflow-hidden' : 'resize-y',
        className,
      )}
    />
  )
})
