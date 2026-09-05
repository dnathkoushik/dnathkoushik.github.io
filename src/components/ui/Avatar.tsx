import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface AvatarProps {
  src?: string
  /** Shown when there is no image, or when the image fails to load. */
  initials: string
  /** Edge length in px. Defaults to 40. */
  size?: number
  /** The person's name. Omit for a purely decorative avatar. */
  alt?: string
  className?: string
}

/**
 * A circular portrait that degrades to initials.
 *
 * The fallback is not just for a missing `src` — it also catches a broken URL
 * at runtime, which on a statically hosted site is the likely failure: a photo
 * that was renamed, or one blocked on a locked-down network. Without `alt` the
 * whole thing is hidden from assistive tech, because an avatar beside a name
 * that is already on screen is decoration.
 */
export function Avatar({ src, initials, size = 40, alt, className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const [lastSrc, setLastSrc] = useState(src)

  // A new src deserves a fresh attempt, even if the previous one 404'd. Doing
  // this during render rather than in an effect avoids a wasted pass that would
  // briefly show the initials for an image that is perfectly fine.
  if (src !== lastSrc) {
    setLastSrc(src)
    setFailed(false)
  }

  const showImage = Boolean(src) && !failed
  const labelling = alt
    ? ({ role: 'img', 'aria-label': alt } as const)
    : ({ 'aria-hidden': true } as const)

  return (
    <span
      {...(showImage ? {} : labelling)}
      style={{ width: size, height: size }}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'bg-accent-soft ring-1 ring-line select-none',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? ''}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="font-mono font-semibold tracking-tight text-accent uppercase"
          style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
