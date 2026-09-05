import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { useFieldControl } from '@/components/ui/Field'
import { CONTROL_HEIGHT, controlClasses } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Draws the error border and sets `aria-invalid`. `Field` sets it for you. */
  invalid?: boolean
  /** Applied to the wrapper rather than the control, for width and margins. */
  wrapperClassName?: string
}

/**
 * A native `<select>` with the chrome removed and our own chevron on top.
 *
 * It stays native on purpose: the OS picker is faster to use on a phone, works
 * with the keyboard for free, and cannot drift out of sync with the platform's
 * own accessibility behaviour the way a hand-rolled listbox does.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, wrapperClassName, children, ...rest },
  ref,
) {
  const field = useFieldControl()
  const isInvalid = invalid ?? field['aria-invalid'] === true

  return (
    <div className={cn('relative', wrapperClassName)}>
      <select
        {...field}
        {...rest}
        ref={ref}
        aria-invalid={isInvalid || undefined}
        className={cn(
          controlClasses(isInvalid),
          CONTROL_HEIGHT,
          'cursor-pointer appearance-none pr-9',
          className,
        )}
      >
        {children}
      </select>
      <Icon
        name="ChevronsUpDown"
        size={14}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint"
      />
    </div>
  )
})
