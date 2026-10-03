import { beforeEach, describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import { useEditorStore } from '../src/stores/editorStore'
import type { PlayPath, Token } from '../src/stores/editorStore'

const st = () => useEditorStore.getState()

/**
 * A runner sells a handoff or toss by moving *before* the ball gets there, so
 * his movement must never wait on the exchange. The ball is warped to meet him
 * instead. Gating the player produced a visible stop-and-go.
 */

const tok = (id: string, x: number, y: number, pos: Token['pos'] = 'WR'): Token => ({
  id,
  side: 'offense',
  pos,
  num: '',
  x,
  y,
})

const path = (
  id: string,
  type: PlayPath['type'],
  points: [number, number][],
  extra: Partial<PlayPath> = {},
): PlayPath => ({
  id,
  type,
  tokenId: null,
  endTokenId: null,
  points: points.map(([x, y]) => ({ x, y })),
  d: '',
  timing: { delayMs: 0, durationMs: 600 },
  ...extra,
})

const timed = (paths: PlayPath[]) => {
  const s = reschedule(paths)
  return { s, paths: paths.map((p) => ({ ...p, timing: s.get(p.id)! })) }
}

/** the runner's own drawn lane, plus a toss into him */
const tossAndRun = () =>
  [
    path('toss', 'toss', [[26, 93], [26, 86]], { tokenId: 'qb', endTokenId: 'rb' }),
    path('run', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' }),
  ]

describe('a runner is never gated on the toss', () => {
  it('starts his lane at the snap, with or without an exchange', () => {
    const alone = timed([path('run', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' })])
    const withToss = timed(tossAndRun())
    expect(withToss.paths[1].timing.delayMs).toBe(alone.paths[0].timing.delayMs)
  })

  it('keeps moving from the first instant — no freeze at the catch', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed(tossAndRun())
    const run = paths[1]
    const ys = [0, 0.25, 0.5, 0.75, 1].map(
      (f) =>
        computeScene(tokens, paths, {
          tMs: run.timing.delayMs + run.timing.durationMs * f,
          playing: true,
          ballStartId: 'qb',
        }).tokenPositions.get('rb')!.y,
    )
    // strictly advancing the whole way — never holds at the catch point
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1])
    expect(ys[0]).toBeCloseTo(88, 1)
  })

  it('does not jump: consecutive frames stay close together', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed(tossAndRun())
    const run = paths[1]
    let prev: number | null = null
    let maxJump = 0
    for (let i = 0; i <= 40; i++) {
      const t = run.timing.delayMs + (run.timing.durationMs * i) / 40
      const y = computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: 'qb' })
        .tokenPositions.get('rb')!.y
      if (prev !== null) maxJump = Math.max(maxJump, Math.abs(prev - y))
      prev = y
    }
    // 20 yards over 40 samples: no step may look like a teleport
    expect(maxJump).toBeLessThan(1.2)
  })
})

describe('the ball meets the runner instead', () => {
  it('hands possession to him once the toss completes', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed(tossAndRun())
    const toss = paths[0]
    const after = computeScene(tokens, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs + 50,
      playing: true,
      ballStartId: 'qb',
    })
    expect(after.ball!.flying).toBe(false)
    // tucked beside whoever holds it
    expect(Math.abs(after.ball!.pos.x - 26)).toBeLessThan(1.5)
  })

  it('is still with the quarterback while the toss is in the air', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed(tossAndRun())
    const toss = paths[0]
    const mid = computeScene(tokens, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs / 2,
      playing: true,
      ballStartId: 'qb',
    })
    expect(mid.ball!.flying).toBe(true)
  })

  it('tracks the runner rather than a fixed drawn endpoint', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed(tossAndRun())
    const toss = paths[0]
    const arrival = toss.timing.delayMs + toss.timing.durationMs
    const scene = computeScene(tokens, paths, { tMs: arrival, playing: true, ballStartId: 'qb' })
    const warped = scene.paths.find((p) => p.id === toss.id)!
    const rb = scene.tokenPositions.get('rb')!
    // the ball's far end sits on the runner at arrival, not on the drawn stub
    const end = warped.points[warped.points.length - 1]
    expect(Math.hypot(end.x - rb.x, end.y - rb.y)).toBeLessThan(1.5)
  })
})

