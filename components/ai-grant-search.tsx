'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { recalculateGrantScore } from '@/lib/utils/recalculate-scores'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils/formatting'
import { DeadlineBadge } from '@/components/badges'
import type { GrantsFullRow } from '@/lib/types/database.types'

/* ── Constants ──────────────────────────────────────────────── */

const MAX_RECENT = 5
const STORAGE_KEY = 'ai-grant-search-recent'

const PROMPT_SUGGESTIONS = [
  "Unrestricted funding for Indigenous-led ecological restoration",
  "Private foundation grants for tribal cultural revitalization",
  "Climate resilience funding for Native communities",
  "Youth education funding for tribes",
  "Health services for Indigenous communities",
]

const STATUS_LABELS: Record<string, string> = {
  discovered:  'Discovered',
  researching: 'Researching',
  writing:     'Writing',
  submitted:   'Submitted',
  awarded:     'Awarded',
  declined:    'Declined',
}

/* ── Types ──────────────────────────────────────────────────── */

export type FunderType = 'foundation' | 'government' | 'corporate' | 'community' | 'impact_investor'
export type Flexibility = 'unrestricted' | 'partially_restricted' | 'restricted'

export interface GrantSuggestion {
  name:             string
  funder:           string
  funder_type:      FunderType
  description:      string
  estimated_amount: string
  typical_deadline: string
  eligibility:      string
  why_match:        string
  flexibility:      Flexibility
  how_to_find:      string
}

type SuggestionFilter = 'all' | 'foundation' | 'government' | 'corporate' | 'unrestricted'

interface SearchResults {
  existing_matches: string[]
  suggestions:      GrantSuggestion[]
}

export interface AiGrantSearchProps {
  grants:    GrantsFullRow[]
  onAdded?:  () => void
}

/* ── Parsing helpers ────────────────────────────────────────── */

function parseAmount(str: string): { low: number | null; high: number | null } {
  if (!str) return { low: null, high: null }
  const clean = str.replace(/,/g, '')
  const amounts: number[] = []
  const re = /\$?([\d.]+)\s*([KkMmBb]?)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    let val = parseFloat(m[1])
    const suf = m[2].toLowerCase()
    if (suf === 'k') val *= 1_000
    if (suf === 'm') val *= 1_000_000
    if (suf === 'b') val *= 1_000_000_000
    if (!isNaN(val) && val >= 100) amounts.push(val)
  }
  if (amounts.length === 0) return { low: null, high: null }
  if (amounts.length === 1) return { low: null, high: amounts[0] }
  return { low: Math.min(...amounts), high: Math.max(...amounts) }
}

const ELIGIBILITY_MAP: { keywords: string[]; label: string }[] = [
  { keywords: ['tribal government', 'federally recognized tribe', 'indian tribe', 'tribe'],   label: 'Tribal Government' },
  { keywords: ['indigenous-led', 'native-led', 'indigenous led', 'native led'],                label: 'Indigenous-Led Org' },
  { keywords: ['501(c)(3)', '501c3', 'nonprofit', 'non-profit'],                               label: 'Nonprofit 501(c)(3)' },
  { keywords: ['faith-based', 'faith based', 'religious organization'],                        label: 'Faith-Based Org' },
  { keywords: ['state agency', 'state government'],                                            label: 'State Agency' },
  { keywords: ['local government', 'municipality', 'county government', 'city government'],    label: 'Local Government' },
  { keywords: ['school district'],                                                             label: 'School District' },
  { keywords: ['university', 'college', 'higher education', 'academic institution'],          label: 'University / College' },
  { keywords: ['rural community', 'rural organization'],                                       label: 'Rural Community' },
]

function parseEligibility(str: string): string[] {
  if (!str) return []
  const lower = str.toLowerCase()
  const found = new Set<string>()
  for (const { keywords, label } of ELIGIBILITY_MAP) {
    if (keywords.some(k => lower.includes(k))) found.add(label)
  }
  return [...found]
}

