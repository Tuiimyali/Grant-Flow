'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import PageHeader from '@/components/page-header'
import { DeadlineBadge } from '@/components/badges'
import AddGrantModal from '@/components/add-grant-modal'
import GrantCsvModal from '@/components/grant-csv-modal'
import { useGrants } from '@/lib/hooks/use-grants'
import { createClient } from '@/lib/supabase/client'
import { calculateFit } from '@/lib/scoring/calculate-fit'
import { toast } from '@/lib/toast'
import { exportGrantsToCsv } from '@/lib/utils/csv-grants'
import { formatCurrency, daysUntil } from '@/lib/utils/formatting'
import type { GrantsFullRow, PipelineStatus, OrganizationProfile } from '@/lib/types/database.types'

/* ── Constants ──────────────────────────────────────────────── */

const PIPELINE_STATUSES: PipelineStatus[] = [
  'discovered', 'researching', 'writing', 'submitted', 'awarded', 'declined',
]

const STATUS_LABELS: Record<PipelineStatus, string> = {
  discovered:  'Discovered',
  researching: 'Researching',
  writing:     'Writing',
  submitted:   'Submitted',
  awarded:     'Awarded',
  declined:    'Declined',
}

type SortKey = 'fit_score' | 'deadline' | 'amount_high' | 'name'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'fit_score',   label: 'Fit Score' },
  { value: 'deadline',    label: 'Deadline' },
  { value: 'amount_high', label: 'Amount' },
  { value: 'name',        label: 'Name' },
]

/* ── Eligibility tag colours ────────────────────────────────── */
const TAG_PALETTES = [
  'bg-sky-500/10 text-sky-500 border-sky-500/20',
  'bg-violet-500/10 text-violet-500 border-violet-500/20',
  'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'bg-rose-500/10 text-rose-500 border-rose-500/20',
  'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
]

function tagPalette(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return TAG_PALETTES[h % TAG_PALETTES.length]
}

/* ── Helpers ────────────────────────────────────────────────── */

function formatAmountRange(row: GrantsFullRow): string {
  const { amount_low, amount_high } = row
  if (amount_low != null && amount_high != null)
    return `${formatCurrency(amount_low, { compact: true })} – ${formatCurrency(amount_high, { compact: true })}`
  if (amount_high != null) return `Up to ${formatCurrency(amount_high, { compact: true })}`
  if (amount_low != null) return `From ${formatCurrency(amount_low, { compact: true })}`
  return '—'
}

function totalPotential(grants: GrantsFullRow[]): number {
  return grants.reduce((sum, g) => sum + (g.amount_high ?? g.amount_low ?? 0), 0)
}

function applyFilters(
  grants: GrantsFullRow[],
  search:       string,
  status:       PipelineStatus | 'all',
  eligs:        string[],
  dlFrom:       string,
  dlTo:         string,
  scoreMin:     number | null,
  scoreMax:     number | null,
): GrantsFullRow[] {
  return grants.filter(g => {
    if (status !== 'all' && g.pipeline_status !== status) return false

    if (search) {
      const q = search.toLowerCase()
      const hit =
        g.name.toLowerCase().includes(q) ||
        (g.funder ?? '').toLowerCase().includes(q) ||
        (g.category ?? '').toLowerCase().includes(q) ||
        (g.eligibility_types ?? []).some(e => e.toLowerCase().includes(q))
      if (!hit) return false
    }

    if (eligs.length > 0) {
      const overlap = (g.eligibility_types ?? []).some(e => eligs.includes(e))
      if (!overlap) return false
    }

    if (dlFrom && g.deadline) {
      if (new Date(g.deadline) < new Date(dlFrom)) return false
    }
    if (dlTo && g.deadline) {
      if (new Date(g.deadline) > new Date(dlTo)) return false
    }

    if (scoreMin !== null) {
      if ((g.fit_score ?? -1) < scoreMin) return false
    }
    if (scoreMax !== null) {
      if ((g.fit_score ?? 101) > scoreMax) return false
    }

    return true
  })
}

function sortGrants(grants: GrantsFullRow[], key: SortKey): GrantsFullRow[] {
  return [...grants].sort((a, b) => {
    switch (key) {
      case 'fit_score':
        return (b.fit_score ?? -1) - (a.fit_score ?? -1)
      case 'deadline':
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      case 'amount_high':
        return (b.amount_high ?? b.amount_low ?? 0) - (a.amount_high ?? a.amount_low ?? 0)
      case 'name':
        return a.name.localeCompare(b.name)
    }
  })
}