describe('two authored movements still join with no seam', () => {
  it('continues the run from the tip of the approach', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed([
      path('approach', 'route', [[26, 88], [26, 86]], { tokenId: 'rb' }),
      path('handoff', 'handoff', [[26, 91], [26, 86]], { tokenId: 'qb', endTokenId: 'rb' }),
      path('run', 'run', [[26, 86], [26, 76]], { tokenId: 'rb' }),
    ])
    const run = paths[2]
    const atStart = computeScene(tokens, paths, {
      tMs: run.timing.delayMs + 1,
      playing: true,
      ballStartId: 'qb',
    }).tokenPositions.get('rb')!
    expect(atStart.y).toBeCloseTo(86, 0)
  })

  it('never sends the approach backwards behind its own start', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const { paths } = timed([
      path('approach', 'route', [[26, 88], [26, 86]], { tokenId: 'rb' }),
      path('handoff', 'handoff', [[26, 91], [26, 86]], { tokenId: 'qb', endTokenId: 'rb' }),
      path('run', 'run', [[26, 86], [26, 76]], { tokenId: 'rb' }),
    ])
    const approach = paths[0]
    for (const f of [0.25, 0.5, 0.75, 1]) {
      const y = computeScene(tokens, paths, {
        tMs: approach.timing.delayMs + approach.timing.durationMs * f,
        playing: true,
        ballStartId: 'qb',
      }).tokenPositions.get('rb')!.y
      expect(y).toBeLessThanOrEqual(88.01)
      expect(y).toBeGreaterThanOrEqual(85.99)
    }
  })
})

describe('a pass into a receiver still arrives after his route', () => {
  it('lands at the end of his route, not during it', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('wr', 20, 88)]
    const { s, paths } = timed([
      path('pass', 'pass', [[26, 93], [20, 78]], { tokenId: 'qb', endTokenId: 'wr' }),
      path('route', 'route', [[20, 88], [20, 78]], { tokenId: 'wr' }),
    ])
    expect(s.get('pass')!.delayMs + s.get('pass')!.durationMs).toBeGreaterThanOrEqual(
      s.get('route')!.delayMs + s.get('route')!.durationMs,
    )
    const arrival = s.get('pass')!.delayMs + s.get('pass')!.durationMs
    const scene = computeScene(tokens, paths, { tMs: arrival + 30, playing: true, ballStartId: 'qb' })
    expect(scene.tokenPositions.get('wr')!.y).toBeLessThan(78.5)
  })
})


describe('setPlayerRoute — one step from player to route', () => {
  beforeEach(() => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
  })
  const wr = (x = 14, y = 88) => {
    st().addToken({ side: 'offense', pos: 'WR', num: '', x, y })
    return st().tokens[st().tokens.length - 1]!
  }

  it('creates a route from a concept with no intermediate step', () => {
    const t = wr()
    const id = st().setPlayerRoute(t.id, 'slant')!
    const p = st().paths.find((x) => x.id === id)!
    expect(p.type).toBe('route')
    expect(p.tokenId).toBe(t.id)
    expect(p.points[0]).toEqual({ x: 14, y: 88 })
  })

  it('reshapes rather than stacking a second route', () => {
    const t = wr()
    st().setPlayerRoute(t.id, 'slant')
    const again = st().setPlayerRoute(t.id, 'post')
    expect(again).toBe(st().paths[0].id)
    expect(st().paths).toHaveLength(1)
  })

  it('does not change the selection', () => {
    const t = wr()
    useEditorStore.setState({ selectedIds: [t.id] })
    st().setPlayerRoute(t.id, 'go')
    expect(st().selectedIds).toEqual([t.id])
  })

  it('never stacks a route onto an existing one', () => {
    const t = wr()
    const first = st().setPlayerRoute(t.id, 'go')!
    st().setPlayerRoute(t.id, 'corner')
    expect(st().paths.filter((p) => p.type === 'route')).toHaveLength(1)
    expect(st().paths[0].id).toBe(first)
  })

  it('undoes back to no route', () => {
    const t = wr()
    st().setPlayerRoute(t.id, 'slant')
    st().undo()
    expect(st().paths.filter((p) => p.type === 'route')).toHaveLength(0)
  })

  it('builds a whole route sheet without drawing anything', () => {
    const concepts = ['slant', 'post', 'hitch', 'in'] as const
    const players = [wr(8), wr(16), wr(24), wr(32)]
    for (const [i, c] of concepts.entries()) st().setPlayerRoute(players[i].id, c)
    expect(st().paths).toHaveLength(4)
    expect(st().paths.every((p) => p.type === 'route')).toBe(true)
  })

  it('ignores an unknown player', () => {
    expect(st().setPlayerRoute('nope', 'slant')).toBeNull()
  })
})



