// Run `npx supabase gen types typescript --project-id <id> > lib/types/database.types.ts`
// to replace this with auto-generated types after connecting your project.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/* ── Enums (match DB check constraints exactly) ─────────────── */
export type OrgType =
  | 'indigenous_led'
  | 'nonprofit_501c3'
  | 'tribal_government'
  | 'faith_based'
  | 'community_org'
  | 'other'

export type SovereigntyStatus =
  | 'tribal'
  | 'federally_recognized'
  | 'state_recognized'
  | '501c3'
  | 'fiscal_sponsorship'
  | 'government_entity'
  | 'other'

export type AnnualBudgetRange =
  | 'under_50k'
  | '50k_100k'
  | '100k_500k'
  | '500k_1m'
  | '1m_5m'
  | 'over_5m'

export type StaffSize =
  | 'solo'
  | '1_5'
  | '6_15'
  | '16_50'
  | 'over_50'

export type HasGrantWriter =
  | 'yes'
  | 'no'
  | 'contractor'

export type SamRegistered =
  | 'yes'
  | 'no'
  | 'in_progress'

export type SingleAuditStatus =
  | 'not_required'
  | 'current'
  | 'in_progress'
  | 'needed'

/* ── organizations row ──────────────────────────────────────── */
export interface Organization {
  id: string
  name: string
  created_at: string
}

/* ── organization_profiles row ──────────────────────────────── */
export interface OrganizationProfile {
  id: string
  organization_id: string
  created_at: string
  updated_at: string

  // Identity (org_name lives on organizations table, not here)
  org_type: OrgType | null
  sovereignty_status: SovereigntyStatus | null
  ein: string | null
  year_founded: number | null
  annual_budget_range: AnnualBudgetRange | null
  geographic_focus: string | null
  fiscal_sponsor: string | null
  contact_email: string | null
  website: string | null
  mission_statement: string | null

  // Capacity & Compliance
  staff_size: StaffSize | null
  has_grant_writer: HasGrantWriter | null
  sam_registered: SamRegistered | null
  sam_uei: string | null
  single_audit_status: SingleAuditStatus | null

  // Funding History
  has_prior_federal: boolean | null
  prior_federal_detail: string | null
  has_prior_foundation: boolean | null
  prior_foundation_detail: string | null

  // Focus & Populations
  focus_areas: string[] | null
  populations_served: string[] | null
}

export type OrganizationProfileUpdate = Partial<Omit<OrganizationProfile, 'id' | 'organization_id' | 'created_at'>>

/* ── Shared sub-types ───────────────────────────────────────── */
export interface GrantSection {
  title: string
  page_limit: number | null
}

export interface GrantAttachment {
  name: string
}

/* ── grants table (detail fields not in view) ───────────────── */
export interface GrantDetail {
  id: string
  sections: GrantSection[] | null
  attachments: GrantAttachment[] | null
  description: string | null
  source_url: string | null
}

/* ── grant_matches table ────────────────────────────────────── */
export interface FitBreakdown {
  eligibility: number  // 0-100
  mission:     number
  budget:      number
  capacity:    number
  deadline:    number
  geographic:  number
}

export interface GrantMatchRow {
  grant_id:        string
  organization_id: string
  fit_score:       number | null
  score_breakdown: FitBreakdown | null
  updated_at:      string
}

/* ── drafts table ───────────────────────────────────────────── */
export interface DraftRow {
  id: string
  grant_id: string
  section_title: string
  content: string | null
  version: number
  last_edited_by: string | null
  created_at: string
  updated_at: string
}

/* ── grants_full view (grants + pipeline_items + grant_matches) ─ */
export interface GrantsFullRow {
  // Core grant fields
  id: string
  name: string
  funder: string | null
  funder_type: string | null
  category: string | null
  is_renewal: boolean | null

  // Amount range
  amount_low: number | null
  amount_high: number | null
  awarded_amount: number | null

  // Timing
  deadline: string | null
  open_date: string | null
  effort_weeks: number | null

  // Eligibility
  eligibility_types: string[] | null

  // Pipeline (from pipeline_items — aliased in view to avoid conflict)
  pipeline_status: string
  notes: string | null

  // Match (from grant_matches)
  fit_score: number | null
}

export type PipelineStatus =
  | 'discovered'
  | 'researching'
  | 'writing'
  | 'submitted'
  | 'awarded'
  | 'declined'

/* ── snippets table ─────────────────────────────────────────── */
export type SnippetCategory =
  | 'Mission & Vision'
  | 'Community Description'
  | 'Organization Background'
  | 'Project Team'
  | 'Budget Justification'
  | 'Data & Outcomes'
  | 'Letters of Support'
  | 'General'

export const SNIPPET_CATEGORIES: SnippetCategory[] = [
  'Mission & Vision',
  'Community Description',
  'Organization Background',
  'Project Team',
  'Budget Justification',
  'Data & Outcomes',
  'Letters of Support',
  'General',
]

export interface SnippetRow {
  id: string
  organization_id: string
  title: string
  category: SnippetCategory
  content: string
  word_count: number
  times_used: number
  created_at: string
  updated_at: string
}

/* ── Database shape (for typed Supabase client) ─────────────── */
export interface Database {
  public: {
    Tables: {
      organization_profiles: {
        Row: OrganizationProfile
        Insert: Omit<OrganizationProfile, 'id' | 'created_at' | 'updated_at'>
        Update: OrganizationProfileUpdate
      }
    }
    Views: {
      grants_full: {
        Row: GrantsFullRow
      }
    }
    Functions: {
      create_organization_for_user: {
        Args: { org_name: string }
        Returns: void
      }
      add_grant_to_pipeline: {
        Args: {
          p_organization_id: string
          p_name: string
          p_funder?: string | null
          p_description?: string | null
          p_category?: string | null
          p_amount_low?: number | null
          p_amount_high?: number | null
          p_deadline?: string | null
          p_eligibility_types?: string[] | null
          p_is_renewal?: boolean
          p_effort_weeks?: number | null
          p_source_url?: string | null
          p_initial_status?: string
          p_sections?: { title: string; page_limit: number | null }[] | null
          p_attachments?: { name: string }[] | null
        }
        Returns: string  // new grant id
      }
    }
    Enums: Record<string, string>
  }
}
