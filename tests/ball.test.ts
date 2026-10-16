import { describe, expect, it } from 'vitest'
import { ballEventAt, ballStateAt, defaultBallStart } from '../src/lib/ball'
import { applySchedule } from '../src/lib/timing'
import { pathEased } from '../src/lib/easing'
import type { PlayPath, Token } from '../src/stores/editorStore'

const P = (
  id: string,
  tokenId: string | null,
  endTokenId: string | null,
  type: PlayPath['type'],
  seg: [number, number][],
): PlayPath => ({
  id,
  tokenId,
  endTokenId,
  type,
  timing: { delayMs: 0, durationMs: 600 },
  points: seg.map(([x, y]) => ({ x, y })),
  d: '',
})
const tok = (id: string, pos: Token['pos'], x: number, y: number): Token =>
  ({ id, side: 'offense', pos, num: '', x, y })
const endOf = (p: PlayPath) => p.timing.delayMs + p.timing.durationMs

describe('default ball holder', () => {
  const tokens = [tok('C', 'C', 26.5, 88), tok('QB', 'QB', 26.5, 86.5), tok('RB', 'RB', 26, 91)]

  it('C when a snap is present', () => {
    const paths = [P('snap', 'C', 'QB', 'snap', [[26.5, 88], [26.5, 86.8]])]
    expect(defaultBallStart(paths, tokens)).toBe('C')
  })
  it('handoff origin beats C when drawn', () => {
    const paths = [P('handoff', 'QB', 'RB', 'handoff', [[26.5, 86], [26, 90.5]])]
    expect(defaultBallStart(paths, tokens)).toBe('QB')
  })
  it('plain formation → C', () => {
    expect(defaultBallStart([], tokens)).toBe('C')
  })
})

