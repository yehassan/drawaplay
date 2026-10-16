import { flightLaunches } from './ball'
import { BALL_ACTION_TYPES } from './pathStyles'
import { tokenLabel } from './positions'
import type { PlayPath, Token } from '../stores/editorStore'

export interface PlayWarning {
  /** stable key, also the dedupe identity */
  id: string
  message: string
  /** what clicking the warning selects on the field */
  targetIds: string[]
}

/**
 * Things that are certainly not a play, derived from the play itself.
 *
 * Only whole-play properties belong here. A condition that can be checked at the
 * moment of intent is prevented instead — the flight type picker refuses a line
 * that ends on grass, rather than letting it be marked and then reporting it. So
 * this list is deliberately short, and stays short: the moment it holds anything
 * arguable, coaches stop reading it.
 */
export function playWarnings(
  tokens: Token[],
  paths: PlayPath[],
  ballStartId: string | null,
): PlayWarning[] {
  const byId = new Map(tokens.map((t) => [t.id, t]))
  const rest = new Map(tokens.map((t) => [t.id, { x: t.x, y: t.y }]))
  const name = (id: string | null | undefined) => {
    const t = id ? byId.get(id) : undefined
    return t ? tokenLabel(t) : 'nobody'
  }
  const out: PlayWarning[] = []

  // a throw by a player who never gets the ball cannot fly — a property of the
  // whole play, so it cannot be caught when the stroke is drawn or labelled
  for (const { flight, holder, fires } of flightLaunches(paths, rest, ballStartId, tokens)) {
    if (fires) continue
    out.push({
      id: `no-ball:${flight.id}`,
      message: `${name(flight.tokenId)} never gets the ball, so this ${flight.type} never happens — it is still with ${name(holder)}.`,
      targetIds: [flight.id],
    })
  }

  // a ball action with nobody to catch it. Deletable into existence: deleting the
  // receiver clears the aim, which leaves the stroke pointing at grass. A dead id
  // cannot survive here — `deleteTokens` clears it and `loadPlay` remaps or nulls
  // it — so "no receiver" is one condition.
  for (const p of paths) {
    if (!BALL_ACTION_TYPES.has(p.type)) continue
    if (p.endTokenId) continue
    out.push({
      id: `no-receiver:${p.id}`,
      message: `This ${p.type} has no receiver.`,
      targetIds: [p.id],
    })
  }

  return out
}
