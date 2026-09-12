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

  it('terminals land within 1yd of BDB medians (right side)', () => {
    const anchor = { x: 26.65, y: 90 }
    const terminal = (key: string) => {
      const pts = buildRoutePoints(routeConcept(key), anchor, 'right')
      const last = pts[pts.length - 1]
      return { dd: anchor.y - last.y, lat: last.x - anchor.x }
    }
    // [expected dd, expected |lat|] from arrival-clipped BDB medians
    const want: Record<string, [number, number]> = {
      go: [14.3, 3.9],
      post: [16.9, 4.1],
      corner: [16.6, 5.3],
      slant: [7.2, 5.1],
      hitch: [8.0, 2.6],
      out: [8.3, 7.8],
      in: [12.0, 4.9],
      cross: [6.2, 13.6],
      flat: [3.7, 11.1],
      screen: [0.4, 3.4],
      angle: [7.0, 3.0],
      wheel: [10.3, 12.8],
    }
    for (const [key, [dd, lat]] of Object.entries(want)) {
      const t = terminal(key)
      expect(Math.abs(t.dd - dd), `${key} depth`).toBeLessThanOrEqual(1)
      expect(Math.abs(Math.abs(t.lat) - lat), `${key} lateral`).toBeLessThanOrEqual(1)
    }
  })

  it('left side mirrors lateral, depth untouched', () => {
    const anchor = { x: 26.65, y: 90 }
    const r = buildRoutePoints(routeConcept('slant'), anchor, 'right')
    const l = buildRoutePoints(routeConcept('slant'), anchor, 'left')
    expect(l[l.length - 1].x).toBeCloseTo(anchor.x - (r[r.length - 1].x - anchor.x), 6)
    expect(l[l.length - 1].y).toBeCloseTo(r[r.length - 1].y, 6)
  })

  it('depthScale scales every leg', () => {
    const anchor = { x: 26.65, y: 90 }
    const a = buildRoutePoints(routeConcept('post'), anchor, 'right', 1)
    const b = buildRoutePoints(routeConcept('post'), anchor, 'right', 1.2)
    const lastA = a[a.length - 1]
    const lastB = b[b.length - 1]
    expect(anchor.y - lastB.y).toBeCloseTo((anchor.y - lastA.y) * 1.2, 6)
  })
})

describe('template store actions', () => {
  it('addTemplateRoute anchors at the player and selects', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'slant', 'right')
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
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'go', 'right')!
    useEditorStore.getState().applyRouteTemplate(id, 'slant', 'left')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.type).toBe('route')
    const last = p.points[p.points.length - 1]
    expect(12 - last.x).toBeGreaterThan(0) // broke left
    expect(88 - last.y).toBeGreaterThan(0) // went downfield
  })

  it('undo restores the previous shape', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addTemplateRoute(tok.id, 'go', 'right')!
    const before = useEditorStore.getState().paths.find((x) => x.id === id)!.points.length
    useEditorStore.getState().applyRouteTemplate(id, 'slant', 'right')
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().paths.find((x) => x.id === id)!.points).toHaveLength(before)
  })
})
