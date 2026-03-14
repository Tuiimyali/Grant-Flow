'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import PageHeader from '@/components/page-header'
import { DeadlineBadge } from '@/components/badges'
import { useGrants } from '@/lib/hooks/use-grants'
import { formatCurrency } from '@/lib/utils/formatting'
import { fitBand, FIT_COLORS } from '@/lib/utils/scoring'
import type { GrantsFullRow, PipelineStatus } from '@/lib/types/database.types'

/* ── Column definitions ─────────────────────────────────────── */

type ColumnDef = {
  status: PipelineStatus
  label: string
  accent: string        // Tailwind colour for header dot + ring
  headerBg: string
  countBg: string
}

const COLUMNS: ColumnDef[] = [
  {
    status:    'discovered',
    label:     'Discovered',
    accent:    'bg-slate-400',
    headerBg:  'bg-slate-50 border-slate-200',
    countBg:   'bg-slate-200 text-slate-600',
  },
  {
    status:    'researching',
    label:     'Researching',
    accent:    'bg-sky-400',
    headerBg:  'bg-sky-50 border-sky-200',
    countBg:   'bg-sky-100 text-sky-700',
  },
  {
    status:    'writing',
    label:     'Writing',
    accent:    'bg-violet-400',
    headerBg:  'bg-violet-50 border-violet-200',
    countBg:   'bg-violet-100 text-violet-700',
  },
  {
    status:    'submitted',
    label:     'Submitted',
    accent:    'bg-amber-400',
    headerBg:  'bg-amber-50 border-amber-200',
    countBg:   'bg-amber-100 text-amber-700',
  },
  {
    status:    'awarded',
    label:     'Awarded',
    accent:    'bg-emerald-400',
    headerBg:  'bg-emerald-50 border-emerald-200',
    countBg:   'bg-emerald-100 text-emerald-700',
  },
  {
    status:    'declined',
    label:     'Declined',
    accent:    'bg-rose-400',
    headerBg:  'bg-rose-50 border-rose-200',
    countBg:   'bg-rose-100 text-rose-700',
  },
]

const STATUS_LABELS: Record<PipelineStatus, string> = {
  discovered:  'Discovered',
  researching: 'Researching',
  writing:     'Writing',
  submitted:   'Submitted',
  awarded:     'Awarded',
  declined:    'Declined',
}

const PIPELINE_STATUSES: PipelineStatus[] = [
  'discovered', 'researching', 'writing', 'submitted', 'awarded', 'declined',
]

/* ── Helpers ────────────────────────────────────────────────── */

function amountRange(g: GrantsFullRow): string {
  const { amount_low, amount_high } = g
  if (amount_low != null && amount_high != null)
    return `${formatCurrency(amount_low, { compact: true })} – ${formatCurrency(amount_high, { compact: true })}`
  if (amount_high != null) return `Up to ${formatCurrency(amount_high, { compact: true })}`
  if (amount_low != null) return `From ${formatCurrency(amount_low, { compact: true })}`
  return '—'
}

function colTotal(grants: GrantsFullRow[]): number {
  return grants.reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0)
}

/* ── Page ───────────────────────────────────────────────────── */

