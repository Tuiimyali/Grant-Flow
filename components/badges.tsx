import { daysUntil, formatDeadline } from '@/lib/utils/formatting'
import { fitBand, FIT_COLORS, type FitBand } from '@/lib/utils/scoring'

/* ── FitBadge ───────────────────────────────────────────────── */
const FIT_LABEL: Record<FitBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  moderate: 'Moderate',
  low: 'Low',
  unknown: 'No score',
}

export function FitBadge({ score }: { score: number | null | undefined }) {
  const band = fitBand(score)
  const colors = FIT_COLORS[band]

  if (score == null) {
    return (
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
        —
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${colors.text}`}>
      <span className="tabular-nums font-semibold">{score}%</span>
      <span className="opacity-50">{FIT_LABEL[band]}</span>
    </span>
  )
}

/* ── StatusBadge ────────────────────────────────────────────── */
type GrantStatus =
  | 'researching'
  | 'drafting'
  | 'submitted'
  | 'awarded'
  | 'declined'
  | 'withdrawn'
  | 'expired'
  | (string & {})

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  researching: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    label: 'Researching',
  },
  drafting: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    label: 'Drafting',
  },
  submitted: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'Submitted',
  },
  awarded: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'Awarded',
  },
  declined: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    label: 'Declined',
  },
  withdrawn: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/15',
    label: 'Withdrawn',
  },
  expired: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/15',
    label: 'Expired',
  },
}

const FALLBACK_STATUS = {
  bg: 'bg-slate-500/10',
  text: 'text-slate-400',
  border: 'border-slate-500/15',
}

export function StatusBadge({ status }: { status: GrantStatus }) {
  const s = STATUS_STYLES[status] ?? { ...FALLBACK_STATUS, label: status }
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${s.bg} ${s.text} ${s.border}`}
    >
      {s.label}
    </span>
  )
}

/* ── DeadlineBadge ──────────────────────────────────────────── */
function deadlineColor(days: number | null): string {
  if (days === null) return 'var(--text-dim)'
  if (days < 0) return 'var(--danger)'
  if (days <= 7) return 'var(--danger)'
  if (days <= 14) return 'var(--warning)'
  if (days <= 30) return 'var(--info)'
  return 'var(--text-dim)'
}

export function DeadlineBadge({ date }: { date: string | null | undefined }) {
  const days = daysUntil(date)
  const label = formatDeadline(date)
  const color = deadlineColor(days)
  const imminent = days !== null && days <= 7 && days >= 0

  return (
    <span
      className="inline-flex items-center gap-1 text-xs tabular-nums"
      style={{ color }}
    >
      {imminent && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {label}
    </span>
  )
}
