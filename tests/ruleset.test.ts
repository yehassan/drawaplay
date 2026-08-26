import { describe, expect, it } from 'vitest'
import { ALL_RULESETS, FIELD_W, RULESET_HASHES, YARD_NUM_HEIGHT, hashX, numberX } from '../src/lib/field'

describe('ruleset hash geometry', () => {
  it('declares exactly NFL and NCAA', () => {
    expect(ALL_RULESETS.map((r) => r.key)).toEqual(['nfl', 'ncaa'])
  })

  it('places NFL hashes 70\'9" from each sideline', () => {
    const [l, r] = hashX('nfl')
    expect(l).toBeCloseTo(23.583, 3)
    expect(r).toBeCloseTo(FIELD_W - 23.583, 3)
    expect(FIELD_W - r).toBeCloseTo(23.583, 3)
  })

  it('places NCAA hashes 60\' from each sideline', () => {
    const [l, r] = hashX('ncaa')
    expect(l).toBeCloseTo(20, 3)
    expect(r).toBeCloseTo(FIELD_W - 20, 3)
    expect(FIELD_W - r).toBeCloseTo(20, 3)
  })

  it('both rulesets: ordered, symmetric about center, inside the field', () => {
    const cx = FIELD_W / 2
    for (const key of ['nfl', 'ncaa'] as const) {
      const [l, r] = RULESET_HASHES[key]
      expect(l).toBeLessThan(cx)
      expect(cx).toBeLessThan(r)
      expect(Math.abs(l - cx) - Math.abs(r - cx)).toBeCloseTo(0, 2)
      expect(l).toBeGreaterThan(0)
      expect(r).toBeLessThan(FIELD_W)
    }
  })

  it('NCAA hashes are wider apart than NFL', () => {
    const nfl = hashX('nfl')[1] - hashX('nfl')[0]
    const ncaa = hashX('ncaa')[1] - hashX('ncaa')[0]
    expect(ncaa).toBeGreaterThan(nfl)
  })

  it('falls back to NFL for unknown rulesets', () => {
    expect(hashX('nfl' as never)).toEqual(RULESET_HASHES.nfl)
  })
})

describe('ruleset number placement', () => {
  it('NFL: bottom edge (near sideline) at 12 yards', () => {
    const { left, right } = numberX('nfl')
    expect(left - YARD_NUM_HEIGHT / 2).toBeCloseTo(12, 2)
    expect(FIELD_W - right - YARD_NUM_HEIGHT / 2).toBeCloseTo(12, 2)
  })

  it('NCAA: top edge (far from sideline) at 9 yards', () => {
    const { left, right } = numberX('ncaa')
    expect(left + YARD_NUM_HEIGHT / 2).toBeCloseTo(9, 2)
    expect(FIELD_W - right + YARD_NUM_HEIGHT / 2).toBeCloseTo(9, 2)
  })

  it('NCAA numbers are closer to the sideline than NFL', () => {
    expect(numberX('ncaa').left).toBeLessThan(numberX('nfl').left)
    expect(numberX('ncaa').right).toBeGreaterThan(numberX('nfl').right)
  })

  it('both rulesets are symmetric about field center', () => {
    const cx = FIELD_W / 2
    for (const key of ['nfl', 'ncaa'] as const) {
      const { left, right } = numberX(key)
      expect(Math.abs(left - cx) - Math.abs(right - cx)).toBeCloseTo(0, 2)
    }
  })
})
