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

  it('BDB seeds keep frame-exact timing; throw derives to the real window', () => {
    const sc = SCENARIOS.find((s) => s.name.startsWith('BDB: full play'))!
    const built = sc.build()
    // throw frame 28 → delay 1700; catch frame 38 → route ends 2700
    useEditorStore.getState().loadPlay({ ...built, name: built.name })
    const st = useEditorStore.getState()
    const route = st.paths.find((p) => p.tokenId === st.tokens.find((t) => t.pos === 'WR')!.id && p.type === 'route')!
    expect(route.timing.delayMs).toBe(0)
    expect(route.timing.delayMs + route.timing.durationMs).toBe(2700)
    const pass = st.paths.find((p) => p.type === 'pass')!
    // derived arrival pins to the route end (real catch), launch ≈ real 1700
    expect(pass.timing.delayMs + pass.timing.durationMs).toBe(2700)
    expect(Math.abs(pass.timing.delayMs - 1700)).toBeLessThanOrEqual(100)
  })
})
