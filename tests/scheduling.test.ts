import { describe, expect, it } from 'vitest'
import { applySchedule, timelineDuration } from '../src/lib/timing'
import type { PlayPath } from '../src/stores/editorStore'

const P = (
  id: string,
  tokenId: string | null,
  endTokenId: string | null,
  type: PlayPath['type'],
  seg: [number, number][],
  extra: Partial<PlayPath> = {},
): PlayPath => ({
  id,
  tokenId,
  endTokenId,
  type,
  timing: { delayMs: 0, durationMs: 600 },
  points: seg.map(([x, y]) => ({ x, y })),
  d: '',
  ...extra,
})
const endOf = (p: PlayPath) => p.timing.delayMs + p.timing.durationMs

describe('pass sync', () => {
  it('arrives exactly at the connected route end (no motion)', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('slant', 'WR', null, 'route', [[12, 88], [15, 83], [18, 79]]),
      P('pass', 'QB', 'WR', 'pass', [[26.4, 92.4], [22, 88], [17.6, 78.8]]),
    ])
    const [, slant, pass] = paths
    expect(endOf(pass)).toBe(endOf(slant))
  })

  it('receiver motion is pre-snap and never a receiving window', () => {
    const paths = applySchedule([
      P('wrMotion', 'WR', null, 'motion', [[12, 88], [16, 85.5]]),
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('slant', 'WR', null, 'route', [[16, 85], [20, 80], [23, 77]]),
      P('pass', 'QB', 'WR', 'pass', [[26.4, 92.4], [24, 84], [22.7, 77.4]]),
    ])
    const [wm, snap, slant, pass] = paths
    expect(endOf(wm)).toBeLessThanOrEqual(snap.timing.delayMs + 1)
    expect(slant.timing.delayMs).toBeGreaterThanOrEqual(endOf(snap) - 1)
    expect(endOf(pass)).toBe(endOf(slant))
  })

  it('pass duration ≈ 40% of the connected route duration', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('slant', 'WR', null, 'route', [[12, 88], [15, 83], [18, 79]]),
      P('post', 'WR2', null, 'route', [[41, 88], [42, 80], [45, 73]]),
      P('pass', 'QB', 'WR', 'pass', [[26.4, 92.4], [22, 88], [17.7, 78.7]]),
    ])
    const [, slant, , pass] = paths
    const want = Math.round(slant.timing.durationMs * 0.4)
    expect(Math.abs(pass.timing.durationMs - want)).toBeLessThanOrEqual(30)
    expect(Math.abs(endOf(pass) - endOf(slant))).toBeLessThanOrEqual(1)
  })
})

describe('thrower readiness', () => {
  it('stationary thrower releases after the post-snap hitch', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('slant', 'WR', null, 'route', [[12, 88], [15, 83], [18, 79]]),
      P('pass', 'QB', 'WR', 'pass', [[26.4, 92.4], [22, 88], [17.6, 78.8]]),
    ])
    const [snap, , pass] = paths
    expect(pass.timing.delayMs).toBeGreaterThanOrEqual(endOf(snap) + 550 - 1)
  })

  it('rollout gates the release; arrival still lands after the break', () => {
    const paths = applySchedule([
      P('rollout', 'QB', null, 'drop', [[26.5, 93], [21, 90], [18, 88]]),
      P('curl', 'WR', null, 'route', [[40, 88], [39, 82], [43, 78]]),
      P('pass', 'QB', 'WR', 'pass', [[18, 87.8], [29, 82], [42.8, 77.8]]),
    ])
    const [roll, curl, pass] = paths
    expect(pass.timing.delayMs).toBeGreaterThanOrEqual(endOf(roll) - 100 - 1)
    expect(endOf(pass)).toBeGreaterThanOrEqual(endOf(curl))
  })

  it('dropback: snap → slow drop → gated pass', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('drop', 'QB', null, 'drop', [[26.5, 95.2], [26.2, 91], [26, 88.5]]),
      P('curl', 'WR', null, 'route', [[40, 88], [38, 74], [41, 70], [44.5, 72.5]]),
      P('pass', 'QB', 'WR', 'pass', [[26, 79.3], [34, 74], [43, 71]]),
    ])
    const [snap, drop, , pass] = paths
    expect(snap.timing.delayMs).toBe(0)
    expect(drop.timing.delayMs).toBeGreaterThanOrEqual(endOf(snap) - 1)
    // drop is slower than route speed
    expect(drop.timing.durationMs).toBeGreaterThan(
      Math.round((polylineLen(drop.points) / 6) * 1000),
    )
    expect(pass.timing.delayMs).toBeGreaterThanOrEqual(endOf(drop) - 100 - 1)
    expect(pass.timing.delayMs).toBeGreaterThanOrEqual(snap.timing.delayMs)
  })
})

