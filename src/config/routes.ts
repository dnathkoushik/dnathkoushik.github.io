/**
 * Single source of truth for every route path and for both navigation menus.
 *
 * Components must import from here rather than writing string literals, so that
 * renaming a route is a one-line change and the sitemap stays in sync.
 */

export const PUBLIC_ROUTES = {
  home: '/',
  about: '/about',
  skills: '/skills',
  projects: '/projects',
  experience: '/experience',
  achievements: '/achievements',
  github: '/github',
  contact: '/contact',
} as const

export const PERSONAL_ROUTES = {
  dashboard: '/dashboard',
  today: '/dashboard/today',
  calendar: '/dashboard/calendar',
  goals: '/dashboard/goals',
  habits: '/dashboard/habits',
  analytics: '/dashboard/analytics',
  journal: '/dashboard/journal',
  review: '/dashboard/review',
  timeline: '/dashboard/timeline',
  settings: '/dashboard/settings',
} as const

export type PublicRoute = (typeof PUBLIC_ROUTES)[keyof typeof PUBLIC_ROUTES]
export type PersonalRoute = (typeof PERSONAL_ROUTES)[keyof typeof PERSONAL_ROUTES]

export interface NavItem {
  label: string
  href: string
  /** Lucide icon name, resolved through components/ui/Icon.tsx. */
  icon: string
  /** Short description used by the command palette. */
  description: string
  /** Match the route exactly instead of by prefix (used for index routes). */
  end?: boolean
}

export const PUBLIC_NAV: NavItem[] = [
  { label: 'Home', href: PUBLIC_ROUTES.home, icon: 'House', description: 'Intro and current focus', end: true },
  { label: 'About', href: PUBLIC_ROUTES.about, icon: 'User', description: 'Background, education, philosophy' },
  { label: 'Skills', href: PUBLIC_ROUTES.skills, icon: 'Layers', description: 'Languages, tools and CS fundamentals' },
  { label: 'Projects', href: PUBLIC_ROUTES.projects, icon: 'FolderGit2', description: 'Things I have designed and shipped' },
  { label: 'Experience', href: PUBLIC_ROUTES.experience, icon: 'Briefcase', description: 'Roles and what I did in them' },
  { label: 'Achievements', href: PUBLIC_ROUTES.achievements, icon: 'Trophy', description: 'Contests, certifications, milestones' },
  { label: 'GitHub', href: PUBLIC_ROUTES.github, icon: 'GitBranch', description: 'Public repositories and activity' },
  { label: 'Contact', href: PUBLIC_ROUTES.contact, icon: 'Mail', description: 'Ways to reach me' },
]

export const PERSONAL_NAV: NavItem[] = [
  { label: 'Overview', href: PERSONAL_ROUTES.dashboard, icon: 'LayoutDashboard', description: 'Where everything stands right now', end: true },
  { label: 'Today', href: PERSONAL_ROUTES.today, icon: 'ListTodo', description: "Today's targets and work log" },
  { label: 'Calendar', href: PERSONAL_ROUTES.calendar, icon: 'CalendarDays', description: 'Browse any day of any month' },
  { label: 'Goals', href: PERSONAL_ROUTES.goals, icon: 'Target', description: 'Weekly and monthly goals' },
  { label: 'Habits', href: PERSONAL_ROUTES.habits, icon: 'Flame', description: 'Consistency heatmap and streaks' },
  { label: 'Analytics', href: PERSONAL_ROUTES.analytics, icon: 'ChartColumn', description: 'Trends computed from your own data' },
  { label: 'Journal', href: PERSONAL_ROUTES.journal, icon: 'NotebookPen', description: 'Work log entries and notes' },
  { label: 'Weekly review', href: PERSONAL_ROUTES.review, icon: 'ClipboardList', description: 'End-of-week retrospective' },
  { label: 'Timeline', href: PERSONAL_ROUTES.timeline, icon: 'Activity', description: 'Everything you have done, by day' },
  { label: 'Settings', href: PERSONAL_ROUTES.settings, icon: 'Settings', description: 'Categories, backup, privacy lock' },
]

/** Routes that must never be indexed. Mirrored by `public/robots.txt`. */
export const NOINDEX_PREFIX = '/dashboard'
