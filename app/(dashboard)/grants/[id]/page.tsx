'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DeadlineBadge } from '@/components/badges'
import { formatCurrency } from '@/lib/utils/formatting'
import { fitBand, FIT_COLORS } from '@/lib/utils/scoring'
import { DIMENSION_LABELS } from '@/lib/scoring/calculate-fit'
import type {
  GrantsFullRow,
  GrantSection,
  GrantAttachment,
  FitBreakdown,
  ReviewCriterion,
} from '@/lib/types/database.types'

/* ── Local builder types (UI-only id for keying) ────────────── */

type SectionRow    = { _id: string; title: string; page_limit: string }
type AttachmentRow = { _id: string; name: string }

function uid() { return Math.random().toString(36).slice(2, 9) }

function toSectionRows(sections: GrantSection[] | null): SectionRow[] {
  return (sections ?? []).map(s => ({
    _id: uid(),
    title: s.title ?? '',
    page_limit: s.page_limit != null ? String(s.page_limit) : '',
  }))
}

function toAttachmentRows(attachments: GrantAttachment[] | null): AttachmentRow[] {
  return (attachments ?? []).map(a => ({ _id: uid(), name: a.name ?? '' }))
}

/* ── Status pill styles ─────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  discovered:  { bg: 'bg-slate-100',    text: 'text-slate-600',   label: 'Discovered' },
  researching: { bg: 'bg-sky-100',      text: 'text-sky-700',     label: 'Researching' },
  writing:     { bg: 'bg-violet-100',   text: 'text-violet-700',  label: 'Writing' },
  submitted:   { bg: 'bg-amber-100',    text: 'text-amber-700',   label: 'Submitted' },
  awarded:     { bg: 'bg-emerald-100',  text: 'text-emerald-700', label: 'Awarded' },
  declined:    { bg: 'bg-rose-100',     text: 'text-rose-700',    label: 'Declined' },
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400'

/* ── Page ───────────────────────────────────────────────────── */

