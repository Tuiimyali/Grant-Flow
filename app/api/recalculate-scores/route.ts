import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recalculateOrgScores } from '@/lib/utils/recalculate-scores'

export async function POST() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .single()

  if (memberError || !member?.organization_id) {
    return NextResponse.json({ error: 'No organization found' }, { status: 404 })
  }

  await recalculateOrgScores(supabase, member.organization_id)

  return NextResponse.json({ ok: true })
}
