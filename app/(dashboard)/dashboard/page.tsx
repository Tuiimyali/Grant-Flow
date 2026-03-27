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
const S_ACTIVE = ['discovered', 'researching', 'writing']
const S_SUBMITTED = ['submitted']
const S_AWARDED = ['awarded']
const S_PIPELINE = [...S_ACTIVE, ...S_SUBMITTED]

const PIPELINE_SEGMENTS = [
  { statuses: S_ACTIVE, label: 'In Progress', color: '#3b82f6' },
  { statuses: S_SUBMITTED, label: 'Submitted', color: '#C7A94E' },
  { statuses: S_AWARDED, label: 'Awarded', color: '#4A9E6E' },
  { statuses: ['declined'], label: 'Declined', color: '#5A5A60' },
] as const

/* ── Helpers ───────────────────────────────────────────────── */
function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function daysUntil(iso: string) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - now.getTime()) / 86_400_000)
}


/* ── Page (server component) ───────────────────────────────── */
export default async function DashboardPage() {
  const supabase = await createClient()

  const [grantsRes, memberRes] = await Promise.all([
    supabase
      .from('grants_full')
      .select(
        'id, name, funder, pipeline_status, deadline, amount_low, amount_high, awarded_amount, fit_score'
      )
      .order('deadline', { ascending: true, nullsFirst: false }),
    supabase
      .from('organization_members')
      .select('organization_id')
      .maybeSingle(),
  ])

  if (grantsRes.error)
    console.error('[dashboard] grants_full:', grantsRes.error.message)

  const grants = (grantsRes.data ?? []) as unknown as GrantRow[]
  const orgId = memberRes.data?.organization_id ?? null

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
        <PageHeader
          title="Dashboard"
          subtitle="Overview of your grant activity"
        />
        <WelcomeOnboarding profileDone={profileDone} />
      </>
    )
  }

  /* ── Compute stats ───────────────────────────────────────── */
  const pipeline = grants.filter((g) => S_PIPELINE.includes(g.pipeline_status))
  const submitted = grants.filter((g) =>
    S_SUBMITTED.includes(g.pipeline_status)
  )
  const awarded = grants.filter((g) => S_AWARDED.includes(g.pipeline_status))
  const withScore = grants.filter((g) => g.fit_score !== null)

  const awardedTotal = awarded.reduce((s, g) => s + (g.awarded_amount ?? 0), 0)
  const avgFitScore = withScore.length
    ? Math.round(
        withScore.reduce((s, g) => s + (g.fit_score ?? 0), 0) / withScore.length
      )
    : null

  /* ── Upcoming deadlines ──────────────────────────────────── */
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = grants
    .filter(
      (g) =>
        g.deadline &&
        new Date(g.deadline) >= today &&
        !S_AWARDED.includes(g.pipeline_status)
    )
    .slice(0, 8)

  /* ── Pipeline bar data ───────────────────────────────────── */
  const segmentData = PIPELINE_SEGMENTS.map((seg) => ({
    ...seg,
    count: grants.filter((g) =>
      seg.statuses.includes(g.pipeline_status as never)
    ).length,
    total: grants
      .filter((g) => seg.statuses.includes(g.pipeline_status as never))
      .reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0),
  }))
  const grandTotal = segmentData.reduce((s, seg) => s + seg.total, 0)

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your grant activity"
      />
      <DashboardDeadlineBanners />

      <div className="p-6 space-y-6">
        {/* ── Stat cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Active Pipeline"
            value={pipeline.length}
            sub={`${fmt$(pipeline.reduce((s, g) => s + (g.amount_high ?? g.amount_low ?? 0), 0))} potential`}
          />
          <StatCard
            label="Submitted"
            value={submitted.length}
            sub="awaiting decision"
          />
          <StatCard
            label="Awarded"
            value={fmt$(awardedTotal)}
            sub={`${awarded.length} grant${awarded.length === 1 ? '' : 's'} won`}
          />
          <StatCard
            label="Avg Fit Score"
            value={avgFitScore !== null ? `${avgFitScore}%` : '—'}
            sub={
              avgFitScore !== null
                ? avgFitScore >= 70
                  ? 'Strong match'
                  : avgFitScore >= 50
                    ? 'Moderate match'
                    : 'Low match'
                : 'No scores yet'
            }
          />
        </div>

        {/* ── Pipeline dollar bar ─────────────────────────── */}
        {grandTotal > 0 && (
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            <h2
              className="text-[11px] font-medium uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-dim)' }}
            >
              Pipeline by Value
            </h2>

            {/* Bar */}
            <div
              className="flex h-1 rounded-full overflow-hidden"
              style={{ backgroundColor: 'var(--surface-3)' }}
            >
              {segmentData
                .filter((s) => s.total > 0)
                .map((seg) => (
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
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
              {segmentData.map((seg) => (
                <div key={seg.label} className="flex items-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {seg.label}
                  </span>
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {fmt$(seg.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Upcoming deadlines ──────────────────────────── */}
        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>
          <div className="px-5 pt-4 pb-3">
            <h2
              className="text-[11px] font-medium uppercase tracking-widest"
              style={{ color: 'var(--text-dim)' }}
            >
              Upcoming Deadlines
            </h2>
          </div>

          {upcoming.length === 0 ? (
            <p
              className="px-5 py-8 text-xs text-center"
              style={{ color: 'var(--text-dim)' }}
            >
              No upcoming deadlines.
            </p>
          ) : (
            <ul>
              {upcoming.map((grant) => {
                const days = daysUntil(grant.deadline!)
                const urgent = days <= 7
                const warning = !urgent && days <= 14
                const indicatorColor = urgent
                  ? 'var(--danger)'
                  : warning
                    ? 'var(--warning)'
                    : 'transparent'

                return (
                  <li key={grant.id}>
                    <Link
                      href={`/grants/${grant.id}`}
                      className="group flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-[var(--surface-2)]"
                      style={{ borderLeft: `2px solid ${indicatorColor}` }}
                    >
                      <p
                        className="text-[13px] truncate flex-1 transition-colors duration-150 group-hover:text-[var(--gold)]"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {grant.name}
                      </p>
                      <DeadlineBadge days={days} />
                    </Link>
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
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub: string
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: 'var(--surface)' }}
    >
      <p
        className="text-[11px] font-medium uppercase tracking-widest mb-2"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </p>
      <p
        className="leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-cormorant, serif)',
          fontSize: '32px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {value}
      </p>
      <p className="text-xs mt-1.5" style={{ color: 'var(--text-dim)' }}>
        {sub}
      </p>
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
      desc: "Search or manually add grants — we'll track deadlines and calculate your fit score.",
      href: '/grants',
      cta: 'Browse grants',
    },
    {
      n: 3,
      done: false,
      title: 'Move a grant to Writing and start drafting',
      desc: "When you're ready to apply, move the grant to Writing status to open the drafts workspace.",
      href: '/pipeline',
      cta: 'View pipeline',
    },
  ]

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-16">
      {/* Logo mark */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shrink-0"
        style={{
          backgroundColor: 'var(--gold-bg)',
          border: '1px solid var(--gold-border)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="w-7 h-7"
          style={{ color: 'var(--gold)' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            stroke="currentColor"
            d="M12 3v1m0 16v1M4.22 4.22l.707.707m12.728 12.728.707.707M3 12H2m20 0h-1M4.22 19.78l.707-.707M18.364 5.636l.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"
          />
        </svg>
      </div>

      <h1
        className="text-2xl font-bold mb-2 text-center"
        style={{
          fontFamily: 'var(--font-cormorant, serif)',
          fontSize: '32px',
          color: 'var(--text-primary)',
        }}
      >
        Welcome to Grant Intelligence Workspace
      </h1>
      <p
        className="text-sm max-w-md text-center mb-10 leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        Track opportunities, measure fit, and draft applications — all in one
        place. Follow these steps to get started.
      </p>

      {/* Steps */}
      <div className="w-full max-w-lg space-y-3">
        {steps.map((step, i) => (
          <div
            key={step.n}
            className="relative flex items-start gap-4 rounded-xl p-5 transition-all"
            style={{
              backgroundColor: step.done
                ? 'var(--success-bg)'
                : 'var(--surface)',
              border: `1px solid ${step.done ? 'var(--success-border)' : 'var(--border)'}`,
            }}
          >
            {/* Step number / check */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold mt-0.5"
              style={
                step.done
                  ? { backgroundColor: 'var(--success)', color: '#fff' }
                  : i === steps.findIndex((s) => !s.done)
                    ? { backgroundColor: 'var(--gold)', color: '#0C0C0E' }
                    : {
                        backgroundColor: 'var(--surface-3)',
                        color: 'var(--text-dim)',
                      }
              }
            >
              {step.done ? (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                step.n
              )}
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
              <p
                className="text-xs leading-relaxed"
                style={{ color: 'var(--text-dim)' }}
              >
                {step.desc}
              </p>
            </div>

            {/* CTA */}
            <Link
              href={step.href}
              className="shrink-0 self-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity btn-scale"
              style={
                step.done
                  ? {
                      backgroundColor: 'var(--success-bg)',
                      color: 'var(--success)',
                      border: '1px solid var(--success-border)',
                    }
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
  const color =
    days < 0 ? 'var(--text-dim)'
    : days <= 7 ? 'var(--danger)'
    : days <= 14 ? 'var(--warning)'
    : 'var(--text-dim)'

  const label =
    days < 0 ? 'Overdue'
    : days === 0 ? 'Today'
    : `${days}d`

  return (
    <span
      className="text-xs font-medium tabular-nums shrink-0"
      style={{ color }}
    >
      {label}
    </span>
  )
}
