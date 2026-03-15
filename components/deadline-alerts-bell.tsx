'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useDeadlineAlerts, type Urgency } from '@/lib/contexts/deadline-alerts-context'

/* ── Config ─────────────────────────────────────────────────── */

const URGENCY_CFG: Record<Urgency, {
  textCls: string; dotCls: string; headerCls: string; sectionLabel: string
}> = {
  overdue:     { textCls: 'text-red-600',    dotCls: 'bg-red-500',    headerCls: 'text-red-500',    sectionLabel: 'Overdue' },
  urgent:      { textCls: 'text-red-600',    dotCls: 'bg-red-400',    headerCls: 'text-red-500',    sectionLabel: 'Due This Week' },
  soon:        { textCls: 'text-orange-600', dotCls: 'bg-orange-400', headerCls: 'text-orange-500', sectionLabel: 'Due Soon' },
  approaching: { textCls: 'text-yellow-700', dotCls: 'bg-yellow-400', headerCls: 'text-yellow-600', sectionLabel: 'Approaching' },
}

function daysLabel(days: number): string {
  if (days < 0)  return `${Math.abs(days)}d overdue`
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

  // Position dropdown to the right of the sidebar button using fixed coords
  function openDropdown() {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect()
      setDropPos({ top: r.top, left: r.right + 8 })
    }
    setOpen(true)
  }

  // Close on outside click
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

  // Don't render if alerts disabled or loading with nothing
  if (loading || totalAlerts === 0) return null

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => open ? setOpen(false) : openDropdown()}
        title="Deadline alerts"
        className={`
          w-full flex items-center gap-3 rounded-lg text-sm font-medium
          text-slate-400 hover:text-white transition-colors duration-150
          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
        `}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-item-hover)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '' }}
      >
        {/* Bell with badge */}
        <span className="relative shrink-0">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]">
            <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
          </svg>
          {badgeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          )}
        </span>
        {!collapsed && (
          <span className="flex items-center gap-2 flex-1">
            Alerts
            {badgeCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-semibold px-1.5 py-0.5 leading-none">
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
          className="fixed z-[200] w-80 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden"
          style={{ top: dropPos.top, left: dropPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-900">
              Deadline Alerts
              <span className="ml-2 text-xs font-normal text-slate-400">{totalAlerts} grant{totalAlerts !== 1 ? 's' : ''}</span>
            </span>
            <Link
              href="/grants"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-amber-600 hover:underline"
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
                  <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100">
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.headerCls}`}>
                      {cfg.sectionLabel}
                    </span>
                  </div>
                  {items.map(alert => (
                    <Link
                      key={alert.id}
                      href={`/grants/${alert.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dotCls}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 truncate leading-snug">{alert.name}</p>
                        {alert.funder && (
                          <p className="text-xs text-slate-400 truncate">{alert.funder}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-semibold ${cfg.textCls}`}>{daysLabel(alert.days)}</span>
                          <span className="text-xs text-slate-400">{alert.deadline}</span>
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
