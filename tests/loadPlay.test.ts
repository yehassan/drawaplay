import { describe, expect, it, beforeEach } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'

beforeEach(() => {
  useEditorStore.setState({ tokens: [], paths: [], textNotes: [], selectedIds: [], past: [], future: [] })
})

describe('loadPlay', () => {
  it('builds SVG curve data from points so seeded plays draw', () => {
    useEditorStore.getState().loadPlay({
      name: 'Seed',
      tokens: [{ id: 'a', side: 'offense', pos: 'WR', num: '', x: 12, y: 88 }],
      paths: [{ tokenId: 'a', endTokenId: null, type: 'route', points: [{ x: 12, y: 88 }, { x: 17, y: 79 }], d: '' }],
    })
    const [p] = useEditorStore.getState().paths
    expect(p.d).toMatch(/^M/)
    expect(p.d).toContain('C')
  })
})
