import { describe, expect, it } from 'vitest'
import { pickVideoMime, safeFilename } from '../src/lib/exporters'

describe('video format selection', () => {
  it('prefers MP4 when the browser supports it (Chrome/Safari)', () => {
    const pick = pickVideoMime((m) => m.startsWith('video/mp4'))
    expect(pick?.ext).toBe('mp4')
    expect(pick?.mime).toContain('mp4')
  })
  it('falls back to WebM when MP4 is unavailable (Firefox)', () => {
    const pick = pickVideoMime((m) => m.startsWith('video/webm'))
    expect(pick?.ext).toBe('webm')
  })
  it('returns null when nothing is supported', () => {
    expect(pickVideoMime(() => false)).toBeNull()
  })
})

describe('safeFilename', () => {
  it('strips unsafe characters', () => {
    expect(safeFilename('Red Zone // Slant: Flat!')).toBe('Red-Zone-Slant-Flat')
    expect(safeFilename('   ')).toBe('play')
  })
})
