import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { useFieldControl } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

/**
 * Shared skin for every text-entry control, so an `<Input>`, a `<Select>` and a
 * `<Textarea>` sitting in the same form are indistinguishable at the edges.
 * Height steps to 44px on coarse pointers to stay comfortably tappable.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function controlClasses(invalid = false): string {
  return cn(
    'w-full rounded-lg border bg-surface px-3 text-sm text-ink transition-colors duration-150',
    'placeholder:text-ink-faint outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
    'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-faint',
    invalid
      ? 'border-danger focus-visible:border-danger'
      : 'border-line hover:border-line-strong focus-visible:border-accent',
  )
}

export const CONTROL_HEIGHT = 'h-10 pointer-coarse:h-11'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Draws the error border and sets `aria-invalid`. `Field` sets it for you. */
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...rest },
  ref,
) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  return (
    <input
      {...field}
      {...rest}
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(controlClasses(isInvalid), CONTROL_HEIGHT, className)}
    />
  )
})
