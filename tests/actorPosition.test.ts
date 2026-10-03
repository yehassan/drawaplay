import { describe, expect, it } from 'vitest'
import { renderedPosAt, hasDrivenMovement } from '../src/lib/actorPosition'
import type { PlayPath } from '../src/stores/editorStore'

/**
 * Unit tests for the one function that answers "where is this player at t".
 *
 * The flight-exchange suite can no longer police this on its own: now that the
 * token loop and the ball warp share this function, they agree BY CONSTRUCTION,
 * so an agreement test cannot detect the function being wrong in a way that
 * affects both. Verified by mutation — removing the seam translation or flipping
 * the tie-break both leave the whole exchange suite green. These tests are what
 * catch that.
 */

const P = (
  id: string,
  pts: [number, number][],
  timing: { delayMs: number; durationMs: number },
): PlayPath => ({
  id,
  type: 'route',
  tokenId: 'wr',
  endTokenId: null,
  points: pts.map(([x, y]) => ({ x, y })),
  d: '',
  timing,
})

describe('renderedPosAt — selection', () => {
  it('returns null when nothing has started', () => {
    expect(renderedPosAt([P('a', [[14, 88], [14, 78]], { delayMs: 300, durationMs: 1000 })], 299)).toBeNull()
  })

  it('returns null for an empty list', () => {
    expect(renderedPosAt([], 5000)).toBeNull()
  })

  it('is at the start when a movement begins, and at its end when it finishes', () => {
    const a = P('a', [[14, 88], [14, 78]], { delayMs: 300, durationMs: 1000 })
    expect(renderedPosAt([a], 300)!.y).toBeCloseTo(88, 1)
    expect(renderedPosAt([a], 1300)!.y).toBeCloseTo(78, 1)
  })

  it('picks the most recently started movement, not the longest', () => {
    const motion = P('m', [[14, 88], [14, 92]], { delayMs: 0, durationMs: 400 })
    const route = P('r', [[14, 92], [20, 80]], { delayMs: 500, durationMs: 2000 })
    // inside the route's window the player must be on the route, not still on motion
    const pos = renderedPosAt([motion, route], 1500)!
    expect(pos.x).toBeGreaterThan(14.5)
  })

  it('breaks a delayMs tie by draw order, keeping the earlier path', () => {
    const first = P('first', [[14, 88], [26, 88]], { delayMs: 300, durationMs: 1000 })
    const second = P('second', [[14, 88], [14, 74]], { delayMs: 300, durationMs: 1000 })
    // 'first' runs toward +x, 'second' toward -y. On a tie the earlier entry wins,
    // so at the very start of the window the player must be moving +x, i.e. x > 14.
    const at = 300 + 1000 * 0.5
    expect(renderedPosAt([first, second], at)!.x).toBeGreaterThan(14.5)
    // order matters: reversing the list moves the player the other way
    expect(renderedPosAt([second, first], at)!.y).toBeLessThan(88 - 0.5)
  })
})

describe('renderedPosAt — seam closure', () => {
  it('does NOT translate a first movement; it stays as authored', () => {
    const only = P('solo', [[14, 88.5], [14, 78]], { delayMs: 0, durationMs: 1000 })
    const pos = renderedPosAt([only], 500)!
    expect(pos.x).toBeCloseTo(14, 5)
  })

  it('translates a later movement so it starts where the chain actually is', () => {
    // motion ends at (14, 88) once eased; the route was authored 0.2yd off, so a
    // naive read would place the player 0.2yd to the side of the true chain
    const motion = P('m', [[14, 88], [14, 92]], { delayMs: 0, durationMs: 1000 })
    const route = P('r', [[14.2, 92], [14.2, 82]], { delayMs: 1000, durationMs: 1000 })
    const at = 1001
    const pos = renderedPosAt([motion, route], at)!
    expect(pos.x).toBeCloseTo(14, 1)
  })

  it('closes the seam for a chain of three', () => {
    const a = P('a', [[14, 88], [16, 86]], { delayMs: 0, durationMs: 1000 })
    const b = P('b', [[16, 86.4], [16, 78]], { delayMs: 1000, durationMs: 1000 })
    const c = P('c', [[16, 77.6], [24, 77]], { delayMs: 2000, durationMs: 1000 })
    // b ends at (16, 78); c is authored 0.4yd below that, so a naive read puts
    // the player at 77.6. One frame into c he should already be at 78.
    const pos = renderedPosAt([a, b, c], 2001)!
    expect(pos.x).toBeCloseTo(16, 1)
    expect(pos.y).toBeCloseTo(78, 1)
  })
})

describe('hasDrivenMovement', () => {
  const path = (n: number): PlayPath =>
    P('p', Array.from({ length: n }, (_, i) => [i, i] as [number, number]), {
      delayMs: 0,
      durationMs: 100,
    })

  it('is false for nothing, and for single-point paths that cannot be animated', () => {
    expect(hasDrivenMovement(undefined)).toBe(false)
    expect(hasDrivenMovement([])).toBe(false)
    expect(hasDrivenMovement([path(1)])).toBe(false)
  })

  it('is true once a path has a real geometry', () => {
    expect(hasDrivenMovement([path(2)])).toBe(true)
  })
})