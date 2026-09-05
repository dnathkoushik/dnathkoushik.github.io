import { cn } from '@/lib/cn'

export interface SectionHeadingProps {
  /** Small uppercase kicker above the title. */
  eyebrow?: string
  title: string
  description?: string
  /** Point the parent `<section aria-labelledby>` at this. */
  id?: string
  align?: 'left' | 'center'
  className?: string
}

/**
 * The `<h2>` that opens a section.
 *
 * Pass `id` and reference it from the enclosing
 * `<section aria-labelledby={id}>` so the section is announced by name in a
 * screen reader's landmark list instead of as an anonymous region.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  align = 'left',
  className,
}: SectionHeadingProps) {
  const centered = align === 'center'

  return (
    <div className={cn('space-y-2', centered && 'text-center', className)}>
      {eyebrow ? (
        <p className="font-mono text-[11px] font-medium tracking-[0.14em] text-ink-faint uppercase">
          {eyebrow}
        </p>
      ) : null}

      <h2 id={id} className="text-xl font-semibold tracking-tight text-balance text-ink sm:text-2xl">
        {title}
      </h2>

      {description ? (
        <p
          className={cn(
            'max-w-2xl text-[15px] leading-relaxed text-ink-muted',
            centered && 'mx-auto',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
