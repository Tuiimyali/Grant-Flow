import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { grantId, sectionTitle, pageLimit, mode, existingContent } = await req.json() as {
      grantId: string
      sectionTitle: string
      pageLimit: number | null
      mode: 'generate' | 'improve'
      existingContent?: string
    }

    if (!grantId || !sectionTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Get org membership + profile in parallel with grant details
    const [memberResult, grantResult] = await Promise.all([
      supabase
        .from('organization_members')
        .select('organization_id')
        .single(),
      supabase
        .from('grants_full')
        .select('name, funder, funder_type, category, description, amount_low, amount_high, deadline, eligibility_types')
        .eq('id', grantId)
        .single(),
    ])

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id
    const grant = grantResult.data

    if (!orgId || !grant) {
      return NextResponse.json({ error: 'Unable to load context' }, { status: 400 })
    }

    // Load org profile + snippets in parallel
    const [profileResult, snippetsResult] = await Promise.all([
      supabase
        .from('organization_profiles')
        .select('org_type, mission_statement, geographic_focus, annual_budget_range, staff_size, focus_areas, populations_served')
        .eq('organization_id', orgId)
        .single(),
      supabase
        .from('snippets')
        .select('title, category, content')
        .eq('organization_id', orgId)
        .order('times_used', { ascending: false })
        .limit(10),
    ])

    const profile = profileResult.data
    const snippets = snippetsResult.data ?? []

    // Build system context
    const orgContext = profile ? [
      profile.mission_statement && `Mission: ${profile.mission_statement}`,
      profile.org_type          && `Organization type: ${profile.org_type}`,
      profile.geographic_focus  && `Geographic focus: ${profile.geographic_focus}`,
      profile.annual_budget_range && `Annual budget: ${profile.annual_budget_range}`,
      profile.staff_size        && `Staff size: ${profile.staff_size}`,
      profile.focus_areas?.length && `Focus areas: ${profile.focus_areas.join(', ')}`,
      profile.populations_served?.length && `Populations served: ${profile.populations_served.join(', ')}`,
    ].filter(Boolean).join('\n') : 'No organization profile available.'

    const grantContext = [
      `Grant: ${grant.name}`,
      grant.funder       && `Funder: ${grant.funder}`,
      grant.funder_type  && `Funder type: ${grant.funder_type}`,
      grant.category     && `Category: ${grant.category}`,
      grant.description  && `Description: ${grant.description}`,
      grant.amount_low   && grant.amount_high
        ? `Award amount: $${grant.amount_low.toLocaleString()}–$${grant.amount_high.toLocaleString()}`
        : grant.amount_high
        ? `Award amount: up to $${grant.amount_high.toLocaleString()}`
        : null,
      grant.deadline     && `Deadline: ${grant.deadline}`,
      grant.eligibility_types?.length && `Eligibility: ${grant.eligibility_types.join(', ')}`,
    ].filter(Boolean).join('\n')

    const snippetContext = snippets.length > 0
      ? snippets.map(s => `### ${s.title} (${s.category})\n${s.content}`).join('\n\n')
      : 'No snippets available.'

    const pageLimitNote = pageLimit
      ? `This section has a ${pageLimit}-page limit (approximately ${pageLimit * 250} words).`
      : 'There is no page limit for this section.'

    const systemPrompt = `You are an expert grant writer helping a nonprofit organization write compelling grant applications.

## Organization Profile
${orgContext}

## Reusable Content Snippets
Use the following organization-specific content snippets as reference material when relevant:
${snippetContext}

## Instructions
- Write in a professional, persuasive grant writing voice
- Be specific, concrete, and outcome-focused
- Align the content with the funder's priorities and grant category
- ${pageLimitNote}
- Output only the section text — no headings, no meta-commentary, no preamble`

    const userMessage = mode === 'generate'
      ? `Write the "${sectionTitle}" section for the following grant application:\n\n${grantContext}`
      : `Improve the following "${sectionTitle}" section for this grant application. Make it more compelling, specific, and aligned with the funder's priorities. Preserve the core content and intent.\n\nGrant context:\n${grantContext}\n\nCurrent draft:\n${existingContent}`

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    const content = textBlock?.type === 'text' ? textBlock.text.trim() : ''

    return NextResponse.json({ content })
  } catch (err) {
    console.error('[draft-assist] error:', err)
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
  }
}
