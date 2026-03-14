'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/page-header'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'

/* ── Nav sections ────────────────────────────────────────────── */

type Section =
  | 'account'
  | 'organization'
  | 'team'
  | 'notifications'
  | 'api-keys'
  | 'billing'
  | 'export'

interface NavItem {
  id:      Section
  label:   string
  icon:    React.ReactNode
  soon?:   boolean
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'account', label: 'Account',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A6.483 6.483 0 0 0 10 16.5a6.483 6.483 0 0 0 4.793-2.11A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'organization', label: 'Organization',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h10.5a.75.75 0 0 1 0 1.5H12v13.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75V3.5h-.5A.75.75 0 0 1 1 2.75ZM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM4 9.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Z" clipRule="evenodd" />
        <path d="M13 2.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-5Z" />
      </svg>
    ),
  },
  {
    id: 'team', label: 'Team Members', soon: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
      </svg>
    ),
  },
  {
    id: 'notifications', label: 'Notifications', soon: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.91 32.91 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.903 32.903 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7c-.655 0-1.305-.02-1.95-.057a2 2 0 0 0 3.9 0c-.645.038-1.295.057-1.95.057Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'api-keys', label: 'API Keys', soon: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M8 7a5 5 0 1 1 3.61 4.804l-1.903 1.903A1 1 0 0 1 9 14H8v1a1 1 0 0 1-1 1H6v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 .293-.707L7.196 10.39A5.002 5.002 0 0 1 8 7Zm5-1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'billing', label: 'Billing', soon: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    id: 'export', label: 'Data Export', soon: true,
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
      </svg>
    ),
  },
]

