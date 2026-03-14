'use client'

import { useEffect } from 'react'
import PageHeader from '@/components/page-header'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error('[dashboard]', error) }, [error])

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Something went wrong" />
      <div className="flex flex-col items-center justify-center flex-1 py-32 text-center px-6">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73
                0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898
                0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <p className="text-base font-semibold text-slate-700 mb-1">Failed to load dashboard</p>
        <p className="text-sm text-slate-400 mb-6 max-w-xs">{error.message}</p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--gold)' }}
        >
          Try again
        </button>
      </div>
    </>
  )
}
