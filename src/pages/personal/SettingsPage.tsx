import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { APP_NAME } from '@/config/app'
import { PERSONAL_ROUTES } from '@/config/routes'
import { githubConfig } from '@/data'
import type { ThemeMode } from '@/providers/ThemeProvider'
import { useTheme } from '@/providers/ThemeProvider'
import { usePersonalData } from '@/providers/personalDataContext'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { PrivacyNotice } from '@/components/personal/PrivacyNotice'
import { CategoryManager } from '@/components/settings/CategoryManager'
import { DataManager } from '@/components/settings/DataManager'
import { GithubSyncPanel } from '@/components/settings/GithubSyncPanel'
import { PrivacyLockPanel } from '@/components/settings/PrivacyLockPanel'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useToast } from '@/components/ui/Toast'

/** Mirrors the `version` field in package.json. */
const APP_VERSION = '1.0.0'

const README_URL = `https://github.com/${githubConfig.username}/portfolio-os#privacy-what-is-and-is-not-private`

const THEME_OPTIONS: { value: ThemeMode; label: string; icon?: string }[] = [
  { value: 'light', label: 'Light', icon: 'Sun' },
  { value: 'dark', label: 'Dark', icon: 'Moon' },
  { value: 'system', label: 'System', icon: 'Monitor' },
]

const WEEK_OPTIONS: { value: '0' | '1'; label: string; icon?: string }[] = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
]

interface Draft {
  displayName: string
  weekStartsOn: '0' | '1'
  dailyHoursTarget: string
  dailyTaskTarget: string
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle as="h2" id={id}>
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  )
}

/**
 * Everything about how the dashboard behaves, and everything about where its
 * data lives.
 *
 * The order is deliberate: the things you change often are at the top, and the
 * two sections that can destroy data — backup/restore and the privacy lock —
 * are further down, each with the consequences written out in plain words
 * rather than hidden behind a tooltip.
 */
