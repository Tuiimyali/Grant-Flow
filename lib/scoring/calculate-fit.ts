import type { OrganizationProfile, AnnualBudgetRange } from '@/lib/types/database.types'

/* ── Types ──────────────────────────────────────────────────── */

export interface FitBreakdown {
  eligibility: number  // 0-100
  mission:     number
  budget:      number
  capacity:    number
  deadline:    number
  geographic:  number
}

export interface FitResult {
  score:     number   // 0-100 weighted composite
  breakdown: FitBreakdown
}

/** Grant fields required for scoring. Extends grants_full with optional description. */
export interface GrantForScoring {
  id: string
  name: string
  category: string | null
  funder: string | null
  description: string | null
  eligibility_types: string[] | null
  amount_high: number | null
  amount_low: number | null
  deadline: string | null
  effort_weeks: number | null
}

/* ── Weights (must sum to 1.0) ──────────────────────────────── */

const WEIGHTS = {
  eligibility: 0.25,
  mission:     0.20,
  budget:      0.15,
  capacity:    0.15,
  deadline:    0.15,
  geographic:  0.10,
} as const

/* ── Eligibility mapping (from grants' eligibility_types strings) ── */

const ELIGIBILITY_TO_ORG_TYPES: Record<string, string[]> = {
  'nonprofit 501(c)(3)':    ['nonprofit_501c3'],
  'tribal government':      ['tribal_government', 'indigenous_led'],
  'indigenous-led org':     ['indigenous_led'],
  'indigenous-led':         ['indigenous_led'],
  'faith-based org':        ['faith_based'],
  'faith-based':            ['faith_based'],
  'community organization': ['community_org'],
  'community org':          ['community_org'],
  'local government':       ['other'],
  'state agency':           ['other'],
  'other':                  ['other'],
}

const ELIGIBILITY_TO_SOVEREIGNTY: Record<string, string[]> = {
  'tribal government':   ['tribal', 'federally_recognized', 'state_recognized'],
  'indigenous-led org':  ['tribal', 'federally_recognized', 'state_recognized'],
  'indigenous-led':      ['tribal', 'federally_recognized', 'state_recognized'],
  'nonprofit 501(c)(3)': ['501c3'],
  'fiscal sponsorship':  ['fiscal_sponsorship'],
  'government entity':   ['government_entity'],
  'state agency':        ['government_entity'],
  'local government':    ['government_entity'],
}

function mapToOrgTypes(eligTypes: string[]): string[] {
  const result = new Set<string>()
  for (const e of eligTypes) {
    const key = e.toLowerCase()
    for (const [pattern, types] of Object.entries(ELIGIBILITY_TO_ORG_TYPES)) {
      if (key.includes(pattern)) types.forEach(t => result.add(t))
    }
  }
  return [...result]
}

function mapToSovereignty(eligTypes: string[]): string[] {
  const result = new Set<string>()
  for (const e of eligTypes) {
    const key = e.toLowerCase()
    for (const [pattern, statuses] of Object.entries(ELIGIBILITY_TO_SOVEREIGNTY)) {
      if (key.includes(pattern)) statuses.forEach(s => result.add(s))
    }
  }
  return [...result]
}

/* ── 1. Eligibility Match (0-100, weight 25%) ───────────────── */

function scoreEligibility(
  org:   Partial<OrganizationProfile>,
  grant: GrantForScoring,
): number {
  const eligTypes = grant.eligibility_types
  if (!eligTypes?.length) return 100  // no restriction = open to all

  const allowedOrgTypes   = mapToOrgTypes(eligTypes)
  const allowedSovereignty = mapToSovereignty(eligTypes)

  const orgTypeMatch     = !!org.org_type && allowedOrgTypes.includes(org.org_type)
  const sovereigntyMatch = !!org.sovereignty_status && allowedSovereignty.includes(org.sovereignty_status)

  if (orgTypeMatch || sovereigntyMatch) return 100

  // Eligibility types listed but none mapped to known types → unclear
  if (allowedOrgTypes.length === 0 && allowedSovereignty.length === 0) return 50

  return 0
}

/* ── 2. Budget Range Fit (0-100, weight 15%) ────────────────── */

const BUDGET_MIDPOINTS: Record<AnnualBudgetRange, number> = {
  under_50k:   25_000,
  '50k_100k':  75_000,
  '100k_500k': 300_000,
  '500k_1m':   750_000,
  '1m_5m':     3_000_000,
  over_5m:     7_500_000,
}

