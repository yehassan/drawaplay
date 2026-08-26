export const FIELD_W = 53.3
export const FIELD_L = 120

export type Ruleset = 'nfl' | 'ncaa'

/** hash-mark centers as offsets from their nearest sideline, kept symmetric about FIELD_W */
export const RULESET_HASHES: Record<Ruleset, readonly [number, number]> = {
  nfl: [23.583, FIELD_W - 23.583],
  ncaa: [20, FIELD_W - 20],
}

export function hashX(ruleset: Ruleset): readonly [number, number] {
  return RULESET_HASHES[ruleset] ?? RULESET_HASHES.nfl
}

export const ALL_RULESETS: ReadonlyArray<{ key: Ruleset; label: string; hint: string }> = [
  { key: 'nfl', label: 'NFL', hint: 'hashes 70\'9" from each sideline' },
  { key: 'ncaa', label: 'NCAA', hint: 'hashes 60\' from each sideline' },
]

/** painted number height in yards */
export const YARD_NUM_HEIGHT = 3.1

/** Center x (yards from left sideline) for the left and right number columns. */
export function numberX(ruleset: Ruleset): { left: number; right: number } {
  if (ruleset === 'ncaa') {
    const center = 9 - YARD_NUM_HEIGHT / 2
    return { left: center, right: FIELD_W - center }
  }
  const center = 12 + YARD_NUM_HEIGHT / 2
  return { left: center, right: FIELD_W - center }
}

export const MIN_ZOOM = 5
export const MAX_ZOOM = 48
export const SNAP_GRID = 0.5
export const GUIDE_EPS = 0.35

export interface Camera {
  zoom: number
  tx: number
  ty: number
}

export interface Pt {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** screen = field * zoom + t */
export function screenToField(cam: Camera, sx: number, sy: number): Pt {
  return { x: (sx - cam.tx) / cam.zoom, y: (sy - cam.ty) / cam.zoom }
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function snap(v: number, grid = SNAP_GRID): number {
  return Math.round(v / grid) * grid
}

/**
 * Keep at least ~80px of the field visible on each axis (or all of it,
 * if the field is smaller than the viewport on that axis).
 */
export function clampCamera(cam: Camera, vw: number, vh: number): Camera {
  const w = FIELD_W * cam.zoom
  const h = FIELD_L * cam.zoom
  const mvw = Math.min(80, w)
  const mvh = Math.min(80, h)
  return {
    zoom: cam.zoom,
    tx: clamp(cam.tx, mvw - w, vw - mvw),
    ty: clamp(cam.ty, mvh - h, vh - mvh),
  }
}

export function zoomAt(
  cam: Camera,
  sx: number,
  sy: number,
  factor: number,
  vw: number,
  vh: number,
): Camera {
  const zoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM)
  const k = zoom / cam.zoom
  return clampCamera({ zoom, tx: sx - (sx - cam.tx) * k, ty: sy - (sy - cam.ty) * k }, vw, vh)
}

export function fitCamera(rect: Rect, vw: number, vh: number): Camera {
  const zoom = clamp(Math.min(vw / rect.w, vh / rect.h), MIN_ZOOM, MAX_ZOOM)
  return clampCamera(
    {
      zoom,
      tx: vw / 2 - (rect.x + rect.w / 2) * zoom,
      ty: vh / 2 - (rect.y + rect.h / 2) * zoom,
    },
    vw,
    vh,
  )
}

/** Empty-canvas default: full field width, ~44yd of length around the LOS area. */
export function defaultCamera(vw: number, vh: number): Camera {
  return fitCamera({ x: -2, y: 60, w: FIELD_W + 4, h: 44 }, vw, vh)
}

export function bboxOf(pts: Pt[], pad: number): Rect | null {
  if (pts.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}
