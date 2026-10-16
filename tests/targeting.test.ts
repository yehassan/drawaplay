import { describe, expect, it } from 'vitest'
import { resolveFlightTarget, tokenAtPoint } from '../src/lib/target'
import type { PathType } from '../src/lib/pathStyles'
import type { Token } from '../src/stores/editorStore'

const P = (
  id: string,
  tokenId: string | null,
  type: PathType,
  seg: [number, number][],
) => ({
  id,
  tokenId,
  endTokenId: null,
  type,
  timing: { delayMs: 0, durationMs: 600 },
  points: seg.map(([x, y]) => ({ x, y })),
  d: '',
})
const pt = (x: number, y: number) => ({ x, y })

describe('flight target resolution', () => {
  it('adopts the owner of a nearby route tip', () => {
    const slant = P('slant', 'WR', 'route', [[10, 80], [13, 76], [16, 71]])
    const scribble = P('pass', 'QB', 'pass', [
      [26.5, 86], [24, 84], [22, 83], [19, 79], [18, 77], [15.5, 70.6],
    ])
    expect(resolveFlightTarget(scribble.points, 'QB', [slant], 'pass')).toBe('WR')
  })

  it('ignores tips beyond the match radius (H8)', () => {
    const far = P('far', 'WR', 'route', [[10, 80], [8, 74]])
    const pass = P('x', 'QB', 'pass', [[26, 80], [22, 76]])
    expect(resolveFlightTarget(pass.points, 'QB', [far], 'pass')).toBeNull()
  })

  it('cone prefers the direction-aligned tip in bunch looks (L3)', () => {
    const nearButBackwards = P('wr1', 'WR1', 'route', [[20, 80], [19.5, 74]])
    const aligned = P('wr2', 'WR2', 'route', [[40, 80], [41, 74.2]])
    const passPts = [pt(26.5, 86), pt(30, 78), pt(40.4, 74.5)]
    expect(resolveFlightTarget(passPts, 'QB', [nearButBackwards, aligned], 'pass')).toBe('WR2')
  })

  it('non-flight types do not resolve targets through this path', () => {
    const defenderTip = P('dl', 'DL', 'route', [[22, 84], [23, 87]])
    const block = P('blk', 'LT', 'block', [[21.5, 89], [22.6, 86.5]])
    // blocks ARE targetable → resolves
    expect(resolveFlightTarget(block.points, 'LT', [defenderTip], 'block')).toBe('DL')
    // routes never resolve
    expect(resolveFlightTarget(block.points, 'LT', [defenderTip], 'route')).toBeNull()
  })
})

describe('aiming at a player mid-play', () => {
  /**
   * The pen is pointed at the screen, so a hit test has to use the position the
   * player is *drawn* at. Matching rest spots instead meant that drawing a toss
   * onto a receiver who had already run 10yd found nobody, because his rest spot
   * was 10yd behind him and his route tip was 18yd ahead.
   */
  const T = (id: string, x: number, y: number): Token => ({
    id, side: 'offense', pos: id === 'QB' ? 'QB' : 'WR', num: '', x, y,
  })
  const TOKENS = [T('QB', 26.6, 95), T('WR', 10, 88)]
  /** the play is at 2s: the receiver is 10yd into a route that started at y=88 */
  const drawn = new Map([['QB', pt(26.6, 95)], ['WR', pt(10, 78)]])

  it('hits the player where he is drawn, not where he started', () => {
    expect(tokenAtPoint(pt(10, 78), TOKENS, 2, drawn)?.id).toBe('WR')
    // his rest spot is behind him now, and must not match
    expect(tokenAtPoint(pt(10, 88), TOKENS, 2, drawn)).toBeNull()
  })

  it('adopts the player the stroke aims at, falling back to drawn positions', () => {
    const route = P('wr', 'WR', 'route', [[10, 88], [10, 60]])
    const stroke = [pt(26.6, 95), pt(10, 78)]
    expect(resolveFlightTarget(stroke, 'QB', [route], 'toss', TOKENS, drawn)).toBe('WR')
    // without drawn positions nothing resolves: rest spot 10yd off, route tip 18yd
    expect(resolveFlightTarget(stroke, 'QB', [route], 'toss', TOKENS)).toBeNull()
  })

  it('still resolves from the rest spot when the play is not running', () => {
    expect(tokenAtPoint(pt(10, 88), TOKENS, 2)?.id).toBe('WR')
    expect(tokenAtPoint(pt(10, 78), TOKENS, 2)).toBeNull()
  })
})
