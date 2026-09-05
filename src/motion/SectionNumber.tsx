import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export interface SectionNumberProps {
  /** 1-based section index; rendered zero-padded ("01"). */
  n: number
  /** Optional mono eyebrow beside the numeral, e.g. "Selected work". */
  label?: string
  className?: string
}

/*
 * Hollow type. `-webkit-text-fill-color` is used rather than `color: transparent`
 * so the stroke — which reads `currentColor` — keeps the token colour.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

/**
 * The outlined numeral that opens each section. Decorative — the section's
 * heading carries its name — so the whole thing is hidden from assistive tech.
 * Wrap it in `<Parallax speed={0.3}>` to let it drift slower than the content.
 */
export function SectionNumber({ n, label, className }: SectionNumberProps) {
  return (
    <div aria-hidden="true" className={cn('flex items-end gap-4 select-none', className)}>
      <span
        className="font-display text-[clamp(4rem,10vw,9rem)] leading-none font-medium text-line-strong"
        style={OUTLINE}
      >
        {String(n).padStart(2, '0')}
      </span>
      {label ? (
        <span className="mb-[0.3em] font-mono text-[11px] tracking-[0.18em] text-ink-faint uppercase">
          {label}
        </span>
      ) : null}
    </div>
  )
}
