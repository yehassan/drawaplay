import { describe, expect, it, beforeEach } from 'vitest'
import {
  ROUTE_CONCEPTS,
  buildRoutePoints,
  routeConcept,
} from '../src/lib/routeTemplates'
import { useEditorStore } from '../src/stores/editorStore'

beforeEach(() => {
  useEditorStore.setState({ tokens: [], paths: [], textNotes: [], selectedIds: [], past: [], future: [] })
})

describe('route templates', () => {
  it('declares all 12 BDB concepts', () => {
    expect(ROUTE_CONCEPTS.map((c) => c.key).sort()).toEqual(
      ['angle', 'corner', 'cross', 'flat', 'go', 'hitch', 'in', 'out', 'post', 'screen', 'slant', 'wheel'].sort(),
    )
  })

  it('terminals land within 1yd of BDB medians (right-side receiver)', () => {
    const anchor = { x: 30, y: 90 }
    const terminal = (key: string) => {
      const pts = buildRoutePoints(routeConcept(key), anchor)
      const last = pts[pts.length - 1]
      return { dd: anchor.y - last.y, lat: last.x - anchor.x }
    }
    // [expected dd, expected signed lat]: inside breaks go −x for a right-side WR
    const want: Record<string, [number, number]> = {
      go: [14.0, 0],
      post: [16.9, -4.1],
      corner: [16.6, 5.3],
      slant: [7.2, -5.1],
      hitch: [6.0, 2.5],
      out: [8.3, 7.8],
      in: [12.0, -4.9],
      cross: [6.2, -13.6],
      flat: [3.7, 11.1],
      screen: [0.4, 3.4],
      angle: [7.0, 3.0],
      wheel: [10.3, 12.8],
    }
    for (const [key, [dd, lat]] of Object.entries(want)) {
      const t = terminal(key)
      expect(Math.abs(t.dd - dd), `${key} depth`).toBeLessThanOrEqual(1)
      expect(Math.abs(t.lat - lat), `${key} lateral`).toBeLessThanOrEqual(1)
    }
  })

  it('left-side receivers mirror inside/outside', () => {
    const right = { x: 35, y: 90 }
    const left = { x: 18.3, y: 90 }
    for (const key of ['post', 'slant', 'corner', 'out']) {
      const r = buildRoutePoints(routeConcept(key), right)
      const l = buildRoutePoints(routeConcept(key), left)
      const rLat = r[r.length - 1].x - right.x
      const lLat = l[l.length - 1].x - left.x
      expect(lLat, `${key} mirror`).toBeCloseTo(-rLat, 6)
      expect(l[l.length - 1].y, `${key} depth`).toBeCloseTo(r[r.length - 1].y, 6)
    }
  })

  it('depthScale scales every leg', () => {
    const anchor = { x: 30, y: 90 }
    const a = buildRoutePoints(routeConcept('post'), anchor, 1)
    const b = buildRoutePoints(routeConcept('post'), anchor, 1.2)
    const lastA = a[a.length - 1]
    const lastB = b[b.length - 1]
    expect(anchor.y - lastB.y).toBeCloseTo((anchor.y - lastA.y) * 1.2, 6)
  })
})

describe('template store actions', () => {
  it('addTemplateRoute anchors at the player and selects', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'slant')
    const st = useEditorStore.getState()
    expect(id).not.toBeNull()
    expect(st.paths).toHaveLength(1)
    expect(st.paths[0].type).toBe('route')
    expect(st.paths[0].points[0]).toEqual({ x: 12, y: 88 })
    expect(st.selectedIds).toEqual([id])
  })

  it('applyRouteTemplate reshapes in place, keeps identity', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'go')!
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.type).toBe('route')
    const last = p.points[p.points.length - 1]
    expect(last.x - 12).toBeGreaterThan(0) // left-side WR slants inside (right)
    expect(88 - last.y).toBeGreaterThan(0) // went downfield
  })

  it('undo restores the previous shape', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'go')!
    const before = useEditorStore.getState().paths.find((x) => x.id === id)!.points.length
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().paths.find((x) => x.id === id)!.points).toHaveLength(before)
  })

  it('mirrorPath flips lateral around the anchor, keeps start', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'RB', num: '', x: 26, y: 94 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'wheel')!
    const before = useEditorStore.getState().paths.find((x) => x.id === id)!.points
    useEditorStore.getState().mirrorPath(id)
    const after = useEditorStore.getState().paths.find((x) => x.id === id)!.points
    expect(after[0]).toEqual(before[0])
    for (let i = 1; i < after.length; i++) {
      expect(after[i].x).toBeCloseTo(2 * tok.x - before[i].x, 6)
      expect(after[i].y).toBeCloseTo(before[i].y, 6)
    }
    // double mirror restores
    useEditorStore.getState().mirrorPath(id)
    expect(useEditorStore.getState().paths.find((x) => x.id === id)!.points).toEqual(after.map((p, i) => (i === 0 ? p : { x: 2 * tok.x - p.x, y: p.y })))
  })
})
