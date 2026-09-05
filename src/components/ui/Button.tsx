import { forwardRef } from 'react'
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

/*
 * Solid fills use `text-accent-ink`, which is white in the light theme and
 * near-black in the dark one. That is the whole trick behind buttons that stay
 * readable in both themes: the fill lightens in dark mode, so its ink has to
 * darken with it. Hard-coding `text-white` here would fail contrast on the
 * lighter dark-mode danger and accent fills.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink shadow-subtle hover:bg-accent-hover active:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink shadow-subtle hover:bg-surface-hover',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-hover hover:text-ink',
  subtle: 'bg-surface-muted text-ink hover:bg-surface-hover',
  danger:
    'bg-danger text-accent-ink shadow-subtle hover:bg-[color-mix(in_oklab,var(--color-danger)_88%,var(--color-ink))]',
}

/*
 * Heights step up on coarse pointers so that every control clears the 44px
 * touch target on a phone without looking oversized under a mouse.
 */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-lg px-4 text-sm pointer-coarse:h-11',
  lg: 'h-12 gap-2 rounded-xl px-6 text-[15px]',
  icon: 'size-9 gap-0 rounded-lg p-0 pointer-coarse:size-11',
}

const BASE =
  'relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium ' +
  'transition-colors duration-150 outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50'

/**
 * The single source of truth for button styling.
 *
 * `Button` and `ButtonLink` both render through this, which is why an anchor
 * styled as a primary action is pixel-identical to the button version.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  fullWidth = false,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && 'w-full')
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Curated icon name rendered before the label. */
  icon?: string
  /** Curated icon name rendered after the label. */
  iconRight?: string
  fullWidth?: boolean
  className?: string
  children?: ReactNode
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18, icon: 17 }

function Glyphs({
  size,
  icon,
  iconRight,
  loading,
  children,
}: {
  size: ButtonSize
  icon?: string
  iconRight?: string
  loading?: boolean
  children?: ReactNode
}) {
  const px = ICON_SIZE[size]
  return (
    <>
      {loading ? (
        <Icon name="LoaderCircle" size={px} className="animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={px} />
      ) : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={px} /> : null}
    </>
  )
}

export interface ButtonProps extends CommonProps, ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Shows a spinner in place of the leading icon, marks the control busy and
   * blocks further clicks. Use it for anything that touches storage or the
   * network so a double-submit is impossible.
   */
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses(variant, size, fullWidth), className)}
    >
      <Glyphs size={size} icon={icon} iconRight={iconRight} loading={loading}>
        {children}
      </Glyphs>
    </button>
  )
})

export interface ButtonLinkProps
  extends CommonProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'type'> {
  /** In-app destination. Renders a react-router `Link`. */
  to?: string
  /** External destination. Opens in a new tab and is announced as such. */
  href?: string
  /** Mirrors `Button` so a link can sit in a row of buttons without jumping. */
  loading?: boolean
}

/**
 * A link that looks exactly like a button.
 *
 * Navigation is a link, not a button — that is what makes middle-click,
 * "open in new tab" and the browser's own affordances keep working.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconRight,
    loading = false,
    fullWidth = false,
    className,
    children,
    to,
    href,
    ...rest
  },
  ref,
) {
  const classes = cn(buttonClasses(variant, size, fullWidth), className)
  const inner = (
    <Glyphs size={size} icon={icon} iconRight={iconRight} loading={loading}>
      {children}
    </Glyphs>
  )

  if (to) {
    return (
      <Link {...rest} ref={ref} to={to} className={classes}>
        {inner}
      </Link>
    )
  }

  return (
    <a
      {...rest}
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={classes}
    >
      {inner}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
})
