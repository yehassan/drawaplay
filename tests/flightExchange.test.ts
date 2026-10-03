import { describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import { polylineLength } from '../src/lib/geometry'
import { FLIGHT_TYPES, PLAYER_DRIVEN } from '../src/lib/pathStyles'
import { resolveFlightTarget } from '../src/lib/target'
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

describe('SAFETY NET — every visible flight lands on its own receiver', () => {
  /**
   * The invariant that was missing. Every ball-vs-receiver check in the suite
   * sat AFTER arrival, where ball.ts returns `holder + {x:0.55, y:-0.35}` — a
   * constant 0.6495yd whenever possession has transferred. Those checks cannot
   * fail, so a ball flying six yards past its receiver was invisible to all 217
   * tests.
   *
   * Sampled one frame BEFORE arrival, while the ball is genuinely in flight.
   *
   * Note the ownership filter: flights overlap by design (H4 — every flight
   * flies in its own window so double reads work), so at a given instant the
   * ball belongs to the MOST RECENTLY LAUNCHED flight still airborne. A flight
   * superseded before it lands is skipped, because asserting its receiver would
   * be wrong rather than strict. Verified to fail when the receiver-side warp
   * in render.ts is disabled (worst 4.37yd).
   */
  const visibleFlightAt = (paths: PlayPath[], tMs: number) => {
    let cand: PlayPath | null = null
    for (const f of paths
      .filter((p) => FLIGHT_TYPES.has(p.type) && p.tokenId != null && p.points.length >= 2)
      .sort((a, b) => a.timing.delayMs - b.timing.delayMs)) {
      if (tMs < f.timing.delayMs) break
      if (tMs < f.timing.delayMs + f.timing.durationMs) cand = f
    }
    return cand
  }

  const scenarioFlights = () =>
    SCENARIOS.flatMap((s) => {
      const built = s.build()
      const seeded = built.paths.map((p, i) => ({
        ...p,
        id: `f${i}`,
        timing: p.timing ?? { delayMs: 0, durationMs: 600 },
        userLocked: !!p.timing,
      })) as PlayPath[]
      const sched = reschedule(seeded)
      const paths = seeded.map((p) => ({ ...p, timing: sched.get(p.id)! }))
      return paths
        .filter((p) => ['pass', 'toss', 'handoff'].includes(p.type) && p.endTokenId && p.timing.durationMs > 40)
        .map((f) => ({ name: s.name, tokens: built.tokens, paths, flight: f }))
    })

  it('is actually exercised — flights were sampled, not all skipped', () => {
    const all = scenarioFlights()
    const visible = all.filter(
      ({ paths, flight }) =>
        visibleFlightAt(paths, flight.timing.delayMs + flight.timing.durationMs - 1)?.id === flight.id,
    )
    expect(visible.length).toBeGreaterThanOrEqual(8)
  })

  it('the ball is at the receiver on arrival, for every visible flight', () => {
    const offenders: string[] = []
    let worst = 0
    for (const { name, tokens, paths, flight } of scenarioFlights()) {
      const at = flight.timing.delayMs + flight.timing.durationMs - 1
      if (visibleFlightAt(paths, at)?.id !== flight.id) continue
      const sc = computeScene(tokens, paths, { tMs: at, playing: true, ballStartId: null })
      const r = sc.tokenPositions.get(flight.endTokenId!)
      if (!sc.ball || !r) continue
      const d = Math.hypot(sc.ball.pos.x - r.x, sc.ball.pos.y - r.y)
      worst = Math.max(worst, d)
      if (d > 1.0) offenders.push(`${name} / ${flight.type} ${flight.id}: ${d.toFixed(2)}yd`)
    }
    expect(offenders).toEqual([])
    // headroom, so an ordinary regression trips the bound above before this
    expect(worst).toBeLessThan(0.5)
  })

  /**
   * The mirror of the arrival net. Sampling only at arrival is blind to the
   * thrower-side anchor: disabling the release warp in render.ts still passes
   * the arrival check, because by arrival the start anchor has faded out
   * (u = 1). Checked one frame after release instead.
   */
  const moves = (paths: PlayPath[], id: string | null) =>
    paths.some((p) => p.tokenId === id && PLAYER_DRIVEN.has(p.type))

  it('the ball leaves the thrower on release, when the thrower actually moves', () => {
    const offenders: string[] = []
    for (const { name, tokens, paths, flight } of scenarioFlights()) {
      if (!moves(paths, flight.tokenId)) continue
      const at = flight.timing.delayMs + 1
      if (visibleFlightAt(paths, at)?.id !== flight.id) continue
      const sc = computeScene(tokens, paths, { tMs: at, playing: true, ballStartId: null })
      const q = sc.tokenPositions.get(flight.tokenId!)
      if (!sc.ball || !q) continue
      const d = Math.hypot(sc.ball.pos.x - q.x, sc.ball.pos.y - q.y)
      if (d > 1.5) offenders.push(`${name} / ${flight.type} ${flight.id}: ${d.toFixed(2)}yd`)
    }
    expect(offenders).toEqual([])
  })

  /**
   * Regression guard for the standing-thrower fix. render.ts used to warp a
   * thrower only if he had a player-driven path, so the Dive scenario's handoff
   * released from 6.3yd behind the QB token — the ball visibly left from empty
   * grass. The anchor now falls back to the token's rest position.
   */
  it('a flight released by a standing thrower leaves from the thrower', () => {
    const offenders: string[] = []
    let sawStanding = 0
    for (const { name, tokens, paths, flight } of scenarioFlights()) {
      if (moves(paths, flight.tokenId)) continue
      const at = flight.timing.delayMs + 1
      if (visibleFlightAt(paths, at)?.id !== flight.id) continue
      sawStanding++
      const sc = computeScene(tokens, paths, { tMs: at, playing: true, ballStartId: null })
      const q = sc.tokenPositions.get(flight.tokenId!)
      if (!sc.ball || !q) continue
      const d = Math.hypot(sc.ball.pos.x - q.x, sc.ball.pos.y - q.y)
      if (d > 1.5) offenders.push(`${name} / ${flight.type} ${flight.id}: ${d.toFixed(2)}yd`)
    }
    expect(sawStanding).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })

  it('the ball does not jump during flight', () => {
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

describe('FIXED — both anchors are read at their own instants', () => {
  /**
   * The thrower anchor must be the thrower at RELEASE, and the receiver anchor
   * the receiver at ARRIVAL — never the live tMs, and never each other's instant.
   * A QB who is still rolling when the ball lands is the case that catches it:
   * reading the thrower at arrival starts the ball from wherever he got to.
   *
   * Timings are set by hand rather than through reschedule, because reschedule
   * rewrites a userLocked flight's timing (flights are exempt from locks) and
   * would quietly move the pass out of the QB's rollout.
   */
  it('a rolling QB releases the ball from where he was, not where he got to', () => {
    const tokens = [tok('qb', 26, 92, 'QB'), tok('wr', 20, 70, 'WR')]
    const paths: PlayPath[] = [
      P('drop', 'drop', [[26, 92], [26, 88]], { tokenId: 'qb', timing: { delayMs: 0, durationMs: 400 } }),
      // still rolling at the ball's arrival (1100ms)
      P('rollout', 'run', [[26, 88], [40, 74]], { tokenId: 'qb', timing: { delayMs: 400, durationMs: 2000 } }),
      P('pass', 'pass', [[26, 91], [20, 70]], {
        tokenId: 'qb', endTokenId: 'wr', timing: { delayMs: 500, durationMs: 600 },
      }),
    ]
    const atRelease = 501
    const sc = computeScene(tokens, paths, { tMs: atRelease, playing: true, ballStartId: 'qb' })
    const qb = sc.tokenPositions.get('qb')!
    expect(sc.ball!.flying).toBe(true)
    expect(Math.hypot(sc.ball!.pos.x - qb.x, sc.ball!.pos.y - qb.y)).toBeLessThan(1.0)

    // and the QB really was still moving, so this is not a trivial pass
    const atArrival = computeScene(tokens, paths, { tMs: 1100, playing: true, ballStartId: 'qb' })
      .tokenPositions.get('qb')!
    expect(Math.hypot(atArrival.x - qb.x, atArrival.y - qb.y)).toBeGreaterThan(5)
  })

  it('a rolling receiver is met where he ends up, not where he was', () => {
    const tokens = [tok('qb', 26, 92, 'QB'), tok('wr', 20, 88, 'WR')]
    const paths: PlayPath[] = [
      P('route', 'route', [[20, 88], [20, 70]], { tokenId: 'wr', timing: { delayMs: 0, durationMs: 2000 } }),
      P('pass', 'pass', [[26, 91], [20, 72]], {
        tokenId: 'qb', endTokenId: 'wr', timing: { delayMs: 100, durationMs: 1200 },
      }),
    ]
    const sc = computeScene(tokens, paths, { tMs: 1299, playing: true, ballStartId: 'qb' })
    const wr = sc.tokenPositions.get('wr')!
    expect(Math.hypot(sc.ball!.pos.x - wr.x, sc.ball!.pos.y - wr.y)).toBeLessThan(0.1)
  })
})

describe('FIXED — a stationary receiver is warped onto', () => {
  it('the flight is stretched to reach him even though he never moved', () => {
    // he has no player-driven path, so the end anchor falls back to his rest
    // position instead of leaving the stroke wherever it was drawn
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 30, 88, 'RB')]
    const { paths } = schedule([P('toss', 'toss', [[26, 92], [34, 84]], { tokenId: 'qb', endTokenId: 'rb' })])
    const { gap, far, receiver } = landing(tokens, paths, 'toss', 'rb', 'qb')
    expect(receiver.x).toBeCloseTo(30, 5)
    expect(far.x).toBeCloseTo(30, 2)
    expect(gap).toBeLessThan(0.05)
  })

  it('and one already drawn onto him is left alone', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 30, 88, 'RB')]
    const { paths } = schedule([P('toss', 'toss', [[26, 92], [30, 88]], { tokenId: 'qb', endTokenId: 'rb' })])
    expect(landing(tokens, paths, 'toss', 'rb', 'qb').gap).toBeLessThan(0.001)
  })
})

