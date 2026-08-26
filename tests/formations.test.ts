import { describe, expect, it } from 'vitest'
import { HASH_X, PERSONNEL, buildFormation, losY } from '../src/lib/formations'
import { SCENARIOS } from '../src/lib/scenarios'
import { reschedule } from '../src/lib/timing'

describe('LOS & hash math', () => {
  it('maps yard lines correctly', () => {
    expect(losY('ours', 25)).toBe(85)
    expect(losY('theirs', 40)).toBe(50)
  })
  it('hashes are ordered left < middle < right', () => {
    expect(HASH_X.left).toBeLessThan(HASH_X.center)
    expect(HASH_X.center).toBeLessThan(HASH_X.right)
  })
})

describe('personnel formations', () => {
  it('declares the documented counts for every group', () => {
    for (const def of PERSONNEL) {
      const f = buildFormation({
        personnel: def.key,
        underCenter: def.uc,
        hash: 'center',
        side: 'ours',
        yardLine: 25,
      })
      const cnt = (pos: string) => f.tokens.filter((t) => t.pos === pos).length
      expect([def.key, cnt('RB'), cnt('TE'), cnt('WR')]).toEqual([
        def.key,
        def.rb,
        def.te,
        def.wr,
      ])
    }
  })

  it('places QB behind C and all skill players at/below the LOS', () => {
    for (const def of PERSONNEL) {
      for (const uc of [true, false]) {
        const f = buildFormation({
          personnel: def.key,
          underCenter: uc,
          hash: 'center',
          side: 'ours',
          yardLine: 25,
        })
        const byId = new Map(f.tokens.map((t) => [t.id, t]))
        const qb = byId.get('QB')!
        expect(qb.y, `${def.key} uc=${uc} QB`).toBeGreaterThan(byId.get('C')!.y)
        const skills = f.tokens.filter(
          (t) => ['RB', 'WR', 'TE'].some((k) => t.pos.startsWith(k)) && t.id !== 'QB',
        )
        for (const s of skills) {
          expect(s.y, `${def.key} uc=${uc} ${s.id}`).toBeGreaterThanOrEqual(85 - 0.5)
        }
      }
    }
  })

  it('no two players overlap (min center gap ≥ ~1.53yd; UC C↔QB kiss exempt)', () => {
    const R = 0.69 + 0.075
    for (const def of PERSONNEL) {
      const f = buildFormation({
        personnel: def.key,
        underCenter: def.uc,
        hash: 'center',
        side: 'ours',
        yardLine: 25,
      })
      let minD = Infinity
      for (let i = 0; i < f.tokens.length; i++)
        for (let j = i + 1; j < f.tokens.length; j++) {
          const ids = new Set([f.tokens[i].id, f.tokens[j].id])
          if (ids.has('C') && ids.has('QB')) continue // under-center kiss is by design
          minD = Math.min(
            minD,
            Math.hypot(f.tokens[i].x - f.tokens[j].x, f.tokens[i].y - f.tokens[j].y),
          )
        }
      expect(minD, `${def.key} closest ${minD.toFixed(2)}`).toBeGreaterThanOrEqual(2 * R - 0.01)
    }
  })
})

describe('scenario seeds', () => {
  it('all seeds schedule cleanly with valid timings and no dangling anchors', () => {
    for (const sc of SCENARIOS) {
      const built = sc.build()
      for (const p of built.paths) {
        if (p.tokenId) expect(built.tokens.some((t) => t.id === p.tokenId), `${sc.name} tokenId`).toBe(true)
        if (p.endTokenId)
          expect(built.tokens.some((t) => t.id === p.endTokenId), `${sc.name} endTokenId`).toBe(true)
      }
      const sched = reschedule(
        built.paths.map((p, i) => ({ ...p, id: `p${i}`, timing: { delayMs: 0, durationMs: 600 } })),
      )
      for (let i = 0; i < built.paths.length; i++) {
        const t = sched.get(`p${i}`)!
        expect(Number.isFinite(t.delayMs), `${sc.name} path ${i}`).toBe(true)
        expect(Number.isFinite(t.durationMs), `${sc.name} path ${i}`).toBe(true)
      }
    }
  })
})
