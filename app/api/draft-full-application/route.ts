import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { grantId: string; overwrite?: boolean }
    const { grantId, overwrite = false } = body

    console.log('[draft-full-application] request body:', { grantId, overwrite })
    console.log('[draft-full-application] ANTHROPIC_API_KEY present:', !!process.env.ANTHROPIC_API_KEY)

    if (!grantId) {
      return NextResponse.json({ error: 'Missing grantId' }, { status: 400 })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[draft-full-application] user:', user.id)

    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()

    console.log('[draft-full-application] member:', { data: member, error: memberError?.message })

    if (!member?.organization_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }
    const orgId = member.organization_id

    // Fetch everything in parallel
    const [grantViewRes, grantDetailRes, profileRes, snippetsRes, existingDraftsRes] =
      await Promise.all([
        supabase
          .from('grants_full')
          .select(
            'name, funder, category, description, amount_low, amount_high, deadline, eligibility_types'
          )
          .eq('id', grantId)
          .single(),
        supabase
          .from('grants')
          .select('sections, review_criteria, requirements_summary, description')
          .eq('id', grantId)
          .single(),
        supabase
          .from('organization_profiles')
          .select(
            'org_type, mission_statement, geographic_focus, annual_budget_range, staff_size, focus_areas, populations_served'
          )
          .eq('organization_id', orgId)
          .single(),
        supabase
          .from('snippets')
          .select('title, category, content')
          .eq('organization_id', orgId)
          .order('times_used', { ascending: false })
          .limit(15),
        supabase
          .from('drafts')
          .select('section_title, content, version')
          .eq('grant_id', grantId),
      ])

    console.log('[draft-full-application] grants_full:', {
      data: grantViewRes.data,
      error: grantViewRes.error?.message,
    })
    console.log('[draft-full-application] grants detail:', {
      sections: (grantDetailRes.data as { sections?: unknown } | null)?.sections,
      error: grantDetailRes.error?.message,
    })
    console.log('[draft-full-application] org profile:', {
      data: profileRes.data,
      error: profileRes.error?.message,
    })
    console.log('[draft-full-application] snippets:', {
      count: snippetsRes.data?.length ?? 0,
      error: snippetsRes.error?.message,
    })
    console.log('[draft-full-application] existing drafts:', {
      count: existingDraftsRes.data?.length ?? 0,
      error: existingDraftsRes.error?.message,
    })

    const grant = grantViewRes.data
    const detail = grantDetailRes.data
    const profile = profileRes.data
    const snippets = snippetsRes.data ?? []
    const existingDrafts = existingDraftsRes.data ?? []

    if (!grant) {
      const msg = `Grant not found — grantViewRes error: ${grantViewRes.error?.message ?? 'no data'}`
      console.error('[draft-full-application]', msg)
      return NextResponse.json({ error: msg }, { status: 404 })
    }

    const sections = (
      (detail?.sections ?? []) as { title: string; page_limit: number | null }[]
    )

    console.log('[draft-full-application] sections:', sections)

    if (sections.length === 0) {
      return NextResponse.json(
        { error: 'This grant has no application sections defined. Add sections first.' },
        { status: 400 }
      )
    }

    if (!profile?.mission_statement) {
      return NextResponse.json(
        { error: 'Complete your organization profile for better results' },
        { status: 400 }
      )
    }

    // Map existing drafts
    const existingMap = new Map(
      existingDrafts.map((d) => [
        d.section_title,
        { content: d.content as string | null, version: (d.version as number) ?? 0 },
      ])
    )

    const sectionsToDraft = overwrite
      ? sections
      : sections.filter((s) => !existingMap.get(s.title)?.content?.trim())

    if (sectionsToDraft.length === 0) {
      return NextResponse.json(
        {
          error:
            'All sections already have content. Enable "Overwrite existing drafts" to regenerate.',
        },
        { status: 400 }
      )
    }

    // Build context strings
    const orgContext = [
      profile.mission_statement && `Mission: ${profile.mission_statement}`,
      profile.org_type && `Organization type: ${profile.org_type}`,
      profile.geographic_focus && `Geographic focus: ${profile.geographic_focus}`,
      profile.annual_budget_range && `Annual budget: ${profile.annual_budget_range}`,
      profile.staff_size && `Staff size: ${profile.staff_size}`,
      profile.focus_areas?.length && `Focus areas: ${profile.focus_areas.join(', ')}`,
      profile.populations_served?.length &&
        `Populations served: ${profile.populations_served.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n')

    const grantContext = [
      `Grant: ${grant.name}`,
      grant.funder && `Funder: ${grant.funder}`,
      grant.category && `Category: ${grant.category}`,
      (detail?.description || grant.description) &&
        `Description: ${detail?.description || grant.description}`,
      grant.amount_low && grant.amount_high
        ? `Award amount: $${grant.amount_low.toLocaleString()}–$${grant.amount_high.toLocaleString()}`
        : grant.amount_high
          ? `Award amount: up to $${grant.amount_high.toLocaleString()}`
          : null,
      grant.deadline && `Deadline: ${grant.deadline}`,
      grant.eligibility_types?.length &&
        `Eligibility: ${grant.eligibility_types.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n')

    const reviewCriteria = (
      (detail?.review_criteria ?? []) as { criterion: string; weight?: number }[]
    )
    const criteriaContext = reviewCriteria.length
      ? `Review Criteria:\n${reviewCriteria.map((c) => `- ${c.criterion}${c.weight ? ` (${c.weight}%)` : ''}`).join('\n')}`
      : ''

    const reqSummary = (detail as { requirements_summary?: string } | null)
      ?.requirements_summary
      ? `Requirements Summary:\n${(detail as { requirements_summary: string }).requirements_summary}`
      : ''

    const snippetContext = snippets.length
      ? `Saved Snippets (incorporate where relevant):\n${snippets.map((s) => `### ${s.title} (${s.category})\n${s.content}`).join('\n\n')}`
      : ''

    const sectionsSpec = sectionsToDraft
      .map(
        (s) =>
          `- "${s.title}"${s.page_limit ? ` (${s.page_limit}-page limit, ~${s.page_limit * 250} words max)` : ''}`
      )
      .join('\n')

    const systemPrompt = `You are an expert grant writer for Indigenous-led and mission-driven organizations. You are writing a complete grant application. Write each section to be compelling, specific, and aligned with the funder's review criteria.

Rules:
- Write in first person plural (we/our)
- Be specific to this organization — use their actual mission, programs, geography, and community details
- Reference the funder's priorities and review criteria where relevant
- Stay within the page limit for each section
- Use a professional but warm tone — not corporate jargon
- Incorporate relevant content from the organization's saved snippets naturally
- Each section should flow logically and reference other sections where appropriate
- Do not use markdown formatting — write in plain prose paragraphs`

    const userMessage = `Write a complete grant application for the following grant:

${grantContext}

${criteriaContext}

${reqSummary}

Organization Profile:
${orgContext}

${snippetContext}

Write the following sections:
${sectionsSpec}

Return your response as a JSON object with this exact structure:
{
  "sections": [
    { "title": "<exact section title>", "content": "<section text as plain prose paragraphs>" }
  ]
}

Match the section titles exactly as listed above. Do not include any text outside the JSON object.`

    console.log('[draft-full-application] sending to Anthropic, sections to draft:', sectionsToDraft.map(s => s.title))
    console.log('[draft-full-application] user message length:', userMessage.length)

    // Call Claude with a 60-second timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

    let message: Anthropic.Message
    try {
      message = await anthropic.messages.create(
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        },
        { signal: controller.signal }
      )
    } finally {
      clearTimeout(timeoutId)
    }

    console.log('[draft-full-application] Anthropic response:', {
      stop_reason: message.stop_reason,
      content_types: message.content.map((b) => b.type),
      usage: message.usage,
    })

    const textBlock = message.content.find((b) => b.type === 'text')
    const rawText = textBlock?.type === 'text' ? textBlock.text.trim() : ''

    console.log('[draft-full-application] raw response (first 500 chars):', rawText.slice(0, 500))

    // Parse JSON — strip markdown fences if present
    let parsed: { sections: { title: string; content: string }[] }
    try {
      const clean = rawText
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '')
        .trim()
      console.log('[draft-full-application] cleaned for parse (first 200):', clean.slice(0, 200))
      parsed = JSON.parse(clean)
    } catch (parseErr) {
      const msg = `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}. Raw response starts with: ${rawText.slice(0, 200)}`
      console.error('[draft-full-application]', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    if (!Array.isArray(parsed?.sections)) {
      const msg = `Response missing sections array. Got: ${JSON.stringify(parsed).slice(0, 200)}`
      console.error('[draft-full-application]', msg)
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    console.log('[draft-full-application] parsed sections:', parsed.sections.map(s => ({ title: s.title, words: s.content?.split(/\s+/).length ?? 0 })))

    // Save sections to drafts table
    const upsertRows = parsed.sections
      .filter((s) => s.title && s.content)
      .map((s) => ({
        grant_id: grantId,
        section_title: s.title,
        section_index: sections.findIndex((sec) => sec.title === s.title),
        content: s.content,
        version: (existingMap.get(s.title)?.version ?? 0) + 1,
        organization_id: orgId,
        last_edited_by: user.id,
      }))

    if (upsertRows.length > 0) {
      const { error: upsertErr } = await supabase
        .from('drafts')
        .upsert(upsertRows, { onConflict: 'grant_id,section_title' })

      if (upsertErr) {
        console.error('[draft-full-application] upsert error:', upsertErr.message)
      } else {
        console.log('[draft-full-application] upserted', upsertRows.length, 'rows')
      }
    }

    return NextResponse.json({
      sections: parsed.sections.map((s) => ({
        title: s.title,
        content: s.content,
        wordCount: s.content.trim() ? s.content.trim().split(/\s+/).length : 0,
      })),
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      const msg = 'Request timed out after 60 seconds. Try again or draft sections individually.'
      console.error('[draft-full-application] timeout')
      return NextResponse.json({ error: msg }, { status: 504 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[draft-full-application] unhandled error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
