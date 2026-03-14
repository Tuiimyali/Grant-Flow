'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import PageHeader from '@/components/page-header'
import { useOrganization } from '@/lib/hooks/use-organization'
import { recalculateOrgScores } from '@/lib/utils/recalculate-scores'
import type {
  OrganizationProfile,
  OrgType,
  SovereigntyStatus,
  AnnualBudgetRange,
  StaffSize,
  HasGrantWriter,
  SamRegistered,
  SingleAuditStatus,
} from '@/lib/types/database.types'

/* ── Dropdown options (must match DB check constraints) ────── */
const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: 'indigenous_led',    label: 'Indigenous-Led Organization' },
  { value: 'nonprofit_501c3',   label: '501(c)(3) Nonprofit' },
  { value: 'tribal_government', label: 'Tribal Government' },
  { value: 'faith_based',       label: 'Faith-Based Organization' },
  { value: 'community_org',     label: 'Community Organization' },
  { value: 'other',             label: 'Other' },
]

const SOVEREIGNTY_OPTIONS: { value: SovereigntyStatus; label: string }[] = [
  { value: 'tribal',             label: 'Tribal Nation' },
  { value: 'federally_recognized', label: 'Federally Recognized Tribe' },
  { value: 'state_recognized',   label: 'State Recognized Tribe' },
  { value: '501c3',              label: '501(c)(3) Nonprofit' },
  { value: 'fiscal_sponsorship', label: 'Fiscal Sponsorship' },
  { value: 'government_entity',  label: 'Government Entity' },
  { value: 'other',              label: 'Other' },
]

const BUDGET_RANGES: { value: AnnualBudgetRange; label: string }[] = [
  { value: 'under_50k',  label: 'Under $50K' },
  { value: '50k_100k',   label: '$50K – $100K' },
  { value: '100k_500k',  label: '$100K – $500K' },
  { value: '500k_1m',    label: '$500K – $1M' },
  { value: '1m_5m',      label: '$1M – $5M' },
  { value: 'over_5m',    label: 'Over $5M' },
]

const STAFF_SIZES: { value: StaffSize; label: string }[] = [
  { value: 'solo',    label: 'Solo / Just me' },
  { value: '1_5',     label: '1–5' },
  { value: '6_15',    label: '6–15' },
  { value: '16_50',   label: '16–50' },
  { value: 'over_50', label: '50+' },
]

const GRANT_WRITER_OPTIONS: { value: HasGrantWriter; label: string }[] = [
  { value: 'yes',        label: 'Yes — in-house' },
  { value: 'contractor', label: 'Contractor / Part-time' },
  { value: 'no',         label: 'No' },
]

const SAM_OPTIONS: { value: SamRegistered; label: string }[] = [
  { value: 'yes',         label: 'Yes' },
  { value: 'no',          label: 'No' },
  { value: 'in_progress', label: 'In Progress' },
]

const AUDIT_OPTIONS: { value: SingleAuditStatus; label: string }[] = [
  { value: 'not_required', label: 'Not Required' },
  { value: 'current',      label: 'Current / Compliant' },
  { value: 'in_progress',  label: 'In Progress' },
  { value: 'needed',       label: 'Needed' },
]

const YESNO = [
  { value: 'true',  label: 'Yes' },
  { value: 'false', label: 'No' },
]

/* ── Types ──────────────────────────────────────────────────── */
type FormState = Partial<OrganizationProfile>
type Toast = { type: 'success' | 'error'; msg: string } | null

