import { describe, expect, it } from 'vitest'
import { ballStateAt, defaultBallStart } from '../src/lib/ball'
import { applySchedule, pathEased } from '../src/lib/timing'
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

describe('ball flight & ownership (H4 unconditional chronology)', () => {
  const tokens = [
    tok('C', 'C', 26.5, 88),
    tok('QB', 'QB', 26.5, 86.5),
    tok('WR1', 'WR', 10, 78.5),
    tok('WR2', 'WR', 40, 72),
  ]
  const positions = new Map([
    ['C', { x: 26.5, y: 88 }],
    ['QB', { x: 26.5, y: 86.5 }],
    ['WR1', { x: 14, y: 78.5 }],
    ['WR2', { x: 40, y: 72 }],
  ])
  const paths = applySchedule([
    P('screen', 'QB', 'WR1', 'pass', [[26, 85], [14, 78.5]]),
    P('post', 'QB', 'WR2', 'pass', [[27, 85], [40, 72]]),
  ])
  const [screen, post] = paths

  it('first pass flies mid-window', () => {
    const t = Math.round((screen.timing.delayMs + endOf(screen)) / 2)
    expect(ballStateAt(paths, positions, null, t, true, undefined, tokens)?.flying).toBe(true)
  })

  it('second pass flies even though the first already transferred ownership', () => {
    const t = Math.round((post.timing.delayMs + endOf(post)) / 2)
    expect(ballStateAt(paths, positions, null, t, true, undefined, tokens)?.flying).toBe(true)
  })

  it('last receiver owns the ball after both land', () => {
    const t = Math.max(endOf(screen), endOf(post))
    const b = ballStateAt(paths, positions, null, t, true, undefined, tokens)!
    expect(b.flying).toBe(false)
    expect(Math.hypot(b.pos.x - 0.55 - positions.get('WR2')!.x, b.pos.y + 0.35 - positions.get('WR2')!.y)).toBeLessThan(0.01)
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
    const post = ballStateAt(p, pos2, null, endOf(p[0]), true, undefined, rbTokens)!
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
