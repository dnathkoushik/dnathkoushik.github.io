import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NOINDEX_PREFIX, PERSONAL_NAV, PERSONAL_ROUTES, PUBLIC_NAV } from '@/config/routes'
import type { NavItem } from '@/config/routes'
import type { SearchResultKind } from '@/types'
import { useOptionalPersonalData } from '@/providers/personalDataContext'
import { useTheme } from '@/providers/ThemeProvider'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatYearMonth, relativeDay, todayISO, weekKeyOf } from '@/utils/date'
import { searchEverything } from '@/utils/search'
import { cn } from '@/lib/cn'

/** Query length is capped so a paste of a whole paragraph cannot stall the index. */
const MAX_QUERY = 120
const SEARCH_LIMIT = 20
const DEBOUNCE_MS = 120

const IS_APPLE =
  typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)

const KIND_LABEL: Record<SearchResultKind, string> = {
  page: 'Pages',
  project: 'Projects',
  skill: 'Skills',
  experience: 'Experience',
  achievement: 'Achievements',
  task: 'Tasks',
  log: 'Work log',
  goal: 'Goals',
  note: 'Notes',
  review: 'Reviews',
  habit: 'Habits',
  company: 'Companies',
  contact: 'Contacts',
  opportunity: 'Opportunities',
}

const KIND_ICON: Record<SearchResultKind, string> = {
  page: 'Compass',
  project: 'FolderGit2',
  skill: 'Layers',
  experience: 'Briefcase',
  achievement: 'Trophy',
  task: 'ListTodo',
  log: 'Clock',
  goal: 'Target',
  note: 'StickyNote',
  review: 'ClipboardList',
  habit: 'Flame',
  company: 'Building2',
  contact: 'Users',
  opportunity: 'Funnel',
}

