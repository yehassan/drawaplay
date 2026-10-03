import { describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import { polylineLength } from '../src/lib/geometry'
import { SCENARIOS } from '../src/lib/scenarios'
import type { PlayPath, Token } from '../src/stores/editorStore'

/**
 * Characterization for ball exchange, written BEFORE the timing rework.
 *
 * A review pass overturned the first draft of this file. It had asserted "the
 * rendered flight always terminates on the receiver" — that is FALSE. A flight
 * is only warped onto its receiver when the receiver has a movement to be found
 * in, and the warp uses raw geometry while the receiver renders translated
 * geometry. Measured gaps are recorded below instead, because those are the
 * cases stage 3 has to not make worse.
 *
 * Section 1 pins behaviour that is genuinely true today.
 * Section 2 pins the known defects, with real numbers.
 * Section 3 records the numbers stage 3 is expected to move.
 */

const tok = (id: string, x: number, y: number, pos: Token['pos']): Token => ({
  id,
  side: 'offense',
  pos,
  num: '',
  x,
  y,
})

const P = (
  id: string,
  type: PlayPath['type'],
  pts: [number, number][],
  extra: Partial<PlayPath> = {},
): PlayPath => ({
  id,
  type,
  tokenId: null,
  endTokenId: null,
  points: pts.map(([x, y]) => ({ x, y })),
  d: '',
  timing: { delayMs: 0, durationMs: 600 },
  ...extra,
})

function schedule(raw: PlayPath[]) {
  const s = reschedule(raw)
  return { s, paths: raw.map((p) => ({ ...p, timing: s.get(p.id)! })) }
}

/** rendered far end of a flight vs where the receiver actually is at arrival */
function landing(tokens: Token[], paths: PlayPath[], flightId: string, receiverId: string, startId: string) {
  const f = paths.find((p) => p.id === flightId)!
  const arrival = f.timing.delayMs + f.timing.durationMs
  const sc = computeScene(tokens, paths, { tMs: arrival, playing: true, ballStartId: startId })
  const pts = sc.paths.find((p) => p.id === flightId)!.points
  const far = pts[pts.length - 1]
  const receiver = sc.tokenPositions.get(receiverId)!
  return { gap: Math.hypot(far.x - receiver.x, far.y - receiver.y), sc, far, receiver, arrival }
}

const TOKENS = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]

/** a toss aimed down the same line the receiver runs — collinear geometry */
const TOSS_TO_RUNNER = () => [
  P('toss', 'toss', [[26, 92], [26, 84]], { tokenId: 'qb', endTokenId: 'rb' }),
  P('run', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' }),
]

describe('TRUE today — possession', () => {
  it('the ball is airborne mid-flight and held after it', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    const mid = computeScene(TOKENS, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs / 2,
      playing: true,
      ballStartId: 'qb',
    })
    expect(mid.ball!.flying).toBe(true)

    const after = computeScene(TOKENS, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs + 30,
      playing: true,
      ballStartId: 'qb',
    })
    expect(after.ball!.flying).toBe(false)
    const rb = after.tokenPositions.get('rb')!
    expect(Math.hypot(after.ball!.pos.x - rb.x, after.ball!.pos.y - rb.y)).toBeLessThan(1.2)
  })

  it('the ball rides with the receiver for the rest of his run', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    const run = paths.find((p) => p.id === 'run')!
    const after = toss.timing.delayMs + toss.timing.durationMs
    const until = run.timing.delayMs + run.timing.durationMs
    for (const f of [0.5, 0.8, 1]) {
      const sc = computeScene(TOKENS, paths, { tMs: after + (until - after) * f, playing: true, ballStartId: 'qb' })
      const rb = sc.tokenPositions.get('rb')!
      expect(Math.hypot(sc.ball!.pos.x - rb.x, sc.ball!.pos.y - rb.y), `f=${f}`).toBeLessThan(1.2)
    }
  })

  it('the ball advances along the flight rather than jumping', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    const ys: number[] = []
    for (let i = 0; i <= 10; i++) {
      const t = toss.timing.delayMs + (toss.timing.durationMs * i) / 10
      ys.push(computeScene(TOKENS, paths, { tMs: t, playing: true, ballStartId: 'qb' }).ball!.pos.y)
    }
    for (let i = 1; i < ys.length; i++) expect(ys[i], `step ${i}`).toBeLessThan(ys[i - 1])
  })
})

