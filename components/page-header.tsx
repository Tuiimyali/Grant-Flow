'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDeadlineAlerts } from '@/lib/contexts/deadline-alerts-context'

/* ── Types ──────────────────────────────────────────────────── */
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

/* ── Action button ──────────────────────────────────────────── */
function ActionButton({ action }: { action: ActionProps }) {
  const base = 'btn-scale inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  const secondaryStyle = {
    backgroundColor: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  }
  const primaryStyle = {
    backgroundColor: 'var(--gold)',
    color: '#0C0C0E',
  }

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={base}
        style={action.secondary ? secondaryStyle : primaryStyle}
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
      className={base}
      style={action.secondary ? secondaryStyle : primaryStyle}
    >
      {action.label}
    </button>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  discovered: 'Discovered', researching: 'Researching', writing: 'Writing',
  submitted: 'Submitted', awarded: 'Awarded', declined: 'Declined',
}

function daysLabel(days: number): string {
  if (days < 0)   return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

function daysColor(days: number): string {
  if (days < 0)  return 'var(--danger)'
  if (days <= 7) return 'var(--danger)'
  return 'var(--warning)'
}

/* ── Notification bell ──────────────────────────────────────── */
function NotificationBell() {
  const { overdueAlerts, urgentAlerts, soonAlerts } = useDeadlineAlerts()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const upcoming = [...overdueAlerts, ...urgentAlerts, ...soonAlerts]
  const badgeCount = upcoming.length

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
        className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Deadline notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-[17px] h-[17px]">
          <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
        </svg>
        {badgeCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4
              rounded-full text-[9px] font-bold leading-none px-0.5"
            style={{
              backgroundColor: 'var(--danger)',
              color: '#fff',
              boxShadow: '0 0 0 2px var(--bg)',
            }}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 rounded-xl z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Upcoming Deadlines
            </span>
            <Link
              href="/grants"
              onClick={() => setOpen(false)}
              className="text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: 'var(--gold)' }}
            >
              View all →
            </Link>
          </div>

          {/* List */}
          {upcoming.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-dim)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No upcoming deadlines</p>
            </div>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {upcoming.map(grant => (
                <li key={grant.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    onClick={() => { router.push('/grants'); setOpen(false) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                  >
                    <span
                      className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: daysColor(grant.days) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {grant.name}
                      </p>
                      {grant.funder && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{grant.funder}</p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-semibold" style={{ color: daysColor(grant.days) }}>
                          {daysLabel(grant.days)}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{grant.deadline}</span>
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>·</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
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
      className="flex items-center justify-between px-8 py-5"
      style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div>
        <h1
          className="font-semibold tracking-tight leading-tight"
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: '24px',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {secondaryAction && <ActionButton action={{ ...secondaryAction, secondary: true }} />}
        {action && <ActionButton action={action} />}
        <NotificationBell />
      </div>
    </header>
  )
}
