'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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

  return (
    <div
      style={{
        background: '#0C0C0E',
        color: '#E8E6E1',
        fontFamily: 'var(--font-dm-sans, "DM Sans", sans-serif)',
        minHeight: '100vh',
      }}
    >
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
        <span style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '0.01em' }}>
          Fieldwork
        </span>
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
          padding: '0 1.5rem',
        }}
      >
        <h1
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
          style={{
            background: '#C7A94E',
            color: '#0C0C0E',
            padding: '12px 28px',
            borderRadius: '4px',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.01em',
          }}
        >
          Start for free
        </Link>
      </section>

      {/* ── THREE POINTS ── */}
      <section
        style={{
          padding: '6rem 1.5rem',
          maxWidth: '900px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '3rem',
          textAlign: 'center',
        }}
      >
        {[
          'Paste a URL. We read the grant for you.',
          'AI drafts your entire application in minutes.',
          'See exactly why a grant fits — no black box.',
        ].map((text) => (
          <p
            key={text}
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: '#8a8a8f',
              margin: 0,
            }}
          >
            {text}
          </p>
        ))}
      </section>

      {/* ── PRICING ── */}
      <section
        style={{
          padding: '6rem 1.5rem',
          maxWidth: '1060px',
          margin: '0 auto',
        }}
      >
        {/* Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: '3.5rem',
          }}
        >
          <button
            onClick={() => setBilling('monthly')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              color: billing === 'monthly' ? '#E8E6E1' : '#4a4a50',
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
              background: billing === 'annual' ? '#C7A94E' : '#222228',
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
              color: billing === 'annual' ? '#E8E6E1' : '#4a4a50',
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

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1px',
            background: '#222228',
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
              features: ['Unlimited grants', 'AI drafting', 'Auto-draft full apps', 'Export', 'Notifications'],
              cta: 'Start Pro',
              popular: true,
            },
            {
              name: 'Team',
              price: prices.team,
              features: ['Everything in Pro', 'Team members', 'Spend-down tracking (coming soon)'],
              cta: 'Start Team',
              popular: false,
            },
          ].map((tier) => (
            <div
              key={tier.name}
              style={{
                background: tier.popular ? '#141416' : '#0e0e11',
                padding: '2rem 1.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
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
                      border: '1px solid rgba(199,169,78,0.25)',
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
                <span style={{ fontSize: '28px', fontWeight: 300, letterSpacing: '-0.02em' }}>
                  {tier.price === 0 ? '$0' : `$${tier.price}`}
                </span>
                {tier.price > 0 && (
                  <span style={{ fontSize: '12px', color: '#4a4a50', marginLeft: '4px' }}>
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
                {tier.features.map((f) => (
                  <li key={f} style={{ fontSize: '12px', color: '#8a8a8f' }}>
                    {f}
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
                  color: tier.popular ? '#0C0C0E' : '#8a8a8f',
                  border: tier.popular ? 'none' : '1px solid #222228',
                }}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Indigenous discount */}
        <p
          style={{
            marginTop: '2rem',
            textAlign: 'center',
            fontSize: '13px',
            color: '#8a8a8f',
          }}
        >
          50% off for Indigenous and tribal organizations.{' '}
          <span style={{ color: '#E8E6E1' }}>Code: INDIGENOUS50</span>
        </p>
      </section>

      {/* ── TRUST + FOOTER ── */}
      <section
        style={{
          padding: '6rem 1.5rem 5rem',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: '15px', color: '#E8E6E1', margin: '0 0 1rem' }}>
          Built by a grant writer, for grant writers.
        </p>
        <p style={{ fontSize: '12px', color: '#4a4a50', margin: 0 }}>
          © 2026 Fieldwork
        </p>
      </section>
    </div>
  )
}
