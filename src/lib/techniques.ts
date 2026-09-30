import type { Token } from '../stores/editorStore'

export type DlTechnique = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface OlAnchors {
  c: number
  lg: number
  rg: number
  lt: number
  rt: number
}

export interface TechniqueAssignment {
  tech: DlTechnique
  inverted: boolean
  mirrored: boolean
}

export const DL_TECHNIQUES: readonly DlTechnique[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * A technique number is a role assignment, not just a coordinate: a 0 is a nose
 * over the center and a 9 is an edge, so the same number means different things
 * to different defenders. Role comes from where the defender is standing
 * relative to the guards and tackles, and it changes as he is moved.
 */
export type DlRole = 'nt' | 'dt' | 'de'

export const ROLE_TECHNIQUES: Record<DlRole, readonly DlTechnique[]> = {
  nt: [0, 1],
  dt: [1, 2, 3, 4, 5],
  de: [5, 6, 7, 8, 9],
}

/** lateral offset from the center in units of the guard half-span */
const SPOT: Record<DlTechnique, number> = {
  0: 0,
  1: -0.5,
  2: -1,
  3: -1.5,
  4: 1,
  5: 1.5,
  6: 2,
  7: 2.5,
  8: 3,
  9: 3.5,
}

/**
 * Same grid shaded toward the ball. An inverted technique is physically close
 * to the technique below it (a 2i stands roughly where a 1 stands), so each
 * one sits a fraction inside to keep the two distinguishable in the chip row.
 * The pairs are kept mirror-symmetric so a 4.0.4 comes out level.
 */
const INVERTED: Record<DlTechnique, number> = {
  0: 0,
  1: -0.25,
  2: -0.4,
  3: -0.85,
  4: 0.4,
  5: 0.85,
  6: 1.35,
  7: 1.85,
  8: 2.35,
  9: 2.85,
}

const DEFAULT_GUARD_HALF = 1.8
const DEFAULT_TACKLE_HALF = 3.6

/** how far off a technique a token may drift before it reads as something else */
export const DEFAULT_TECHNIQUE_TOLERANCE = 0.35

/** the line a defense is drawn against when no offense is on the field */
export function defaultAnchors(refX: number): OlAnchors {
  return {
    c: refX,
    lg: refX - DEFAULT_GUARD_HALF,
    rg: refX + DEFAULT_GUARD_HALF,
    lt: refX - DEFAULT_TACKLE_HALF,
    rt: refX + DEFAULT_TACKLE_HALF,
  }
}

export function techniqueLabel(a: TechniqueAssignment): string {
  return `${a.tech}${a.inverted ? 'i' : ''}${a.mirrored ? '\u21c4' : ''}`
}

/**
 * Techniques are meaningless without knowing where the guards actually are,
 * so anchor on the live offensive line when one is on the field and fall back
 * to a symmetric default line centered on `refX` (the defense's own ball x).
 */
export function olAnchors(tokens: Token[], refX: number): OlAnchors {
  const xs = (pos: Token['pos']): number[] =>
    tokens.filter((t) => t.side === 'offense' && t.pos === pos).map((t) => t.x)

  const centers = xs('C')
  const guards = xs('G')
  const tackles = xs('T')

  const anchor = centers.length ? centers[0] : refX
  const d = defaultAnchors(anchor)
  return {
    c: anchor,
    lg: guards.length >= 2 ? Math.min(...guards) : d.lg,
    rg: guards.length >= 2 ? Math.max(...guards) : d.rg,
    lt: tackles.length >= 2 ? Math.min(...tackles) : d.lt,
    rt: tackles.length >= 2 ? Math.max(...tackles) : d.rt,
  }
}


/** field-x for a defender on the given technique */
export function techniqueX(
  a: OlAnchors,
  tech: DlTechnique,
  inverted: boolean,
  mirrored = false,
): number {
  const g = (a.rg - a.lg) / 2
  const t = (a.rt - a.lt) / 2
  const mult = inverted ? INVERTED[tech] : SPOT[tech]
  const abs = Math.abs(mult)
  const x = abs <= 1.5 ? a.c + mult * g : a.c + Math.sign(mult) * (t + (abs - 2) * g)
  return mirrored ? 2 * a.c - x : x
}

/**
 * Mirror is only meaningful past the guards: a mirrored 3 already *is* a 5, and
 * a mirrored 4 is a 2, so the opposite-side number covers 1-5 on its own.
 * From 6 out there is no left-hand number in standard notation, so the mirror
 * carries real information — and only an edge defender ever needs it.
 */
export const MIRRORABLE_TECHNIQUES: readonly DlTechnique[] = [6, 7, 8, 9]

export function dlRole(a: OlAnchors, x: number): DlRole {
  const g = (a.rg - a.lg) / 2
  const t = (a.rt - a.lt) / 2
  const off = Math.abs(x - a.c)
  const eps = 0.05
  // a nose lives in the A-gap itself; a shade that is merely *inside* a guard
  // (a 3i or a 5i) is still a tackle, and a head-up 2 is a tackle
  if (off < g / 2 + eps) return 'nt'
  if (off < t - eps) return 'dt'
  return 'de'
}

/** inverse of techniqueX — the chip row uses this to show what's active */
export function nearestTechnique(a: OlAnchors, x: number): TechniqueAssignment {
  let best: TechniqueAssignment = { tech: 0, inverted: false, mirrored: false }
  let bestDist = Infinity
  for (const tech of DL_TECHNIQUES) {
    for (const inverted of [false, true]) {
      if (tech === 0 && inverted) continue
      for (const mirrored of [false, true]) {
        if (mirrored && tech < 6) continue
        const d = Math.abs(techniqueX(a, tech, inverted, mirrored) - x)
        if (d < bestDist) {
          bestDist = d
          best = { tech, inverted, mirrored }
        }
      }
    }
  }
  return best
}
