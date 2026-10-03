import { describe, expect, it } from 'vitest'
import { reschedule } from '../src/lib/timing'
import { computeScene } from '../src/lib/render'
import { pathEased } from '../src/lib/easing'
import { pointAtLength, polylineLength } from '../src/lib/geometry'
import { SCENARIOS } from '../src/lib/scenarios'
import { PLAYER_DRIVEN } from '../src/lib/pathStyles'
import type { PlayPath, Token } from '../src/stores/editorStore'

/**
 * A player receiving the ball and continuing into a run lane used to come to a
 * DEAD STOP at the seam: every movement's easing ramps up from zero at its
 * start and back down to zero at its end, so where two of a player's chained
 * movements met, both curves were at zero. Measured at the catch, 3.2% of
 * plateau speed for 48ms and under half speed for 240ms.
 *
 * The ramps are now lifted where movements actually touch. These tests pin
 * that, and — more importantly — pin the two ways it could regress into
 * something worse: bridging a movement that should still ease to a stop, or
 * accelerating across a real gap.
 */

const DT = 16

const tok = (id: string, pos: string, x: number, y: number): Token => ({
  id, side: 'offense', pos: pos as Token['pos'], num: '', x, y,
})

const P = (
  id: string,
  type: string,
  pts: [number, number][],
  extra: Partial<PlayPath> = {},
): PlayPath => ({
  id, type: type as PlayPath['type'], tokenId: null, endTokenId: null,
  points: pts.map(([x, y]) => ({ x, y })), d: '', timing: { delayMs: 0, durationMs: 600 }, ...extra,
})

/** per-frame speed of one player through [from, to] */
function speedProfile(tokens: Token[], paths: PlayPath[], id: string, from: number, to: number): number[] {
  const pts: { x: number; y: number }[] = []
  for (let t = from; t <= to; t += DT) {
    pts.push(computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get(id)!)
  }
  const out: number[] = []
  for (let i = 1; i < pts.length; i++) out.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return out
}

/** a pass caught on a route, then a run lane off the back of it */
function passThenRunLane() {
  const tokens = [tok('qb', 'QB', 26.65, 93), tok('wr', 'WR', 14, 88)]
  const raw = [
    P('pass', 'pass', [[26.65, 92], [14, 88]], { tokenId: 'qb', endTokenId: 'wr' }),
    P('wrout', 'route', [[14, 88], [14, 78]], { tokenId: 'wr' }),
    P('wrrun', 'run', [[14, 78], [14, 62]], { tokenId: 'wr' }),
  ] as PlayPath[]
  const sched = reschedule(raw)
  return { tokens, paths: raw.map((p) => ({ ...p, timing: sched.get(p.id)! })) }
}

describe('a catch into a run lane does not stop', () => {
  const { tokens, paths } = passThenRunLane()
  const seam = paths.find((p) => p.id === 'wrrun')!.timing.delayMs
  const profile = speedProfile(tokens, paths, 'wr', seam - 400, seam + 400)
  const plateau = Math.max(...profile)
  const slowest = Math.min(...profile)

  it('the run lane begins the instant the route ends', () => {
    const route = paths.find((p) => p.id === 'wrout')!
    expect(paths.find((p) => p.id === 'wrrun')!.timing.delayMs).toBe(
      route.timing.delayMs + route.timing.durationMs,
    )
  })

  it('never drops below 85% of plateau speed through the seam', () => {
    expect(slowest / plateau).toBeGreaterThan(0.85)
  })

  it('spends no measurable time below half speed', () => {
    expect(profile.filter((v) => v < plateau / 2).length * DT).toBe(0)
  })

  it('and no time at a standstill', () => {
    expect(profile.filter((v) => v < plateau * 0.1).length * DT).toBe(0)
  })
})