describe('TRUE today — a flight never disturbs the receiver', () => {
  it('a tossed-to runner advances the whole way with no stall', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const run = paths.find((p) => p.id === 'run')!
    const ys: number[] = []
    for (let i = 0; i <= 30; i++) {
      const t = run.timing.delayMs + (run.timing.durationMs * i) / 30
      ys.push(computeScene(TOKENS, paths, { tMs: t, playing: true, ballStartId: 'qb' }).tokenPositions.get('rb')!.y)
    }
    for (let i = 1; i < ys.length; i++) expect(ys[i], `step ${i}`).toBeLessThan(ys[i - 1])
    expect(ys[ys.length - 1]).toBeCloseTo(78, 1)
  })

  it('no frame moves him more than a stride', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const run = paths.find((p) => p.id === 'run')!
    let prev: number | null = null
    let worst = 0
    for (let i = 0; i <= 60; i++) {
      const t = run.timing.delayMs + (run.timing.durationMs * i) / 60
      const y = computeScene(TOKENS, paths, { tMs: t, playing: true, ballStartId: 'qb' }).tokenPositions.get('rb')!.y
      if (prev !== null) worst = Math.max(worst, Math.abs(prev - y))
      prev = y
    }
    expect(worst).toBeLessThan(1.0)
  })

  it('a stationary receiver is never displaced', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 30, 88, 'RB')]
    const { paths } = schedule([P('toss', 'toss', [[26, 92], [30, 88]], { tokenId: 'qb', endTokenId: 'rb' })])
    const sc = computeScene(tokens, paths, { tMs: 2000, playing: true, ballStartId: 'qb' })
    expect(sc.tokenPositions.get('rb')!.x).toBeCloseTo(30, 5)
    expect(sc.tokenPositions.get('rb')!.y).toBeCloseTo(88, 5)
  })
})

describe('KNOWN DEFECT — a stationary receiver is never warped onto', () => {
  it('the flight keeps its authored end, so the ball lands short of him', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 30, 88, 'RB')]
    const raw = [P('toss', 'toss', [[26, 92], [34, 84]], { tokenId: 'qb', endTokenId: 'rb' })]
    const { paths } = schedule(raw)
    const { gap, far, receiver } = landing(tokens, paths, 'toss', 'rb', 'qb')
    // render.ts only warps a receiver that has an entry in drivenByToken; a
    // receiver who never moved has none, so the drawn end survives untouched
    expect(far).toEqual({ x: 34, y: 84 })
    expect(receiver.x).toBeCloseTo(30, 5)
    expect(gap).toBeGreaterThan(5)
  })

  it('so a receiver standing ON the aim point only passes by construction', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 30, 88, 'RB')]
    const { paths } = schedule([P('toss', 'toss', [[26, 92], [30, 88]], { tokenId: 'qb', endTokenId: 'rb' })])
    expect(landing(tokens, paths, 'toss', 'rb', 'qb').gap).toBeLessThan(0.001)
  })
})

describe('KNOWN DEFECT — the warp uses raw geometry, the receiver renders translated', () => {
  it('leaves a gap when a route is authored off the chain seam', () => {
    // route starts 0.2yd off where the motion actually ends; bindStartToChain
    // translates the rendered route onto the chain but the warp does not
    const raw = [
      P('motion', 'motion', [[26, 88], [26, 84]], { tokenId: 'rb' }),
      P('route', 'route', [[26.02, 84.2], [26, 74]], { tokenId: 'rb' }),
      P('toss', 'toss', [[26, 92], [26, 74]], { tokenId: 'qb', endTokenId: 'rb' }),
    ]
    const { paths } = schedule(raw)
    const { gap } = landing(TOKENS, paths, 'toss', 'rb', 'qb')
    expect(gap).toBeGreaterThan(0.15)
    expect(gap).toBeLessThan(0.3)
  })

  it('is exact when the route is authored onto the seam', () => {
    const raw = [
      P('motion', 'motion', [[26, 88], [26, 84]], { tokenId: 'rb' }),
      P('route', 'route', [[26, 84], [26, 74]], { tokenId: 'rb' }),
      P('toss', 'toss', [[26, 92], [26, 74]], { tokenId: 'qb', endTokenId: 'rb' }),
    ]
    const { paths } = schedule(raw)
    expect(landing(TOKENS, paths, 'toss', 'rb', 'qb').gap).toBeLessThan(0.001)
  })
})

