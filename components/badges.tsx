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

type StatusStyle = { bg: string; color: string; label: string }

const STATUS_STYLES: Record<string, StatusStyle> = {
  discovered:  { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', label: 'Discovered' },
  researching: { bg: 'rgba(74,122,170,0.1)',   color: 'var(--info)',           label: 'Researching' },
  writing:     { bg: 'rgba(130,100,200,0.1)',  color: '#8a64c8',               label: 'Writing' },
  drafting:    { bg: 'rgba(130,100,200,0.1)',  color: '#8a64c8',               label: 'Drafting' },
  submitted:   { bg: 'var(--gold-bg)',         color: 'var(--gold)',           label: 'Submitted' },
  awarded:     { bg: 'var(--success-bg)',      color: 'var(--success)',        label: 'Awarded' },
  declined:    { bg: 'var(--danger-bg)',       color: 'var(--danger)',         label: 'Declined' },
  withdrawn:   { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)',       label: 'Withdrawn' },
  expired:     { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-dim)',       label: 'Expired' },
}

const FALLBACK_STATUS: StatusStyle = {
  bg: 'rgba(255,255,255,0.04)',
  color: 'var(--text-dim)',
  label: '',
}

export function StatusBadge({ status }: { status: GrantStatus }) {
  const s = STATUS_STYLES[status] ?? { ...FALLBACK_STATUS, label: status }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '4px',
        padding: '2px 7px',
        fontSize: '11px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        background: s.bg,
        color: s.color,
      }}
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
