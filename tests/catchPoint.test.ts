import { describe, expect, it } from 'vitest'
import { catchMoment, type CatchSample } from '../src/lib/catchPoint'

/**
 * All expectations below are hand-computed against the line equations noted
 * per case, so a change in scoring shows up as a real disagreement rather than
 * a reshuffled fixture.
 */

const at = (tMs: number, x: number, y: number): CatchSample => ({ tMs, pos: { x, y } })
const LINE = (ax: number, ay: number, bx: number, by: number) =>
  [{ x: ax, y: ay }, { x: bx, y: by }] as [{ x: number; y: number }, { x: number; y: number }]

describe('catchMoment — ordinary geometry', () => {
  // line (26,92)->(30,88) is x + y = 118, so distance is |x+y-118|/√2
  const line = LINE(26, 92, 30, 88)

  it('prefers the on-target sample nearest the aim point', () => {
    // (26,88) is 2.83yd off — outside the 2yd magnet
    // (28,88) is 1.41yd off — on target
    // (30,88) is 0yd off and is the aim point itself
    const m = catchMoment(line, [at(0, 26, 88), at(400, 28, 88), at(800, 30, 88)])!
    expect(m.tMs).toBe(800)
    expect(m.offLine).toBeCloseTo(0, 6)
  })

  it('returns the receiver position as the catch point', () => {
    const m = catchMoment(line, [at(0, 26, 88), at(400, 28, 88), at(800, 30, 88)])!
    expect(m.point).toEqual({ x: 30, y: 88 })
  })

  it('falls back to the closest approach when nothing is on target', () => {
    // horizontal line y=0 spanning x 0..100, so these all fall within its span
    // and their distances are simply 5, 3 and 4 yards — best is the middle one
    const flat = LINE(0, 0, 100, 0)
    const m = catchMoment(flat, [at(0, 20, 5), at(400, 40, 3), at(800, 60, 4)])!
    expect(m.tMs).toBe(400)
    expect(m.offLine).toBeCloseTo(3, 6)
  })

  it('measures to the segment end, not the infinite line', () => {
    // both samples sit past the far end of the segment, so each is scored
    // against the endpoint (30,88): sqrt(25+256)=16.76 then sqrt(100+196)=17.2
    const m = catchMoment(line, [at(0, 35, 72), at(400, 40, 74)])!
    expect(m.tMs).toBe(0)
    expect(m.offLine).toBeCloseTo(16.76, 1)
  })

  it('returns null with no samples', () => {
    expect(catchMoment(line, [])).toBeNull()
  })

  it('handles a degenerate zero-length line rather than throwing', () => {
    // a zero-length line measures distance to the point itself: 2yd then 3yd
    const m = catchMoment(LINE(26, 92, 26, 92), [at(0, 26, 90), at(400, 26, 95)])!
    expect(m.tMs).toBe(0)
    expect(m.offLine).toBeCloseTo(2, 6)
  })
})

describe('catchMoment — collinear toss and run', () => {
  // A toss drawn straight down at a runner who runs straight down. Both
  // geometries sit on x=26, so the receiver is at distance 0 for much of his
  // run and only the aim point can say where the coach meant the catch.
  const line = LINE(26, 92, 26, 84)
  const runner = [
    at(0, 26, 88),
    at(400, 26, 86),
    at(800, 26, 84),
    at(1200, 26, 82),
    at(1600, 26, 80),
  ]

  it('catches him where the coach aimed, not at the first sample', () => {
    // aim is (26,84); aim gaps run 4, 2, 0, 2 — and (26,80) falls off the
    // segment entirely, 4yd past its end
    expect(catchMoment(line, runner)!.tMs).toBe(800)
  })

  it('is unaffected by floating-point jitter in the distance', () => {
    const jittered = runner.map((s, i) => at(s.tMs, s.pos.x + i * 1e-13, s.pos.y))
    expect(catchMoment(line, jittered)!.tMs).toBe(800)
  })

  it('never returns the very start when a later sample is a better match', () => {
    const m = catchMoment(line, runner)!
    expect(m.tMs).toBeGreaterThan(runner[0].tMs)
  })
})

describe('catchMoment — release time', () => {
  const line = LINE(26, 92, 26, 88)

  it('never picks a moment before the ball is released', () => {
    const m = catchMoment(line, [at(0, 26, 88), at(300, 26, 87), at(600, 26, 86)], {
      notBeforeMs: 500,
    })!
    expect(m.tMs).toBe(600)
  })

  it('returns null when every sample predates release', () => {
    expect(
      catchMoment(line, [at(0, 26, 88), at(300, 26, 87)], { notBeforeMs: 500 }),
    ).toBeNull()
  })
})

describe('catchMoment — a receiver who has not moved', () => {
  const line = LINE(26, 92, 30, 88)

  it('catches him the moment the ball is out, not after a full flight', () => {
    // he is standing on the aim point at every sample, so the earliest wins
    const samples = [at(0, 30, 88), at(200, 30, 88), at(400, 30, 88)]
    const m = catchMoment(line, samples)!
    expect(m.tMs).toBe(0)
    expect(m.offLine).toBeCloseTo(0, 6)
  })
})

describe('catchMoment — tolerance', () => {
  const line = LINE(26, 92, 26, 80)

  it('uses the magnet radius by default', () => {
    // 1.5yd is inside the 2yd magnet, 5yd is outside
    expect(catchMoment(line, [at(0, 27.5, 86), at(400, 31, 86)])!.tMs).toBe(0)
  })

  it('ignores a nearer-aiming sample that is off target', () => {
    // 6yd then 5yd — both outside the magnet, so it is a plain closest-approach
    expect(catchMoment(line, [at(0, 32, 86), at(400, 31, 86)])!.tMs).toBe(400)
  })

  it('honours an explicit tolerance', () => {
    // with an 8yd magnet both count, so aim proximity decides again:
    // aim (26,80) gives gaps 7.81 and 8.49
    expect(catchMoment(line, [at(0, 31, 86), at(400, 32, 86)], { toleranceYd: 8 })!.tMs).toBe(0)
  })
})