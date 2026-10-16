import type { Pt } from './field'
import { FIELD_CENTER_X } from './formations'

export interface RouteConcept {
  key: string
  label: string
  /** inside = toward the middle of the field, resolved by alignment */
  breaks: 'in' | 'out' | 'straight'
  /**
   * Receiver-local control points: [downfield, lateral-magnitude] in yards
   * from the release. Medians from bdbtrackingdata/week1.csv
   * (arrival-clipped, snap-spot origin, ~900 plays).
   */
  shape: ReadonlyArray<readonly [number, number]>
}

/** lateral is resolved by alignment; depth never is */
export const ROUTE_CONCEPTS: ReadonlyArray<RouteConcept> = [
  { key: 'go', label: 'Go', breaks: 'straight', shape: [[0, 0], [14, 0]] },
  { key: 'post', label: 'Post', breaks: 'in', shape: [[0, 0], [12, 0], [17, 4]] },
  { key: 'corner', label: 'Corner', breaks: 'out', shape: [[0, 0], [12, 0], [17, 5]] },
  { key: 'slant', label: 'Slant', breaks: 'in', shape: [[0, 0], [4, 0], [7, 5]] },
  { key: 'hitch', label: 'Hitch', breaks: 'out', shape: [[0, 0], [6, 0], [8, 1.5], [6, 2.5]] },
  { key: 'out', label: 'Out', breaks: 'out', shape: [[0, 0], [8, 0], [8, 8]] },
  { key: 'in', label: 'In', breaks: 'in', shape: [[0, 0], [10, 0], [12, 5]] },
  { key: 'cross', label: 'Cross', breaks: 'in', shape: [[0, 0], [4, 0], [6, 14]] },
  { key: 'flat', label: 'Flat', breaks: 'out', shape: [[0, 0], [2, 0], [4, 11]] },
  { key: 'screen', label: 'Screen', breaks: 'out', shape: [[0, 0], [0.5, 3.5]] },
  { key: 'angle', label: 'Angle', breaks: 'out', shape: [[0, 0], [3, 0], [7, 3]] },
  { key: 'wheel', label: 'Wheel', breaks: 'out', shape: [[0, 0], [2.5, 6.5], [10, 13]] },
]

export function routeConcept(key: string): RouteConcept {
  return ROUTE_CONCEPTS.find((c) => c.key === key)!
}

/**
 * Keyboard bank for the library. The number row reads `1 2 3 4 5 6 7 8 9 0 - =`
 * left to right, which is exactly 12 keys for 12 concepts, so the row order is
 * the library order. Keyed on DOM `code` rather than `key` because Shift turns
 * `1` into `!` and the binding is only ever used with Shift held.
 */
export const ROUTE_KEYS: ReadonlyArray<{ code: string; hint: string }> = [
  { code: 'Digit1', hint: '⇧1' },
  { code: 'Digit2', hint: '⇧2' },
  { code: 'Digit3', hint: '⇧3' },
  { code: 'Digit4', hint: '⇧4' },
  { code: 'Digit5', hint: '⇧5' },
  { code: 'Digit6', hint: '⇧6' },
  { code: 'Digit7', hint: '⇧7' },
  { code: 'Digit8', hint: '⇧8' },
  { code: 'Digit9', hint: '⇧9' },
  { code: 'Digit0', hint: '⇧0' },
  { code: 'Minus', hint: '⇧−' },
  { code: 'Equal', hint: '⇧=' },
]

/** the concept a shifted number-row key picks, or null if the key isn't bound */
export function routeForKeyCode(code: string): RouteConcept | null {
  const i = ROUTE_KEYS.findIndex((k) => k.code === code)
  return i === -1 ? null : (ROUTE_CONCEPTS[i] ?? null)
}

/**
 * Receiver-local shape → field yards anchored at (ax, ay).
 * Offense attacks toward decreasing y. Direction comes from alignment:
 * a right-side receiver's inside is −x, a left-side receiver's is +x.
 * depthScale multiplies every leg (coach-adjustable stem depth).
 */
export function buildRoutePoints(
  concept: RouteConcept,
  anchor: Pt,
  depthScale = 1,
  dirY: -1 | 1 = -1,
): Pt[] {
  const rightSide = anchor.x >= FIELD_CENTER_X
  const dir = concept.breaks === 'straight' ? 0 : concept.breaks === 'in' ? -1 : 1
  const s = (rightSide ? 1 : -1) * dir
  return concept.shape.map(([d, l]) => ({
    x: Math.max(1.5, Math.min(51.8, anchor.x + s * l * depthScale)),
    y: anchor.y + dirY * d * depthScale,
  }))
}
