'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OrganizationProfile } from '@/lib/types/database.types'

export interface UseOrganizationResult {
  data: OrganizationProfile | null
  organizationId: string | null
  orgName: string | null
  loading: boolean
  error: string | null
}

export function useOrganization(): UseOrganizationResult {
  const [data, setData]                     = useState<OrganizationProfile | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [orgName, setOrgName]               = useState<string | null>(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchOrg() {
      // Step 1: resolve the user's organization_id via organization_members
      const { data: member, error: memberErr } = await supabase
        .from('organization_members')
        .select('organization_id')
        .single()

      console.log('[useOrganization] member row:', member, 'error:', memberErr)

      if (memberErr) {
        if (memberErr.code !== 'PGRST116') setError(memberErr.message)
        setLoading(false)
        return
      }

      const orgId = member.organization_id
      setOrganizationId(orgId)

      // Step 2: fetch org name from the organizations table
      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', orgId)
        .single()

      console.log('[useOrganization] organization row:', org)
      setOrgName(org?.name ?? null)

      // Step 3: fetch the profile for that org
      const { data: profile, error: profileErr } = await supabase
        .from('organization_profiles')
        .select('*')
        .eq('organization_id', orgId)
        .single()

      console.log('[useOrganization] profile:', profile, 'error:', profileErr)

      // PGRST116 here is fine — profile may not exist yet for a new org
      if (profileErr && profileErr.code !== 'PGRST116') {
        setError(profileErr.message)
      } else {
        setData(profile as OrganizationProfile | null)
      }

      setLoading(false)
    }

    fetchOrg()
  }, [])

  return { data, organizationId, orgName, loading, error }
}
