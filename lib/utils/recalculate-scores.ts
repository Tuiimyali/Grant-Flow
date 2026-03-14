import type { SupabaseClient } from '@supabase/supabase-js'
import type { OrganizationProfile, GrantsFullRow } from '@/lib/types/database.types'
import { calculateFit, type GrantForScoring } from '@/lib/scoring/calculate-fit'

/* ── Internal helpers ───────────────────────────────────────── */

async function fetchOrgProfile(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Partial<OrganizationProfile> | null> {
  const { data } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('organization_id', organizationId)
    .single()
  return data ?? null
}

/** Fetch grant descriptions from the grants table (not in the view). */
async function fetchDescriptions(
  supabase: SupabaseClient,
  grantIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>()
  if (!grantIds.length) return map

  const { data } = await supabase
    .from('grants')
    .select('id, description')
    .in('id', grantIds)

  for (const row of data ?? []) {
    map.set(row.id, row.description ?? null)
  }
  return map
}

function toGrantForScoring(row: GrantsFullRow, description: string | null): GrantForScoring {
  return {
    id:               row.id,
    name:             row.name,
    category:         row.category,
    funder:           row.funder,
    description,
    eligibility_types: row.eligibility_types,
    amount_high:      row.amount_high,
    amount_low:       row.amount_low,
    deadline:         row.deadline,
    effort_weeks:     row.effort_weeks,
  }
}

async function upsertMatchRow(
  supabase: SupabaseClient,
  grant: GrantForScoring,
  org: Partial<OrganizationProfile>,
) {
  const result = calculateFit(org, grant)

  await supabase
    .from('grant_matches')
    .update({
      fit_score:            result.score,
      eligibility_match:    result.breakdown.eligibility,
      mission_alignment:    result.breakdown.mission,
      budget_range_fit:     result.breakdown.budget,
      geographic_match:     result.breakdown.geographic,
      capacity_readiness:   result.breakdown.capacity,
      deadline_feasibility: result.breakdown.deadline,
      scored_at:            new Date().toISOString(),
    })
    .eq('grant_id', grant.id)
}

/* ── Public API ─────────────────────────────────────────────── */

/**
 * Recalculate fit scores for every grant in the org's pipeline.
 * Called after the org profile is saved or manually triggered.
 */
export async function recalculateOrgScores(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const [org, grantsRes] = await Promise.all([
    fetchOrgProfile(supabase, organizationId),
    supabase.from('grants_full').select('*'),
  ])

  if (!org || !grantsRes.data?.length) return

  const grants = grantsRes.data as GrantsFullRow[]
  const descMap = await fetchDescriptions(supabase, grants.map(g => g.id))

  await Promise.all(
    grants.map(g =>
      upsertMatchRow(
        supabase,
        toGrantForScoring(g, descMap.get(g.id) ?? null),
        org,
      )
    ),
  )
}

/**
 * Recalculate fit score for a single grant.
 * Called after a grant is added or edited.
 */
export async function recalculateGrantScore(
  supabase: SupabaseClient,
  organizationId: string,
  grantId: string,
): Promise<void> {
  const [org, grantRes, descRes] = await Promise.all([
    fetchOrgProfile(supabase, organizationId),
    supabase.from('grants_full').select('*').eq('id', grantId).single(),
    supabase.from('grants').select('id, description').eq('id', grantId).single(),
  ])

  if (!org || !grantRes.data) return

  const grant = toGrantForScoring(
    grantRes.data as GrantsFullRow,
    descRes.data?.description ?? null,
  )
  await upsertMatchRow(supabase, grant, org)
}
