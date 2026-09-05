import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import type { Tone } from '@/types/ui'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * Transient confirmations.
 *
 * The context deliberately carries only the *api* — `toast` and `dismiss`, both
 * stable for the lifetime of the provider. The toast list itself never enters
 * the context, so firing a toast re-renders the viewport and nothing else: the
 * `children` element reference is unchanged across the provider's own state
 * updates, and React bails out of re-rendering that subtree.
 */

const MAX_VISIBLE = 3
const DEFAULT_DURATION = 4000

export interface ToastOptions {
  title: string
  description?: string
  tone?: Tone
  /** Milliseconds before auto-dismiss. Pass 0 to keep it until dismissed. */
  duration?: number
  /** Optional single action, e.g. an undo affordance. */
  action?: { label: string; onClick: () => void }
}

interface ToastRecord extends ToastOptions {
  id: string
}

interface ToastApi {
  /** Shows a toast and returns its id. */
  toast: (options: ToastOptions) => string
  dismiss: (id: string) => void
}

const ToastApiContext = createContext<ToastApi | null>(null)

const TONE_STYLE: Record<Tone, { icon: string; edge: string; fg: string }> = {
  neutral: { icon: 'Info', edge: 'border-l-line-strong', fg: 'text-ink-faint' },
  accent: { icon: 'Info', edge: 'border-l-accent', fg: 'text-accent' },
  positive: { icon: 'CircleCheckBig', edge: 'border-l-positive', fg: 'text-positive' },
  warning: { icon: 'TriangleAlert', edge: 'border-l-warning', fg: 'text-warning' },
  danger: { icon: 'CircleAlert', edge: 'border-l-danger', fg: 'text-danger' },
  info: { icon: 'Info', edge: 'border-l-info', fg: 'text-info' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const seqRef = useRef(0)

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback((options: ToastOptions) => {
    seqRef.current += 1
    const id = `toast-${seqRef.current}`
    // Only the newest few are kept: a stack taller than this stops being
    // readable and starts being a wall.
    setToasts((prev) => [...prev, { ...options, id }].slice(-MAX_VISIBLE))
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastApiContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastApiContext.Provider>
  )
}

// The hook has to live beside the provider that owns the context. Splitting it
// into its own module to satisfy fast refresh would buy nothing but an extra
// file, and this component is not one anybody edits during a hot-reload loop.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastApi {
  const api = useContext(ToastApiContext)
  if (!api) {
    throw new Error('useToast must be used inside <ToastProvider>.')
  }
  return api
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[]
  onDismiss: (id: string) => void
}) {
  /*
   * The region is always mounted, even when empty: assistive technology has to
   * observe the live region before content is inserted into it, otherwise the
   * first toast of a session is announced late or not at all.
   *
   * Top-centre on phones so it clears the thumb and any sticky action bar,
   * bottom-right on wider screens. `flex-col-reverse` on mobile keeps the
   * newest toast closest to the top edge.
   */
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-60 flex flex-col-reverse items-center gap-2',
        'px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3',
        'sm:inset-x-auto sm:top-auto sm:right-0 sm:bottom-0 sm:flex-col sm:items-end sm:p-5',
      )}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} toast={item} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body,
  )
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord
  onDismiss: (id: string) => void
}) {
  const { id, title, description, tone = 'neutral', duration = DEFAULT_DURATION, action } = toast
  const style = TONE_STYLE[tone]

  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(duration)
  const startedRef = useRef(0)

  // Hovering or focusing the toast holds the clock, so a long message can be
  // read and an action can be reached without racing the timer.
  useEffect(() => {
    if (duration <= 0 || paused || remainingRef.current <= 0) return
    startedRef.current = Date.now()
    const timer = window.setTimeout(() => onDismiss(id), remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current))
    }
  }, [duration, paused, id, onDismiss])

  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex w-[min(24rem,calc(100vw-1.5rem))] animate-pop items-start gap-3',
        'rounded-xl border border-l-4 border-line bg-surface py-3 pr-2 pl-3 shadow-overlay',
        style.edge,
      )}
    >
      <Icon name={style.icon} className={cn('mt-0.5 size-4 shrink-0', style.fg)} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description ? (
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{description}</p>
        ) : null}
        {action ? (
          <button
            type="button"
            onClick={() => {
              action.onClick()
              onDismiss(id)
            }}
            className="mt-2 rounded-md text-sm font-medium text-accent transition-colors hover:text-accent-hover"
          >
            {action.label}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label={`Dismiss notification: ${title}`}
        className="-mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
      >
        <Icon name="X" className="size-3.5" />
      </button>
    </div>
  )
}
