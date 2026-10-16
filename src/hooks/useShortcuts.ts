import { useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { PATH_TYPE_CHOICES, type BlockDir } from '../lib/pathStyles'
import { routeForKeyCode } from '../lib/routeTemplates'

export interface ShortcutEvent {
  key: string
  /** physical key, so a binding works with Shift held (key becomes `!` for ⇧1) */
  code?: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  preventDefault?: () => void
  target?: { tagName?: string; isContentEditable?: boolean }
}

/** ⇧+arrow adds the block in that direction — ⇧↑ is "ahead", matching the buttons */
const BLOCK_KEY_DIR: Record<string, BlockDir> = {
  ArrowLeft: 'left',
  ArrowUp: 'forward',
  ArrowRight: 'right',
}

/** Pure shortcut processor — shared by the DOM hook and unit tests. */
export function applyShortcut(e: ShortcutEvent): void {
  const mod = e.metaKey || e.ctrlKey

  // undo/redo works even while typing in a field
  if (mod && !e.altKey && e.key.toLowerCase() === 'z') {
    e.preventDefault?.()
    const st = useEditorStore.getState()
    if (e.shiftKey) st.redo()
    else st.undo()
    return
  }

  const t = e.target as { tagName?: string; isContentEditable?: boolean } | undefined
  if (
    t &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  )
    return

  const st = useEditorStore.getState()
  const key = e.key.toLowerCase()

  if (mod && key === 'd') {
    e.preventDefault?.()
    st.duplicateSelected()
    return
  }
  if (mod) return

  /**
   * ⇧ binds the two "build it without drawing" actions, and only when exactly
   * one player is selected: ⇧+number-row picks a route concept, ⇧+←↑→ adds a
   * block. ⇧ is what keeps them clear of the plain 1–9 that label a selected
   * path, and of V/D/T/H which choose tools.
   */
  if (e.shiftKey && !e.altKey && e.code) {
    const one = st.selectedIds.length === 1 ? st.selectedIds[0] : null
    const token = one ? st.tokens.find((t) => t.id === one) : null
    if (token) {
      const concept = routeForKeyCode(e.code)
      // routes are an offensive idea in this app — the inspector offers them to
      // offence only, so the key does too
      if (concept && token.side === 'offense') {
        e.preventDefault?.()
        st.setPlayerRoute(token.id, concept.key)
        return
      }
      const dir = BLOCK_KEY_DIR[e.code]
      if (dir) {
        e.preventDefault?.()
        st.addBlock(token.id, dir)
        return
      }
      // ⇧↓ has no block direction. Swallow it rather than letting it fall
      // through to a nudge, so all four shift-arrows mean one thing while a
      // single player is selected.
      if (e.code.startsWith('Arrow')) {
        e.preventDefault?.()
        return
      }
    }
  }

  // number keys label the selected path, matching the chips the inspector shows
  // (never a snap — that belongs to the formation)
  if (/^[1-9]$/.test(e.key)) {
    const sel = st.selectedIds
    if (sel.length === 1) {
      const path = st.paths.find((p) => p.id === sel[0])
      const idx = Number(e.key) - 1
      if (path && idx < PATH_TYPE_CHOICES.length) {
        e.preventDefault?.()
        st.updatePathType(path.id, PATH_TYPE_CHOICES[idx]!)
        return
      }
    }
  }

  // arrow keys nudge the selection
  if (e.key.startsWith('Arrow') && st.selectedIds.length > 0) {
    e.preventDefault?.()
    const step = e.shiftKey ? 2 : 0.5
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    if (dx || dy) st.nudgeSelected(dx, dy)
    return
  }

  switch (key) {
    case ' ':
      e.preventDefault?.()
      st.togglePlay()
      break
    case 'v':
      e.preventDefault?.()
      st.setTool('select')
      break
    case 'd':
      e.preventDefault?.()
      st.setTool(st.tool === 'draw' ? 'select' : 'draw')
      break
    case 't':
      e.preventDefault?.()
      st.setTool('text')
      break
    case 'h':
      e.preventDefault?.()
      st.setTool('pan')
      break
    case 'delete':
    case 'backspace':
      if (st.selectedIds.length > 0) {
        e.preventDefault?.()
        st.deleteSelected()
      }
      break
    case 'escape':
      e.preventDefault?.()
      if (st.ballAction) st.cancelBallAction()
      else if (st.tool === 'draw') st.setTool('select')
      else {
        st.setTool('select')
        st.select([])
      }
      break
  }
}

export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void =>
      applyShortcut({
        key: e.key,
        code: e.code,
        metaKey: e.metaKey,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        preventDefault: () => e.preventDefault(),
        target: e.target as { tagName?: string; isContentEditable?: boolean } | undefined,
      })
    // capture phase: win the race against focused controls
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}
