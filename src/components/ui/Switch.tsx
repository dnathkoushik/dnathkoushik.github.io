import { useId } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  label: string
  description?: string
  disabled?: boolean
  className?: string
}

/**
 * An immediate on/off setting.
 *
 * Built as `<button role="switch">` rather than a checkbox because a switch
 * takes effect the moment you flip it — there is no Save button to press — and
 * `role="switch"` is what tells a screen reader to announce "on"/"off" instead
 * of "checked". The whole row is the control, so the label and description are
 * part of the target rather than decoration beside it.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: SwitchProps) {
  const labelId = useId()
  const descriptionId = `${labelId}-description`

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'group flex w-full items-start justify-between gap-4 rounded-lg text-left transition-colors duration-150',
        'outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
        disabled ? 'cursor-not-allowed opacity-55' : 'cursor-pointer',
        className,
      )}
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-medium text-ink">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>

      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-150',
          checked
            ? 'border-accent bg-accent'
            : 'border-line-strong bg-surface-muted group-hover:bg-surface-hover',
        )}
      >
        <span
          className={cn(
            'size-4.5 rounded-full shadow-subtle transition-transform duration-150',
            checked ? 'translate-x-5 bg-accent-ink' : 'translate-x-0 bg-surface',
          )}
        />
      </span>
    </button>
  )
}
