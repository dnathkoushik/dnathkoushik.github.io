import { useId, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { OutreachCsvKind } from '@/services/contracts'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field } from '@/components/ui/Field'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { usePersonalData } from '@/providers/personalDataContext'
import { cn } from '@/lib/cn'
import { pluralize } from '@/utils/format'

export interface CsvImportDialogProps {
  open: boolean
  onClose: () => void
  kind: OutreachCsvKind
}

interface ColumnDoc {
  name: string
  required?: boolean
  hint: string
}

/** Mirrors the header mapping in `PersonalDataService.importOutreachCsv`. */
const COLUMNS: Record<OutreachCsvKind, ColumnDoc[]> = {
  companies: [
    { name: 'name', required: true, hint: 'Matched case-insensitively; a match updates instead of duplicating.' },
    { name: 'website', hint: 'URL.' },
    { name: 'kind', hint: 'startup · scaleup · mnc · other' },
    { name: 'stage', hint: 'Free text, e.g. Series A.' },
    { name: 'size', hint: '1-10 · 11-50 · 51-200 · 201-1000 · 1000+' },
    { name: 'location', hint: 'City or region.' },
    { name: 'remote', hint: 'yes / no' },
    { name: 'industry', hint: 'Free text.' },
    { name: 'why', hint: 'Why them, in your words.' },
    { name: 'tags', hint: 'Separated by ; or ,' },
    { name: 'priority', hint: 'high · medium · low' },
  ],
  contacts: [
    { name: 'name', required: true, hint: 'Matched within the company when one is given.' },
    { name: 'role', hint: 'Job title.' },
    { name: 'company', hint: 'By name; created (as "other") when it does not exist yet.' },
    { name: 'email', hint: '' },
    { name: 'linkedin', hint: 'Profile URL.' },
    { name: 'warmth', hint: 'cold · warm · referral · alumni' },
    { name: 'notes', hint: 'Free text.' },
  ],
}

const KIND_LABEL: Record<OutreachCsvKind, { title: string; noun: string }> = {
  companies: { title: 'Import companies', noun: 'companies' },
  contacts: { title: 'Import contacts', noun: 'contacts' },
}

const PREVIEW_ROWS = 5

interface Preview {
  headers: string[]
  rows: string[][]
  /** Data rows in the file, including the ones not shown. */
  total: number
  hasName: boolean
}

/**
 * A minimal RFC 4180 reader, for the preview only. The real import goes
 * through the service's own parser; this one just needs to show the owner
 * what the first few rows look like before they commit.
 */
function parseCsvPreview(text: string): Preview | null {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
      if (char === '\r' && source[i + 1] === '\n') i += 1
    } else {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  const kept = rows.filter((cells) => cells.some((value) => value.trim() !== ''))
  const header = kept[0]
  if (!header) return null

  const headers = header.map((name) => name.trim())
  const data = kept.slice(1)
  return {
    headers,
    rows: data.slice(0, PREVIEW_ROWS),
    total: data.length,
    hasName: headers.some((name) => name.toLowerCase() === 'name'),
  }
}

/**
 * Hands the browser a text file to save. Used by the Companies and Contacts
 * pages for their "Export CSV" buttons, so the naming and cleanup live in one
 * place next to the import they mirror.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Revoking immediately can race the download in Safari; a tick is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Bring a spreadsheet of companies or contacts in.
 *
 * The file never leaves the browser: it is read with `File.text()`, previewed
 * here, and handed to the data service, which writes to the local database.
 * Nothing is imported until "Import" is pressed, and a header without a
 * `name` column is refused before it gets that far.
 */