/* ── MultiSelect ────────────────────────────────────────────── */

function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'All types',
}: {
  options:     string[]
  value:       string[]
  onChange:    (v: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  const active = value.length > 0

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium
          whitespace-nowrap transition-colors ${
          active
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
        }`}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 6A.75.75 0 0 1 4.5 5.25h15a.75.75 0 0 1 0 1.5h-15A.75.75 0 0 1 3.75 6ZM7.5 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7.5 12Zm3.75 5.25a.75.75 0 0 1 .75-.75h.75a.75.75 0 0 1 0 1.5h-.75a.75.75 0 0 1-.75-.75Z" />
        </svg>
        {active ? `${value.length} type${value.length > 1 ? 's' : ''}` : placeholder}
        <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" clipRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-slate-200
          rounded-xl shadow-lg min-w-[200px] py-1.5 max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No eligibility types loaded yet</p>
          ) : (
            <>
              {value.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-xs text-left text-amber-600 hover:bg-amber-50 font-medium"
                >
                  Clear selection
                </button>
              )}
              {options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-slate-700
                    hover:bg-slate-50 text-left"
                >
                  <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center
                    ${value.includes(opt)
                      ? 'border-amber-500'
                      : 'border-slate-300'
                    }`}
                    style={value.includes(opt) ? { backgroundColor: 'var(--gold)', borderColor: 'var(--gold)' } : undefined}
                  >
                    {value.includes(opt) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="truncate">{opt}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Active filter chips ─────────────────────────────────────── */

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300
      bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full hover:bg-amber-200 p-0.5 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </span>
  )
}

/* ── URL param helpers ───────────────────────────────────────── */

function parseScore(s: string | null): number | null {
  if (!s) return null
  const n = Number(s)
  return isNaN(n) ? null : Math.max(0, Math.min(100, n))
}

/* ── Main page content (needs useSearchParams → Suspense) ───── */

