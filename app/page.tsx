import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing-page'

export const metadata = {
  title: 'Fieldwork — The grant tool that gets out of your way.',
  description:
    'Find grants. Score fit. Draft with AI. Track your pipeline.',
}

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/dashboard')

  return <LandingPage />
}
