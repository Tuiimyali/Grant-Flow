import type { OrganizationProfile, AnnualBudgetRange, GrantsFullRow } from '@/lib/types/database.types'

/* ── Configurable weights (must sum to 1.0) ─────────────────── */
export const WEIGHTS = {
  focusAreas:  0.35,
  populations: 0.20,
  orgType:     0.20,
  sovereignty: 0.10,
  geography:   0.10,
  budget:      0.05,
} as const satisfies Record<string, number>

/* ── Grant criteria shape ───────────────────────────────────── */
export interface GrantCriteria {
  focus_areas?: string[] | null
  populations_served?: string[] | null
  eligible_org_types?: string[] | null
  eligible_sovereignty?: string[] | null
  geographic_focus?: string | null
  amount_low?: number | null
  amount_high?: number | null
}

/* ── Score band ─────────────────────────────────────────────── */
export type FitBand = 'excellent' | 'good' | 'moderate' | 'low' | 'unknown'

export interface FitBreakdown {
  focusAreas:  number   // 0–100
  populations: number
  orgType:     number
  sovereignty: number
  geography:   number
  budget:      number
}

export interface FitResult {
  score:     number   // 0–100 composite
  band:      FitBand
  breakdown: FitBreakdown
}

/* ── Dimension labels (for display) ─────────────────────────── */
export const DIMENSION_LABELS: Record<keyof FitBreakdown, string> = {
  focusAreas:  'Focus areas',
  populations: 'Populations',
  orgType:     'Org type',
  sovereignty: 'Legal status',
  geography:   'Geography',
  budget:      'Budget fit',
}

/* ── Eligibility string → org type mapping ──────────────────── */
const ELIGIBILITY_TO_ORG_TYPES: Record<string, string[]> = {
  'nonprofit 501(c)(3)':   ['nonprofit_501c3'],
  'tribal government':     ['tribal_government', 'indigenous_led'],
  'indigenous-led org':    ['indigenous_led'],
  'faith-based org':       ['faith_based'],
  'community organization':['community_org'],
  'community org':         ['community_org'],
  'local government':      ['other'],
  'state agency':          ['other'],
  'other':                 ['other'],
}

const ELIGIBILITY_TO_SOVEREIGNTY: Record<string, string[]> = {
  'tribal government':         ['tribal', 'federally_recognized', 'state_recognized'],
  'indigenous-led org':        ['tribal', 'federally_recognized', 'state_recognized'],
  'nonprofit 501(c)(3)':       ['501c3'],
  'fiscal sponsorship':        ['fiscal_sponsorship'],
  'government entity':         ['government_entity'],
  'state agency':              ['government_entity'],
  'local government':          ['government_entity'],
}

function mapEligibilityToOrgTypes(eligibility: string[]): string[] {
  const result = new Set<string>()
  for (const e of eligibility) {
    const key = e.toLowerCase()
    for (const [pattern, types] of Object.entries(ELIGIBILITY_TO_ORG_TYPES)) {
      if (key.includes(pattern)) types.forEach(t => result.add(t))
    }
  }
  return [...result]
}

function mapEligibilityToSovereignty(eligibility: string[]): string[] {
  const result = new Set<string>()
  for (const e of eligibility) {
    const key = e.toLowerCase()
    for (const [pattern, statuses] of Object.entries(ELIGIBILITY_TO_SOVEREIGNTY)) {
      if (key.includes(pattern)) statuses.forEach(s => result.add(s))
    }
  }
  return [...result]
}

/* ── Budget rank map ────────────────────────────────────────── */
const BUDGET_RANK: Record<AnnualBudgetRange, number> = {
  under_50k:   1,
  '50k_100k':  2,
  '100k_500k': 3,
  '500k_1m':   4,
  '1m_5m':     5,
  over_5m:     6,
}

function grantAmountRank(amount: number | null | undefined): number | null {
  if (amount == null) return null
  if (amount < 50_000)   return 1
  if (amount < 100_000)  return 2
  if (amount < 500_000)  return 3
  if (amount < 1_000_000) return 4
  if (amount < 5_000_000) return 5
  return 6
}

