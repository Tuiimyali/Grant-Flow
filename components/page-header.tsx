'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeadlineAlerts } from '@/lib/contexts/deadline-alerts-context'

/* ── Action button ──────────────────────────────────────────── */

interface ActionProps {
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  secondary?: boolean
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ActionProps
  secondaryAction?: ActionProps
}

function ActionButton({ action }: { action: ActionProps }) {
  const secondaryCls =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 ' +
    'text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const primaryCls =
    'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={action.secondary ? secondaryCls : primaryCls}
        style={action.secondary ? undefined : { backgroundColor: 'var(--gold)' }}
      >
        {action.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={action.secondary ? secondaryCls : primaryCls}
      style={action.secondary ? undefined : { backgroundColor: 'var(--gold)' }}
    >
      {action.label}
    </button>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */

const STATUS_LABELS: Record<string, string> = {
  discovered:  'Discovered',
  researching: 'Researching',
  writing:     'Writing',
  submitted:   'Submitted',
  awarded:     'Awarded',
  declined:    'Declined',
}

function daysLabel(days: number): string {
  if (days < 0)   return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

function daysColor(days: number): string {
  if (days < 0)  return 'text-red-600'
  if (days <= 7) return 'text-red-500'
  return 'text-orange-500'
}

/* ── Notification bell ──────────────────────────────────────── */

function NotificationBell() {
  const { overdueAlerts, urgentAlerts, soonAlerts } = useDeadlineAlerts()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Grants within 14 days (overdue + urgent + soon)
  const upcoming = [...overdueAlerts, ...urgentAlerts, ...soonAlerts]
  const badgeCount = upcoming.length

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200
          bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
        aria-label="Deadline notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
          <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
        </svg>
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4
            rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5 ring-2 ring-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-white shadow-2xl
          ring-1 ring-black/10 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">Upcoming Deadlines</span>
            <Link
              href="/grants"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-amber-600 hover:underline"
            >
              View all →
            </Link>
          </div>

          {/* List */}
          {upcoming.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="w-8 h-8 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <p className="text-sm text-slate-400">No upcoming deadlines</p>
            </div>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto divide-y divide-slate-50">
              {upcoming.map(grant => (
                <li key={grant.id}>
                  <button
                    onClick={() => { router.push('/grants'); setOpen(false) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    {/* Urgency dot */}
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      grant.days < 0  ? 'bg-red-500' :
                      grant.days <= 7 ? 'bg-red-400' : 'bg-orange-400'
                    }`} />

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate leading-snug">
                        {grant.name}
                      </p>
                      {grant.funder && (
                        <p className="text-xs text-slate-400 truncate">{grant.funder}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs font-semibold ${daysColor(grant.days)}`}>
                          {daysLabel(grant.days)}
                        </span>
                        <span className="text-xs text-slate-400">{grant.deadline}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">
                          {STATUS_LABELS[grant.pipeline_status] ?? grant.pipeline_status}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Page header ────────────────────────────────────────────── */

export default function PageHeader({ title, subtitle, action, secondaryAction }: PageHeaderProps) {
  return (
    <header
      style={{ borderColor: 'var(--surface-border)' }}
      className="flex items-center justify-between px-8 py-5 bg-white border-b"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {secondaryAction && <ActionButton action={secondaryAction} />}
        {action && <ActionButton action={action} />}
        <NotificationBell />
      </div>
    </header>
  )
}
