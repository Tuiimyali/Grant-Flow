'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import PageHeader from '@/components/page-header'
import { useSnippets } from '@/lib/hooks/use-snippets'
import { SNIPPET_CATEGORIES } from '@/lib/types/database.types'
import type { SnippetRow, SnippetCategory } from '@/lib/types/database.types'

/* ── Category colours ────────────────────────────────────────── */

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

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

/* ── Page ───────────────────────────────────────────────────── */

export default function SnippetsPage() {
  const { snippets, loading, createSnippet, updateSnippet, deleteSnippet } = useSnippets()

  const [search,   setSearch]   = useState('')
  const [catFilter, setCatFilter] = useState<SnippetCategory | 'all'>('all')
  const [modalOpen,   setModalOpen]   = useState(false)
  const [editTarget,  setEditTarget]  = useState<SnippetRow | null>(null)

  function openNew() {
    setEditTarget(null)
    setModalOpen(true)
  }

  function openEdit(s: SnippetRow) {
    setEditTarget(s)
    setModalOpen(true)
  }

  async function handleSave(data: { title: string; category: SnippetCategory; content: string }) {
    if (editTarget) {
      await updateSnippet(editTarget.id, data)
    } else {
      await createSnippet(data)
    }
    setModalOpen(false)
  }

  const filtered = useMemo(() => {
    let list = snippets
    if (catFilter !== 'all') list = list.filter(s => s.category === catFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q),
      )
    }
    return list
  }, [snippets, catFilter, search])

  const subtitle = loading
    ? 'Loading…'
    : `${snippets.length} snippet${snippets.length !== 1 ? 's' : ''}`

  return (
    <>
      {modalOpen && (
        <SnippetModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}

      <PageHeader
        title="Application Snippets"
        subtitle={subtitle + ' · Reusable content for grant applications'}
        action={{ label: '+ New Snippet', onClick: openNew }}
      />

      {/* ── Filter bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3.5 border-b border-slate-200 bg-white">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0Z" />
          </svg>
          <input
            type="search"
            placeholder="Search snippets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white
              text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2
              focus:border-transparent"
            style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
          />
        </div>

        {/* Category filter */}
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value as SnippetCategory | 'all')}
          className="py-2 pl-3 pr-8 text-sm rounded-lg border border-slate-300 bg-white text-slate-700
            focus:outline-none focus:ring-2 focus:border-transparent"
          style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
        >
          <option value="all">All categories</option>
          {SNIPPET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {(search || catFilter !== 'all') && (
          <button
            onClick={() => { setSearch(''); setCatFilter('all') }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <SnippetsSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={!!(search || catFilter !== 'all')} onNew={openNew} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(s => (
              <SnippetCard
                key={s.id}
                snippet={s}
                onEdit={() => openEdit(s)}
                onDelete={() => deleteSnippet(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

/* ── Snippet card ────────────────────────────────────────────── */

function SnippetCard({
  snippet: s,
  onEdit,
  onDelete,
}: {
  snippet: SnippetRow
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="group relative bg-white rounded-xl border border-slate-200 p-4
      hover:border-slate-300 hover:shadow-sm transition-all flex flex-col gap-3">

      {/* Delete confirmation overlay */}
      {confirming && (
        <div className="absolute inset-0 z-10 bg-white rounded-xl border border-red-200
          flex flex-col items-center justify-center gap-3 p-5">
          <p className="text-sm font-medium text-slate-700 text-center">
            Delete &ldquo;{s.title}&rdquo;?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-300
                text-slate-600 hover:border-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white
                hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium
          ${CATEGORY_COLORS[s.category]}`}>
          {s.category}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
              hover:bg-slate-100 transition-colors"
            title="Edit snippet"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07
                  a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
          </button>
          <button
            onClick={() => setConfirming(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500
              hover:bg-red-50 transition-colors"
            title="Delete snippet"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21
                  c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673
                  a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077
                  L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397
                  m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397
                  m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201
                  a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916
                  m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-900 leading-snug">{s.title}</h3>

      {/* Preview */}
      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 flex-1">
        {s.content.slice(0, 160)}{s.content.length > 160 ? '…' : ''}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-100">
        <span>{s.word_count} words</span>
        {s.times_used > 0 && <span>Used {s.times_used}×</span>}
      </div>
    </div>
  )
}

/* ── New / Edit modal ────────────────────────────────────────── */

function SnippetModal({
  initial,
  onSave,
  onClose,
}: {
  initial: SnippetRow | null
  onSave: (data: { title: string; category: SnippetCategory; content: string }) => Promise<void>
  onClose: () => void
}) {
  const [title,    setTitle]   = useState(initial?.title    ?? '')
  const [category, setCategory] = useState<SnippetCategory>(initial?.category ?? 'General')
  const [content,  setContent] = useState(initial?.content  ?? '')
  const [saving,   setSaving]  = useState(false)

  const wc = wordCount(content)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), category, content })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            {initial ? 'Edit Snippet' : 'New Snippet'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700
              hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700">Title</label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Organization Mission Statement"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900
                focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              required
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-700">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as SnippetCategory)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white
                text-slate-900 focus:outline-none focus:ring-2 focus:border-transparent"
              style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
            >
              {SNIPPET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">Content</label>
              <span className="text-[11px] text-slate-400 tabular-nums">{wc} words</span>
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your reusable snippet content here. Use [brackets] for placeholder text."
              rows={8}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 text-slate-900
                leading-relaxed resize-none focus:outline-none focus:ring-2 focus:border-transparent
                font-mono placeholder:font-sans placeholder:text-slate-400"
              style={{ '--tw-ring-color': 'var(--gold)' } as React.CSSProperties}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-300 text-slate-700
                hover:border-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !content.trim()}
              className="px-4 py-2 text-sm rounded-lg font-semibold text-white
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: 'var(--gold)' }}
            >
              {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Create Snippet')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Empty / loading states ──────────────────────────────────── */

function EmptyState({ hasFilter, onNew }: { hasFilter: boolean; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14
              c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10
              A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-700">
        {hasFilter ? 'No snippets match your filters' : 'No snippets yet'}
      </p>
      <p className="mt-1 text-sm text-slate-400 max-w-xs">
        {hasFilter
          ? 'Try adjusting your search or category filter.'
          : 'Create reusable content blocks to speed up your grant writing.'}
      </p>
      {!hasFilter && (
        <button
          onClick={onNew}
          className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2
            text-sm font-semibold text-white"
          style={{ backgroundColor: 'var(--gold)' }}
        >
          + New Snippet
        </button>
      )}
    </div>
  )
}

function SnippetsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
          <div className="h-5 bg-slate-100 rounded-full w-28" />
          <div className="h-4 bg-slate-200 rounded w-3/4" />
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
            <div className="h-3 bg-slate-100 rounded w-4/6" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-20 mt-2" />
        </div>
      ))}
    </div>
  )
}
