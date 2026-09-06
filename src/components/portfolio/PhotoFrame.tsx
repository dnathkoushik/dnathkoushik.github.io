import type { CSSProperties } from 'react'
import { asset } from '@/config/app'
import { formatYearMonth } from '@/utils/date'
import { cn } from '@/lib/cn'
import { Reveal } from '@/motion'
import type { Photo } from '@/types'

export interface PhotoFrameProps {
  photo: Photo
  /** Extra classes on the <figure>. Use to size the frame from the outside. */
  className?: string
  /** Force a crop, e.g. "4 / 5". Defaults to the photo's own ratio. */
  aspect?: string
  /** CSS object-position for the crop, e.g. "65% 35%" to keep a face in frame. */
  focus?: string
  /** Render the caption block under the image. */
  caption?: boolean
  /** Above the fold: load eagerly and with high priority. */
  priority?: boolean
  /** Responsive `sizes` hint. Defaults to a sensible column width. */
  sizes?: string
  /** Skip the clip reveal (when a parent already animates the frame). */
  still?: boolean
}

/**
 * A real photograph, framed.
 *
 * Every photo ships as WebP in two sizes; the browser picks by `sizes`. The
 * intrinsic width/height are always set so the layout is stable before the
 * bytes arrive — a frame that jumps is worse than one that is slow.
 *
 * At rest the image is very slightly desaturated so the six photos sit as one
 * set against the dark page; on hover it comes up to full colour and eases a
 * hair closer. Both are plain CSS transitions, so they cost nothing and the
 * global reduced-motion rule neutralises them.
 */
export function PhotoFrame({
  photo,
  className,
  aspect,
  focus,
  caption = true,
  priority = false,
  sizes = '(min-width: 1024px) 28rem, (min-width: 640px) 45vw, 90vw',
  still = false,
}: PhotoFrameProps) {
  const base = photo.src.replace(/\.webp$/, '')
  const full = asset(`photos/${base}.webp`)
  const small = asset(`photos/${base}-480.webp`)
  const smallWidth = Math.round((480 / photo.width) * photo.width) // 480, kept explicit
  const style: CSSProperties = {
    aspectRatio: aspect ?? `${photo.width} / ${photo.height}`,
  }

  const image = (
    <div
      className="relative overflow-hidden rounded-card border border-line bg-surface-muted"
      style={style}
    >
      <img
        src={full}
        srcSet={`${small} ${smallWidth}w, ${full} ${photo.width}w`}
        sizes={sizes}
        width={photo.width}
        height={photo.height}
        alt={photo.alt}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        draggable={false}
        style={focus ? { objectPosition: focus } : undefined}
        className={cn(
          'absolute inset-0 size-full object-cover select-none',
          'saturate-[.88] transition-[filter,transform] duration-700 ease-out',
          'group-hover:scale-[1.03] group-hover:saturate-100 group-focus-within:saturate-100',
        )}
      />
      {/* A hairline inner edge, so a bright photo does not bleed into the border. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-card ring-1 ring-inset ring-canvas/20" />
    </div>
  )

  return (
    <figure className={cn('group min-w-0', className)}>
      {still ? image : <Reveal clip="up">{image}</Reveal>}
      {/* Caption and place are stacked, not side by side: a mono place label is
          wider than most of these frames and would squeeze the caption into a
          two-word column. */}
      {caption ? (
        <figcaption className="mt-3 space-y-1">
          <span className="block text-sm leading-snug text-ink-muted">{photo.caption}</span>
          <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
            {photo.place}
            {photo.date ? ` · ${formatYearMonth(photo.date)}` : ''}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}
