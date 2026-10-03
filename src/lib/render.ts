import { catmullRomPath } from './geometry'
import { boundPoints, progressAt, renderedPosAt } from './actorPosition'
import { timelineDuration } from './timing'
import { pathEased } from './easing'
import { ballStateAt, type BallState } from './ball'
import { PLAYER_DRIVEN } from './pathStyles'
import type { Pt } from './field'

import type { PlayPath, TextNote, Token } from '../stores/editorStore'

const FLIGHT_TYPES: ReadonlySet<PlayPath['type']> = new Set(['pass', 'handoff', 'toss', 'snap'])

export interface ScenePath extends PlayPath {
  /** 0..1 how far this path has played out (1 = fully drawn / idle editing) */
  progress: number
}

export interface Scene {
  /** animated position of every token this frame */
  tokenPositions: Map<string, Pt>
  /** geometry after flight warp / block re-trim, with per-path progress */
  paths: ScenePath[]
  ball: BallState | null
}

export interface SceneOpts {
  tMs: number
  playing: boolean
  ballStartId: string | null
}

/**
 * Pure render state for a play at time t — the single source of truth shared
 * by the SVG editor and the PNG/video exporters.
 */
export function computeScene(
  tokens: Token[],
  paths: PlayPath[],
  opts: SceneOpts,
): Scene {
  const animActive = opts.playing || opts.tMs > 0

  // all of a player's own movements, in draw order; they play sequentially
  const drivenByToken = new Map<string, PlayPath[]>()
  for (const p of paths) {
    if (!p.tokenId || !PLAYER_DRIVEN.has(p.type)) continue
    const list = drivenByToken.get(p.tokenId)
    if (list) list.push(p)
    else drivenByToken.set(p.tokenId, [p])
  }

  // where a player stands when nothing is animating them
  const restPos = (id: string): Pt | null => {
    const t = tokens.find((tk) => tk.id === id)
    return t ? { x: t.x, y: t.y } : null
  }

  // animated positions for every token this frame
  const tokenPositions = new Map<string, Pt>()
  for (const t of tokens) {
    const list = animActive ? drivenByToken.get(t.id) : undefined
    if (!list || list.length === 0) {
      tokenPositions.set(t.id, { x: t.x, y: t.y })
      continue
    }
    const pos = renderedPosAt(list, opts.tMs)
    tokenPositions.set(t.id, pos ?? { x: t.x, y: t.y })
  }

  // ball-only flights: two live anchors (thrower release + target arrival),
  // both evaluated at their FIXED instants so arcs never chase players
  const flightWarps = new Map<string, { pts: Pt[]; d: string }>()
  if (animActive) {
    for (const f of paths) {
      if (!FLIGHT_TYPES.has(f.type)) continue
      const n = f.points.length
      if (n < 2) continue

      let sx = 0
      let sy = 0
      let ex = 0
      let ey = 0

      // Both anchors are evaluated at their FIXED instants (release / arrival),
      // never the live tMs, so the arc never chases a moving player mid-flight.
      //
      // A thrower or receiver with no animated movement has no trajectory to
      // anchor to, so it falls back to the token's rest position. Without this
      // the flight keeps whatever point it was drawn from — which is how the
      // Dive scenario's handoff ended up releasing 6.3yd behind the QB.
      if (f.tokenId) {
        const anchor = renderedPosAt(drivenByToken.get(f.tokenId) ?? [], f.timing.delayMs)
          ?? restPos(f.tokenId)
        if (anchor) {
          sx = anchor.x - f.points[0].x
          sy = anchor.y - f.points[0].y
        }
      }
      if (f.endTokenId) {
        const anchor = renderedPosAt(
          drivenByToken.get(f.endTokenId) ?? [],
          f.timing.delayMs + f.timing.durationMs,
        ) ?? restPos(f.endTokenId)
        if (anchor) {
          ex = anchor.x - f.points[n - 1].x
          ey = anchor.y - f.points[n - 1].y
        }
      }

      if (sx === 0 && sy === 0 && ex === 0 && ey === 0) continue

      const pts = f.points.map((p, i) => {
        const u = i / (n - 1)
        return { x: p.x + sx * (1 - u) + ex * u, y: p.y + sy * (1 - u) + ey * u }
      })
      flightWarps.set(f.id, { pts, d: catmullRomPath(pts) })
    }
  }

  const rendered = paths.map((f) => {
    const w = flightWarps.get(f.id)
    if (w) return { ...f, points: w.pts, d: w.d }

    // Movement strokes are drawn on the SAME seam-closed geometry the token
    // uses. Drawn on raw geometry the line visibly fails to meet the previous
    // one where a movement was authored off its predecessor — 0.92yd on real
    // tracking data, where the receiver genuinely covers a yard between frames.
    if (PLAYER_DRIVEN.has(f.type) && f.tokenId) {
      const list = drivenByToken.get(f.tokenId)
      if (list) {
        const pts = boundPoints(list, f)
        if (pts !== f.points) return { ...f, points: pts, d: catmullRomPath(pts) }
      }
    }

    // blocks re-trim their end to the defender's current rim
    if (f.type === 'block' && f.endTokenId && animActive && f.points.length >= 2) {
      const defPos = tokenPositions.get(f.endTokenId)
      if (defPos) {
        const prev = f.points[f.points.length - 2]
        const dx = defPos.x - prev.x
        const dy = defPos.y - prev.y
        const len = Math.hypot(dx, dy)
        if (len > 0.01) {
          const gap = Math.min(1.5, len / 2)
          const pts = [
            ...f.points.slice(0, -1),
            { x: defPos.x - (dx / len) * gap, y: defPos.y - (dy / len) * gap },
          ]
          return { ...f, points: pts, d: catmullRomPath(pts) }
        }
      }
    }

    return f
  })

  const out: ScenePath[] = rendered.map((p, i) => ({
    ...p,
    // Player-driven strokes reveal as the player runs them, so their progress
    // has to be seam-aware for the token to stay on the tip of its own line.
    // Flights are not part of a movement chain and keep the plain curve.
    progress: animActive
      ? PLAYER_DRIVEN.has(p.type) && p.tokenId
        ? progressAt(drivenByToken.get(p.tokenId)!, paths[i], opts.tMs)
        : pathEased(paths[i], opts.tMs)
      : 1,
  }))

  const ball = ballStateAt(
    paths,
    tokenPositions,
    opts.ballStartId,
    opts.tMs,
    animActive,
    flightWarps,
    tokens,
  )

  return { tokenPositions, paths: out, ball }
}

