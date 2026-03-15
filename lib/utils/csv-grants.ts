import Papa from 'papaparse'
import { saveAs } from 'file-saver'
import type { GrantsFullRow } from '@/lib/types/database.types'

/* ── Column definitions ─────────────────────────────────────── */

export const CSV_COLUMNS = [
  'name',
  'funder',
  'description',
  'category',
  'amount_low',
  'amount_high',
  'deadline',
  'eligibility_types',
  'is_renewal',
  'effort_weeks',
  'source_url',
  'initial_status',
] as const

export type CsvColumn = typeof CSV_COLUMNS[number]

export const COLUMN_LABELS: Record<CsvColumn, string> = {
  name:              'Grant Name',
  funder:            'Funder',
  description:       'Description',
  category:          'Category',
  amount_low:        'Amount Low',
  amount_high:       'Amount High',
  deadline:          'Deadline (YYYY-MM-DD)',
  eligibility_types: 'Eligibility Types',
  is_renewal:        'Is Renewal (true/false)',
  effort_weeks:      'Effort Weeks',
  source_url:        'Source URL',
  initial_status:    'Initial Status',
}

const REQUIRED: CsvColumn[] = ['name', 'funder']

const TEMPLATE_ROW = {
  name: 'Example Grant',
  funder: 'Example Foundation',
  description: 'A brief description of the grant opportunity.',
  category: 'Education',
  amount_low: '10000',
  amount_high: '50000',
  deadline: '2026-06-30',
  eligibility_types: 'tribal,501c3',
  is_renewal: 'false',
  effort_weeks: '4',
  source_url: 'https://example.com/grant',
  initial_status: 'discovered',
}

/* ── Template download ──────────────────────────────────────── */

export function downloadCsvTemplate(): void {
  const csv = Papa.unparse({
    fields: [...CSV_COLUMNS],
    data: [TEMPLATE_ROW],
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, 'grant-import-template.csv')
}

/* ── Export grants to CSV ───────────────────────────────────── */

export function exportGrantsToCsv(grants: GrantsFullRow[]): void {
  const rows = grants.map(g => ({
    name:              g.name,
    funder:            g.funder ?? '',
    description:       '',
    category:          g.category ?? '',
    amount_low:        g.amount_low?.toString() ?? '',
    amount_high:       g.amount_high?.toString() ?? '',
    deadline:          g.deadline ?? '',
    eligibility_types: (g.eligibility_types ?? []).join(','),
    is_renewal:        g.is_renewal ? 'true' : 'false',
    effort_weeks:      g.effort_weeks?.toString() ?? '',
    source_url:        '',
    initial_status:    g.pipeline_status,
    fit_score:         g.fit_score?.toString() ?? '',
  }))

  const csv = Papa.unparse({
    fields: [...CSV_COLUMNS, 'fit_score'],
    data: rows,
  })
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, `grants-export-${new Date().toISOString().slice(0, 10)}.csv`)
}

/* ── Parsed row types ───────────────────────────────────────── */

export interface ParsedRow {
  index: number       // 1-based row number in original file
  raw:   Record<string, string>
  // Validated fields
  name:              string
  funder:            string
  description:       string | null
  category:          string | null
  amount_low:        number | null
  amount_high:       number | null
  deadline:          string | null
  eligibility_types: string[] | null
  is_renewal:        boolean
  effort_weeks:      number | null
  source_url:        string | null
  initial_status:    string
}

export interface ParseError {
  row:     number
  field:   string
  message: string
}

export interface ParseResult {
  valid:    ParsedRow[]
  errors:   ParseError[]
  headers:  string[]
  rawRows:  Record<string, string>[]
}

/* ── Auto-detect column mapping ─────────────────────────────── */

const ALIASES: Record<CsvColumn, string[]> = {
  name:              ['name', 'grant name', 'grant_name', 'title', 'grant title'],
  funder:            ['funder', 'funder name', 'funder_name', 'organization', 'grantor'],
  description:       ['description', 'desc', 'summary', 'abstract'],
  category:          ['category', 'type', 'grant type', 'grant_type'],
  amount_low:        ['amount_low', 'min amount', 'amount min', 'min', 'low'],
  amount_high:       ['amount_high', 'max amount', 'amount max', 'max', 'high', 'amount'],
  deadline:          ['deadline', 'due date', 'due_date', 'close date', 'close_date'],
  eligibility_types: ['eligibility_types', 'eligibility', 'eligible', 'who can apply'],
  is_renewal:        ['is_renewal', 'renewal', 'is renewal'],
  effort_weeks:      ['effort_weeks', 'effort', 'weeks', 'effort weeks'],
  source_url:        ['source_url', 'url', 'link', 'source', 'website'],
  initial_status:    ['initial_status', 'status', 'pipeline status', 'pipeline_status'],
}

