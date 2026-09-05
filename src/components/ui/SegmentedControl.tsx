import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Curated icon name shown before the label. */
  icon?: string
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md'
  /** Names the group for screen readers, e.g. "Time range". */
  ariaLabel: string
  className?: string
}

/** `pad` is the track's inner padding in px; the pill is inset by exactly that. */
const SIZES = {
  sm: { track: 'h-8 p-0.5 text-[13px]', item: 'gap-1.5 px-2.5', icon: 13, pad: 2 },
  md: { track: 'h-10 p-1 text-sm pointer-coarse:h-11', item: 'gap-2 px-3', icon: 15, pad: 4 },
} as const

/**
 * A one-of-many switch: day/week/month, all/active/done.
 *
 * Implemented as a radiogroup rather than a row of buttons, so the group is one
 * tab stop and the arrow keys move between options — which is both what the
 * ARIA pattern requires and what makes it fast to drive from the keyboard.
 * The active pill is a single absolutely positioned element that slides, so
 * switching options reads as movement rather than as two separate repaints.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const skin = SIZES[size]

  function move(delta: number) {
    if (options.length === 0) return
    const next = (activeIndex + delta + options.length) % options.length
    onChange(options[next].value)
    buttonsRef.current[next]?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Home':
        event.preventDefault()
        onChange(options[0].value)
        buttonsRef.current[0]?.focus()
        break
      case 'End': {
        event.preventDefault()
        const last = options.length - 1
        onChange(options[last].value)
        buttonsRef.current[last]?.focus()
        break
      }
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative inline-grid w-fit max-w-full auto-cols-fr grid-flow-col items-stretch',
        'rounded-lg border border-line bg-surface-muted',
        skin.track,
        className,
      )}
    >
      {options.length > 0 ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-md bg-surface shadow-subtle transition-transform duration-150 ease-out"
          style={{
            top: skin.pad,
            bottom: skin.pad,
            left: skin.pad,
            width: `calc((100% - ${skin.pad * 2}px) / ${options.length})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
      ) : null}

      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              buttonsRef.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (activeIndex === 0 && index === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 flex min-w-0 items-center justify-center rounded-md font-medium whitespace-nowrap',
              'outline-accent transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1',
              skin.item,
              selected ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon ? <Icon name={option.icon} size={skin.icon} /> : null}
            <span className="truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
