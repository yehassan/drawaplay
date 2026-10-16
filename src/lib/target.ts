import { dist } from './geometry'
import type { Pt } from './field'
import type { PlayPath, Token } from '../stores/editorStore'
import { BALL_ACTION_TYPES, type PathType } from './pathStyles'

/** types whose far end may auto-resolve to a nearby path tip / defender */
const TARGETABLE_TYPES: ReadonlySet<PathType> = new Set(['pass', 'handoff', 'toss', 'snap', 'block'])

/** how far (yd) a flight's far end may sit from a route's endpoint to count as thrown to it */
export const TARGET_MATCH_RADIUS_YD = 2.5

/**
 * Who a ball action marked on this stroke would hand the ball to — the one
 * answer to "does this line end on a teammate?".
 *
 * This is the expression `updatePathType` stores, so a mark that passes
 * `canApplyPathType` cannot then be stored with nobody to throw to.
 */
export function ballActionTarget(
  path: PlayPath,
  type: PathType,
  paths: PlayPath[],
  tokens: Token[],
): string | null {
  return (
    path.endTokenId ?? resolveFlightTarget(path.points, path.tokenId, paths, type, tokens)
  )
}

/**
 * Whether a stroke may be marked as `type`. Only the ball actions are ever
 * refused, and only when the line ends on nobody: a pass, handoff or toss with
 * no receiver hands the ball to nobody, so the honest moment to say so is when
 * the coach picks the type, not after the ball fails to move.
 */
export function canApplyPathType(
  path: PlayPath,
  type: PathType,
  paths: PlayPath[],
  tokens: Token[],
): boolean {
  if (!BALL_ACTION_TYPES.has(type)) return true
  if (!path.tokenId) return false
  return ballActionTarget(path, type, paths, tokens) !== null
}

/**
 * Where a token actually is: its animated position while the play is running,
 * its rest spot otherwise. The pen is aimed at what is on screen, so every hit
 * test against a player has to go through here — snapping to the rest spot
 * while the play is mid-motion misses a receiver by however far he has run,
 * and a flight that resolves to nobody never hands over the ball.
 */
export function tokenAtPoint(
  p: Pt,
  tokens: Token[],
  radiusYd: number,
  positions?: Map<string, Pt>,
): Token | null {
  let best: Token | null = null
  let bestD = radiusYd
  for (const t of tokens) {
    const at = positions?.get(t.id) ?? t
    const d = dist(p, at)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

/**
 * Resolve who a flight is thrown/handed to when endpoint token-snapping found
 * nobody: match the nearest path endpoint (e.g., the tip of a route) and adopt
 * that path's anchor player.
 *
 * L3: in bunch looks, tips cluster — prefer candidates lying roughly along the
 * throw direction (soft bonus, hard fallback to nearest).
 */
export function resolveFlightTarget(
  pts: Pt[],
  startTokenId: string | null,
  paths: PlayPath[],
  type?: PathType,
  tokens?: Token[],
  positions?: Map<string, Pt>,
): string | null {
  if (pts.length < 2) return null
  if (type && !TARGETABLE_TYPES.has(type)) return null

  const start = pts[0]
  const far = pts[pts.length - 1]
  const dirLen = dist(start, far)
  if (dirLen === 0) return null
  const dirX = (far.x - start.x) / dirLen
  const dirY = (far.y - start.y) / dirLen

  let bestId: string | null = null
  let bestScore = -Infinity
  for (const p of paths) {
    if (!p.tokenId || p.tokenId === startTokenId) continue
    if (p.points.length < 2) continue
    const tip = p.points[p.points.length - 1]
    const d = dist(far, tip)
    if (d > TARGET_MATCH_RADIUS_YD) continue
    // alignment of (start → candidate tip) with the stroke direction, clamped ≥0
    const segLen = dist(start, tip)
    const dot =
      segLen > 0 ? Math.max(0, ((tip.x - start.x) / segLen) * dirX + ((tip.y - start.y) / segLen) * dirY) : 0
    const score = dot * 1.5 - d
    if (score > bestScore) {
      bestScore = score
      bestId = p.tokenId
    }
  }
  if (bestId) return bestId

  // No route tip in range: fall back to the nearest player standing near the
  // far end, so a delivery to somebody who has not run a route still resolves.
  if (!tokens) return null
  const loose = TARGET_MATCH_RADIUS_YD * 3
  let fallbackId: string | null = null
  let fallbackD = loose
  for (const tk of tokens) {
    if (tk.id === startTokenId) continue
    const at = positions?.get(tk.id) ?? tk
    const d = dist(far, at)
    if (d < fallbackD) {
      fallbackD = d
      fallbackId = tk.id
    }
  }
  return fallbackId
}
