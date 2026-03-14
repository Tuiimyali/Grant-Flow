'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import type { GrantsFullRow } from '@/lib/types/database.types'

export interface UseGrantsResult {
  grants: GrantsFullRow[]
  loading: boolean
  error: string | null
  updateStatus: (grantId: string, status: string) => Promise<void>
  refresh: () => void
}

export function useGrants(): UseGrantsResult {
  const [grants, setGrants]   = useState<GrantsFullRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const fetchGrants = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('grants_full')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false })

    if (error) {
      setError(error.message)
    } else {
      setGrants((data ?? []) as GrantsFullRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchGrants() }, [fetchGrants])

  const updateStatus = useCallback(async (grantId: string, status: string) => {
    // Optimistic update
    setGrants(prev => prev.map(g => g.id === grantId ? { ...g, pipeline_status: status } : g))

    const supabase = createClient()
    const { data: updated, error } = await supabase
      .from('pipeline_items')
      .update({ status })
      .eq('grant_id', grantId)
      .select('id, grant_id, status')

    console.log('[useGrants] status update response:', { updated, error: error?.message ?? null })

    if (error) {
      console.error('[useGrants] status update failed:', error.message)
      toast('Failed to update status', 'error')
      fetchGrants() // revert by re-fetching
    } else if (!updated?.length) {
      // No rows matched — pipeline_items row may not exist yet, try inserting
      console.warn('[useGrants] update matched 0 rows — trying insert into pipeline_items')
      const { data: inserted, error: insertErr } = await supabase
        .from('pipeline_items')
        .insert({ grant_id: grantId, status })
        .select('id, grant_id, status')
      console.log('[useGrants] insert response:', { inserted, error: insertErr?.message ?? null })
      if (insertErr) {
        console.error('[useGrants] insert also failed:', insertErr.message)
        toast('Failed to update status', 'error')
        fetchGrants()
      } else {
        toast('Status updated', 'success')
      }
    } else {
      toast('Status updated', 'success')
    }
  }, [fetchGrants])

  return { grants, loading, error, updateStatus, refresh: fetchGrants }
}
