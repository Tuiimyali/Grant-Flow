import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a grant research assistant for Indigenous-led and mission-driven organizations. The user will describe what kind of funding they need.

You are a knowledgeable advisor — NOT a live grant database. You recommend funding directions based on your training knowledge. Be honest that deadlines and availability change.

You will do two things:

1. EXISTING MATCHES: Look through the user's current grants and rank which ones best match their search query. Return the grant IDs sorted by relevance.

2. NEW DIRECTIONS: Suggest 5-10 real grant programs or funding categories worth investigating. For each provide:
- name: the grant/funding program name
- funder: the funding organization name
- funder_type: one of 'foundation', 'government', 'corporate', 'community', 'impact_investor'
- description: 2-3 sentences about what it funds and why it's relevant
- estimated_amount: typical funding range as a string (e.g. "$25K – $200K")
- typical_deadline: when applications usually open/close (e.g. "Rolling" or "Annual cycle, typically spring")
- eligibility: who can apply
- why_match: one sentence explaining why this matches their needs
- flexibility: one of 'unrestricted', 'partially_restricted', 'restricted'
- how_to_find: specific, actionable instructions for how to find and apply — e.g. "Visit kresge.org and look under Grants > Environment & Climate" or "Search grants.gov for CFDA 66.461" or "Contact your regional EPA office directly — this program requires a letter of inquiry first"

Return as JSON: { existing_matches: [grant_id, ...], suggestions: [{name, funder, funder_type, description, estimated_amount, typical_deadline, eligibility, why_match, flexibility, how_to_find}] }
Return ONLY valid JSON, no markdown fences.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: string; organizationId?: string }
    const { query, organizationId } = body

    if (!query?.trim()) {
      return NextResponse.json(
        { error: "Describe what kind of funding you're looking for" },
        { status: 400 },
      )
    }

    const supabase = await createClient()

    // Fetch org profile
    let orgProfile: Record<string, unknown> | null = null
    if (organizationId) {
      const { data: profile } = await supabase
        .from('organization_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .single()
      orgProfile = profile as Record<string, unknown> | null
    }

    // Fetch all grants (RLS handles org scoping)
    const { data: grants } = await supabase
      .from('grants_full')
      .select('id, name, funder, category, description')

    type GrantRow = { id: string; name: string; funder: string | null; category: string | null; description: string | null }

    const grantsList = (grants ?? [] as GrantRow[]).map((g: GrantRow) =>
      `- [${g.id}] ${g.name}${g.funder ? ` | ${g.funder}` : ''}${g.category ? ` | ${g.category}` : ''}${g.description ? ` | ${g.description.slice(0, 150)}` : ''}`
    ).join('\n')

    const profileText = orgProfile ? `\n\nOrganization profile:
- Mission: ${orgProfile.mission_statement ?? 'Not specified'}
- Type: ${orgProfile.org_type ?? 'Not specified'}
- Focus areas: ${(orgProfile.focus_areas as string[] | null ?? []).join(', ') || 'Not specified'}
- Geographic focus: ${orgProfile.geographic_focus ?? 'Not specified'}
- Sovereignty status: ${orgProfile.sovereignty_status ?? 'Not specified'}
- Annual budget: ${orgProfile.annual_budget_range ?? 'Not specified'}
- Populations served: ${(orgProfile.populations_served as string[] | null ?? []).join(', ') || 'Not specified'}` : ''

    const userMessage = `Search query: "${query.trim()}"${profileText}

Existing grants in pipeline (${(grants ?? []).length} total):
${grantsList || '(none yet)'}

Recommend real funding directions matching this query${orgProfile ? ' and organization profile' : ''}. Return results as JSON.`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()

    // Strip any markdown fences Claude may still include
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')

    let result: { existing_matches: string[]; suggestions: unknown[] }
    try {
      result = JSON.parse(jsonStr)
    } catch {
      console.error('[grant-search] JSON parse failed. raw:', raw.slice(0, 500))
      return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 422 })
    }

    return NextResponse.json({ data: result })
  } catch (err) {
    console.error('[grant-search] unhandled error:', err)
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}
