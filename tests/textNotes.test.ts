import { describe, expect, it, beforeEach } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'
import { thumbSvg } from '../src/lib/thumb'

beforeEach(() => {
  useEditorStore.setState({
    tokens: [],
    paths: [],
    textNotes: [],
    selectedIds: [],
    past: [],
    future: [],
    playName: 'Untitled Play',
  })
})

describe('text notes store', () => {
  it('addTextNote creates and selects', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'Hello' })
    const st = useEditorStore.getState()
    expect(st.textNotes).toHaveLength(1)
    expect(st.textNotes[0].text).toBe('Hello')
    expect(st.selectedIds).toEqual([id])
  })

  it('updateTextNote changes text', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'Hi' })
    useEditorStore.getState().updateTextNote(id, 'Bye')
    expect(useEditorStore.getState().textNotes[0].text).toBe('Bye')
  })

  it('moveTextNotesLive moves', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'A' })
    useEditorStore.getState().moveTextNotesLive({ [id]: { x: 12, y: 82 } })
    expect(useEditorStore.getState().textNotes[0].x).toBe(12)
  })

  it('deleteTextNotes removes and clears selection', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'A' })
    useEditorStore.getState().deleteTextNotes([id])
    expect(useEditorStore.getState().textNotes).toHaveLength(0)
    expect(useEditorStore.getState().selectedIds).toHaveLength(0)
  })

  it('undo/redo restores text notes', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'A' })
    expect(useEditorStore.getState().textNotes).toHaveLength(1)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().textNotes).toHaveLength(0)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().textNotes).toHaveLength(1)
    expect(useEditorStore.getState().textNotes[0].id).toBe(id)
  })

  it('nudgeSelected moves selected text', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'A' })
    useEditorStore.getState().select([id])
    useEditorStore.getState().nudgeSelected(1, 0.5)
    const n = useEditorStore.getState().textNotes[0]
    expect(n.x).toBe(11)
    expect(n.y).toBe(80.5)
  })

  it('deleteSelected removes text', () => {
    const id = useEditorStore.getState().addTextNote({ x: 10, y: 80, text: 'A' })
    useEditorStore.getState().select([id])
    useEditorStore.getState().deleteSelected()
    expect(useEditorStore.getState().textNotes).toHaveLength(0)
  })

  it('loadPlay preserves textNotes with fresh ids', () => {
    useEditorStore.getState().loadPlay({
      name: 'P',
      tokens: [],
      paths: [],
      textNotes: [{ id: 'old', x: 10, y: 80, text: 'X' }],
    })
    const st = useEditorStore.getState()
    expect(st.textNotes).toHaveLength(1)
    expect(st.textNotes[0].text).toBe('X')
    expect(st.textNotes[0].id).not.toBe('old')
  })
})

describe('thumb with text', () => {
  it('renders text element', () => {
    const svg = thumbSvg([], [], 'green', [{ x: 10, y: 80, text: 'Hi' }])
    expect(svg).toContain('<text')
    expect(svg).toContain('Hi')
  })
})
