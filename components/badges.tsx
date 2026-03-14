import { daysUntil, formatDeadline } from '@/lib/utils/formatting'
import { fitBand, FIT_COLORS, type FitBand } from '@/lib/utils/scoring'

/* ── Shared primitive ───────────────────────────────────────── */
function Badge({
  bg, text, border, children,
}: {
  bg: string; text: string; border: string; children: React.ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${bg} ${text} ${border}`}
    >
      {children}
    </span>
  )
}

/* ── FitBadge ───────────────────────────────────────────────── */

const FIT_LABEL: Record<FitBand, string> = {
  excellent: 'Excellent fit',
  good:      'Good fit',
  moderate:  'Moderate fit',
  low:       'Low fit',
  unknown:   'No score',
}

export function FitBadge({ score }: { score: number | null | undefined }) {
  const band   = fitBand(score)
  const colors = FIT_COLORS[band]
  const label  = score != null ? `${score}` : '—'

  return (
    <Badge bg={colors.bg} text={colors.text} border={colors.border}>
      <span className="tabular-nums font-semibold">{label}</span>
      <span className="opacity-70">{score != null ? `· ${FIT_LABEL[band]}` : FIT_LABEL[band]}</span>
    </Badge>
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
  | (string & {})   // allow arbitrary strings while keeping autocomplete

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  researching: { bg: 'bg-sky-500/10',     text: 'text-sky-500',     border: 'border-sky-500/30',     label: 'Researching' },
  drafting:    { bg: 'bg-violet-500/10',  text: 'text-violet-500',  border: 'border-violet-500/30',  label: 'Drafting' },
  submitted:   { bg: 'bg-amber-500/10',   text: 'text-amber-500',   border: 'border-amber-500/30',   label: 'Submitted' },
  awarded:     { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', label: 'Awarded' },
  declined:    { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',     label: 'Declined' },
  withdrawn:   { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   label: 'Withdrawn' },
  expired:     { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20',   label: 'Expired' },
}

const FALLBACK_STATUS = {
  bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20',
}

export function StatusBadge({ status }: { status: GrantStatus }) {
  const s = STATUS_STYLES[status] ?? { ...FALLBACK_STATUS, label: status }
  return (
    <Badge bg={s.bg} text={s.text} border={s.border}>
      {s.label}
    </Badge>
  )
}

/* ── DeadlineBadge ──────────────────────────────────────────── */

/**
 * Urgency tiers:
 *   overdue  → red with glow
 *   ≤7 days  → red
 *   ≤14 days → amber
 *   ≤30 days → sky
 *   >30 days → slate
 */
function deadlineStyles(days: number | null): { bg: string; text: string; border: string; glow?: string } {
  if (days === null)  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/20' }
  if (days < 0)       return { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/40',  glow: 'shadow-[0_0_8px_2px_rgba(239,68,68,0.25)]' }
  if (days <= 7)      return { bg: 'bg-red-500/10',   text: 'text-red-400',   border: 'border-red-500/40',  glow: 'shadow-[0_0_8px_2px_rgba(239,68,68,0.25)]' }
  if (days <= 14)     return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/40' }
  if (days <= 30)     return { bg: 'bg-sky-500/10',   text: 'text-sky-400',   border: 'border-sky-500/30' }
  return               { bg: 'bg-slate-500/10',  text: 'text-slate-400',  border: 'border-slate-500/20' }
}

export function DeadlineBadge({ date }: { date: string | null | undefined }) {
  const days   = daysUntil(date)
  const label  = formatDeadline(date)
  const styles = deadlineStyles(days)

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${styles.bg} ${styles.text} ${styles.border} ${styles.glow ?? ''}`}
    >
      {days !== null && days <= 14 && days >= 0 && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      )}
      {label}
    </span>
  )
}
