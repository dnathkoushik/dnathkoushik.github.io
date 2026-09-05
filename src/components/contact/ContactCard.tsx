import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { SocialLink } from '@/types'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import {
  CodeforcesIcon,
  GithubIcon,
  LeetcodeIcon,
  LinkedinIcon,
  XIcon,
} from '@/components/common/BrandIcons'
import { cn } from '@/lib/cn'

/*
 * Brand marks are stored as ready-made elements rather than as components
 * looked up during render: an element is an immutable descriptor, so nothing is
 * re-created on every keystroke and the glyph keeps a stable identity.
 */
const BRAND_GLYPH: Record<string, ReactNode> = {
  github: <GithubIcon className="size-5" />,
  linkedin: <LinkedinIcon className="size-5" />,
  x: <XIcon className="size-5" />,
  twitter: <XIcon className="size-5" />,
  leetcode: <LeetcodeIcon className="size-5" />,
  codeforces: <CodeforcesIcon className="size-5" />,
}

/** Lucide fallbacks for ids that have no brand mark. */
const FALLBACK_ICON: Record<string, string> = {
  email: 'Mail',
  mail: 'Mail',
  website: 'Globe',
  blog: 'Notebook',
  phone: 'Phone',
  resume: 'FileText',
}

export interface ContactCardProps {
  link: SocialLink
  /**
   * Shows a copy button that puts this exact string on the clipboard. Used for
   * the email address, where copying is what people actually want.
   */
  copyValue?: string
  className?: string
}

/**
 * One way to reach me.
 *
 * The label is the link and its `::after` covers the card, so the whole tile is
 * clickable while the copy button — which is a different action entirely — sits
 * above it on its own layer and gets its own focus stop. The brand mark turns a
 * few degrees and the arrow steps toward the corner on hover; with motion off
 * the border, the underline colour and the arrow itself still say "this opens".
 *
 * `navigator.clipboard` is unavailable on an insecure origin and can be refused
 * outright by the browser, so the failure path is real rather than a silent
 * no-op: the address is selected in place and the toast says to press Ctrl+C.
 */
export function ContactCard({ link, copyValue, className }: ContactCardProps) {
  const { toast } = useToast()
  const handleRef = useRef<HTMLParagraphElement>(null)
  const timerRef = useRef<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const selectHandle = useCallback(() => {
    const node = handleRef.current
    const selection = typeof window !== 'undefined' ? window.getSelection() : null
    if (!node || !selection) return
    const range = document.createRange()
    range.selectNodeContents(node)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [])

  const copy = useCallback(async () => {
    if (!copyValue) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(copyValue)
      setCopied(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setCopied(false), 2000)
      toast({ title: 'Copied to clipboard', description: copyValue, tone: 'positive' })
    } catch {
      selectHandle()
      toast({
        title: 'Copy it by hand',
        description:
          'The browser refused clipboard access, so the address is selected — press Ctrl or Cmd + C.',
        tone: 'warning',
        duration: 7000,
      })
    }
  }, [copyValue, selectHandle, toast])

  const key = link.id.trim().toLowerCase()
  const glyph = BRAND_GLYPH[key] ?? <Icon name={FALLBACK_ICON[key] ?? 'Link'} size={20} />
  const external = /^https?:/i.test(link.href)

  return (
    <Card
      interactive
      data-cursor="Open"
      className={cn('group relative isolate h-full hover:border-line-strong', className)}
    >
      <CardContent className="flex items-center gap-4 py-5 sm:px-6 sm:py-6">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-muted text-ink',
            'transition-transform duration-300 ease-out group-hover:rotate-[8deg] group-hover:border-line-strong',
          )}
        >
          {glyph}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none font-medium tracking-tight text-ink sm:text-2xl">
            <a
              href={link.href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={cn(
                'after:absolute after:inset-0 after:z-0 after:content-[""]',
                'underline decoration-line decoration-1 underline-offset-[6px] transition-colors duration-200',
                'group-hover:decoration-line-strong',
              )}
            >
              {link.label}
              {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
            </a>
          </p>
          <p
            ref={handleRef}
            className="mt-2.5 truncate font-mono text-xs tracking-[0.06em] text-ink-faint"
          >
            {link.handle}
          </p>
        </div>

        {copyValue ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10"
            data-cursor="Copy"
            icon={copied ? 'Check' : 'Copy'}
            aria-label={`Copy ${copyValue} to the clipboard`}
            onClick={() => {
              void copy()
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full border border-line text-ink-faint',
              'transition-[transform,color,border-color] duration-300 ease-out',
              'group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:border-line-strong group-hover:text-ink',
            )}
          >
            <Icon name="ArrowUpRight" size={16} />
          </span>
        )}
      </CardContent>
    </Card>
  )
}
