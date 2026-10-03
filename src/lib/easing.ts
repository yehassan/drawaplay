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
export function pathEased(p: PlayPath, tMs: number): number {
  const dur = p.timing.durationMs
  const t = tMs - p.timing.delayMs
  if (dur <= 0 || t <= 0) return 0
  if (t >= dur) return 1

  // Trapezoid velocity profile: everyone accelerates over the SAME absolute
  // time (~220ms), runs flat-out, then eases out near their own end. Keeps
  // perceived speed identical across short and long routes off the snap.
  const ramp = Math.min(220, dur / 2)
  const total = dur - ramp // area under the velocity curve
  if (total <= 0) return t / dur

  let area: number
  if (t < ramp) area = (t * t) / (2 * ramp)
  else if (t <= dur - ramp) area = ramp / 2 + (t - ramp)
  else area = total - ((dur - t) * (dur - t)) / (2 * ramp)

  return Math.min(1, Math.max(0, area / total))
}
