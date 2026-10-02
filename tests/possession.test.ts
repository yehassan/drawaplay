import { describe, expect, it } from 'vitest'
import { reschedule, timelineDuration } from '../src/lib/timing'
import { incomingExchangeOf } from '../src/lib/ball'
import { computeScene } from '../src/lib/render'
import type { PlayPath, Token } from '../src/stores/editorStore'

/**
 * A ball carrier cannot move before the ball is in his hands, and his run lane
 * has to begin where he received it — not back at the line of scrimmage.
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

const schedule = (paths: PlayPath[]) => {
  const map = reschedule(paths)
  return new Map(paths.map((p) => [p.id, map.get(p.id)!]))
}

describe('incomingExchangeOf', () => {
  it('finds the single handoff or toss into a player', () => {
    const toss = path('t', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    expect(incomingExchangeOf([toss], 'rb')?.id).toBe('t')
  })

  it('ignores a pass, which arrives after the route', () => {
    const pass = path('p', 'pass', [[26, 93], [20, 80]], { tokenId: 'qb', endTokenId: 'wr' })
    expect(incomingExchangeOf([pass], 'wr')).toBeNull()
  })

  it('returns null when a player caught the ball twice', () => {
    const a = path('a', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    const b = path('b', 'handoff', [[26, 93], [24, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    expect(incomingExchangeOf([a, b], 'rb')).toBeNull()
  })

  it('returns null for a player nobody gave the ball to', () => {
    expect(incomingExchangeOf([path('r', 'route', [[26, 88], [20, 80]])], 'wr')).toBeNull()
  })
})

describe('a run waits for the toss that gives the player the ball', () => {
  const build = () => {
    const toss = path('t', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    const run = path('r', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' })
    return [toss, run]
  }

  it('starts the run only after the toss has landed', () => {
    const [toss, run] = build()
    const s = schedule([toss, run])
    expect(s.get('r')!.delayMs).toBeGreaterThanOrEqual(
      s.get('t')!.delayMs + s.get('t')!.durationMs,
    )
  })

  it('leaves a run with no exchange starting at the snap', () => {
    const run = path('r', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' })
    const alone = schedule([run])
    const withToss = schedule([
      path('t', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'qb' }),
      run,
    ])
    expect(alone.get('r')!.delayMs).toBe(0)
    expect(withToss.get('r')!.delayMs).toBe(0)
  })

  it('does not make a route wait on a pass into the same player', () => {
    const pass = path('p', 'pass', [[26, 93], [20, 80]], { tokenId: 'qb', endTokenId: 'wr' })
    const route = path('r', 'route', [[20, 88], [20, 78]], { tokenId: 'wr' })
    const s = schedule([pass, route])
    // the pass still arrives when the route ends — no deadlock
    expect(s.get('p')!.delayMs + s.get('p')!.durationMs).toBeGreaterThanOrEqual(
      s.get('r')!.delayMs + s.get('r')!.durationMs,
    )
    expect(timelineDuration([pass, route])).toBeGreaterThan(0)
  })

  it('keeps the second movement behind the first as well', () => {
    const toss = path('t', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    const block = path('b', 'block', [[26, 88], [27, 88.7]], { tokenId: 'rb' })
    const run = path('r', 'run', [[26, 88], [26, 78]], { tokenId: 'rb' })
    const s = schedule([toss, block, run])
    expect(s.get('r')!.delayMs).toBeGreaterThanOrEqual(
      s.get('b')!.delayMs + s.get('b')!.durationMs,
    )
  })
})

describe('the run lane begins where the ball was received', () => {
  it('starts the run at the catch point, not the alignment spot', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const toss = path('t', 'toss', [[26, 93], [24, 84]], { tokenId: 'qb', endTokenId: 'rb' })
    const run = path('r', 'run', [[24, 84], [24, 74]], { tokenId: 'rb' })
    const paths = [toss, run]
    const s = reschedule(paths)
    const timed = paths.map((p) => ({ ...p, timing: s.get(p.id)! }))

    // at rest the run is authored from the catch point
    expect(timed[1].points[0]).toEqual({ x: 24, y: 84 })

    // and once the ball is in his hands he moves from there, not from the LOS
    const arrival = s.get('t')!.delayMs + s.get('t')!.durationMs
    const scene = computeScene(tokens, timed, {
      tMs: arrival + 200,
      playing: true,
      ballStartId: 'qb',
    })
    const pos = scene.tokenPositions.get('rb')!
    expect(pos.y).toBeLessThan(88)
  })

  it('keeps the ball with the receiver once the exchange completes', () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const toss = path('t', 'toss', [[26, 93], [26, 88]], { tokenId: 'qb', endTokenId: 'rb' })
    const s = reschedule([toss])
    const timed = [{ ...toss, timing: s.get('t')! }]
    const scene = computeScene(tokens, timed, {
      tMs: timed[0].timing.delayMs + timed[0].timing.durationMs + 100,
      playing: true,
      ballStartId: 'qb',
    })
    expect(scene.ball).not.toBeNull()
    expect(scene.ball!.flying).toBe(false)
    // the ball is tucked beside whoever holds it, not centred on them
    expect(Math.abs(scene.ball!.pos.x - 26)).toBeLessThan(1)
    expect(Math.abs(scene.ball!.pos.y - 88)).toBeLessThan(1)
  })
})
describe('an approach is not shifted by the exchange that follows it', () => {
  const scenario = () => {
    const tokens = [tok('qb', 26, 93, 'QB'), tok('rb', 26, 88, 'RB')]
    const paths = [
      path('approach', 'route', [[26, 88], [26, 86]], { tokenId: 'rb' }),
      path('handoff', 'handoff', [[26, 91], [26, 86]], { tokenId: 'qb', endTokenId: 'rb' }),
      path('run', 'run', [[26, 86], [26, 76]], { tokenId: 'rb' }),
    ]
    const s = reschedule(paths)
    return { tokens, paths: paths.map((p) => ({ ...p, timing: s.get(p.id)! })), s }
  }

  it('does not delay the approach behind the exchange', () => {
    const { paths } = scenario()
    // with no snap everything fires at 0, and the approach must stay there —
    // it is not gated on the handoff that follows it
    expect(paths[0].timing.delayMs).toBe(0)
    expect(paths[0].timing.delayMs + paths[0].timing.durationMs).toBeLessThanOrEqual(
      paths[1].timing.delayMs + paths[1].timing.durationMs,
    )
  })

  it('leaves the approach start where the player lined up', () => {
    const { tokens, paths } = scenario()
    const mid = paths[0].timing.delayMs + paths[0].timing.durationMs / 2
    const scene = computeScene(tokens, paths, { tMs: mid, playing: true, ballStartId: 'qb' })
    const y = scene.tokenPositions.get('rb')!.y
    expect(y).toBeGreaterThan(86)
    expect(y).toBeLessThan(88)
  })

  it('starts the run at the end of the approach', () => {
    const { tokens, paths } = scenario()
    const atRun =
      paths[2].timing.delayMs + paths[2].timing.durationMs * 0.1
    const scene = computeScene(tokens, paths, { tMs: atRun, playing: true, ballStartId: 'qb' })
    expect(scene.tokenPositions.get('rb')!.y).toBeLessThan(86)
  })
})
