/**
 * A dependency-free RFC 4180 CSV reader and writer.
 *
 * Reading accepts what spreadsheets actually export: CRLF or LF line endings,
 * a UTF-8 byte-order mark, quoted cells with doubled quotes, and line breaks
 * inside quoted cells. Blank lines are skipped. Writing quotes only the cells
 * that need it and ends every row with CRLF, so the output opens cleanly in
 * Excel, Numbers and Google Sheets alike.
 *
 * Nothing here knows what the columns mean — `personalData.ts` maps headers
 * onto records.
 */

/** One data row, keyed by the normalised (trimmed, lower-cased) header. */
export type CsvRow = Record<string, string>

export interface CsvTable {
  /** Header names, trimmed and lower-cased, in file order. Empty for blank headers. */
  headers: string[]
  rows: CsvRow[]
}

export type CsvValue = string | number | null | undefined

/**
 * Splits CSV text into rows of cells. Never throws; malformed input degrades
 * to "whatever the state machine made of it" rather than an error, because the
 * caller decides what a usable row looks like.
 */
export function parseCsvRows(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 2
          continue
        }
        quoted = false
        index += 1
        continue
      }
      cell += char
      index += 1
      continue
    }

    if (char === '"') {
      quoted = true
      index += 1
      continue
    }
    if (char === ',') {
      row.push(cell)
      cell = ''
      index += 1
      continue
    }
    if (char === '\r' || char === '\n') {
      row.push(cell)
      cell = ''
      rows.push(row)
      row = []
      index += char === '\r' && source[index + 1] === '\n' ? 2 : 1
      continue
    }
    cell += char
    index += 1
  }

  // The last row of a file that does not end with a newline.
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

/**
 * Reads a CSV whose first row names the columns. Throws a readable `Error`
 * when there is no header row to read — the import dialog shows the message
 * as-is.
 */
export function parseCsvTable(text: string): CsvTable {
  const rows = parseCsvRows(text)
  const header = rows[0]
  if (!header) {
    throw new Error('The file is empty. The first row must be a header row naming the columns.')
  }

  const headers = header.map((name) => name.trim().toLowerCase())
  if (headers.every((name) => name === '')) {
    throw new Error('The first row must be a header row naming the columns.')
  }

  const records = rows.slice(1).map((cells) => {
    const record: CsvRow = {}
    headers.forEach((name, position) => {
      if (name) record[name] = (cells[position] ?? '').trim()
    })
    return record
  })

  return { headers, rows: records }
}

/** Quotes a cell only when RFC 4180 requires it (or whitespace would be lost). */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text === '') return ''
  const needsQuotes = /[",\r\n]/.test(text) || /^\s|\s$/.test(text)
  return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text
}

/** A header row plus data rows, CRLF-terminated. */
export function serializeCsv(
  headers: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  const lines = [headers, ...rows].map((cells) => cells.map(csvCell).join(','))
  return `${lines.join('\r\n')}\r\n`
}
