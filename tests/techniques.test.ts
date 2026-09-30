import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TECHNIQUE_TOLERANCE,
  ROLE_TECHNIQUES,
  dlRole,
  olAnchors,
  nearestTechnique,
  techniqueLabel,
  techniqueX,
  type DlTechnique,
} from '../src/lib/techniques'

const DL_ALL: DlTechnique[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
import type { Token } from '../src/stores/editorStore'

const defAnchors = {
  c: 26.65,
  lg: 24.85,
  rg: 28.45,
  lt: 23.05,
  rt: 30.25,
}

const off = (pos: Token['pos'], x: number): Token => ({
  id: `${pos}${x}`,
  side: 'offense',
  pos,
  num: '',
  x,
  y: 50,
})

describe('techniqueX', () => {
  it('puts a 0-technique head up on the center', () => {
    expect(techniqueX(defAnchors, 0, false)).toBeCloseTo(26.65, 5)
  })

  it('puts even techniques on the guards', () => {
    expect(techniqueX(defAnchors, 2, false)).toBeCloseTo(24.85, 5)
    expect(techniqueX(defAnchors, 4, false)).toBeCloseTo(28.45, 5)
  })

  it('puts odd techniques in the guard/tackle gaps', () => {
    expect(techniqueX(defAnchors, 1, false)).toBeCloseTo(25.75, 5)
    expect(techniqueX(defAnchors, 3, false)).toBeCloseTo(23.95, 5)
    expect(techniqueX(defAnchors, 5, false)).toBeCloseTo(29.35, 5)
  })

  it('puts even 6/8-techniques on the tackles', () => {
    expect(techniqueX(defAnchors, 6, false)).toBeCloseTo(30.25, 5)
    expect(techniqueX(defAnchors, 8, false)).toBeCloseTo(32.05, 5)
  })

  it('runs 7 and 9 progressively wider for a wide-9 look', () => {
    const seven = techniqueX(defAnchors, 7, false)
    const eight = techniqueX(defAnchors, 8, false)
    const nine = techniqueX(defAnchors, 9, false)
    expect(seven).toBeGreaterThan(techniqueX(defAnchors, 6, false))
    expect(eight).toBeGreaterThan(seven)
    expect(nine).toBeGreaterThan(eight)
    expect(nine).toBeCloseTo(32.95, 5)
  })

  it('shades inverted outside techniques onto the inside shoulder', () => {
    const three = techniqueX(defAnchors, 3, false)
    const threeI = techniqueX(defAnchors, 3, true)
    expect(threeI).toBeGreaterThan(three)
    expect(threeI).toBeGreaterThan(techniqueX(defAnchors, 2, false))
    expect(threeI).toBeLessThan(techniqueX(defAnchors, 0, false))

    const five = techniqueX(defAnchors, 5, false)
    const fiveI = techniqueX(defAnchors, 5, true)
    expect(fiveI).toBeLessThan(five)
    expect(fiveI).toBeLessThan(techniqueX(defAnchors, 4, false))
    expect(fiveI).toBeGreaterThan(techniqueX(defAnchors, 0, false))
  })

  it('shades an inverted 7 onto the inside shoulder of the tackle', () => {
    expect(techniqueX(defAnchors, 7, true)).toBeGreaterThan(techniqueX(defAnchors, 6, false) - 0.5)
    expect(techniqueX(defAnchors, 7, true)).toBeLessThan(techniqueX(defAnchors, 6, false))
  })

  it('puts an inverted 4-technique in the A-gap', () => {
    expect(techniqueX(defAnchors, 4, true)).toBeGreaterThan(techniqueX(defAnchors, 0, false))
    expect(techniqueX(defAnchors, 4, true)).toBeLessThan(techniqueX(defAnchors, 4, false))
  })

  it('never pushes a defender further from the ball when inverted', () => {
    for (const tech of [1, 2, 3, 4, 5, 6, 7, 8, 9] as DlTechnique[]) {
      const straight = techniqueX(defAnchors, tech, false) - defAnchors.c
      const inv = techniqueX(defAnchors, tech, true) - defAnchors.c
      if (straight === 0) continue
      expect(Math.abs(inv)).toBeLessThanOrEqual(Math.abs(straight))
      if (inv !== 0) expect(Math.sign(inv)).toBe(Math.sign(straight))
    }
  })

  it('keeps a 1-technique inverted distinct from a 0-technique', () => {
    const one = techniqueX(defAnchors, 1, false)
    const oneI = techniqueX(defAnchors, 1, true)
    const nose = techniqueX(defAnchors, 0, false)
    expect(oneI).not.toBeCloseTo(nose, 1)
    expect(oneI).toBeGreaterThan(one)
  })

})

describe('olAnchors', () => {
  it('falls back to a symmetric default line when no offense is present', () => {
    const a = olAnchors([], 26.65)
    expect(a.c).toBeCloseTo(26.65, 5)
    expect(a.c - a.lg).toBeCloseTo(1.8, 5)
    expect(a.rg - a.c).toBeCloseTo(1.8, 5)
    expect(a.c - a.lt).toBeCloseTo(3.6, 5)
  })

  it('centers the default line on the ball, not the field', () => {
    const a = olAnchors([], 29.75)
    expect(a.c).toBeCloseTo(29.75, 5)
    expect(a.rt).toBeCloseTo(33.35, 5)
  })

  it('reads the live offensive line when one exists', () => {
    const a = olAnchors(
      [off('C', 25.0), off('G', 23.2), off('G', 26.8), off('T', 21.4), off('T', 28.6)],
      26.65,
    )
    expect(a.c).toBeCloseTo(25.0, 5)
    expect(a.lg).toBeCloseTo(23.2, 5)
    expect(a.rg).toBeCloseTo(26.8, 5)
    expect(a.lt).toBeCloseTo(21.4, 5)
    expect(a.rt).toBeCloseTo(28.6, 5)
  })

  it('ignores defensive linemen when resolving anchors', () => {
    const def: Token = { ...off('T', 21.0), side: 'defense' }
    const a = olAnchors([def], 26.65)
    expect(a.c).toBeCloseTo(26.65, 5)
  })

  it('falls back per-group when the line is partially drawn', () => {
    const a = olAnchors([off('C', 25.0)], 26.65)
    expect(a.c).toBeCloseTo(25.0, 5)
    expect(a.c - a.lg).toBeCloseTo(1.8, 5)
  })
})

describe('nearestTechnique', () => {
  it('round-trips every technique through x', () => {
    for (const tech of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as DlTechnique[]) {
      for (const inverted of [false, true]) {
        for (const mirrored of [false, true]) {
          if (mirrored && tech < 6) continue
          if (tech === 0 && inverted) continue
          const x = techniqueX(defAnchors, tech, inverted, mirrored)
          expect(nearestTechnique(defAnchors, x)).toEqual({ tech, inverted, mirrored })
        }
      }
    }
  })

  it('never claims a mirrored guard-region technique', () => {
    for (const x of [techniqueX(defAnchors, 1, false), techniqueX(defAnchors, 5, false)]) {
      expect(nearestTechnique(defAnchors, x).mirrored).toBe(false)
    }
  })

  it('never claims a 0i or a mirrored 0', () => {
    const found = nearestTechnique(defAnchors, defAnchors.c)
    expect(found.inverted).toBe(false)
    expect(found.mirrored).toBe(false)
  })

  it('mirrors a wide technique onto the opposite side of the ball', () => {
    const straight = techniqueX(defAnchors, 9, false)
    const mirrored = techniqueX(defAnchors, 9, false, true)
    expect(mirrored).toBeCloseTo(2 * defAnchors.c - straight, 5)
    expect(mirrored).toBeLessThan(defAnchors.c)
  })

  it('builds a 4.0.4 mint front from a nose and a symmetric pair of inverted guards', () => {
    const nose = techniqueX(defAnchors, 0, false)
    const right4i = techniqueX(defAnchors, 4, true)
    const left4i = techniqueX(defAnchors, 2, true)
    expect(right4i).toBeGreaterThan(nose)
    expect(left4i).toBeLessThan(nose)
    expect(nose - left4i).toBeCloseTo(right4i - nose, 5)
  })
})

describe('techniqueLabel', () => {
  it('appends i and the mirror mark', () => {
    expect(techniqueLabel({ tech: 3, inverted: false, mirrored: false })).toBe('3')
    expect(techniqueLabel({ tech: 3, inverted: true, mirrored: false })).toBe('3i')
    expect(techniqueLabel({ tech: 3, inverted: false, mirrored: true })).toBe('3\u21c4')
  })
})

describe('DEFAULT_TECHNIQUE_TOLERANCE', () => {
  it('is small enough to keep adjacent techniques distinct', () => {
    const gaps: number[] = []
    for (const tech of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as DlTechnique[]) {
      gaps.push(Math.abs(techniqueX(defAnchors, tech, false) - defAnchors.c))
    }
    const minGap = Math.min(...gaps.filter((g) => g > 0))
    expect(DEFAULT_TECHNIQUE_TOLERANCE).toBeLessThan(minGap / 2)
  })
})

describe('dlRole', () => {
  it('reads a nose off a defender inside the guards', () => {
    for (const t of [0, 1] as DlTechnique[]) {
      expect(dlRole(defAnchors, techniqueX(defAnchors, t, false))).toBe('nt')
    }
  })

  it('reads a defensive tackle off a defender on or between the guards', () => {
    for (const t of [2, 3, 4, 5] as DlTechnique[]) {
      expect(dlRole(defAnchors, techniqueX(defAnchors, t, false))).toBe('dt')
    }
  })

  it('reads an edge off a defender outside the tackle', () => {
    for (const t of [6, 7, 8, 9] as DlTechnique[]) {
      expect(dlRole(defAnchors, techniqueX(defAnchors, t, false))).toBe('de')
    }
  })

  it('reads an A-gap shade as a nose', () => {
    expect(dlRole(defAnchors, techniqueX(defAnchors, 4, true))).toBe('nt')
    expect(dlRole(defAnchors, techniqueX(defAnchors, 2, true))).toBe('nt')
  })

  it('reads a shade inside the guard as a tackle, not a nose', () => {
    expect(dlRole(defAnchors, techniqueX(defAnchors, 3, true))).toBe('dt')
    expect(dlRole(defAnchors, techniqueX(defAnchors, 5, true))).toBe('dt')
  })

  it('follows the defender when he is moved out to the edge', () => {
    expect(dlRole(defAnchors, techniqueX(defAnchors, 2, false))).toBe('dt')
    expect(dlRole(defAnchors, techniqueX(defAnchors, 9, false))).toBe('de')
  })

  it('reads a head-up 2 as a tackle and a head-up 6 as an edge', () => {
    expect(dlRole(defAnchors, techniqueX(defAnchors, 2, false))).toBe('dt')
    expect(dlRole(defAnchors, techniqueX(defAnchors, 6, false))).toBe('de')
  })
})

describe('ROLE_TECHNIQUES', () => {
  it('never offers a nose technique to an edge', () => {
    expect(ROLE_TECHNIQUES.de).not.toContain(0)
    expect(ROLE_TECHNIQUES.de).not.toContain(1)
  })

  it('never offers an edge technique to an interior defender', () => {
    expect(ROLE_TECHNIQUES.nt).not.toContain(6)
    expect(ROLE_TECHNIQUES.nt).not.toContain(7)
    expect(ROLE_TECHNIQUES.dt).not.toContain(8)
    expect(ROLE_TECHNIQUES.dt).not.toContain(9)
  })

  it('gives every technique to at least one role', () => {
    const covered = new Set<DlTechnique>([
      ...ROLE_TECHNIQUES.nt,
      ...ROLE_TECHNIQUES.dt,
      ...ROLE_TECHNIQUES.de,
    ])
    for (const t of DL_ALL) expect(covered.has(t)).toBe(true)
  })
})
