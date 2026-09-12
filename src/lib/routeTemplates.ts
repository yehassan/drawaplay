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
 * Receiver-local shape → field yards anchored at (ax, ay).
 * Offense attacks toward decreasing y. Direction comes from alignment:
 * a right-side receiver's inside is −x, a left-side receiver's is +x.
 * depthScale multiplies every leg (coach-adjustable stem depth).
 */
export function buildRoutePoints(
  concept: RouteConcept,
  anchor: Pt,
  depthScale = 1,
): Pt[] {
  const rightSide = anchor.x >= FIELD_CENTER_X
  const dir = concept.breaks === 'straight' ? 0 : concept.breaks === 'in' ? -1 : 1
  const s = (rightSide ? 1 : -1) * dir
  return concept.shape.map(([d, l]) => ({
    x: Math.max(1.5, Math.min(51.8, anchor.x + s * l * depthScale)),
    y: anchor.y - d * depthScale,
  }))
}
