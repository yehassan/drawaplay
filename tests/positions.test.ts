import { describe, expect, it } from 'vitest'
import { coercePos, posLabel, POSITIONS } from '../src/lib/positions'
import { useEditorStore } from '../src/stores/editorStore'
import type { Side, Token } from '../src/stores/editorStore'

const ghost = (pos: string, side: Side): Token =>
  ({ id: 'g1', side, pos, num: '', x: 26.65, y: 50 }) as Token

describe('posLabel', () => {
  it('resolves a known position', () => {
    expect(posLabel('CB')).toBe('CB')
    expect(posLabel('DL')).toBe('DL')
  })

  it('falls back to the raw value so an unknown pos still draws', () => {
    expect(posLabel('DT')).toBe('DT')
    expect(posLabel('')).toBe('')
  })
})

describe('coercePos', () => {
  it('leaves a supported position alone', () => {
    for (const key of Object.keys(POSITIONS)) {
      const side = POSITIONS[key as keyof typeof POSITIONS].side
      expect(coercePos(key, side)).toBe(key)
    }
  })

  it('falls back to the generic position for that side', () => {
    expect(coercePos('DT', 'defense')).toBe('DL')
    expect(coercePos('DE', 'defense')).toBe('DL')
    expect(coercePos('NOPE', 'offense')).toBe('WR')
  })
})

describe('loading a play saved under a removed position', () => {
  it('repairs the token instead of blanking the canvas', () => {
    useEditorStore.getState().loadPlay({
      name: 'Old Mint',
      tokens: [ghost('DT', 'defense'), ghost('DE', 'defense'), ghost('CB', 'defense')],
      paths: [],
    })
    expect(useEditorStore.getState().tokens.map((t) => t.pos)).toEqual(['DL', 'DL', 'CB'])
  })

  it('keeps every repaired token renderable', () => {
    useEditorStore.getState().loadPlay({
      name: 'Ghosted',
      tokens: [ghost('DT', 'defense')],
      paths: [],
    })
    for (const t of useEditorStore.getState().tokens) {
      expect(posLabel(t.pos)).toBeTruthy()
    }
  })
})
