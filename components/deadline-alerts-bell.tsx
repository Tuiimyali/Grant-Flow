'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDeadlineAlerts, type Urgency } from '@/lib/contexts/deadline-alerts-context'

/* ── Config ─────────────────────────────────────────────────── */

const URGENCY_CFG: Record<Urgency, {
  color: string; dotColor: string; sectionLabel: string
}> = {
  overdue:     { color: 'var(--danger)',  dotColor: 'var(--danger)',  sectionLabel: 'Overdue' },
  urgent:      { color: 'var(--danger)',  dotColor: 'var(--danger)',  sectionLabel: 'Due This Week' },
  soon:        { color: 'var(--warning)', dotColor: 'var(--warning)', sectionLabel: 'Due Soon' },
  approaching: { color: 'var(--gold)',    dotColor: 'var(--gold)',    sectionLabel: 'Approaching' },
}

function daysLabel(days: number): string {
  if (days < 0)   return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  return `${days}d left`
}

/* ── Component ──────────────────────────────────────────────── */

export default function DeadlineAlertsBell({ collapsed }: { collapsed: boolean }) {
  const { overdueAlerts, urgentAlerts, soonAlerts, approachingAlerts, badgeCount, loading } =
    useDeadlineAlerts()

  const [open, setOpen]   = useState(false)
  const buttonRef         = useRef<HTMLButtonElement>(null)
  const dropdownRef       = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const groups = ([
    { urgency: 'overdue'     as Urgency, items: overdueAlerts },
    { urgency: 'urgent'      as Urgency, items: urgentAlerts },
    { urgency: 'soon'        as Urgency, items: soonAlerts },
    { urgency: 'approaching' as Urgency, items: approachingAlerts },
  ] as const).filter(g => g.items.length > 0)

  const totalAlerts = groups.reduce((s, g) => s + g.items.length, 0)

  function openDropdown() {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setDropPos({ top: r.top, left: r.right + 8 })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current   && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (loading || totalAlerts === 0) return null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        title="Deadline alerts"
        className={`
          w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150
          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
        `}
        style={{ color: 'var(--text-dim)' }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-item-hover)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
          ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
        }}
      >
        {/* Bell with badge */}
        <span className="relative shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
            <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
          </svg>
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 rounded-full text-white text-[9px] font-bold leading-none px-0.5"
              style={{ backgroundColor: 'var(--danger)' }}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex items-center gap-2 flex-1">
            Alerts
            {badgeCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 py-0.5 leading-none"
                style={{ backgroundColor: 'rgba(196,90,90,0.2)', color: 'var(--danger)' }}>
                {badgeCount}
              </span>
            )}
          </span>
        )}
      </button>

      {/* Fixed dropdown panel */}
      {open && (
        <div
          ref={dropdownRef}
          className="fixed z-[200] w-80 rounded-xl shadow-2xl overflow-hidden"
          style={{
            top: dropPos.top,
            left: dropPos.left,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Deadline Alerts
              <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-dim)' }}>
                {totalAlerts} grant{totalAlerts !== 1 ? 's' : ''}
              </span>
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

          {/* Groups */}
          <div className="max-h-[420px] overflow-y-auto">
            {groups.map(({ urgency, items }) => {
              const cfg = URGENCY_CFG[urgency]
              return (
                <div key={urgency}>
                  <div className="px-4 py-1.5" style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: cfg.color }}>
                      {cfg.sectionLabel}
                    </span>
                  </div>
                  {items.map(alert => (
                    <Link
                      key={alert.id}
                      href={`/grants/${alert.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition-colors"
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
                    >
                      <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cfg.dotColor }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate leading-snug" style={{ color: 'var(--text-primary)' }}>{alert.name}</p>
                        {alert.funder && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{alert.funder}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-semibold" style={{ color: cfg.color }}>{daysLabel(alert.days)}</span>
                          <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{alert.deadline}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
