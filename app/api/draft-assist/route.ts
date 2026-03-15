import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      grantId: string
      sectionTitle: string
      pageLimit: number | null
      mode: 'generate' | 'improve'
      existingContent?: string
    }
    const { grantId, sectionTitle, pageLimit, mode, existingContent } = body

    console.log('[draft-assist] request body:', { grantId, sectionTitle, pageLimit, mode })
    console.log('[draft-assist] ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY)

    if (!grantId || !sectionTitle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Step 1: org membership
    const memberResult = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()

    console.log('[draft-assist] organization_members result:', {
      data: memberResult.data,
      error: memberResult.error?.message,
      status: memberResult.status,
    })

    // Step 2: grant from view
    const grantResult = await supabase
      .from('grants_full')
      .select('name, funder, category, description, amount_low, amount_high, deadline, eligibility_types')
      .eq('id', grantId)
      .single()

    console.log('[draft-assist] grants_full result:', {
      data: grantResult.data,
      error: grantResult.error?.message,
      status: grantResult.status,
    })

    const orgId = (memberResult.data as { organization_id: string } | null)?.organization_id
    const grant = grantResult.data

    if (!orgId) {
      console.error('[draft-assist] no orgId — memberResult:', memberResult)
      return NextResponse.json({ error: 'Unable to load org context', detail: memberResult.error?.message }, { status: 400 })
    }
    if (!grant) {
      console.error('[draft-assist] no grant — grantResult:', grantResult)
      return NextResponse.json({ error: 'Unable to load grant context', detail: grantResult.error?.message }, { status: 400 })
    }

    // Step 3: org profile + snippets
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

    console.log('[draft-assist] organization_profiles result:', {
      data: profileResult.data,
      error: profileResult.error?.message,
      status: profileResult.status,
    })
    console.log('[draft-assist] snippets result:', {
      count: snippetsResult.data?.length,
      error: snippetsResult.error?.message,
    })

    const profile = profileResult.data
    const snippets = snippetsResult.data ?? []

    // Build context
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
      grant.funder    && `Funder: ${grant.funder}`,
      grant.category  && `Category: ${grant.category}`,
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

    console.log('[draft-assist] calling Anthropic API...')

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2000,
      thinking: { type: 'adaptive' },
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    console.log('[draft-assist] Anthropic response stop_reason:', message.stop_reason,
      'content blocks:', message.content.map(b => b.type))

    const textBlock = message.content.find(b => b.type === 'text')
    const content = textBlock?.type === 'text' ? textBlock.text.trim() : ''

    return NextResponse.json({ content })
  } catch (err) {
    console.error('[draft-assist] unhandled error:', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Failed to generate draft', detail: message }, { status: 500 })
  }
}
