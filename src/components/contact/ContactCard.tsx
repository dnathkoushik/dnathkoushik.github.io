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
  github: <GithubIcon className="size-[18px]" />,
  linkedin: <LinkedinIcon className="size-[18px]" />,
  x: <XIcon className="size-[18px]" />,
  twitter: <XIcon className="size-[18px]" />,
  leetcode: <LeetcodeIcon className="size-[18px]" />,
  codeforces: <CodeforcesIcon className="size-[18px]" />,
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
 * above it on its own layer and gets its own focus stop.
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
        description: 'The browser refused clipboard access, so the address is selected — press Ctrl or Cmd + C.',
        tone: 'warning',
        duration: 7000,
      })
    }
  }, [copyValue, selectHandle, toast])

  const key = link.id.trim().toLowerCase()
  const glyph = BRAND_GLYPH[key] ?? <Icon name={FALLBACK_ICON[key] ?? 'Link'} size={18} />
  const external = /^https?:/i.test(link.href)

  return (
    <Card interactive className={cn('relative isolate h-full', className)}>
      <CardContent className="flex items-center gap-3.5 py-4">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"
        >
          {glyph}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            <a
              href={link.href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="after:absolute after:inset-0 after:z-0 after:content-['']"
            >
              {link.label}
              {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
            </a>
          </p>
          <p ref={handleRef} className="truncate font-mono text-xs text-ink-faint">
            {link.handle}
          </p>
        </div>

        {copyValue ? (
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10"
            icon={copied ? 'Check' : 'Copy'}
            aria-label={`Copy ${copyValue} to the clipboard`}
            onClick={() => {
              void copy()
            }}
          />
        ) : (
          <Icon name="ArrowUpRight" size={15} className="text-ink-faint" />
        )}
      </CardContent>
    </Card>
  )
}
