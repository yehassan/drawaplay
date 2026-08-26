import { useEffect } from 'react'
import { useEditorStore } from '../stores/editorStore'
import { PATH_TYPE_ORDER } from '../lib/pathStyles'

export interface ShortcutEvent {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  preventDefault?: () => void
  target?: { tagName?: string; isContentEditable?: boolean }
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

  // one-shot type bar: number keys retype the path
  if (st.typeBarFor && /^[1-9]$/.test(e.key)) {
    const idx = Number(e.key) - 1
    if (idx < PATH_TYPE_ORDER.length) {
      e.preventDefault?.()
      st.updatePathType(st.typeBarFor, PATH_TYPE_ORDER[idx]!)
      st.showTypeBar(null)
    }
    return
  }
  if (e.key === 'Escape' && st.typeBarFor) {
    st.showTypeBar(null)
    return
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
      if (st.tool === 'draw') st.setTool('select')
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
