import type { PlayPath } from '../stores/editorStore'

/**
 * Eased 0..1 progress along a path at time tMs.
 *
 * Lives apart from the scheduler because it is pure geometry-over-time: the
 * renderer needs it, and so will the actor-position sampler that the scheduler
 * itself needs. Keeping it here is what lets `actorPosition` stay a leaf module
 * that both can import without a cycle.
 *
 * Trapezoid velocity profile: everyone accelerates over the SAME absolute time
 * (~220ms), runs flat-out, then eases out near their own end. Keeps perceived
 * speed identical across short and long routes off the snap. This is NOT
 * per-path normalised cubic — do not regress it to easeInOutCubic.
 */
/** absolute ms everyone takes to accelerate from a standstill */
const RAMP_MS = 220

export interface EaseOpts {
  /**
   * Suppress the acceleration ramp at the START. Set when this movement begins
   * exactly where the player's previous one ended — he is already moving, so
   * ramping up from zero would read as a stop.
   */
  easeIn?: boolean
  /**
   * Suppress the deceleration ramp at the END. Set when this movement is
   * immediately followed by another of the same player's — he carries on, so
   * slowing to a stop here would read as a stop.
   */
  easeOut?: boolean
}

/**
 * Eased 0..1 progress along a path at time tMs.
 *
 * Lives apart from the scheduler because it is pure geometry-over-time: the
 * renderer needs it, and so will the actor-position sampler that the scheduler
 * itself needs. Keeping it here is what lets `actorPosition` stay a leaf module
 * that both can import without a cycle.
 *
 * Trapezoid velocity profile: everyone accelerates over the SAME absolute time
 * (~220ms), runs flat-out, then eases out near their own end. Keeps perceived
 * speed identical across short and long routes off the snap. This is NOT
 * per-path normalised cubic — do not regress it to easeInOutCubic.
 *
 * At a seam between two of one player's chained movements both curves meet at
 * zero, which stopped him dead mid-play: measured 3% of plateau speed for 48ms
 * and under half speed for 240ms at the moment he received the ball. `easeIn` /
 * `easeOut` lift the ramps at those seams — see `renderedPosAt`.
 */
export function pathEased(p: PlayPath, tMs: number, opts: EaseOpts = {}): number {
  const dur = p.timing.durationMs
  const t = tMs - p.timing.delayMs
  if (dur <= 0 || t <= 0) return 0
  if (t >= dur) return 1

  const half = Math.min(RAMP_MS, dur / 2)
  const rampIn = opts.easeIn === false ? 0 : half
  const rampOut = opts.easeOut === false ? 0 : half
  // area under the velocity curve
  const total = dur - rampIn / 2 - rampOut / 2
  if (total <= 0) return t / dur

  let area: number
  if (rampIn > 0 && t < rampIn) area = (t * t) / (2 * rampIn)
  else if (rampOut > 0 && t > dur - rampOut) area = total - ((dur - t) * (dur - t)) / (2 * rampOut)
  else area = t - rampIn / 2

  return Math.min(1, Math.max(0, area / total))
}