export default function PipelinePage() {
  const { grants, loading, error, updateStatus, refresh } = useGrants()

  const byStatus = useMemo(() => {
    const map = new Map<PipelineStatus, GrantsFullRow[]>()
    for (const col of COLUMNS) map.set(col.status, [])
    for (const g of grants) {
      const status = g.pipeline_status as PipelineStatus
      if (map.has(status)) map.get(status)!.push(g)
    }
    return map
  }, [grants])

  const totalActive = useMemo(() => {
    const active: PipelineStatus[] = ['discovered', 'researching', 'writing', 'submitted']
    return grants
      .filter(g => active.includes(g.pipeline_status as PipelineStatus))
      .reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0)
  }, [grants])

  const subtitle = loading
    ? 'Loading pipeline…'
    : `${grants.length} grant${grants.length !== 1 ? 's' : ''} · ${formatCurrency(totalActive, { compact: true })} active potential`

  return (
    <div className="flex flex-col h-full min-h-0">
      <PageHeader
        title="Pipeline"
        subtitle={subtitle}
        action={{ label: '+ Add grant', href: '/grants' }}
      />

      {error ? (
        <div className="flex items-center gap-3 m-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" clipRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
          <span className="flex-1">{error}</span>
          <button
            onClick={refresh}
            className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : !loading && grants.length === 0 ? (
        <PipelineEmpty />
      ) : (
        /* Board ─────────────────────────────────────────────── */
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full px-4 py-4 min-w-max">
            {COLUMNS.map(col => {
              const colGrants = byStatus.get(col.status) ?? []
              const total     = colTotal(colGrants)
              return (
                <KanbanColumn
                  key={col.status}
                  col={col}
                  grants={colGrants}
                  total={total}
                  loading={loading}
                  onMove={updateStatus}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Column ─────────────────────────────────────────────────── */

function KanbanColumn({
  col,
  grants,
  total,
  loading,
  onMove,
}: {
  col: ColumnDef
  grants: GrantsFullRow[]
  total: number
  loading: boolean
  onMove: (id: string, status: string) => void
}) {
  return (
    <div className="flex flex-col w-[248px] shrink-0 rounded-xl border bg-slate-50 border-slate-200 overflow-hidden">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${col.headerBg}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${col.accent}`} />
        <span className="flex-1 text-xs font-semibold text-slate-700 uppercase tracking-wide">
          {col.label}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${col.countBg}`}>
          {loading ? '—' : grants.length}
        </span>
      </div>

      {/* Column total */}
      <div className="px-3 py-1.5 border-b border-slate-100 bg-white/60">
        <span className="text-[11px] text-slate-400 font-medium">
          {loading ? '…' : total > 0 ? formatCurrency(total, { compact: true }) : 'No amounts'}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : grants.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-400">
            No grants
          </div>
        ) : (
          grants.map(g => (
            <GrantCard key={g.id} grant={g} currentStatus={col.status} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  )
}

/* ── Card ───────────────────────────────────────────────────── */

function GrantCard({
  grant: g,
  currentStatus,
  onMove,
}: {
  grant: GrantsFullRow
  currentStatus: PipelineStatus
  onMove: (id: string, status: string) => void
}) {
  const band   = fitBand(g.fit_score)
  const colors = FIT_COLORS[band]

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow space-y-2.5">

      {/* Name + funder */}
      <div>
        <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{g.name}</p>
        {g.funder && (
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{g.funder}</p>
        )}
      </div>

      {/* Amount */}
      <p className="text-xs font-medium text-slate-600">{amountRange(g)}</p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {/* Fit score */}
        {g.fit_score != null ? (
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${colors.bg} ${colors.text} ${colors.border}`}>
            {g.fit_score}%
          </span>
        ) : (
          <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] text-slate-400 bg-slate-50 border-slate-200">
            No score
          </span>
        )}

        {/* Deadline */}
        <DeadlineBadge date={g.deadline} />

        {/* Renewal pill */}
        {g.is_renewal && (
          <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 border-amber-500/20">
            Renewal
          </span>
        )}
      </div>

      {/* Move to dropdown */}
      <select
        value={currentStatus}
        onChange={e => onMove(g.id, e.target.value)}
        className="w-full text-xs rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600
          focus:outline-none focus:ring-1 focus:border-transparent cursor-pointer hover:border-slate-300 transition-colors"
        style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
      >
        {PIPELINE_STATUSES.map(s => (
          <option key={s} value={s} disabled={s === currentStatus}>
            {s === currentStatus ? `● ${STATUS_LABELS[s]}` : `→ ${STATUS_LABELS[s]}`}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── Skeleton card ──────────────────────────────────────────── */

function PipelineEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-700">Your pipeline is empty</p>
      <p className="mt-1 text-sm text-slate-400 max-w-xs leading-relaxed">
        Add grant opportunities from Grant Discovery and they&apos;ll appear here, organized by stage.
      </p>
      <Link
        href="/grants"
        className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--gold)' }}
      >
        Browse grants →
      </Link>
    </div>
  )
}

/* ── Skeleton card ──────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm space-y-2.5 animate-pulse">
      <div>
        <div className="h-3.5 bg-slate-200 rounded w-4/5 mb-1.5" />
        <div className="h-2.5 bg-slate-100 rounded w-3/5" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-2/5" />
      <div className="flex gap-1.5">
        <div className="h-5 bg-slate-100 rounded-full w-10" />
        <div className="h-5 bg-slate-100 rounded-full w-16" />
      </div>
      <div className="h-7 bg-slate-100 rounded-md w-full" />
    </div>
  )
}
