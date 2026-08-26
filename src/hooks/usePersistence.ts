import { useEffect, useRef } from 'react'
import { getPlay, mostRecentPlay, putPlay, uid } from '../lib/playbook'
import { useEditorStore } from '../stores/editorStore'

/**
 * Session persistence:
 * - on mount: restore the most recently updated play
 * - afterwards: debounce-save the doc whenever tokens/paths/name/ballStart change
 */
export function usePersistence(): void {
  const hydrated = useRef(false)

  // restore last session once
  useEffect(() => {
    void (async () => {
      const rec = await mostRecentPlay()
      if (rec) {
        useEditorStore.getState().loadPlay({
          name: rec.name,
          tokens: rec.tokens,
          paths: rec.paths,
          los: rec.los ?? null,
          fieldTheme: (rec.fieldTheme as never) ?? undefined,
          ruleset: (rec.ruleset as never) ?? undefined,
        })
        useEditorStore.setState({ playId: rec.id })
      }
      hydrated.current = true
      useEditorStore.getState().setSaveState('saved')
    })()
  }, [])

  // debounced autosave
  useEffect(() => {
    let timer: number | undefined

    const save = async (): Promise<void> => {
      const st = useEditorStore.getState()
      st.setSaveState('saving')
      const now = Date.now()
      let id = st.playId
      if (id) {
        // preserve library-managed metadata (tags/folder) across doc saves
        const existing = await getPlay(id)
        if (existing && !existing.deletedAt) {
          await putPlay({
            ...existing,
            name: st.playName,
            tokens: st.tokens.map((t) => ({ ...t })),
            paths: st.paths.map((p) => ({ ...p })),
            ballStartId: st.ballStartId,
            los: st.losSpec ?? undefined,
            fieldTheme: st.fieldTheme,
            ruleset: st.ruleset,
            updatedAt: now,
          })
          useEditorStore.setState({ playId: id, saveState: 'saved' })
          return
        }
        if (existing?.deletedAt) id = null // record was trashed — start fresh
      }
      id = id ?? uid()
      await putPlay({
        id,
        name: st.playName,
        tokens: st.tokens.map((t) => ({ ...t })),
        paths: st.paths.map((p) => ({ ...p })),
        ballStartId: st.ballStartId,
        los: st.losSpec ?? undefined,
        fieldTheme: st.fieldTheme,
        ruleset: st.ruleset,
        tags: [],
        createdAt: now,
        updatedAt: now,
      })
      const cur = useEditorStore.getState()
      // a load may have raced the save — only claim identity if unchanged doc intent
      if (cur.playId === null || cur.playId === st.playId) {
        useEditorStore.setState({ playId: id, saveState: 'saved' })
      } else {
        cur.setSaveState('saved')
      }
    }

    const unsub = useEditorStore.subscribe((s, prev) => {
      if (!hydrated.current) return
      if (
        s.tokens === prev.tokens &&
        s.paths === prev.paths &&
        s.playName === prev.playName &&
        s.ballStartId === prev.ballStartId &&
        s.fieldTheme === prev.fieldTheme &&
        s.ruleset === prev.ruleset
      )
        return
      useEditorStore.getState().setSaveState('dirty')
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void save(), 650)
    })

    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [])
}
