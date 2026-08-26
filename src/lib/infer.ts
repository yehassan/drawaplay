import { dist, distToSegment } from './geometry'
import type { Pt } from './field'
import type { PathType } from './pathStyles'

interface EndpointLike {
  side: 'offense' | 'defense'
}

interface Endpoints {
  startToken: EndpointLike | null
  endToken: EndpointLike | null
}

/**
 * Intent inference v1 — heuristics only, user can always override in the inspector.
 * - short player-to-player stub (< 4yd), however wobbly → block
 * - long curved player-to-player arc (≥ 10yd)           → pass
 * - anything else                                       → route
 */
export function inferPathType(
  pts: Pt[],
  { startToken, endToken }: Endpoints,
): PathType {
  const a = pts[0]
  const b = pts[pts.length - 1]
  const chord = dist(a, b)

  let len = 0
  let maxDev = 0
  for (let i = 0; i < pts.length - 1; i++) {
    len += dist(pts[i], pts[i + 1])
    maxDev = Math.max(maxDev, distToSegment(pts[i], a, b))
  }

  const curviness = chord > 0 ? maxDev / chord : 0
  const bothEnds = startToken != null && endToken != null

  if (bothEnds && chord < 4) return 'block'
  if (bothEnds && chord >= 10 && curviness > 0.14) return 'pass'
  return 'route'
}
