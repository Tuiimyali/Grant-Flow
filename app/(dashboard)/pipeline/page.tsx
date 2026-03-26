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
  dotColor: string
}

const COLUMNS: ColumnDef[] = [
  { status: 'discovered', label: 'Discovered', dotColor: '#5A5A60' },
  { status: 'researching', label: 'Researching', dotColor: '#38bdf8' },
  { status: 'writing', label: 'Writing', dotColor: '#a78bfa' },
  { status: 'submitted', label: 'Submitted', dotColor: '#C7A94E' },
  { status: 'awarded', label: 'Awarded', dotColor: '#4A9E6E' },
  { status: 'declined', label: 'Declined', dotColor: '#C45A5A' },
]

const STATUS_LABELS: Record<PipelineStatus, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  writing: 'Writing',
  submitted: 'Submitted',
  awarded: 'Awarded',
  declined: 'Declined',
}

const PIPELINE_STATUSES: PipelineStatus[] = [
  'discovered',
  'researching',
  'writing',
  'submitted',
  'awarded',
  'declined',
]

/* ── Helpers ────────────────────────────────────────────────── */

function amountRange(g: GrantsFullRow): string {
  const { amount_low, amount_high } = g
  if (amount_low != null && amount_high != null)
    return `${formatCurrency(amount_low, { compact: true })} – ${formatCurrency(amount_high, { compact: true })}`
  if (amount_high != null)
    return `Up to ${formatCurrency(amount_high, { compact: true })}`
  if (amount_low != null)
    return `From ${formatCurrency(amount_low, { compact: true })}`
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
    const active: PipelineStatus[] = [
      'discovered',
      'researching',
      'writing',
      'submitted',
    ]
    return grants
      .filter((g) => active.includes(g.pipeline_status as PipelineStatus))
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
        <div
          className="flex items-center gap-3 m-6 p-4 rounded-xl text-sm"
          style={{
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
          }}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            />
          </svg>
          <span className="flex-1">{error}</span>
          <button
            onClick={refresh}
            className="shrink-0 rounded-md px-3 py-1 text-xs font-semibold transition-opacity"
            style={{
              backgroundColor: 'var(--danger-border)',
              color: 'var(--danger)',
            }}
          >
            Retry
          </button>
        </div>
      ) : !loading && grants.length === 0 ? (
        <PipelineEmpty />
      ) : (
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-3 h-full px-4 py-4 min-w-max">
            {COLUMNS.map((col) => {
              const colGrants = byStatus.get(col.status) ?? []
              const total = colTotal(colGrants)
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
    <div
      className="flex flex-col w-[248px] shrink-0 rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: col.dotColor }}
        />
        <span
          className="flex-1 text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text-secondary)' }}
        >
          {col.label}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
          style={{
            backgroundColor: 'var(--surface-3)',
            color: 'var(--text-dim)',
          }}
        >
          {loading ? '—' : grants.length}
        </span>
      </div>

      {/* Column total */}
      <div
        className="px-3 py-1.5"
        style={{
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--surface-2)',
        }}
      >
        <span
          className="text-[11px] font-medium"
          style={{ color: 'var(--text-dim)' }}
        >
          {loading
            ? '…'
            : total > 0
              ? formatCurrency(total, { compact: true })
              : 'No amounts'}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : grants.length === 0 ? (
          <div
            className="flex items-center justify-center py-10 text-xs"
            style={{ color: 'var(--text-dim)' }}
          >
            No grants
          </div>
        ) : (
          grants.map((g) => (
            <GrantCard
              key={g.id}
              grant={g}
              currentStatus={col.status}
              onMove={onMove}
            />
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
  const band = fitBand(g.fit_score)
  const colors = FIT_COLORS[band]

  return (
    <div
      className="rounded-lg p-3 space-y-2.5 transition-all"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
      }}
    >
      {/* Name + funder */}
      <div>
        <p
          className="text-sm font-semibold leading-snug line-clamp-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {g.name}
        </p>
        {g.funder && (
          <p
            className="text-[11px] mt-0.5 truncate"
            style={{ color: 'var(--text-dim)' }}
          >
            {g.funder}
          </p>
        )}
      </div>

      {/* Amount */}
      <p
        className="text-xs font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {amountRange(g)}
      </p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 items-center">
        {g.fit_score != null ? (
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums ${colors.bg} ${colors.text} ${colors.border}`}
          >
            {g.fit_score}%
          </span>
        ) : (
          <span
            className="inline-flex rounded-full border px-2 py-0.5 text-[11px]"
            style={{
              backgroundColor: 'var(--surface-3)',
              color: 'var(--text-dim)',
              borderColor: 'var(--border)',
            }}
          >
            No score
          </span>
        )}

        <DeadlineBadge date={g.deadline} />

        {g.is_renewal && (
          <span className="inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-400 border-amber-500/20">
            Renewal
          </span>
        )}
      </div>

      {/* Move to dropdown */}
      <select
        value={currentStatus}
        onChange={(e) => onMove(g.id, e.target.value)}
        className="w-full text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:border-transparent cursor-pointer transition-colors"
        style={
          {
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            '--tw-ring-color': 'var(--gold)',
          } as React.CSSProperties
        }
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s} value={s} disabled={s === currentStatus}>
            {s === currentStatus
              ? `● ${STATUS_LABELS[s]}`
              : `→ ${STATUS_LABELS[s]}`}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ── Empty state ────────────────────────────────────────────── */

function PipelineEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-24 px-8 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <svg
          className="w-7 h-7"
          style={{ color: 'var(--text-dim)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
          />
        </svg>
      </div>
      <p
        className="text-base font-semibold"
        style={{ color: 'var(--text-secondary)' }}
      >
        Your pipeline is empty
      </p>
      <p
        className="mt-1 text-sm max-w-xs leading-relaxed"
        style={{ color: 'var(--text-dim)' }}
      >
        Add grant opportunities from Grant Discovery and they&apos;ll appear
        here, organized by stage.
      </p>
      <Link
        href="/grants"
        className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold btn-scale"
        style={{ backgroundColor: 'var(--gold)', color: '#0C0C0E' }}
      >
        Browse grants →
      </Link>
    </div>
  )
}

/* ── Skeleton card ──────────────────────────────────────────── */

function SkeletonCard() {
  return (
    <div
      className="rounded-lg p-3 space-y-2.5 animate-pulse"
      style={{
        backgroundColor: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      <div>
        <div
          className="h-3.5 rounded w-4/5 mb-1.5"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
        <div
          className="h-2.5 rounded w-3/5"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
      </div>
      <div
        className="h-3 rounded w-2/5"
        style={{ backgroundColor: 'var(--surface-3)' }}
      />
      <div className="flex gap-1.5">
        <div
          className="h-5 rounded-full w-10"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
        <div
          className="h-5 rounded-full w-16"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
      </div>
      <div
        className="h-7 rounded-md w-full"
        style={{ backgroundColor: 'var(--surface-3)' }}
      />
    </div>
  )
}
