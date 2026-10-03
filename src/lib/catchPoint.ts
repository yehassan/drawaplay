import { dist, distToSegment } from './geometry'
import type { Pt } from './field'

/**
 * Ball exchange: where and when a delivery actually reaches its receiver.
 *
 * A drawn flight is an *aim*, not a delivery point. The catch is wherever the
 * receiver happens to be nearest that line — so the ball goes where the coach
 * pointed rather than where they happened to stop dragging, and the receiver's
 * own motion is never delayed to suit the ball.
 */

export interface CatchSample {
  tMs: number
  pos: Pt
}

export interface CatchMoment {
  /** when the ball arrives, in play time */
  tMs: number
  /** where on the receiver's path the ball meets him */
  point: Pt
  /** perpendicular distance from the receiver to the drawn line */
  offLine: number
}

export interface CatchOptions {
  /**
   * Samples closer than this to the drawn line count as "on target". The
   * tiebreak below makes this the magnet radius, so a catch is only looked for
   * among players the coach was actually aiming at.
   */
  toleranceYd?: number
  /**
   * Release time. A sample before this is unreachable — the ball is not in the
   * air yet — so it is never chosen.
   */
  notBeforeMs?: number
}

const DEFAULT_TOLERANCE = 2

/**
 * Find the moment a receiver is nearest a drawn flight line.
 *
 * Two-stage scoring, and the order matters — but not for the reason first
 * assumed. A review showed both orders return the same answer on collinear
 * geometry, because when every sample is equidistant the tolerance stage cannot
 * separate them and the aim stage does the work either way.
 *
 * The order actually earns its keep when the sample nearest the aim point is
 * *off* target. Tolerance-first discards it and picks among the on-target
 * samples; aim-first would pick it and then have nothing left, returning null or
 * a sample the coach was not aiming at.
 *
 * With no sample on target, this degrades to the globally nearest sample, which
 * is still the closest approach rather than an arbitrary pick.
 */
export function catchMoment(
  line: [Pt, Pt],
  samples: readonly CatchSample[],
  options: CatchOptions = {},
): CatchMoment | null {
  const tolerance = options.toleranceYd ?? DEFAULT_TOLERANCE
  const notBefore = options.notBeforeMs ?? -Infinity
  const [a, b] = line
  const aim = b

  const reachable = samples.filter((s) => s.tMs >= notBefore)
  if (reachable.length === 0) return null

  let bestOnTarget: CatchSample | null = null
  let bestOnTargetScore = Infinity
  let bestOffTarget: CatchSample | null = null
  let bestOffTargetOff = Infinity

  for (const s of reachable) {
    const offLine = distToSegment(s.pos, a, b)
    const aimGap = dist(s.pos, aim)
    if (offLine <= tolerance) {
      // on target: aim proximity decides
      if (aimGap < bestOnTargetScore) {
        bestOnTargetScore = aimGap
        bestOnTarget = s
      }
    } else if (offLine < bestOffTargetOff) {
      bestOffTargetOff = offLine
      bestOffTarget = s
    }
  }

  const chosen = bestOnTarget ?? bestOffTarget
  if (!chosen) return null
  return {
    tMs: chosen.tMs,
    point: { x: chosen.pos.x, y: chosen.pos.y },
    offLine: distToSegment(chosen.pos, a, b),
  }
}