describe('KNOWN DEFECT — two positional selectors disagree on equal delayMs', () => {
  it('the flight anchors on a different movement than the one he renders', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('wr', 14, 88, 'WR')]
    const a = P('a', 'route', [[14, 88], [14, 78]], {
      tokenId: 'wr', userLocked: true, timing: { delayMs: 300, durationMs: 1000 },
    })
    const b = P('b', 'route', [[14, 88], [20, 74]], {
      tokenId: 'wr', userLocked: true, timing: { delayMs: 300, durationMs: 1000 },
    })
    const toss = P('toss', 'toss', [[26, 92], [18, 76]], { tokenId: 'qb', endTokenId: 'wr' })
    const { paths } = schedule([a, b, toss])
    // chainPosAt takes the last in list order; the token loop takes the greatest
    // delayMs, so they diverge on a tie
    const { gap } = landing(tokens, paths, 'toss', 'wr', 'qb')
    expect(gap).toBeGreaterThan(0.3)
  })
})

describe('KNOWN — a drawn flight can have no receiver at all', () => {
  it('resolveFlightTarget returns null when no route tip is in range', () => {
    // FieldCanvas calls it without `tokens`, so the loose nearest-player
    // fallback is unreachable and a stroke into empty grass resolves to nobody
    const raw = [P('p', 'route', [[26, 92], [20, 70]], { tokenId: 'qb' })]
    const { paths } = schedule(raw)
    expect(paths[0].endTokenId).toBeNull()
  })

  it('and relabelling it as a pass leaves it receiverless', () => {
    const { paths } = schedule([P('p', 'route', [[26, 92], [20, 70]], { tokenId: 'qb' })])
    const store = paths.map((p) => ({ ...p, type: 'pass' as const }))
    expect(store[0].endTokenId).toBeNull()
  })
})

describe('KNOWN — no scenario flight is exempt from rescheduling', () => {
  it('userLocked is applied only where a seed carried real timing', () => {
    let flights = 0
    let lockedFlights = 0
    for (const s of SCENARIOS) {
      for (const p of s.build().paths) {
        if (!['pass', 'toss', 'handoff', 'snap'].includes(p.type)) continue
        flights++
        if (p.userLocked) lockedFlights++
      }
    }
    expect(flights).toBeGreaterThan(0)
    expect(lockedFlights).toBe(0)
  })

  it('and every scenario flight is actually rescheduled', () => {
    let changed = 0
    let total = 0
    for (const s of SCENARIOS) {
      const seeded = s.build().paths.map((p, i) => ({
        ...p,
        id: `s${i}`,
        timing: p.timing ?? { delayMs: 0, durationMs: 600 },
        userLocked: !!p.timing,
      })) as PlayPath[]
      const sched = reschedule(seeded)
      for (const p of seeded) {
        if (!['pass', 'toss', 'handoff', 'snap'].includes(p.type)) continue
        total++
        const t = sched.get(p.id)!
        if (t.delayMs !== p.timing.delayMs || t.durationMs !== p.timing.durationMs) changed++
      }
    }
    expect(total).toBeGreaterThan(0)
    expect(changed).toBe(total)
  })
})