function scoreBudget(
  org:   Partial<OrganizationProfile>,
  grant: GrantForScoring,
): number {
  if (!org.annual_budget_range || !grant.amount_high) return 50  // no data = neutral

  const orgBudget   = BUDGET_MIDPOINTS[org.annual_budget_range]
  const grantAmount = grant.amount_high
  const ratio       = grantAmount / orgBudget

  if (ratio >= 0.10 && ratio <= 0.30) return 100  // sweet spot: 10–30% of budget
  if (ratio > 0.30 && ratio <= 0.50)  return 80   // acceptable
  if (ratio < 0.10 && ratio >= 0.05)  return 70   // small grant, fine
  if (ratio < 0.05)                   return 60   // very small, low ROI
  if (ratio > 0.50 && ratio <= 0.75)  return 40   // >50% of budget, lower score
  if (ratio > 0.75 && ratio <= 1.00)  return 20   // >75% of budget, risky
  return 10                                        // >100% of annual budget
}

/* ── 3. Capacity Readiness (0-100, weight 15%) ──────────────── */

function scoreCapacity(org: Partial<OrganizationProfile>): number {
  let points = 0
  if (org.sam_registered === 'yes')                                             points += 30
  if (org.has_grant_writer === 'yes')                                           points += 25
  if (org.single_audit_status === 'current' ||
      org.single_audit_status === 'not_required')                               points += 20
  if (org.has_prior_federal === true)                                           points += 15
  if (org.staff_size != null)                                                   points += 10
  return Math.min(100, points)
}

/* ── 4. Deadline Feasibility (0-100, weight 15%) ────────────── */

function scoreDeadline(grant: GrantForScoring): number {
  if (!grant.deadline || !grant.effort_weeks) return 50  // no data = neutral

  const daysUntil = (new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)

  if (daysUntil <= 0) return 0  // deadline already passed

  const effortDays = grant.effort_weeks * 7
  const ratio      = daysUntil / effortDays

  if (ratio >= 2) return 100   // plenty of time with buffer
  if (ratio >= 1) return 60    // just enough — tight
  return 20                    // not enough time
}

/* ── 5. Geographic Match (0-100, weight 10%) ────────────────── */

function scoreGeographic(
  org:   Partial<OrganizationProfile>,
  grant: GrantForScoring,
): number {
  if (!org.geographic_focus) return 50  // no geo specified = neutral

  const orgGeo    = org.geographic_focus.toLowerCase()
  const grantText = [grant.name, grant.category ?? '', grant.description ?? '']
    .join(' ')
    .toLowerCase()

  if (!grantText.trim()) return 50

  const orgTokens = orgGeo.split(/[\s,]+/).filter(t => t.length > 3)
  if (!orgTokens.length) return 50

  const fullMatch    = orgTokens.every(t => grantText.includes(t))
  const partialMatch = orgTokens.some(t => grantText.includes(t))

  if (fullMatch)    return 100
  if (partialMatch) return 50
  return 0
}

/* ── 6. Mission Alignment (0-100, weight 20%) ───────────────── */

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'are', 'from', 'has', 'have',
  'will', 'our', 'can', 'all', 'been', 'its', 'was', 'not', 'but', 'they',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;:.!?()\[\]{}"'\/\-]+/)
    .filter(t => t.length > 3 && !STOP_WORDS.has(t))
}

function scoreMission(
  org:   Partial<OrganizationProfile>,
  grant: GrantForScoring,
): number {
  const orgText = [
    org.mission_statement ?? '',
    ...(org.focus_areas ?? []),
  ].join(' ')

  const grantText = [
    grant.name,
    grant.category   ?? '',
    grant.description ?? '',
    grant.funder      ?? '',
  ].join(' ')

  if (!orgText.trim() || !grantText.trim()) return 0

  const orgTokens   = new Set(tokenize(orgText))
  const grantTokens = new Set(tokenize(grantText))

  if (!orgTokens.size || !grantTokens.size) return 0

  const matches = [...orgTokens].filter(t => grantTokens.has(t)).length

  // Each matching keyword contributes 20 points, max 100
  return Math.min(100, matches * 20)
}

/* ── Main scorer ────────────────────────────────────────────── */

export function calculateFit(
  org:   Partial<OrganizationProfile>,
  grant: GrantForScoring,
): FitResult {
  const breakdown: FitBreakdown = {
    eligibility: scoreEligibility(org, grant),
    mission:     scoreMission(org, grant),
    budget:      scoreBudget(org, grant),
    capacity:    scoreCapacity(org),
    deadline:    scoreDeadline(grant),
    geographic:  scoreGeographic(org, grant),
  }

  const score = Math.round(
    breakdown.eligibility * WEIGHTS.eligibility +
    breakdown.mission     * WEIGHTS.mission     +
    breakdown.budget      * WEIGHTS.budget      +
    breakdown.capacity    * WEIGHTS.capacity    +
    breakdown.deadline    * WEIGHTS.deadline    +
    breakdown.geographic  * WEIGHTS.geographic,
  )

  return { score, breakdown }
}

/* ── Dimension labels (for display) ─────────────────────────── */

export const DIMENSION_LABELS: Record<keyof FitBreakdown, string> = {
  eligibility: 'Eligibility',
  mission:     'Mission alignment',
  budget:      'Budget fit',
  capacity:    'Capacity',
  deadline:    'Deadline',
  geographic:  'Geography',
}