/* ── Dimension scorers (all return 0–1) ─────────────────────── */

/** Jaccard-style overlap: |A ∩ B| / |A ∪ B| */
function overlapScore(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
): number {
  if (!a?.length || !b?.length) return 0
  const setA = new Set(a.map(s => s.toLowerCase()))
  const setB = new Set(b.map(s => s.toLowerCase()))
  const intersection = [...setA].filter(x => setB.has(x)).length
  return intersection / new Set([...setA, ...setB]).size
}

/** Category text vs org focus-area tags: token-level overlap */
function categoryFocusScore(
  orgFocus: string[] | null | undefined,
  grantCategory: string | null | undefined,
): number {
  if (!orgFocus?.length || !grantCategory) return 0
  const cat    = grantCategory.toLowerCase()
  const catTok = new Set(cat.split(/[\s,&/\-]+/).filter(t => t.length > 2))
  let best = 0
  for (const area of orgFocus) {
    const al   = area.toLowerCase()
    const aTok = al.split(/[\s,&/\-]+/).filter(t => t.length > 2)
    // full substring containment
    if (cat.includes(al) || al.includes(cat)) { best = 1; break }
    // token overlap
    const shared = aTok.filter(t => catTok.has(t)).length
    if (shared > 0) {
      best = Math.max(best, shared / Math.max(aTok.length, catTok.size))
    }
  }
  return best
}

/** Whether org type is among the eligible types */
function includesScore(
  value: string | null | undefined,
  list:  string[] | null | undefined,
): number {
  if (!value || !list?.length) return 0
  return list.map(s => s.toLowerCase()).includes(value.toLowerCase()) ? 1 : 0
}

/** Token-level geographic text similarity */
function geoScore(
  orgGeo:   string | null | undefined,
  grantGeo: string | null | undefined,
): number {
  if (!orgGeo || !grantGeo) return 0
  const org   = orgGeo.toLowerCase()
  const grant = grantGeo.toLowerCase()
  if (org === grant) return 1
  const orgTok   = org.split(/[\s,]+/)
  const grantTok = new Set(grant.split(/[\s,]+/))
  const shared   = orgTok.filter(t => t.length > 3 && grantTok.has(t)).length
  return shared > 0 ? Math.min(shared / Math.max(orgTok.length, grantTok.size), 1) : 0
}

/** Budget rank proximity: 0 if no data, 1 if well-matched, falls off with distance */
function budgetFitScore(
  orgBudget:  AnnualBudgetRange | null | undefined,
  amountHigh: number | null | undefined,
): number {
  const orgRank   = orgBudget ? BUDGET_RANK[orgBudget] : null
  const grantRank = grantAmountRank(amountHigh)
  if (orgRank == null || grantRank == null) return 0
  const diff = Math.abs(orgRank - grantRank)
  if (diff === 0) return 1
  if (diff === 1) return 0.75
  if (diff === 2) return 0.4
  return 0
}

/* ── Main scorer (takes explicit criteria) ──────────────────── */

/**
 * Calculate an org–grant fit score (0–100).
 * Each dimension scored 0–100, then weighted by WEIGHTS.
 */
export function calcFitScore(
  org:   Partial<OrganizationProfile>,
  grant: GrantCriteria,
): FitResult {
  const raw = {
    focusAreas:  grant.focus_areas
      ? overlapScore(org.focus_areas, grant.focus_areas)
      : 0,
    populations: overlapScore(org.populations_served, grant.populations_served),
    orgType:     includesScore(org.org_type, grant.eligible_org_types),
    sovereignty: includesScore(org.sovereignty_status, grant.eligible_sovereignty),
    geography:   geoScore(org.geographic_focus, grant.geographic_focus),
    budget:      budgetFitScore(org.annual_budget_range, grant.amount_high),
  }

  const composite =
    raw.focusAreas  * WEIGHTS.focusAreas  +
    raw.populations * WEIGHTS.populations +
    raw.orgType     * WEIGHTS.orgType     +
    raw.sovereignty * WEIGHTS.sovereignty +
    raw.geography   * WEIGHTS.geography   +
    raw.budget      * WEIGHTS.budget

  const breakdown: FitBreakdown = {
    focusAreas:  Math.round(raw.focusAreas  * 100),
    populations: Math.round(raw.populations * 100),
    orgType:     Math.round(raw.orgType     * 100),
    sovereignty: Math.round(raw.sovereignty * 100),
    geography:   Math.round(raw.geography   * 100),
    budget:      Math.round(raw.budget      * 100),
  }

  return { score: Math.round(composite * 100), band: fitBand(Math.round(composite * 100)), breakdown }
}

