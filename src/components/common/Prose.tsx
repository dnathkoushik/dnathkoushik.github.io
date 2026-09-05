import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Typography for long-form content — the About biography, project write-ups,
 * journal entries. There is no typography plugin installed, so the rules live
 * here as child selectors and stay small enough to read in one screen.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[68ch] text-[15px] leading-relaxed text-ink-muted',
        // Headings
        '[&>h2]:mb-3 [&>h2]:mt-10 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-ink',
        '[&>h3]:mb-2 [&>h3]:mt-8 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-ink',
        // Flow
        '[&>p]:mb-4 [&>ul]:mb-4 [&>ol]:mb-4',
        '[&>ul]:list-disc [&>ol]:list-decimal [&>ul]:pl-5 [&>ol]:pl-5',
        '[&_li]:mb-1.5 [&_li]:marker:text-ink-faint',
        // Emphasis and inline code
        '[&_strong]:font-semibold [&_strong]:text-ink',
        '[&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1.5 [&_code]:py-0.5',
        '[&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-ink',
        // Links
        '[&_a]:text-accent [&_a]:underline [&_a]:decoration-line-strong [&_a]:underline-offset-4',
        '[&_a:hover]:decoration-accent',
        // Blocks
        '[&>blockquote]:mb-4 [&>blockquote]:border-l-2 [&>blockquote]:border-accent',
        '[&>blockquote]:pl-4 [&>blockquote]:italic',
        '[&>hr]:my-8 [&>hr]:border-line',
        // Never leave a dangling margin at either end of the block.
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      {children}
    </div>
  )
}
