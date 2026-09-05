import { cn } from '@/lib/cn'

export interface SkeletonProps {
  className?: string
}

/**
 * A shimmering placeholder for content that is about to arrive.
 *
 * Always `aria-hidden`: a screen reader should hear the region's own
 * `aria-busy` / live-region announcement, not a stack of empty boxes. Size it
 * to match the real content so the layout does not jump when it swaps in.
 */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton h-4 w-full', className)} />
}
