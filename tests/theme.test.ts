import { describe, expect, it } from 'vitest'
import { ALL_FIELD_THEMES, paletteFor, styleColor } from '../src/lib/theme'
import { CHALK, PATH_STYLES } from '../src/lib/pathStyles'

describe('field themes', () => {
  it('declares all three fills with complete palettes', () => {
    expect(ALL_FIELD_THEMES.map((t) => t.key)).toEqual(['green', 'white', 'black'])
    for (const t of ALL_FIELD_THEMES) {
      const pal = paletteFor(t.key)
      for (const key of ['stripeA', 'stripeB', 'endZone', 'line', 'ink'] as const) {
        expect(pal[key], `${t.key}.${key}`).toMatch(/^#/)
      }
    }
  })

  it('white turf flips chalk ink to dark; green/black keep chalk', () => {
    expect(styleColor(CHALK, 'green')).toBe('#eaf3ea')
    expect(styleColor(CHALK, 'black')).toBe('#eaf3ea')
    expect(styleColor(CHALK, 'white')).toBe('#24303c')
    expect(styleColor(PATH_STYLES.route.color, 'white')).toBe('#24303c')
  })

  it('accent colors (gold pass, gray block) survive every theme', () => {
    for (const t of ['green', 'white', 'black'] as const) {
      expect(styleColor(PATH_STYLES.pass.color, t)).toBe(PATH_STYLES.pass.color)
      expect(styleColor(PATH_STYLES.block.color, t)).toBe(PATH_STYLES.block.color)
      // the default route must differ from the field line color on white
      if (t === 'white') {
        const route = styleColor(PATH_STYLES.route.color, t)
        const pal = paletteFor(t)
        expect(route).not.toBe(pal.line)
      }
    }
  })
})
