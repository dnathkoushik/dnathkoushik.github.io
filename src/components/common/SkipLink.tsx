import type { MouseEvent } from 'react'

/**
 * The first thing in the tab order: jumps keyboard and screen-reader users
 * straight past the navigation. Invisible until focused (`.sr-only-focusable`),
 * then rendered as a real button so it is obvious where focus went.
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId)
    if (!target) return

    // The default anchor jump moves the viewport but not focus, so the next Tab
    // would drop the user back at the top of the navigation.
    event.preventDefault()
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: true })
    target.scrollIntoView({ block: 'start' })
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only-focusable absolute left-4 top-4 z-50 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-ink shadow-raised"
    >
      Skip to main content
    </a>
  )
}
