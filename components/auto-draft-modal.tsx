'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { GrantSection } from '@/lib/types/database.types'

/* ── Types ──────────────────────────────────────────────────── */

export interface GeneratedSection {
  title: string
  content: string
  wordCount: number
}

type SectionStatus = 'pending' | 'generating' | 'done' | 'error'

interface SectionState {
  section: GrantSection
  status: SectionStatus
  error?: string
}

interface AutoDraftModalProps {
  grantId: string
  grantName: string
  funder?: string | null
  sections: GrantSection[]
  existingContents: Record<string, string>
  onClose: () => void
  onComplete: (sections: GeneratedSection[]) => void
  /** Called as each section finishes, so the parent can update local content */
  onSectionComplete?: (title: string, content: string) => void
  /** If provided, "Review Drafts" navigates here instead of just closing */
  navigateOnComplete?: string
}

type Phase = 'confirm' | 'generating' | 'done'

/* ── Helpers ────────────────────────────────────────────────── */

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color: 'var(--text-dim)' }}
      onMouseEnter={(e) => {
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = 'var(--surface-2)'
      }}
      onMouseLeave={(e) => {
        ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
        ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
      }}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

/* ── Main component ─────────────────────────────────────────── */

export default function AutoDraftModal({
  grantId,
  grantName,
  funder,
  sections,
  existingContents,
  onClose,
  onComplete,
  onSectionComplete,
  navigateOnComplete,
}: AutoDraftModalProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('confirm')
  const [overwrite, setOverwrite] = useState(false)
  const [sectionStates, setSectionStates] = useState<SectionState[]>([])
  const [result, setResult] = useState<GeneratedSection[]>([])

  const filledSections = sections.filter((s) => existingContents[s.title]?.trim())
  const sectionsToDraft = overwrite
    ? sections
    : sections.filter((s) => !existingContents[s.title]?.trim())

  async function handleGenerate() {
    setPhase('generating')

    const initial: SectionState[] = sectionsToDraft.map((s) => ({
      section: s,
      status: 'pending',
    }))
    setSectionStates(initial)

    // Get org ID once for DB saves
    const supabase = createClient()
    const { data: memberRow } = await supabase
      .from('organization_members')
      .select('organization_id')
      .single()
    const orgId = (memberRow as { organization_id: string } | null)?.organization_id ?? null

    const generated: GeneratedSection[] = []

    for (let i = 0; i < sectionsToDraft.length; i++) {
      const s = sectionsToDraft[i]

      setSectionStates((prev) =>
        prev.map((row) =>
          row.section.title === s.title ? { ...row, status: 'generating' } : row
        )
      )

      try {
        const res = await fetch('/api/draft-assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grantId,
            sectionTitle: s.title,
            pageLimit: s.page_limit,
            mode: 'generate',
          }),
          signal: AbortSignal.timeout(90_000),
        })

        const json = (await res.json()) as { content?: string; error?: string; detail?: string }

        if (!res.ok || !json.content) {
          throw new Error(
            `${json.error ?? 'Failed to generate'}${json.detail ? ` — ${json.detail}` : ''}`
          )
        }

        const content = json.content
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

        // Save to drafts table
        if (orgId) {
          await supabase.from('drafts').upsert(
            {
              grant_id: grantId,
              section_title: s.title,
              section_index: sections.findIndex((sec) => sec.title === s.title),
              content,
              version: 1,
              organization_id: orgId,
            },
            { onConflict: 'grant_id,section_title' }
          )
        }

        generated.push({ title: s.title, content, wordCount })
        onSectionComplete?.(s.title, content)

        setSectionStates((prev) =>
          prev.map((row) =>
            row.section.title === s.title ? { ...row, status: 'done' } : row
          )
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed'
        setSectionStates((prev) =>
          prev.map((row) =>
            row.section.title === s.title ? { ...row, status: 'error', error: errMsg } : row
          )
        )
      }
    }

    setResult(generated)
    setPhase('done')
    onComplete(generated)
  }

  function handleReviewDrafts() {
    if (navigateOnComplete) {
      router.push(navigateOnComplete)
    } else {
      onClose()
    }
  }

  const doneCount = sectionStates.filter((s) => s.status === 'done').length
  const errorCount = sectionStates.filter((s) => s.status === 'error').length
  const currentIdx = sectionStates.findIndex((s) => s.status === 'generating')
  const totalWords = result.reduce((sum, s) => sum + s.wordCount, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
    >
      <div
        className="rounded-2xl w-full max-w-md flex flex-col max-h-[85vh]"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" style={{ color: '#a78bfa' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Auto-Draft Full Application
            </h2>
          </div>
          {phase !== 'generating' && <CloseButton onClick={onClose} />}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Confirm ──────────────────────────────────────── */}
          {phase === 'confirm' && (
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {grantName}
                </p>
                {funder && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {funder}
                  </p>
                )}
              </div>

              <div>
                <p
                  className="text-[11px] font-medium uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {sections.length} Section{sections.length !== 1 ? 's' : ''}
                </p>
                <div className="space-y-1">
                  {sections.map((s) => {
                    const hasContent = !!existingContents[s.title]?.trim()
                    const willSkip = hasContent && !overwrite
                    return (
                      <div key={s.title} className="flex items-center gap-2 text-xs py-0.5">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: hasContent ? '#a78bfa' : 'var(--border-2)' }}
                        />
                        <span
                          className="flex-1"
                          style={{ color: willSkip ? 'var(--text-dim)' : 'var(--text-primary)' }}
                        >
                          {s.title}
                        </span>
                        {s.page_limit && (
                          <span style={{ color: 'var(--text-dim)' }}>{s.page_limit}p</span>
                        )}
                        {willSkip && (
                          <span className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                            skip
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                This will use your organization profile, snippets, and the grant's review criteria
                to draft each section. Sections are generated one at a time.
              </p>

              {filledSections.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                    Existing drafts will <strong>not</strong> be overwritten unless you enable the
                    toggle below.
                  </p>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <button
                      role="switch"
                      aria-checked={overwrite}
                      onClick={() => setOverwrite((o) => !o)}
                      className="relative w-8 h-4 rounded-full transition-colors shrink-0"
                      style={{ backgroundColor: overwrite ? '#a78bfa' : 'var(--surface-3)' }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform duration-150"
                        style={{ transform: overwrite ? 'translateX(16px)' : 'translateX(0)' }}
                      />
                    </button>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      Overwrite existing drafts
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ── Generating ────────────────────────────────────── */}
          {phase === 'generating' && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                {currentIdx >= 0
                  ? `Drafting section ${currentIdx + 1} of ${sectionsToDraft.length}…`
                  : 'Finishing up…'}
              </p>
              <div className="space-y-2">
                {sectionStates.map((row) => (
                  <div key={row.section.title} className="flex items-center gap-2.5 text-xs">
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                      {row.status === 'generating' && (
                        <svg className="animate-spin w-3.5 h-3.5" style={{ color: '#a78bfa' }} viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                        </svg>
                      )}
                      {row.status === 'done' && (
                        <svg className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {row.status === 'error' && (
                        <svg className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                        </svg>
                      )}
                      {row.status === 'pending' && (
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: 'var(--border-2)' }}
                        />
                      )}
                    </span>
                    <span
                      style={{
                        color:
                          row.status === 'done'
                            ? 'var(--text-primary)'
                            : row.status === 'error'
                              ? 'var(--danger)'
                              : row.status === 'generating'
                                ? '#a78bfa'
                                : 'var(--text-dim)',
                      }}
                    >
                      {row.section.title}
                    </span>
                    {row.status === 'error' && row.error && (
                      <span
                        className="ml-auto text-[10px] truncate max-w-[140px]"
                        style={{ color: 'var(--danger)', opacity: 0.7 }}
                        title={row.error}
                      >
                        {row.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Done ──────────────────────────────────────────── */}
          {phase === 'done' && (
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2">
                {errorCount === 0 ? (
                  <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--success)' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--warning)' }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                  </svg>
                )}
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {errorCount === 0
                    ? `Draft complete — ${totalWords.toLocaleString()} words total`
                    : `${doneCount} of ${sectionsToDraft.length} sections drafted`}
                </p>
              </div>
              <div className="space-y-1.5">
                {sectionStates.map((row) => (
                  <div key={row.section.title} className="flex items-center gap-2.5 text-xs py-0.5">
                    <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                      {row.status === 'done' ? (
                        <svg className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" style={{ color: 'var(--danger)' }} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                    <span
                      className="flex-1"
                      style={{
                        color: row.status === 'done' ? 'var(--text-secondary)' : 'var(--danger)',
                      }}
                    >
                      {row.section.title}
                    </span>
                    {row.status === 'done' && (
                      <span className="tabular-nums" style={{ color: 'var(--text-dim)' }}>
                        {(result.find((r) => r.title === row.section.title)?.wordCount ?? 0).toLocaleString()}w
                      </span>
                    )}
                    {row.status === 'error' && (
                      <span className="text-[10px]" style={{ color: 'var(--danger)', opacity: 0.7 }}>
                        failed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-4 shrink-0 flex justify-end gap-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {phase === 'confirm' && (
            <>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')
                }
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={sectionsToDraft.length === 0}
                className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#a78bfa', color: '#fff' }}
              >
                Generate Full Draft ({sectionsToDraft.length})
              </button>
            </>
          )}
          {phase === 'done' && (
            <>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')
                }
              >
                Close
              </button>
              <button
                onClick={handleReviewDrafts}
                className="px-3.5 py-1.5 text-[13px] font-medium rounded-lg"
                style={{ backgroundColor: '#a78bfa', color: '#fff' }}
              >
                {navigateOnComplete ? 'Review Drafts →' : 'Review Drafts'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