describe('KNOWN — flight timing locks are ignored', () => {
  it('a locked flight is still rescheduled, because flights are exempt', () => {
    const { s } = schedule([
      P('p', 'pass', [[26, 92], [20, 70]], {
        tokenId: 'qb', endTokenId: 'wr', userLocked: true,
        timing: { delayMs: 9999, durationMs: 1234 },
      }),
    ])
    expect(s.get('p')!.delayMs).not.toBe(9999)
    expect(s.get('p')!.durationMs).not.toBe(1234)
  })

  it('a locked movement, by contrast, is honoured', () => {
    const { s } = schedule([
      P('r', 'route', [[14, 88], [14, 78]], {
        tokenId: 'wr', userLocked: true, timing: { delayMs: 4200, durationMs: 1111 },
      }),
    ])
    expect(s.get('r')!.delayMs).toBe(4200)
    expect(s.get('r')!.durationMs).toBe(1111)
  })
})

describe('RECORDED — numbers stage 3 is expected to move', () => {
  it('toss duration ignores drawn distance entirely', () => {
    const short = schedule([P('toss', 'toss', [[26, 92], [27, 89]], { tokenId: 'qb', endTokenId: 'rb' })])
    const long = schedule(TOSS_TO_RUNNER())
    expect(short.paths[0].timing.durationMs).toBe(450)
    expect(long.paths[0].timing.durationMs).toBe(450)
    expect(polylineLength(short.paths[0].points)).toBeLessThan(4)
    expect(polylineLength(long.paths[0].points)).toBeGreaterThan(6)
  })

  it('a deep pass flies 40% of the route and launches late', () => {
    const { s } = schedule([
      P('pass', 'pass', [[26, 92], [14, 68]], { tokenId: 'qb', endTokenId: 'wr' }),
      P('route', 'route', [[14, 88], [14, 68]], { tokenId: 'wr' }),
    ])
    const pass = s.get('pass')!
    const route = s.get('route')!
    expect(pass.durationMs).toBe(Math.round(route.durationMs * 0.4))
    expect(pass.delayMs + pass.durationMs).toBe(route.delayMs + route.durationMs)
  })

  it('a release hitch can leave the ball arriving long after the route ended', () => {
    // stationary QB releases at +550ms, but the receiver's route is already over
    const { s } = schedule([
      P('route', 'route', [[14, 88], [14, 86]], { tokenId: 'wr' }),
      P('pass', 'pass', [[26, 92], [14, 86]], { tokenId: 'qb', endTokenId: 'wr' }),
    ])
    expect(s.get('pass')!.delayMs + s.get('pass')!.durationMs).toBeGreaterThan(
      s.get('route')!.delayMs + s.get('route')!.durationMs + 500,
    )
  })
})
describe('KNOWN — reschedule is settled after a single pass', () => {
  it('a second pass changes nothing', () => {
    // the loop runs 3x for no reason; nothing upstream ever reads a flight
    const raw = [
      P('motion', 'motion', [[14, 88], [16, 86]], { tokenId: 'wr' }),
      P('snap', 'snap', [[26, 90], [26, 92.6]], { tokenId: 'C', endTokenId: 'qb' }),
      P('drop', 'drop', [[26, 92], [26, 85]], { tokenId: 'qb' }),
      P('route', 'route', [[14, 88], [14, 78]], { tokenId: 'wr' }),
      P('pass', 'pass', [[26, 85], [14, 78]], { tokenId: 'qb', endTokenId: 'wr' }),
      P('handoff', 'handoff', [[26, 92.6], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' }),
    ]
    const tokens = raw.map((p, i) => ({ ...p, id: `p${i}` }))
    const once = reschedule(tokens)
    const twice = reschedule(tokens.map((p) => ({ ...p, timing: once.get(p.id)! })))
    for (const p of tokens) {
      expect(twice.get(p.id), p.id).toEqual(once.get(p.id))
    }
  })

  it('and it is deterministic across repeated calls on the same input', () => {
    const raw = [
      P('route', 'route', [[14, 88], [14, 78]], { tokenId: 'wr' }),
      P('pass', 'pass', [[26, 92], [14, 78]], { tokenId: 'qb', endTokenId: 'wr' }),
    ].map((p, i) => ({ ...p, id: `p${i}` }))
    expect([...reschedule(raw)]).toEqual([...reschedule(raw)])
  })
})