const CATEGORY_MAP: { keywords: string[]; category: string }[] = [
  { keywords: ['water', 'restoration', 'environment', 'conservation', 'climate', 'ecosystem', 'wetland', 'forest', 'wildlife', 'habitat'], category: 'Environment' },
  { keywords: ['natural resource', 'fisheries', 'soil', 'land management'],                                                                  category: 'Natural Resources' },
  { keywords: ['education', 'school', 'youth', 'student', 'learning', 'literacy', 'stem'],                                                  category: 'Education' },
  { keywords: ['health', 'medical', 'wellness', 'mental health', 'substance', 'public health'],                                              category: 'Health' },
  { keywords: ['infrastructure', 'housing', 'construction', 'facility', 'broadband', 'transportation'],                                      category: 'Infrastructure' },
  { keywords: ['art', 'culture', 'heritage', 'language', 'music', 'dance', 'cultural'],                                                      category: 'Arts & Culture' },
  { keywords: ['community', 'social service', 'workforce', 'economic development', 'neighborhood'],                                          category: 'Community Development' },
]

function inferCategory(description: string, name: string): string {
  const text = `${description} ${name}`.toLowerCase()
  for (const { keywords, category } of CATEGORY_MAP) {
    if (keywords.some(k => text.includes(k))) return category
  }
  return 'Other'
}

/* ── Funder type badge ──────────────────────────────────────── */