export function CsvImportDialog({ open, onClose, kind }: CsvImportDialogProps) {
  const { actions } = usePersonalData()
  const { toast } = useToast()
  const baseId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Fresh dialog every time it opens; the exit animation keeps the old one mounted briefly.
  const session = open ? `${kind}:open` : 'closed'
  const [lastSession, setLastSession] = useState(session)
  if (session !== lastSession) {
    setLastSession(session)
    if (open) {
      setText('')
      setFileName(null)
      setError(null)
      setBusy(false)
    }
  }

  const label = KIND_LABEL[kind]
  const columns = COLUMNS[kind]
  const preview = text.trim() ? parseCsvPreview(text) : null
  const canImport = Boolean(preview && preview.hasName && preview.total > 0) && !busy

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so picking the same file twice still fires a change event.
    event.target.value = ''
    if (!file) return
    try {
      const contents = await file.text()
      setText(contents)
      setFileName(file.name)
      setError(null)
    } catch {
      setError('That file could not be read. Try exporting it again as CSV (UTF-8).')
    }
  }

  function insertHeader() {
    setText(`${columns.map((column) => column.name).join(',')}\n`)
    setFileName(null)
    setError(null)
  }

  async function runImport() {
    if (!canImport) return
    setBusy(true)
    setError(null)
    try {
      const summary = await actions.importOutreachCsv(kind, text)
      toast({
        title: `${label.noun[0].toUpperCase()}${label.noun.slice(1)} imported`,
        description: `${summary.added} added · ${summary.updated} updated · ${summary.skipped} skipped${
          fileName ? ` — ${fileName}` : ''
        }`,
        tone: 'positive',
        duration: 7000,
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The import failed. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const fileInputId = `${baseId}-file`
  const columnsId = `${baseId}-columns`

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={label.title}
      description="A header-mapped CSV: the first row names the columns, in any order. Extra columns are ignored, and rows whose name already exists update the record instead of duplicating it. The file is read in this browser only."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" icon="Upload" onClick={runImport} disabled={!canImport} loading={busy}>
            {preview && preview.total > 0 ? `Import ${pluralize(preview.total, 'row')}` : 'Import'}
          </Button>
        </>
      }
    >
      <div className="space-y-5 pb-1">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft/60 p-3.5 text-sm"
          >
            <Icon name="TriangleAlert" size={16} className="mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="font-medium text-ink">Import failed</p>
              <p className="mt-0.5 leading-relaxed text-ink-muted">{error}</p>
            </div>
          </div>
        ) : null}

        <section aria-labelledby={columnsId} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 id={columnsId} className="text-sm font-semibold text-ink">
              Columns
            </h3>
            <Button variant="ghost" size="sm" icon="Clipboard" onClick={insertHeader} disabled={busy}>
              Insert header row
            </Button>
          </div>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
            {columns.map((column) => (
              <li key={column.name} className="flex items-baseline gap-2">
                <code className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-ink">
                  {column.name}
                  {column.required ? <span className="text-danger">*</span> : null}
                </code>
                <span className="leading-relaxed text-ink-muted">
                  {column.required ? 'Required. ' : ''}
                  {column.hint}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="sr-only"
            aria-label="Choose a CSV file"
            disabled={busy}
          />
          <Button
            variant="secondary"
            icon="Upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            Choose a .csv file
          </Button>
          <p className="min-w-0 truncate text-xs text-ink-faint">
            {fileName ? (
              <>
                <span className="font-medium text-ink-muted">{fileName}</span> loaded
              </>
            ) : (
              'or paste the CSV text below.'
            )}
          </p>
        </div>

        <Field
          label="CSV text"
          hint="Paste from a spreadsheet: most of them copy as tab-free, comma-separated rows when exported as CSV."
        >
          <Textarea
            rows={6}
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setFileName(null)
              setError(null)
            }}
            placeholder={`${columns
              .slice(0, 3)
              .map((column) => column.name)
              .join(',')},…`}
            spellCheck={false}
            disabled={busy}
            className="font-mono text-xs"
          />
        </Field>

        {preview ? (
          <section aria-label="Preview" className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Preview</p>
              <p aria-live="polite" className="font-mono text-xs text-ink-faint tabular-nums">
                {pluralize(preview.headers.length, 'column')} · {pluralize(preview.total, 'row')}
                {preview.total > PREVIEW_ROWS ? ` · showing first ${PREVIEW_ROWS}` : ''}
              </p>
            </div>

            {!preview.hasName ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg bg-warning-soft/70 px-3 py-2 text-xs leading-relaxed text-ink"
              >
                <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0 text-warning" />
                <span>
                  No <code className="font-mono">name</code> column in the header row. The import needs
                  one to know what each row is.
                </span>
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-max text-left text-xs">
                <thead className="bg-surface-muted/70 text-ink-muted">
                  <tr>
                    {preview.headers.map((header, index) => {
                      const known = columns.some((column) => column.name === header.toLowerCase())
                      return (
                        <th
                          key={`${header}-${index}`}
                          scope="col"
                          className={cn(
                            'px-3 py-2 font-mono font-medium whitespace-nowrap',
                            !known && 'text-ink-faint line-through decoration-ink-faint/60',
                          )}
                          title={known ? undefined : 'Ignored: not a recognised column'}
                        >
                          {header || <span className="italic">(blank)</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, preview.headers.length)}
                        className="px-3 py-3 text-center text-ink-faint"
                      >
                        Header only — add at least one row.
                      </td>
                    </tr>
                  ) : (
                    preview.rows.map((cells, rowIndex) => (
                      <tr key={rowIndex}>
                        {preview.headers.map((_header, colIndex) => (
                          <td key={colIndex} className="px-3 py-2 text-ink">
                            <span className="block max-w-56 truncate">{cells[colIndex] ?? ''}</span>
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </Dialog>
  )
}
