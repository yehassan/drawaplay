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
    it(`builds 11 nickel defenders (${shell}) on the defensive side of the LOS`, () => {
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

  it('no two nickel defenders overlap (min center gap ≥ 1.5yd)', () => {
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

describe('3-4 front', () => {  it('declares 3-4-4 counts', () => {
    const def = DEFENSE_FRONTS.find((f) => f.key === '34')!
    expect([def.dl, def.lb, def.cb, def.s]).toEqual([3, 4, 2, 2])
  })

  it('edges play up on the line, inside backers off (BDB n=32)', () => {
    const f = buildDefenseFormation({ front: '34', shell: '2-high', hash: 'center', side: 'ours', yardLine: 25 })
    expect(f.tokens).toHaveLength(11)
    const ly = losY('ours', 25)
    const at = (id: string) => f.tokens.find((t) => t.id === id)!
    // edge OLBs ~1.3yd deep / ±6.3 wide, inside ~4.0 / ±2.5
    for (const id of ['OLB1', 'OLB2']) {
      expect(ly - at(id).y, id).toBeCloseTo(1.3, 1)
      expect(Math.abs(at(id).x - 26.65), id).toBeCloseTo(6.3, 1)
    }
    for (const id of ['ILB1', 'ILB2']) {
      expect(ly - at(id).y, id).toBeCloseTo(4, 1)
      expect(Math.abs(at(id).x - 26.65), id).toBeCloseTo(2.5, 1)
    }
    const cnt = (pos: string) => f.tokens.filter((t) => t.pos === pos).length
    expect(cnt('DL')).toBe(3)
    expect(cnt('LB')).toBe(4)
    expect(cnt('CB')).toBe(2)
    expect(cnt('S')).toBe(2)
  })

  it('shares both shells with nickel', () => {
    const one = buildDefenseFormation({ front: '34', shell: '1-high', hash: 'center', side: 'ours', yardLine: 25 })
    const two = buildDefenseFormation({ front: '34', shell: '2-high', hash: 'center', side: 'ours', yardLine: 25 })
    const ly = losY('ours', 25)
    const depth = (toks: typeof one.tokens, id: string) => ly - toks.find((t) => t.id === id)!.y
    expect(depth(one.tokens, 'SS')).toBeLessThan(depth(two.tokens, 'SS'))
    expect(depth(one.tokens, 'FS')).toBeGreaterThan(depth(one.tokens, 'SS'))
  })

  it('no two 3-4 defenders overlap across hashes', () => {
    for (const hash of ['left', 'center', 'right'] as const) {
      const f = buildDefenseFormation({ front: '34', shell: '2-high', hash, side: 'ours', yardLine: 25 })
      for (let i = 0; i < f.tokens.length; i++) {
        for (let j = i + 1; j < f.tokens.length; j++) {
          const a = f.tokens[i]
          const b = f.tokens[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          expect(d, `${hash} ${a.id}↔${b.id}`).toBeGreaterThanOrEqual(1.5)
        }
      }
    }
  })
})

describe('dime front', () => {
  it('declares textbook 4-1-6 counts (4 corners + 2 safeties)', () => {
    const def = DEFENSE_FRONTS.find((f) => f.key === 'dime')!
    expect([def.dl, def.lb, def.cb, def.s]).toEqual([4, 1, 4, 2])
  })

  it('dimeback mirrors the nickel over the opposite slot', () => {
    for (const shell of ['1-high', '2-high'] as Shell[]) {
      const f = buildDefenseFormation({ front: 'dime', shell, hash: 'center', side: 'ours', yardLine: 25 })
      expect(f.tokens).toHaveLength(11)
      const ly = losY('ours', 25)
      const at = (id: string) => f.tokens.find((t) => t.id === id)!
      expect(ly - at('DIME').y, `${shell} dime depth`).toBeCloseTo(2.5, 1)
      expect(at('DIME').x, `${shell} dime lat`).toBeCloseTo(26.65 - 9, 1)
      expect(ly - at('MIKE').y, `${shell} mike`).toBeCloseTo(4.5, 1)
      // standard two-safety shell, same as nickel
      expect(ly - at('SS').y).toBeGreaterThan(0)
      expect(ly - at('FS').y).toBeGreaterThan(0)
    }
  })

  it('no two dime defenders overlap across hashes and shells', () => {
    for (const shell of ['1-high', '2-high'] as Shell[]) {
      for (const hash of ['left', 'center', 'right'] as const) {
        const f = buildDefenseFormation({ front: 'dime', shell, hash, side: 'ours', yardLine: 25 })
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
})
