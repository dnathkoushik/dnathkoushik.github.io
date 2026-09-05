import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ROUTER_BASENAME } from '@/config/app'
import { PERSONAL_ROUTES, PUBLIC_ROUTES } from '@/config/routes'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { RouteFallback } from '@/components/common/RouteFallback'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { PublicLayout } from '@/layouts/PublicLayout'

/*
 * The public portfolio is the first thing a visitor sees, so Home ships in the
 * initial chunk. Everything else — and the entire dashboard, which drags in
 * Recharts and the private data layer — is split out and fetched on demand.
 */
import HomePage from '@/pages/public/HomePage'

const AboutPage = lazy(() => import('@/pages/public/AboutPage'))
const SkillsPage = lazy(() => import('@/pages/public/SkillsPage'))
const ProjectsPage = lazy(() => import('@/pages/public/ProjectsPage'))
const ExperiencePage = lazy(() => import('@/pages/public/ExperiencePage'))
const AchievementsPage = lazy(() => import('@/pages/public/AchievementsPage'))
const GithubPage = lazy(() => import('@/pages/public/GithubPage'))
const ContactPage = lazy(() => import('@/pages/public/ContactPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

const PersonalLayout = lazy(() =>
  import('@/layouts/PersonalLayout').then((m) => ({ default: m.PersonalLayout })),
)
const OverviewPage = lazy(() => import('@/pages/personal/OverviewPage'))
const TodayPage = lazy(() => import('@/pages/personal/TodayPage'))
const CalendarPage = lazy(() => import('@/pages/personal/CalendarPage'))
const GoalsPage = lazy(() => import('@/pages/personal/GoalsPage'))
const HabitsPage = lazy(() => import('@/pages/personal/HabitsPage'))
const AnalyticsPage = lazy(() => import('@/pages/personal/AnalyticsPage'))
const JournalPage = lazy(() => import('@/pages/personal/JournalPage'))
const ReviewPage = lazy(() => import('@/pages/personal/ReviewPage'))
const TimelinePage = lazy(() => import('@/pages/personal/TimelinePage'))
const SettingsPage = lazy(() => import('@/pages/personal/SettingsPage'))

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<PublicLayout />}>
                  <Route path={PUBLIC_ROUTES.home} element={<HomePage />} />
                  <Route path={PUBLIC_ROUTES.about} element={<AboutPage />} />
                  <Route path={PUBLIC_ROUTES.skills} element={<SkillsPage />} />
                  <Route path={PUBLIC_ROUTES.projects} element={<ProjectsPage />} />
                  <Route path={PUBLIC_ROUTES.experience} element={<ExperiencePage />} />
                  <Route path={PUBLIC_ROUTES.achievements} element={<AchievementsPage />} />
                  <Route path={PUBLIC_ROUTES.github} element={<GithubPage />} />
                  <Route path={PUBLIC_ROUTES.contact} element={<ContactPage />} />

                  {/* Loose aliases people type by hand. */}
                  <Route path="/home" element={<Navigate to={PUBLIC_ROUTES.home} replace />} />
                  <Route path="/resume" element={<Navigate to={PUBLIC_ROUTES.about} replace />} />

                  {/* Unknown paths keep the public chrome so there is a way out. */}
                  <Route path="*" element={<NotFoundPage />} />
                </Route>

                <Route path={PERSONAL_ROUTES.dashboard} element={<PersonalLayout />}>
                  <Route index element={<OverviewPage />} />
                  <Route path="today" element={<TodayPage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="goals" element={<GoalsPage />} />
                  <Route path="habits" element={<HabitsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="review" element={<ReviewPage />} />
                  <Route path="timeline" element={<TimelinePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  )
}
