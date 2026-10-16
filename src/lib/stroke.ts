import { catmullRomPath, dist, simplifyRDP, trimToRim } from './geometry'
import { inferPathType } from './infer'
import { resolveFlightTarget, tokenAtPoint } from './target'
import { PLAYER_DRIVEN, type PathType } from './pathStyles'
import type { Pt } from './field'
import type { PlayPath, Token } from '../stores/editorStore'

/**
 * rough → slick, as a pure function.
 *
 * This used to live inside FieldCanvas, where nothing could reach it: the pen's
 * whole decision — simplify, snap both ends to players, infer the type, talk the
 * flight into a target, canonicalize the geometry — was only testable by hand.
 * A scenario can now drive it, which is what makes the mid-play aiming bug
 * (aiming at a receiver's *rest* spot while he is drawn somewhere else, so the
 * flight resolved to nobody and the ball never changed hands) reproducible.
 */
export interface StrokeContext {
  zoom: number
  tokens: Token[]
  paths: PlayPath[]
  /**
   * Where players are drawn right now, straight from
   * `computeScene(...).tokenPositions`. Omit it and the stroke is measured
   * against rest spots, which is correct only when the play is at rest.
   */
  renderedPositions?: Map<string, Pt>
}

/** the path a finished stroke becomes, before it is given an id and a schedule */
export interface StrokePath {
  tokenId: string
  endTokenId: string | null
  type: PathType
  points: Pt[]
  d: string
}

/** simplify epsilon, in screen px */
export const STROKE_EPS_PX = 2.5
/** snap radius, in screen px, capped in yards so it stays zoom-independent (H8) */
export const HIT_RADIUS_PX = 28
export const HIT_RADIUS_MAX_YD = 2

export function hitRadiusYd(zoom: number): number {
  return Math.min(HIT_RADIUS_PX / zoom, HIT_RADIUS_MAX_YD)
}

/**
 * Returns null when the stroke did not start on a player — the caller decides
 * how to say so. A stroke too short to be anything is the caller's business too.
 */
export function finalizeStroke(raw: Pt[], ctx: StrokeContext): StrokePath | null {
  let pts = simplifyRDP(raw, STROKE_EPS_PX / ctx.zoom)
  if (pts.length < 2) pts = [raw[0], raw[raw.length - 1]!]

  const radius = hitRadiusYd(ctx.zoom)
  const drawn = ctx.renderedPositions
  const snapEnd = (p: Pt): Token | null => tokenAtPoint(p, ctx.tokens, radius, drawn)

  let startToken: Token | null = snapEnd(pts[0]!)
  if (!startToken) {
    // allow starting at the tip of an existing chain (e.g., route after motion)
    let best: Token | null = null
    let bestD = radius
    for (const t of ctx.tokens) {
      const chain = ctx.paths.filter((q) => q.tokenId === t.id && PLAYER_DRIVEN.has(q.type))
      if (chain.length === 0) continue
      const tip = chain[chain.length - 1]!.points[chain[chain.length - 1]!.points.length - 1]!
      const d = dist(pts[0]!, tip)
      if (d < bestD) {
        bestD = d
        best = t
      }
    }
    if (best) startToken = best
  }
  const endToken = snapEnd(pts[pts.length - 1]!)
  if (!startToken) return null

  // magnetic chaining: next segment starts where the player's chain ends
  // (e.g., route after motion starts at motion tip, not original spot)
  const existingChain = ctx.paths.filter(
    (q) => q.tokenId === startToken!.id && PLAYER_DRIVEN.has(q.type),
  )
  let chainTip: Pt | null = null
  let chainRoot: Pt | null = null
  if (existingChain.length > 0) {
    const lastSibling = existingChain[existingChain.length - 1]!
    chainTip = lastSibling.points[lastSibling.points.length - 1]!
    chainRoot = existingChain[0]!.points[0]!
  }

  if (chainTip) pts[0] = chainTip
  else pts[0] = { x: startToken.x, y: startToken.y }
  const type = inferPathType(pts, { startToken, endToken })
  if (!endToken && chainRoot && dist(pts[pts.length - 1]!, chainRoot) < 2) {
    pts[pts.length - 1] = chainRoot
  }
  if (endToken) {
    pts[pts.length - 1] = trimToRim(pts[pts.length - 2]!, drawn?.get(endToken.id) ?? {
      x: endToken.x,
      y: endToken.y,
    })
  }

  // a flight drawn to the tip of someone's route targets that player even
  // when no token was under the pen
  const targetId =
    endToken?.id ?? resolveFlightTarget(pts, startToken.id, ctx.paths, type, ctx.tokens, drawn)

  // H3: flights get canonical geometry. Passes are STRICTLY straight lines;
  // handoffs/tosses may keep a gentle capped loft around bodies.
  if (type === 'pass' || type === 'handoff' || type === 'toss' || type === 'snap') {
    if (type === 'pass' || type === 'snap') {
      pts = [pts[0]!, pts[pts.length - 1]!]
    }
    const a = pts[0]!
    const b = pts[pts.length - 1]!
    const cx = b.x - a.x
    const cy = b.y - a.y
    const chord = Math.hypot(cx, cy)
    if (chord > 0.5) {
      let maxDev = 0
      for (let i = 1; i < pts.length - 1; i++) {
        const cross = (cx * (pts[i]!.y - a.y) - cy * (pts[i]!.x - a.x)) / chord
        if (Math.abs(cross) > Math.abs(maxDev)) maxDev = cross
      }
      if (Math.abs(maxDev) < 0.35) {
        pts = [a, b]
      } else {
        const dev = Math.max(-2, Math.min(2, maxDev))
        const nx = -cy / chord
        const ny = cx / chord
        // Catmull-Rom passes through the middle point → apex ≈ dev
        pts = [a, { x: (a.x + b.x) / 2 + nx * dev, y: (a.y + b.y) / 2 + ny * dev }, b]
      }
    }
  }

  return {
    tokenId: startToken.id,
    endTokenId: targetId,
    type,
    points: pts,
    d: catmullRomPath(pts),
  }
}
