'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import DeadlineAlertsBell from '@/components/deadline-alerts-bell'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Grants', href: '/grants' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Drafts', href: '/drafts' },
  { label: 'Snippets', href: '/snippets' },
  { label: 'Organization', href: '/organization' },
  { label: 'Settings', href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  return (
    <aside
      style={{
        width: '180px',
        flexShrink: 0,
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          paddingInline: '20px',
          borderBottom: '1px solid var(--sidebar-border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '0.01em',
          }}
        >
          Fieldwork
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, paddingBlock: '12px' }}>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '34px',
                paddingInline: '20px',
                fontSize: '13px',
                fontWeight: active ? 500 : 400,
                color: active ? 'var(--gold)' : 'var(--text-dim)',
                borderLeft: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
                textDecoration: 'none',
                transition: 'color 140ms ease, background-color 140ms ease',
              }}
              onMouseEnter={
                !active
                  ? (e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--text-secondary)'
                      el.style.backgroundColor = 'var(--sidebar-item-hover)'
                    }
                  : undefined
              }
              onMouseLeave={
                !active
                  ? (e) => {
                      const el = e.currentTarget as HTMLElement
                      el.style.color = 'var(--text-dim)'
                      el.style.backgroundColor = ''
                    }
                  : undefined
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div
        style={{
          paddingBlock: '12px',
          borderTop: '1px solid var(--sidebar-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingInline: '8px',
        }}
      >
        <DeadlineAlertsBell collapsed={false} />

        <button
          onClick={handleSignOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '34px',
            paddingInline: '12px',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--text-dim)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            borderRadius: '6px',
            transition: 'color 140ms ease',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
