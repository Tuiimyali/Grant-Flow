'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PipelineStatus } from '@/lib/types/database.types'
import { recalculateGrantScore } from '@/lib/utils/recalculate-scores'

/* ── Static options ─────────────────────────────────────────── */

const ELIGIBILITY_OPTIONS = [
  'Nonprofit 501(c)(3)',
  'Tribal Government',
  'Indigenous-Led Org',
  'State Agency',
  'Local Government',
  'School District',
  'University / College',
  'Faith-Based Org',
  'Rural Community',
  'For-Profit',
  'Individual',
  'Federal Agency',
]

const PIPELINE_STATUSES: { value: PipelineStatus; label: string }[] = [
  { value: 'discovered',  label: 'Discovered' },
  { value: 'researching', label: 'Researching' },
  { value: 'writing',     label: 'Writing' },
  { value: 'submitted',   label: 'Submitted' },
  { value: 'awarded',     label: 'Awarded' },
  { value: 'declined',    label: 'Declined' },
]

/* ── Types ──────────────────────────────────────────────────── */

interface Section     { id: string; title: string; page_limit: string }
interface Attachment  { id: string; name: string }

interface FormData {
  title: string
  funder_name: string
  description: string
  category: string
  amount_min: string
  amount_max: string
  deadline: string
  eligibility_types: string[]
  is_renewal: boolean
  effort_weeks: string
  source_url: string
  status: PipelineStatus
  sections: Section[]
  attachments: Attachment[]
  review_criteria: { criterion: string; weight: string; description: string }[]
  requirements_summary: string
}

const EMPTY: FormData = {
  title: '', funder_name: '', description: '', category: '',
  amount_min: '', amount_max: '', deadline: '',
  eligibility_types: [], is_renewal: false,
  effort_weeks: '', source_url: '',
  status: 'discovered',
  sections: [], attachments: [],
  review_criteria: [], requirements_summary: '',
}

function uid() { return Math.random().toString(36).slice(2, 9) }

/* ── Eligibility label → DB value map ──────────────────────── */
// The AI returns short keys; map them to our display labels
const ELIGIBILITY_MAP: Record<string, string> = {
  tribal:     'Tribal Government',
  '501c3':    'Nonprofit 501(c)(3)',
  faith_based:'Faith-Based Org',
  government: 'State Agency',
  other:      'Other',
}

/* ── Shared primitives ──────────────────────────────────────── */

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 ' +
  'disabled:bg-slate-50 disabled:text-slate-400'

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wide">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  )
}

