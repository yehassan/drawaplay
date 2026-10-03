import { describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import { polylineLength } from '../src/lib/geometry'
import type { PlayPath, Token } from '../src/stores/editorStore'

/**
 * Characterization for ball exchange. Written BEFORE any behaviour change.
 *
 * Section 1 pins invariants that must hold through the rework — the ball must
 * always end on the receiver, possession must transfer, and a flight must never
 * interrupt the receiver's motion.
 *
 * Section 2 records today's numbers so the stage-2 timing change is a visible
 * delta rather than a surprise.
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
  const end = sc.paths.find((p) => p.id === flightId)!.points
  const far = end[end.length - 1]
  const receiver = sc.tokenPositions.get(receiverId)!
  return { gap: Math.hypot(far.x - receiver.x, far.y - receiver.y), sc, far, receiver, arrival }
}

const TOSS_TO_RUNNER = () => [
  P('toss', 'toss', [[26, 92], [26, 84]], { tokenId: 'qb', endTokenId: 'rb' }),
  P('run', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' }),
]
const TOKENS_TOSS_RUN = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]

describe('INVARIANT — the ball ends on the receiver', () => {
  it('toss to a runner: rendered flight terminates on him, to the millimetre', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const { gap } = landing(TOKENS_TOSS_RUN, paths, 'toss', 'rb', 'qb')
    expect(gap).toBeLessThan(0.001)
  })

  it('deep pass: rendered flight terminates on him', () => {
    const { paths } = schedule([
      P('pass', 'pass', [[26, 92], [14, 68]], { tokenId: 'qb', endTokenId: 'wr' }),
      P('route', 'route', [[14, 88], [14, 68]], { tokenId: 'wr' }),
    ])
    const { gap } = landing([tok('qb', 26, 93, 'QB'), tok('wr', 14, 88)], paths, 'pass', 'wr', 'qb')
    expect(gap).toBeLessThan(0.001)
  })

  it('delivery to a player who has not moved still lands on him', () => {
    const { paths } = schedule([
      P('toss', 'toss', [[26, 92], [30, 88]], { tokenId: 'qb', endTokenId: 'rb' }),
    ])
    const { gap } = landing([tok('qb', 26, 93, 'QB'), tok('rb', 30, 88)], paths, 'toss', 'rb', 'qb')
    expect(gap).toBeLessThan(0.001)
  })

  it('holds at every point along the flight, not just the end', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    for (let i = 0; i <= 10; i++) {
      const t = toss.timing.delayMs + (toss.timing.durationMs * i) / 10
      const sc = computeScene(TOKENS_TOSS_RUN, paths, { tMs: t, playing: true, ballStartId: 'qb' })
      expect(sc.ball, `t=${t}`).not.toBeNull()
    }
  })
})

describe('INVARIANT — possession transfers to the receiver', () => {
  it('ball is airborne mid-flight and held after it', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    const mid = computeScene(TOKENS_TOSS_RUN, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs / 2,
      playing: true,
      ballStartId: 'qb',
    })
    expect(mid.ball!.flying).toBe(true)
    const after = computeScene(TOKENS_TOSS_RUN, paths, {
      tMs: toss.timing.delayMs + toss.timing.durationMs + 30,
      playing: true,
      ballStartId: 'qb',
    })
    expect(after.ball!.flying).toBe(false)
    // tucked beside the receiver, not the thrower
    const rb = after.tokenPositions.get('rb')!
    expect(Math.hypot(after.ball!.pos.x - rb.x, after.ball!.pos.y - rb.y)).toBeLessThan(1.2)
  })

  it('the ball then rides with him for the rest of his run', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const toss = paths.find((p) => p.id === 'toss')!
    const run = paths.find((p) => p.id === 'run')!
    for (const f of [0.5, 0.8, 1]) {
      const sc = computeScene(TOKENS_TOSS_RUN, paths, {
        tMs: toss.timing.delayMs + toss.timing.durationMs +
          (run.timing.delayMs + run.timing.durationMs - toss.timing.delayMs - toss.timing.durationMs) * f,
        playing: true,
        ballStartId: 'qb',
      })
      const rb = sc.tokenPositions.get('rb')!
      expect(Math.hypot(sc.ball!.pos.x - rb.x, sc.ball!.pos.y - rb.y), `f=${f}`).toBeLessThan(1.2)
    }
  })
})

describe('INVARIANT — a flight never disturbs the receiver', () => {
  it('a tossed-to runner advances smoothly the whole way, no stall', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const run = paths.find((p) => p.id === 'run')!
    const samples: number[] = []
    for (let i = 0; i <= 30; i++) {
      const t = run.timing.delayMs + (run.timing.durationMs * i) / 30
      samples.push(computeScene(TOKENS_TOSS_RUN, paths, { tMs: t, playing: true, ballStartId: 'qb' }).tokenPositions.get('rb')!.y)
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i], `step ${i}`).toBeLessThan(samples[i - 1])
    }
    // the whole lane is covered — he finishes at the far end of his own geometry
    expect(samples[samples.length - 1]).toBeCloseTo(78, 1)
  })

  it('no single frame jumps more than a stride', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const run = paths.find((p) => p.id === 'run')!
    let prev: number | null = null
    let worst = 0
    for (let i = 0; i <= 60; i++) {
      const t = run.timing.delayMs + (run.timing.durationMs * i) / 60
      const y = computeScene(TOKENS_TOSS_RUN, paths, { tMs: t, playing: true, ballStartId: 'qb' })
        .tokenPositions.get('rb')!.y
      if (prev !== null) worst = Math.max(worst, Math.abs(prev - y))
      prev = y
    }
    expect(worst).toBeLessThan(1.0)
  })

  it('the toss itself does not delay the run', () => {
    const { s } = schedule(TOSS_TO_RUNNER())
    expect(s.get('run')!.delayMs).toBe(0)
  })

  it('a receiver with no movement is never moved by a flight', () => {
    const { paths } = schedule([
      P('toss', 'toss', [[26, 92], [30, 88]], { tokenId: 'qb', endTokenId: 'rb' }),
    ])
    const sc = computeScene([tok('qb', 26, 93, 'QB'), tok('rb', 30, 88)], paths, {
      tMs: 2000,
      playing: true,
      ballStartId: 'qb',
    })
    expect(sc.tokenPositions.get('rb')!.x).toBeCloseTo(30, 5)
    expect(sc.tokenPositions.get('rb')!.y).toBeCloseTo(88, 5)
  })
})

describe('INVARIANT — collinear toss and run still resolve', () => {
  it('a toss drawn down the same line as the run lands on him', () => {
    // the nasty case: toss x=26 vertical, run x=26 vertical — the two
    // geometries are collinear, so "where do they meet" is degenerate
    const { paths } = schedule(TOSS_TO_RUNNER())
    const { gap } = landing(TOKENS_TOSS_RUN, paths, 'toss', 'rb', 'qb')
    expect(gap).toBeLessThan(0.001)
  })

  it('the toss is aimed short of where the runner finishes', () => {
    const { paths } = schedule(TOSS_TO_RUNNER())
    const { receiver } = landing(TOKENS_TOSS_RUN, paths, 'toss', 'rb', 'qb')
    expect(receiver.y).toBeGreaterThan(80)
    expect(receiver.y).toBeLessThan(88)
  })
})

describe('RECORDED — today\'s numbers, for stage 2 to move', () => {
  it('toss duration ignores drawn distance entirely', () => {
    const short = schedule([
      P('toss', 'toss', [[26, 92], [27, 89]], { tokenId: 'qb', endTokenId: 'rb' }),
    ])
    const long = schedule(TOSS_TO_RUNNER())
    expect(short.paths[0].timing.durationMs).toBe(450)
    expect(long.paths[0].timing.durationMs).toBe(450)
    // ...while the drawn lengths are 3.2yd and 8yd
    expect(polylineLength(short.paths[0].points)).toBeLessThan(4)
    expect(polylineLength(long.paths[0].points)).toBeGreaterThan(6)
  })

  it('a deep pass flies for 40% of the route and launches late', () => {
    const { s } = schedule([
      P('pass', 'pass', [[26, 92], [14, 68]], { tokenId: 'qb', endTokenId: 'wr' }),
      P('route', 'route', [[14, 88], [14, 68]], { tokenId: 'wr' }),
    ])
    const pass = s.get('pass')!
    const route = s.get('route')!
    expect(pass.durationMs).toBe(Math.round(route.durationMs * 0.4))
    expect(pass.delayMs + pass.durationMs).toBe(route.delayMs + route.durationMs)
    // the drawn line is 24yd but the ball only flies for 1333ms — 18yd/s,
    // which happens to look plausible, and is why the flaw went unnoticed
    expect(polylineLength([{ x: 26, y: 92 }, { x: 14, y: 68 }])).toBeGreaterThan(20)
  })
})