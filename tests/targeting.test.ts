import { describe, expect, it } from 'vitest'
import { resolveFlightTarget } from '../src/lib/target'

const P = (
  id: string,
  tokenId: string | null,
  type: 'route' | 'pass',
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
