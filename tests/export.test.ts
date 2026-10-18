import { describe, expect, it } from 'vitest'
import { PNG_FRAME, VIDEO_FRAME, pickVideoMime, safeFilename } from '../src/lib/exporters'
import { fitView, frameView, type ViewRect } from '../src/lib/render'
import { SCENARIOS, loadScenario } from '../src/lib/scenarios'
import { useEditorStore } from '../src/stores/editorStore'

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

describe('the export frame is one size, whatever the play looks like', () => {
  const box = (x: number, y: number, w: number, h: number): ViewRect => ({ x, y, w, h })
  const inside = (view: ViewRect, content: ViewRect): boolean =>
    view.x <= content.x + 1e-9 &&
    view.y <= content.y + 1e-9 &&
    view.x + view.w >= content.x + content.w - 1e-9 &&
    view.y + view.h >= content.y + content.h - 1e-9

  it('exports a wide play and a tall play at the same size, 9:16 and even', () => {
    const wide = frameView(box(2, 50, 48, 18), VIDEO_FRAME)
    const tall = frameView(box(14, 20, 18, 70), VIDEO_FRAME)
    for (const f of [wide, tall]) {
      expect([f.width, f.height]).toEqual([1080, 1920])
      expect(f.width % 2).toBe(0)
      expect(f.height % 2).toBe(0)
      expect(f.view.w / f.view.h).toBeCloseTo(9 / 16, 10)
      // the scale is whatever fills the frame, so px/yd is the only variable
      expect(f.scale).toBeCloseTo(f.width / f.view.w, 10)
    }
    expect(tall.scale).toBeGreaterThan(wide.scale)
  })

  it('grows the window around the play rather than cropping it', () => {
    const content = box(12, 70, 30, 14)
    expect(inside(frameView(content, VIDEO_FRAME).view, content)).toBe(true)
  })

  it('pulls a window that fits back inside the field, leaving no band of nothing', () => {
    const goalLine = box(20, 110, 20, 8)
    const { view } = frameView(goalLine, VIDEO_FRAME)
    expect(view.y).toBeGreaterThanOrEqual(0)
    expect(view.y + view.h).toBeLessThanOrEqual(120)
    expect(view.x).toBeGreaterThanOrEqual(0)
    expect(view.x + view.w).toBeLessThanOrEqual(53.3)
    expect(inside(view, goalLine)).toBe(true)
  })

  it('centres a window bigger than the field on it instead', () => {
    const wholeField = box(0, 0, 53.3, 130)
    const { view } = frameView(wholeField, VIDEO_FRAME)
    expect(view.h).toBeGreaterThan(120)
    expect(view.y).toBeCloseTo((120 - view.h) / 2, 10)
    expect(view.x).toBeCloseTo((53.3 - view.w) / 2, 10)
  })

  it('gives every play the app ships the standard size, and no less detail than before', () => {
    for (const s of SCENARIOS) {
      useEditorStore.getState().loadPlay(loadScenario(s))
      const st = useEditorStore.getState()
      const opts = { tMs: 0, playing: true, ballStartId: st.ballStartId }
      const content = fitView(st.tokens, st.paths, opts, 5, 20, st.textNotes)
      // the play itself, without the padding the frame is allowed to trim
      const play = fitView(st.tokens, st.paths, opts, 0, 0, st.textNotes)
      const video = frameView(content, VIDEO_FRAME)
      const png = frameView(content, PNG_FRAME)
      expect([video.width, video.height]).toEqual([1080, 1920])
      expect([png.width, png.height]).toEqual([2160, 3840])
      // this replaced a flat 16px/yd, which is what a narrow play used to get
      expect(video.scale).toBeGreaterThanOrEqual(16)
      expect(png.scale).toBeCloseTo(video.scale * 2, 10)
      expect(inside(video.view, play)).toBe(true)
    }
  })
})
