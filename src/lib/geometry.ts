import type { Pt } from './field'

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return dist(p, a)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** Ramer–Douglas–Peucker polyline simplification (iterative). */
export function simplifyRDP(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts.slice()
  const keep = new Uint8Array(pts.length)
  keep[0] = 1
  keep[pts.length - 1] = 1
  const stack: Array<[number, number]> = [[0, pts.length - 1]]
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!
    let maxD = -1
    let idx = -1
    for (let i = lo + 1; i < hi; i++) {
      const d = distToSegment(pts[i], pts[lo], pts[hi])
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1
      stack.push([lo, idx], [idx, hi])
    }
  }
  return pts.filter((_, i) => keep[i] === 1)
}

/** Catmull-Rom spline through pts, emitted as cubic bézier SVG path data. */
export function catmullRomPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)} L ${pts[1].x.toFixed(3)} ${pts[1].y.toFixed(3)}`
  }
  const f = (i: number): Pt => pts[Math.max(0, Math.min(pts.length - 1, i))]
  let d = `M ${f(0).x.toFixed(3)} ${f(0).y.toFixed(3)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = f(i - 1)
    const p1 = f(i)
    const p2 = f(i + 1)
    const p3 = f(i + 2)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(3)} ${c1y.toFixed(3)}, ${c2x.toFixed(3)} ${c2y.toFixed(3)}, ${p2.x.toFixed(3)} ${p2.y.toFixed(3)}`
  }
  return d
}

export function minDistToPath(p: Pt, pts: Pt[]): number {
  let min = Infinity
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(p, pts[i], pts[i + 1])
    if (d < min) min = d
  }
  if (pts.length === 1) min = dist(p, pts[0])
  return min
}

export function polylineLength(pts: Pt[]): number {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) len += dist(pts[i], pts[i + 1])
  return len
}

/** position along a polyline at arc length `target` */
export function pointAtLength(pts: Pt[], target: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1 || target <= 0) return pts[0]
  let acc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = dist(pts[i], pts[i + 1])
    if (segLen > 0 && acc + segLen >= target) {
      const t = (target - acc) / segLen
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }
    }
    acc += segLen
  }
  return pts[pts.length - 1]
}
