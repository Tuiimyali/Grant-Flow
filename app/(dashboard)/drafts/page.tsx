'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DeadlineBadge } from '@/components/badges'
import { useGrants } from '@/lib/hooks/use-grants'
import { useDrafts, type SaveStatus } from '@/lib/hooks/use-drafts'
import { useSnippets } from '@/lib/hooks/use-snippets'
import { SNIPPET_CATEGORIES } from '@/lib/types/database.types'
import { formatCurrency, formatDeadline } from '@/lib/utils/formatting'
import { exportDraftAsDocx } from '@/lib/utils/export-draft'
import { toast } from '@/lib/toast'
import type {
  GrantsFullRow,
  GrantSection,
  SnippetRow,
  SnippetCategory,
} from '@/lib/types/database.types'

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
    console.log(
      '[drafts] all grants:',
      grants.map((g) => ({ id: g.id, name: g.name, status: g.pipeline_status }))
    )
    const filtered = grants
      .filter((g) => WORKING_STATUSES.has(g.pipeline_status))
      .sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      })
    console.log(
      '[drafts] working grants (writing/submitted):',
      filtered.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.pipeline_status,
      }))
    )
    return filtered
  }, [grants])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [showSnippetPicker, setShowSnippetPicker] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedGrant = workingGrants.find((g) => g.id === selectedId) ?? null

  const {
    detail,
    contents,
    versions,
    loading: draftLoading,
    saveStatus,
    updateContent,
    saveDraft,
  } = useDrafts(selectedId)

  const sections: GrantSection[] = detail?.sections ?? []

  useEffect(() => {
    if (
      sections.length > 0 &&
      !sections.find((s) => s.title === selectedSection)
    ) {
      setSelectedSection(sections[0].title)
    }
  }, [sections, selectedSection])

  function selectGrant(g: GrantsFullRow) {
    console.log('[drafts] grant clicked:', {
      id: g.id,
      name: g.name,
      status: g.pipeline_status,
    })
    setSelectedId(g.id)
    setSelectedSection(null)
  }

  const activeSection =
    sections.find((s) => s.title === selectedSection) ?? null
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
      const json = (await res.json()) as {
        content?: string
        error?: string
        detail?: string
      }
      if (!res.ok || !json.content) {
        throw new Error(
          `${json.error ?? 'No content returned'}${json.detail ? ` — ${json.detail}` : ''}`
        )
      }
      updateContent(activeSection.title, json.content)
      setTimeout(() => textareaRef.current?.focus(), 0)
    } catch (err) {
      console.error('[AI Draft] error:', err)
    } finally {
      setAiLoading(false)
    }
  }

  const hasContent = sections.some((s) => contents[s.title]?.trim())

  async function handleExport() {
    if (!selectedGrant || !hasContent) return
    setExportLoading(true)
    try {
      await exportDraftAsDocx({
        grantName: selectedGrant.name,
        funder: selectedGrant.funder,
        deadline: selectedGrant.deadline,
        orgName: 'My Organization',
        sections,
        contents,
      })
      toast('Application exported successfully', 'success', 3000)
    } catch (err) {
      console.error('[Export] error:', err)
      toast('Export failed', 'error')
    } finally {
      setExportLoading(false)
    }
  }

  function handleInsertSnippet(snippet: SnippetRow) {
    if (!activeSection) return
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? activeContent.length
    const end = textarea?.selectionEnd ?? activeContent.length
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
    sections: sections.map((s) => s.title),
    activeSection: activeSection?.title ?? null,
    draftLoading,
    contentsKeys: Object.keys(contents),
  })

  return (
    <div
      className="flex h-full min-h-0 overflow-hidden"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* ── Left: Grant list ────────────────────────────────── */}
      <aside
        className="w-[248px] shrink-0 flex flex-col overflow-hidden"
        style={{
          borderRight: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-dim)' }}
          >
            Active Drafts
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {grantsLoading ? (
            <GrantListSkeleton />
          ) : workingGrants.length === 0 ? (
            <div className="px-4 py-10 flex flex-col items-center text-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <svg
                  className="w-5 h-5"
                  style={{ color: 'var(--text-dim)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                  />
                </svg>
              </div>
              <div>
                <p
                  className="text-xs font-semibold mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  No active drafts
                </p>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Move a grant to{' '}
                  <span className="font-medium" style={{ color: '#a78bfa' }}>
                    Writing
                  </span>{' '}
                  status in the Pipeline to start drafting.
                </p>
              </div>
            </div>
          ) : (
            <ul className="py-1">
              {workingGrants.map((g) => (
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
      <main
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        {!selectedGrant ? (
          <EmptyEditor />
        ) : (
          <>
            {/* Grant title bar */}
            <div
              className="px-5 py-3 flex items-center justify-between gap-4 shrink-0"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="min-w-0">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {selectedGrant.name}
                </p>
                {selectedGrant.funder && (
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {selectedGrant.funder}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DeadlineBadge date={selectedGrant.deadline} />
                <div className="relative group">
                  <button
                    onClick={handleExport}
                    disabled={!hasContent || exportLoading}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                      disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.color =
                        'var(--text-primary)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.color =
                        'var(--text-secondary)'
                    }}
                  >
                    {exportLoading ? (
                      <svg
                        className="animate-spin w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                      </svg>
                    )}
                    Export Word
                  </button>
                  {!hasContent && (
                    <div
                      className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block w-52 rounded-lg px-3 py-2 text-[11px] shadow-lg"
                      style={{
                        backgroundColor: 'var(--surface-3)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Write at least one section before exporting
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section tabs */}
            {sections.length > 0 && (
              <div
                className="flex items-center gap-1 px-4 py-2 overflow-x-auto shrink-0"
                style={{
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-2)',
                }}
              >
                {sections.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => setSelectedSection(s.title)}
                    className="shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap"
                    style={
                      s.title === selectedSection
                        ? {
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }
                        : {
                            color: 'var(--text-dim)',
                            border: '1px solid transparent',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (s.title !== selectedSection) {
                        ;(e.currentTarget as HTMLElement).style.color =
                          'var(--text-secondary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (s.title !== selectedSection) {
                        ;(e.currentTarget as HTMLElement).style.color =
                          'var(--text-dim)'
                      }
                    }}
                  >
                    {s.title}
                    {s.page_limit && (
                      <span
                        className="ml-1.5 font-normal"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {s.page_limit}p
                      </span>
                    )}
                    {wordCount(contents[s.title] ?? '') > 0 && (
                      <span
                        className="ml-1.5 w-1.5 h-1.5 rounded-full inline-block align-middle"
                        style={{ backgroundColor: '#a78bfa' }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Editor body */}
            <div className="flex-1 flex flex-col min-h-0">
              {draftLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <span
                    className="text-xs animate-pulse"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    Loading drafts…
                  </span>
                </div>
              ) : sections.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    No sections defined
                  </p>
                  <p
                    className="text-xs max-w-xs"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    Add sections to this grant from Grant Discovery to start
                    writing.
                  </p>
                </div>
              ) : !activeSection ? null : (
                <>
                  <textarea
                    ref={textareaRef}
                    key={`${selectedId}__${selectedSection}`}
                    value={activeContent}
                    onChange={(e) =>
                      updateContent(activeSection.title, e.target.value)
                    }
                    onBlur={() => saveDraft(activeSection.title)}
                    placeholder={`Write the "${activeSection.title}" section here…`}
                    className="flex-1 w-full resize-none px-6 py-5 text-sm leading-relaxed focus:outline-none font-mono"
                    style={{
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text-primary)',
                    }}
                    spellCheck
                  />
                  {/* Status bar */}
                  <div
                    className="shrink-0 flex items-center justify-between px-6 py-2 text-[11px]"
                    style={{
                      borderTop: '1px solid var(--border)',
                      backgroundColor: 'var(--surface-2)',
                      color: 'var(--text-dim)',
                    }}
                  >
                    <span className="flex items-center gap-3 tabular-nums">
                      <span>
                        {wordCount(activeContent).toLocaleString()} words
                        {(() => {
                          const est = pageEstimate(
                            wordCount(activeContent),
                            activeSection.page_limit
                          )
                          return est ? (
                            <span
                              className="ml-2"
                              style={{ color: 'var(--text-dim)', opacity: 0.6 }}
                            >
                              · {est}
                            </span>
                          ) : null
                        })()}
                      </span>
                      {(versions[activeSection.title] ?? 0) > 0 && (
                        <span style={{ opacity: 0.5 }}>
                          v{versions[activeSection.title]}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      <SaveIndicator status={saveStatus} />
                      <button
                        onClick={() => setShowSnippetPicker(true)}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors"
                        style={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.color =
                            'var(--text-primary)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.color =
                            'var(--text-secondary)'
                        }}
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10
                              A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385
                              A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10
                              A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"
                          />
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
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                        style={{
                          backgroundColor: 'rgba(139,92,246,0.12)',
                          border: '1px solid rgba(139,92,246,0.25)',
                          color: '#a78bfa',
                        }}
                        onMouseEnter={(e) => {
                          ;(
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = 'rgba(139,92,246,0.2)'
                        }}
                        onMouseLeave={(e) => {
                          ;(
                            e.currentTarget as HTMLElement
                          ).style.backgroundColor = 'rgba(139,92,246,0.12)'
                        }}
                      >
                        {aiLoading ? (
                          <>
                            <svg
                              className="animate-spin w-3 h-3"
                              viewBox="0 0 24 24"
                              fill="none"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                              />
                            </svg>
                            Generating…
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-3 h-3"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                            </svg>
                            AI Draft
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => saveDraft(activeSection.title)}
                        disabled={saveStatus === 'saving'}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40"
                        style={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLElement).style.color =
                            'var(--text-primary)'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLElement).style.color =
                            'var(--text-secondary)'
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  {showSnippetPicker && (
                    <SnippetPickerModal
                      snippets={snippets}
                      onInsert={handleInsertSnippet}
                      onClose={() => setShowSnippetPicker(false)}
                    />
                  )}

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
      <aside
        className="w-[272px] shrink-0 flex flex-col overflow-hidden"
        style={{
          borderLeft: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
        }}
      >
        <div
          className="px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-dim)' }}
          >
            Requirements
          </h2>
        </div>

        {!selectedGrant ? (
          <div className="flex-1 flex items-center justify-center px-4">
            <p
              className="text-xs text-center"
              style={{ color: 'var(--text-dim)' }}
            >
              Select a grant to see requirements.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Quick facts */}
            <div
              className="px-4 py-3 space-y-2"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--text-dim)' }}
              >
                Quick Facts
              </p>

              <QuickFact label="Deadline">
                {selectedGrant.deadline
                  ? formatDeadline(selectedGrant.deadline)
                  : '—'}
              </QuickFact>
              <QuickFact label="Amount">
                {selectedGrant.amount_low != null &&
                selectedGrant.amount_high != null
                  ? `${formatCurrency(selectedGrant.amount_low, { compact: true })} – ${formatCurrency(selectedGrant.amount_high, { compact: true })}`
                  : selectedGrant.amount_high != null
                    ? `Up to ${formatCurrency(selectedGrant.amount_high, { compact: true })}`
                    : selectedGrant.amount_low != null
                      ? `From ${formatCurrency(selectedGrant.amount_low, { compact: true })}`
                      : '—'}
              </QuickFact>
              <QuickFact label="Funder">
                {selectedGrant.funder ?? '—'}
              </QuickFact>
              <QuickFact label="Category">
                {selectedGrant.category ?? '—'}
              </QuickFact>
              {selectedGrant.effort_weeks != null && (
                <QuickFact label="Effort">
                  {selectedGrant.effort_weeks}w estimated
                </QuickFact>
              )}
            </div>

            {/* Sections checklist */}
            {sections.length > 0 && (
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Sections ({sections.length})
                </p>
                <div className="space-y-1">
                  {sections.map((s) => {
                    const words = wordCount(contents[s.title] ?? '')
                    const started = words > 0
                    return (
                      <button
                        key={s.title}
                        onClick={() => setSelectedSection(s.title)}
                        className="w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-1.5 transition-colors"
                        style={{
                          backgroundColor:
                            s.title === selectedSection
                              ? 'var(--surface-2)'
                              : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (s.title !== selectedSection)
                            (
                              e.currentTarget as HTMLElement
                            ).style.backgroundColor = 'var(--surface-2)'
                        }}
                        onMouseLeave={(e) => {
                          if (s.title !== selectedSection)
                            (
                              e.currentTarget as HTMLElement
                            ).style.backgroundColor = ''
                        }}
                      >
                        <span
                          className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-full border-2 flex items-center justify-center"
                          style={
                            started
                              ? {
                                  borderColor: '#a78bfa',
                                  backgroundColor: '#a78bfa',
                                }
                              : {
                                  borderColor: 'var(--border-2)',
                                  backgroundColor: 'transparent',
                                }
                          }
                        >
                          {started && (
                            <svg
                              className="w-2 h-2 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-xs font-medium truncate leading-snug"
                            style={{
                              color: started
                                ? 'var(--text-primary)'
                                : 'var(--text-dim)',
                            }}
                          >
                            {s.title}
                          </p>
                          <p
                            className="text-[11px] tabular-nums"
                            style={{ color: 'var(--text-dim)' }}
                          >
                            {s.page_limit
                              ? `${s.page_limit}p limit`
                              : 'No page limit'}
                            {started && (
                              <span className="ml-1.5">
                                · {words.toLocaleString()}w
                              </span>
                            )}
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
              <div
                className="px-4 py-3"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-dim)' }}
                >
                  Attachments ({detail!.attachments!.length})
                </p>
                <div className="space-y-1.5">
                  {detail!.attachments!.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-2 py-1"
                    >
                      <span
                        className="w-3.5 h-3.5 shrink-0 rounded border-2"
                        style={{
                          borderColor: 'var(--border-2)',
                          backgroundColor: 'transparent',
                        }}
                      />
                      <p
                        className="text-xs leading-snug"
                        style={{ color: 'var(--text-dim)' }}
                      >
                        {a.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {!draftLoading && detail?.description && (
              <div className="px-4 py-3">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                  style={{ color: 'var(--text-dim)' }}
                >
                  About
                </p>
                <p
                  className="text-xs leading-relaxed line-clamp-6"
                  style={{ color: 'var(--text-dim)' }}
                >
                  {detail.description}
                </p>
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
        className="w-full text-left px-4 py-3 transition-colors border-r-2"
        style={{
          backgroundColor: selected ? 'rgba(139,92,246,0.08)' : undefined,
          borderRightColor: selected ? '#a78bfa' : 'transparent',
        }}
        onMouseEnter={(e) => {
          if (!selected)
            (e.currentTarget as HTMLElement).style.backgroundColor =
              'var(--surface-2)'
        }}
        onMouseLeave={(e) => {
          if (!selected)
            (e.currentTarget as HTMLElement).style.backgroundColor = ''
        }}
      >
        <p
          className="text-xs font-semibold leading-snug line-clamp-2 mb-1"
          style={{
            color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {g.name}
        </p>
        {g.funder && (
          <p
            className="text-[11px] truncate mb-1.5"
            style={{ color: 'var(--text-dim)' }}
          >
            {g.funder}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            style={
              g.pipeline_status === 'writing'
                ? { backgroundColor: 'rgba(139,92,246,0.12)', color: '#a78bfa' }
                : {
                    backgroundColor: 'rgba(199,169,78,0.12)',
                    color: 'var(--gold)',
                  }
            }
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{
                backgroundColor:
                  g.pipeline_status === 'writing' ? '#a78bfa' : 'var(--gold)',
              }}
            />
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
  if (status === 'idle') return null
  if (status === 'saving')
    return (
      <span
        className="flex items-center gap-1"
        style={{ color: 'var(--text-dim)' }}
      >
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
          />
        </svg>
        Saving…
      </span>
    )
  if (status === 'saved')
    return <span style={{ color: 'var(--success)' }}>Saved</span>
  return <span style={{ color: 'var(--danger)' }}>Save failed</span>
}

/* ── Quick fact row ─────────────────────────────────────────── */

function QuickFact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-[10px] font-semibold uppercase tracking-wide w-16 shrink-0"
        style={{ color: 'var(--text-dim)' }}
      >
        {label}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        {children}
      </span>
    </div>
  )
}

/* ── Empty / skeleton states ────────────────────────────────── */

function EmptyEditor() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-10">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          backgroundColor: 'var(--surface-2)',
          border: '1px solid var(--border)',
        }}
      >
        <svg
          className="w-6 h-6"
          style={{ color: 'var(--text-dim)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
          />
        </svg>
      </div>
      <div>
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Move a grant to Writing to start drafting
        </p>
        <p
          className="text-xs mt-1.5 leading-relaxed max-w-xs"
          style={{ color: 'var(--text-dim)' }}
        >
          Open the Pipeline, move a grant to{' '}
          <span className="font-medium" style={{ color: '#a78bfa' }}>
            Writing
          </span>{' '}
          status, then select it here to begin.
        </p>
      </div>
    </div>
  )
}

/* ── Snippet picker modal ────────────────────────────────────── */

const CATEGORY_COLORS: Record<SnippetCategory, string> = {
  'Mission & Vision': 'bg-blue-500/10   text-blue-400   border-blue-500/20',
  'Community Description':
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Organization Background':
    'bg-amber-500/10  text-amber-400  border-amber-500/20',
  'Project Team': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Budget Justification':
    'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Data & Outcomes': 'bg-cyan-500/10   text-cyan-400   border-cyan-500/20',
  'Letters of Support': 'bg-rose-500/10   text-rose-400   border-rose-500/20',
  General: 'bg-slate-500/10  text-slate-400  border-slate-500/20',
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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return snippets
    const q = search.toLowerCase()
    return snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    )
  }, [snippets, search])

  const grouped = useMemo(() => {
    const map: Partial<Record<SnippetCategory, SnippetRow[]>> = {}
    for (const s of filtered) {
      if (!map[s.category]) map[s.category] = []
      map[s.category]!.push(s)
    }
    return SNIPPET_CATEGORIES.filter((c) => map[c]?.length).map((c) => ({
      category: c,
      items: map[c]!,
    }))
  }, [filtered])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="rounded-2xl w-full max-w-md flex flex-col max-h-[75vh]"
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
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            Insert Snippet
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color =
                'var(--text-primary)'
              ;(e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--surface-2)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
              ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div
          className="px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--text-dim)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z"
              />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search snippets…"
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2 focus:border-transparent"
              style={
                {
                  backgroundColor: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  '--tw-ring-color': 'var(--gold)',
                } as React.CSSProperties
              }
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No snippets found
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                Try a different search term
              </p>
            </div>
          ) : (
            grouped.map(({ category, items }) => (
              <div key={category}>
                <div className="px-4 pt-3 pb-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {category}
                  </p>
                </div>
                {items.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onInsert(s)}
                    className="w-full text-left px-4 py-2.5 transition-colors"
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor =
                        'var(--surface-2)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLElement).style.backgroundColor =
                        ''
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <p
                        className="text-xs font-semibold"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {s.title}
                      </p>
                      <span
                        className={`inline-flex rounded-full border px-1.5 py-0 text-[10px] font-medium
                        ${CATEGORY_COLORS[s.category]}`}
                      >
                        {s.word_count}w
                      </span>
                    </div>
                    <p
                      className="text-[11px] line-clamp-2 leading-relaxed"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      {s.content.slice(0, 120)}
                      {s.content.length > 120 ? '…' : ''}
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="rounded-2xl w-full max-w-sm"
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              style={{ color: '#a78bfa' }}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
            </svg>
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              AI Draft
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-dim)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.color =
                'var(--text-primary)'
              ;(e.currentTarget as HTMLElement).style.backgroundColor =
                'var(--surface-2)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'
              ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
            }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
            This section already has content. What would you like to do?
          </p>
          <button
            onClick={onGenerate}
            className="w-full flex items-start gap-3 rounded-xl px-4 py-3 transition-colors text-left"
            style={{ border: '1px solid var(--border)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor =
                'rgba(139,92,246,0.08)'
              ;(e.currentTarget as HTMLElement).style.borderColor =
                'rgba(139,92,246,0.3)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
              ;(e.currentTarget as HTMLElement).style.borderColor =
                'var(--border)'
            }}
          >
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: '#a78bfa' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <div>
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Generate new draft
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: 'var(--text-dim)' }}
              >
                Replace current content with a fresh AI-generated draft
              </p>
            </div>
          </button>
          <button
            onClick={onImprove}
            className="w-full flex items-start gap-3 rounded-xl px-4 py-3 transition-colors text-left"
            style={{ border: '1px solid var(--border)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor =
                'rgba(139,92,246,0.08)'
              ;(e.currentTarget as HTMLElement).style.borderColor =
                'rgba(139,92,246,0.3)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.backgroundColor = ''
              ;(e.currentTarget as HTMLElement).style.borderColor =
                'var(--border)'
            }}
          >
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              style={{ color: '#a78bfa' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
              />
            </svg>
            <div>
              <p
                className="text-xs font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                Improve existing draft
              </p>
              <p
                className="text-[11px] mt-0.5"
                style={{ color: 'var(--text-dim)' }}
              >
                Rewrite current content to be more compelling and specific
              </p>
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
          <div
            className="h-3 rounded w-4/5"
            style={{ backgroundColor: 'var(--surface-3)' }}
          />
          <div
            className="h-2.5 rounded w-3/5"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
          <div
            className="h-4 rounded-full w-16 mt-1"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
        </li>
      ))}
    </ul>
  )
}
