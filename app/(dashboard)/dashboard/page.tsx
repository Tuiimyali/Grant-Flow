import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/page-header'
import Link from 'next/link'
import DashboardDeadlineBanners from '@/components/dashboard-deadline-banners'

/* ── Domain types ──────────────────────────────────────────── */
type GrantRow = {
  id: string
  name: string
  funder: string | null
  pipeline_status: string
  deadline: string | null
  amount_low: number | null
  amount_high: number | null
  awarded_amount: number | null
  fit_score: number | null
}

/* ── Status buckets ────────────────────────────────────────── */
const S_ACTIVE    = ['discovered', 'researching', 'writing']
const S_SUBMITTED = ['submitted']
const S_AWARDED   = ['awarded']
const S_PIPELINE  = [...S_ACTIVE, ...S_SUBMITTED]

const PIPELINE_SEGMENTS = [
  { statuses: S_ACTIVE,       label: 'In Progress', color: '#3b82f6' },
  { statuses: S_SUBMITTED,    label: 'Submitted',   color: '#C7A94E' },
  { statuses: S_AWARDED,      label: 'Awarded',     color: '#4A9E6E' },
  { statuses: ['declined'],   label: 'Declined',    color: '#5A5A60' },
] as const

/* ── Helpers ───────────────────────────────────────────────── */
function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function daysUntil(iso: string) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const d   = new Date(iso); d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86_400_000)
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* ── Page (server component) ───────────────────────────────── */
export default async function DashboardPage() {
  const supabase = await createClient()

  const [grantsRes, memberRes] = await Promise.all([
    supabase
      .from('grants_full')
      .select('id, name, funder, pipeline_status, deadline, amount_low, amount_high, awarded_amount, fit_score')
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase
      .from('organization_members')
      .select('organization_id')
      .maybeSingle(),
  ])

  if (grantsRes.error) console.error('[dashboard] grants_full:', grantsRes.error.message)

  const grants = (grantsRes.data ?? []) as unknown as GrantRow[]
  const orgId  = memberRes.data?.organization_id ?? null

  let profileDone = false
  if (orgId) {
    const { data: prof } = await supabase
      .from('organization_profiles')
      .select('org_type')
      .eq('organization_id', orgId)
      .maybeSingle()
    profileDone = !!prof?.org_type
  }

  /* ── Empty state / onboarding ───────────────────────────── */
  if (grants.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Overview of your grant activity" />
        <WelcomeOnboarding profileDone={profileDone} />
      </>
    )
  }

  /* ── Compute stats ───────────────────────────────────────── */
  const pipeline   = grants.filter(g => S_PIPELINE.includes(g.pipeline_status))
  const submitted  = grants.filter(g => S_SUBMITTED.includes(g.pipeline_status))
  const awarded    = grants.filter(g => S_AWARDED.includes(g.pipeline_status))
  const withScore  = grants.filter(g => g.fit_score !== null)

  const awardedTotal = awarded.reduce((s, g) => s + (g.awarded_amount ?? 0), 0)
  const avgFitScore  = withScore.length
    ? Math.round(withScore.reduce((s, g) => s + (g.fit_score ?? 0), 0) / withScore.length)
    : null

  /* ── Upcoming deadlines ──────────────────────────────────── */
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const upcoming = grants
    .filter(g => g.deadline && new Date(g.deadline) >= today && !S_AWARDED.includes(g.pipeline_status))
    .slice(0, 8)

  /* ── Pipeline bar data ───────────────────────────────────── */
  const segmentData = PIPELINE_SEGMENTS.map(seg => ({
    ...seg,
    count:  grants.filter(g => seg.statuses.includes(g.pipeline_status as never)).length,
    total:  grants
      .filter(g => seg.statuses.includes(g.pipeline_status as never))
      .reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0),
  }))
  const grandTotal = segmentData.reduce((s, seg) => s + seg.total, 0)

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your grant activity" />
      <DashboardDeadlineBanners />

      <div className="p-6 space-y-6">
        {/* ── Stat cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Active Pipeline"
            value={pipeline.length}
            sub={`${fmt$(pipeline.reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0))} potential`}
            color="#3b82f6"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h10.5a.75.75 0 0 1 0 1.5H12v13.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75H3a.75.75 0 0 1-.75-.75V3.5h-.5A.75.75 0 0 1 1 2.75ZM4 5.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1ZM4 9.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Zm4 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1Z" clipRule="evenodd" />
                <path d="M13 2.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-5Z" />
              </svg>
            }
          />
          <StatCard
            label="Submitted"
            value={submitted.length}
            sub="awaiting decision"
            color="#C7A94E"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Awarded"
            value={fmt$(awardedTotal)}
            sub={`${awarded.length} grant${awarded.length === 1 ? '' : 's'} won`}
            color="#4A9E6E"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
              </svg>
            }
          />
          <StatCard
            label="Avg Fit Score"
            value={avgFitScore !== null ? `${avgFitScore}` : '—'}
            sub={avgFitScore !== null ? (avgFitScore >= 70 ? 'Strong match' : avgFitScore >= 50 ? 'Moderate match' : 'Low match') : 'No scores yet'}
            color="#8b5cf6"
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
              </svg>
            }
          />
        </div>

        {/* ── Pipeline dollar bar ─────────────────────────── */}
        {grandTotal > 0 && (
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>Pipeline by Value</h2>

            {/* Bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px" style={{ backgroundColor: 'var(--surface-3)' }}>
              {segmentData
                .filter(s => s.total > 0)
                .map(seg => (
                  <div
                    key={seg.label}
                    style={{
                      width: `${(seg.total / grandTotal) * 100}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${fmt$(seg.total)}`}
                  />
                ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              {segmentData.map(seg => (
                <div key={seg.label} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{seg.label}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt$(seg.total)}</span>
                  <span className="text-xs" style={{ color: 'var(--text-dim)' }}>({seg.count})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Upcoming deadlines ──────────────────────────── */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Upcoming Deadlines</h2>
          </div>

          {upcoming.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center" style={{ color: 'var(--text-dim)' }}>No upcoming deadlines.</p>
          ) : (
            <ul>
              {upcoming.map(grant => {
                const days = daysUntil(grant.deadline!)
                const urgent  = days <= 14
                const warning = !urgent && days <= 30

                return (
                  <li
                    key={grant.id}
                    className="flex items-center justify-between px-5 py-3.5"
                    style={{
                      borderBottom: '1px solid var(--border)',
                      backgroundColor: urgent ? 'rgba(196,90,90,0.04)' : undefined,
                      boxShadow: urgent
                        ? 'inset 3px 0 0 0 var(--danger)'
                        : warning
                        ? 'inset 3px 0 0 0 var(--warning)'
                        : undefined,
                    }}
                  >
                    {/* Left: name + funder */}
                    <div className="min-w-0 flex-1 mr-4">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{grant.name}</p>
                      {grant.funder && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-dim)' }}>{grant.funder}</p>
                      )}
                    </div>

                    {/* Right: days badge + date */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {(grant.amount_high ?? grant.amount_low) && (
                        <span className="text-xs hidden sm:block" style={{ color: 'var(--text-dim)' }}>
                          {fmt$(grant.amount_high ?? grant.amount_low ?? 0)}
                        </span>
                      )}
                      <DeadlineBadge days={days} />
                      <span className="text-xs hidden md:block w-28 text-right" style={{ color: 'var(--text-dim)' }}>
                        {fmtDate(grant.deadline!)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

/* ── Sub-components ────────────────────────────────────────── */
function StatCard({
  label, value, sub, color, icon,
}: {
  label: string
  value: string | number
  sub: string
  color: string
  icon: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-start gap-4"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>{label}</p>
        <p
          className="text-2xl font-bold mt-0.5 leading-none tabular-nums"
          style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: '28px',
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>{sub}</p>
      </div>
    </div>
  )
}

/* ── Welcome / onboarding (empty state) ────────────────────── */

function WelcomeOnboarding({ profileDone }: { profileDone: boolean }) {
  const steps = [
    {
      n: 1,
      done: profileDone,
      title: 'Complete your organization profile',
      desc: 'Add your org type, mission, budget, and focus areas so we can score grant fit.',
      href: '/organization',
      cta: profileDone ? 'Edit profile' : 'Set up profile',
    },
    {
      n: 2,
      done: false,
      title: 'Add your first grant opportunity',
      desc: 'Search or manually add grants — we\'ll track deadlines and calculate your fit score.',
      href: '/grants',
      cta: 'Browse grants',
    },
    {
      n: 3,
      done: false,
      title: 'Move a grant to Writing and start drafting',
      desc: 'When you\'re ready to apply, move the grant to Writing status to open the drafts workspace.',
      href: '/pipeline',
      cta: 'View pipeline',
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      {/* Logo mark */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shrink-0"
        style={{ backgroundColor: 'var(--gold-bg)', border: '1px solid var(--gold-border)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" style={{ color: 'var(--gold)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} stroke="currentColor"
            d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.728 12.728.707.707M3 12H2m20 0h-1M4.22 19.78l.707-.707M18.364 5.636l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
      </div>

      <h1
        className="text-2xl font-bold mb-2 text-center"
        style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '32px', color: 'var(--text-primary)' }}
      >
        Welcome to Grant Intelligence Workspace
      </h1>
      <p className="text-sm max-w-md text-center mb-10 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Track opportunities, measure fit, and draft applications — all in one place. Follow these steps to get started.
      </p>

      {/* Steps */}
      <div className="w-full max-w-lg space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.n}
            className="relative flex items-start gap-4 rounded-xl p-5 transition-all"
            style={{
              backgroundColor: step.done ? 'var(--success-bg)' : 'var(--surface)',
              border: `1px solid ${step.done ? 'var(--success-border)' : 'var(--border)'}`,
            }}
          >
            {/* Step number / check */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5"
              style={
                step.done
                  ? { backgroundColor: 'var(--success)', color: '#fff' }
                  : i === steps.findIndex(s => !s.done)
                  ? { backgroundColor: 'var(--gold)', color: '#0C0C0E' }
                  : { backgroundColor: 'var(--surface-3)', color: 'var(--text-dim)' }
              }
            >
              {step.done ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : step.n}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold mb-0.5"
                style={{
                  color: step.done ? 'var(--success)' : 'var(--text-primary)',
                  textDecoration: step.done ? 'line-through' : undefined,
                  textDecorationColor: step.done ? 'var(--success)' : undefined,
                }}
              >
                {step.title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>{step.desc}</p>
            </div>

            {/* CTA */}
            <Link
              href={step.href}
              className="shrink-0 self-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity btn-scale"
              style={step.done
                ? { backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)' }
                : { backgroundColor: 'var(--gold)', color: '#0C0C0E' }
              }
            >
              {step.cta} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Deadline badge (local, days-only) ─────────────────────── */

function DeadlineBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-dim)' }}
      >
        Overdue
      </span>
    )
  }
  if (days === 0) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger)',
          boxShadow: '0 0 0 1px var(--danger-border)',
        }}
      >
        Today
      </span>
    )
  }
  if (days <= 14) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger)',
          boxShadow: '0 0 0 1px var(--danger-border), 0 0 8px rgba(196,90,90,0.2)',
        }}
      >
        {days}d
      </span>
    )
  }
  if (days <= 30) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
        style={{
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning)',
          boxShadow: '0 0 0 1px var(--warning-border)',
        }}
      >
        {days}d
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)' }}
    >
      {days}d
    </span>
  )
}