function GrantsPageContent() {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  // Derive all filter state from URL
  const search      = sp.get('q')         ?? ''
  const statusFilter = (sp.get('status') ?? 'all') as PipelineStatus | 'all'
  const sortKey     = (sp.get('sort')    ?? 'fit_score') as SortKey
  const eligFilter  = useMemo(
    () => sp.get('elig')?.split(',').filter(Boolean) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sp.get('elig')],
  )
  const deadlineFrom = sp.get('dl_from') ?? ''
  const deadlineTo   = sp.get('dl_to')   ?? ''
  const scoreMin     = parseScore(sp.get('score_min'))
  const scoreMax     = parseScore(sp.get('score_max'))

  const [showFilters,     setShowFilters]     = useState(false)
  const [showAddModal,    setShowAddModal]    = useState(false)
  const [showCsvModal,    setShowCsvModal]    = useState(false)
  const [recalculating,   setRecalculating]   = useState(false)

  const { grants, loading, error, updateStatus, refresh } = useGrants()

  const handleRecalculate = async () => {
    setRecalculating(true)
    const supabase = createClient()

    // 1. Resolve org
    const { data: member } = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()
    const orgId = member?.organization_id
    if (!orgId) {
      console.error('[recalculate] no organization_id found for current user')
      setRecalculating(false)
      return
    }

    // 2. Fetch org profile
    const { data: profile, error: profileErr } = await supabase
      .from('organization_profiles')
      .select('*')
      .eq('organization_id', orgId)
      .single()
    console.log('[recalculate] org profile:', profile, profileErr?.message ?? 'ok')
    if (!profile) {
      toast('Complete your organization profile first', 'error')
      setRecalculating(false)
      return
    }

    // 3. Fetch all grants + descriptions in parallel
    const [{ data: grants, error: grantsErr }, { data: descs }] = await Promise.all([
      supabase.from('grants_full').select('*'),
      supabase.from('grants').select('id, description'),
    ])
    console.log('[recalculate] fetched', grants?.length ?? 0, 'grants', grantsErr?.message ?? 'ok')
    if (!grants?.length) {
      toast('No grants found to score', 'error')
      setRecalculating(false)
      return
    }

    const descMap = new Map((descs ?? []).map((d: { id: string; description: string | null }) => [d.id, d.description]))

    // 4. Score each grant and upsert into grant_matches
    let scored = 0
    for (const g of grants as GrantsFullRow[]) {
      const grantForScoring = {
        id:               g.id,
        name:             g.name,
        category:         g.category,
        funder:           g.funder,
        description:      (descMap.get(g.id) ?? null) as string | null,
        eligibility_types: g.eligibility_types,
        amount_high:      g.amount_high,
        amount_low:       g.amount_low,
        deadline:         g.deadline,
        effort_weeks:     g.effort_weeks,
      }

      const result = calculateFit(profile as Partial<OrganizationProfile>, grantForScoring)
      console.log(`[recalculate] "${g.name}" → ${result.score}%`, result.breakdown)

      const { error: updateErr } = await supabase
        .from('grant_matches')
        .update({
          fit_score:            result.score,
          eligibility_match:    result.breakdown.eligibility,
          mission_alignment:    result.breakdown.mission,
          budget_range_fit:     result.breakdown.budget,
          geographic_match:     result.breakdown.geographic,
          capacity_readiness:   result.breakdown.capacity,
          deadline_feasibility: result.breakdown.deadline,
          scored_at:            new Date().toISOString(),
        })
        .eq('grant_id', g.id)

      if (updateErr) {
        console.error(`[recalculate] update failed for "${g.name}":`, updateErr.message)
        continue
      }

      scored++
    }

    console.log('[recalculate] done —', scored, '/', grants.length, 'grants scored')
    toast(`Scored ${scored} grant${scored !== 1 ? 's' : ''}`, 'success')
    refresh()
    setRecalculating(false)
  }

  // Collect unique eligibility types from all loaded grants
  const allEligTypes = useMemo(() => {
    const set = new Set<string>()
    for (const g of grants) {
      for (const t of (g.eligibility_types ?? [])) set.add(t)
    }
    return [...set].sort()
  }, [grants])

  // Filtered + sorted grants
  const filtered = useMemo(
    () => sortGrants(
      applyFilters(grants, search, statusFilter, eligFilter, deadlineFrom, deadlineTo, scoreMin, scoreMax),
      sortKey,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grants, search, statusFilter, sp.get('elig'), deadlineFrom, deadlineTo, scoreMin, scoreMax, sortKey],
  )

  const potential = useMemo(() => totalPotential(filtered), [filtered])

  // Count advanced active filters (not search/status/sort)
  const advancedCount =
    eligFilter.length +
    (deadlineFrom ? 1 : 0) +
    (deadlineTo   ? 1 : 0) +
    (scoreMin !== null ? 1 : 0) +
    (scoreMax !== null ? 1 : 0)

  const hasAnyFilter =
    !!search || statusFilter !== 'all' || advancedCount > 0

  // Auto-show filter panel if any advanced filter is active
  const showFilterPanel = showFilters || advancedCount > 0

  /* Update a single URL param */
  const setParam = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(sp.toString())
    if (!value) params.delete(key)
    else         params.set(key, value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [sp, pathname, router])

  /* Clear all filters */
  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [pathname, router])

  const subtitle = loading
    ? 'Loading grants…'
    : `${filtered.length} grant${filtered.length !== 1 ? 's' : ''} · ${formatCurrency(potential, { compact: true })} potential`

  return (
    <>
      <AddGrantModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={refresh}
      />

      {showCsvModal && (
        <GrantCsvModal
          onClose={() => setShowCsvModal(false)}
          onSuccess={refresh}
        />
      )}

      <PageHeader
        title="Grant Discovery"
        subtitle={subtitle}
        secondaryAction={{
          label:    recalculating ? 'Scoring…' : '↻ Recalculate Scores',
          onClick:  handleRecalculate,
          disabled: recalculating,
          secondary: true,
        }}
        action={{ label: '+ New grant', onClick: () => setShowAddModal(true) }}
      />

      {/* Import / Export CSV bar */}
      <div className="flex items-center justify-end gap-2 px-6 py-2 border-b border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={() => exportGrantsToCsv(filtered)}
          disabled={filtered.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white
            px-3 py-1.5 text-xs font-medium text-slate-600
            hover:border-slate-400 hover:text-slate-900
            disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
        <button
          type="button"
          onClick={() => setShowCsvModal(true)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white
            px-3 py-1.5 text-xs font-medium text-slate-600
            hover:border-slate-400 hover:text-slate-900 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          Import CSV
        </button>
      </div>

      {/* ── Primary filter bar ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3.5 border-b border-slate-200 bg-white">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input
            type="search"
            placeholder="Search name, funder, category…"
            value={search}
            onChange={e => setParam('q', e.target.value || null)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white
              text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2
              focus:border-transparent"
            style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => setParam('status', e.target.value === 'all' ? null : e.target.value)}
          className="py-2 pl-3 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700
            focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
        >
          <option value="all">All statuses</option>
          {PIPELINE_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortKey}
          onChange={e => setParam('sort', e.target.value === 'fit_score' ? null : e.target.value)}
          className="py-2 pl-3 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700
            focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>Sort: {o.label}</option>
          ))}
        </select>

        {/* Filters toggle */}
        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium
            transition-colors ${
            advancedCount > 0
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : showFilters
              ? 'border-slate-400 bg-slate-100 text-slate-700'
              : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
          </svg>
          Filters
          {advancedCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full
              text-[10px] font-bold text-white"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {advancedCount}
            </span>
          )}
        </button>

        {/* Clear all */}
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Advanced filter panel ───────────────────────────── */}
      {showFilterPanel && (
        <div className="flex flex-wrap items-end gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/70">

          {/* Eligibility multi-select */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Eligibility type
            </label>
            <MultiSelect
              options={allEligTypes}
              value={eligFilter}
              onChange={vals => setParam('elig', vals.length > 0 ? vals.join(',') : null)}
            />
          </div>

          {/* Deadline range */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Deadline
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={deadlineFrom}
                onChange={e => setParam('dl_from', e.target.value || null)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700
                  focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
                title="Deadline from"
              />
              <span className="text-slate-400 text-sm">—</span>
              <input
                type="date"
                value={deadlineTo}
                min={deadlineFrom || undefined}
                onChange={e => setParam('dl_to', e.target.value || null)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700
                  focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
                title="Deadline to"
              />
            </div>
          </div>

          {/* Fit score range */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              Fit score
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Min"
                value={scoreMin ?? ''}
                onChange={e => setParam('score_min', e.target.value || null)}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm
                  text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              />
              <span className="text-slate-400 text-sm">—</span>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Max"
                value={scoreMax ?? ''}
                onChange={e => setParam('score_max', e.target.value || null)}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm
                  text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent"
                style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              />
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Active filter chips ─────────────────────────────── */}
      {advancedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-6 py-2.5 bg-white border-b border-slate-100">
          {eligFilter.map(e => (
            <FilterChip
              key={e}
              label={e}
              onRemove={() => {
                const next = eligFilter.filter(x => x !== e)
                setParam('elig', next.length > 0 ? next.join(',') : null)
              }}
            />
          ))}
          {deadlineFrom && (
            <FilterChip
              label={`From ${deadlineFrom}`}
              onRemove={() => setParam('dl_from', null)}
            />
          )}
          {deadlineTo && (
            <FilterChip
              label={`To ${deadlineTo}`}
              onRemove={() => setParam('dl_to', null)}
            />
          )}
          {scoreMin !== null && (
            <FilterChip
              label={`Score ≥ ${scoreMin}`}
              onRemove={() => setParam('score_min', null)}
            />
          )}
          {scoreMax !== null && (
            <FilterChip
              label={`Score ≤ ${scoreMax}`}
              onRemove={() => setParam('score_max', null)}
            />
          )}
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {loading     ? <LoadingSkeleton /> :
         error       ? <ErrorState message={error} onRetry={refresh} /> :
         filtered.length === 0
           ? <EmptyState hasFilters={hasAnyFilter} onAdd={() => setShowAddModal(true)} />
           : <GrantsTable grants={filtered} onStatusChange={updateStatus} />}
      </div>
    </>
  )
}

/* ── Page export (Suspense required for useSearchParams) ─────── */

export default function GrantsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <GrantsPageContent />
    </Suspense>
  )
}

/* ── Table ──────────────────────────────────────────────────── */

function GrantsTable({
  grants,
  onStatusChange,
}: {
  grants: GrantsFullRow[]
  onStatusChange: (id: string, status: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            {['Grant', 'Amount', 'Deadline', 'Eligibility', 'Effort', 'Fit', 'Status', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide
                text-slate-500 whitespace-nowrap bg-slate-50">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {grants.map(g => (
            <GrantRow key={g.id} grant={g} onStatusChange={onStatusChange} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GrantRow({
  grant: g,
  onStatusChange,
}: {
  grant: GrantsFullRow
  onStatusChange: (id: string, status: string) => void
}) {
  const days = daysUntil(g.deadline)
  const isUrgent = days !== null && days <= 14 && days >= 0

  return (
    <tr className={`group hover:bg-slate-50/80 transition-colors ${isUrgent ? 'bg-red-50/30' : ''}`}>

      {/* Grant name + funder */}
      <td className="px-4 py-3 max-w-[260px]">
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <p className="font-medium text-slate-900 leading-snug line-clamp-1">{g.name}</p>
            {g.funder && (
              <p className="text-xs text-slate-400 truncate mt-0.5">{g.funder}</p>
            )}
          </div>
          {g.is_renewal && (
            <span className="shrink-0 mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold
              bg-amber-500/10 text-amber-600 border border-amber-500/20">
              Renewal
            </span>
          )}
        </div>
      </td>

      {/* Amount */}
      <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-700">
        {formatAmountRange(g)}
      </td>

      {/* Deadline */}
      <td className="px-4 py-3 whitespace-nowrap">
        <DeadlineBadge date={g.deadline} />
      </td>

      {/* Eligibility tags */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {(g.eligibility_types ?? []).slice(0, 3).map(tag => (
            <span
              key={tag}
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tagPalette(tag)}`}
            >
              {tag}
            </span>
          ))}
          {(g.eligibility_types?.length ?? 0) > 3 && (
            <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium
              bg-slate-100 text-slate-500 border-slate-200">
              +{(g.eligibility_types?.length ?? 0) - 3}
            </span>
          )}
          {!g.eligibility_types?.length && (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </div>
      </td>

      {/* Effort */}
      <td className="px-4 py-3 whitespace-nowrap">
        {g.effort_weeks != null ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            {g.effort_weeks}w
          </span>
        ) : <span className="text-slate-400 text-xs">—</span>}
      </td>

      {/* Fit score */}
      <td className="px-4 py-3 whitespace-nowrap">
        <CompactFitBadge score={g.fit_score} />
      </td>

      {/* Status inline dropdown */}
      <td className="px-4 py-3 whitespace-nowrap">
        <select
          value={g.pipeline_status}
          onChange={e => onStatusChange(g.id, e.target.value)}
          className="text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-700
            focus:outline-none focus:ring-1 focus:border-transparent cursor-pointer"
          style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
        >
          {PIPELINE_STATUSES.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </td>

      {/* View link */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={`/grants/${g.id}`}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600
            hover:border-slate-400 hover:text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          View
        </Link>
      </td>
    </tr>
  )
}

/* ── Compact fit badge ──────────────────────────────────────── */

function CompactFitBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-slate-400 text-xs">—</span>
  const cls =
    score >= 90 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
    score >= 80 ? 'bg-amber-500/10   text-amber-600   border-amber-500/20'   :
    score >= 70 ? 'bg-orange-500/10  text-orange-600  border-orange-500/20'  :
                  'bg-slate-100      text-slate-500    border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score}%
    </span>
  )
}

/* ── Empty / loading / error states ────────────────────────── */

function EmptyState({ hasFilters, onAdd }: { hasFilters: boolean; onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5
              a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625
              c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75
              c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-700">
        {hasFilters ? 'No grants match your filters' : 'Add your first grant opportunity'}
      </p>
      <p className="mt-1 text-sm text-slate-400 max-w-xs">
        {hasFilters
          ? 'Try adjusting your search or filters.'
          : 'Track deadlines, measure fit, and manage applications in one place.'}
      </p>
      {!hasFilters && onAdd && (
        <button
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--gold)' }}
        >
          + Add grant
        </button>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {['Grant', 'Amount', 'Deadline', 'Eligibility', 'Effort', 'Fit', 'Status', ''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="bg-white">
              <td className="px-4 py-3">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-40 mb-1.5" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-28" />
              </td>
              {Array.from({ length: 5 }).map((_, j) => (
                <td key={j} className="px-4 py-3">
                  <div className="h-5 bg-slate-100 rounded-full animate-pulse w-16" />
                </td>
              ))}
              <td className="px-4 py-3">
                <div className="h-7 bg-slate-100 rounded-lg animate-pulse w-28" />
              </td>
              <td className="px-4 py-3">
                <div className="h-7 bg-slate-100 rounded-lg animate-pulse w-12" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 m-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" clipRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5
            A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="ml-auto shrink-0 rounded-md px-3 py-1 text-xs font-semibold
            bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}
