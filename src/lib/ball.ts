import { pointAtLength, polylineLength } from './geometry'
import type { Pt } from './field'
import { pathEased } from './easing'
import { FLIGHT_TYPES } from './pathStyles'
import type { PlayPath, Token } from '../stores/editorStore'

export interface BallState {
  pos: Pt
  angleDeg: number
  flying: boolean
}

/**
 * Who holds the ball at the snap when the user hasn't picked:
 * snap origin → handoff origin → the earliest thrower → C → QB → first offensive.
 *
 * The "earliest thrower" rung matters once possession is enforced: a play drawn
 * with a centre and a QB but no snap must still be able to throw, and the man
 * making the first exchange is the only one who can start with the ball.
 */
export function defaultBallStart(paths: PlayPath[], tokens: Token[]): string | null {
  const ids = new Set(tokens.map((t) => t.id))
  for (const type of ['snap', 'handoff'] as const) {
    const f = paths.find((p) => p.type === type && p.tokenId && ids.has(p.tokenId))
    if (f?.tokenId) return f.tokenId
  }
  const first = paths
    .filter((p) => (p.type === 'pass' || p.type === 'toss') && p.tokenId && ids.has(p.tokenId))
    .sort((a, b) => a.timing.delayMs - b.timing.delayMs)[0]
  if (first?.tokenId) return first.tokenId
  const c = tokens.find((t) => t.pos === 'C')
  if (c) return c.id
  const qb = tokens.find((t) => t.pos === 'QB')
  return qb?.id ?? tokens.find((t) => t.side === 'offense')?.id ?? null
}

export interface BallEvent {
  /** who is holding the ball at tMs */
  owner: string
  /** the flight in the air at tMs, if any */
  flight: PlayPath | null
}

export interface FlightLaunch {
  flight: PlayPath
  /** who is holding the ball when this flight is released (null when nobody is) */
  holder: string | null
  /** false when the thrower does not have the ball to throw */
  fires: boolean
}

/**
 * The launch walk: every flight in the play, in release order, with whoever is
 * holding the ball at each release.
 *
 * This is the ONE place the possession rule ("a throw needs the ball in hand") is
 * decided — `ballEventAt` draws from it and `playWarnings` reports from it, so a
 * throw can never render and be described differently. Legality is judged at the
 * moment of RELEASE, not at the sampled time, so a later exchange cannot
 * retroactively invalidate an earlier throw.
 *
 * A flight is legal only when its thrower is holding the ball then. Flight
 * timings must be settled before calling this.
 */
export function flightLaunches(
  paths: PlayPath[],
  positions: Map<string, Pt>,
  explicitStartId: string | null,
  tokens?: Token[],
): FlightLaunch[] {
  const flights = paths
    .filter((p) => FLIGHT_TYPES.has(p.type) && p.tokenId != null && p.points.length >= 2)
    .sort((a, b) => a.timing.delayMs - b.timing.delayMs)

  const startId = explicitStartId ?? (tokens ? defaultBallStart(paths, tokens) : null)
  if (!startId || !positions.has(startId)) {
    return flights.map((flight) => ({ flight, holder: null, fires: false }))
  }

  const out: FlightLaunch[] = []
  const landings: { end: number; to: string }[] = []
  let owner = startId
  for (const flight of flights) {
    const start = flight.timing.delayMs
    while (landings.length > 0 && landings[0]!.end <= start) {
      owner = landings.shift()!.to
    }
    const fires = owner === flight.tokenId
    out.push({ flight, holder: owner, fires })
    if (!fires) continue
    if (flight.endTokenId && positions.has(flight.endTokenId)) {
      const landing = { end: start + flight.timing.durationMs, to: flight.endTokenId }
      const at = landings.findIndex((l) => l.end > landing.end)
      if (at === -1) landings.push(landing)
      else landings.splice(at, 0, landing)
    }
  }
  return out
}

/**
 * The one answer to "whose ball is it, and is it in the air".
 *
 * The ball moves once per exchange, and a chain (snap → toss → pass) hands it
 * down the line to whatever the next thrower is drawn doing. A stroke thrown by
 * a player who never receives the ball is inert rather than teleporting it; the
 * scheduler is what guarantees a *scheduled* flight is never inert (see
 * `reschedule`), and `playWarnings` is what tells the coach about the rest.
 *
 * Two flights released in the same window still both fly — possession does not
 * leave the thrower's hands until a flight completes — which keeps a drawn
 * double read readable instead of silently deleting one of the options.
 */
export function ballEventAt(
  paths: PlayPath[],
  positions: Map<string, Pt>,
  explicitStartId: string | null,
  tMs: number,
  animActive: boolean,
  tokens?: Token[],
): BallEvent | null {
  const startId = explicitStartId ?? (tokens ? defaultBallStart(paths, tokens) : null)
  if (!startId || !positions.has(startId)) return null

  // 2. ownership at tMs, plus the flight in the air then. Two flights released
  //    into the same window are both legal, so later launches still win overlaps
  //    and a drawn double read stays readable rather than silently deleting one.
  if (!animActive) return { owner: startId, flight: null }
  let ownerNow = startId
  let candidate: PlayPath | null = null
  for (const { flight, fires } of flightLaunches(paths, positions, explicitStartId, tokens)) {
    if (!fires) continue
    const start = flight.timing.delayMs
    const end = start + flight.timing.durationMs
    if (tMs < start) break
    if (tMs < end) candidate = flight
    else if (flight.endTokenId && positions.has(flight.endTokenId)) ownerNow = flight.endTokenId
  }

  return { owner: ownerNow, flight: candidate }
}

/**
 * Ball position/ownership at time tMs.
 * `positions` maps tokenId → current animated position.
 * `warps` maps flightId → warped geometry (two live anchors: thrower + target).
 */
export function ballStateAt(
  paths: PlayPath[],
  positions: Map<string, Pt>,
  explicitStartId: string | null,
  tMs: number,
  animActive: boolean,
  warps?: Map<string, { pts: Pt[] }>,
  tokens?: Token[],
): BallState | null {
  const event = ballEventAt(paths, positions, explicitStartId, tMs, animActive, tokens)
  if (!event) return null

  if (event.flight) {
    const pts = warps?.get(event.flight.id)?.pts ?? event.flight.points
    const e = pathEased(event.flight, tMs)
    const len = polylineLength(pts)
    const pos = pointAtLength(pts, e * len)
    const ahead = pointAtLength(pts, Math.min(len, e * len + 0.6))
    const angleDeg = (Math.atan2(ahead.y - pos.y, ahead.x - pos.x) * 180) / Math.PI
    return { pos, angleDeg, flying: true }
  }

  const pos = positions.get(event.owner)
  if (!pos) return null
  return { pos: { x: pos.x + 0.55, y: pos.y - 0.35 }, angleDeg: -35, flying: false }
}
