'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/* ── Scroll fade-in hook ──────────────────────────────────────────── */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.08 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

function FadeIn({
  children,
  delay = 0,
  style,
  className,
}: {
  children: React.ReactNode
  delay?: number
  style?: React.CSSProperties
  className?: string
}) {
  const { ref, visible } = useFadeIn()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(22px)',
        transition: `opacity 600ms ease ${delay}ms, transform 600ms ease ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/* ── Browser chrome wrapper ──────────────────────────────────────── */
function BrowserFrame({ children, url }: { children: React.ReactNode; url: string }) {
  return (
    <div
      style={{
        borderRadius: '10px',
        border: '1px solid #1e1e26',
        overflow: 'hidden',
        background: '#0a0a0d',
      }}
    >
      <div
        style={{
          background: '#141418',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '1px solid #1a1a22',
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#2a2a32', flexShrink: 0 }}
          />
        ))}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              background: '#0a0a0d',
              borderRadius: '4px',
              padding: '2px 28px',
              fontSize: '9.5px',
              color: '#32323c',
              letterSpacing: '0.02em',
            }}
          >
            {url}
          </div>
        </div>
        <div style={{ width: 26 }} />
      </div>
      {children}
    </div>
  )
}

/* ── Dashboard mockup (hero) — mirrors real dashboard layout ─────── */
function DashboardMockup() {
  // Matches real StatCard labels exactly
  const stats = [
    { label: 'Active Pipeline', value: '8', sub: '$1.8M potential' },
    { label: 'Submitted', value: '3', sub: 'awaiting decision' },
    { label: 'Awarded', value: '$380K', sub: '2 grants won' },
    { label: 'Avg Fit Score', value: '76%', sub: 'Strong match' },
  ]
  // Matches real deadlines list: left border urgency indicator + grant name + days badge
  const deadlines = [
    { name: 'Blandin Foundation Rural Tech', days: 5, border: '#a84a4a' },
    { name: 'NEA Arts Engagement Grant', days: 12, border: '#b87d38' },
    { name: 'First Nations Dev Institute', days: 28, border: 'transparent' },
    { name: 'USDA Rural Development', days: 45, border: 'transparent' },
  ]
  // Matches real pipeline segments: In Progress, Submitted, Awarded, Declined
  const segments = [
    { label: 'In Progress', pct: 57, color: '#4a6a9a' },
    { label: 'Submitted',   pct: 20, color: '#C7A94E' },
    { label: 'Awarded',     pct: 17, color: '#4A9E6E' },
    { label: 'Declined',    pct: 6,  color: '#3a3a44' },
  ]
  const nav = ['Dashboard', 'Grants', 'Pipeline', 'Drafts', 'Snippets', 'Organization', 'Settings']

  return (
    <div style={{ display: 'flex', background: '#0c0c0e', minHeight: '340px', overflow: 'hidden' }}>
      {/* Sidebar — matches real 180px sidebar */}
      <div
        style={{
          width: '120px',
          background: '#0a0a0d',
          borderRight: '1px solid #141418',
          padding: '0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          paddingInline: '13px',
          borderBottom: '1px solid #141418',
          fontFamily: 'var(--font-cormorant, serif)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#e8e6e1',
        }}>
          Fieldwork
        </div>
        {/* Nav items */}
        <div style={{ paddingBlock: '8px', flex: 1 }}>
          {nav.map((item, i) => (
            <div key={item} style={{
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              paddingInline: '13px',
              fontSize: '8.5px',
              color: i === 0 ? '#C7A94E' : '#42424a',
              borderLeft: `2px solid ${i === 0 ? '#C7A94E' : 'transparent'}`,
              fontWeight: i === 0 ? 500 : 400,
            }}>
              {item}
            </div>
          ))}
        </div>
        {/* Sign out */}
        <div style={{
          height: '22px',
          display: 'flex',
          alignItems: 'center',
          paddingInline: '13px',
          fontSize: '8.5px',
          color: '#2a2a34',
          borderTop: '1px solid #141418',
        }}>
          Sign out
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {/* Page header — matches real header height/style */}
        <div style={{
          height: '34px',
          display: 'flex',
          alignItems: 'center',
          paddingInline: '16px',
          borderBottom: '1px solid #1e1e26',
          background: '#0c0c0e',
        }}>
          <span style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: '14px',
            fontWeight: 600,
            color: '#e8e6e1',
          }}>Dashboard</span>
        </div>

        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Stat cards — 4 columns matching real layout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {stats.map((s) => (
              <div key={s.label} style={{
                background: '#141416',
                borderRadius: 6,
                padding: '8px 10px',
              }}>
                <div style={{
                  fontSize: '7px',
                  color: '#42424a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.07em',
                  marginBottom: 4,
                }}>{s.label}</div>
                <div style={{
                  fontFamily: 'var(--font-cormorant, serif)',
                  fontSize: '18px',
                  fontWeight: 300,
                  color: '#e8e6e1',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}>{s.value}</div>
                <div style={{ fontSize: '7px', color: '#2a2a34', marginTop: 3 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Pipeline by Value — single segmented bar matching real layout */}
          <div style={{ background: '#141416', borderRadius: 6, padding: '8px 10px' }}>
            <div style={{
              fontSize: '7px',
              color: '#42424a',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              marginBottom: 6,
            }}>Pipeline by Value</div>
            <div style={{
              display: 'flex',
              height: 3,
              borderRadius: 2,
              overflow: 'hidden',
              background: '#1e1e24',
              marginBottom: 6,
            }}>
              {segments.map((s) => (
                <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {segments.map((s) => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '7px', color: '#42424a' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Deadlines — matches real list with left border urgency */}
          <div style={{ background: '#141416', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              fontSize: '7px',
              color: '#42424a',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              padding: '8px 10px 4px',
            }}>Upcoming Deadlines</div>
            {deadlines.map((d) => (
              <div key={d.name} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 10px',
                borderLeft: `2px solid ${d.border}`,
                gap: 8,
              }}>
                <span style={{
                  fontSize: '8.5px',
                  color: '#9a9a9f',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>{d.name}</span>
                <span style={{
                  fontSize: '8px',
                  color: d.border !== 'transparent' ? d.border : '#42424a',
                  flexShrink: 0,
                  fontWeight: 500,
                }}>{d.days}d</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Grants table mockup ─────────────────────────────────────────── */
function GrantsTableMockup() {
  const grants = [
    { name: 'Rural Technology Initiative', funder: 'Blandin Foundation', fit: 92, status: 'Writing', deadline: 'Feb 15' },
    { name: 'Arts & Culture Fund', funder: 'NEA', fit: 85, status: 'Researching', deadline: 'Mar 1' },
    { name: 'Indigenous Innovation Fund', funder: 'First Nations Dev Inst.', fit: 78, status: 'Writing', deadline: 'Mar 22' },
    { name: 'Rural Development Grant', funder: 'USDA', fit: 71, status: 'Discovered', deadline: 'Apr 8' },
    { name: 'Technology Equity Fund', funder: 'Gates Foundation', fit: 64, status: 'Researching', deadline: 'Apr 30' },
  ]
  const statusStyle = (s: string) =>
    s === 'Writing'
      ? { bg: 'rgba(199,169,78,0.12)', color: '#C7A94E' }
      : s === 'Researching'
        ? { bg: 'rgba(90,138,196,0.1)', color: '#5a8ac4' }
        : { bg: 'rgba(255,255,255,0.04)', color: '#585862' }
  const fitColor = (f: number) => (f >= 85 ? '#4a9e6e' : f >= 70 ? '#C7A94E' : '#8a6a3a')

  return (
    <div style={{ background: '#0c0c0e', padding: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 11, alignItems: 'center' }}>
        <div
          style={{
            flex: 1,
            background: '#131315',
            border: '1px solid #1e1e26',
            borderRadius: 5,
            padding: '5px 10px',
            fontSize: '9px',
            color: '#32323c',
          }}
        >
          Search grants or paste a URL...
        </div>
        <div
          style={{
            background: '#C7A94E',
            borderRadius: 4,
            padding: '4px 10px',
            fontSize: '8.5px',
            color: '#0c0c0e',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          + Add Grant
        </div>
      </div>
      <div style={{ border: '1px solid #1a1a22', borderRadius: 6, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.4fr 1.4fr 52px 88px 56px',
            background: '#131318',
            padding: '7px 10px',
            borderBottom: '1px solid #1a1a22',
          }}
        >
          {['Grant', 'Funder', 'Fit', 'Status', 'Due'].map((h) => (
            <div
              key={h}
              style={{
                fontSize: '7.5px',
                color: '#32323c',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              {h}
            </div>
          ))}
        </div>
        {grants.map((g, i) => {
          const sc = statusStyle(g.status)
          return (
            <div
              key={g.name}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.4fr 1.4fr 52px 88px 56px',
                padding: '8px 10px',
                borderBottom: i < grants.length - 1 ? '1px solid #131318' : 'none',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '9.5px', color: '#c8c6c1', marginBottom: 1 }}>{g.name}</div>
                <div style={{ fontSize: '7.5px', color: '#3a6a4a' }}>Eligible</div>
              </div>
              <div style={{ fontSize: '8.5px', color: '#585862' }}>{g.funder}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 22,
                    height: 3,
                    background: '#1e1e26',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${g.fit}%`,
                      height: '100%',
                      background: fitColor(g.fit),
                    }}
                  />
                </div>
                <span style={{ fontSize: '9px', color: fitColor(g.fit), fontWeight: 500 }}>
                  {g.fit}
                </span>
              </div>
              <div>
                <span
                  style={{
                    fontSize: '8px',
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: sc.bg,
                    color: sc.color,
                  }}
                >
                  {g.status}
                </span>
              </div>
              <div style={{ fontSize: '8.5px', color: '#484852' }}>{g.deadline}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Drafts mockup ───────────────────────────────────────────────── */