describe('FIXED — the warp and the player now agree', () => {
  it('a route authored off the chain seam still lands on him', () => {
    // the route starts 0.2yd off where the motion ends; the seam is closed by
    // translation, and the end anchor now reads the translated geometry too
    const raw = [
      P('motion', 'motion', [[26, 88], [26, 84]], { tokenId: 'rb' }),
      P('route', 'route', [[26.02, 84.2], [26, 74]], { tokenId: 'rb' }),
      P('toss', 'toss', [[26, 92], [26, 74]], { tokenId: 'qb', endTokenId: 'rb' }),
    ]
    const { paths } = schedule(raw)
    expect(landing(TOKENS, paths, 'toss', 'rb', 'qb').gap).toBeLessThan(0.001)
  })

  it('a route authored onto the seam is unaffected', () => {
    const raw = [
      P('motion', 'motion', [[26, 88], [26, 84]], { tokenId: 'rb' }),
      P('route', 'route', [[26, 84], [26, 74]], { tokenId: 'rb' }),
      P('toss', 'toss', [[26, 92], [26, 74]], { tokenId: 'qb', endTokenId: 'rb' }),
    ]
    const { paths } = schedule(raw)
    expect(landing(TOKENS, paths, 'toss', 'rb', 'qb').gap).toBeLessThan(0.001)
  })

  it('two movements sharing a delayMs anchor on the one he renders', () => {
    // both used to answer differently: greatest-start vs last-in-list
    const tokens = [tok('qb', 26, 93, 'QB'), tok('wr', 14, 88, 'WR')]
    const a = P('a', 'route', [[14, 88], [14, 78]], {
      tokenId: 'wr', userLocked: true, timing: { delayMs: 300, durationMs: 1000 },
    })
    const b = P('b', 'route', [[14, 88], [20, 74]], {
      tokenId: 'wr', userLocked: true, timing: { delayMs: 300, durationMs: 1000 },
    })
    const toss = P('toss', 'toss', [[26, 92], [18, 76]], { tokenId: 'qb', endTokenId: 'wr' })
    const { paths } = schedule([a, b, toss])
    expect(landing(tokens, paths, 'toss', 'wr', 'qb').gap).toBeLessThan(0.001)
  })
})