// ---------------------------------------------------------------------------
// Dynamic view fitting — exports zoom to the play content, not the whole field
// ---------------------------------------------------------------------------

export interface ViewRect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Bounding box covering the whole play (rest positions + sampled animation
 * extremes), padded, with a minimum span so small plays don't over-zoom.
 */
export function fitView(
  tokens: Token[],
  paths: PlayPath[],
  opts: SceneOpts,
  pad = 5,
  minSpan = 20,
  textNotes: TextNote[] = [],
): ViewRect {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (x: number, y: number): void => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  for (const t of tokens) consider(t.x, t.y)
  for (const n of textNotes) consider(n.x, n.y)

  if (paths.length > 0) {
    const D = timelineDuration(paths)
    const steps = 14
    for (let i = 0; i <= steps; i++) {
      const sc = computeScene(tokens, paths, {
        tMs: (D * i) / steps,
        playing: true,
        ballStartId: opts.ballStartId,
      })
      for (const pos of sc.tokenPositions.values()) consider(pos.x, pos.y)
      for (const p of sc.paths) {
        if (p.progress <= 0.001) continue
        for (const pt of p.points) consider(pt.x, pt.y)
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 55, w: 53.3, h: 45 }
  }

  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  let w = maxX - minX
  let h = maxY - minY
  if (w < minSpan) {
    const c = (minX + maxX) / 2
    minX = c - minSpan / 2
    w = minSpan
  }
  if (h < minSpan) {
    const c = (minY + maxY) / 2
    minY = c - minSpan / 2
    h = minSpan
  }

  return { x: minX, y: minY, w, h }
}
