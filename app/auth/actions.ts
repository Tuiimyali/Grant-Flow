'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AuthState = {
  error?: string
  message?: string
}

function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Wrong email or password.'
  if (msg.includes('Email not confirmed')) return 'Please confirm your email before signing in.'
  if (msg.includes('User already registered')) return 'An account with this email already exists.'
  if (msg.includes('Password should be at least')) return 'Password must be at least 6 characters.'
  if (msg.includes('Unable to validate email')) return 'Please enter a valid email address.'
  return msg
}

export async function signIn(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: friendlyError(error.message) }

  redirect('/dashboard')
}

export async function signUp(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = formData.get('orgName') as string

  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: friendlyError(error.message) }

  // Email confirmation required — org will be created after first sign-in
  if (!data.session) {
    return {
      message:
        'Check your email to confirm your account. Once confirmed, sign in and your workspace will be created automatically.',
    }
  }

  // Immediately active session — create the organisation now
  const { error: rpcError } = await supabase.rpc('create_organization_for_user', {
    org_name: orgName,
  })

  if (rpcError) return { error: rpcError.message }

  redirect('/dashboard')
}
