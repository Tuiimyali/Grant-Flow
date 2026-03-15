'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import type { SnippetRow, SnippetCategory } from '@/lib/types/database.types'

/* ── Helpers ─────────────────────────────────────────────────── */

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

async function getOrgId(): Promise<string | null> {
  const { data } = await createClient()
    .from('organization_members')
    .select('organization_id')
    .single()
  return (data as { organization_id: string } | null)?.organization_id ?? null
}

/* ── Starter snippets (seeded when org has zero snippets) ────── */

const STARTERS: Omit<SnippetRow, 'id' | 'organization_id' | 'created_at' | 'updated_at'>[] = [
  {
    title: 'Organization Mission',
    category: 'Mission & Vision',
    content:
      '[Organization name] is a [type of organization] dedicated to [mission statement]. ' +
      'Founded in [year], we have served [community/region] by [key programs or activities]. ' +
      'Our work is guided by [core values or principles] and a deep commitment to [primary goal or outcome].',
    word_count: 45,
    times_used: 0,
  },
  {
    title: 'Community We Serve',
    category: 'Community Description',
    content:
      '[Organization name] serves [describe community — e.g., low-income families, tribal members, rural residents] ' +
      'in [geographic area]. Our community faces significant challenges including [2–3 key challenges, e.g., high ' +
      'unemployment, limited healthcare access, food insecurity]. Despite these barriers, our community demonstrates ' +
      'remarkable resilience through [strengths or assets]. We are uniquely positioned to address these needs through [your approach].',
    word_count: 70,
    times_used: 0,
  },
  {
    title: 'Our Team',
    category: 'Project Team',
    content:
      '[Project Director name and title] will lead this project, bringing [X years] of experience in [relevant field]. ' +
      'Supporting the project is [Team member 2 name/title] who specializes in [area of expertise], and ' +
      '[Team member 3 name/title] who will oversee [function]. Our team collectively holds expertise in [key areas] ' +
      'and has successfully managed [similar projects or funding]. Collectively, our staff reflects the communities we serve.',
    word_count: 68,
    times_used: 0,
  },
]

/* ── Hook interface ──────────────────────────────────────────── */

export interface UseSnippetsResult {
  snippets: SnippetRow[]
  loading: boolean
  createSnippet: (data: { title: string; category: SnippetCategory; content: string }) => Promise<SnippetRow | null>
  updateSnippet: (id: string, data: { title: string; category: SnippetCategory; content: string }) => Promise<void>
  deleteSnippet: (id: string) => Promise<void>
  incrementUsed: (id: string) => Promise<void>
  refresh: () => void
}

/* ── Hook ────────────────────────────────────────────────────── */

export function useSnippets(): UseSnippetsResult {
  const [snippets, setSnippets] = useState<SnippetRow[]>([])
  const [loading,  setLoading]  = useState(true)

  const fetchSnippets = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const orgId = await getOrgId()
    if (!orgId) { setLoading(false); return }

    const { data, error } = await supabase
      .from('snippets')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[useSnippets] fetch error:', error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as SnippetRow[]

    // Seed 3 starter snippets if none exist yet
    if (rows.length === 0) {
      const toInsert = STARTERS.map(s => ({ ...s, organization_id: orgId }))
      const { data: seeded, error: seedErr } = await supabase
        .from('snippets')
        .insert(toInsert)
        .select('*')
      if (!seedErr) {
        setSnippets((seeded ?? []) as SnippetRow[])
        setLoading(false)
        return
      }
      console.error('[useSnippets] seed error:', seedErr.message)
    }

    setSnippets(rows)
    setLoading(false)
  }, [])

  useEffect(() => { fetchSnippets() }, [fetchSnippets])

  const createSnippet = useCallback(async (
    data: { title: string; category: SnippetCategory; content: string },
  ): Promise<SnippetRow | null> => {
    const orgId = await getOrgId()
    if (!orgId) { toast('Organization not found', 'error'); return null }

    const wc = wordCount(data.content)
    const supabase = createClient()
    const { data: created, error } = await supabase
      .from('snippets')
      .insert({ ...data, organization_id: orgId, word_count: wc, times_used: 0 })
      .select('*')
      .single()

    if (error) { toast('Failed to create snippet', 'error'); return null }

    const row = created as SnippetRow
    setSnippets(prev => [...prev, row])
    toast('Snippet created', 'success', 2000)
    return row
  }, [])

  const updateSnippet = useCallback(async (
    id: string,
    data: { title: string; category: SnippetCategory; content: string },
  ): Promise<void> => {
    const wc = wordCount(data.content)
    const supabase = createClient()
    const { error } = await supabase
      .from('snippets')
      .update({ ...data, word_count: wc })
      .eq('id', id)

    if (error) { toast('Failed to save snippet', 'error'); return }

    setSnippets(prev => prev.map(s => s.id === id ? { ...s, ...data, word_count: wc } : s))
    toast('Snippet saved', 'success', 2000)
  }, [])

  const deleteSnippet = useCallback(async (id: string): Promise<void> => {
    const supabase = createClient()
    const { error } = await supabase.from('snippets').delete().eq('id', id)
    if (error) { toast('Failed to delete snippet', 'error'); return }
    setSnippets(prev => prev.filter(s => s.id !== id))
    toast('Snippet deleted', 'success', 2000)
  }, [])

  const incrementUsed = useCallback(async (id: string): Promise<void> => {
    setSnippets(prev => {
      const snippet = prev.find(s => s.id === id)
      if (!snippet) return prev
      const next = (snippet.times_used ?? 0) + 1
      createClient().from('snippets').update({ times_used: next }).eq('id', id).then(() => {})
      return prev.map(s => s.id === id ? { ...s, times_used: next } : s)
    })
  }, [])

  return { snippets, loading, createSnippet, updateSnippet, deleteSnippet, incrementUsed, refresh: fetchSnippets }
}
