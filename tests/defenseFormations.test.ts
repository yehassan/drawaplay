import { describe, expect, it } from 'vitest'
import {
  DEFENSE_FRONTS,
  buildDefenseFormation,
  type Shell,
} from '../src/lib/defenseFormations'
import { losY } from '../src/lib/formations'

const depthOf = (ly: number, y: number) => ly - y

describe('nickel front', () => {
  it('declares 4-2-5 counts', () => {
    const def = DEFENSE_FRONTS.find((f) => f.key === 'nickel')!
    expect([def.dl, def.lb, def.cb, def.s]).toEqual([4, 2, 3, 2])
  })

  for (const shell of ['1-high', '2-high'] as Shell[]) {
    it(`builds 11 defenders (${shell}) on the defensive side of the LOS`, () => {
      const f = buildDefenseFormation({ front: 'nickel', shell, hash: 'center', side: 'ours', yardLine: 25 })
      expect(f.tokens).toHaveLength(11)
      expect(f.tokens.every((t) => t.side === 'defense')).toBe(true)
      const ly = losY('ours', 25)
      for (const t of f.tokens) {
        // defense lines up between the LOS and their own goal (y < LOS)
        expect(t.y, `${t.id}`).toBeLessThanOrEqual(ly)
        expect(t.x, `${t.id}`).toBeGreaterThanOrEqual(1.5)
        expect(t.x, `${t.id}`).toBeLessThanOrEqual(51.8)
      }
      const cnt = (pos: string) => f.tokens.filter((t) => t.pos === pos).length
      expect(cnt('DL')).toBe(4)
      expect(cnt('LB')).toBe(2)
      expect(cnt('CB')).toBe(3)
      expect(cnt('S')).toBe(2)
    })
  }

  it('matches BDB week-1 medians (LB 3.5, CB 4.2, 2-high S 10.5)', () => {
    const f = buildDefenseFormation({ front: 'nickel', shell: '2-high', hash: 'center', side: 'ours', yardLine: 25 })
    const ly = losY('ours', 25)
    const byId = new Map(f.tokens.map((t) => [t.id, t]))
    expect(depthOf(ly, byId.get('LB1')!.y)).toBeCloseTo(3.5, 1)
    expect(depthOf(ly, byId.get('CB1')!.y)).toBeCloseTo(4.2, 1)
    expect(depthOf(ly, byId.get('SS')!.y)).toBeCloseTo(10.5, 1)
    expect(depthOf(ly, byId.get('FS')!.y)).toBeCloseTo(10.5, 1)
    // two-high safeties split ±6 around the ball
    expect(byId.get('SS')!.x).toBeCloseTo(26.65 - 6, 1)
    expect(byId.get('FS')!.x).toBeCloseTo(26.65 + 6, 1)
  })

  it('1-high drops the SS into the box and keeps one deep', () => {
    const one = buildDefenseFormation({ front: 'nickel', shell: '1-high', hash: 'center', side: 'ours', yardLine: 25 })
    const two = buildDefenseFormation({ front: 'nickel', shell: '2-high', hash: 'center', side: 'ours', yardLine: 25 })
    const ly = losY('ours', 25)
    const at = (toks: typeof one.tokens, id: string) => depthOf(ly, toks.find((t) => t.id === id)!.y)
    expect(at(one.tokens, 'SS')).toBeLessThan(at(two.tokens, 'SS'))
    expect(at(one.tokens, 'FS')).toBeGreaterThan(at(one.tokens, 'SS'))
  })

  it('no two defenders overlap (min center gap ≥ 1.5yd)', () => {
    for (const shell of ['1-high', '2-high'] as Shell[]) {
      for (const hash of ['left', 'center', 'right'] as const) {
        const f = buildDefenseFormation({ front: 'nickel', shell, hash, side: 'ours', yardLine: 25 })
        for (let i = 0; i < f.tokens.length; i++) {
          for (let j = i + 1; j < f.tokens.length; j++) {
            const a = f.tokens[i]
            const b = f.tokens[j]
            const d = Math.hypot(a.x - b.x, a.y - b.y)
            expect(d, `${shell} ${hash} ${a.id}↔${b.id}`).toBeGreaterThanOrEqual(1.5)
          }
        }
      }
    }
  })

  it('mirrors onto the defensive side for theirs LOS too', () => {
    const f = buildDefenseFormation({ front: 'nickel', shell: '2-high', hash: 'center', side: 'theirs', yardLine: 40 })
    const ly = losY('theirs', 40)
    expect(f.tokens).toHaveLength(11)
    for (const t of f.tokens) {
      expect(t.y, `${t.id}`).toBeLessThanOrEqual(ly)
    }
  })
})
