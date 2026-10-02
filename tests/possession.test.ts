import { describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import type { PlayPath, Token } from '../src/stores/editorStore'

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