describe('motion phase', () => {
  it('late-drawn motion still plays before the snap', () => {
    const paths = applySchedule([
      P('slant', 'WR', null, 'route', [[12, 88], [16, 80]]),
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('motion', 'WR', null, 'motion', [[12, 88], [15, 85.5]]),
    ])
    const [slant, snap, motion] = paths
    expect(endOf(motion)).toBeLessThanOrEqual(snap.timing.delayMs + 1)
    expect(slant.timing.delayMs).toBeGreaterThanOrEqual(endOf(snap) - 1)
  })

  it('jet motion (snap at 50%) overlaps snap — fake handoff', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('jet', 'WR', null, 'motion', [[30, 88], [22, 88]], { motionSnapAt: 0.5 }),
      P('route', 'WR2', null, 'route', [[12, 88], [16, 80]]),
    ])
    const [snap, jet, route] = paths
    expect(jet.timing.delayMs).toBe(0)
    expect(snap.timing.delayMs).toBeGreaterThan(jet.timing.delayMs)
    expect(snap.timing.delayMs).toBeLessThan(endOf(jet) - 1)
    expect(route.timing.delayMs).toBeGreaterThanOrEqual(endOf(snap) - 1)
    expect(route.timing.delayMs).toBeLessThan(endOf(jet))
  })
})

describe('handoff chains', () => {
  it('handoff fires immediately after the snap (synced with blocks)', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('blkTE', 'TE1', null, 'block', [[20.6, 89.6], [21.2, 88]]),
      P('blkRT', 'RT', null, 'block', [[30.1, 89.7], [29.6, 88.2]]),
      P('approach', 'RB', null, 'route', [[25.8, 94], [25.9, 91.6]]),
      P('handoff', 'QB', 'RB', 'handoff', [[26.4, 92.8], [25.95, 91.4]]),
      P('runlane', 'RB', null, 'run', [[25.95, 91.4], [25.4, 80], [25, 70]]),
    ])
    const [snap, , , , handoff, runlane] = paths
    const snapEnd = endOf(snap)
    expect(handoff.timing.delayMs).toBe(snapEnd)
    expect(runlane.timing.delayMs).toBeGreaterThanOrEqual(endOf(handoff) - 1)
  })

  it('toss fires right after the snap; run waits for possession', () => {
    const paths = applySchedule([
      P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
      P('sweep', 'RB', null, 'route', [[25.5, 94], [28, 92.5], [32, 90.8]]),
      P('toss', 'QB', 'RB', 'toss', [[26.4, 92.4], [29.5, 91.2], [31.6, 90.9]]),
      P('runlane', 'RB', null, 'run', [[32, 90.7], [34, 82], [35.5, 72]]),
    ])
    const [snap, , toss, runlane] = paths
    expect(toss.timing.delayMs).toBe(endOf(snap))
    expect(runlane.timing.delayMs).toBeGreaterThanOrEqual(endOf(toss) - 1)
  })
})

describe('locked timings & floor', () => {
  it('locked paths keep hand-tuned timing while others reschedule', () => {
    const paths = applySchedule([
      P('slant', 'WR1', null, 'route', [[12, 88], [15, 83], [18, 79]]),
      P(
        'slantLock',
        'WR1',
        null,
        'route',
        [[12, 88], [15, 83], [18, 79]],
        { userLocked: true, timing: { delayMs: 1000, durationMs: 800 } },
      ),
      P('flat', 'WR2', null, 'route', [[41, 88], [46, 87]]),
    ])
    const after = applySchedule([
      ...paths,
      P('post', 'WR2', null, 'route', [[41, 88], [42, 80], [45, 74]]),
    ])
    const locked = after.find((p) => p.id === 'slantLock')!
    expect(locked.timing).toEqual({ delayMs: 1000, durationMs: 800 })
    expect(locked.userLocked).toBe(true)
  })

  it('timeline floor is 1500ms', () => {
    const short = [
      P('block', 'LT', null, 'block', [[21.5, 89], [22.3, 87]]),
    ]
    expect(timelineDuration(short)).toBe(1500)
  })
})

function polylineLen(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  }
  return len
}

describe('run-play sequencing is draw-order independent', () => {
  const mkPlay = () => [
    P('snap', 'C', 'QB', 'snap', [[26.5, 90], [26.5, 92.6]]),
    P('blkTE', 'TE', 'DL1', 'block', [[20.6, 89.6], [21.2, 88]]),
    P('blkRT', 'RT', null, 'block', [[30.1, 89.7], [29.6, 88.2]]),
    P('approach', 'RB', null, 'route', [[25.8, 94], [25.9, 91.6]]),
    P('handoff', 'QB', 'RB', 'handoff', [[26.4, 92.8], [25.95, 91.4]]),
    P('runlane', 'RB', null, 'run', [[25.95, 91.4], [25.4, 80], [25, 70]]),
  ]
  const orders: string[][] = [
    ['snap', 'blkTE', 'blkRT', 'approach', 'handoff', 'runlane'],
    ['handoff', 'runlane', 'approach', 'blkTE', 'blkRT', 'snap'],
    ['runlane', 'snap', 'blkRT', 'handoff', 'approach', 'blkTE'],
    ['approach', 'blkTE', 'handoff', 'snap', 'runlane', 'blkRT'],
  ]

  it('handoff launch is snapEnd and blocks never shift — any draw order', () => {
    for (const order of orders) {
      const byId = new Map(mkPlay().map((p) => [p.id, p]))
      const ordered = order.map((id) => ({ ...byId.get(id)!, id }))
      const sched = applySchedule(ordered)
      const snapEnd = endOf(sched.find((p) => p.id === 'snap')!)
      for (const id of ['blkTE', 'blkRT']) {
        expect(sched.find((p) => p.id === id)!.timing.delayMs, `${order} ${id}`).toBe(snapEnd)
      }
      expect(sched.find((p) => p.id === 'handoff')!.timing.delayMs, `${order} handoff`).toBe(snapEnd)
    }
  })
})