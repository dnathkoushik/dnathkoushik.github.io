import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SkipLink } from '@/components/common/SkipLink'
import { CommandPalette } from '@/components/nav/CommandPalette'
import { PublicFooter } from '@/components/nav/PublicFooter'
import { PublicHeader } from '@/components/nav/PublicHeader'
import {
  Cursor,
  Grain,
  PageTransition,
  Preloader,
  ScrollProgress,
  SmoothScrollProvider,
} from '@/motion'

/**
 * Chrome for every public page.
 *
 * A full-height flex column so a short page (404, a nearly-empty Achievements)
 * still pins its footer to the bottom of the viewport instead of leaving a band
 * of bare canvas under it.
 *
 * The motion shell lives here and nowhere else:
 *  - `SmoothScrollProvider` owns Lenis and is the outermost thing, so the
 *    header, footer and preloader can all reach `useLenis()`;
 *  - `PageTransition` wraps the Outlet directly (it freezes the route context
 *    of the outgoing page under its curtain, so it must be the Outlet's parent);
 *  - the fixed layers (progress bar, cursor, grain, preloader) are siblings of
 *    the content so none of them is clipped by a page's stacking context.
 *
 * Layering, bottom to top: header z-40 · command palette z-50 · full-screen
 * menu z-60 · grain z-80 · transition curtain z-90 · progress bar z-95 ·
 * preloader z-100 · cursor z-110. The header sits BELOW z-50 on purpose: the
 * skip link is `absolute top-4 left-4 z-50` and lands exactly on the brand
 * pill, so anything higher would hide it the moment it received focus.
 *
 * The command palette lives here rather than inside the header because it is
 * openable two ways — the header's search button and Cmd/Ctrl+K from anywhere —
 * and only a common ancestor can own that single piece of state.
 */
export function PublicLayout() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <SmoothScrollProvider>
      <div className="flex min-h-[100dvh] flex-col bg-canvas">
        <SkipLink />
        <ScrollProgress />
        <PublicHeader onOpenSearch={() => setSearchOpen(true)} />

        <main id="main-content" className="flex-1">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <PublicFooter />
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

        <Cursor />
        <Grain />
        <Preloader />
      </div>
    </SmoothScrollProvider>
  )
}
