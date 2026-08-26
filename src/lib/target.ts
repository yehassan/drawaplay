import { dist } from './geometry'
import type { Pt } from './field'
import type { PlayPath } from '../stores/editorStore'
import type { PathType } from './pathStyles'

/** types whose far end may auto-resolve to a nearby path tip / defender */
const TARGETABLE_TYPES: ReadonlySet<PathType> = new Set(['pass', 'handoff', 'toss', 'snap', 'block'])

/** how far (yd) a flight's far end may sit from a route's endpoint to count as thrown to it */
export const TARGET_MATCH_RADIUS_YD = 2.5

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
  return bestId
}
