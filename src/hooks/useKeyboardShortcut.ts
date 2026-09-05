import { useEffect, useMemo, useRef } from 'react'

/**
 * Spellings people actually write, mapped to the value `KeyboardEvent.key`
 * reports (already lowercased).
 */
const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  del: 'delete',
  return: 'enter',
  space: ' ',
  spacebar: ' ',
  plus: '+',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
}

/** What each punctuation key produces once Shift is held on a US layout. */
const SHIFTED: Record<string, string> = {
  '/': '?',
  '.': '>',
  ',': '<',
  ';': ':',
  "'": '"',
  '[': '{',
  ']': '}',
  '\\': '|',
  '-': '_',
  '=': '+',
  '`': '~',
  '1': '!',
  '2': '@',
  '3': '#',
  '4': '$',
  '5': '%',
  '6': '^',
  '7': '&',
  '8': '*',
  '9': '(',
  '0': ')',
}

interface ParsedCombo {
  key: string
  alt: boolean
  shift: boolean
  /** Cmd on Apple platforms, Ctrl everywhere else. */
  mod: boolean
  ctrl: boolean
  meta: boolean
  /** True when the combo needs a command-style modifier, not just Shift. */
  hasCommandModifier: boolean
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  // A trailing '+' ("mod++") leaves no key part; treat '+' as the key.
  const rawKey = parts.length > 0 ? parts[parts.length - 1] : '+'
  const modifiers = parts.slice(0, -1)

  const parsed: ParsedCombo = {
    key: KEY_ALIASES[rawKey] ?? rawKey,
    alt: modifiers.includes('alt') || modifiers.includes('option'),
    shift: modifiers.includes('shift'),
    mod: modifiers.includes('mod'),
    ctrl: modifiers.includes('ctrl') || modifiers.includes('control'),
    meta: modifiers.includes('meta') || modifiers.includes('cmd') || modifiers.includes('command'),
    hasCommandModifier: false,
  }
  parsed.hasCommandModifier = parsed.mod || parsed.ctrl || parsed.meta || parsed.alt
  return parsed
}

/** True while focus is somewhere the user is composing text. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function modifiersMatch(combo: ParsedCombo, event: KeyboardEvent, apple: boolean): boolean {
  const wantCtrl = combo.ctrl || (combo.mod && !apple)
  const wantMeta = combo.meta || (combo.mod && apple)
  return (
    event.ctrlKey === wantCtrl &&
    event.metaKey === wantMeta &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift
  )
}

function keyMatches(combo: ParsedCombo, event: KeyboardEvent): boolean {
  const pressed = event.key.toLowerCase()
  if (pressed === combo.key) return true
  // 'shift+/' is typed as '?' on a US layout, and similar for the number row.
  if (combo.shift && SHIFTED[combo.key] === pressed) return true
  // Physical-key fallback so single letters still work on non-US layouts.
  if (combo.key.length === 1 && combo.key >= 'a' && combo.key <= 'z') {
    return event.code === `Key${combo.key.toUpperCase()}`
  }
  return false
}

/**
 * Binds a global keyboard shortcut.
 *
 * Combos look like 'mod+k', 'shift+/', 'escape' or plain 'n'. `mod` resolves to
 * Cmd on Apple platforms and Ctrl elsewhere. Shortcuts without a command
 * modifier are suppressed while the user is typing in a field, so pressing 'n'
 * inside a task title never opens the new-task dialog. The handler is held in a
 * ref, so callers do not need `useCallback` and the listener is attached once.
 */
export function useKeyboardShortcut(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  enabled = true,
) {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })

  const parsed = useMemo(() => parseCombo(combo), [combo])

  useEffect(() => {
    if (!enabled) return
    const apple = isApplePlatform()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      // Mid-IME composition: the keystroke belongs to the text, not to us.
      if (event.isComposing || event.keyCode === 229) return
      if (!parsed.hasCommandModifier && isTypingTarget(event.target)) return
      if (!modifiersMatch(parsed, event, apple)) return
      if (!keyMatches(parsed, event)) return

      // Command-style combos are deliberate app shortcuts, so the browser
      // default (Cmd+K opening the address bar, for one) is suppressed here.
      if (parsed.hasCommandModifier) event.preventDefault()
      handlerRef.current(event)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [parsed, enabled])
}
