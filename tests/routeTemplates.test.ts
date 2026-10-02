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

/** the real flow now: draw a route path, then pick a named concept for it */
const makeRoute = (tokenId: string, conceptKey: string): string => {
  const st = useEditorStore.getState()
  const anchor = st.tokens.find((t) => t.id === tokenId)!
  const id = st.addPath({
    tokenId,
    endTokenId: null,
    type: 'route',
    points: [
      { x: anchor.x, y: anchor.y },
      { x: anchor.x, y: anchor.y - 8 },
    ],
    d: '',
  })
  useEditorStore.getState().applyRouteTemplate(id, conceptKey)
  return id
}

describe('template store actions', () => {
  it('picking a concept reshapes the drawn route in place', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    makeRoute(tok.id, 'slant')
    const st = useEditorStore.getState()
    expect(st.paths).toHaveLength(1)
    expect(st.paths[0].type).toBe('route')
    expect(st.paths[0].points[0]).toEqual({ x: 12, y: 88 })
  })

  it('never changes the selection, so the player panel keeps the coach', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    useEditorStore.setState({ selectedIds: [tok.id] })
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    expect(useEditorStore.getState().selectedIds).toEqual([tok.id])
  })

  it('does not change the selection when he already has one of that type', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    useEditorStore.setState({ selectedIds: [tok.id] })
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    expect(useEditorStore.getState().selectedIds).toEqual([tok.id])
  })

  it('picking a second concept reuses the same path, never a second route', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = makeRoute(tok.id, 'go')
    useEditorStore.getState().applyRouteTemplate(id, 'post')
    useEditorStore.getState().applyRouteTemplate(id, 'corner')
    const routes = useEditorStore.getState().paths.filter((p) => p.type === 'route')
    expect(routes).toHaveLength(1)
    expect(routes[0].id).toBe(id)
  })

  it('applyRouteTemplate reshapes in place, keeps identity', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = makeRoute(tok.id, 'go')
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.type).toBe('route')
    const last = p.points[p.points.length - 1]
    expect(last.x - 12).toBeGreaterThan(0) // left-side WR slants inside (right)
    expect(88 - last.y).toBeGreaterThan(0) // went downfield
  })

  it('undo restores the drawn shape when a concept is applied', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().addPath({
      tokenId: tok.id,
      endTokenId: null,
      type: 'route',
      points: [
        { x: 12, y: 88 },
        { x: 12, y: 80 },
      ],
      d: '',
    })
    const drawn = useEditorStore.getState().paths.find((x) => x.id === id)!.points
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    expect(useEditorStore.getState().paths.find((x) => x.id === id)!.points).not.toEqual(drawn)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().paths.find((x) => x.id === id)!.points).toEqual(drawn)
  })

  it('mirrorPath flips lateral around the anchor, keeps start', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'RB', num: '', x: 26, y: 94 })
    const tok = useEditorStore.getState().tokens[0]
    const id = makeRoute(tok.id, 'wheel')
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

