import { pointAtLength, polylineLength, catmullRomPath } from './geometry'
import { pathEased, timelineDuration } from './timing'
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

function chainPosAt(
  list: PlayPath[],
  t: number,
  excludeId?: string,
): Pt | null {
  let active: PlayPath | null = null
  for (const q of list) {
    if (q.id === excludeId || q.points.length < 2) continue
    if (q.timing.delayMs <= t) active = q
  }
  if (!active) return null
  return pointAtLength(active.points, pathEased(active, t) * polylineLength(active.points))
}

/** H1: translate a segment so its start meets where the chain actually has the player */
function bindStartToChain(list: PlayPath[], active: PlayPath): Pt[] {
  const anchorPos = chainPosAt(list, active.timing.delayMs, active.id)
  if (!anchorPos) return active.points
  const dx = anchorPos.x - active.points[0].x
  const dy = anchorPos.y - active.points[0].y
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return active.points
  return active.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
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

  // animated positions for every token this frame
  const tokenPositions = new Map<string, Pt>()
  for (const t of tokens) {
    const list = animActive ? drivenByToken.get(t.id) : undefined
    if (!list || list.length === 0) {
      tokenPositions.set(t.id, { x: t.x, y: t.y })
      continue
    }
    let active: PlayPath | null = null
    for (const q of list) {
      if (q.points.length >= 2 && q.timing.delayMs <= opts.tMs) {
        // prefer the most recently started path — fixes late-drawn motion
        // being picked over the route it precedes (bug #2)
        if (!active || q.timing.delayMs > active.timing.delayMs) active = q
      }
    }
    if (!active) {
      tokenPositions.set(t.id, { x: t.x, y: t.y })
      continue
    }
    const pts = bindStartToChain(list, active)
    tokenPositions.set(t.id, pointAtLength(pts, pathEased(active, opts.tMs) * polylineLength(pts)))
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

      if (f.tokenId) {
        const list = drivenByToken.get(f.tokenId)
        if (list && list.length > 0) {
          const evalAt = f.timing.delayMs
          const pos = chainPosAt(list, evalAt)
          if (pos) {
            sx = pos.x - f.points[0].x
            sy = pos.y - f.points[0].y
          }
        }
      }
      if (f.endTokenId) {
        const list2 = drivenByToken.get(f.endTokenId)
        if (list2 && list2.length > 0) {
          const arrival = f.timing.delayMs + f.timing.durationMs
          const evalAt = arrival
          const pos = chainPosAt(list2, evalAt)
          if (pos) {
            ex = pos.x - f.points[n - 1].x
            ey = pos.y - f.points[n - 1].y
          }
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
    progress: animActive ? pathEased(paths[i], opts.tMs) : 1,
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
