import { CHALK } from './pathStyles'

export type FieldTheme = 'green' | 'white' | 'black'

export interface FieldPalette {
  /** mowing stripes */
  stripeA: string
  stripeB: string
  endZone: string
  /** painted lines / numbers */
  line: string
  /** default route ink (was chalk on green) */
  ink: string
}

export const FIELD_THEMES: Record<FieldTheme, FieldPalette> = {
  green: {
    stripeA: '#185736',
    stripeB: '#144a2d',
    endZone: '#123f28',
    line: '#eaf3ea',
    ink: '#eaf3ea',
  },
  white: {
    stripeA: '#f2f5f2',
    stripeB: '#e7ece7',
    endZone: '#d9e1d9',
    line: '#333d49',
    ink: '#24303c',
  },
  black: {
    stripeA: '#16191d',
    stripeB: '#101216',
    endZone: '#0c0e11',
    line: '#eaf3ea',
    ink: '#eaf3ea',
  },
}

export function paletteFor(theme: FieldTheme): FieldPalette {
  return FIELD_THEMES[theme] ?? FIELD_THEMES.green
}

/** Resolve a path style's stroke color for the active field theme. */
export function styleColor(baseColor: string, theme: FieldTheme): string {
  // chalk-drawn paths flip to dark ink on white turf; everything else
  // (gold passes, gray blocks, colored accents) reads on every surface
  if (baseColor === CHALK || baseColor === '#eaf3ea') return paletteFor(theme).ink
  return baseColor
}

/** Convenience: full resolved style for a path type under a theme. */
export function styleFor(
  base: { color: string; width: number; dash?: string; arrow?: string; band?: boolean; endDot?: boolean },
  theme: FieldTheme,
): typeof base {
  return { ...base, color: styleColor(base.color, theme) }
}

export const ALL_FIELD_THEMES: ReadonlyArray<{ key: FieldTheme; label: string }> = [
  { key: 'green', label: 'Green' },
  { key: 'white', label: 'White' },
  { key: 'black', label: 'Black' },
]
