import { pathEased } from './easing'
import { pointAtLength, polylineLength } from './geometry'
import type { Pt } from './field'
import type { PlayPath } from '../stores/editorStore'

/**
 * ONE authoritative answer to "where is this player at time t", shared by the
 * token loop and the flight warp.
 *
 * These used to be two separate implementations that disagreed. `chainPosAt`
 * took the LAST movement to have started, while the token loop took the
 * GREATEST start time — so a player with two movements sharing a delayMs was
 * drawn on one and the ball was aimed at the other (measured 0.47yd apart).
 * `chainPosAt` also skipped `bindStartToChain`, so it ignored the very
 * translation that closes a seam between a movement and its predecessor
 * (measured 0.20yd apart). Both are gone; there is now one function.
 *
 * Lives in its own module, and imports only `easing` + `geometry`, so the
 * scheduler can import it without a cycle. The scheduler needs it because a
 * flight's arrival must be timed against where the receiver actually is.
 */

/**
 * Which movement of `list` is playing at time t.
 *
 * Greatest `delayMs` wins, so a late-drawn motion is never picked over the
 * route it precedes. Ties keep the EARLIER entry in draw order.
 */
function activeAt(list: PlayPath[], t: number, excludeId?: string): PlayPath | null {
  let active: PlayPath | null = null
  for (const q of list) {
    if (q.id === excludeId || q.points.length < 2) continue
    if (q.timing.delayMs > t) continue
    if (!active || q.timing.delayMs > active.timing.delayMs) active = q
  }
  return active
}

/**
 * H1: translate a segment so its start meets where the chain actually has the
 * player, which is what makes a second movement continue from the first with no
 * seam. A first movement has no predecessor, so it stays where it was authored.
 */
function bindStartToChain(list: PlayPath[], active: PlayPath): Pt[] {
  const prior = activeAt(list, active.timing.delayMs, active.id)
  if (!prior) return active.points
  const priorLen = polylineLength(prior.points)
  const anchorPos = pointAtLength(prior.points, pathEased(prior, active.timing.delayMs) * priorLen)
  const dx = anchorPos.x - active.points[0].x
  const dy = anchorPos.y - active.points[0].y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return active.points
  return active.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

/**
 * Where the player owning these movements is at time `t`, or null if none of
 * them has started.
 *
 * `list` must be a single player's own player-driven paths in draw order.
 * Timings are read off each path, so callers inside the scheduler must pass
 * paths carrying the timings computed SO FAR, not their pre-schedule values.
 */
export function renderedPosAt(list: PlayPath[], t: number): Pt | null {
  const active = activeAt(list, t)
  if (!active) return null
  const pts = bindStartToChain(list, active)
  return pointAtLength(pts, pathEased(active, t) * polylineLength(pts))
}

/**
 * True when this player has any movement the renderer will actually animate.
 *
 * A flight whose thrower or receiver fails this has no trajectory to anchor to,
 * so the renderer falls back to the token's rest position instead of leaving the
 * flight wherever it was drawn.
 */
export function hasDrivenMovement(list: PlayPath[] | undefined): boolean {
  return !!list && list.some((p) => p.points.length >= 2)
}