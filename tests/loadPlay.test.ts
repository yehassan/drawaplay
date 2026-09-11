import { describe, expect, it, beforeEach } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'
import { SCENARIOS } from '../src/lib/scenarios'

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
    expect(p.d.length).toBeGreaterThan(0)
  })

  it('BDB seeds drop the 10Hz catch hook (RDP eps 1.0yd)', () => {
    const sc = SCENARIOS.find((s) => s.name.startsWith('BDB: full play'))!
    const built = sc.build()
    const pass = built.paths.find((p) => p.type === 'pass')!
    // raw ball had 6 samples ending in a 0.9yd hook; simplified keeps ≤4
    expect(pass.points.length).toBeLessThanOrEqual(4)
    // real breaks survive: slant keeps stem + break + end
    const slant = built.paths.find((p) => p.tokenId === 'WR1')!
    expect(slant.points.length).toBeGreaterThanOrEqual(3)
  })
})