function DraftsMockup() {
  const tabs = ['Project Narrative', 'Budget Justification', 'Org Overview', 'Evaluation Plan']
  const requirements = [
    { text: 'Problem statement (§2.1)', done: true },
    { text: 'Target population', done: true },
    { text: 'Letters of support (3 req.)', done: true },
    { text: 'Budget narrative', done: false },
    { text: 'Logic model', done: false },
    { text: 'Tribal resolution', done: false },
  ]
  return (
    <div
      style={{ background: '#0c0c0e', display: 'flex', height: '290px', overflow: 'hidden' }}
    >
      {/* Editor pane */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid #1a1a22',
            background: '#0e0e11',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '7.5px', color: '#484852', marginBottom: 2 }}>
            First Nations Development Institute
          </div>
          <div style={{ fontSize: '10px', color: '#c8c6c1', fontWeight: 500 }}>
            Indigenous Innovation Fund · $300K
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid #1a1a22',
            background: '#0e0e11',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {tabs.map((t, i) => (
            <div
              key={t}
              style={{
                padding: '6px 10px',
                fontSize: '8.5px',
                color: i === 0 ? '#C7A94E' : '#3a3a44',
                borderBottom: i === 0 ? '1.5px solid #C7A94E' : '1.5px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '12px 14px', overflow: 'hidden' }}>
          <div
            style={{ fontSize: '8.5px', color: '#7a7a82', lineHeight: 1.7 }}
          >
            Our organization has served tribal communities across the Pacific Northwest for
            over 22 years, bridging the gap between traditional knowledge systems and modern
            technological infrastructure. This proposal requests $300,000 to expand our
            Digital Sovereignty Initiative — providing tribes with the tools and training to
            own and manage their own data.
            <br />
            <br />
            Phase I will focus on three partner tribes identified in our community needs
            assessment. Each will receive dedicated technical assistance, custom data
            infrastructure, and 18 months of ongoing support.
          </div>
        </div>
      </div>
      {/* Requirements sidebar */}
      <div
        style={{
          width: '128px',
          borderLeft: '1px solid #1a1a22',
          background: '#0e0e11',
          padding: '10px',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '7.5px',
            color: '#484852',
            marginBottom: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Requirements
        </div>
        {requirements.map((r) => (
          <div key={r.text} style={{ display: 'flex', gap: 5, marginBottom: 7, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                border: `1px solid ${r.done ? '#4a9e6e' : '#2a2a34'}`,
                background: r.done ? 'rgba(74,158,110,0.18)' : 'transparent',
                flexShrink: 0,
                marginTop: 1,
              }}
            />
            <span style={{ fontSize: '7.5px', color: r.done ? '#5a7a62' : '#32323c', lineHeight: 1.4 }}>
              {r.text}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: 14,
            background: '#1a1a22',
            border: '1px solid #2a2a34',
            borderRadius: 4,
            padding: '5px 8px',
            fontSize: '8px',
            color: '#8a8a8f',
            textAlign: 'center',
          }}
        >
          Export to Word
        </div>
      </div>
    </div>
  )
}

/* ── Pipeline kanban mockup ──────────────────────────────────────── */
function PipelineMockup() {
  const columns = [
    {
      label: 'Discovered',
      color: '#5a5a8a',
      total: '$840K',
      cards: [
        { name: 'Blandin Rural Tech', amount: '$75K' },
        { name: 'USDA Rural Dev', amount: '$250K' },
        { name: 'NEA Arts Grant', amount: '$45K' },
      ],
    },
    {
      label: 'Researching',
      color: '#4a6a9a',
      total: '$320K',
      cards: [
        { name: 'Gates Tech Equity', amount: '$180K' },
        { name: 'Adobe Foundation', amount: '$60K' },
        { name: 'Kellogg Found.', amount: '$80K' },
      ],
    },
    {
      label: 'Writing',
      color: '#C7A94E',
      total: '$450K',
      cards: [
        { name: 'First Nations Dev', amount: '$300K' },
        { name: 'HUD ICDBG', amount: '$150K' },
      ],
    },
    {
      label: 'Submitted',
      color: '#4a9e6e',
      total: '$650K',
      cards: [
        { name: 'MacArthur Fellows', amount: '$500K' },
        { name: 'Ford Foundation', amount: '$150K' },
      ],
    },
  ]
  return (
    <div style={{ background: '#0c0c0e', padding: '12px', overflow: 'hidden' }}>
      {/* Column totals */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {columns.map((c) => (
          <div key={c.label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '9.5px', color: c.color, fontWeight: 500 }}>{c.total}</div>
            <div style={{ fontSize: '7.5px', color: '#32323c', marginTop: 1 }}>{c.label}</div>
          </div>
        ))}
      </div>
      {/* Kanban grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
        {columns.map((c) => (
          <div key={c.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div
              style={{ height: 2, background: c.color, borderRadius: 2, opacity: 0.6, marginBottom: 1 }}
            />
            {c.cards.map((card) => (
              <div
                key={card.name}
                style={{
                  background: '#131315',
                  border: '1px solid #1e1e26',
                  borderRadius: 5,
                  padding: '7px 8px',
                }}
              >
                <div style={{ fontSize: '8.5px', color: '#b0aead', lineHeight: 1.4, marginBottom: 3 }}>
                  {card.name}
                </div>
                <div style={{ fontSize: '8px', color: c.color, fontWeight: 500 }}>{card.amount}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main landing page ───────────────────────────────────────────── */
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const prices = {
    starter: billing === 'annual' ? 24 : 29,
    pro: billing === 'annual' ? 57 : 69,
    team: billing === 'annual' ? 124 : 149,
  }

  const features = [
    {
      id: 'discover',
      label: 'Discover & Score',
      heading: 'Know which grants are worth your time before you spend any of it.',
      body: 'Paste any grant URL and AI extracts everything — funder, deadlines, sections, review criteria. Then see a transparent six-dimension fit score so you know exactly which grants are worth your time.',
      visual: <GrantsTableMockup />,
      url: 'fieldwork.app/grants',
      flip: false,
    },
    {
      id: 'draft',
      label: 'Draft with AI',
      heading: 'A complete first draft in minutes, not days.',
      body: 'Click one button and get a complete first draft — every section, informed by your org profile, your snippets library, and the funder\'s review criteria. Edit it, make it yours, export to Word.',
      visual: <DraftsMockup />,
      url: 'fieldwork.app/drafts',
      flip: true,
    },
    {
      id: 'track',
      label: 'Track Everything',
      heading: 'Your whole pipeline, at a glance.',
      body: 'See your entire grant pipeline at a glance. Dollar totals at every stage. Deadline alerts before you miss anything. From discovery to award, nothing falls through.',
      visual: <PipelineMockup />,
      url: 'fieldwork.app/pipeline',
      flip: false,
    },
  ]

  return (
    <div
      style={{
        background: '#0C0C0E',
        color: '#E8E6E1',
        fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
        minHeight: '100vh',
      }}
    >
      <style>{`
        @keyframes heroRise {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-hero-text-1 { animation: heroRise 600ms ease 100ms both; }
        .lp-hero-text-2 { animation: heroRise 600ms ease 240ms both; }
        .lp-hero-text-3 { animation: heroRise 600ms ease 360ms both; }
        .lp-hero-shot   { animation: heroRise 800ms ease 480ms both; }

        .lp-feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 5rem;
          align-items: center;
        }
        @media (max-width: 860px) {
          .lp-feature-grid { grid-template-columns: 1fr; gap: 2.5rem; }
          .lp-feature-flip { order: -1; }
        }
        .lp-pricing-card {
          transition: transform 220ms ease;
          cursor: default;
        }
        .lp-pricing-card:hover { transform: translateY(-4px); }
      `}</style>

      {/* ── NAV ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2rem',
          height: '60px',
          background: '#0C0C0E',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
          transition: 'border-color 200ms ease',
        }}
      >
        <span style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '0.01em' }}>Fieldwork</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <Link
            href="/auth/signin"
            style={{ fontSize: '13px', color: '#8a8a8f', textDecoration: 'none' }}
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            style={{
              fontSize: '13px',
              background: '#C7A94E',
              color: '#0C0C0E',
              padding: '6px 14px',
              borderRadius: '4px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '100px 1.5rem 80px',
        }}
      >
        <h1
          className="lp-hero-text-1"
          style={{
            fontFamily: 'var(--font-cormorant, "Cormorant Garamond", Georgia, serif)',
            fontSize: 'clamp(2.4rem, 6vw, 4.5rem)',
            fontWeight: 300,
            lineHeight: 1.15,
            letterSpacing: '-0.01em',
            margin: '0 0 1.5rem',
            maxWidth: '680px',
          }}
        >
          The grant tool that gets out of your way.
        </h1>
        <p
          className="lp-hero-text-2"
          style={{
            fontSize: 'clamp(14px, 1.5vw, 16px)',
            color: '#8a8a8f',
            margin: '0 0 2.5rem',
            maxWidth: '480px',
          }}
        >
          Find grants. Score fit. Draft with AI. Track your pipeline. That&apos;s it.
        </p>
        <Link
          href="/auth/signup"
          className="lp-hero-text-3"
          style={{
            display: 'inline-block',
            background: '#C7A94E',
            color: '#0C0C0E',
            padding: '12px 28px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.01em',
            marginBottom: '5rem',
          }}
        >
          Start for free
        </Link>

        {/* Dashboard screenshot */}
        <div
          className="lp-hero-shot"
          style={{
            width: '100%',
            maxWidth: '860px',
            transform: 'perspective(1200px) rotateX(4deg)',
            transformOrigin: 'top center',
            boxShadow: '0 32px 100px rgba(199,169,78,0.09), 0 60px 140px rgba(0,0,0,0.7)',
            borderRadius: '10px',
          }}
        >
          <BrowserFrame url="fieldwork.app/dashboard">
            <DashboardMockup />
          </BrowserFrame>
        </div>
      </section>

      {/* ── FEATURE SHOWCASE ── */}
      <section style={{ padding: '7rem 1.5rem', maxWidth: '1060px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8rem' }}>
          {features.map((f) => (
            <FadeIn key={f.id}>
              <div className="lp-feature-grid">
                {/* Text block */}
                <div
                  className={f.flip ? 'lp-feature-flip' : ''}
                  style={{ order: f.flip ? 1 : 0 }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#C7A94E',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginBottom: '1rem',
                    }}
                  >
                    {f.label}
                  </div>
                  <h2
                    style={{
                      fontSize: 'clamp(1.4rem, 2.5vw, 2rem)',
                      fontWeight: 400,
                      lineHeight: 1.3,
                      color: '#E8E6E1',
                      margin: '0 0 1.25rem',
                    }}
                  >
                    {f.heading}
                  </h2>
                  <p
                    style={{
                      fontSize: '15px',
                      color: '#6a6a72',
                      lineHeight: 1.7,
                      margin: 0,
                    }}
                  >
                    {f.body}
                  </p>
                </div>

                {/* Visual block */}
                <div style={{ order: f.flip ? 0 : 1 }}>
                  <div
                    style={{
                      boxShadow:
                        '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
                      borderRadius: '10px',
                      overflow: 'hidden',
                    }}
                  >
                    <BrowserFrame url={f.url}>{f.visual}</BrowserFrame>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── COMPARISON LINE ── */}
      <FadeIn>
        <div
          style={{
            textAlign: 'center',
            padding: '0 1.5rem 7rem',
          }}
        >
          <p style={{ fontSize: '14px', color: '#585862', margin: 0, maxWidth: '480px', marginInline: 'auto', lineHeight: 1.7 }}>
            Instrumentl charges $299–$899/month and makes you book a sales call.{' '}
            <span style={{ color: '#8a8a8f' }}>We start free.</span>
          </p>
        </div>
      </FadeIn>

      {/* ── PRICING ── */}
      <section
        style={{
          padding: '0 1.5rem 7rem',
          maxWidth: '1060px',
          margin: '0 auto',
        }}
      >
        <FadeIn>
          {/* Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              marginBottom: '3rem',
            }}
          >
            <button
              onClick={() => setBilling('monthly')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: billing === 'monthly' ? '#E8E6E1' : '#484852',
                padding: 0,
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling(billing === 'monthly' ? 'annual' : 'monthly')}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                border: 'none',
                background: billing === 'annual' ? '#C7A94E' : '#1e1e26',
                cursor: 'pointer',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: billing === 'annual' ? '19px' : '3px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#E8E6E1',
                  transition: 'left 150ms ease',
                }}
              />
            </button>
            <button
              onClick={() => setBilling('annual')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                color: billing === 'annual' ? '#E8E6E1' : '#484852',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Annual
              <span
                style={{
                  fontSize: '11px',
                  color: '#C7A94E',
                  background: 'rgba(199,169,78,0.1)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                }}
              >
                Save 17%
              </span>
            </button>
          </div>
        </FadeIn>

        {/* Cards */}
        <FadeIn delay={100}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '1px',
              background: '#1a1a22',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {[
              {
                name: 'Free',
                price: 0,
                features: ['3 grants', 'Pipeline', 'Fit scoring'],
                cta: 'Start Free',
                popular: false,
              },
              {
                name: 'Starter',
                price: prices.starter,
                features: ['15 grants', 'AI search', 'Snippets', 'CSV export'],
                cta: 'Start Starter',
                popular: false,
              },
              {
                name: 'Pro',
                price: prices.pro,
                features: [
                  'Unlimited grants',
                  'AI drafting',
                  'Auto-draft full apps',
                  'Export',
                  'Notifications',
                ],
                cta: 'Start Pro',
                popular: true,
              },
              {
                name: 'Team',
                price: prices.team,
                features: [
                  'Everything in Pro',
                  'Team members',
                  'Spend-down tracking (soon)',
                ],
                cta: 'Start Team',
                popular: false,
              },
            ].map((tier) => (
              <div
                key={tier.name}
                className="lp-pricing-card"
                style={{
                  background: tier.popular ? '#141416' : '#0e0e11',
                  padding: '2rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#8a8a8f', fontWeight: 500 }}>
                    {tier.name}
                  </span>
                  {tier.popular && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#C7A94E',
                        border: '1px solid rgba(199,169,78,0.22)',
                        padding: '2px 7px',
                        borderRadius: '3px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Popular
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: '1.75rem' }}>
                  <span
                    style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.02em' }}
                  >
                    {tier.price === 0 ? '$0' : `$${tier.price}`}
                  </span>
                  {tier.price > 0 && (
                    <span style={{ fontSize: '12px', color: '#484852', marginLeft: '4px' }}>
                      /mo
                    </span>
                  )}
                </div>
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '0 0 2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    flex: 1,
                  }}
                >
                  {tier.features.map((feat) => (
                    <li key={feat} style={{ fontSize: '12px', color: '#6a6a72' }}>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/signup"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '9px 0',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontWeight: 500,
                    textDecoration: 'none',
                    background: tier.popular ? '#C7A94E' : 'transparent',
                    color: tier.popular ? '#0C0C0E' : '#6a6a72',
                    border: tier.popular ? 'none' : '1px solid #1e1e26',
                  }}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Indigenous discount */}
        <FadeIn delay={200}>
          <p
            style={{
              marginTop: '2rem',
              textAlign: 'center',
              fontSize: '13px',
              color: '#585862',
            }}
          >
            50% off for Indigenous and tribal organizations.{' '}
            <span style={{ color: '#E8E6E1' }}>Code: INDIGENOUS50</span>
          </p>
        </FadeIn>
      </section>

      {/* ── TRUST + FOOTER ── */}
      <FadeIn>
        <section
          style={{
            padding: '5rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '15px', color: '#E8E6E1', margin: '0 0 0.75rem' }}>
            Built by a grant writer who got tired of tools that cost more than the grants themselves.
          </p>
          <p style={{ fontSize: '13px', color: '#585862', margin: '0 0 2rem' }}>
            Trusted by tribal organizations and nonprofits across the country.
          </p>
          <p style={{ fontSize: '12px', color: '#32323c', margin: 0 }}>© 2026 Fieldwork</p>
        </section>
      </FadeIn>
    </div>
  )
}
