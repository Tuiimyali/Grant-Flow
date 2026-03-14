'use client'

import Link from 'next/link'

interface ActionProps {
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
  secondary?: boolean   // renders as an outlined button instead of gold
}

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ActionProps
  secondaryAction?: ActionProps
}

function ActionButton({ action }: { action: ActionProps }) {
  const secondaryCls =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 ' +
    'text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
  const primaryCls =
    'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white ' +
    'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={action.secondary ? secondaryCls : primaryCls}
        style={action.secondary ? undefined : { backgroundColor: 'var(--gold)' }}
      >
        {action.label}
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={action.secondary ? secondaryCls : primaryCls}
      style={action.secondary ? undefined : { backgroundColor: 'var(--gold)' }}
    >
      {action.label}
    </button>
  )
}

export default function PageHeader({ title, subtitle, action, secondaryAction }: PageHeaderProps) {
  return (
    <header
      style={{ borderColor: 'var(--surface-border)' }}
      className="flex items-center justify-between px-8 py-5 bg-white border-b"
    >
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>

      {(action || secondaryAction) && (
        <div className="flex items-center gap-2">
          {secondaryAction && <ActionButton action={secondaryAction} />}
          {action && <ActionButton action={action} />}
        </div>
      )}
    </header>
  )
}
