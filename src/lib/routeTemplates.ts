import type { Pt } from './field'

export type RouteSide = 'left' | 'right'

export interface RouteConcept {
  key: string
  label: string
  /**
   * Receiver-local control points: [downfield, lateral] in yards from the
   * release. Medians from bdbtrackingdata/week1.csv (arrival-clipped,
   * snap-spot origin, ~900 plays): stem at ~1.2s, terminal at the catch.
   */
  shape: ReadonlyArray<readonly [number, number]>
}

/** lateral is mirrored by side; depth never is */
export const ROUTE_CONCEPTS: ReadonlyArray<RouteConcept> = [
  { key: 'go', label: 'Go', shape: [[0, 0], [14, 0]] },
  { key: 'post', label: 'Post', shape: [[0, 0], [12, 0], [17, 4]] },
  { key: 'corner', label: 'Corner', shape: [[0, 0], [12, 0], [17, 5]] },
  { key: 'slant', label: 'Slant', shape: [[0, 0], [4, 0], [7, 5]] },
  { key: 'hitch', label: 'Hitch', shape: [[0, 0], [8, 2.5]] },
  { key: 'out', label: 'Out', shape: [[0, 0], [8, 0], [8, 8]] },
  { key: 'in', label: 'In', shape: [[0, 0], [10, 0], [12, 5]] },
  { key: 'cross', label: 'Cross', shape: [[0, 0], [4, 0], [6, 14]] },
  { key: 'flat', label: 'Flat', shape: [[0, 0], [2, 0], [4, 11]] },
  { key: 'screen', label: 'Screen', shape: [[0, 0], [0.5, 3.5]] },
  { key: 'angle', label: 'Angle', shape: [[0, 0], [3, 0], [7, 3]] },
  { key: 'wheel', label: 'Wheel', shape: [[0, 0], [3, 6], [10, 13]] },
]

export function routeConcept(key: string): RouteConcept {
  return ROUTE_CONCEPTS.find((c) => c.key === key)!
}

/**
 * Receiver-local shape → field yards anchored at (ax, ay).
 * Offense attacks toward decreasing y; facing downfield, left is −x.
 * depthScale multiplies every leg (coach-adjustable stem depth).
 */
export function buildRoutePoints(
  concept: RouteConcept,
  anchor: Pt,
  side: RouteSide,
  depthScale = 1,
): Pt[] {
  const s = side === 'left' ? -1 : 1
  return concept.shape.map(([d, l]) => ({
    x: Math.max(1.5, Math.min(51.8, anchor.x + s * l * depthScale)),
    y: anchor.y - d * depthScale,
  }))
}
