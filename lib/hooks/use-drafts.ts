'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import type { DraftRow, GrantDetail } from '@/lib/types/database.types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseDraftsResult {
  detail: GrantDetail | null
  /** section_title → draft content */
  contents: Record<string, string>
  /** section_title → current version number */
  versions: Record<string, number>
  loading: boolean
  saveStatus: SaveStatus
  /** Update content locally; auto-saves after 3s of inactivity */
  updateContent: (sectionTitle: string, content: string) => void
  /** Immediately flush pending changes to DB (call on blur or explicit save) */
  saveDraft: (sectionTitle: string) => Promise<void>
}

export function useDrafts(grantId: string | null): UseDraftsResult {
  const [detail,     setDetail]     = useState<GrantDetail | null>(null)
  const [contents,   setContents]   = useState<Record<string, string>>({})
  const [versions,   setVersions]   = useState<Record<string, number>>({})
  const [loading,    setLoading]    = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const grantIdRef   = useRef<string | null>(null)
  const contentsRef  = useRef<Record<string, string>>({})
  const versionsRef  = useRef<Record<string, number>>({})
  const userIdRef    = useRef<string | null>(null)
  const orgIdRef     = useRef<string | null>(null)

  // Fetch current user + org once on mount
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(
      (result: Awaited<ReturnType<ReturnType<typeof createClient>['auth']['getUser']>>) => {
        userIdRef.current = result.data.user?.id ?? null
      }
    )
    supabase.from('organization_members').select('organization_id').single().then(
      (result: { data: { organization_id: string } | null }) => {
        orgIdRef.current = result.data?.organization_id ?? null
      }
    )
  }, [])

  useEffect(() => {
    grantIdRef.current = grantId

    if (!grantId) {
      setDetail(null)
      setContents({})
      setVersions({})
      contentsRef.current = {}
      versionsRef.current = {}
      return
    }

    let cancelled = false

    async function load() {
      console.log('[useDrafts] load() start for grantId:', grantId)
      setLoading(true)
      setContents({})
      setVersions({})
      setDetail(null)
      contentsRef.current = {}
      versionsRef.current = {}

      const supabase = createClient()

      console.log('[useDrafts] loading grant:', grantId)

      // 1a. Confirm the grant exists via grants_full (this view is accessible, grants table has RLS)
      const { data: grantRow, error: grantRowErr } = await supabase
        .from('grants_full')
        .select('id')
        .eq('id', grantId)
        .single()

      console.log('[useDrafts] grants_full row check:', { data: grantRow, error: grantRowErr })

      if (cancelled) return
      if (grantRowErr || !grantRow) {
        console.error('[useDrafts] grant not found in grants_full — aborting')
        setLoading(false)
        return
      }

      // 1b. Fetch sections + attachments from grants table separately
      const { data: detailData, error: detailErr } = await supabase
        .from('grants')
        .select('id, sections, attachments, description, source_url')
        .eq('id', grantId)
        .single()

      console.log('[useDrafts] grants detail fetch:', {
        data: detailData,
        error: detailErr,
        keys: detailData ? Object.keys(detailData as object) : [],
      })

      if (cancelled) return

      // Use whatever we got — if grants table is blocked, sections will be empty
      const det: GrantDetail = {
        id: grantId as string,
        sections:    (detailData as GrantDetail | null)?.sections    ?? null,
        attachments: (detailData as GrantDetail | null)?.attachments ?? null,
        description: (detailData as GrantDetail | null)?.description ?? null,
        source_url:  (detailData as GrantDetail | null)?.source_url  ?? null,
      }
      setDetail(det)

      // Fall back to a single default section so the editor always renders
      const sections = (det.sections && det.sections.length > 0)
        ? det.sections
        : [{ title: 'Application', page_limit: null }]
      det.sections = sections
      console.log('[useDrafts] sections:', sections.map(s => s.title))

      // 2a. Ensure we have the org ID (may not be set yet if mount effect hasn't resolved)
      if (!orgIdRef.current) {
        const { data: memberRow } = await supabase
          .from('organization_members')
          .select('organization_id')
          .single()
        orgIdRef.current = (memberRow as { organization_id: string } | null)?.organization_id ?? null
      }

      // 2b. Fetch existing drafts for this grant
      const { data: existing, error: fetchErr } = await supabase
        .from('drafts')
        .select('*')
        .eq('grant_id', grantId)

      console.log('[useDrafts] existing drafts:', existing?.length ?? 0, fetchErr?.message ?? 'ok')

      if (cancelled) return

      const draftMap: Record<string, DraftRow> = {}
      for (const d of (existing ?? []) as DraftRow[]) {
        draftMap[d.section_title] = d
      }

      // 3. Ensure draft rows exist for all sections (upsert ignores existing rows)
      const missing = sections.filter(s => !draftMap[s.title])
      console.log('[useDrafts] missing draft rows:', missing.map(s => s.title))

      if (missing.length > 0) {
        const { data: created, error: insertErr } = await supabase
          .from('drafts')
          .upsert(
            missing.map(s => ({
              grant_id:        grantId,
              section_title:   s.title,
              section_index:   sections.findIndex(sec => sec.title === s.title),
              content:         '',
              version:         0,
              organization_id: orgIdRef.current,
            })),
            { onConflict: 'grant_id,section_title', ignoreDuplicates: true },
          )
          .select('*')

        console.log('[useDrafts] upsert result:', { created: created?.length ?? 0, error: insertErr?.message ?? null })

        if (insertErr) {
          console.error('[useDrafts] failed to create draft rows:', insertErr.message)
          // Fall back: fetch those rows in case they already exist
          const { data: fallback } = await supabase
            .from('drafts')
            .select('*')
            .eq('grant_id', grantId)
            .in('section_title', missing.map(s => s.title))
          console.log('[useDrafts] fallback fetch:', fallback?.length ?? 0, 'rows')
          for (const d of (fallback ?? []) as DraftRow[]) {
            draftMap[d.section_title] = d
          }
        } else {
          for (const d of (created ?? []) as DraftRow[]) {
            draftMap[d.section_title] = d
          }
        }
      }

      if (!cancelled) {
        const contentMap: Record<string, string> = {}
        const versionMap: Record<string, number> = {}
        for (const [title, draft] of Object.entries(draftMap)) {
          contentMap[title] = draft.content ?? ''
          versionMap[title] = draft.version ?? 0
        }
        console.log('[useDrafts] final contentMap keys:', Object.keys(contentMap))
        contentsRef.current = contentMap
        versionsRef.current = versionMap
        setContents(contentMap)
        setVersions(versionMap)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [grantId])

  /** Core DB write: increment version + stamp last_edited_by */
  const flushSave = useCallback(async (sectionTitle: string) => {
    const currentGrantId = grantIdRef.current
    if (!currentGrantId) return

    const content     = contentsRef.current[sectionTitle] ?? ''
    const nextVersion = (versionsRef.current[sectionTitle] ?? 0) + 1

    setSaveStatus('saving')

    console.log('[useDrafts] saving draft:', {
      grant_id:       currentGrantId,
      section_title:  sectionTitle,
      content_length: content.length,
      version:        nextVersion,
      user_id:        userIdRef.current,
    })

    const supabase = createClient()
    // Upsert so save works even if the initial INSERT in load() failed.
    // NOTE: requires a unique constraint on (grant_id, section_title) in the drafts table.
    // If this returns a duplicate-key error, run in Supabase SQL editor:
    //   ALTER TABLE drafts ADD CONSTRAINT drafts_grant_section_unique UNIQUE (grant_id, section_title);
    const { data, error } = await supabase
      .from('drafts')
      .upsert(
        {
          grant_id:        currentGrantId,
          section_title:   sectionTitle,
          content,
          version:         nextVersion,
          last_edited_by:  userIdRef.current,
          organization_id: orgIdRef.current,
        },
        { onConflict: 'grant_id,section_title' },
      )
      .select('id, version')

    if (error) {
      console.error('[useDrafts] save FAILED:', error.message, error)
      setSaveStatus('error')
      toast('Failed to save draft', 'error')
    } else {
      console.log('[useDrafts] save OK — row:', data)
      versionsRef.current = { ...versionsRef.current, [sectionTitle]: nextVersion }
      setVersions(prev => ({ ...prev, [sectionTitle]: nextVersion }))
      setSaveStatus('saved')
      toast('Draft saved', 'success', 2000)
      setTimeout(() => setSaveStatus(prev => (prev === 'saved' ? 'idle' : prev)), 2000)
    }
  }, [])

  /** Update local state and schedule a 3s debounced save */
  const updateContent = useCallback((sectionTitle: string, content: string) => {
    contentsRef.current = { ...contentsRef.current, [sectionTitle]: content }
    setContents(prev => ({ ...prev, [sectionTitle]: content }))

    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')

    saveTimer.current = setTimeout(() => {
      flushSave(sectionTitle)
    }, 3000)
  }, [flushSave])

  /** Cancel pending timer and save immediately (used on blur + Save button) */
  const saveDraft = useCallback(async (sectionTitle: string) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    await flushSave(sectionTitle)
  }, [flushSave])

  return { detail, contents, versions, loading, saveStatus, updateContent, saveDraft }
}
