import type { CSSProperties } from 'react'
import { philosophy } from '@/data'
import { Parallax, Reveal, TextReveal } from '@/motion'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'

export interface PhilosophyListProps {
  className?: string
}

/*
 * Hollow numerals. `-webkit-text-fill-color` rather than `color: transparent`,
 * so the stroke — which reads `currentColor` — keeps the token colour.
 */
const OUTLINE: CSSProperties = {
  WebkitTextStroke: '1px currentColor',
  WebkitTextFillColor: 'transparent',
}

/**
 * How I work, in three short notes.
 *
 * Three wide editorial rows: a big outlined index that drifts slower than the
 * page, a display-size title and the note revealed line by line. Rendered as
 * an ordered list so the caller owns the surrounding `<section>` and its
 * heading — that keeps the page's heading outline in one place instead of
 * splitting it across a component boundary.
 */
export function PhilosophyList({ className }: PhilosophyListProps) {
  if (philosophy.length === 0) {
    return (
      <EmptyState
        icon="Quote"
        title="Nothing written down yet"
        description="These notes live in src/data/focus.ts."
        className={className}
      />
    )
  }

  return (
    <ol className={cn('divide-y divide-line border-y border-line', className)}>
      {philosophy.map((note, index) => (
        <li key={note.title} className="grid gap-6 py-10 sm:py-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <Parallax speed={0.25}>
              <Reveal y={16}>
                <span
                  aria-hidden="true"
                  style={OUTLINE}
                  className="block font-display text-[clamp(3.5rem,8vw,7rem)] leading-none font-medium text-line-strong select-none"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
              </Reveal>
            </Parallax>
          </div>

          <div className="min-w-0 lg:col-span-9 lg:max-w-[64ch]">
            <TextReveal
              as="h3"
              className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-[1.05] tracking-tight text-ink"
            >
              {note.title}
            </TextReveal>

            <TextReveal
              as="p"
              type="lines"
              delay={0.15}
              className="mt-5 text-[17px] leading-[1.6] text-ink-muted"
            >
              {note.body}
            </TextReveal>
          </div>
        </li>
      ))}
    </ol>
  )
}
