import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Signals that the card leads somewhere. It adds hover and focus-within
   * affordances but deliberately does NOT make the card itself clickable —
   * the real link or button lives inside, so keyboard users get one focus stop
   * with a sensible accessible name instead of a div that swallows events.
   */
  interactive?: boolean
  className?: string
  children?: ReactNode
}

export function Card({ interactive = false, className, children, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'relative flex flex-col rounded-card border border-line bg-surface shadow-subtle',
        interactive &&
          'transition-colors duration-150 hover:border-line-strong hover:bg-surface-hover/50 ' +
            'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25',
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /** Rendered on the trailing edge — a menu, a filter, a small button. */
  actions?: ReactNode
  className?: string
  children?: ReactNode
}

export function CardHeader({ actions, className, children, ...rest }: CardHeaderProps) {
  return (
    <div
      {...rest}
      className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-4', className)}
    >
      <div className="flex min-w-0 flex-col gap-1">{children}</div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  )
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Pick the level that keeps the page's heading outline intact. */
  as?: 'h2' | 'h3' | 'h4'
  className?: string
  children?: ReactNode
}

export function CardTitle({ as: Tag = 'h3', className, children, ...rest }: CardTitleProps) {
  return (
    <Tag {...rest} className={cn('text-lg font-semibold tracking-tight text-ink', className)}>
      {children}
    </Tag>
  )
}

export function CardDescription({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p {...rest} className={cn('text-sm leading-relaxed text-ink-muted', className)}>
      {children}
    </p>
  )
}

/**
 * `first:pt-5` gives the content its own top padding only when there is no
 * header above it, so `<Card><CardContent/></Card>` and
 * `<Card><CardHeader/><CardContent/></Card>` are both correctly inset.
 */
export function CardContent({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn('px-5 pb-5 first:pt-5', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        'mt-auto flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5',
        className,
      )}
    >
      {children}
    </div>
  )
}
