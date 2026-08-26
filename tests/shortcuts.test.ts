import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyShortcut } from '../src/hooks/useShortcuts'
import { useEditorStore } from '../src/stores/editorStore'
import type { PlayPath } from '../src/stores/editorStore'

const ev = (key: string, mods: Partial<{ mod: boolean; shift: boolean; alt: boolean; targetTag: string }> = {}) => ({
  key,
  metaKey: mods.mod ?? false,
  ctrlKey: false,
  shiftKey: mods.shift ?? false,
  altKey: mods.alt ?? false,
  preventDefault: vi.fn(),
  target: { tagName: mods.targetTag ?? 'BODY', isContentEditable: false },
})

const P = (
  id: string,
  tokenId: string | null,
  type: PlayPath['type'],
  seg: [number, number][],
): PlayPath => ({
  id,
  tokenId,
  endTokenId: null,
  type,
  timing: { delayMs: 0, durationMs: 600 },
  points: seg.map(([x, y]) => ({ x, y })),
  d: '',
})
const tok = (id: string, x: number, y: number): Token => ({ id, side: 'offense', pos: 'WR', num: '', x, y })
import type { Token } from '../src/stores/editorStore'

function reset(): void {
  const st = useEditorStore.getState()
  useEditorStore.setState({
    playName: 'T',
    tool: 'select',
    tokens: [],
    paths: [],
    ballStartId: null,
    selectedIds: [],
    playback: { playing: false, tMs: 0, speed: 1, loop: false },
    past: [],
    future: [],
    typeBarFor: null,
  })
  void st
}

beforeEach(() => reset())

describe('tool shortcuts', () => {
  it('V selects', () => {
    applyShortcut(ev('v'))
    expect(useEditorStore.getState().tool).toBe('select')
  })
  it('D arms the sticky pen and disarms on repeat', () => {
    applyShortcut(ev('d'))
    expect(useEditorStore.getState().tool).toBe('draw')
    applyShortcut(ev('d'))
    expect(useEditorStore.getState().tool).toBe('select')
  })
  it('H pans, T text, Esc exits pen (selection kept)', () => {
    applyShortcut(ev('h'))
    expect(useEditorStore.getState().tool).toBe('pan')
    applyShortcut(ev('t'))
    expect(useEditorStore.getState().tool).toBe('text')
    applyShortcut(ev('d'))
    const t = tok('w1', 10, 80)
    useEditorStore.setState({ tokens: [t], selectedIds: ['w1'] })
    applyShortcut(ev('Escape'))
    expect(useEditorStore.getState().tool).toBe('select')
  })
})

describe('playback & view shortcuts', () => {
  it('Space toggles playback and preventDefault is called', () => {
    useEditorStore.setState({
      paths: [P('p0', null, 'route', [[0, 0], [5, 5]])],
    })
    const e = ev(' ')
    applyShortcut(e)
    expect(useEditorStore.getState().playback.playing).toBe(true)
    expect(e.preventDefault).toHaveBeenCalled()
    applyShortcut(ev(' '))
    expect(useEditorStore.getState().playback.playing).toBe(false)
  })
  it('⌘Z / ⇧⌘Z undo and redo token deletion', () => {
    const t = tok('w1', 10, 80)
    useEditorStore.setState({ tokens: [t], selectedIds: ['w1'] })
    applyShortcut(ev('Delete'))
    expect(useEditorStore.getState().tokens).toHaveLength(0)
    applyShortcut(ev('z', { mod: true }))
    expect(useEditorStore.getState().tokens).toHaveLength(1)
    applyShortcut(ev('z', { mod: true, shift: true }))
    expect(useEditorStore.getState().tokens).toHaveLength(0)
  })
  it('F-fit is handled by canvas (not here) — ⌘D duplicates selection', () => {
    useEditorStore.setState({ tokens: [tok('a', 5, 5)], selectedIds: ['a'] })
    applyShortcut(ev('d', { mod: true }))
    const s = useEditorStore.getState()
    expect(s.tokens).toHaveLength(2)
    expect(s.selectedIds[0]).not.toBe('a')
  })
})

describe('nudge & delete keys', () => {
  it('arrows nudge by 0.5yd (shift = 2yd)', () => {
    useEditorStore.setState({ tokens: [tok('a', 20, 20)], selectedIds: ['a'] })
    applyShortcut(ev('ArrowRight'))
    expect(useEditorStore.getState().tokens[0].x).toBe(20.5)
    applyShortcut(ev('ArrowUp', { shift: true }))
    expect(useEditorStore.getState().tokens[0].y).toBe(18)
  })
  it('Delete/Backspace remove the selection', () => {
    useEditorStore.setState({ tokens: [tok('a', 1, 1)], selectedIds: ['a'] })
    applyShortcut(ev('Backspace'))
    expect(useEditorStore.getState().tokens).toHaveLength(0)
  })
})

describe('type bar hotkeys', () => {
  it('digits retype the bar path and close the bar', () => {
    const pass = P('p1', null, 'pass', [[26, 92], [18, 84]])
    useEditorStore.setState({
      paths: [pass],
      selectedIds: ['p1'],
      typeBarFor: 'p1',
      playName: 'T',
    })
    applyShortcut(ev('3')) // index 2 → block
    const st = useEditorStore.getState()
    expect(st.paths[0].type).toBe('block')
    expect(st.typeBarFor).toBeNull()
  })
  it('digits are ignored when no bar is open', () => {
    applyShortcut(ev('3'))
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })
  it('Esc closes the bar before other escape semantics', () => {
    const pass = P('p1', null, 'pass', [[26, 92], [18, 84]])
    useEditorStore.setState({ paths: [pass], typeBarFor: 'p1' })
    applyShortcut(ev('Escape'))
    expect(useEditorStore.getState().typeBarFor).toBeNull()
  })
})

describe('focus guards', () => {
  it('typing fields swallow shortcuts', () => {
    const e = ev('v', { targetTag: 'INPUT' })
    applyShortcut(e)
    // tool unchanged (already select) — assert via a stateful key instead:
    const d = ev('d', { targetTag: 'INPUT' })
    applyShortcut(d)
    expect(useEditorStore.getState().tool).toBe('select')
  })

  it('REGRESSION: focused <select> no longer swallows V/D/H/Space', () => {
    useEditorStore.setState({
      paths: [P('p0', null, 'route', [[0, 0], [5, 5]])],
    })
    const v = ev('v', { targetTag: 'SELECT' })
    applyShortcut(v)
    expect(v.preventDefault).toHaveBeenCalled() // native select behavior suppressed

    applyShortcut(ev('d', { targetTag: 'SELECT' }))
    expect(useEditorStore.getState().tool).toBe('draw')

    applyShortcut(ev(' ', { targetTag: 'SELECT' }))
    expect(useEditorStore.getState().playback.playing).toBe(true)

    applyShortcut(ev('h', { targetTag: 'SELECT' }))
    expect(useEditorStore.getState().tool).toBe('pan')
  })
})
