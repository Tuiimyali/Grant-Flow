/* ── Currency ───────────────────────────────────────────────── */

export function formatCurrency(
  amount: number | null | undefined,
  opts: { compact?: boolean; decimals?: boolean } = {},
): string {
  if (amount == null) return '—'

  if (opts.compact) {
    if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
    if (amount >= 1_000)     return `$${(amount / 1_000).toFixed(0)}K`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(amount)
}

/* ── Dates ──────────────────────────────────────────────────── */

/** Number of whole days between now and a future date (negative = past). */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const ms = new Date(date).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

/**
 * Human-readable deadline label.
 * ≤0   → "Overdue"
 * 1    → "Tomorrow"
 * ≤14  → "X days"
 * else → "MMM D, YYYY"
 */
export function formatDeadline(date: string | null | undefined): string {
  if (!date) return 'No deadline'
  const days = daysUntil(date)!
  if (days < 0)  return 'Overdue'
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 14) return `${days} days`
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Date range formatted as "Jan 1 – Mar 31, 2026"
 * Omits year on start if both dates share the same year.
 */
export function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sameYear = s.getFullYear() === e.getFullYear()

  const startStr = s.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endStr = e.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startStr} – ${endStr}`
}

/** Short date: "Mar 15, 2026" */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
