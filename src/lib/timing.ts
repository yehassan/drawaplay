import { polylineLength } from './geometry'
import type { PlayPath } from '../stores/editorStore'
import { PLAYER_DRIVEN, type PathType } from './pathStyles'

export interface Timing {
  delayMs: number
  durationMs: number
}

/** WR-ish route speed */
export const ROUTE_SPEED_YD_S = 6
/** QB drop/rollout — deliberate, slower */
export const DROP_SPEED_YD_S = 2.4
/** ball-carrier run speed */
export const RUN_SPEED_YD_S = 5.5
/** ball flight on passes/tosses/snaps (used when there is no route to sync to) */
export const BALL_SPEED_YD_S = 14
export const MIN_DURATION_MS = 300
/** longest a thrown ball stays airborne when waiting for a deep route */
export const FLIGHT_MAX_MS = 1800
/** handoff/toss exchange length, fired immediately after the snap */
export const EXCHANGE_MS = 450
/** post-snap beat before a stationary thrower releases */
export const RELEASE_HITCH_MS = 550

function naturalDuration(type: PathType, lenYd: number): number {
  const speed =
    type === 'drop'
      ? DROP_SPEED_YD_S
      : type === 'run'
        ? RUN_SPEED_YD_S
        : type === 'pass' || type === 'handoff' || type === 'toss' || type === 'snap'
          ? BALL_SPEED_YD_S
          : ROUTE_SPEED_YD_S
  return Math.max(MIN_DURATION_MS, Math.round((lenYd / speed) * 1000))
}

const isFlight = (t: PathType): boolean => t === 'pass' || t === 'handoff' || t === 'toss' || t === 'snap'

/**
 * Dependency-aware schedule for the whole play:
 *
 *   motion (pre-snap) → snap → drops / routes / blocks → flights
 *
 * Pass timing rule: if the pass is drawn to a player who has a route, the ball
 * ARRIVES exactly as that route completes. Launch happens as early as the
 * thrower is ready, capped so balls don't hang absurdly — which means flight
 * velocity varies per pass (short quick outs fly fast, deep balls float).
 * Handoffs/snaps instead must COMPLETE before their receiver starts moving.
 */