function FieldGroup({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-1 ${className}`}>{children}</div>
}

/* ── Modal ──────────────────────────────────────────────────── */

interface AddGrantModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  prefill?: { title?: string; funder_name?: string; description?: string }
}

export default function AddGrantModal({ open, onClose, onSuccess, prefill }: AddGrantModalProps) {
  const [form, setForm]         = useState<FormData>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const firstInputRef           = useRef<HTMLInputElement>(null)

  // URL auto-fill state
  const [urlInput, setUrlInput]         = useState('')
  const [extracting, setExtracting]     = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [fillSuccess, setFillSuccess]   = useState(false)

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm(prefill ? { ...EMPTY, ...prefill } : EMPTY)
      setError(null)
      setUrlInput('')
      setExtractError(null)
      setFillSuccess(false)
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  /* ── Field helpers ──────────────────────────────────────── */

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function toggleEligibility(label: string) {
    set('eligibility_types',
      form.eligibility_types.includes(label)
        ? form.eligibility_types.filter(e => e !== label)
        : [...form.eligibility_types, label]
    )
  }

  /* ── URL Auto-fill ──────────────────────────────────────── */

  async function handleAutoFill() {
    if (!urlInput.trim()) {
      setExtractError('Please enter a valid URL')
      return
    }
    setExtracting(true)
    setExtractError(null)
    setFillSuccess(false)

    try {
      const res = await fetch('/api/grant-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setExtractError(json.error ?? 'Could not extract grant details. Please fill in manually.')
        return
      }

      const d = json.data as Record<string, unknown>

      // Map eligibility_types: AI returns short keys, map to display labels
      const rawEligibility = Array.isArray(d.eligibility_types) ? d.eligibility_types as string[] : []
      const mappedEligibility = rawEligibility
        .map(k => ELIGIBILITY_MAP[k] ?? k)
        .filter(v => ELIGIBILITY_OPTIONS.includes(v))

      // Map sections: AI returns { title, limit } we store { id, title, page_limit }
      const rawSections = Array.isArray(d.sections) ? d.sections as { title: string; limit?: string }[] : []
      const mappedSections: Section[] = rawSections.map(s => ({
        id: uid(),
        title: s.title ?? '',
        page_limit: s.limit ?? '',
      }))

      // Map attachments: AI returns strings[]
      const rawAttachments = Array.isArray(d.attachments) ? d.attachments as string[] : []
      const mappedAttachments: Attachment[] = rawAttachments.map(name => ({ id: uid(), name }))

      // Map review_criteria
      type RawCriterion = { criterion?: string; weight?: string; description?: string }
      const rawCriteria = Array.isArray(d.review_criteria) ? d.review_criteria as RawCriterion[] : []
      const mappedCriteria = rawCriteria.map(c => ({
        criterion: c.criterion ?? '',
        weight: c.weight ?? '',
        description: c.description ?? '',
      }))

      setForm({
        title:               typeof d.name === 'string'        ? d.name        : '',
        funder_name:         typeof d.funder === 'string'      ? d.funder      : '',
        description:         typeof d.description === 'string' ? d.description : '',
        category:            typeof d.category === 'string'    ? d.category    : '',
        amount_min:          d.amount_low  ? String(d.amount_low)  : '',
        amount_max:          d.amount_high ? String(d.amount_high) : '',
        deadline:            typeof d.deadline === 'string' && d.deadline ? d.deadline : '',
        eligibility_types:   mappedEligibility,
        is_renewal:          d.is_renewal === true,
        effort_weeks:        d.effort_weeks ? String(d.effort_weeks) : '',
        source_url:          urlInput.trim(),
        status:              'discovered',
        sections:            mappedSections,
        attachments:         mappedAttachments,
        review_criteria:     mappedCriteria,
        requirements_summary: typeof d.requirements_summary === 'string' ? d.requirements_summary : '',
      })
      setFillSuccess(true)
    } finally {
      setExtracting(false)
    }
  }

  /* ── Section builder ────────────────────────────────────── */

  function addSection() {
    set('sections', [...form.sections, { id: uid(), title: '', page_limit: '' }])
  }
  function updateSection(id: string, field: 'title' | 'page_limit', value: string) {
    set('sections', form.sections.map(s => s.id === id ? { ...s, [field]: value } : s))
  }
  function removeSection(id: string) {
    set('sections', form.sections.filter(s => s.id !== id))
  }
  function moveSection(id: string, dir: 'up' | 'down') {
    const idx = form.sections.findIndex(s => s.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === form.sections.length - 1) return
    const next = [...form.sections]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    set('sections', next)
  }

  /* ── Attachment builder ─────────────────────────────────── */

  function addAttachment() {
    set('attachments', [...form.attachments, { id: uid(), name: '' }])
  }
  function updateAttachment(id: string, value: string) {
    set('attachments', form.attachments.map(a => a.id === id ? { ...a, name: value } : a))
  }
  function removeAttachment(id: string) {
    set('attachments', form.attachments.filter(a => a.id !== id))
  }
  function moveAttachment(id: string, dir: 'up' | 'down') {
    const idx = form.attachments.findIndex(a => a.id === id)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === form.attachments.length - 1) return
    const next = [...form.attachments]
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    set('attachments', next)
  }

  /* ── Submit ─────────────────────────────────────────────── */

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Grant name is required.'); return }

    setSaving(true)
    setError(null)

    const supabase = createClient()

    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()

    if (!member?.organization_id) {
      setError('No organisation found. Please refresh and try again.')
      setSaving(false)
      return
    }

    const { data: newGrantId, error: rpcErr } = await supabase.rpc('add_grant_to_pipeline', {
      p_organization_id: member.organization_id,
      p_name:            form.title.trim(),
      p_funder:          form.funder_name.trim()    || null,
      p_description:     form.description.trim()    || null,
      p_category:        form.category.trim()       || null,
      p_amount_low:      form.amount_min  ? Number(form.amount_min)  : null,
      p_amount_high:     form.amount_max  ? Number(form.amount_max)  : null,
      p_deadline:        form.deadline    || null,
      p_eligibility_types: form.eligibility_types.length ? form.eligibility_types : null,
      p_is_renewal:      form.is_renewal,
      p_effort_weeks:    form.effort_weeks ? Number(form.effort_weeks) : null,
      p_source_url:      form.source_url.trim() || null,
      p_initial_status:  form.status,
      p_sections:        form.sections.length
        ? form.sections.map(s => ({ title: s.title, page_limit: s.page_limit ? Number(s.page_limit) : null }))
        : null,
      p_attachments:     form.attachments.length
        ? form.attachments.filter(a => a.name.trim()).map(a => ({ name: a.name.trim() }))
        : null,
    })

    // Save review_criteria + requirements_summary if we have an id
    if (!rpcErr && newGrantId) {
      const updatePayload: Record<string, unknown> = {}
      if (form.review_criteria.length) updatePayload.review_criteria = form.review_criteria
      if (form.requirements_summary.trim()) updatePayload.requirements_summary = form.requirements_summary.trim()
      if (Object.keys(updatePayload).length) {
        await supabase.from('grants').update(updatePayload).eq('id', newGrantId)
      }
    }

    setSaving(false)

    if (rpcErr) {
      setError(rpcErr.message)
    } else {
      if (newGrantId) {
        recalculateGrantScore(supabase, member.organization_id, newGrantId).catch(console.error)
      }
      onSuccess()
      onClose()
    }
  }

  /* ── Render ─────────────────────────────────────────────── */

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 pt-8 pb-16"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add grant to pipeline</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fill in what you know — all fields except Name are optional.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Form ────────────────────────────────────────── */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">

            {/* ── URL Auto-fill ───────────────────────────── */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-0.5">Auto-fill from URL</p>
                <p className="text-xs text-amber-700/80">Paste a grant page URL and we'll extract the details automatically.</p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={firstInputRef}
                  type="url"
                  value={urlInput}
                  onChange={e => { setUrlInput(e.target.value); setExtractError(null); setFillSuccess(false) }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAutoFill() } }}
                  placeholder="https://grants.gov/…"
                  className={`${inputCls} flex-1`}
                  disabled={extracting}
                />
                <button
                  type="button"
                  onClick={handleAutoFill}
                  disabled={extracting || !urlInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white
                    disabled:opacity-50 transition-opacity shrink-0"
                  style={{ backgroundColor: 'var(--gold)' }}
                >
                  {extracting ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                      </svg>
                      Reading…
                    </>
                  ) : 'Auto-fill'}
                </button>
              </div>
              {extracting && (
                <p className="text-xs text-amber-700 flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                  Reading grant details…
                </p>
              )}
              {extractError && (
                <p className="text-xs text-red-600">{extractError}</p>
              )}
              {fillSuccess && (
                <p className="text-xs text-emerald-700 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Fields filled in — review and edit below before saving.
                </p>
              )}
              <p className="text-[11px] text-amber-600/70">Or fill in manually below.</p>
            </div>

            {/* ── Basic info ─────────────────────────────── */}
            <Section label="Basic Information">
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup className="col-span-2">
                  <Label required>Grant name</Label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => set('title', e.target.value)}
                    placeholder="e.g. EPA Water Infrastructure Grant"
                    className={inputCls}
                    required
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label>Funder</Label>
                  <input type="text" value={form.funder_name}
                    onChange={e => set('funder_name', e.target.value)}
                    placeholder="e.g. EPA, Robert Wood Johnson"
                    className={inputCls} />
                </FieldGroup>

                <FieldGroup>
                  <Label>Category</Label>
                  <input type="text" value={form.category}
                    onChange={e => set('category', e.target.value)}
                    placeholder="e.g. Infrastructure, Health"
                    className={inputCls} />
                </FieldGroup>

                <FieldGroup className="col-span-2">
                  <Label>Description</Label>
                  <textarea
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Brief description of the grant opportunity…"
                    rows={3}
                    className={`${inputCls} resize-y`}
                  />
                </FieldGroup>

                <FieldGroup className="col-span-2">
                  <Label>Source URL</Label>
                  <input type="url" value={form.source_url}
                    onChange={e => set('source_url', e.target.value)}
                    placeholder="https://grants.gov/…"
                    className={inputCls} />
                </FieldGroup>
              </div>
            </Section>

            {/* ── Amount & timeline ──────────────────────── */}
            <Section label="Amount &amp; Timeline">
              <div className="grid grid-cols-2 gap-4">
                <FieldGroup>
                  <Label>Amount — low ($)</Label>
                  <input type="number" min={0} value={form.amount_min}
                    onChange={e => set('amount_min', e.target.value)}
                    placeholder="50000"
                    className={inputCls} />
                </FieldGroup>

                <FieldGroup>
                  <Label>Amount — high ($)</Label>
                  <input type="number" min={0} value={form.amount_max}
                    onChange={e => set('amount_max', e.target.value)}
                    placeholder="500000"
                    className={inputCls} />
                </FieldGroup>

                <FieldGroup>
                  <Label>Deadline</Label>
                  <input type="date" value={form.deadline}
                    onChange={e => set('deadline', e.target.value)}
                    className={inputCls} />
                </FieldGroup>

                <FieldGroup>
                  <Label>Effort (weeks)</Label>
                  <input type="number" min={1} max={52} value={form.effort_weeks}
                    onChange={e => set('effort_weeks', e.target.value)}
                    placeholder="4"
                    className={inputCls} />
                </FieldGroup>
              </div>
            </Section>

            {/* ── Eligibility ────────────────────────────── */}
            <Section label="Eligibility">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {ELIGIBILITY_OPTIONS.map(opt => {
                  const checked = form.eligibility_types.includes(opt)
                  return (
                    <label
                      key={opt}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors
                        ${checked
                          ? 'border-amber-400 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleEligibility(opt)}
                        className="accent-amber-500 w-3.5 h-3.5 shrink-0"
                      />
                      <span className="text-xs font-medium leading-tight">{opt}</span>
                    </label>
                  )
                })}
              </div>

              {/* is_renewal toggle */}
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.is_renewal}
                  onClick={() => set('is_renewal', !form.is_renewal)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors
                    ${form.is_renewal ? 'bg-amber-500' : 'bg-slate-200'}`}
                >
                  <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
                    transform transition-transform ${form.is_renewal ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
                <span className="text-sm text-slate-700 font-medium">Renewal grant</span>
              </label>
            </Section>

            {/* ── Pipeline status ────────────────────────── */}
            <Section label="Pipeline">
              <FieldGroup className="max-w-xs">
                <Label>Initial status</Label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as PipelineStatus)}
                  className={inputCls}
                >
                  {PIPELINE_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </FieldGroup>
            </Section>

            {/* ── Requirements summary ───────────────────── */}
            {(form.requirements_summary || form.review_criteria.length > 0) && (
              <Section label="What the Funder is Looking For">
                {form.requirements_summary && (
                  <FieldGroup className="mb-4">
                    <Label>Requirements summary</Label>
                    <textarea
                      value={form.requirements_summary}
                      onChange={e => set('requirements_summary', e.target.value)}
                      rows={4}
                      className={`${inputCls} resize-y`}
                    />
                  </FieldGroup>
                )}
                {form.review_criteria.length > 0 && (
                  <div>
                    <Label>Review criteria</Label>
                    <div className="mt-1 space-y-2">
                      {form.review_criteria.map((c, i) => (
                        <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold">{c.criterion}</span>
                            {c.weight && <span className="text-slate-400">{c.weight}</span>}
                          </div>
                          {c.description && <p className="text-slate-500 leading-relaxed">{c.description}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {/* ── Sections builder ───────────────────────── */}
            <Section label="Application Sections">
              <div className="space-y-2">
                {form.sections.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {/* Reorder */}
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moveSection(s.id, 'up')} disabled={i === 0}
                        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => moveSection(s.id, 'down')} disabled={i === form.sections.length - 1}
                        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right tabular-nums">{i + 1}.</span>
                    <input
                      type="text"
                      value={s.title}
                      onChange={e => updateSection(s.id, 'title', e.target.value)}
                      placeholder="Section title"
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={s.page_limit}
                      onChange={e => updateSection(s.id, 'page_limit', e.target.value)}
                      placeholder="Pages"
                      className={`${inputCls} w-20`}
                    />
                    <button type="button" onClick={() => removeSection(s.id)}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addSection}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors mt-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add section
                </button>
              </div>
            </Section>

            {/* ── Attachments builder ────────────────────── */}
            <Section label="Required Attachments">
              <div className="space-y-2">
                {form.attachments.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    {/* Reorder */}
                    <div className="flex flex-col shrink-0">
                      <button type="button" onClick={() => moveAttachment(a.id, 'up')} disabled={i === 0}
                        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => moveAttachment(a.id, 'down')} disabled={i === form.attachments.length - 1}
                        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right tabular-nums">{i + 1}.</span>
                    <input
                      type="text"
                      value={a.name}
                      onChange={e => updateAttachment(a.id, e.target.value)}
                      placeholder="e.g. Letter of support, Budget narrative"
                      className={`${inputCls} flex-1`}
                    />
                    <button type="button" onClick={() => removeAttachment(a.id)}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addAttachment}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors mt-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Add attachment
                </button>
              </div>
            </Section>

          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl gap-4">
            {error ? (
              <p className="text-xs text-red-600 flex-1 min-w-0">{error}</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white
                  disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'var(--gold)' }}
              >
                {saving && (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                )}
                {saving ? 'Adding…' : 'Add to pipeline'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Section divider ─────────────────────────────────────────── */

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 pb-2 mb-3 border-b border-slate-100"
        dangerouslySetInnerHTML={{ __html: label }}
      />
      {children}
    </div>
  )
}
