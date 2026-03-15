'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ──────────────────────────────────────────────────── */

export type Urgency = 'overdue' | 'urgent' | 'soon' | 'approaching'

export interface AlertGrant {
  id: string
  name: string
  funder: string | null
  deadline: string
  pipeline_status: string
  days: number
  urgency: Urgency
}

export interface NotificationPrefs {
  alertsEnabled: boolean
  alertDaysThreshold: 7 | 14 | 30 | 60
}

const DEFAULT_PREFS: NotificationPrefs = {
  alertsEnabled: true,
  alertDaysThreshold: 14,
}

const PREFS_KEY = 'grant-notification-prefs'

interface ContextValue {
  alerts:           AlertGrant[]
  overdueAlerts:    AlertGrant[]
  urgentAlerts:     AlertGrant[]
  soonAlerts:       AlertGrant[]
  approachingAlerts:AlertGrant[]
  badgeCount:       number
  prefs:            NotificationPrefs
  updatePrefs:      (update: Partial<NotificationPrefs>) => void
  loading:          boolean
}

/* ── Helpers ────────────────────────────────────────────────── */

function daysUntil(iso: string): number {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d   = new Date(iso); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86_400_000)
}

function classify(days: number, threshold: number): Urgency | null {
  if (days < 0)          return 'overdue'
  if (days <= 7)         return 'urgent'
  if (days <= 14)        return 'soon'
  if (days <= threshold) return 'approaching'
  return null
}

/* ── Context ────────────────────────────────────────────────── */

const DeadlineAlertsContext = createContext<ContextValue>({
  alerts: [], overdueAlerts: [], urgentAlerts: [],
  soonAlerts: [], approachingAlerts: [],
  badgeCount: 0, prefs: DEFAULT_PREFS,
  updatePrefs: () => {}, loading: true,
})

export function DeadlineAlertsProvider({ children }: { children: React.ReactNode }) {
  const [all,     setAll]     = useState<AlertGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [prefs,   setPrefs]   = useState<NotificationPrefs>(DEFAULT_PREFS)

  // Load prefs from localStorage (client-only)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      if (raw) setPrefs(prev => ({ ...prev, ...(JSON.parse(raw) as Partial<NotificationPrefs>) }))
    } catch { /* ignore */ }
  }, [])

  // Fetch active grants whenever threshold changes
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data } = await supabase
        .from('grants_full')
        .select('id, name, funder, deadline, pipeline_status')
        .not('pipeline_status', 'in', '("awarded","declined")')
        .not('deadline', 'is', null)

      if (cancelled) return

      const threshold = prefs.alertDaysThreshold
      const categorized: AlertGrant[] = []

      for (const g of (data ?? []) as {
        id: string; name: string; funder: string | null
        deadline: string; pipeline_status: string
      }[]) {
        const days    = daysUntil(g.deadline)
        const urgency = classify(days, threshold)
        if (urgency) categorized.push({ ...g, days, urgency })
      }

      // Sort: most overdue first, then by days ascending
      categorized.sort((a, b) => a.days - b.days)
      setAll(categorized)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [prefs.alertDaysThreshold])

  const updatePrefs = useCallback((update: Partial<NotificationPrefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...update }
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const enabled         = prefs.alertsEnabled
  const overdueAlerts   = enabled ? all.filter(a => a.urgency === 'overdue')    : []
  const urgentAlerts    = enabled ? all.filter(a => a.urgency === 'urgent')     : []
  const soonAlerts      = enabled ? all.filter(a => a.urgency === 'soon')       : []
  const approachingAlerts = enabled ? all.filter(a => a.urgency === 'approaching') : []
  const alerts          = enabled ? all : []
  const badgeCount      = overdueAlerts.length + urgentAlerts.length

  return (
    <DeadlineAlertsContext.Provider value={{
      alerts, overdueAlerts, urgentAlerts, soonAlerts, approachingAlerts,
      badgeCount, prefs, updatePrefs, loading,
    }}>
      {children}
    </DeadlineAlertsContext.Provider>
  )
}

export function useDeadlineAlerts() {
  return useContext(DeadlineAlertsContext)
}
