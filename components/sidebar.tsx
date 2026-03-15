'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Nav definition ─────────────────────────────────────── */
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Grants',
    href: '/grants',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Pipeline',
    href: '/pipeline',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path fillRule="evenodd" d="M1 2a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2.5a1 1 0 0 1-.293.707l-5.414 5.414A1 1 0 0 0 13 11v5a1 1 0 0 1-.553.894l-4 2A1 1 0 0 1 7 18v-7a1 1 0 0 0-.293-.707L1.293 4.707A1 1 0 0 1 1 4V2Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    label: 'Drafts',
    href: '/drafts',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" />
      </svg>
    ),
  },
  {
    label: 'Snippets',
    href: '/snippets',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path d="M9 4.804A7.968 7.968 0 0 0 5.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 0 1 5.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0 1 14.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0 0 14.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 1 1-2 0V4.804Z" />
      </svg>
    ),
  },
  {
    label: 'Organization',
    href: '/organization',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h10.5a.75.75 0 0 1 0 1.5H12v13.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75V3.5h-.5A.75.75 0 0 1 1 2.75ZM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM4 9.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Z" clipRule="evenodd" />
        <path d="M13 2.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-5Z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
        <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
      </svg>
    ),
  },
]

/* ── Component ──────────────────────────────────────────── */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  return (
    <aside
      style={{ backgroundColor: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      className={`
        relative flex flex-col shrink-0 min-h-screen border-r
        transition-[width] duration-200 ease-in-out
        ${collapsed ? 'w-[72px]' : 'w-64'}
      `}
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <div
        style={{ borderColor: 'var(--sidebar-border)' }}
        className="flex items-center h-16 border-b overflow-hidden px-4 gap-3"
      >
        {/* Water drop mark */}
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500 shrink-0">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white" aria-hidden="true">
            <path d="M12 2C12 2 4 11.5 4 16a8 8 0 0 0 16 0C20 11.5 12 2 12 2Z" />
          </svg>
        </div>
        {/* Wordmark — hidden when collapsed */}
        <div
          className={`flex flex-col leading-tight overflow-hidden transition-[opacity,width] duration-200 ${
            collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'
          }`}
        >
          <span className="text-sm font-semibold text-white whitespace-nowrap">Grant Intelligence</span>
          <span className="text-xs text-slate-400 whitespace-nowrap">Workspace</span>
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={
                active
                  ? {
                      backgroundColor: 'var(--gold-bg)',
                      borderColor: 'var(--gold-border)',
                      color: 'var(--gold)',
                    }
                  : undefined
              }
              className={`
                flex items-center gap-3 rounded-lg text-sm font-medium
                border transition-colors duration-150
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
                ${
                  active
                    ? 'border-current'
                    : 'border-transparent text-slate-400 hover:text-white'
                }
              `}
              onMouseEnter={
                !active
                  ? (e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--sidebar-item-hover)'
                    }
                  : undefined
              }
              onMouseLeave={
                !active
                  ? (e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
                    }
                  : undefined
              }
            >
              {item.icon}
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Bottom actions ────────────────────────────────── */}
      <div
        style={{ borderColor: 'var(--sidebar-border)' }}
        className="px-2 py-3 border-t space-y-0.5"
      >
        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title={collapsed ? 'Sign out' : undefined}
          className={`
            w-full flex items-center gap-3 rounded-lg text-sm font-medium
            text-slate-400 hover:text-white transition-colors duration-150
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
          `}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor =
              'var(--sidebar-item-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px] shrink-0">
            <path
              fillRule="evenodd"
              d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z"
              clipRule="evenodd"
            />
            <path
              fillRule="evenodd"
              d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.028a.75.75 0 1 0-1.004-1.117l-2.5 2.25a.75.75 0 0 0 0 1.117l2.5 2.25a.75.75 0 1 0 1.004-1.117L8.704 10.75H18.25A.75.75 0 0 0 19 10Z"
              clipRule="evenodd"
            />
          </svg>
          {!collapsed && 'Sign out'}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`
            w-full flex items-center gap-3 rounded-lg text-sm font-medium
            text-slate-500 hover:text-slate-300 transition-colors duration-150
            ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
          `}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor =
              'var(--sidebar-item-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
          }}
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
              clipRule="evenodd"
            />
          </svg>
          {!collapsed && 'Collapse'}
        </button>
      </div>
    </aside>
  )
}
