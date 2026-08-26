import { describe, expect, it } from 'vitest'
import { computeScene, fitView } from '../src/lib/render'
import { applySchedule } from '../src/lib/timing'
import type { PlayPath, Token } from '../src/stores/editorStore'

const P = (
  id: string,
  tokenId: string | null,
  endTokenId: string | null,
  type: PlayPath['type'],
  seg: [number, number][],
): PlayPath => ({
  id,
  tokenId,
  endTokenId,
  type,
  timing: { delayMs: 0, durationMs: 600 },
  points: seg.map(([x, y]) => ({ x, y })),
  d: '',
})
const tok = (id: string, pos: Token['pos'], x: number, y: number): Token =>
  ({ id, side: 'offense', pos, num: '', x, y })

describe('computeScene', () => {
  it('idle editing renders everything fully drawn (progress 1)', () => {
    const tokens = [tok('QB', 'QB', 26.5, 93), tok('WR', 'WR', 12, 88)]
    const paths = applySchedule([
      P('slant', 'WR', null, 'route', [[12, 88], [16, 80]]),
      P('pass', 'QB', 'WR', 'pass', [[26.5, 92.4], [15.6, 79.6]]),
    ])
    const scene = computeScene(tokens, paths, { tMs: 0, playing: false, ballStartId: null })
    for (const sp of scene.paths) expect(sp.progress).toBe(1)
    // ball sits with the default holder (snap origin → C absent → QB)
    expect(scene.ball).not.toBeNull()
  })

  it('flights are invisible before launch and self-draw after (progress gating)', () => {
    const tokens = [tok('C', 'C', 26.5, 88), tok('QB', 'QB', 26.5, 92), tok('WR', 'WR', 12, 80)]
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 88], [26.5, 91.8]]),
      P('slant', 'WR', null, 'route', [[12, 79.5], [16, 71]]),
      P('pass', 'QB', 'WR', 'pass', [[26.4, 91.9], [15.7, 70.8]]),
    ])
    const [, , pass] = paths
    const pre = computeScene(tokens, paths, { tMs: Math.max(0, pass.timing.delayMs - 100), playing: true, ballStartId: null })
    const prePass = pre.paths.find((p) => p.id === 'pass')!
    expect(prePass.progress).toBe(0)

    const midT = pass.timing.delayMs + Math.round(pass.timing.durationMs / 2)
    const mid = computeScene(tokens, paths, { tMs: midT, playing: true, ballStartId: null })
    const midPass = mid.paths.find((p) => p.id === 'pass')!
    expect(midPass.progress).toBeGreaterThan(0.3)
    expect(midPass.progress).toBeLessThan(0.7)
  })

  it('REGRESSION: straight-pass warp endpoints stay frozen at release/catch instants', () => {
    const tokens = [
      tok('C', 'C', 26.5, 90),
      tok('QB', 'QB', 26.5, 95),
      tok('WR', 'WR', 40, 88),
    ]
    const paths = applySchedule([
      P('drop', 'QB', null, 'drop', [[26.5, 95.2], [25, 91], [24.5, 88.5]]),
      P('curl', 'WR', null, 'route', [[40, 87.5], [38.5, 82], [43, 78]]),
      P('pass', 'QB', 'WR', 'pass', [[24.5, 88.3], [42.7, 78.2]]),
    ])
    const [drop, curl, pass] = paths
    const launch = pass.timing.delayMs
    const arrival = launch + pass.timing.durationMs

    const at = (t: number) => {
      const scene = computeScene(tokens, paths, { tMs: t, playing: true, ballStartId: null })
      return scene.paths.find((p) => p.id === 'pass')!
    }
    const early = at(launch + 30)
    const late = at(arrival - 30)

    // FROZEN: geometry identical across the whole flight (never chases players)
    expect(late.points).toEqual(early.points)
    // anchored near the thrower's rollout end and the WR's route tip
    const dropEnd = drop.points[drop.points.length - 1]
    const curlTip = curl.points[curl.points.length - 1]
    expect(Math.hypot(early.points[0].x - dropEnd.x, early.points[0].y - dropEnd.y)).toBeLessThan(0.3)
    const passEndPt = early.points[early.points.length - 1]
    expect(Math.hypot(passEndPt.x - curlTip.x, passEndPt.y - curlTip.y)).toBeLessThan(2.5)
    // and the arc is a STRAIGHT line (passes only ever have 2 control points)
    expect(early.points).toHaveLength(2)
  })

  it('run-play chain: RB follows approach then run lane, positions continuous', () => {
    const tokens = [tok('C', 'C', 26.5, 90), tok('RB', 'RB', 25.8, 94.5)]
    const paths = applySchedule([
      P('approach', 'RB', null, 'route', [[25.8, 94], [25.9, 91.6]]),
      P('handoff', 'QB', 'RB', 'handoff', [[26.4, 92.8], [25.95, 91.4]]),
      P('runlane', 'RB', null, 'run', [[25.95, 91.4], [25.4, 80], [25, 70]]),
    ])
    const [, handoff] = paths
    const arrival = handoff.timing.delayMs + handoff.timing.durationMs
    const duringApproach = computeScene(tokens, paths, {
      tMs: approachMid(paths[0]),
      playing: true,
      ballStartId: null,
    })
    const rbDuring = duringApproach.tokenPositions.get('RB')!
    expect(rbDuring.y).toBeLessThan(94) // moving up toward the LOS
    expect(rbDuring.y).toBeGreaterThan(90.5)

    const afterHandoff = computeScene(tokens, paths, { tMs: arrival + 1500, playing: true, ballStartId: null })
    const rbAfter = afterHandoff.tokenPositions.get('RB')!
    // off the approach tip and downfield into the run lane
    expect(rbAfter.y).toBeLessThan(90)
    const deepT = computeScene(tokens, paths, { tMs: arrival + 2500, playing: true, ballStartId: null })
    expect(deepT.tokenPositions.get('RB')!.y).toBeLessThan(86)
  })
})

function approachMid(p: PlayPath): number {
  return p.timing.delayMs + Math.round(p.timing.durationMs / 2)
}

describe('fitView (dynamic export framing)', () => {
  it('frames content with padding, honoring min span', () => {
    const tokens = [tok('WR', 'WR', 20, 80)]
    const paths = [P('r', 'WR', null, 'route', [[20, 79], [22, 74]])]
    const v = fitView(tokens, paths, { tMs: 0, playing: false, ballStartId: null })
    expect(v.w).toBeGreaterThanOrEqual(20)
    expect(v.h).toBeGreaterThanOrEqual(20)
    // contains the token and route tip with padding
    expect(v.x).toBeLessThanOrEqual(20 - 4)
    expect(v.y + v.h).toBeGreaterThanOrEqual(74 + 4)
  })

  it('covers motion extremes across the timeline (video framing)', () => {
    // QB motions far left; deep route to the right
    const tokens = [
      tok('QB', 'QB', 26.5, 95),
      tok('WR', 'WR', 30, 88),
      tok('WR2', 'WR', 45, 88),
    ]
    const paths = applySchedule([
      P('m', 'QB', null, 'motion', [[26.5, 94.5], [12, 93]]),
      P('deep', 'WR2', null, 'route', [[44.8, 87.5], [46, 72]]),
      P('pass', 'QB', 'WR2', 'pass', [[13, 92.6], [45.4, 71.8]]),
    ])
    const v = fitView(tokens, paths, { tMs: 0, playing: true, ballStartId: null })
    expect(v.x).toBeLessThanOrEqual(11)          // covers motion extent
    expect(v.y + v.h).toBeGreaterThanOrEqual(70) // covers deep route tip
  })
})