describe('easing still behaves at the ends of a chain', () => {
  it('a movement with no successor still decelerates to a stop', () => {
    const tokens = [tok('wr', 'WR', 14, 88)]
    // long enough that the near-end samples are still inside the movement —
    // sampling past `durationMs` clamps both points to the tip and the step is
    // zero, which made an earlier version of this assertion divide by zero
    const solo = [
      P('r', 'route', [[14, 88], [14, 78]], { tokenId: 'wr', timing: { delayMs: 0, durationMs: 2000 } }),
    ] as PlayPath[]
    const at = (t: number) =>
      computeScene(tokens, solo, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get('wr')!
    const step = (a: number, b: number) => Math.hypot(at(b).x - at(a).x, at(b).y - at(a).y)
    expect(step(500, 516)).toBeGreaterThan(0)
    // mid-flight vs near the end: must have decayed substantially
    // the ease-out occupies the last 220ms, so sample inside it
    expect(step(500, 516) / step(1960, 1992)).toBeGreaterThan(4)
  })

  it('a movement with no predecessor still accelerates from rest', () => {
    const tokens = [tok('wr', 'WR', 14, 88)]
    const solo = [P('r', 'route', [[14, 88], [14, 78]], { tokenId: 'wr' })] as PlayPath[]
    const at = (t: number) =>
      computeScene(tokens, solo, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get('wr')!
    expect(Math.hypot(at(16).x - at(0).x, at(16).y - at(0).y)).toBeLessThan(
      Math.hypot(at(400).x - at(384).x, at(400).y - at(384).y),
    )
  })

  it('a real gap between movements is NOT bridged', () => {
    // 900ms of dead time between them: lifting the ramps here would make him
    // accelerate and then brake harder than he otherwise would
    const tokens = [tok('wr', 'WR', 14, 88)]
    const gapped = [
      P('a', 'route', [[14, 88], [14, 80]], { tokenId: 'wr', timing: { delayMs: 0, durationMs: 1000 } }),
      P('b', 'route', [[14, 80], [14, 70]], { tokenId: 'wr', timing: { delayMs: 1900, durationMs: 2000 } }),
    ] as PlayPath[]
    const at = (t: number) =>
      computeScene(tokens, gapped, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get('wr')!
    // he is stationary through the gap, and eases back in rather than sprinting
    expect(Math.hypot(at(1400).x - at(1300).x, at(1400).y - at(1300).y)).toBeLessThan(0.01)
    expect(Math.hypot(at(1916).x - at(1900).x, at(1916).y - at(1900).y)).toBeLessThan(
      Math.hypot(at(2300).x - at(2284).x, at(2300).y - at(2284).y),
    )
  })
})

describe('pathEased seam flags', () => {
  const path = P('p', 'route', [[0, 0], [0, 100]], { timing: { delayMs: 0, durationMs: 1000 } })

  it('default keeps both ramps, so it starts slow and ends slow', () => {
    expect(pathEased(path, 16)).toBeLessThan(pathEased(path, 400) / 20)
    expect(pathEased(path, 984) - pathEased(path, 968)).toBeLessThan(
      pathEased(path, 400) - pathEased(path, 384),
    )
  })

  it('easeIn:false starts at full speed', () => {
    expect(pathEased(path, 16, { easeIn: false })).toBeGreaterThan(pathEased(path, 16) * 5)
  })

  it('easeOut:false is still moving at the end', () => {
    // with the ramp the curve is decelerating into 1, so it has already covered
    // more ground by 984ms but is barely advancing; lifted, it is still at pace
    const easedStep = pathEased(path, 1000) - pathEased(path, 984)
    const liftedStep = pathEased(path, 1000, { easeOut: false }) - pathEased(path, 984, { easeOut: false })
    expect(liftedStep).toBeGreaterThan(easedStep * 5)
    expect(pathEased(path, 984, { easeOut: false })).toBeLessThan(0.99)
  })

  it('with both lifted it is linear', () => {
    expect(pathEased(path, 500, { easeIn: false, easeOut: false })).toBeCloseTo(0.5, 2)
  })

  it('never leaves 0..1 for any flag combination', () => {
    for (const t of [0, 1, 16, 220, 500, 780, 984, 1000, 1200]) {
      for (const opts of [{}, { easeIn: false }, { easeOut: false }, { easeIn: false, easeOut: false }]) {
        const v = pathEased(path, t, opts)
        expect(v, `t=${t} ${JSON.stringify(opts)}`).toBeGreaterThanOrEqual(0)
        expect(v, `t=${t} ${JSON.stringify(opts)}`).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('no scenario regresses into a stutter', () => {
  it('every movement seam in every scenario keeps at least 65% of its speed', () => {
    const offenders: string[] = []
    for (const s of SCENARIOS) {
      const b = s.build()
      const seeded = b.paths.map((p, i) => ({
        ...p, id: `f${i}`,
        timing: p.timing ?? { delayMs: 0, durationMs: 600 },
        userLocked: !!p.timing,
      })) as PlayPath[]
      const sched = reschedule(seeded)
      const timed = seeded.map((p) => ({ ...p, timing: sched.get(p.id)! }))
      const at = (t: number, id: string) =>
        computeScene(b.tokens, timed, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get(id)!
      for (const tk of b.tokens) {
        const mv = timed
          .filter((p) => p.tokenId === tk.id && PLAYER_DRIVEN.has(p.type))
          .sort((a, c) => a.timing.delayMs - c.timing.delayMs)
        for (let i = 0; i < mv.length - 1; i++) {
          const seam = mv[i + 1].timing.delayMs
          if (seam <= 200) continue
          const a1 = at(seam - 80, tk.id), a2 = at(seam - 16, tk.id)
          const b1 = at(seam, tk.id), b2 = at(seam + 64, tk.id)
          const pre = Math.hypot(a2.x - a1.x, a2.y - a1.y)
          const post = Math.hypot(b2.x - b1.x, b2.y - b1.y)
          if (pre < 0.02) continue
          if (post / pre < 0.65) offenders.push(`${s.name}/${tk.pos} ${mv[i].type}->${mv[i + 1].type}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
describe('the token stays on the tip of its own drawn stroke', () => {
  /**
   * Catching this: lifting the ramps at a seam moves the TOKEN faster, but the
   * stroke was still revealing on the plain curve — so the player ran 0.6yd
   * ahead of the tip of his own line. Progress and position must come from the
   * same seam-aware number.
   */
  const { tokens, paths } = passThenRunLane()

  it('holds through a catch into a run lane', () => {
    const run = paths.find((p) => p.id === 'wrrun')!
    let worst = 0
    for (let t = run.timing.delayMs - 500; t <= run.timing.delayMs + run.timing.durationMs; t += 25) {
      const sc = computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: 'qb' })
      const tk = sc.tokenPositions.get('wr')!
      const sp = sc.paths.find((p) => p.id === 'wrrun')!
      if (sp.progress <= 0.001 || sp.progress >= 0.999) continue
      const tip = pointAtLength(sp.points, sp.progress * polylineLength(sp.points))
      worst = Math.max(worst, Math.hypot(tip.x - tk.x, tip.y - tk.y))
    }
    expect(worst).toBeLessThan(0.01)
  })

  it('and across every scenario movement', () => {
    let worst = 0
    for (const s of SCENARIOS) {
      const b = s.build()
      const seeded = b.paths.map((p, i) => ({
        ...p, id: `f${i}`,
        timing: p.timing ?? { delayMs: 0, durationMs: 600 },
        userLocked: !!p.timing,
      })) as PlayPath[]
      const sched = reschedule(seeded)
      const timed = seeded.map((p) => ({ ...p, timing: sched.get(p.id)! }))
      const end = Math.max(...timed.map((p) => p.timing.delayMs + p.timing.durationMs))
      for (let t = 0; t <= end; t += 40) {
        const sc = computeScene(b.tokens, timed, { tMs: t, playing: true, ballStartId: null })
        for (const sp of sc.paths) {
          if (!PLAYER_DRIVEN.has(sp.type) || !sp.tokenId) continue
          if (sp.progress <= 0.001 || sp.progress >= 0.999) continue
          const tk = sc.tokenPositions.get(sp.tokenId)
          if (!tk) continue
          const tip = pointAtLength(sp.points, sp.progress * polylineLength(sp.points))
          worst = Math.max(worst, Math.hypot(tip.x - tk.x, tip.y - tk.y))
        }
      }
    }
    // residual is the seam TRANSLATION, which the stroke does not carry
    expect(worst).toBeLessThan(0.25)
  })
})

describe('the last movement of a chain still decelerates', () => {
  /**
   * The seam case where rampIn is 0 and rampOut is not: the movement has a
   * predecessor but no successor. Any expression that divides by rampIn while
   * easing out yields Infinity here, which clamps progress to 0 and freezes the
   * player for the whole deceleration.
   */
  const chain = () => {
    const tokens = [tok('wr', 'WR', 14, 88)]
    const paths = [
      P('a', 'route', [[14, 88], [14, 80]], { tokenId: 'wr', timing: { delayMs: 0, durationMs: 1000 } }),
      P('b', 'route', [[14, 80], [14, 60]], { tokenId: 'wr', timing: { delayMs: 1000, durationMs: 2000 } }),
    ] as PlayPath[]
    return { tokens, paths }
  }

  it('never freezes — every frame before the end advances', () => {
    const { tokens, paths } = chain()
    const at = (t: number) =>
      computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get('wr')!
    for (let t = 1000; t < 3000; t += DT) {
      const step = Math.hypot(at(t).x - at(t - DT).x, at(t).y - at(t - DT).y)
      expect(step, `t=${t}`).toBeGreaterThan(0)
    }
  })

  it('and slows down as it finishes', () => {
    const { tokens, paths } = chain()
    const at = (t: number) =>
      computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: null }).tokenPositions.get('wr')!
    const step = (a: number, b: number) => Math.hypot(at(b).x - at(a).x, at(b).y - at(a).y)
    expect(step(1400, 1416) / step(2960, 2976)).toBeGreaterThan(4)
  })

  it('progress stays strictly increasing through it', () => {
    const { paths } = chain()
    const b = paths[1]
    let prev = -1
    for (let t = 1000; t <= 3000; t += DT) {
      const v = pathEased(b, t, { easeIn: false })
      expect(v, `t=${t}`).toBeGreaterThanOrEqual(prev)
      expect(Number.isFinite(v), `t=${t}`).toBe(true)
      prev = v
    }
    expect(prev).toBeCloseTo(1, 3)
  })
})
