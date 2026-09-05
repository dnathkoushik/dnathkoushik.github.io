// @vitest-environment jsdom
/**
 * Route smoke test.
 *
 * Renders every route the router knows about and fails if any of them throws,
 * logs a React error, or renders without a level-one heading. It is deliberately
 * shallow — it asserts that the application actually mounts, not what it says.
 * That is the class of bug a type-check cannot see and a visitor notices
 * immediately.
 *
 * Waiting is done by polling for the finished page rather than by sleeping a
 * fixed amount: the dashboard boots IndexedDB (unavailable here, so it falls
 * back), and the analytics route drags in Recharts, which is slow under jsdom.
 * Fixed sleeps made this flaky, which is worse than having no test at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import App from './App'
import { PERSONAL_ROUTES, PUBLIC_ROUTES } from './config/routes'

// Tells React that `act()` is available; without it every render logs a warning
// through console.error, which is exactly what this test asserts on.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  // jsdom implements none of these, and several components legitimately use them.
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  window.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

const ROUTES = [
  ...Object.values(PUBLIC_ROUTES),
  ...Object.values(PERSONAL_ROUTES),
  '/definitely-not-a-real-page',
]

/** Resolves once `check` passes, or after `timeout` ms — whichever comes first. */
async function settleUntil(check: () => boolean, timeout = 8000) {
  const deadline = Date.now() + timeout
  for (;;) {
    if (check()) return true
    if (Date.now() > deadline) return false
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
    })
  }
}

async function renderRoute(path: string) {
  window.history.pushState({}, '', path)

  const container = document.createElement('div')
  container.id = 'root'
  document.body.appendChild(container)

  let root: Root | undefined
  await act(async () => {
    root = createRoot(container)
    root.render(<App />)
  })

  // The lazily loaded chunk has arrived once a real heading is on screen.
  await settleUntil(() => container.querySelector('h1') !== null)
  // One more turn so any post-mount effect (storage init, focus) can flush.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })

  const html = container.innerHTML

  await act(async () => {
    root?.unmount()
  })
  container.remove()

  return html
}

describe('application routes', () => {
  it.each(ROUTES)(
    'renders %s without crashing',
    async (path) => {
      const errors: string[] = []
      const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.map((a) => String(a)).join(' '))
      })

      // No try/finally: if renderRoute throws, afterEach's restoreAllMocks
      // still cleans the spy up, and the raw failure is the more useful report.
      const html = await renderRoute(path)
      errorSpy.mockRestore()

      expect(errors, `console.error while rendering ${path}:\n${errors.join('\n')}`).toHaveLength(0)
      expect(html.length, `${path} rendered an empty document`).toBeGreaterThan(200)
      expect(html, `${path} rendered no <h1>`).toMatch(/<h1/i)
    },
    20000,
  )
})
