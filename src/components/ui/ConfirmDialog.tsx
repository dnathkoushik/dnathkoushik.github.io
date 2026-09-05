import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * The one dialog shape used for every "are you sure?" moment, so destructive
 * confirmations always look and behave identically.
 *
 * Cancel is rendered first, which means the base Dialog autofocuses it — the
 * safe choice when the primary action deletes something.
 */

const TONE_STYLE = {
  danger: {
    icon: 'TriangleAlert',
    ring: 'bg-danger-soft text-danger',
    variant: 'danger',
  },
  accent: {
    icon: 'Info',
    ring: 'bg-accent-soft text-accent',
    variant: 'primary',
  },
} as const

export interface ConfirmDialogProps {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
}

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
}: ConfirmDialogProps) {
  const style = TONE_STYLE[tone]

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={style.variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 pb-1">
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
            style.ring,
          )}
        >
          <Icon name={style.icon} className="size-4.5" />
        </span>
        <p className="pt-1.5 text-sm leading-relaxed text-ink-muted">{message}</p>
      </div>
    </Dialog>
  )
}
