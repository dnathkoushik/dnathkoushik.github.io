import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { SkipLink } from '@/components/common/SkipLink'
import { CommandPalette } from '@/components/nav/CommandPalette'
import { PublicFooter } from '@/components/nav/PublicFooter'
import { PublicHeader } from '@/components/nav/PublicHeader'

/**
 * Chrome for every public page.
 *
 * A full-height flex column so a short page (404, a nearly-empty Achievements)
 * still pins its footer to the bottom of the viewport instead of leaving a band
 * of bare canvas under it.
 *
 * The command palette lives here rather than inside the header because it is
 * openable two ways — the header's search button and Cmd/Ctrl+K from anywhere —
 * and only a common ancestor can own that single piece of state.
 */
export function PublicLayout() {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas">
      <SkipLink />
      <PublicHeader onOpenSearch={() => setSearchOpen(true)} />

      <main id="main-content" className="flex-1">
        <Outlet />
      </main>

      <PublicFooter />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  )
}