export function detectMapping(headers: string[]): Record<CsvColumn, string | null> {
  const result = {} as Record<CsvColumn, string | null>
  const normalized = headers.map(h => h.toLowerCase().trim())

  for (const col of CSV_COLUMNS) {
    const aliases = ALIASES[col]
    const match = headers.find((_, i) => aliases.includes(normalized[i]))
    result[col] = match ?? null
  }
  return result
}

/* ── Parse + validate CSV ───────────────────────────────────── */

export function parseCsvFile(
  file: File,
  mapping: Record<CsvColumn, string | null>,
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: ({ data, meta }) => {
        if (!data.length) {
          reject(new Error('The CSV file is empty'))
          return
        }

        // Check required columns are mapped
        for (const col of REQUIRED) {
          if (!mapping[col]) {
            reject(new Error(`Missing required column: ${COLUMN_LABELS[col]}`))
            return
          }
        }

        const valid: ParsedRow[] = []
        const errors: ParseError[] = []

        data.forEach((raw, i) => {
          const rowNum = i + 2  // 1-based + header row
          const rowErrors: ParseError[] = []

          function get(col: CsvColumn): string {
            const header = mapping[col]
            return header ? (raw[header] ?? '').trim() : ''
          }

          // Required fields
          const name   = get('name')
          const funder = get('funder')
          if (!name)   rowErrors.push({ row: rowNum, field: 'name',   message: 'Name is required' })
          if (!funder) rowErrors.push({ row: rowNum, field: 'funder', message: 'Funder is required' })

          // Numeric fields
          let amount_low: number | null = null
          let amount_high: number | null = null
          let effort_weeks: number | null = null

          const rawLow  = get('amount_low')
          const rawHigh = get('amount_high')
          const rawEff  = get('effort_weeks')

          if (rawLow) {
            const n = Number(rawLow.replace(/[$,]/g, ''))
            if (isNaN(n)) rowErrors.push({ row: rowNum, field: 'amount_low',   message: `Invalid number: "${rawLow}"` })
            else amount_low = n
          }
          if (rawHigh) {
            const n = Number(rawHigh.replace(/[$,]/g, ''))
            if (isNaN(n)) rowErrors.push({ row: rowNum, field: 'amount_high',  message: `Invalid number: "${rawHigh}"` })
            else amount_high = n
          }
          if (rawEff) {
            const n = Number(rawEff)
            if (isNaN(n)) rowErrors.push({ row: rowNum, field: 'effort_weeks', message: `Invalid number: "${rawEff}"` })
            else effort_weeks = n
          }

          // Date
          let deadline: string | null = null
          const rawDate = get('deadline')
          if (rawDate) {
            const d = new Date(rawDate)
            if (isNaN(d.getTime())) {
              rowErrors.push({ row: rowNum, field: 'deadline', message: `Invalid date: "${rawDate}" (use YYYY-MM-DD)` })
            } else {
              deadline = rawDate.match(/^\d{4}-\d{2}-\d{2}$/) ? rawDate : d.toISOString().slice(0, 10)
            }
          }

          // Eligibility (comma-separated)
          const rawElig = get('eligibility_types')
          const eligibility_types = rawElig
            ? rawElig.split(',').map(s => s.trim()).filter(Boolean)
            : null

          // Boolean
          const rawRenewal = get('is_renewal').toLowerCase()
          const is_renewal = rawRenewal === 'true' || rawRenewal === '1' || rawRenewal === 'yes'

          // Status
          const VALID_STATUSES = ['discovered', 'researching', 'writing', 'submitted', 'awarded', 'declined']
          const rawStatus = get('initial_status')
          const initial_status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'discovered'

          if (rowErrors.length > 0) {
            errors.push(...rowErrors)
          } else {
            valid.push({
              index:    rowNum,
              raw,
              name,
              funder,
              description:   get('description') || null,
              category:      get('category')    || null,
              amount_low,
              amount_high,
              deadline,
              eligibility_types,
              is_renewal,
              effort_weeks,
              source_url:    get('source_url')  || null,
              initial_status,
            })
          }
        })

        resolve({ valid, errors, headers: meta.fields ?? [], rawRows: data })
      },
      error: (err) => reject(new Error(err.message)),
    })
  })
}