export default function GrantDetailPage() {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()

  const [grant,               setGrant]               = useState<GrantsFullRow | null>(null)
  const [sections,            setSections]            = useState<SectionRow[]>([])
  const [attachments,         setAttachments]         = useState<AttachmentRow[]>([])
  const [description,         setDescription]         = useState('')
  const [sourceUrl,           setSourceUrl]           = useState<string | null>(null)
  const [reviewCriteria,      setReviewCriteria]      = useState<ReviewCriterion[]>([])
  const [reqSummary,          setReqSummary]          = useState('')
  const [loading,             setLoading]             = useState(true)
  const [notFound,            setNotFound]            = useState(false)
  const [breakdown,           setBreakdown]           = useState<FitBreakdown | null>(null)
  const [saving,              setSaving]              = useState(false)
  const [saveStatus,          setSaveStatus]          = useState<'idle' | 'saved' | 'error'>('idle')
  const [startingDraft,       setStartingDraft]       = useState(false)

  /* ── Fetch ──────────────────────────────────────────────── */

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      const supabase = createClient()

      const [{ data: full }, { data: detail }, { data: match }] = await Promise.all([
        supabase.from('grants_full').select('*').eq('id', id).single(),
        supabase
          .from('grants')
          .select('sections, attachments, description, source_url, review_criteria, requirements_summary')
          .eq('id', id)
          .single(),
        supabase.from('grant_matches').select('score_breakdown').eq('grant_id', id).maybeSingle(),
      ])

      if (cancelled) return

      if (!full) { setNotFound(true); setLoading(false); return }

      const d = detail as {
        sections: GrantSection[] | null
        attachments: GrantAttachment[] | null
        description: string | null
        source_url: string | null
        review_criteria: ReviewCriterion[] | null
        requirements_summary: string | null
      } | null

      setGrant(full as GrantsFullRow)
      setSections(toSectionRows(d?.sections ?? null))
      setAttachments(toAttachmentRows(d?.attachments ?? null))
      setDescription(d?.description ?? '')
      setSourceUrl(d?.source_url ?? null)
      setReviewCriteria(d?.review_criteria ?? [])
      setReqSummary(d?.requirements_summary ?? '')
      setBreakdown((match as { score_breakdown: FitBreakdown | null } | null)?.score_breakdown ?? null)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [id])

  /* ── Section helpers ────────────────────────────────────── */

  function addSection() {
    setSections(prev => [...prev, { _id: uid(), title: '', page_limit: '' }])
  }
  function updateSection(_id: string, field: 'title' | 'page_limit', value: string) {
    setSections(prev => prev.map(s => s._id === _id ? { ...s, [field]: value } : s))
  }
  function removeSection(_id: string) {
    setSections(prev => prev.filter(s => s._id !== _id))
  }
  function moveSection(_id: string, dir: 'up' | 'down') {
    setSections(prev => {
      const idx = prev.findIndex(s => s._id === _id)
      if (dir === 'up' && idx === 0) return prev
      if (dir === 'down' && idx === prev.length - 1) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  /* ── Attachment helpers ─────────────────────────────────── */

  function addAttachment() {
    setAttachments(prev => [...prev, { _id: uid(), name: '' }])
  }
  function updateAttachment(_id: string, value: string) {
    setAttachments(prev => prev.map(a => a._id === _id ? { ...a, name: value } : a))
  }
  function removeAttachment(_id: string) {
    setAttachments(prev => prev.filter(a => a._id !== _id))
  }
  function moveAttachment(_id: string, dir: 'up' | 'down') {
    setAttachments(prev => {
      const idx = prev.findIndex(a => a._id === _id)
      if (dir === 'up' && idx === 0) return prev
      if (dir === 'down' && idx === prev.length - 1) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  /* ── Save ───────────────────────────────────────────────── */

  async function handleSave() {
    if (!id) return
    setSaving(true)
    setSaveStatus('idle')

    const supabase = createClient()
    const { error } = await supabase
      .from('grants')
      .update({
        sections: sections
          .filter(s => s.title.trim())
          .map(s => ({ title: s.title.trim(), page_limit: s.page_limit ? Number(s.page_limit) : null })),
        attachments: attachments
          .filter(a => a.name.trim())
          .map(a => ({ name: a.name.trim() })),
        review_criteria: reviewCriteria,
        requirements_summary: reqSummary.trim() || null,
      })
      .eq('id', id)

    setSaving(false)
    setSaveStatus(error ? 'error' : 'saved')
    if (!error) setTimeout(() => setSaveStatus('idle'), 2500)
  }

  /* ── Start Draft ────────────────────────────────────────── */

  async function handleStartDraft() {
    if (!id || !grant) return
    setStartingDraft(true)
    const supabase = createClient()

    // Update pipeline status to 'writing'
    await supabase
      .from('pipeline_items')
      .update({ status: 'writing' })
      .eq('grant_id', id)

    router.push('/drafts')
  }

  /* ── Render ─────────────────────────────────────────────── */

  if (loading) return <DetailSkeleton />

  if (notFound) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-sm text-slate-500">Grant not found.</p>
      <Link href="/grants" className="text-sm font-medium underline text-slate-600">← Back to grants</Link>
    </div>
  )

  const g = grant!
  const status   = STATUS_STYLES[g.pipeline_status] ?? STATUS_STYLES.discovered
  const fitBand_ = fitBand(g.fit_score)
  const fitColor = FIT_COLORS[fitBand_]

  const amountStr =
    g.amount_low != null && g.amount_high != null
      ? `${formatCurrency(g.amount_low, { compact: true })} – ${formatCurrency(g.amount_high, { compact: true })}`
      : g.amount_high != null ? `Up to ${formatCurrency(g.amount_high, { compact: true })}`
      : g.amount_low  != null ? `From ${formatCurrency(g.amount_low,  { compact: true })}`
      : null

  return (
    <div className="flex flex-col h-full min-h-0 overflow-auto" style={{ backgroundColor: 'var(--surface)' }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <Link href="/grants"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-700 transition-colors mb-3">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Grant Discovery
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${status.bg} ${status.text}`}>
                {status.label}
              </span>
              {g.is_renewal && (
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  Renewal
                </span>
              )}
            </div>
            <h1 className="text-xl font-semibold text-slate-900 leading-snug">{g.name}</h1>
            {g.funder && <p className="text-sm text-slate-500 mt-0.5">{g.funder}</p>}
          </div>

          <div className="flex items-center gap-3 flex-wrap shrink-0">
            {g.fit_score != null && (
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${fitColor.bg} ${fitColor.text} ${fitColor.border}`}>
                {g.fit_score}% fit
              </span>
            )}
            {amountStr && (
              <span className="text-sm font-semibold text-slate-700">{amountStr}</span>
            )}
            <DeadlineBadge date={g.deadline} />
            <button
              onClick={handleStartDraft}
              disabled={startingDraft}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white
                disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {startingDraft ? 'Starting…' : 'Start Draft'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">

        {/* ── Left column ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Overview */}
          <Card title="Overview">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Fact label="Category">{g.category ?? '—'}</Fact>
              <Fact label="Funder type">{g.funder_type ?? '—'}</Fact>
              <Fact label="Deadline">{g.deadline ?? '—'}</Fact>
              <Fact label="Effort">{g.effort_weeks != null ? `${g.effort_weeks} weeks` : '—'}</Fact>
              {amountStr && <Fact label="Amount" wide>{amountStr}</Fact>}
              {sourceUrl && (
                <Fact label="Source" wide>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-600 hover:underline break-all"
                  >
                    {sourceUrl}
                  </a>
                </Fact>
              )}
            </dl>
          </Card>

          {/* Eligibility */}
          {(g.eligibility_types?.length ?? 0) > 0 && (
            <Card title="Eligibility">
              <div className="flex flex-wrap gap-1.5">
                {g.eligibility_types!.map(tag => (
                  <span key={tag}
                    className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium bg-sky-500/10 text-sky-600 border-sky-500/20">
                    {tag}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Description */}
          {description && (
            <Card title="Description">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{description}</p>
            </Card>
          )}

          {/* Requirements Summary */}
          {reqSummary && (
            <Card title="What the Funder is Looking For">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{reqSummary}</p>
            </Card>
          )}

          {/* Review Criteria */}
          {reviewCriteria.length > 0 && (
            <Card title="Review Criteria">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-100">
                      <th className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-2/5">Criterion</th>
                      <th className="pb-2 pr-4 text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-16">Weight</th>
                      <th className="pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {reviewCriteria.map((c, i) => (
                      <tr key={i} className="align-top">
                        <td className="py-2.5 pr-4 font-medium text-slate-700">{c.criterion}</td>
                        <td className="py-2.5 pr-4 text-slate-500 tabular-nums">{c.weight || '—'}</td>
                        <td className="py-2.5 text-slate-500 leading-relaxed">{c.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Notes */}
          {g.notes && (
            <Card title="Notes">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{g.notes}</p>
            </Card>
          )}

          {/* Fit score breakdown */}
          {(breakdown || g.fit_score != null) && (
            <Card title="Fit Score Breakdown">
              <div className="space-y-3">
                {breakdown ? (
                  (Object.keys(breakdown) as (keyof FitBreakdown)[]).map(dim => {
                    const score = breakdown[dim]
                    const barColor =
                      score >= 80 ? 'bg-emerald-400' :
                      score >= 60 ? 'bg-amber-400'   :
                      score >= 40 ? 'bg-sky-400'     :
                      score > 0   ? 'bg-slate-300'   : 'bg-slate-100'
                    return (
                      <div key={dim}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500">{DIMENSION_LABELS[dim]}</span>
                          <span className="text-xs font-semibold tabular-nums text-slate-700">{score}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-slate-400">
                    Breakdown not yet calculated. Save your organisation profile to generate scores.
                  </p>
                )}

                {g.fit_score != null && (
                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">Composite</span>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${fitColor.bg} ${fitColor.text} ${fitColor.border}`}>
                      {g.fit_score}%
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

        </div>

        {/* ── Right: Application Setup ─────────────────────── */}
        <div className="space-y-4">

          {/* Sections builder */}
          <Card title={`Application Sections${sections.length ? ` (${sections.length})` : ''}`}
            action={
              <button onClick={addSection}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            }
          >
            {sections.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">
                No sections yet. Add sections to track what needs to be written.
              </p>
            ) : (
              <div className="space-y-2">
                {sections.map((s, i) => (
                  <div key={s._id} className="flex items-center gap-2">
                    <ReorderButtons
                      onUp={() => moveSection(s._id, 'up')}
                      onDown={() => moveSection(s._id, 'down')}
                      disableUp={i === 0}
                      disableDown={i === sections.length - 1}
                    />
                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right tabular-nums">{i + 1}.</span>
                    <input
                      type="text"
                      value={s.title}
                      onChange={e => updateSection(s._id, 'title', e.target.value)}
                      placeholder="Section title"
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      type="number"
                      min={1}
                      value={s.page_limit}
                      onChange={e => updateSection(s._id, 'page_limit', e.target.value)}
                      placeholder="pp"
                      className={`${inputCls} w-16 text-center`}
                      title="Page limit"
                    />
                    <RemoveButton onClick={() => removeSection(s._id)} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Attachments builder */}
          <Card title={`Required Attachments${attachments.length ? ` (${attachments.length})` : ''}`}
            action={
              <button onClick={addAttachment}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-amber-600 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            }
          >
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 py-1">
                No attachments yet. List required documents (letters, budgets, etc.).
              </p>
            ) : (
              <div className="space-y-2">
                {attachments.map((a, i) => (
                  <div key={a._id} className="flex items-center gap-2">
                    <ReorderButtons
                      onUp={() => moveAttachment(a._id, 'up')}
                      onDown={() => moveAttachment(a._id, 'down')}
                      disableUp={i === 0}
                      disableDown={i === attachments.length - 1}
                    />
                    <span className="text-xs text-slate-400 w-4 shrink-0 text-right tabular-nums">{i + 1}.</span>
                    <input
                      type="text"
                      value={a.name}
                      onChange={e => updateAttachment(a._id, e.target.value)}
                      placeholder="e.g. Letter of support, Budget narrative"
                      className={`${inputCls} flex-1`}
                    />
                    <RemoveButton onClick={() => removeAttachment(a._id)} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Requirements Summary editor */}
          <Card title="Requirements Summary">
            <textarea
              value={reqSummary}
              onChange={e => setReqSummary(e.target.value)}
              rows={5}
              placeholder="What is the funder looking for? Key priorities and tips for a strong application…"
              className={`${inputCls} resize-y`}
            />
          </Card>

          {/* Save button */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs">
              {saveStatus === 'saved' && <span className="text-emerald-600">Changes saved.</span>}
              {saveStatus === 'error' && <span className="text-red-500">Save failed — please try again.</span>}
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
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
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ── Shared sub-components ──────────────────────────────────── */

function Card({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</h3>
        {action}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

function Fact({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  )
}

function ReorderButtons({
  onUp, onDown, disableUp, disableDown,
}: {
  onUp: () => void; onDown: () => void; disableUp: boolean; disableDown: boolean
}) {
  return (
    <div className="flex flex-col shrink-0 gap-px">
      <button type="button" onClick={onUp} disabled={disableUp}
        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button type="button" onClick={onDown} disabled={disableDown}
        className="p-0.5 text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  )
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function DetailSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-24 mb-6" />
      <div className="h-7 bg-slate-200 rounded w-64" />
      <div className="h-4 bg-slate-100 rounded w-40" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-100 rounded w-3/4" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-9 bg-slate-100 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
