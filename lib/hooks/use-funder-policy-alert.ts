'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export type PolicyLevel = 'prohibits' | 'restricts' | 'requires_disclosure' | 'permits' | 'no_policy'

export interface FunderPolicyRow {
  id: string
  funder_name: string
  funder_aliases: string[] | null
  policy_level: PolicyLevel
  summary: string | null
  details: string | null
  source_url: string | null
  last_verified: string | null
}

export interface UseFunderPolicyAlertResult {
  policy: FunderPolicyRow | null
  loading: boolean
}

/** Returns the uppercase acronym of a multi-word string, e.g. "National Institutes of Health" → "NIH" */
function acronym(s: string): string {
  return s
    .split(/\s+/)
    .filter((w) => w.length > 2 || w === w.toUpperCase()) // skip short stop-words like "of", "the"
    .map((w) => w[0].toUpperCase())
    .join('')
}

function partialCaseInsensitiveMatch(haystack: string, needle: string): boolean {
  if (!haystack || !needle) return false
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  if (h === n) return true
  if (h.includes(n) || n.includes(h)) return true
  // acronym cross-match: "NIH" matches "National Institutes of Health" and vice-versa
  const haystackAcronym = acronym(haystack).toLowerCase()
  const needleAcronym = acronym(needle).toLowerCase()
  if (haystackAcronym === n || needleAcronym === h) return true
  if (haystackAcronym === needleAcronym && haystackAcronym.length > 1) return true
  return false
}

export function useFunderPolicyAlert(funder: string | null | undefined): UseFunderPolicyAlertResult {
  const [policy, setPolicy] = useState<FunderPolicyRow | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!funder?.trim()) {
      setPolicy(null)
      return
    }

    let cancelled = false

    async function fetchPolicies() {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.from('funder_ai_policies').select('*')

      if (cancelled) return

      console.log('[funderPolicy] fetch result:', {
        rowCount: data?.length ?? 0,
        error: error?.message ?? null,
        funderArg: funder,
      })

      if (error || !data) {
        console.warn('[funderPolicy] fetch failed or returned no data', error)
        setPolicy(null)
        setLoading(false)
        return
      }

      const needle = funder!.trim()
      const rows = data as FunderPolicyRow[]

      const finalMatches = rows.filter((row) => {
        const nameMatch = partialCaseInsensitiveMatch(row.funder_name ?? '', needle)
        const aliasMatch = (row.funder_aliases ?? []).some((a) =>
          partialCaseInsensitiveMatch(a, needle)
        )
        console.log('[funderPolicy] checking row:', {
          funder_name: row.funder_name,
          aliases: row.funder_aliases,
          needle,
          nameMatch,
          aliasMatch,
        })
        return nameMatch || aliasMatch
      })

      console.log('[funderPolicy] matches found:', finalMatches.length, finalMatches.map((r) => r.funder_name))
      setPolicy(finalMatches[0] ?? null)
      setLoading(false)
    }

    fetchPolicies()
    return () => {
      cancelled = true
    }
  }, [funder])

  return { policy, loading }
}
