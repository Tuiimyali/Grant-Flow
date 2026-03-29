'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDeadlineAlerts } from '@/lib/contexts/deadline-alerts-context'

const KEY_OVERDUE = 'grant-banner-dismissed-overdue'
const KEY_URGENT = 'grant-banner-dismissed-urgent'

export default function DashboardDeadlineBanners() {
  const { overdueAlerts, urgentAlerts, prefs, loading } = useDeadlineAlerts()
  const [overdrueDismissed, setOverdueDismissed] = useState(true)
  const [urgentDismissed, setUrgentDismissed] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setOverdueDismissed(!!sessionStorage.getItem(KEY_OVERDUE))
      setUrgentDismissed(!!sessionStorage.getItem(KEY_URGENT))
    } catch {
      setOverdueDismissed(false)
      setUrgentDismissed(false)
    }
  }, [])

  function dismissOverdue() {
    setOverdueDismissed(true)
    try {
      sessionStorage.setItem(KEY_OVERDUE, '1')
    } catch {
      /* ignore */
    }
  }
  function dismissUrgent() {
    setUrgentDismissed(true)
    try {
      sessionStorage.setItem(KEY_URGENT, '1')
    } catch {
      /* ignore */
    }
  }

  if (!mounted || loading || !prefs.alertsEnabled) return null

  const showOverdue = overdueAlerts.length > 0 && !overdrueDismissed
  const showUrgent = urgentAlerts.length > 0 && !urgentDismissed

  if (!showOverdue && !showUrgent) return null

  return (
    <div className="px-6 pt-5 space-y-2">
      {showOverdue && (
        <Banner
          variant="danger"
          message={
            overdueAlerts.length === 1
              ? 'You have 1 grant past its deadline.'
              : `You have ${overdueAlerts.length} grants past their deadline.`
          }
          linkHref="/grants"
          linkLabel="View grants"
          onDismiss={dismissOverdue}
        />
      )}

      {showUrgent && (
        <Banner
          variant="warning"
          message={
            urgentAlerts.length === 1
              ? '1 grant is due this week.'
              : `${urgentAlerts.length} grants are due this week.`
          }
          linkHref="/grants"
          linkLabel="View grants"
          onDismiss={dismissUrgent}
        />
      )}
    </div>
  )
}

/* ── Banner primitive ───────────────────────────────────────── */

function Banner({
  variant,
  message,
  linkHref,
  linkLabel,
  onDismiss,
}: {
  variant: 'danger' | 'warning'
  message: string
  linkHref: string
  linkLabel: string
  onDismiss: () => void
}) {
  const bg = variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)'
  const color = variant === 'danger' ? 'var(--danger)' : 'var(--warning)'

  return (
    <div
      className="flex items-center gap-3 rounded-[8px] px-4 py-2.5"
      style={{ backgroundColor: bg, borderLeft: `2px solid ${color}` }}
    >
      <p className="flex-1 text-[13px]" style={{ color }}>
        {message}
      </p>
      <Link
        href={linkHref}
        className="text-xs shrink-0 transition-opacity hover:opacity-70"
        style={{ color }}
      >
        {linkLabel}
      </Link>
      <button
        onClick={onDismiss}
        className="shrink-0 transition-opacity hover:opacity-60"
        style={{ color: 'var(--text-dim)' }}
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