const FUNDER_TYPE_CONFIG: Record<FunderType, { label: string; cls: string }> = {
  foundation:      { label: 'Foundation',      cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  government:      { label: 'Government',      cls: 'bg-sky-500/10     text-sky-700     border-sky-500/20'     },
  corporate:       { label: 'Corporate',       cls: 'bg-violet-500/10  text-violet-700  border-violet-500/20'  },
  community:       { label: 'Community',       cls: 'bg-teal-500/10    text-teal-700    border-teal-500/20'    },
  impact_investor: { label: 'Impact Investor', cls: 'bg-amber-500/10   text-amber-700   border-amber-500/20'   },
}

function FunderTypeBadge({ type }: { type: FunderType | undefined }) {
  const cfg = type ? FUNDER_TYPE_CONFIG[type] : null
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ── Flexibility badge ──────────────────────────────────────── */

const FLEXIBILITY_CONFIG: Record<Flexibility, { label: string; cls: string }> = {
  unrestricted:        { label: 'Unrestricted',   cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  partially_restricted: { label: 'Partial',        cls: 'bg-amber-500/10   text-amber-700   border-amber-500/20'   },
  restricted:          { label: 'Restricted',     cls: 'bg-slate-100      text-slate-500   border-slate-200'       },
}

function FlexibilityBadge({ flexibility }: { flexibility: Flexibility | undefined }) {
  const cfg = flexibility ? FLEXIBILITY_CONFIG[flexibility] : null
  if (!cfg) return null
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

/* ── Fit score badge ────────────────────────────────────────── */

function FitBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null
  const cls =
    score >= 90 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
    score >= 80 ? 'bg-amber-500/10   text-amber-600   border-amber-500/20'   :
    score >= 70 ? 'bg-orange-500/10  text-orange-600  border-orange-500/20'  :
                  'bg-slate-100      text-slate-500    border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`}>
      {score}% fit
    </span>
  )
}

/* ── Status badge ───────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'awarded'     ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' :
    status === 'submitted'   ? 'bg-sky-500/10     text-sky-700     border-sky-500/20'     :
    status === 'writing'     ? 'bg-violet-500/10  text-violet-700  border-violet-500/20'  :
    status === 'researching' ? 'bg-amber-500/10   text-amber-700   border-amber-500/20'   :
                               'bg-slate-100      text-slate-500   border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

/* ── Existing grant card ────────────────────────────────────── */

function ExistingGrantCard({ grant: g }: { grant: GrantsFullRow }) {
  const { amount_low, amount_high } = g
  let amountStr = ''
  if (amount_low != null && amount_high != null)
    amountStr = `${formatCurrency(amount_low, { compact: true })} – ${formatCurrency(amount_high, { compact: true })}`
  else if (amount_high != null)
    amountStr = `Up to ${formatCurrency(amount_high, { compact: true })}`
  else if (amount_low != null)
    amountStr = `From ${formatCurrency(amount_low, { compact: true })}`

  return (
    <Link
      href={`/grants/${g.id}`}
      className="group flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-4
        hover:border-amber-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 leading-snug group-hover:text-amber-700
            transition-colors line-clamp-2">
            {g.name}
          </p>
          {g.funder && (
            <p className="text-xs text-slate-400 truncate mt-0.5">{g.funder}</p>
          )}
        </div>
        <FitBadge score={g.fit_score} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
        <StatusBadge status={g.pipeline_status} />
        {amountStr && <span className="text-xs text-slate-500">{amountStr}</span>}
        {g.deadline && <DeadlineBadge date={g.deadline} />}
      </div>
    </Link>
  )
}

/* ── Suggestion card ────────────────────────────────────────── */

function SuggestionCard({
  suggestion: s,
  onAdd,
}: {
  suggestion: GrantSuggestion
  onAdd: (s: GrantSuggestion) => Promise<boolean>
}) {
  const [adding, setAdding] = useState(false)
  const [added,  setAdded]  = useState(false)

  async function handleAdd() {
    setAdding(true)
    const ok = await onAdd(s)
    setAdding(false)
    if (ok) setAdded(true)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4
      hover:border-slate-300 hover:shadow-sm transition-all">

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
          <FunderTypeBadge type={s.funder_type} />
          <FlexibilityBadge flexibility={s.flexibility} />
        </div>
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{s.name}</p>
        <p className="text-xs text-slate-400 truncate mt-0.5">{s.funder}</p>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{s.description}</p>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {s.estimated_amount && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879
                   1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22
                   -2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33
                   M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            {s.estimated_amount}
          </span>
        )}
        {s.typical_deadline && (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5
                   A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5
                   A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5
                   A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {s.typical_deadline}
          </span>
        )}
      </div>

      {/* Why it matches */}
      {s.why_match && (
        <div className="rounded-lg border px-3 py-2 text-xs text-amber-800 leading-relaxed"
          style={{ borderColor: 'var(--gold-border)', backgroundColor: 'var(--gold-bg)' }}>
          <span className="font-semibold" style={{ color: 'var(--gold)' }}>Why it matches: </span>
          {s.why_match}
        </div>
      )}

      {/* How to Find */}
      {s.how_to_find && (
        <div className="rounded-lg border px-3 py-2 text-xs text-sky-800 leading-relaxed"
          style={{ borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}>
          <span className="font-semibold text-sky-700">How to find it: </span>
          {s.how_to_find}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {added ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
            text-emerald-700 bg-emerald-50 border border-emerald-200">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Added
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold
              text-white disabled:opacity-60 transition-opacity"
            style={{ backgroundColor: 'var(--gold)' }}
          >
            {adding ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                </svg>
                Adding…
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add to Pipeline
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Filter chips ───────────────────────────────────────────── */

const FILTERS: { value: SuggestionFilter; label: string }[] = [
  { value: 'all',         label: 'All' },
  { value: 'foundation',  label: 'Foundations' },
  { value: 'government',  label: 'Government' },
  { value: 'corporate',   label: 'Corporate' },
  { value: 'unrestricted', label: 'Unrestricted Only' },
]

function filterSuggestions(
  suggestions: GrantSuggestion[],
  filter: SuggestionFilter,
): GrantSuggestion[] {
  if (filter === 'all') return suggestions
  if (filter === 'unrestricted') return suggestions.filter(s => s.flexibility === 'unrestricted')
  return suggestions.filter(s => s.funder_type === filter)
}

/* ── Main component ─────────────────────────────────────────── */

export default function AiGrantSearch({ grants, onAdded }: AiGrantSearchProps) {
  const [query,           setQuery]          = useState('')
  const [loading,         setLoading]        = useState(false)
  const [error,           setError]          = useState<string | null>(null)
  const [results,         setResults]        = useState<SearchResults | null>(null)
  const [activeFilter,    setActiveFilter]   = useState<SuggestionFilter>('all')
  const [recentSearches,  setRecentSearches] = useState<string[]>([])
  const [organizationId,  setOrganizationId] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Fetch org ID on mount
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('organization_members')
      .select('organization_id')
      .single()
      .then(({ data }: { data: { organization_id: string } | null }) => {
        if (data?.organization_id) setOrganizationId(data.organization_id)
      })
  }, [])

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setRecentSearches(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function saveRecentSearch(q: string) {
    const next = [q, ...recentSearches.filter(s => s !== q)].slice(0, MAX_RECENT)
    setRecentSearches(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  async function handleSearch() {
    const q = query.trim()
    if (!q) {
      setError("Describe what kind of funding you're looking for")
      textareaRef.current?.focus()
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)
    setActiveFilter('all')

    try {
      const res = await fetch('/api/grant-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, organizationId }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error ?? 'Search failed. Please try again.')
        return
      }
      setResults(json.data as SearchResults)
      saveRecentSearch(q)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSuggestion(s: GrantSuggestion): Promise<boolean> {
    if (!organizationId) {
      toast('Unable to add grant — no organization found', 'error')
      return false
    }

    const supabase = createClient()
    const { low, high } = parseAmount(s.estimated_amount)
    const eligibility   = parseEligibility(s.eligibility)
    const category      = inferCategory(s.description, s.name)

    const { data: newGrantId, error: rpcErr } = await supabase.rpc('add_grant_to_pipeline', {
      p_organization_id:   organizationId,
      p_name:              s.name,
      p_funder:            s.funder       || null,
      p_description:       s.description  || null,
      p_category:          category,
      p_amount_low:        low,
      p_amount_high:       high,
      p_eligibility_types: eligibility.length ? eligibility : null,
      p_source_url:        null,
      p_initial_status:    'discovered',
    })

    if (rpcErr) {
      toast(`Failed to add grant: ${rpcErr.message}`, 'error')
      return false
    }

    toast(`Added "${s.name}" to pipeline`, 'success')

    if (newGrantId) {
      recalculateGrantScore(supabase, organizationId, newGrantId).catch(console.error)
    }

    onAdded?.()
    return true
  }

  // Map existing_match IDs → full grant objects
  const matchedGrants = results
    ? results.existing_matches
        .map(id => grants.find(g => g.id === id))
        .filter((g): g is GrantsFullRow => g !== undefined)
    : []

  const allSuggestions  = (results?.suggestions ?? []) as GrantSuggestion[]
  const shownSuggestions = filterSuggestions(allSuggestions, activeFilter)

  const hasResults = results && (matchedGrants.length > 0 || allSuggestions.length > 0)
  const noResults  = results && !hasResults

  // Compute which filter tabs have results
  function filterCount(f: SuggestionFilter): number {
    return filterSuggestions(allSuggestions, f).length
  }

  return (
    <div className="border-b border-slate-200"
      style={{ background: 'linear-gradient(to bottom, #fffbeb 0%, white 100%)' }}>

      {/* ── Search input area ─────────────────────────────── */}
      <div className="px-6 pt-5 pb-4">
        <div className="max-w-3xl">

          {/* Header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}>
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }}
                viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd"
                  d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.625 2.625 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.625 2.625 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 0 1 0 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 0 1-1.422 0l-.395-1.183a1.5 1.5 0 0 0-.948-.948l-1.183-.395a.75.75 0 0 1 0-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0 1 16.5 15Z" />
              </svg>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-900">AI Grant Search</span>
              <span className="ml-2 text-xs text-slate-400">
                Recommends funding directions to investigate — matches your pipeline and suggests new leads.
              </span>
            </div>
          </div>

          {/* Input row */}
          <div className="flex gap-2.5">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setError(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch() }
              }}
              placeholder="Describe what you're looking for... e.g. 'funding for water restoration projects on tribal lands'"
              rows={2}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900
                placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50
                focus:border-amber-400 resize-none leading-relaxed disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl px-5 text-sm font-semibold
                text-white disabled:opacity-50 transition-opacity self-stretch"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                  Searching…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5Z" />
                  </svg>
                  AI Search
                </>
              )}
            </button>
          </div>

          {/* Error */}
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          {/* Prompt chips */}
          {!results && !loading && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {recentSearches.length > 0 ? (
                <>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Recent:</span>
                  {recentSearches.map(s => (
                    <button key={s} type="button"
                      onClick={() => { setQuery(s); setError(null) }}
                      className="text-xs rounded-full border border-slate-200 bg-white px-3 py-1
                        text-slate-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                      {s}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Try:</span>
                  {PROMPT_SUGGESTIONS.map(s => (
                    <button key={s} type="button"
                      onClick={() => { setQuery(s); setError(null) }}
                      className="text-xs rounded-full border border-slate-200 bg-white px-3 py-1
                        text-slate-600 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 transition-colors">
                      {s}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Loading ────────────────────────────────────────── */}
      {loading && (
        <div className="px-6 pb-5">
          <div className="flex items-center gap-2.5 text-sm text-slate-500">
            <svg className="animate-spin w-4 h-4 shrink-0" style={{ color: 'var(--gold)' }}
              viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
            </svg>
            Finding funding directions to investigate…
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 space-y-2.5 animate-pulse">
                <div className="flex gap-1.5 mb-1">
                  <div className="h-5 bg-emerald-100 rounded-full w-20" />
                  <div className="h-5 bg-amber-100 rounded-full w-16" />
                </div>
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-5/6" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── No results ──────────────────────────────────────── */}
      {noResults && (
        <div className="px-6 pb-5">
          <p className="text-sm text-slate-500 py-2">
            No matching grants found. Try broadening your search.
          </p>
        </div>
      )}

      {/* ── Results ────────────────────────────────────────── */}
      {hasResults && (
        <div className="px-6 pb-6 space-y-5">

          {/* Disclaimer */}
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-500 leading-relaxed">
            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            These are recommended directions based on your profile and query. Verify current deadlines and availability before applying.
          </div>

          {/* Existing pipeline matches */}
          {matchedGrants.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Matches in Your Pipeline
                <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] text-white font-bold"
                  style={{ backgroundColor: 'var(--gold)' }}>
                  {matchedGrants.length}
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchedGrants.map(g => (
                  <ExistingGrantCard key={g.id} grant={g} />
                ))}
              </div>
            </div>
          )}

          {/* AI suggestions */}
          {allSuggestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  Recommended Grants to Explore
                  <span className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] text-white font-bold"
                    style={{ backgroundColor: 'var(--gold)' }}>
                    {shownSuggestions.length}
                  </span>
                </h3>
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                {FILTERS.map(f => {
                  const count = f.value === 'all' ? allSuggestions.length : filterCount(f.value)
                  if (f.value !== 'all' && count === 0) return null
                  const active = activeFilter === f.value
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setActiveFilter(f.value)}
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium
                        transition-colors ${
                        active
                          ? 'border-amber-400 bg-amber-50 text-amber-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {f.label}
                      <span className={`text-[10px] font-bold ${active ? 'text-amber-600' : 'text-slate-400'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {shownSuggestions.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shownSuggestions.map((s, i) => (
                    <SuggestionCard key={i} suggestion={s} onAdd={handleAddSuggestion} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-2">
                  No {activeFilter === 'unrestricted' ? 'unrestricted' : activeFilter} grants in these results.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
