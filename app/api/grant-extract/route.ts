import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import * as cheerio from 'cheerio'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a grant research assistant. Extract all grant information from this webpage and return it as JSON. Extract:
- name: the grant program name
- funder: the funding agency/organization
- description: a 2-3 paragraph summary of what the grant funds, its purpose, and who it serves
- category: one of Education, Environment, Natural Resources, Community Development, Arts & Culture, Health, Infrastructure, Other
- amount_low: minimum funding amount as integer (0 if not specified)
- amount_high: maximum funding amount as integer (0 if not specified)
- deadline: in YYYY-MM-DD format (null if not specified)
- eligibility_types: array of eligible org types from [tribal, 501c3, faith_based, government, other]
- is_renewal: boolean
- effort_weeks: estimated weeks to write the application as integer
- sections: array of {title: string, limit: string} for each required application section
- attachments: array of strings for required forms and documents
- review_criteria: array of {criterion: string, weight: string, description: string} for how applications are scored
- requirements_summary: a plain text summary of what the funder is looking for, key priorities, and tips for a strong application
Return ONLY valid JSON, no markdown formatting.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { url?: string }
    const { url } = body

    if (!url || !url.startsWith('http')) {
      return NextResponse.json({ error: 'Please enter a valid URL' }, { status: 400 })
    }

    // Fetch the page with a 30s timeout
    let html: string
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrantBot/1.0)' },
      })
      clearTimeout(timeout)
      if (!response.ok) {
        return NextResponse.json(
          { error: 'Unable to read that page. Try pasting the grant details manually.' },
          { status: 422 },
        )
      }
      html = await response.text()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return NextResponse.json({ error: 'The page took too long to load.' }, { status: 408 })
      }
      return NextResponse.json(
        { error: 'Unable to read that page. Try pasting the grant details manually.' },
        { status: 422 },
      )
    }

    // Strip HTML to plain text
    const $ = cheerio.load(html)
    $('script, style, nav, header, footer, aside, [role="navigation"], [role="banner"], [role="complementary"]').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 20_000)

    if (!text || text.length < 100) {
      return NextResponse.json(
        { error: 'Unable to read that page. Try pasting the grant details manually.' },
        { status: 422 },
      )
    }

    // Call Anthropic
    let extracted: Record<string, unknown>
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Extract grant information from this webpage content:\n\n${text}` }],
      })

      const textBlock = message.content.find(b => b.type === 'text')
      const raw = textBlock?.type === 'text' ? textBlock.text.trim() : ''

      // Strip markdown fences if present
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
      extracted = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { error: 'Could not extract grant details. Please fill in manually.' },
        { status: 422 },
      )
    }

    return NextResponse.json({ data: extracted })
  } catch (err) {
    console.error('[grant-extract] unhandled error:', err)
    return NextResponse.json(
      { error: 'Could not extract grant details. Please fill in manually.' },
      { status: 500 },
    )
  }
}
