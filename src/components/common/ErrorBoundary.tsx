import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { BASE_URL } from '@/config/app'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Last line of defence around the router.
 *
 * Kept intentionally dependency-free — no design-system imports, no data layer,
 * no router hooks — because the one job of this component is to still render
 * when something else in the tree could not. "Go home" is a plain anchor rather
 * than a <Link> so it works even if the failure was the router itself.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] render failed:', error, info.componentStack)
    }
  }

  private readonly handleReload = () => {
    window.location.reload()
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main
        role="alert"
        className="flex min-h-[100svh] w-full items-center justify-center bg-canvas px-5 py-16"
      >
        <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-subtle sm:p-8">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">
            This page stopped working
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Something in the interface threw an error, so it was unmounted to keep the rest of the
            app usable. Nothing you have saved was affected — your dashboard data lives in this
            browser and is untouched.
          </p>

          {error.message ? (
            <p className="mt-4 overflow-x-auto rounded-lg bg-surface-muted px-3 py-2 font-mono text-xs text-ink-faint">
              {error.message}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Reload the page
            </button>
            <a
              href={BASE_URL}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-hover"
            >
              Go home
            </a>
          </div>
        </div>
      </main>
    )
  }
}
