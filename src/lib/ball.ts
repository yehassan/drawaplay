import { pointAtLength, polylineLength } from './geometry'
import type { Pt } from './field'
import { pathEased } from './timing'
import type { PlayPath, Token } from '../stores/editorStore'

export interface BallState {
  pos: Pt
  angleDeg: number
  flying: boolean
}

const FLIGHT_TYPES: ReadonlySet<PlayPath['type']> = new Set(['pass', 'handoff', 'toss', 'snap'])

/**
 * Who holds the ball at the snap when the user hasn't picked:
 * snap origin → handoff origin → C → QB → first offensive player.
 */
export function defaultBallStart(paths: PlayPath[], tokens: Token[]): string | null {
  const ids = new Set(tokens.map((t) => t.id))
  for (const type of ['snap', 'handoff'] as const) {
    const f = paths.find((p) => p.type === type && p.tokenId && ids.has(p.tokenId))
    if (f?.tokenId) return f.tokenId
  }
  const c = tokens.find((t) => t.pos === 'C')
  if (c) return c.id
  const qb = tokens.find((t) => t.pos === 'QB')
  return qb?.id ?? tokens.find((t) => t.side === 'offense')?.id ?? null
}

/**
 * Ball position/ownership at time tMs.
 * `positions` maps tokenId → current animated position.
 * `warps` maps flightId → warped geometry (two live anchors: thrower + target).
 *
 * Ownership model (H4): flights are unconditional chronological events — every
 * flight flies in its own window (double-read plays work); possession after a
 * completed flight is its endTokenId. While airborne, the most recently
 * launched flight containing tMs owns the ball's position.
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
  const startId = explicitStartId ?? (tokens ? defaultBallStart(paths, tokens) : null)
  if (!startId || !positions.has(startId)) return null

  let owner = startId
  let candidate: PlayPath | null = null

  const flights = paths
    .filter(
      (p) =>
        FLIGHT_TYPES.has(p.type) &&
        p.tokenId != null &&
        p.points.length >= 2,
    )
    .sort((a, b) => a.timing.delayMs - b.timing.delayMs)

  for (const f of flights) {
    const start = f.timing.delayMs
    const end = start + f.timing.durationMs
    if (!animActive || tMs < start) break
    if (tMs < end) {
      candidate = f // still airborne — later launches win overlaps
    } else if (f.endTokenId && positions.has(f.endTokenId)) {
      owner = f.endTokenId
    }
  }

  if (candidate) {
    const pts = warps?.get(candidate.id)?.pts ?? candidate.points
    const e = pathEased(candidate, tMs)
    const len = polylineLength(pts)
    const pos = pointAtLength(pts, e * len)
    const ahead = pointAtLength(pts, Math.min(len, e * len + 0.6))
    const angleDeg = (Math.atan2(ahead.y - pos.y, ahead.x - pos.x) * 180) / Math.PI
    return { pos, angleDeg, flying: true }
  }

  const pos = positions.get(owner)
  if (!pos) return null
  return { pos: { x: pos.x + 0.55, y: pos.y - 0.35 }, angleDeg: -35, flying: false }
}