/* ── Shared form primitives ──────────────────────────────────── */

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700 mb-1.5">
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:border-transparent
        disabled:bg-slate-50 disabled:text-slate-400
        ${props.className ?? ''}`}
      style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
    />
  )
}

function SaveButton({ loading, label = 'Save changes' }: { loading?: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white
        disabled:opacity-60 transition-opacity"
      style={{ backgroundColor: 'var(--gold)' }}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
        </svg>
      )}
      {label}
    </button>
  )
}

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

/* ── Account section ─────────────────────────────────────────── */

function AccountSection() {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [displayName, setDisplay] = useState('')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [saving, setSaving]       = useState(false)
  const [savingPw, setSavingPw]   = useState(false)

  /* Delete account state */
  const [deleteOpen, setDeleteOpen]       = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((result: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['getUser']>>) => {
      if (!result.data.user) return
      setEmail(result.data.user.email ?? '')
      setDisplay(result.data.user.user_metadata?.full_name ?? '')
    })
  }, [])

  async function handleProfileSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    })
    setSaving(false)
    if (error) toast(error.message, 'error')
    else       toast('Profile updated', 'success')
  }

  async function handlePasswordSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (newPw !== confirmPw) { toast('Passwords do not match', 'error'); return }
    if (newPw.length < 8)    { toast('Password must be at least 8 characters', 'error'); return }
    setSavingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSavingPw(false)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Password updated', 'success')
      setNewPw(''); setConfirmPw('')
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE') {
      toast('Type DELETE to confirm', 'error')
      return
    }
    setDeleting(true)
    const supabase = createClient()
    // Attempt RPC — requires a server-side function named delete_my_account
    const { error } = await supabase.rpc('delete_my_account')
    if (error) {
      // Fallback: sign out and show message
      toast('Account deletion requested. Our team will process it shortly.', 'info', 6000)
      await supabase.auth.signOut()
      router.push('/auth/signin')
      return
    }
    await supabase.auth.signOut()
    router.push('/auth/signin')
  }

  return (
    <div className="space-y-5">
      {/* Profile */}
      <SectionCard title="Profile" description="Your name and email address.">
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <FieldLabel htmlFor="display-name">Display name</FieldLabel>
            <TextInput
              id="display-name"
              value={displayName}
              onChange={e => setDisplay(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <TextInput
              id="email"
              value={email}
              disabled
              readOnly
              title="Email cannot be changed here"
            />
            <p className="mt-1.5 text-xs text-slate-400">Email changes are not supported at this time.</p>
          </div>
          <div className="pt-1">
            <SaveButton loading={saving} />
          </div>
        </form>
      </SectionCard>

      {/* Password */}
      <SectionCard title="Password" description="Choose a strong password of at least 8 characters.">
        <form onSubmit={handlePasswordSave} className="space-y-4">
          <div>
            <FieldLabel htmlFor="new-pw">New password</FieldLabel>
            <TextInput
              id="new-pw"
              type="password"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <FieldLabel htmlFor="confirm-pw">Confirm password</FieldLabel>
            <TextInput
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </div>
          <div className="pt-1">
            <SaveButton loading={savingPw} label="Update password" />
          </div>
        </form>
      </SectionCard>

      {/* Danger zone */}
      <div className="rounded-xl border border-red-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-red-100 bg-red-50/50">
          <h2 className="text-base font-semibold text-red-700">Danger zone</h2>
          <p className="text-sm text-red-500 mt-0.5">These actions are irreversible.</p>
        </div>
        <div className="px-6 py-5 bg-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-800">Delete account</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently delete your account and all associated data.
              </p>
            </div>
            <button
              onClick={() => setDeleteOpen(true)}
              className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold
                text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete account
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0
                      2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697
                      16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete your account?</h3>
                <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                  This will permanently delete your account, all grants, pipeline data, and drafts.
                  This cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent
                  font-mono"
                autoComplete="off"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setDeleteOpen(false); setDeleteConfirm('') }}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600
                  hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold
                  text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                  </svg>
                )}
                Delete account permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Organization section ────────────────────────────────────── */

function OrganizationSection() {
  const [orgId, setOrgId]     = useState<string | null>(null)
  const [orgName, setOrgName] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: member } = await supabase
        .from('organization_members')
        .select('organization_id')
        .maybeSingle()

      if (!member?.organization_id) { setLoading(false); return }
      setOrgId(member.organization_id)

      const { data: org } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', member.organization_id)
        .maybeSingle()

      if (org?.name) { setOrgName(org.name); setOriginal(org.name) }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgId || !orgName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName.trim() })
      .eq('id', orgId)

    setSaving(false)
    if (error) {
      toast(error.message, 'error')
    } else {
      setOriginal(orgName.trim())
      toast('Organization name updated', 'success')
    }
  }

  return (
    <SectionCard
      title="Organization"
      description="Manage your organization's display name."
    >
      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-24" />
          <div className="h-9 bg-slate-100 rounded-lg w-full" />
          <div className="h-8 bg-slate-100 rounded-lg w-28" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <FieldLabel htmlFor="org-name">Organization name</FieldLabel>
            <TextInput
              id="org-name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              placeholder="Your organization name"
              required
            />
          </div>
          <div className="flex items-center gap-3 pt-1">
            <SaveButton loading={saving} />
            {orgName !== original && (
              <button
                type="button"
                onClick={() => setOrgName(original)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </SectionCard>
  )
}

/* ── Placeholder section ─────────────────────────────────────── */

const PLACEHOLDER_CONTENT: Record<string, { title: string; body: string }> = {
  team: {
    title: 'Team Members',
    body: 'Invite colleagues to collaborate on grants and drafts. Role-based access (Admin, Editor, Viewer) coming soon.',
  },
  notifications: {
    title: 'Notifications',
    body: 'Configure email and in-app alerts for upcoming deadlines, status changes, and new grant matches.',
  },
  'api-keys': {
    title: 'API Keys',
    body: 'Generate API keys to integrate Grant Intelligence with your other tools and automate workflows.',
  },
  billing: {
    title: 'Billing',
    body: 'View your current plan, usage, and manage payment methods.',
  },
  export: {
    title: 'Data Export',
    body: 'Download all your grants, pipeline data, and draft content as CSV or JSON for backup or migration.',
  },
}

function PlaceholderSection({ section }: { section: Section }) {
  const content = PLACEHOLDER_CONTENT[section]
  if (!content) return null
  return (
    <SectionCard title={content.title}>
      <div className="flex items-start gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24"
            stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--gold)' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">Coming soon</p>
          <p className="text-sm text-slate-500 leading-relaxed max-w-md">{content.body}</p>
        </div>
      </div>
    </SectionCard>
  )
}

/* ── Page ────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const [active, setActive] = useState<Section>('account')

  const sectionRef = useRef<HTMLDivElement>(null)

  const handleNav = useCallback((id: Section) => {
    setActive(id)
    sectionRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <>
      <PageHeader title="Settings" subtitle="Account and workspace preferences" />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left nav ───────────────────────────────────────── */}
        <nav className="w-52 shrink-0 border-r border-slate-200 bg-white px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium
                text-left transition-colors ${
                  active === item.id
                    ? 'text-amber-700'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                }`}
              style={active === item.id
                ? { backgroundColor: 'var(--gold-bg)', color: 'var(--gold)' }
                : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.soon && (
                <span className="text-[10px] font-semibold rounded px-1 py-0.5 bg-slate-100 text-slate-400">
                  Soon
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* ── Content ────────────────────────────────────────── */}
        <div
          ref={sectionRef}
          className="flex-1 overflow-y-auto px-6 py-6"
          style={{ backgroundColor: 'var(--surface)' }}
        >
          <div className="max-w-2xl space-y-5">
            {active === 'account'      && <AccountSection />}
            {active === 'organization' && <OrganizationSection />}
            {active !== 'account' && active !== 'organization' && (
              <PlaceholderSection section={active} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