describe('ball ownership — a throw needs the ball in hand', () => {
  const tokens = [
    tok('C', 'C', 26.5, 88),
    tok('QB', 'QB', 26.5, 86.5),
    tok('RB', 'RB', 24, 86.3),
    tok('WR1', 'WR', 10, 78.5),
    tok('WR2', 'WR', 40, 72),
  ]
  const positions = new Map([
    ['C', { x: 26.5, y: 88 }],
    ['QB', { x: 26.5, y: 86.5 }],
    ['RB', { x: 24, y: 86.3 }],
    ['WR1', { x: 14, y: 78.5 }],
    ['WR2', { x: 40, y: 72 }],
  ])

  it('starts with whoever throws first when nothing drew a snap', () => {
    const paths = applySchedule([P('screen', 'QB', 'WR1', 'pass', [[26, 85], [14, 78.5]])])
    expect(defaultBallStart(paths, tokens)).toBe('QB')
  })

  describe('two options drawn off one thrower', () => {
    const paths = applySchedule([
      P('screen', 'QB', 'WR1', 'pass', [[26, 85], [14, 78.5]]),
      P('post', 'QB', 'WR2', 'pass', [[27, 85], [40, 72]]),
    ])
    const post = paths[1]!

    it('both fly — released together, the ball has not left his hand yet', () => {
      const mid = (p: PlayPath) => Math.round((p.timing.delayMs + endOf(p)) / 2)
      expect(ballEventAt(paths, positions, null, mid(paths[0]!), true, tokens)?.flight?.id).toBe(
        'post',
      )
      expect(ballStateAt(paths, positions, null, mid(post), true, undefined, tokens)?.flying).toBe(
        true,
      )
    })
  })

  describe('a chain — the ball moves twice', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 88], [26.5, 86.8]]),
      P('toss', 'QB', 'RB', 'toss', [[26.4, 86.6], [24, 86.4]]),
      P('pass', 'RB', 'WR1', 'pass', [[24, 86.3], [14, 78.5]]),
    ])
    const [snap, toss, pass] = paths

    it('waits for the new thrower to catch before he throws', () => {
      expect(pass!.timing.delayMs).toBeGreaterThanOrEqual(
        toss!.timing.delayMs + toss!.timing.durationMs,
      )
    })

    it('hands it C → QB → RB → WR, one exchange at a time', () => {
      const ownerAt = (t: number) => ballEventAt(paths, positions, null, t, true, tokens)?.owner
      expect(ownerAt(snap!.timing.delayMs + 5)).toBe('C')
      expect(ownerAt(toss!.timing.delayMs + 5)).toBe('QB')
      expect(ownerAt(pass!.timing.delayMs + 5)).toBe('RB')
      expect(ownerAt(endOf(pass!) + 5)).toBe('WR1')
    })
  })

  it('a throw by a player who never has the ball is inert', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 88], [26.5, 86.8]]),
      P('stray', 'WR1', 'WR2', 'pass', [[14, 78.5], [40, 72]]),
    ])
    const stray = paths[1]!
    const mid = stray.timing.delayMs + stray.timing.durationMs / 2
    const ev = ballEventAt(paths, positions, null, mid, true, tokens)
    expect(ev?.flight).toBeNull()
    expect(ev?.owner).toBe('QB')
  })

  it('a pass to a receiver who is off the field leaves the ball with the thrower', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 88], [26.5, 86.8]]),
      P('pass', 'QB', 'GONE', 'pass', [[26.5, 86.5], [14, 78.5]]),
    ])
    const pass = paths[1]!
    const b = ballStateAt(paths, positions, null, endOf(pass) + 5, true, undefined, tokens)
    expect(b, 'the ball vanished').not.toBeNull()
    expect(b!.flying).toBe(false)
    expect(b!.pos.x).toBeCloseTo(26.5 + 0.55, 6)
    expect(b!.pos.y).toBeCloseTo(86.5 - 0.35, 6)
  })

  it('paused at the start, the ball is in his hands and not out on the draw', () => {
    const p = P('pass', 'QB', 'WR1', 'pass', [[20, 85], [14, 78.5]])
    const b = ballStateAt([p], positions, null, 0, false, undefined, tokens)!
    expect(b.flying).toBe(false)
    expect(b.pos.x).toBeCloseTo(26.5 + 0.55, 6)
    expect(b.pos.y).toBeCloseTo(86.5 - 0.35, 6)
  })

  it('direct snap: ball starts at C, moves to RB after the snap completes', () => {
    const rbTokens = [tok('C', 'C', 26.5, 88), tok('RB', 'RB', 26.6, 87)]
    const p = applySchedule([
      P('snap', 'C', 'RB', 'snap', [[26.5, 88], [26.55, 87.4]]),
      P('run', 'RB', null, 'run', [[26.6, 87], [26.3, 80], [26, 72]]),
    ])
    const pos2 = new Map([['C', { x: 26.5, y: 88 }], ['RB', { x: 26.6, y: 87 }]])
    const pre = ballStateAt(p, pos2, null, 0, true, undefined, rbTokens)!
    expect(Math.hypot(pre.pos.x - 26.5, pre.pos.y - 88)).toBeLessThan(0.05)
    const post = ballStateAt(p, pos2, null, endOf(p[0]!), true, undefined, rbTokens)!
    expect(post.flying).toBe(false)
    expect(Math.hypot(post.pos.x - 0.55 - 26.6, post.pos.y + 0.35 - 87)).toBeLessThan(0.01)
  })
})

describe('easing profile', () => {
  it('acceleration is identical across short and long routes in the first 220ms', () => {
    const short = { id: 'a', tokenId: null, endTokenId: null, type: 'route' as const, timing: { delayMs: 300, durationMs: 607 }, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], d: '' }
    const long = { ...short, durationMs: 2661 }
    // fraction gained over the same absolute ramp window should be equal
    const a1 = pathEased(short, 300 + 110) - pathEased(short, 300)
    const a2 = pathEased(long, 300 + 110) - pathEased(long, 300)
    expect(a1).toBeCloseTo(a2, 5)
    // and both complete exactly
    expect(pathEased(short, 300 + 607)).toBe(1)
    expect(pathEased(long, 300 + 2661)).toBe(1)
  })
})
