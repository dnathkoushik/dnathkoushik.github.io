import { useId } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface CheckboxProps {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label?: ReactNode
  /** Required when there is no visible `label`, e.g. a checkbox in a table row. */
  ariaLabel?: string
  disabled?: boolean
  id?: string
  className?: string
}

/**
 * A real `<input type="checkbox">` under a drawn box.
 *
 * The input is visually hidden but still focusable and still the thing the
 * browser toggles, so Space, form association, autofill and every assistive
 * technology behave exactly as they would with an unstyled checkbox. The `peer`
 * variants below are pure presentation.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  ariaLabel,
  disabled = false,
  id,
  className,
}: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? `checkbox-${generatedId}`

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative flex size-5 shrink-0 items-center justify-center">
        {/* The negative inset widens the hit area to 36px without moving the box. */}
        <input
          type="checkbox"
          id={inputId}
          checked={checked}
          disabled={disabled}
          aria-label={label ? undefined : ariaLabel}
          onChange={(event) => onCheckedChange(event.target.checked)}
          className="peer absolute -inset-2 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none flex size-5 items-center justify-center rounded-md border transition-colors duration-150',
            'border-line-strong bg-surface',
            'peer-hover:border-accent',
            'peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink',
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            'peer-disabled:border-line peer-disabled:bg-surface-muted peer-disabled:opacity-60',
          )}
        >
          <Icon
            name="Check"
            size={13}
            strokeWidth={3}
            className={cn('transition-opacity duration-150', checked ? 'opacity-100' : 'opacity-0')}
          />
        </span>
      </span>

      {label ? (
        <label
          htmlFor={inputId}
          className={cn(
            'cursor-pointer text-sm leading-5 text-ink select-none',
            disabled && 'cursor-not-allowed text-ink-faint',
          )}
        >
          {label}
        </label>
      ) : null}
    </div>
  )
}
