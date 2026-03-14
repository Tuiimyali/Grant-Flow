'use client'

import { useEffect, useState } from 'react'
import { subscribeToasts } from '@/lib/toast'
import type { ToastItem } from '@/lib/toast'

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm font-medium shadow-lg
            transition-all duration-300
            ${t.type === 'success' ? 'bg-emerald-600 text-white' :
              t.type === 'error'   ? 'bg-red-600 text-white'     :
                                     'bg-slate-800 text-white'}`}
        >
          {t.type === 'success' && (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {t.type === 'info' && (
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  )
}