export default function SettingsPage() {
  useDocumentMeta({
    title: 'Settings',
    description: 'Categories, preferences, backup and the privacy lock.',
    noindex: true,
    canonicalPath: PERSONAL_ROUTES.settings,
  })

  const { db, actions } = usePersonalData()
  const { mode, setMode } = useTheme()
  const { toast } = useToast()

  const [draft, setDraft] = useState<Draft>(() => ({
    displayName: db.settings.displayName,
    weekStartsOn: String(db.settings.weekStartsOn) as '0' | '1',
    dailyHoursTarget: String(db.settings.dailyHoursTarget),
    dailyTaskTarget: String(db.settings.dailyTaskTarget),
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})

  /*
   * Re-seed when the stored settings change under us — a save, an import, a
   * reset or the sample dataset. Done during render rather than in an effect so
   * the form never shows one frame of stale values.
   */
  const [lastSettings, setLastSettings] = useState(db.settings)
  if (db.settings !== lastSettings) {
    setLastSettings(db.settings)
    setDraft({
      displayName: db.settings.displayName,
      weekStartsOn: String(db.settings.weekStartsOn) as '0' | '1',
      dailyHoursTarget: String(db.settings.dailyHoursTarget),
      dailyTaskTarget: String(db.settings.dailyTaskTarget),
    })
    setErrors({})
  }

  const dirty =
    draft.displayName !== db.settings.displayName ||
    draft.weekStartsOn !== String(db.settings.weekStartsOn) ||
    draft.dailyHoursTarget !== String(db.settings.dailyHoursTarget) ||
    draft.dailyTaskTarget !== String(db.settings.dailyTaskTarget)

  function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const next: Partial<Record<keyof Draft, string>> = {}
    const name = draft.displayName.trim()
    if (!name) next.displayName = 'The greeting needs something to call you.'

    const hours = Number(draft.dailyHoursTarget)
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      next.dailyHoursTarget = 'Somewhere between 0 and 24 hours.'
    }

    const tasks = Number(draft.dailyTaskTarget)
    if (!Number.isFinite(tasks) || tasks < 1 || tasks > 50) {
      next.dailyTaskTarget = 'Between 1 and 50 tasks.'
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    actions.updateSettings({
      displayName: name,
      weekStartsOn: draft.weekStartsOn === '1' ? 1 : 0,
      dailyHoursTarget: hours,
      dailyTaskTarget: Math.round(tasks),
    })

    toast({
      title: 'Preferences saved',
      description: `Weeks start on ${draft.weekStartsOn === '1' ? 'Monday' : 'Sunday'}, targeting ${hours}h and ${Math.round(tasks)} tasks a day.`,
      tone: 'positive',
    })
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 sm:px-6">
      <PageHeader
        eyebrow="Dashboard"
        title="Settings"
        description="How the dashboard behaves, and where your private data lives. Nothing on this page is ever sent anywhere."
      />

      <Section
        id="settings-profile"
        title="Profile and preferences"
        description="Your name in the greeting, when your week starts, and the daily targets the productivity score is measured against."
      >
        <form onSubmit={savePreferences} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Display name"
              hint="Only used for the greeting at the top of the dashboard."
              error={errors.displayName}
            >
              <Input
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, displayName: event.target.value }))
                }
                autoComplete="given-name"
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Week starts on</span>
              <SegmentedControl<'0' | '1'>
                value={draft.weekStartsOn}
                onChange={(value) => setDraft((current) => ({ ...current, weekStartsOn: value }))}
                options={WEEK_OPTIONS}
                ariaLabel="First day of the week"
              />
              <p className="text-xs leading-relaxed text-ink-faint">
                Changes every week boundary in the app: goals, reviews, the calendar and the weekly
                trend.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Daily hours target"
              hint="A day counts as fully focused once you have logged this much."
              error={errors.dailyHoursTarget}
            >
              <Input
                type="number"
                min={0.5}
                max={24}
                step={0.5}
                inputMode="decimal"
                value={draft.dailyHoursTarget}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dailyHoursTarget: event.target.value }))
                }
              />
            </Field>

            <Field
              label="Daily task target"
              hint="How many tasks a full day looks like for you."
              error={errors.dailyTaskTarget}
            >
              <Input
                type="number"
                min={1}
                max={50}
                step={1}
                inputMode="numeric"
                value={draft.dailyTaskTarget}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, dailyTaskTarget: event.target.value }))
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" icon="Save" disabled={!dirty}>
              Save preferences
            </Button>
            {dirty ? (
              <Button
                variant="ghost"
                icon="Undo2"
                onClick={() => {
                  setDraft({
                    displayName: db.settings.displayName,
                    weekStartsOn: String(db.settings.weekStartsOn) as '0' | '1',
                    dailyHoursTarget: String(db.settings.dailyHoursTarget),
                    dailyTaskTarget: String(db.settings.dailyTaskTarget),
                  })
                  setErrors({})
                }}
              >
                Discard changes
              </Button>
            ) : (
              <span className="text-xs text-ink-faint">Saved.</span>
            )}
          </div>
        </form>
      </Section>

      <Section
        id="settings-appearance"
        title="Appearance"
        description="System follows your operating system and switches with it. The choice is remembered in this browser."
      >
        <div className="flex flex-col gap-2">
          <SegmentedControl<ThemeMode>
            value={mode}
            onChange={setMode}
            options={THEME_OPTIONS}
            ariaLabel="Colour theme"
            className="sm:w-80"
          />
        </div>
      </Section>

      <Section
        id="settings-categories"
        title="Categories"
        description="The buckets shared by tasks, work-log entries, goals and habits. Renaming one updates it everywhere; a category still in use cannot be deleted."
      >
        <CategoryManager />
      </Section>

      <Section
        id="settings-data"
        title="Your data"
        description="The whole database is one JSON document living in this browser. Export it, restore it, or wipe it."
      >
        <DataManager />
      </Section>

      <Section
        id="settings-sync"
        title="GitHub sync"
        description="Commit this dashboard to a GitHub repository so it survives a cleared browser and follows you between devices. Use a PRIVATE repo — a public one would publish everything you write here."
      >
        <GithubSyncPanel />
      </Section>

      <Section
        id="settings-lock"
        title="Privacy lock"
        description="Optional encryption for the database at rest on this device. Read both columns before turning it on."
      >
        <PrivacyLockPanel />
      </Section>

      <Section
        id="settings-about"
        title="About and privacy"
        description="What this app is, and what it does and does not do with what you type into it."
      >
        <div className="space-y-4">
          <PrivacyNotice variant="inline" />

          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Application</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{APP_NAME}</dd>
            </div>
            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Version</dt>
              <dd className="mt-0.5 font-mono text-sm font-medium text-ink tabular-nums">
                {APP_VERSION}
              </dd>
            </div>
            <div className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-[11px] text-ink-faint">Schema version</dt>
              <dd className="mt-0.5 font-mono text-sm font-medium text-ink tabular-nums">
                {db.version}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-relaxed text-ink-muted">
            The full threat model — what the privacy lock protects, what it cannot, and what would
            need to change to sync this across devices — is written out in the project README.
          </p>

          <ButtonLink variant="secondary" icon="ExternalLink" href={README_URL}>
            Read the privacy section
          </ButtonLink>
        </div>
      </Section>
    </div>
  )
}
