import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { ids } = (await req.json()) as { ids?: string[] }

  if (!ids?.length) {
    return NextResponse.json(
      { error: 'No grant IDs provided' },
      { status: 400 }
    )
  }

  // Verify the user is authenticated
  const authClient = await createServerClient()
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the user's org owns these grants (pipeline_items is the org-scoped link)
  const { data: owned } = await authClient
    .from('pipeline_items')
    .select('grant_id')
    .in('grant_id', ids)

  const ownedIds = (owned ?? []).map((r: { grant_id: string }) => r.grant_id)
  if (!ownedIds.length) {
    return NextResponse.json(
      { error: 'No matching grants found for your organization' },
      { status: 404 }
    )
  }

  // Use service role key to bypass RLS for the actual deletes
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          'Server is missing SUPABASE_SERVICE_ROLE_KEY — add it to .env.local',
      },
      { status: 500 }
    )
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  const { error: matchErr } = await admin
    .from('grant_matches')
    .delete()
    .in('grant_id', ownedIds)
  if (matchErr) console.error('[delete] grant_matches:', matchErr.message)

  const { error: pipeErr } = await admin
    .from('pipeline_items')
    .delete()
    .in('grant_id', ownedIds)
  if (pipeErr) console.error('[delete] pipeline_items:', pipeErr.message)

  const { error: grantsErr } = await admin
    .from('grants')
    .delete()
    .in('id', ownedIds)
  if (grantsErr) console.error('[delete] grants:', grantsErr.message)

  if (grantsErr || pipeErr) {
    return NextResponse.json(
      { error: 'Delete partially failed — check server logs' },
      { status: 500 }
    )
  }

  return NextResponse.json({ deleted: ownedIds.length })
}