describe('setPlayerPathType', () => {
  beforeEach(() => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
  })

  it('creates a path anchored at the player when he has none', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    const st = useEditorStore.getState()
    expect(id).not.toBeNull()
    expect(st.paths).toHaveLength(1)
    expect(st.paths[0].type).toBe('route')
    expect(st.paths[0].tokenId).toBe(tok.id)
    expect(st.paths[0].points[0]).toEqual({ x: 12, y: 88 })
  })

  it('builds a play with no drawing at all', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 40, y: 88 })
    const [a, b] = useEditorStore.getState().tokens
    useEditorStore.getState().setPlayerPathType(a.id, 'route')
    useEditorStore.getState().setPlayerPathType(b.id, 'route')
    expect(useEditorStore.getState().paths).toHaveLength(2)
  })

  it('reuses the existing path of that type instead of stacking a second', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const first = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    const again = useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    expect(again).toBe(first)
    expect(useEditorStore.getState().paths).toHaveLength(1)
  })

  it('refuses motion, run and drop — those have to be drawn', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    for (const type of ['motion', 'run', 'drop', 'pass'] as const) {
      expect(useEditorStore.getState().setPlayerPathType(tok.id, type), type).toBeNull()
    }
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })

  it('keeps one route per player while allowing a block alongside it', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    useEditorStore.getState().addBlock(tok.id, 'forward')
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    expect(useEditorStore.getState().paths.filter((p) => p.type === 'route')).toHaveLength(1)
    expect(useEditorStore.getState().paths.filter((p) => p.type === 'block')).toHaveLength(1)
  })

  it('moves a defensive player toward the offense', () => {
    useEditorStore.getState().addToken({ side: 'defense', pos: 'CB', num: '', x: 20, y: 40 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'go')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.points[p.points.length - 1].y).toBeGreaterThan(40)
  })

  it('refuses a snap, which belongs to the formation', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    expect(useEditorStore.getState().setPlayerPathType(tok.id, 'snap')).toBeNull()
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })

  it('accepts a toss or handoff the player gives away', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const toss = useEditorStore.getState().setPlayerPathType(tok.id, 'toss')!
    expect(useEditorStore.getState().paths.find((p) => p.id === toss)!.type).toBe('toss')
    expect(useEditorStore.getState().setPlayerPathType(tok.id, 'handoff')).not.toBeNull()
  })

  it('ignores an unknown player', () => {
    expect(useEditorStore.getState().setPlayerPathType('nope', 'route')).toBeNull()
  })

  it('undo removes an inspector-created path', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    useEditorStore.getState().setPlayerPathType(tok.id, 'route')
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })
})

describe('direction follows the player side', () => {
  it('flips route depth for a defender', () => {
    const anchor = { x: 26.65, y: 40 }
    const offense = buildRoutePoints(routeConcept('post'), anchor, 1, -1)
    const defense = buildRoutePoints(routeConcept('post'), anchor, 1, 1)
    expect(offense[offense.length - 1].y).toBeLessThan(anchor.y)
    expect(defense[defense.length - 1].y).toBeGreaterThan(anchor.y)
    expect(defense[defense.length - 1].x).toBeCloseTo(offense[offense.length - 1].x, 6)
  })

  it('defaults to the offense direction', () => {
    const anchor = { x: 26.65, y: 88 }
    expect(buildRoutePoints(routeConcept('go'), anchor)).toEqual(
      buildRoutePoints(routeConcept('go'), anchor, 1, -1),
    )
  })

  it('keeps the offense unchanged when routed through the inspector', () => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.points[p.points.length - 1].y).toBeLessThan(88)
  })

  it('routes a defender toward the offense, not away from it', () => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
    useEditorStore.getState().addToken({ side: 'defense', pos: 'CB', num: '', x: 12, y: 40 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'slant')
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    expect(p.points[p.points.length - 1].y).toBeGreaterThan(40)
  })
})

describe('setRouteDepth', () => {
  beforeEach(() => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
  })

  it('shrinks an offensive route toward the LOS without flipping it', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'go')
    useEditorStore.getState().setRouteDepth(id, 4)
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    const depth = 88 - p.points[p.points.length - 1].y
    expect(depth).toBeCloseTo(4, 1)
    expect(depth).toBeGreaterThan(0)
  })

  it('shrinks a defensive route without flipping it', () => {
    useEditorStore.getState().addToken({ side: 'defense', pos: 'CB', num: '', x: 12, y: 40 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'go')
    useEditorStore.getState().setRouteDepth(id, 4)
    const p = useEditorStore.getState().paths.find((x) => x.id === id)!
    const depth = p.points[p.points.length - 1].y - 40
    expect(depth).toBeCloseTo(4, 1)
    expect(depth).toBeGreaterThan(0)
  })

  it('scales lateral break at the same time', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    const id = useEditorStore.getState().setPlayerPathType(tok.id, 'route')!
    useEditorStore.getState().applyRouteTemplate(id, 'post')
    const before = useEditorStore.getState().paths.find((x) => x.id === id)!
    const latBefore = Math.abs(before.points[before.points.length - 1].x - 12)
    useEditorStore.getState().setRouteDepth(id, 4)
    const after = useEditorStore.getState().paths.find((x) => x.id === id)!
    const latAfter = Math.abs(after.points[after.points.length - 1].x - 12)
    expect(latAfter).toBeLessThan(latBefore)
  })
})
