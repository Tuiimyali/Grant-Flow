'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDeadlineAlerts } from '@/lib/contexts/deadline-alerts-context'

const KEY_OVERDUE = 'grant-banner-dismissed-overdue'
const KEY_URGENT  = 'grant-banner-dismissed-urgent'

export default function DashboardDeadlineBanners() {
  const { overdueAlerts, urgentAlerts, prefs, loading } = useDeadlineAlerts()
  const [overdrueDismissed, setOverdueDismissed] = useState(true) // start hidden to avoid flash
  const [urgentDismissed,   setUrgentDismissed]  = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setOverdueDismissed(!!sessionStorage.getItem(KEY_OVERDUE))
      setUrgentDismissed( !!sessionStorage.getItem(KEY_URGENT))
    } catch {
      setOverdueDismissed(false)
      setUrgentDismissed(false)
    }
  }, [])

  function dismissOverdue() {
    setOverdueDismissed(true)
    try { sessionStorage.setItem(KEY_OVERDUE, '1') } catch { /* ignore */ }
  }
  function dismissUrgent() {
    setUrgentDismissed(true)
    try { sessionStorage.setItem(KEY_URGENT, '1') } catch { /* ignore */ }
  }

  if (!mounted || loading || !prefs.alertsEnabled) return null

  const showOverdue = overdueAlerts.length > 0 && !overdrueDismissed
  const showUrgent  = urgentAlerts.length  > 0 && !urgentDismissed

  if (!showOverdue && !showUrgent) return null

  return (
    <div className="px-6 pt-5 space-y-2">
      {showOverdue && (
        <Banner
          color="red"
          icon={
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
          }
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
          color="orange"
          icon={
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
            </svg>
          }
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

const COLOR_MAP = {
  red: {
    wrap:    'border-red-200 bg-red-50',
    icon:    'text-red-500',
    text:    'text-red-800',
    link:    'text-red-700',
    dismiss: 'text-red-400 hover:text-red-600',
  },
  orange: {
    wrap:    'border-orange-200 bg-orange-50',
    icon:    'text-orange-500',
    text:    'text-orange-800',
    link:    'text-orange-700',
    dismiss: 'text-orange-400 hover:text-orange-600',
  },
}

function Banner({
  color, icon, message, linkHref, linkLabel, onDismiss,
}: {
  color: 'red' | 'orange'
  icon: React.ReactNode
  message: string
  linkHref: string
  linkLabel: string
  onDismiss: () => void
}) {
  const c = COLOR_MAP[color]
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${c.wrap}`}>
      <span className={c.icon}>{icon}</span>
      <p className={`flex-1 text-sm font-medium ${c.text}`}>{message}</p>
      <Link href={linkHref} className={`text-xs font-semibold underline shrink-0 ${c.link}`}>
        {linkLabel}
      </Link>
      <button onClick={onDismiss} className={`shrink-0 transition-colors ${c.dismiss}`} aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