/** Singular form, used as the per-row kind chip. */
const KIND_BADGE: Record<SearchResultKind, string> = {
  page: 'Page',
  project: 'Project',
  skill: 'Skill',
  experience: 'Role',
  achievement: 'Award',
  task: 'Task',
  log: 'Log',
  goal: 'Goal',
  note: 'Note',
  review: 'Review',
  habit: 'Habit',
  company: 'Company',
  contact: 'Contact',
  opportunity: 'Role',
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const YEAR_MONTH = /^\d{4}-\d{2}$/

/** Dates arrive as ISO days (private records) or year-months (portfolio entries). */
function formatMeta(value: string | undefined): string | undefined {
  if (!value) return undefined
  if (ISO_DATE.test(value)) return relativeDay(value)
  if (YEAR_MONTH.test(value)) return formatYearMonth(value)
  return value
}

interface PaletteItem {
  id: string
  label: string
  hint?: string
  icon: string
  /** Marks a row as coming from the owner's private data. */
  private: boolean
  /** Right-aligned metadata: usually a date. */
  meta?: string
  /** Right-aligned chip naming the kind of record this row came from. */
  kind?: string
  run: () => void
}

interface PaletteSection {
  id: string
  label: string
  items: PaletteItem[]
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled])'

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * One search box for the whole product.
 *
 * It indexes the public portfolio always, and the private dashboard only when
 * it is mounted inside `PersonalDataProvider` and unlocked — `searchEverything`
 * takes `null` for the database and quietly returns public results, so the same
 * component serves both spaces without ever leaking one into the other.
 *
 * The listbox is `aria-activedescendant`-driven rather than roving-tabindex:
 * focus never leaves the input, which is what lets you keep typing while the
 * arrow keys move the selection.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const baseId = useId()
  const listboxId = `palette-listbox-${baseId}`
  const optionId = useCallback((index: number) => `palette-option-${baseId}-${index}`, [baseId])

  const navigate = useNavigate()
  const location = useLocation()
  const { cycle } = useTheme()
  const { toast } = useToast()
  const personal = useOptionalPersonalData()
  const isTouch = useMediaQuery('(pointer: coarse)')

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  /** Previous values, so the selection can be reset during render. */
  const [lastOpen, setLastOpen] = useState(open)
  const [lastQuery, setLastQuery] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const trimmedQuery = debouncedQuery.trim()

  // A locked or still-loading dashboard has nothing readable in it, so the
  // palette degrades to the public index rather than showing stale rows.
  const db = personal && personal.status === 'ready' ? personal.db : null
  const inDashboard = location.pathname.startsWith(NOINDEX_PREFIX)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  useKeyboardShortcut('mod+k', () => onOpenChange(!open))

  const goTo = useCallback(
    (href: string) => {
      close()
      navigate(href)
    },
    [close, navigate],
  )

  const navItemToPalette = useCallback(
    (item: NavItem, isPrivate: boolean): PaletteItem => ({
      id: `nav:${item.href}`,
      label: item.label,
      hint: item.description,
      icon: item.icon,
      private: isPrivate,
      run: () => goTo(item.href),
    }),
    [goTo],
  )

  const quickActions = useMemo<PaletteItem[]>(() => {
    const weekStartsOn = db?.settings.weekStartsOn ?? 1
    const weekKey = weekKeyOf(todayISO(), weekStartsOn)

    return [
      {
        id: 'action:add-task',
        label: 'Add a task for today',
        hint: "Opens today's quick-add box",
        icon: 'Plus',
        private: true,
        run: () => goTo(PERSONAL_ROUTES.today),
      },
      {
        id: 'action:review',
        label: "Open this week's review",
        hint: weekKey,
        icon: 'ClipboardList',
        private: true,
        run: () => goTo(`${PERSONAL_ROUTES.review}?week=${weekKey}`),
      },
      {
        id: 'action:theme',
        label: 'Toggle theme',
        hint: 'Light, dark, or follow the system',
        icon: 'Palette',
        private: false,
        run: () => {
          cycle()
          close()
        },
      },
      {
        id: 'action:copy-link',
        label: 'Copy link to this page',
        hint: location.pathname,
        icon: 'Link',
        private: false,
        run: () => {
          const url = window.location.href
          close()
          const clipboard = navigator.clipboard
          if (!clipboard) {
            toast({ title: 'Clipboard unavailable', description: url, tone: 'warning' })
            return
          }
          clipboard.writeText(url).then(
            () => toast({ title: 'Link copied', description: url, tone: 'positive' }),
            () => toast({ title: 'Could not copy the link', description: url, tone: 'danger' }),
          )
        },
      },
    ]
  }, [close, cycle, db, goTo, location.pathname, toast])

  const sections = useMemo<PaletteSection[]>(() => {
    if (trimmedQuery.length === 0) {
      const primary = inDashboard ? PERSONAL_NAV : PUBLIC_NAV
      const crossLink = inDashboard ? PUBLIC_NAV[0] : PERSONAL_NAV[0]

      return [
        { id: 'quick', label: 'Quick actions', items: quickActions },
        {
          id: 'destinations',
          label: 'Go to',
          items: [
            ...primary.map((item) => navItemToPalette(item, inDashboard)),
            navItemToPalette(crossLink, !inDashboard),
          ],
        },
      ]
    }

    const results = searchEverything(trimmedQuery, db, SEARCH_LIMIT)
    const byKind = new Map<SearchResultKind, PaletteItem[]>()

    for (const result of results) {
      const item: PaletteItem = {
        id: `${result.kind}:${result.id}`,
        label: result.title,
        hint: result.subtitle,
        icon: KIND_ICON[result.kind],
        private: result.private,
        kind: KIND_BADGE[result.kind],
        meta: formatMeta(result.date),
        run: () => goTo(result.href),
      }
      const bucket = byKind.get(result.kind)
      if (bucket) bucket.push(item)
      else byKind.set(result.kind, [item])
    }

    // Insertion order is relevance order, because `searchEverything` already
    // interleaved the kinds by their best hit.
    return [...byKind.entries()].map(([kind, items]) => ({
      id: kind,
      label: KIND_LABEL[kind],
      items,
    }))
  }, [db, goTo, inDashboard, navItemToPalette, quickActions, trimmedQuery])

  const flatItems = useMemo(() => sections.flatMap((section) => section.items), [sections])

  /*
   * Both resets are done while rendering rather than in an effect: a new query
   * or a fresh open must never paint one frame with the previous selection, and
   * Enter must never fire whatever happened to sit at the old index. React
   * discards this render and immediately re-runs it, so nothing is committed
   * with the stale value. The clamp below covers the other way the list can
   * shrink — a private record edited in another tab.
   */
  if (lastQuery !== trimmedQuery) {
    setLastQuery(trimmedQuery)
    setActiveIndex(0)
  }

  if (lastOpen !== open) {
    setLastOpen(open)
    setQuery('')
    setActiveIndex(0)
  }

  const selectedIndex = flatItems.length === 0 ? -1 : Math.min(activeIndex, flatItems.length - 1)

  useEffect(() => {
    if (!open) return
    // Captured before focus moves into the input, so this is still the button
    // (or whatever had focus when Cmd+K was pressed) that opened the palette.
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  // Return focus to whatever opened the palette — the header button, a sidebar
  // control, or the element that had focus when Cmd+K was pressed.
  useEffect(() => {
    if (open) return
    const target = returnFocusRef.current
    returnFocusRef.current = null
    if (target && document.contains(target)) target.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open || selectedIndex < 0) return
    const element = document.getElementById(optionId(selectedIndex))
    element?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, open, optionId])

  const move = (delta: number) => {
    if (flatItems.length === 0) return
    const next = selectedIndex + delta
    if (next < 0) setActiveIndex(flatItems.length - 1)
    else if (next >= flatItems.length) setActiveIndex(0)
    else setActiveIndex(next)
  }

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        close()
        return
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        return
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        return
      case 'Home':
        if (flatItems.length === 0) return
        event.preventDefault()
        setActiveIndex(0)
        return
      case 'End':
        if (flatItems.length === 0) return
        event.preventDefault()
        setActiveIndex(flatItems.length - 1)
        return
      case 'Enter': {
        const item = flatItems[selectedIndex]
        if (!item) return
        event.preventDefault()
        item.run()
        return
      }
      case 'Tab': {
        // Focus stays inside the panel; there is nowhere useful to tab to.
        const panel = panelRef.current
        if (!panel) return
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (element) => element.getClientRects().length > 0,
        )
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        const active = document.activeElement
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
        return
      }
      default:
        return
    }
  }

  if (!open) return null

  let cursor = -1

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-center sm:items-start sm:p-6 sm:pt-[12vh]"
      onKeyDown={handleKeyDown}
      onMouseDown={(event) => {
        if (event.target === backdropRef.current) close()
      }}
    >
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="absolute inset-0 bg-[oklch(0%_0_0_/_0.45)] dark:bg-[oklch(0%_0_0_/_0.7)]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className={cn(
          'relative flex h-full w-full flex-col overflow-hidden bg-surface',
          'sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-card sm:border sm:border-line sm:shadow-overlay',
          'animate-pop',
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:py-3">
          <Icon name="Search" className="size-4 text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY))}
            placeholder={
              inDashboard
                ? 'Search tasks, goals, notes, pages…'
                : 'Search projects, skills, pages…'
            }
            aria-label="Search"
            role="combobox"
            aria-expanded={flatItems.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={selectedIndex >= 0 ? optionId(selectedIndex) : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md bg-transparent text-[15px] text-ink placeholder:text-ink-faint sm:text-sm"
          />
          {query.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="inline-flex size-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <Icon name="X" className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={close}
            aria-label="Close search"
            className="inline-flex size-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink sm:hidden"
          >
            <Icon name="X" className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {flatItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink">
                Nothing matches “{trimmedQuery}”
              </p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-ink-muted">
                {db
                  ? 'Searchable: pages, projects, skills, roles, achievements, and your tasks, goals, notes, habits and reviews.'
                  : 'Searchable: pages, projects, skills, roles and achievements. Open the dashboard to search your own records too.'}
              </p>
            </div>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Results" className="pb-2">
              {sections.map((section) => (
                <li key={section.id} role="presentation">
                  <p
                    className="sticky top-0 z-10 bg-surface px-4 pt-3 pb-1.5 text-[11px] font-semibold tracking-wide text-ink-faint uppercase"
                    role="presentation"
                  >
                    {section.label}
                  </p>
                  <ul role="group" aria-label={section.label}>
                    {section.items.map((item) => {
                      cursor += 1
                      const index = cursor
                      const selected = index === selectedIndex
                      return (
                        /*
                         * The ARIA combobox pattern puts the options outside
                         * the tab order on purpose: focus stays in the input so
                         * you can keep typing, and the arrow keys plus
                         * `aria-activedescendant` do the selecting. The click
                         * handler is the pointer equivalent of Enter, not the
                         * only way to reach the row.
                         */
                        <li
                          key={item.id}
                          id={optionId(index)}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={item.run}
                          className={cn(
                            'mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors',
                            selected ? 'bg-accent-soft' : 'hover:bg-surface-hover',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-7 shrink-0 place-items-center rounded-md',
                              selected
                                ? 'bg-accent text-accent-ink'
                                : 'bg-surface-muted text-ink-faint',
                            )}
                          >
                            <Icon name={item.icon} className="size-4" />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium text-ink">
                                {item.label}
                              </span>
                              {item.private ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-muted px-1.5 text-[10px] font-medium text-ink-faint">
                                  <Icon name="Lock" size={9} />
                                  Private
                                </span>
                              ) : null}
                            </span>
                            {item.hint ? (
                              <span className="mt-0.5 block truncate text-xs text-ink-muted">
                                {item.hint}
                              </span>
                            ) : null}
                          </span>

                          {item.kind ? (
                            <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-ink-faint uppercase">
                              {item.kind}
                            </span>
                          ) : null}

                          {item.meta ? (
                            <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">
                              {item.meta}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isTouch ? null : (
          <div className="hidden items-center gap-4 border-t border-line bg-surface-muted/50 px-4 py-2 text-[11px] text-ink-faint sm:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↑</kbd>
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">↵</kbd>
              to open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">esc</kbd>
              to close
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <kbd className="rounded border border-line bg-surface px-1 font-mono">
                {IS_APPLE ? '⌘' : 'Ctrl'}
              </kbd>
              <kbd className="rounded border border-line bg-surface px-1 font-mono">K</kbd>
            </span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
