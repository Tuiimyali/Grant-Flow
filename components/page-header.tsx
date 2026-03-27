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
  const base =
    'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-opacity duration-150'

  const secondaryStyle: React.CSSProperties = {
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  }
  const primaryStyle: React.CSSProperties = {
    backgroundColor: 'var(--gold)',
    color: '#0C0C0E',
  }

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={`${base} btn-scale`}
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
      className={`${base} btn-scale`}
      style={action.secondary ? secondaryStyle : primaryStyle}
    >
      {action.label}
    </button>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */
function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d`
}

function urgencyColor(days: number): string {
  if (days <= 0) return 'var(--danger)'
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
  const count = upcoming.length

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
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor =
            'var(--surface-2)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
        }}
        aria-label="Deadline notifications"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z"
            clipRule="evenodd"
          />
        </svg>
        {/* Badge: dot for 1–4, number for 5+ */}
        {count > 0 &&
          (count >= 5 ? (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 rounded-full text-[9px] font-bold leading-none flex items-center justify-center px-1"
              style={{
                backgroundColor: 'var(--danger)',
                color: '#fff',
                boxShadow: '0 0 0 2px var(--bg)',
              }}
            >
              {count}
            </span>
          ) : (
            <span
              className="absolute top-0 right-0 w-[7px] h-[7px] rounded-full"
              style={{
                backgroundColor: 'var(--danger)',
                boxShadow: '0 0 0 1.5px var(--bg)',
              }}
            />
          ))}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl z-50 overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-dim)' }}
            >
              Deadlines
            </span>
            <Link
              href="/grants"
              onClick={() => setOpen(false)}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--gold)' }}
            >
              View all
            </Link>
          </div>

          {/* List */}
          {upcoming.length === 0 ? (
            <p
              className="px-4 py-6 text-xs text-center"
              style={{ color: 'var(--text-dim)' }}
            >
              No upcoming deadlines
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-y-auto">
              {upcoming.map((grant) => (
                <li key={grant.id}>
                  <button
                    onClick={() => {
                      router.push('/grants')
                      setOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150"
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor =
                        ''
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: urgencyColor(grant.days) }}
                    />
                    <p
                      className="text-[13px] truncate flex-1 text-left leading-snug"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {grant.name}
                    </p>
                    <span
                      className="text-xs font-medium shrink-0 tabular-nums"
                      style={{ color: urgencyColor(grant.days) }}
                    >
                      {daysLabel(grant.days)}
                    </span>
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
export default function PageHeader({
  title,
  subtitle,
  action,
  secondaryAction,
}: PageHeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 py-4"
      style={{
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div>
        <h1
          className="font-semibold leading-tight tracking-tight"
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: '20px',
            color: 'var(--text-primary)',
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-0.5 text-xs tracking-wide"
            style={{ color: 'var(--text-dim)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {secondaryAction && (
          <ActionButton action={{ ...secondaryAction, secondary: true }} />
        )}
        {action && <ActionButton action={action} />}
        <NotificationBell />
      </div>
    </header>
  )
}
