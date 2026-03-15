'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DeadlineBadge } from '@/components/badges'
import { useGrants } from '@/lib/hooks/use-grants'
import { useDrafts, type SaveStatus } from '@/lib/hooks/use-drafts'
import { useSnippets } from '@/lib/hooks/use-snippets'
import { SNIPPET_CATEGORIES } from '@/lib/types/database.types'
import { formatCurrency, formatDeadline } from '@/lib/utils/formatting'
import type { GrantsFullRow, GrantSection, SnippetRow, SnippetCategory } from '@/lib/types/database.types'

/* ── Constants ──────────────────────────────────────────────── */

const WORKING_STATUSES = new Set(['writing', 'submitted'])

/* ── Helpers ────────────────────────────────────────────────── */

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function pageEstimate(words: number, pageLimit: number | null): string | null {
  if (!pageLimit) return null
  const approxWords = pageLimit * 250
  const pct = Math.min(Math.round((words / approxWords) * 100), 100)
  return `${pct}% of ~${pageLimit}p`
}

/* ── Page ───────────────────────────────────────────────────── */

export default function DraftsPage() {
  const { grants, loading: grantsLoading } = useGrants()
  const { snippets, incrementUsed } = useSnippets()

  const workingGrants = useMemo(() => {
    console.log('[drafts] all grants:', grants.map(g => ({ id: g.id, name: g.name, status: g.pipeline_status })))
    const filtered = grants
      .filter(g => WORKING_STATUSES.has(g.pipeline_status))
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      })
    console.log('[drafts] working grants (writing/submitted):', filtered.map(g => ({ id: g.id, name: g.name, status: g.pipeline_status })))
    return filtered
  }, [grants])

  const [selectedId,        setSelectedId]        = useState<string | null>(null)
  const [selectedSection,   setSelectedSection]   = useState<string | null>(null)
  const [showSnippetPicker, setShowSnippetPicker] = useState(false)
  const [aiLoading,         setAiLoading]         = useState(false)
  const [showAiModal,       setShowAiModal]       = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedGrant = workingGrants.find(g => g.id === selectedId) ?? null

  const { detail, contents, versions, loading: draftLoading, saveStatus, updateContent, saveDraft } = useDrafts(selectedId)

  const sections: GrantSection[] = detail?.sections ?? []

  // Auto-select first section when sections load or grant changes
  useEffect(() => {
    if (sections.length > 0 && !sections.find(s => s.title === selectedSection)) {
      setSelectedSection(sections[0].title)
    }
  }, [sections, selectedSection])

  function selectGrant(g: GrantsFullRow) {
    console.log('[drafts] grant clicked:', { id: g.id, name: g.name, status: g.pipeline_status })
    setSelectedId(g.id)
    setSelectedSection(null)
  }

  const activeSection = sections.find(s => s.title === selectedSection) ?? null
  const activeContent = selectedSection ? (contents[selectedSection] ?? '') : ''

  async function handleAiDraft(mode: 'generate' | 'improve') {
    if (!activeSection || !selectedId) return
    setShowAiModal(false)
    setAiLoading(true)
    try {
      const res = await fetch('/api/draft-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantId: selectedId,
          sectionTitle: activeSection.title,
          pageLimit: activeSection.page_limit,
          mode,
          existingContent: activeContent,
        }),
      })
      const json = await res.json() as { content?: string; error?: string; detail?: string }
      if (!res.ok || !json.content) {
        throw new Error(`${json.error ?? 'No content returned'}${json.detail ? ` — ${json.detail}` : ''}`)
      }
      updateContent(activeSection.title, json.content)
      setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (err) {
      console.error('[AI Draft] error:', err)
    } finally {
      setAiLoading(false)
    }
  }

  function handleInsertSnippet(snippet: SnippetRow) {
    if (!activeSection) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? activeContent.length
    const end   = textarea?.selectionEnd   ?? activeContent.length
    const newContent =
      activeContent.substring(0, start) +
      snippet.content +
      activeContent.substring(end)
    updateContent(activeSection.title, newContent)
    const newCursor = start + snippet.content.length
    setTimeout(() => {
      textarea?.focus()
      textarea?.setSelectionRange(newCursor, newCursor)
    }, 0)
    incrementUsed(snippet.id)
    setShowSnippetPicker(false)
  }

  console.log('[drafts] render state:', {
    selectedId,
    selectedSection,
    sectionsCount: sections.length,
    sections: sections.map(s => s.title),
    activeSection: activeSection?.title ?? null,
    draftLoading,
    contentsKeys: Object.keys(contents),
  })

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--surface)' }}>

      {/* ── Left: Grant list ────────────────────────────────── */}
      <aside className="w-[248px] shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Active Drafts</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {grantsLoading ? (
            <GrantListSkeleton />
          ) : workingGrants.length === 0 ? (
            <div className="px-4 py-10 flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">No active drafts</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Move a grant to <span className="font-medium text-violet-500">Writing</span> status in the Pipeline to start drafting.
                </p>
              </div>
            </div>
          ) : (
            <ul className="py-1">
              {workingGrants.map(g => (
                <GrantListItem
                  key={g.id}
                  grant={g}
                  selected={g.id === selectedId}
                  onClick={() => selectGrant(g)}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Center: Editor ──────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white">
        {!selectedGrant ? (
          <EmptyEditor />
        ) : (
          <>
            {/* Grant title bar */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{selectedGrant.name}</p>
                {selectedGrant.funder && (
                  <p className="text-xs text-slate-400 truncate">{selectedGrant.funder}</p>
                )}
              </div>
              <DeadlineBadge date={selectedGrant.deadline} />
            </div>

            {/* Section tabs */}
            {sections.length > 0 && (
              <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
                {sections.map(s => (
                  <button
                    key={s.title}
                    onClick={() => setSelectedSection(s.title)}
                    className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap
                      ${s.title === selectedSection
                        ? 'bg-white border border-slate-300 text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                      }`}
                  >
                    {s.title}
                    {s.page_limit && (
                      <span className="ml-1.5 text-slate-400 font-normal">{s.page_limit}p</span>
                    )}
                    {wordCount(contents[s.title] ?? '') > 0 && (
                      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-violet-400 inline-block align-middle" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Editor body */}
            <div className="flex-1 flex flex-col min-h-0">
              {draftLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xs text-slate-400 animate-pulse">Loading drafts…</span>
                </div>
              ) : sections.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
                  <p className="text-sm font-medium text-slate-600">No sections defined</p>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Add sections to this grant from Grant Discovery to start writing.
                  </p>
                </div>
              ) : !activeSection ? null : (
                <>
                  <textarea
                    ref={textareaRef}
                    key={`${selectedId}__${selectedSection}`}
                    value={activeContent}
                    onChange={e => updateContent(activeSection.title, e.target.value)}
                    onBlur={() => saveDraft(activeSection.title)}
                    placeholder={`Write the "${activeSection.title}" section here…`}
                    className="flex-1 w-full resize-none px-6 py-5 text-sm text-slate-800 leading-relaxed
                      bg-white focus:outline-none font-mono placeholder:text-slate-300 placeholder:font-sans"
                    spellCheck
                  />
                  {/* Status bar */}
                  <div className="shrink-0 flex items-center justify-between px-6 py-2
                    border-t border-slate-100 bg-slate-50 text-[11px] text-slate-400">
                    <span className="flex items-center gap-3 tabular-nums">
                      <span>
                        {wordCount(activeContent).toLocaleString()} words
                        {(() => {
                          const est = pageEstimate(wordCount(activeContent), activeSection.page_limit)
                          return est ? <span className="ml-2 text-slate-300">· {est}</span> : null
                        })()}
                      </span>
                      {(versions[activeSection.title] ?? 0) > 0 && (
                        <span className="text-slate-300">
                          v{versions[activeSection.title]}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <SaveIndicator status={saveStatus} />
                      <button
                        onClick={() => setShowSnippetPicker(true)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px]
                          font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900
                          transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10
                              A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385
                              A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10
                              A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                        </svg>
                        Snippets
                      </button>
                      <button
                        onClick={() => {
                          if (activeContent.trim()) {
                            setShowAiModal(true)
                          } else {
                            handleAiDraft('generate')
                          }
                        }}
                        disabled={aiLoading}
                        className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-[11px]
                          font-medium text-violet-700 hover:border-violet-400 hover:bg-violet-100
                          disabled:opacity-40 transition-colors flex items-center gap-1"
                      >
                        {aiLoading ? (
                          <>
                            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10"
                                stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor"
                                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
                            </svg>
                            Generating…
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                            </svg>
                            AI Draft
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => saveDraft(activeSection.title)}
                        disabled={saveStatus === 'saving'}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px]
                          font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900
                          disabled:opacity-40 transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {/* Snippet picker modal */}
                  {showSnippetPicker && (
                    <SnippetPickerModal
                      snippets={snippets}
                      onInsert={handleInsertSnippet}
                      onClose={() => setShowSnippetPicker(false)}
                    />
                  )}

                  {/* AI Draft mode modal */}
                  {showAiModal && (
                    <AiDraftModal
                      onGenerate={() => handleAiDraft('generate')}
                      onImprove={() => handleAiDraft('improve')}
                      onClose={() => setShowAiModal(false)}
                    />
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── Right: Requirements panel ────────────────────────── */}
      <aside className="w-[272px] shrink-0 flex flex-col border-l border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Requirements</h2>
        </div>

        {!selectedGrant ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p className="text-xs text-slate-400 text-center">Select a grant to see requirements.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">

            {/* Quick facts */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Quick Facts</p>

              <QuickFact label="Deadline">
                {selectedGrant.deadline ? formatDeadline(selectedGrant.deadline) : '—'}
              </QuickFact>
              <QuickFact label="Amount">
                {selectedGrant.amount_low != null && selectedGrant.amount_high != null
                  ? `${formatCurrency(selectedGrant.amount_low, { compact: true })} – ${formatCurrency(selectedGrant.amount_high, { compact: true })}`
                  : selectedGrant.amount_high != null
                  ? `Up to ${formatCurrency(selectedGrant.amount_high, { compact: true })}`
                  : selectedGrant.amount_low != null
                  ? `From ${formatCurrency(selectedGrant.amount_low, { compact: true })}`
                  : '—'}
              </QuickFact>
              <QuickFact label="Funder">{selectedGrant.funder ?? '—'}</QuickFact>
              <QuickFact label="Category">{selectedGrant.category ?? '—'}</QuickFact>
              {selectedGrant.effort_weeks != null && (
                <QuickFact label="Effort">{selectedGrant.effort_weeks}w estimated</QuickFact>
              )}
            </div>

            {/* Sections checklist */}
            {sections.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Sections ({sections.length})
                </p>
                <div className="space-y-1">
                  {sections.map(s => {
                    const words   = wordCount(contents[s.title] ?? '')
                    const started = words > 0
                    return (
                      <button
                        key={s.title}
                        onClick={() => setSelectedSection(s.title)}
                        className={`w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-1.5 transition-colors
                          ${s.title === selectedSection ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                      >
                        <span className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded-full border-2 flex items-center justify-center
                          ${started ? 'border-violet-400 bg-violet-400' : 'border-slate-300 bg-white'}`}>
                          {started && (
                            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24"
                              stroke="currentColor" strokeWidth={3.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-medium truncate leading-snug
                            ${started ? 'text-slate-800' : 'text-slate-500'}`}>
                            {s.title}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {s.page_limit ? `${s.page_limit}p limit` : 'No page limit'}
                            {started && <span className="ml-1.5">· {words.toLocaleString()}w</span>}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Attachments checklist */}
            {!draftLoading && (detail?.attachments?.length ?? 0) > 0 && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                  Attachments ({detail!.attachments!.length})
                </p>
                <div className="space-y-1.5">
                  {detail!.attachments!.map((a, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-2 py-1">
                      <span className="w-3.5 h-3.5 shrink-0 rounded border-2 border-slate-300 bg-white" />
                      <p className="text-xs text-slate-500 leading-snug">{a.name}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {!draftLoading && detail?.description && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">About</p>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-6">{detail.description}</p>
              </div>
            )}

          </div>
        )}
      </aside>

    </div>
  )
}

/* ── Grant list item ────────────────────────────────────────── */

function GrantListItem({
  grant: g,
  selected,
  onClick,
}: {
  grant: GrantsFullRow
  selected: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-3 transition-colors border-r-2
          ${selected
            ? 'bg-violet-50 border-violet-400'
            : 'hover:bg-slate-50 border-transparent'
          }`}
      >
        <p className={`text-xs font-semibold leading-snug line-clamp-2 mb-1
          ${selected ? 'text-slate-900' : 'text-slate-700'}`}>
          {g.name}
        </p>
        {g.funder && (
          <p className="text-[11px] text-slate-400 truncate mb-1.5">{g.funder}</p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium
            ${g.pipeline_status === 'writing'
              ? 'bg-violet-100 text-violet-700'
              : 'bg-amber-100 text-amber-700'
            }`}>
            <span className={`w-1 h-1 rounded-full ${g.pipeline_status === 'writing' ? 'bg-violet-400' : 'bg-amber-400'}`} />
            {g.pipeline_status === 'writing' ? 'Writing' : 'Submitted'}
          </span>
          {g.deadline && <DeadlineBadge date={g.deadline} />}
        </div>
      </button>
    </li>
  )
}

/* ── Save indicator ─────────────────────────────────────────── */

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle')   return null
  if (status === 'saving') return (
    <span className="flex items-center gap-1 text-slate-400">
      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
      Saving…
    </span>
  )
  if (status === 'saved') return <span className="text-emerald-500">Saved</span>
  return <span className="text-red-400">Save failed</span>
}

/* ── Quick fact row ─────────────────────────────────────────── */

function QuickFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-16 shrink-0">{label}</span>
      <span className="text-xs text-slate-700">{children}</span>
    </div>
  )
}

/* ── Empty / skeleton states ────────────────────────────────── */

function EmptyEditor() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-10">
      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
        <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">Move a grant to Writing to start drafting</p>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed max-w-xs">
          Open the Pipeline, move a grant to <span className="font-medium text-violet-500">Writing</span> status, then select it here to begin.
        </p>
      </div>
    </div>
  )
}

/* ── Snippet picker modal ────────────────────────────────────── */

const CATEGORY_COLORS: Record<SnippetCategory, string> = {
  'Mission & Vision':        'bg-blue-500/10   text-blue-600   border-blue-500/20',
  'Community Description':   'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Organization Background': 'bg-amber-500/10  text-amber-600  border-amber-500/20',
  'Project Team':            'bg-violet-500/10 text-violet-600 border-violet-500/20',
  'Budget Justification':    'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Data & Outcomes':         'bg-cyan-500/10   text-cyan-600   border-cyan-500/20',
  'Letters of Support':      'bg-rose-500/10   text-rose-500   border-rose-500/20',
  'General':                 'bg-slate-100     text-slate-600  border-slate-200',
}

function SnippetPickerModal({
  snippets,
  onInsert,
  onClose,
}: {
  snippets: SnippetRow[]
  onInsert: (snippet: SnippetRow) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const filtered = useMemo(() => {
    if (!search) return snippets
    const q = search.toLowerCase()
    return snippets.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.content.toLowerCase().includes(q),
    )
  }, [snippets, search])

  const grouped = useMemo(() => {
    const map: Partial<Record<SnippetCategory, SnippetRow[]>> = {}
    for (const s of filtered) {
      if (!map[s.category]) map[s.category] = []
      map[s.category]!.push(s)
    }
    // Return in canonical category order
    return SNIPPET_CATEGORIES
      .filter(c => map[c]?.length)
      .map(c => ({ category: c, items: map[c]! }))
  }, [filtered])

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[75vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-sm font-semibold text-slate-900">Insert Snippet</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search snippets…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-300
                focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-sm text-slate-500">No snippets found</p>
              <p className="text-xs text-slate-400 mt-1">Try a different search term</p>
            </div>
          ) : (
            grouped.map(({ category, items }) => (
              <div key={category}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {category}
                  </p>
                </div>
                {items.map(s => (
                  <button
                    key={s.id}
                    onClick={() => onInsert(s)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-xs font-semibold text-slate-800">{s.title}</p>
                      <span className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium
                        ${CATEGORY_COLORS[s.category]}`}>
                        {s.word_count}w
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {s.content.slice(0, 120)}{s.content.length > 120 ? '…' : ''}
                    </p>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ── AI Draft mode modal ─────────────────────────────────────── */

function AiDraftModal({
  onGenerate,
  onImprove,
  onClose,
}: {
  onGenerate: () => void
  onImprove: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-violet-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <h2 className="text-sm font-semibold text-slate-900">AI Draft</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-slate-500">This section already has content. What would you like to do?</p>
          <button
            onClick={onGenerate}
            className="w-full flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3
              hover:border-violet-300 hover:bg-violet-50 transition-colors text-left"
          >
            <svg className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-800">Generate new draft</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Replace current content with a fresh AI-generated draft</p>
            </div>
          </button>
          <button
            onClick={onImprove}
            className="w-full flex items-start gap-3 rounded-xl border border-slate-200 px-4 py-3
              hover:border-violet-300 hover:bg-violet-50 transition-colors text-left"
          >
            <svg className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-slate-800">Improve existing draft</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Rewrite current content to be more compelling and specific</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}

function GrantListSkeleton() {
  return (
    <ul className="py-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="px-4 py-3 space-y-1.5 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-4/5" />
          <div className="h-2.5 bg-slate-100 rounded w-3/5" />
          <div className="h-4 bg-slate-100 rounded-full w-16 mt-1" />
        </li>
      ))}
    </ul>
  )
}
