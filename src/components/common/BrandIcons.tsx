import type { ReactElement } from 'react'
import { cn } from '@/lib/cn'

/**
 * Brand marks.
 *
 * lucide v1 dropped every brand glyph, so the ones this site links to live
 * here. GitHub, LinkedIn and X use the official single-path marks. LeetCode and
 * Codeforces are drawn from their logo geometry rather than copied from memory,
 * which keeps them crisp at 16px and guarantees they never render as a mangled
 * path.
 */

export interface BrandIconProps {
  className?: string
}

export type BrandIconComponent = (props: BrandIconProps) => ReactElement

const BASE = 'size-4 shrink-0'

export function GithubIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn(BASE, className)}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23a11.5 11.5 0 0 1 3-.405c1.02.005 2.045.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

export function LinkedinIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn(BASE, className)}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

export function XIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn(BASE, className)}
    >
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.291 19.49h2.039L6.486 3.24H4.298l13.312 17.403Z" />
    </svg>
  )
}

export function LeetcodeIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn(BASE, className)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14.9 3.1 6.5 11a3.9 3.9 0 0 0 0 5.6l2.6 2.5a4.1 4.1 0 0 0 5.6 0l1.6-1.5" />
        <path d="M10.6 13.4h9.5" />
      </g>
    </svg>
  )
}

export function CodeforcesIcon({ className }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn(BASE, className)}
    >
      <rect x="0" y="7.5" width="6" height="13.5" rx="1.5" />
      <rect x="9" y="3" width="6" height="18" rx="1.5" />
      <rect x="18" y="10.5" width="6" height="10.5" rx="1.5" />
    </svg>
  )
}

const BRAND_ICONS: Record<string, BrandIconComponent> = {
  github: GithubIcon,
  linkedin: LinkedinIcon,
  x: XIcon,
  twitter: XIcon,
  leetcode: LeetcodeIcon,
  codeforces: CodeforcesIcon,
}

/** Resolves a `SocialLink.id` to its mark, or null for ids we have no logo for. */
// eslint-disable-next-line react-refresh/only-export-components
export function brandIconFor(id: string): BrandIconComponent | null {
  return BRAND_ICONS[id.trim().toLowerCase()] ?? null
}
