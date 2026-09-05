import { useState } from 'react'
import { claimKind, releaseDashboard } from '@/services/dashboardAccess'
import { usePersonalData } from '@/providers/personalDataContext'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

/**
 * Shown for the whole session once someone opens the demo.
 *
 * Deliberately not dismissible. The point is that a visitor can never come away
 * believing they were looking at the owner's real week — and a banner you can
 * close is a banner that gets closed in the first five seconds.
 */
export function DemoBanner() {
  const { actions } = usePersonalData()
  const [leaving, setLeaving] = useState(false)

  if (claimKind() !== 'demo') return null

  async function exit() {
    setLeaving(true)
    await actions.resetEverything()
    releaseDashboard()
    // Full reload so every subscriber restarts from an empty database.
    window.location.reload()
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning sm:px-6"
    >
      <Icon name="TriangleAlert" className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">You are looking at sample data.</span>{' '}
        <span className="text-ink-muted">
          Every task, goal and note below was invented for this demo — it is not anyone&rsquo;s real
          week.
        </span>
      </p>
      <Button size="sm" variant="secondary" onClick={exit} loading={leaving} icon="X">
        Clear the demo
      </Button>
    </div>
  )
}
