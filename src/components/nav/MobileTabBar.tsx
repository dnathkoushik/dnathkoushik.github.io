import { NavLink } from 'react-router-dom'
import { PERSONAL_NAV, PERSONAL_ROUTES } from '@/config/routes'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/cn'

/**
 * The five destinations that carry a normal day. Everything else — analytics,
 * journal, review, timeline, settings — is a place you go deliberately, and
 * lives one tap deeper in the sidebar sheet.
 */
const TAB_HREFS: string[] = [
  PERSONAL_ROUTES.dashboard,
  PERSONAL_ROUTES.today,
  PERSONAL_ROUTES.calendar,
  PERSONAL_ROUTES.goals,
  PERSONAL_ROUTES.habits,
]

const TABS = TAB_HREFS.map((href) => {
  const item = PERSONAL_NAV.find((entry) => entry.href === href)
  return {
    href,
    label: item?.label ?? href,
    icon: item?.icon ?? 'Circle',
    end: item?.end,
  }
})

/**
 * The dashboard's bottom navigation on phones.
 *
 * Fixed to the bottom, above the home indicator, with 44px+ targets and the
 * active tab in accent. `PersonalLayout` pads its content by the same height so
 * the bar never covers the last row of a list.
 */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Dashboard sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch">
        {TABS.map((tab) => (
          <li key={tab.href} className="flex-1">
            <NavLink
              to={tab.href}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors',
                  isActive ? 'text-accent' : 'text-ink-faint hover:text-ink',
                )
              }
            >
              {/* NavLink applies aria-current="page" to the active link. */}
              <Icon name={tab.icon} className="size-[19px]" />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
