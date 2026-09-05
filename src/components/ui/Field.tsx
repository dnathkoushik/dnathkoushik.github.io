import { createContext, useContext, useId, useMemo } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

interface FieldContextValue {
  id: string
  describedBy?: string
  invalid: boolean
  required: boolean
}

/*
 * Label association is done with context rather than `cloneElement`.
 *
 * Cloning breaks the moment a caller wraps their input in a layout div or a
 * fragment — which happens constantly — and it silently produces an unlabelled
 * field, the single most common accessibility bug in a form. Context survives
 * any nesting, and `Input`, `Textarea` and `Select` opt into it automatically
 * through `useFieldControl()`. A caller who still wants to pass `htmlFor`
 * explicitly can: an explicit id always wins.
 */
const FieldContext = createContext<FieldContextValue | null>(null)

/**
 * Wiring for a form control that lives inside a `<Field>`.
 *
 * Spread the result onto the control *before* the caller's own props so an
 * explicit `id` or `aria-describedby` still takes precedence.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFieldControl(): {
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: true
  'aria-required'?: true
} {
  const field = useContext(FieldContext)
  if (!field) return {}
  return {
    id: field.id,
    'aria-describedby': field.describedBy,
    'aria-invalid': field.invalid || undefined,
    // `aria-required` rather than the native attribute: the browser's own
    // validation bubble would fight the `error` message this component renders.
    'aria-required': field.required || undefined,
  }
}

export interface FieldProps {
  label: string
  /** Supply this only when the control's id is fixed by something else. */
  htmlFor?: string
  hint?: string
  /** Present means invalid: the control gets `aria-invalid` and a red border. */
  error?: string
  required?: boolean
  className?: string
  children: ReactNode
}

/**
 * A labelled form row: label, control, and either a hint or an error.
 *
 * The hint is hidden while an error is showing so the description slot never
 * stacks two competing messages — the error is always the more urgent one, and
 * `aria-describedby` points at whichever is on screen.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
}: FieldProps) {
  const generatedId = useId()
  const id = htmlFor ?? `field-${generatedId}`
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const showHint = Boolean(hint) && !error

  const context = useMemo<FieldContextValue>(
    () => ({
      id,
      describedBy: error ? errorId : showHint ? hintId : undefined,
      invalid: Boolean(error),
      required,
    }),
    [id, error, errorId, showHint, hintId, required],
  )

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>

      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>

      {showHint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-faint">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 text-xs leading-relaxed text-danger"
        >
          <Icon name="CircleAlert" size={13} className="mt-px" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
