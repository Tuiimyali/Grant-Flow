'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CSV_COLUMNS,
  COLUMN_LABELS,
  detectMapping,
  parseCsvFile,
  downloadCsvTemplate,
  type CsvColumn,
  type ParsedRow,
  type ParseError,
  type ParseResult,
} from '@/lib/utils/csv-grants'

/* ── Stage types ────────────────────────────────────────────── */

type Stage = 'upload' | 'mapping' | 'preview' | 'importing' | 'done'

interface ImportResult {
  imported: number
  failed:   number
  errors:   string[]
}

/* ── Main modal ─────────────────────────────────────────────── */

export default function GrantCsvModal({
  onClose,
  onSuccess,
}: {
  onClose:   () => void
  onSuccess: () => void
}) {
  const [stage,    setStage]    = useState<Stage>('upload')
  const [file,     setFile]     = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const [headers,  setHeaders]  = useState<string[]>([])
  const [mapping,  setMapping]  = useState<Record<CsvColumn, string | null>>({} as Record<CsvColumn, string | null>)
  const [parsed,   setParsed]   = useState<ParseResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [total,    setTotal]    = useState(0)
  const [result,   setResult]   = useState<ImportResult | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  /* ── File handling ──────────────────────────────────────────── */

  async function handleFile(f: File) {
    setFileError(null)
    if (!f.name.endsWith('.csv') && f.type !== 'text/csv') {
      setFileError('Please upload a .csv file')
      return
    }
    setFile(f)

    // Quick header peek with PapaParse to populate mapping
    const text = await f.text()
    const firstLine = text.split('\n')[0] ?? ''
    const hdrs = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    if (!hdrs.length || (hdrs.length === 1 && !hdrs[0])) {
      setFileError('The CSV file is empty')
      return
    }
    const detected = detectMapping(hdrs)
    setHeaders(hdrs)
    setMapping(detected)
    setStage('mapping')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  /* ── Proceed from mapping → preview ────────────────────────── */

  async function handlePreview() {
    if (!file) return
    setFileError(null)
    try {
      const result = await parseCsvFile(file, mapping)
      setParsed(result)
      setStage('preview')
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to parse CSV')
    }
  }

  /* ── Run import ─────────────────────────────────────────────── */

  async function handleImport() {
    if (!parsed?.valid.length) return
    setStage('importing')

    const supabase = createClient()
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()
    const orgId = (member as { organization_id: string } | null)?.organization_id
    if (!orgId) {
      setResult({ imported: 0, failed: parsed.valid.length, errors: ['Could not resolve organization'] })
      setStage('done')
      return
    }

    const rows = parsed.valid
    setTotal(rows.length)
    setProgress(0)

    let imported = 0
    const failErrors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row: ParsedRow = rows[i]
      const { error } = await supabase.rpc('add_grant_to_pipeline', {
        p_organization_id:  orgId,
        p_name:             row.name,
        p_funder:           row.funder,
        p_description:      row.description,
        p_category:         row.category,
        p_amount_low:       row.amount_low,
        p_amount_high:      row.amount_high,
        p_deadline:         row.deadline,
        p_eligibility_types: row.eligibility_types,
        p_is_renewal:       row.is_renewal,
        p_effort_weeks:     row.effort_weeks,
        p_source_url:       row.source_url,
        p_initial_status:   row.initial_status,
      })

      if (error) {
        failErrors.push(`Row ${row.index} (${row.name}): ${error.message}`)
      } else {
        imported++
      }
      setProgress(i + 1)
    }

    setResult({ imported, failed: rows.length - imported, errors: failErrors })
    setStage('done')
    if (imported > 0) onSuccess()
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Import Grants from CSV</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {stage === 'upload'    && 'Upload a CSV file to bulk-add grants'}
              {stage === 'mapping'   && 'Confirm which CSV columns map to grant fields'}
              {stage === 'preview'   && 'Review the data before importing'}
              {stage === 'importing' && 'Importing grants…'}
              {stage === 'done'      && 'Import complete'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {stage === 'upload'    && <UploadStage    dragging={dragging} setDragging={setDragging} onDrop={onDrop}
                                      inputRef={inputRef} onFile={handleFile} fileError={fileError} />}
          {stage === 'mapping'   && <MappingStage   headers={headers} mapping={mapping} setMapping={setMapping}
                                      fileError={fileError} />}
          {stage === 'preview'   && parsed && <PreviewStage parsed={parsed} />}
          {stage === 'importing' && <ImportingStage progress={progress} total={total} />}
          {stage === 'done'      && result && <DoneStage result={result} onClose={onClose} />}
        </div>

        {/* Footer */}
        {(stage === 'mapping' || stage === 'preview') && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              onClick={() => stage === 'mapping' ? setStage('upload') : setStage('mapping')}
              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              ← Back
            </button>
            {stage === 'mapping' && (
              <button
                onClick={handlePreview}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--gold)' }}
              >
                Preview data →
              </button>
            )}
            {stage === 'preview' && parsed && (
              <button
                onClick={handleImport}
                disabled={parsed.valid.length === 0}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white
                  disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'var(--gold)' }}
              >
                Import {parsed.valid.length} grant{parsed.valid.length !== 1 ? 's' : ''} →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Stage: Upload ──────────────────────────────────────────── */

function UploadStage({
  dragging, setDragging, onDrop, inputRef, onFile, fileError,
}: {
  dragging:    boolean
  setDragging: (v: boolean) => void
  onDrop:      (e: React.DragEvent) => void
  inputRef:    React.RefObject<HTMLInputElement | null>
  onFile:      (f: File) => void
  fileError:   string | null
}) {
  return (
    <div className="px-6 py-6 space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          cursor-pointer py-12 transition-colors
          ${dragging ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'}`}
      >
        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">Drop a CSV file here, or click to browse</p>
          <p className="text-xs text-slate-400 mt-0.5">Only .csv files are accepted</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>

      {fileError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {fileError}
        </p>
      )}

      {/* Template download */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25M8.25 21h7.5M8.25 3H5.625c-.621 0-1.125.504-1.125 1.125v17.25" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-700">Need a starting point?</p>
          <p className="text-[11px] text-slate-400">Download the template with the correct column headers</p>
        </div>
        <button
          onClick={downloadCsvTemplate}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300
            text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
        >
          Download template
        </button>
      </div>

      {/* Column reference */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Available columns</p>
        </div>
        <div className="px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {CSV_COLUMNS.map(col => (
            <div key={col} className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                ['name','funder'].includes(col) ? 'bg-red-400' : 'bg-slate-300'
              }`} />
              <span className="text-[11px] text-slate-600 font-mono">{col}</span>
              {['name','funder'].includes(col) && (
                <span className="text-[10px] text-red-400">required</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Stage: Mapping ─────────────────────────────────────────── */

function MappingStage({
  headers, mapping, setMapping, fileError,
}: {
  headers:    string[]
  mapping:    Record<CsvColumn, string | null>
  setMapping: (m: Record<CsvColumn, string | null>) => void
  fileError:  string | null
}) {
  function set(col: CsvColumn, val: string) {
    setMapping({ ...mapping, [col]: val || null })
  }

  return (
    <div className="px-6 py-4 space-y-4">
      <p className="text-xs text-slate-500">
        We auto-detected the column mapping below. Confirm or adjust before previewing.
      </p>

      {fileError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {fileError}
        </p>
      )}

      <div className="space-y-2">
        {CSV_COLUMNS.map(col => {
          const isRequired = ['name', 'funder'].includes(col)
          return (
            <div key={col} className="flex items-center gap-3">
              <div className="w-48 shrink-0">
                <p className="text-xs font-medium text-slate-700">
                  {COLUMN_LABELS[col]}
                  {isRequired && <span className="text-red-400 ml-1">*</span>}
                </p>
              </div>
              <select
                value={mapping[col] ?? ''}
                onChange={e => set(col, e.target.value)}
                className={`flex-1 text-xs rounded-lg border py-1.5 px-2 bg-white text-slate-700
                  focus:outline-none focus:ring-2 focus:border-transparent ${
                  isRequired && !mapping[col] ? 'border-red-300' : 'border-slate-300'
                }`}
                style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              >
                <option value="">{isRequired ? '— select column —' : '— skip —'}</option>
                {headers.map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              {mapping[col] && (
                <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Stage: Preview ─────────────────────────────────────────── */

function PreviewStage({ parsed }: { parsed: ParseResult }) {
  const previewRows = parsed.valid.slice(0, 5)
  const hasErrors = parsed.errors.length > 0

  return (
    <div className="px-6 py-4 space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-center">
          <p className="text-lg font-bold text-emerald-700">{parsed.valid.length}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Ready to import</p>
        </div>
        {hasErrors && (
          <div className="flex-1 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-center">
            <p className="text-lg font-bold text-red-600">{parsed.errors.length}</p>
            <p className="text-[11px] text-red-500 mt-0.5">Row{parsed.errors.length !== 1 ? 's' : ''} with errors</p>
          </div>
        )}
      </div>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Preview (first {previewRows.length} rows)
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Name', 'Funder', 'Category', 'Deadline', 'Amount', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((row, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">{row.name}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[120px] truncate">{row.funder}</td>
                    <td className="px-3 py-2 text-slate-500">{row.category ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{row.deadline ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {row.amount_high != null
                        ? `$${row.amount_high.toLocaleString()}`
                        : row.amount_low != null
                        ? `$${row.amount_low.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-medium">
                        {row.initial_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.valid.length > 5 && (
            <p className="text-[11px] text-slate-400 mt-1.5 text-right">
              + {parsed.valid.length - 5} more row{parsed.valid.length - 5 !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Errors */}
      {hasErrors && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-2">
            Rows with errors (will be skipped)
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50 px-3 py-2">
            {parsed.errors.map((e: ParseError, i: number) => (
              <p key={i} className="text-[11px] text-red-600">
                <span className="font-semibold">Row {e.row}:</span> {e.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Stage: Importing ───────────────────────────────────────── */

function ImportingStage({ progress, total }: { progress: number; total: number }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 gap-5">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
        <svg className="animate-spin w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-800">Importing grants…</p>
        <p className="text-xs text-slate-400 mt-1">{progress} of {total} processed</p>
      </div>
      <div className="w-full max-w-xs bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: 'var(--gold)' }}
        />
      </div>
      <p className="text-xs text-slate-400">{pct}%</p>
    </div>
  )
}

/* ── Stage: Done ────────────────────────────────────────────── */

function DoneStage({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  const allOk = result.failed === 0

  return (
    <div className="flex flex-col items-center justify-center py-12 px-8 gap-5 text-center">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center
        ${allOk ? 'bg-emerald-100' : 'bg-amber-100'}`}>
        {allOk ? (
          <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">
          {allOk ? 'Import complete!' : 'Import finished with some errors'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Successfully imported <span className="font-semibold text-emerald-600">{result.imported}</span> grant{result.imported !== 1 ? 's' : ''}
          {result.failed > 0 && (
            <>, <span className="font-semibold text-red-500">{result.failed}</span> failed</>
          )}
        </p>
      </div>

      {result.errors.length > 0 && (
        <div className="w-full text-left space-y-1 max-h-40 overflow-y-auto
          rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          {result.errors.map((e: string, i: number) => (
            <p key={i} className="text-[11px] text-red-600">{e}</p>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors"
        style={{ backgroundColor: 'var(--gold)' }}
      >
        Done
      </button>
    </div>
  )
}