describe('labelling a drawn path as a delivery', () => {
  beforeEach(() => {
    useEditorStore.setState({ tokens: [], paths: [], selectedIds: [], past: [], future: [] })
  })
  const add = (pos: string, x: number) => {
    st().addToken({ side: 'offense', pos, num: '', x, y: 88 })
    return st().tokens[st().tokens.length - 1]!
  }

  /** a path drawn from one player toward another, as the pen would make it */
  const draw = (fromId: string) =>
    st().addPath({
      tokenId: fromId,
      endTokenId: null,
      type: 'route',
      points: [
        { x: 26, y: 88 },
        { x: 30, y: 84 },
      ],
      d: '',
    })

  it('becomes a handoff and finds the receiver from the endpoint', () => {
    const qb = add('QB', 26)
    const rb = add('RB', 30)
    const id = draw(qb.id)
    st().updatePathType(id, 'handoff')
    const p = st().paths.find((x) => x.id === id)!
    expect(p.type).toBe('handoff')
    expect(p.endTokenId).toBe(rb.id)
  })

  it('becomes a toss the same way', () => {
    const qb = add('QB', 26)
    const rb = add('RB', 30)
    const id = draw(qb.id)
    st().updatePathType(id, 'toss')
    expect(st().paths.find((x) => x.id === id)!.endTokenId).toBe(rb.id)
  })

  it('becomes a pass and straightens to a two-point line', () => {
    const qb = add('QB', 26)
    add('WR', 30)
    const id = draw(qb.id)
    st().updatePathType(id, 'pass')
    const p = st().paths.find((x) => x.id === id)!
    expect(p.type).toBe('pass')
    expect(p.points).toHaveLength(2)
  })

  it('keeps an already-assigned receiver', () => {
    const qb = add('QB', 26)
    const rb = add('RB', 30)
    const id = st().addPath({
      tokenId: qb.id,
      endTokenId: rb.id,
      type: 'route',
      points: [{ x: 26, y: 88 }, { x: 30, y: 84 }],
      d: '',
    })
    st().updatePathType(id, 'handoff')
    expect(st().paths.find((x) => x.id === id)!.endTokenId).toBe(rb.id)
  })

  it('resolves to a player who has not run a route', () => {
    const qb = add('QB', 26)
    const rb = add('RB', 30)
    const id = draw(qb.id)
    expect(st().paths.find((x) => x.id === id)!.endTokenId).toBeNull()
    st().updatePathType(id, 'handoff')
    expect(st().paths.find((x) => x.id === id)!.endTokenId).toBe(rb.id)
  })

  it('prefers a route tip over a nearer standing player', () => {
    const qb = add('QB', 26)
    const rb = add('RB', 30)
    add('WR', 31)
    const route = st().setPlayerRoute(rb.id, 'go')!
    const rp = st().paths.find((p) => p.id === route)!
    const tip = rp.points[rp.points.length - 1]
    const id = st().addPath({
      tokenId: qb.id,
      endTokenId: null,
      type: 'route',
      points: [{ x: 26, y: 88 }, { x: tip.x, y: tip.y }],
      d: '',
    })
    st().updatePathType(id, 'handoff')
    expect(st().paths.find((x) => x.id === id)!.endTokenId).toBe(rb.id)
  })

  it('undoes the relabel', () => {
    const qb = add('QB', 26)
    add('RB', 30)
    const id = draw(qb.id)
    st().updatePathType(id, 'toss')
    st().undo()
    expect(st().paths.find((x) => x.id === id)!.type).toBe('route')
  })
})