describe('KNOWN — a drawn flight can have no receiver at all', () => {
  // far end lands 5yd from a standing player but within 2.5yd of NO route tip,
  // so only the loose fallback can resolve it
  const intoGrass = P('p', 'route', [[26, 92], [22, 85]], { tokenId: 'qb' })

  it('resolveFlightTarget returns null when nothing is near the stroke', () => {
    // FieldCanvas.tsx calls it without `tokens`, so the loose nearest-player
    // fallback is unreachable there and a stroke into empty grass resolves to
    // nobody. Asserted against the real function, not against a fixture.
    expect(resolveFlightTarget(intoGrass.points, 'qb', [intoGrass], 'pass')).toBeNull()
  })

  it('and it still resolves when the loose fallback is supplied', () => {
    expect(resolveFlightTarget(intoGrass.points, 'qb', [intoGrass], 'pass', TOKENS)).not.toBeNull()
  })

  it('so the two call sites disagree about the same stroke', () => {
    const canvas = resolveFlightTarget(intoGrass.points, 'qb', [intoGrass], 'pass')
    const store = resolveFlightTarget(intoGrass.points, 'qb', [intoGrass], 'pass', TOKENS)
    expect(canvas).toBeNull()
    expect(store).not.toBeNull()
  })

  it('a non-targetable type is never given a receiver', () => {
    expect(resolveFlightTarget(intoGrass.points, 'qb', [intoGrass], 'run', TOKENS)).toBeNull()
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