export function reschedule(paths: PlayPath[]): Map<string, Timing> {
  const result = new Map<string, Timing>()
  // L4: user-locked timings are fixed constraints — preserved verbatim, and
  // every other rule still reads them as inputs
  // flight timing is derived from football logic — never locked, even if a
  // stale flag lingers in an in-memory doc
  const lockedIds = new Set(
    paths.filter((p) => p.userLocked && !isFlight(p.type)).map((p) => p.id),
  )
  for (const p of paths) {
    result.set(
      p.id,
      lockedIds.has(p.id)
        ? { ...p.timing }
        : { delayMs: 0, durationMs: naturalDuration(p.type, polylineLength(p.points)) },
    )
  }
  if (paths.length === 0) return result

  const assign = (id: string, t: Timing) => {
    if (!lockedIds.has(id)) result.set(id, t)
  }

  const end = (id: string): number => {
    const t = result.get(id)
    return t ? t.delayMs + t.durationMs : 0
  }

  const motions = () => paths.filter((p) => p.type === 'motion')
  const snaps = () => paths.filter((p) => p.type === 'snap')

  // iterate so chains (motion → snap → drop → pass) settle
  for (let iter = 0; iter < 3; iter++) {
    // 1. motion: adjustable snap point — 1.0 = stop before snap, <1 = jet through snap
    let mEnd = 0
    let snapAt = 0
    for (const m of motions()) {
      const cur = result.get(m.id)!
      const delayMs = Math.max(0, mEnd)
      assign(m.id, { ...cur, delayMs })
      const dur = result.get(m.id)!.durationMs
      const at = (m as PlayPath & { motionSnapAt?: number }).motionSnapAt ?? 1
      const snapPoint = delayMs + dur * Math.max(0.1, Math.min(1, at))
      snapAt = Math.max(snapAt, snapPoint)
      mEnd = delayMs + dur
    }
    const motionSnapAt = snapAt
    for (const s of snaps()) assign(s.id, { ...result.get(s.id)!, delayMs: motionSnapAt })
    const snapEnd = Math.max(motionSnapAt, ...snaps().map((s) => end(s.id)))

    // 3. everyone else starts when the snap completes
    for (const p of paths) {
      if (p.type === 'motion' || p.type === 'snap') continue
      assign(p.id, { ...result.get(p.id)!, delayMs: snapEnd })
    }

    // 3.5 a player chains their own movements in draw order
    const lastEndByToken = new Map<string, number>()
    for (const p of paths) {
      // motion lives in the pre-snap phase — never chained after other moves
      if (!PLAYER_DRIVEN.has(p.type) || p.type === 'motion') continue
      const cur = result.get(p.id)!
      const prevEnd = lastEndByToken.get(p.tokenId ?? '') ?? 0
      const delayMs = Math.max(cur.delayMs, prevEnd)
      assign(p.id, { ...cur, delayMs })
      if (p.tokenId) lastEndByToken.set(p.tokenId, delayMs + cur.durationMs)
    }

    // 4. passes & handoffs chain off their thrower's readiness and target routes
    for (const f of paths) {
      if (f.type !== 'pass' && f.type !== 'handoff' && f.type !== 'toss') continue

      // a thrower with his own movement (drop/rollout) releases when that ends;
      // a stationary PASSER takes a post-snap hitch. Handoffs/tosses are part of
      // snap cadence — they start WITH the line's fire-off, never after it.
      const hasOwnMove = paths.some(
        (q) => q.tokenId === f.tokenId && q.id !== f.id && !isFlight(q.type),
      )
      const needsHitch = f.type === 'pass'
      let ready = snapEnd + (hasOwnMove || !needsHitch ? 0 : RELEASE_HITCH_MS)
      for (const q of paths) {
        if (q.tokenId === f.tokenId && q.id !== f.id && !isFlight(q.type)) {
          ready = Math.max(ready, end(q.id) - 100)
        }
      }

      if (f.type === 'pass' && f.endTokenId) {
        let targetEnd = Infinity
        let targetRouteDur = 0
        // receiving window = the target's FIRST post-snap move (draw order)
        for (const q of paths) {
          if (
            q.tokenId === f.endTokenId &&
            !isFlight(q.type) &&
            q.type !== 'motion'
          ) {
            targetEnd = end(q.id)
            targetRouteDur = result.get(q.id)!.durationMs
            break
          }
        }
        if (targetEnd !== Infinity && targetEnd > 0) {
          // Ball arrives exactly when the connected route completes, flying for
          // ~40% of that route's duration — long enough to read as a real
          // throw, never a slow float across the whole window.
          let dur = Math.round(targetRouteDur * 0.4)
          if (f.passTrajectory === 'touch') dur = Math.round(dur / 0.85)
          dur = Math.max(MIN_DURATION_MS, Math.min(FLIGHT_MAX_MS, dur))
          let launchAt = targetEnd - dur
          if (launchAt < ready) {
            // thrower wasn't ready in time — hold and compress the flight
            launchAt = ready
            dur = Math.max(MIN_DURATION_MS, targetEnd - launchAt)
          }
          assign(f.id, {
            delayMs: Math.max(0, launchAt),
            durationMs: Math.max(MIN_DURATION_MS, dur),
          })
          continue
        }
      }

      if (f.type === 'handoff' || f.type === 'toss') {
        // a fixed quick exchange, fired immediately after the snap — synced
        // with the line's fire-off, never gated by it or by other moves
        assign(f.id, { ...result.get(f.id)!, delayMs: ready, durationMs: EXCHANGE_MS })
        continue
      }

      assign(f.id, { ...result.get(f.id)!, delayMs: ready })
    }

    // 5. possession gating: once a delivery (handoff/toss/snap) completes at
    //    `arr`, every move of the receiver starts at/after it — EXCEPT the one
    //    move that feeds the exchange (its end nearest `arr`, e.g., the RB's
    //    step toward the LOS). Distance-based, so draw order never matters.
    for (const f of paths) {
      if (f.type !== 'handoff' && f.type !== 'toss' && f.type !== 'snap') continue
      if (!f.endTokenId || f.points.length < 2) continue
      const arr = end(f.id)
      const sibs = paths.filter(
        (q) =>
          q.tokenId === f.endTokenId &&
          !isFlight(q.type) &&
          q.type !== 'motion' &&
          q.points.length >= 2,
      )
      let feeder: string | null = null
      let bestGap = Infinity
      for (const q of sibs) {
        const e = end(q.id)
        const gap = Math.abs(e - arr)
        if (gap < bestGap) {
          bestGap = gap
          feeder = q.id
        }
      }
      for (const q of sibs) {
        if (q.id === feeder) continue
        const cur = result.get(q.id)!
        if (cur.delayMs < arr) assign(q.id, { ...cur, delayMs: arr })
      }
    }
  }

  return result
}

export function applySchedule(paths: PlayPath[]): PlayPath[] {
  const sched = reschedule(paths)
  return paths.map((p) => ({ ...p, timing: sched.get(p.id)! }))
}

export function pathProgress(p: PlayPath, tMs: number): number {
  const raw = (tMs - p.timing.delayMs) / p.timing.durationMs
  return Math.min(1, Math.max(0, raw))
}

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

export function timelineDuration(paths: PlayPath[]): number {
  return Math.max(1500, ...paths.map((p) => p.timing.delayMs + p.timing.durationMs), 1)
}
