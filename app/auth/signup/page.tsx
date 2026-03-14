'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '../actions'

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, {})

  if (state.message) {
    return (
      <div className="text-center py-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
        <p className="text-sm text-gray-500">{state.message}</p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-block text-sm font-medium text-blue-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Create your workspace</h2>
      <p className="text-sm text-gray-500 mb-6">Set up your organisation to get started.</p>

      <form action={formAction} className="space-y-4">
        {state.error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <div>
          <label htmlFor="orgName" className="block text-sm font-medium text-gray-700 mb-1">
            Organisation name
          </label>
          <input
            id="orgName"
            name="orgName"
            type="text"
            required
            autoComplete="organization"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Acme Water Authority"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
          />
          <p className="mt-1 text-xs text-gray-400">Minimum 6 characters</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Creating workspace…' : 'Create workspace'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/auth/signin" className="font-medium text-blue-600 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  )
}
