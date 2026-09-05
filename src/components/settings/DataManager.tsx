import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { APP_NAME } from '@/config/app'
import type { ImportMode } from '@/services/contracts'
import { todayISO } from '@/utils/date'
import { numberFormat, pluralize } from '@/utils/format'
import { usePersonalData } from '@/providers/personalDataContext'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'

/** Typed exactly, in this case, before the factory reset will run. */
const RESET_PHRASE = 'RESET'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

interface PickedFile {
  name: string
  size: number
  text: string
}

/**
 * Backup, restore and the two ways to throw everything away.
 *
 * Because the database lives only in this browser, an export is the only copy
 * that survives a cleared cache — so the export button is the primary action
 * here, and every destructive path names exactly what it will remove.
 */
export function DataManager() {
  const { db, actions, storageName } = usePersonalData()
  const { toast } = useToast()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<PickedFile | null>(null)
  const [pendingMode, setPendingMode] = useState<ImportMode | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'sample' | 'clear' | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')

  // Close enough for a settings readout, and far cheaper than a full export.
  const size = useMemo(() => new Blob([JSON.stringify(db)]).size, [db])

  const counts = useMemo(
    () => ({
      tasks: db.tasks.length,
      logs: db.logs.length,
      goals: db.weeklyGoals.length + db.monthlyGoals.length,
      habits: db.habits.length,
      habitEntries: db.habitEntries.length,
      notes: db.notes.length,
      reviews: db.reviews.length,
      days: db.days.length,
      categories: db.categories.length,
    }),
    [db],
  )

  const totalRecords =
    counts.tasks +
    counts.logs +
    counts.goals +
    counts.habits +
    counts.habitEntries +
    counts.notes +
    counts.reviews +
    counts.days

  function handleExport() {
    const blob = new Blob([actions.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `portfolio-os-backup-${todayISO()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    // Revoking immediately can race the download in Safari; a tick is enough.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast({
      title: 'Backup downloaded',
      description: `${pluralize(totalRecords, 'record')} · ${formatBytes(blob.size)}`,
      tone: 'positive',
    })
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset the input so choosing the same file twice still fires a change.
    event.target.value = ''
    if (!file) return

    try {
      const text = await file.text()
      setPicked({ name: file.name, size: file.size, text })
    } catch {
      toast({
        title: 'Could not read that file',
        description: 'Try exporting a fresh backup and importing that instead.',
        tone: 'danger',
      })
    }
  }

  async function runImport(mode: ImportMode) {
    if (!picked) return
    setBusy(mode)
    try {
      const summary = await actions.importJson(picked.text, mode)
      toast({
        title: mode === 'replace' ? 'Backup restored' : 'Backup merged',
        description:
          mode === 'replace'
            ? `${pluralize(summary.added, 'record')} loaded from ${picked.name}.`
            : `${summary.added} added, ${summary.updated} updated, ${summary.skipped} skipped.`,
        tone: 'positive',
        duration: 7000,
      })
      setPicked(null)
      setPendingMode(null)
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'That file could not be read.',
        tone: 'danger',
        duration: 8000,
      })
    } finally {
      setBusy(null)
    }
  }

  async function runSample() {
    setConfirming(null)
    setBusy('sample')
    await actions.loadSampleData()
    setBusy(null)
    toast({
      title: 'Sample data loaded',
      description: 'A few weeks of demo tasks, logs, goals and habits, ending today.',
      tone: 'positive',
    })
  }

  async function runClear() {
    setConfirming(null)
    setBusy('clear')
    await actions.clearAllEntries()
    setBusy(null)
    toast({
      title: 'Entries cleared',
      description: 'Your categories and preferences were kept.',
      tone: 'positive',
    })
  }

  async function runReset() {
    setBusy('reset')
    await actions.resetEverything()
    setBusy(null)
    setResetOpen(false)
    setResetPhrase('')
    toast({
      title: 'Everything reset',
      description: `${APP_NAME} is back to a brand-new database.`,
      tone: 'positive',
    })
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-surface-muted px-3 py-2.5">
          <dt className="text-[11px] text-ink-faint">Stored in</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-ink" title={storageName}>
            {storageName}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-muted px-3 py-2.5">
          <dt className="text-[11px] text-ink-faint">Approximate size</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-ink tabular-nums">
            {formatBytes(size)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-muted px-3 py-2.5">
          <dt className="text-[11px] text-ink-faint">Records</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-ink tabular-nums">
            {numberFormat(totalRecords)}
          </dd>
        </div>
        <div className="rounded-lg bg-surface-muted px-3 py-2.5">
          <dt className="text-[11px] text-ink-faint">Categories</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-ink tabular-nums">
            {counts.categories}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Export a backup</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              One JSON file with every task, log entry, goal, habit, note and review. This is the
              only copy that survives clearing this browser&rsquo;s storage.
            </p>
          </div>
          <Button variant="primary" icon="Download" onClick={handleExport} className="sm:shrink-0">
            Export JSON
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Import a backup</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Choose a file, then decide whether to merge it into what is here or replace
              everything with it.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handleFile}
            aria-label="Backup file to import"
          />
          <Button
            variant="secondary"
            icon="Upload"
            onClick={() => fileInputRef.current?.click()}
            className="sm:shrink-0"
          >
            Choose file
          </Button>
        </div>

        <div className="flex flex-col gap-3 rounded-card border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Load sample data</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Replaces the database with a few weeks of realistic demo activity, so the charts and
              streaks have something to show. Your preferences are kept.
            </p>
          </div>
          <Button
            variant="secondary"
            icon="Sparkles"
            loading={busy === 'sample'}
            onClick={() => setConfirming('sample')}
            className="sm:shrink-0"
          >
            Load sample
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-card border border-danger/30 bg-danger-soft/40 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon name="TriangleAlert" size={15} className="text-danger" />
          Danger zone
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">Clear all entries</span> — removes every task,
            log entry, goal, habit, note, review and day objective. Categories and preferences stay.
          </p>
          <Button
            variant="secondary"
            icon="Trash"
            loading={busy === 'clear'}
            onClick={() => setConfirming('clear')}
            className="sm:shrink-0"
          >
            Clear entries
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t border-danger/20 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 text-xs leading-relaxed text-ink-muted">
            <span className="font-medium text-ink">Reset everything</span> — a factory reset:
            entries, categories, preferences and the stored database itself. There is no undo and no
            copy anywhere else.
          </p>
          <Button
            variant="danger"
            icon="RotateCcw"
            onClick={() => setResetOpen(true)}
            className="sm:shrink-0"
          >
            Reset everything
          </Button>
        </div>
      </div>

      <Dialog
        open={picked !== null}
        onClose={() => setPicked(null)}
        title="Import backup"
        description={
          picked ? `${picked.name} · ${formatBytes(picked.size)}` : 'Choose how to apply this file.'
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-line p-3">
            <p className="text-sm font-medium text-ink">Merge</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Keeps what is already here. Records the file does not know about are left alone;
              records with the same id are updated to the newer version.
            </p>
            <Button
              className="mt-2.5"
              variant="secondary"
              icon="ArrowRightLeft"
              size="sm"
              loading={busy === 'merge'}
              onClick={() => void runImport('merge')}
            >
              Merge into current data
            </Button>
          </div>

          <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-3">
            <p className="text-sm font-medium text-ink">Replace</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              Throws away everything currently stored in this browser and uses the file instead.
              Export a backup first if you are not certain.
            </p>
            <Button
              className="mt-2.5"
              variant="danger"
              icon="TriangleAlert"
              size="sm"
              loading={busy === 'replace'}
              onClick={() => setPendingMode('replace')}
            >
              Replace everything
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={pendingMode === 'replace'}
        onCancel={() => setPendingMode(null)}
        onConfirm={() => {
          setPendingMode(null)
          void runImport('replace')
        }}
        title="Replace everything with this file?"
        message={`Your ${numberFormat(totalRecords)} stored records will be deleted and replaced by the contents of ${picked?.name ?? 'the backup'}. This cannot be undone.`}
        confirmLabel="Replace everything"
        tone="danger"
      />

      <ConfirmDialog
        open={confirming === 'sample'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void runSample()}
        title="Load the sample dataset?"
        message={`This replaces your ${numberFormat(totalRecords)} stored records with demo activity. Export a backup first if you want to keep them.`}
        confirmLabel="Load sample data"
        tone="danger"
      />

      <ConfirmDialog
        open={confirming === 'clear'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => void runClear()}
        title="Clear every entry?"
        message={`${numberFormat(totalRecords)} records will be removed. Your ${counts.categories} categories and your preferences are kept.`}
        confirmLabel="Clear entries"
        tone="danger"
      />

      <Dialog
        open={resetOpen}
        onClose={() => {
          setResetOpen(false)
          setResetPhrase('')
        }}
        title="Reset everything?"
        description="This is the full factory reset. Nothing is recoverable afterwards."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setResetOpen(false)
                setResetPhrase('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon="RotateCcw"
              disabled={resetPhrase.trim() !== RESET_PHRASE}
              loading={busy === 'reset'}
              onClick={() => void runReset()}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-ink-muted">
            Deletes {numberFormat(totalRecords)} records, your categories and your preferences, then
            clears the stored database from this browser.
          </p>
          <Field
            label={`Type ${RESET_PHRASE} to confirm`}
            hint="Case sensitive. This step exists so this can never happen by accident."
          >
            <Input
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder={RESET_PHRASE}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