/* ── Scorer for a GrantsFullRow (derives criteria from stored fields) ── */

/**
 * Derive GrantCriteria from a GrantsFullRow and run calcFitScore.
 * Maps:
 *   eligibility_types → eligible_org_types + eligible_sovereignty
 *   category          → focus_areas (single-tag; use category-focus scorer for text)
 *   amount_high       → budget fit
 */
export function calcFitScoreFromGrantRow(
  org:   Partial<OrganizationProfile>,
  grant: GrantsFullRow,
): FitResult {
  const eligibleOrgTypes   = mapEligibilityToOrgTypes(grant.eligibility_types ?? [])
  const eligibleSovereignty = mapEligibilityToSovereignty(grant.eligibility_types ?? [])

  // Focus area: use the token-overlap scorer against category
  const rawFocus = categoryFocusScore(org.focus_areas, grant.category)

  // Build criteria for the remaining dimensions
  const criteria: GrantCriteria = {
    focus_areas:          null,   // handled separately via rawFocus
    populations_served:   null,   // not stored per-grant; skip
    eligible_org_types:   eligibleOrgTypes.length  ? eligibleOrgTypes  : null,
    eligible_sovereignty: eligibleSovereignty.length ? eligibleSovereignty : null,
    geographic_focus:     null,   // not in grants_full view; skip
    amount_high:          grant.amount_high,
  }

  const rawOrg     = includesScore(org.org_type, criteria.eligible_org_types)
  const rawSov     = includesScore(org.sovereignty_status, criteria.eligible_sovereignty)
  const rawBudget  = budgetFitScore(org.annual_budget_range, grant.amount_high)

  // Geography: no grant geo in view → 0
  const rawGeo = 0

  // Populations: no per-grant population data → 0
  const rawPop = 0

  const composite =
    rawFocus   * WEIGHTS.focusAreas  +
    rawPop     * WEIGHTS.populations +
    rawOrg     * WEIGHTS.orgType     +
    rawSov     * WEIGHTS.sovereignty +
    rawGeo     * WEIGHTS.geography   +
    rawBudget  * WEIGHTS.budget

  const breakdown: FitBreakdown = {
    focusAreas:  Math.round(rawFocus  * 100),
    populations: Math.round(rawPop   * 100),
    orgType:     Math.round(rawOrg   * 100),
    sovereignty: Math.round(rawSov   * 100),
    geography:   Math.round(rawGeo   * 100),
    budget:      Math.round(rawBudget * 100),
  }

  return { score: Math.round(composite * 100), band: fitBand(Math.round(composite * 100)), breakdown }
}

/* ── Band & colours ─────────────────────────────────────────── */

export function fitBand(score: number | null | undefined): FitBand {
  if (score == null) return 'unknown'
  if (score >= 80)  return 'excellent'
  if (score >= 60)  return 'good'
  if (score >= 40)  return 'moderate'
  return 'low'
}

export const FIT_COLORS: Record<FitBand, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'bg-amber-500/10',   text: 'text-amber-500',   border: 'border-amber-500/30' },
  good:      { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30' },
  moderate:  { bg: 'bg-sky-500/10',     text: 'text-sky-500',     border: 'border-sky-500/30' },
  low:       { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30' },
  unknown:   { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/20' },
}