/* ── Page ───────────────────────────────────────────────────── */
export default function OrganizationPage() {
  const { data: org, organizationId, orgName: fetchedOrgName, loading } = useOrganization()
  const [form, setForm]       = useState<FormState>({})
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState<Toast>(null)

  useEffect(() => {
    if (org) setForm(org)
  }, [org])

  useEffect(() => {
    if (fetchedOrgName) setOrgName(fetchedOrgName)
  }, [fetchedOrgName])

  function set<K extends keyof OrganizationProfile>(key: K, value: OrganizationProfile[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    if (!organizationId) {
      showToast('error', 'No organisation found. Please refresh and try again.')
      setSaving(false)
      return
    }

    const supabase = createClient()

    // Explicit payload — only columns that exist on organization_profiles
    const profilePayload = {
      org_type:              form.org_type              ?? null,
      sovereignty_status:    form.sovereignty_status    ?? null,
      ein:                   form.ein                   ?? null,
      year_founded:          form.year_founded          ?? null,
      mission_statement:     form.mission_statement     ?? null,
      geographic_focus:      form.geographic_focus      ?? null,
      annual_budget_range:   form.annual_budget_range   ?? null,
      fiscal_sponsor:        form.fiscal_sponsor        ?? null,
      website:               form.website               ?? null,
      contact_email:         form.contact_email         ?? null,
      staff_size:            form.staff_size            ?? null,
      has_grant_writer:      form.has_grant_writer      ?? null,
      sam_registered:        form.sam_registered        ?? null,
      sam_uei:               form.sam_uei               ?? null,
      single_audit_status:   form.single_audit_status   ?? null,
      has_prior_federal:     form.has_prior_federal     ?? null,
      prior_federal_detail:  form.prior_federal_detail  ?? null,
      has_prior_foundation:  form.has_prior_foundation  ?? null,
      prior_foundation_detail: form.prior_foundation_detail ?? null,
      focus_areas:           form.focus_areas           ?? null,
      populations_served:    form.populations_served    ?? null,
      updated_at:            new Date().toISOString(),
    }

    console.log('[org save] profilePayload →', profilePayload)

    // Save org name to organizations table (separate from profiles)
    if (orgName.trim()) {
      const { error: nameErr } = await supabase
        .from('organizations')
        .update({ name: orgName.trim() })
        .eq('id', organizationId)
      if (nameErr) console.warn('[org save] org name update error:', nameErr.message)
    }

    // Upsert organization_profiles
    const { data: saved, error, status, statusText } = org?.id
      ? await supabase
          .from('organization_profiles')
          .update(profilePayload)
          .eq('organization_id', organizationId)
          .select()
      : await supabase
          .from('organization_profiles')
          .insert({ ...profilePayload, organization_id: organizationId })
          .select()

    console.log('[org save] response:', { data: saved, error, status, statusText })

    setSaving(false)
    if (error) {
      showToast('error', error.message)
    } else if (!saved || saved.length === 0) {
      showToast('error', 'Save was blocked — check Supabase RLS policies for organization_profiles.')
    } else {
      showToast('success', 'Profile saved successfully.')
      // Recalculate fit scores for all pipeline grants in the background
      recalculateOrgScores(supabase, organizationId).catch(console.error)
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Organization" subtitle="Manage your organisation profile" />
        <div className="p-6 flex items-center gap-2 text-sm text-slate-400">
          <Spinner /> Loading profile…
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Organization" subtitle="Manage your organisation profile" />

      <form onSubmit={handleSave} className="p-6">
        <div className="max-w-3xl space-y-8">

          {/* ── Section 1: Identity ──────────────────────── */}
          <Section title="Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Organisation name" required span={2}>
                <Input
                  value={orgName}
                  onChange={v => setOrgName(v)}
                  placeholder="Acme Water Authority"
                />
              </Field>

              <Field label="Organisation type">
                <Select
                  options={ORG_TYPES}
                  value={form.org_type ?? ''}
                  onChange={v => set('org_type', v as OrgType)}
                />
              </Field>

              <Field label="Sovereignty status">
                <Select
                  options={SOVEREIGNTY_OPTIONS}
                  value={form.sovereignty_status ?? ''}
                  onChange={v => set('sovereignty_status', v as SovereigntyStatus)}
                />
              </Field>

              <Field label="EIN">
                <Input
                  value={form.ein ?? ''}
                  onChange={v => set('ein', v)}
                  placeholder="12-3456789"
                />
              </Field>

              <Field label="Year founded">
                <Input
                  type="number"
                  value={form.year_founded?.toString() ?? ''}
                  onChange={v => set('year_founded', v ? parseInt(v, 10) : null)}
                  placeholder="2005"
                />
              </Field>

              <Field label="Annual budget range">
                <Select
                  options={BUDGET_RANGES}
                  value={form.annual_budget_range ?? ''}
                  onChange={v => set('annual_budget_range', v as AnnualBudgetRange)}
                />
              </Field>

              <Field label="Geographic focus">
                <Input
                  value={form.geographic_focus ?? ''}
                  onChange={v => set('geographic_focus', v)}
                  placeholder="Southwest US, Navajo Nation"
                />
              </Field>

              <Field label="Fiscal sponsor">
                <Input
                  value={form.fiscal_sponsor ?? ''}
                  onChange={v => set('fiscal_sponsor', v)}
                  placeholder="Name of fiscal sponsor, if any"
                />
              </Field>

              <Field label="Contact email">
                <Input
                  type="email"
                  value={form.contact_email ?? ''}
                  onChange={v => set('contact_email', v)}
                  placeholder="grants@example.org"
                />
              </Field>

              <Field label="Website">
                <Input
                  type="url"
                  value={form.website ?? ''}
                  onChange={v => set('website', v)}
                  placeholder="https://example.org"
                />
              </Field>

              <Field label="Mission statement" span={2}>
                <Textarea
                  value={form.mission_statement ?? ''}
                  onChange={v => set('mission_statement', v)}
                  placeholder="Describe your organisation's mission…"
                  rows={4}
                />
              </Field>
            </div>
          </Section>

          {/* ── Section 2: Capacity & Compliance ─────────── */}
          <Section title="Capacity &amp; Compliance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Staff size">
                <Select
                  options={STAFF_SIZES}
                  value={form.staff_size ?? ''}
                  onChange={v => set('staff_size', v as StaffSize)}
                />
              </Field>

              <Field label="Has grant writer">
                <Select
                  options={GRANT_WRITER_OPTIONS}
                  value={form.has_grant_writer ?? ''}
                  onChange={v => set('has_grant_writer', v as HasGrantWriter)}
                />
              </Field>

              <Field label="SAM registered">
                <Select
                  options={SAM_OPTIONS}
                  value={form.sam_registered ?? ''}
                  onChange={v => set('sam_registered', v as SamRegistered)}
                />
              </Field>

              <Field label="SAM UEI">
                <Input
                  value={form.sam_uei ?? ''}
                  onChange={v => set('sam_uei', v)}
                  placeholder="18-character UEI"
                />
              </Field>

              <Field label="Single audit status" span={2}>
                <Select
                  options={AUDIT_OPTIONS}
                  value={form.single_audit_status ?? ''}
                  onChange={v => set('single_audit_status', v as SingleAuditStatus)}
                />
              </Field>
            </div>
          </Section>

          {/* ── Section 3: Funding History ────────────────── */}
          <Section title="Funding History">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Prior federal grants">
                <Select
                  options={YESNO}
                  value={form.has_prior_federal === null || form.has_prior_federal === undefined
                    ? '' : String(form.has_prior_federal)}
                  onChange={v => set('has_prior_federal', v === '' ? null : v === 'true')}
                />
              </Field>

              <Field label="Federal grant details" span={2}>
                <Textarea
                  value={form.prior_federal_detail ?? ''}
                  onChange={v => set('prior_federal_detail', v)}
                  placeholder="List federal grants received, agencies, and years…"
                  rows={3}
                  disabled={form.has_prior_federal !== true}
                />
              </Field>

              <Field label="Prior foundation grants">
                <Select
                  options={YESNO}
                  value={form.has_prior_foundation === null || form.has_prior_foundation === undefined
                    ? '' : String(form.has_prior_foundation)}
                  onChange={v => set('has_prior_foundation', v === '' ? null : v === 'true')}
                />
              </Field>

              <Field label="Foundation grant details" span={2}>
                <Textarea
                  value={form.prior_foundation_detail ?? ''}
                  onChange={v => set('prior_foundation_detail', v)}
                  placeholder="List foundations, grant names, and years…"
                  rows={3}
                  disabled={form.has_prior_foundation !== true}
                />
              </Field>
            </div>
          </Section>

          {/* ── Section 4: Focus & Populations ───────────── */}
          <Section title="Focus &amp; Populations">
            <div className="space-y-5">
              <Field label="Focus areas" hint="Press Enter or comma to add a tag">
                <TagInput
                  tags={form.focus_areas ?? []}
                  onChange={tags => set('focus_areas', tags)}
                  placeholder="e.g. Water quality, Climate resilience"
                />
              </Field>

              <Field label="Populations served" hint="Press Enter or comma to add a tag">
                <TagInput
                  tags={form.populations_served ?? []}
                  onChange={tags => set('populations_served', tags)}
                  placeholder="e.g. Tribal communities, Rural households"
                />
              </Field>
            </div>
          </Section>

          {/* ── Save ─────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 pb-8">
            <p className="text-xs text-slate-400">
              {org?.updated_at
                ? `Last saved ${new Date(org.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Not yet saved'}
            </p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-opacity"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {saving && <Spinner />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && <ToastNotification toast={toast} />}
    </>
  )
}

/* ── Form primitives ────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-sm font-semibold text-slate-900 uppercase tracking-wide pb-3 mb-4 border-b"
        style={{ borderColor: 'var(--surface-border)' }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {children}
    </div>
  )
}

function Field({
  label, hint, required, span, children,
}: {
  label: string
  hint?: string
  required?: boolean
  span?: 1 | 2
  children: React.ReactNode
}) {
  return (
    <div className={span === 2 ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'

function Input({
  value, onChange, type = 'text', placeholder, disabled,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClass}
      style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
    />
  )
}

function Textarea({
  value, onChange, placeholder, rows = 3, disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`${inputClass} resize-y`}
    />
  )
}

function Select<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={inputClass}
    >
      <option value="">— Select —</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function TagInput({
  tags, onChange, placeholder,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,$/, '')
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInput('')
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div
      className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:border-transparent"
      style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: 'var(--gold-bg)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}
        >
          {tag}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(tags.filter(t => t !== tag)) }}
            className="ml-0.5 hover:opacity-70 leading-none"
            aria-label={`Remove ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => {
          const v = e.target.value
          if (v.endsWith(',')) { addTag(v); return }
          setInput(v)
        }}
        onKeyDown={handleKey}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none py-0.5 px-1"
      />
    </div>
  )
}

function ToastNotification({ toast }: { toast: NonNullable<Toast> }) {
  const isSuccess = toast.type === 'success'
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white animate-in slide-in-from-bottom-2 duration-200"
      style={{ backgroundColor: isSuccess ? '#16a34a' : '#dc2626', minWidth: '260px' }}
      role="alert"
    >
      {isSuccess ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 shrink-0">
          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
        </svg>
      )}
      {toast.msg}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  )
}
