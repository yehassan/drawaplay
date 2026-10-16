import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyShortcut } from '../src/hooks/useShortcuts'
import { useEditorStore } from '../src/stores/editorStore'
import type { PlayPath } from '../src/stores/editorStore'
import { PATH_TYPE_CHOICES } from '../src/lib/pathStyles'
import { ROUTE_CONCEPTS, ROUTE_KEYS, routeForKeyCode } from '../src/lib/routeTemplates'

const ev = (key: string, mods: Partial<{ mod: boolean; shift: boolean; alt: boolean; targetTag: string; code: string }> = {}) => ({
  key,
  code: mods.code,
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
    ballAction: null,
    past: [],
    future: [],
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
  it('arrows nudge by 0.5yd', () => {
    useEditorStore.setState({ tokens: [tok('a', 20, 20)], selectedIds: ['a'] })
    applyShortcut(ev('ArrowRight', { code: 'ArrowRight' }))
    expect(useEditorStore.getState().tokens[0].x).toBe(20.5)
    applyShortcut(ev('ArrowUp', { code: 'ArrowUp' }))
    expect(useEditorStore.getState().tokens[0].y).toBe(19.5)
  })
  it('Delete/Backspace remove the selection', () => {
    useEditorStore.setState({ tokens: [tok('a', 1, 1)], selectedIds: ['a'] })
    applyShortcut(ev('Backspace'))
    expect(useEditorStore.getState().tokens).toHaveLength(0)
  })
})

describe('⇧ builds a route or a block without the pen', () => {
  /** shift+number-row: the browser reports the shifted glyph as `key`, so the
   * binding has to look at `code` */
  const shift = (key: string, code: string) => applyShortcut(ev(key, { shift: true, code }))
  const selectPlayer = (side: 'offense' | 'defense' = 'offense', x = 20) => {
    useEditorStore.getState().addToken({ side, pos: side === 'offense' ? 'WR' : 'CB', num: '', x, y: 88 })
    const id = useEditorStore.getState().tokens.at(-1)!.id
    useEditorStore.setState({ selectedIds: [id] })
    return id
  }

  it('⇧1 gives the selected player the first route concept', () => {
    const id = selectPlayer()
    shift('!', 'Digit1')
    const [p] = useEditorStore.getState().paths
    expect(p?.type).toBe('route')
    expect(p?.tokenId).toBe(id)
  })

  it('the number row maps the whole library in order', () => {
    // 1…9 0 - = is 12 keys for 12 concepts
    expect(ROUTE_KEYS).toHaveLength(ROUTE_CONCEPTS.length)
    ROUTE_KEYS.forEach((k, i) => {
      expect(routeForKeyCode(k.code)?.key, k.code).toBe(ROUTE_CONCEPTS[i]!.key)
    })
  })

  it('every concept is reachable by its own key', () => {
    for (const k of ROUTE_KEYS) {
      reset()
      selectPlayer()
      shift('x', k.code)
      const [p] = useEditorStore.getState().paths
      expect(p?.type, k.code).toBe('route')
    }
  })

  it('⇧← ⇧↑ ⇧→ each add a block in that direction', () => {
    const dirs: [string, string][] = [
      ['ArrowLeft', 'left'],
      ['ArrowUp', 'forward'],
      ['ArrowRight', 'right'],
    ]
    for (const [code] of dirs) {
      reset()
      const id = selectPlayer('offense', 20)
      shift(code, code)
      const [p] = useEditorStore.getState().paths
      expect(p?.type, code).toBe('block')
      expect(p?.tokenId).toBe(id)
    }
    reset()
    selectPlayer('offense', 20)
    shift('ArrowLeft', 'ArrowLeft')
    const left = useEditorStore.getState().paths[0]!
    reset()
    selectPlayer('offense', 20)
    shift('ArrowRight', 'ArrowRight')
    const right = useEditorStore.getState().paths[0]!
    // left and right must lean opposite ways, and forward must not lean at all
    expect(Math.sign(left.points[1]!.x - left.points[0]!.x)).toBe(
      -Math.sign(right.points[1]!.x - right.points[0]!.x),
    )
    reset()
    selectPlayer('offense', 20)
    shift('ArrowUp', 'ArrowUp')
    const fwd = useEditorStore.getState().paths[0]!
    expect(fwd.points[1]!.x).toBeCloseTo(fwd.points[0]!.x, 6)
    // offence attacks up the screen
    expect(fwd.points[1]!.y).toBeLessThan(fwd.points[0]!.y)
  })

  it('⇧↓ has no block direction, so it does not nudge by accident', () => {
    const id = selectPlayer()
    useEditorStore.setState({ tokens: [{ ...tok(id, 20, 20) }], selectedIds: [id] })
    shift('ArrowDown', 'ArrowDown')
    const s = useEditorStore.getState()
    expect(s.paths).toHaveLength(0)
    expect(s.tokens[0].y).toBe(20)
  })

  it('a defender is offered no route — the panel gives routes to offence only', () => {
    selectPlayer('defense')
    shift('!', 'Digit1')
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })

  it('ignores ⇧+digit with no player selected, and on a selected path', () => {
    shift('!', 'Digit1')
    expect(useEditorStore.getState().paths).toHaveLength(0)
    useEditorStore.setState({ paths: [P('p1', null, 'route', [[26, 92], [18, 84]])], selectedIds: ['p1'] })
    shift('!', 'Digit1')
    expect(useEditorStore.getState().paths).toHaveLength(1)
  })

  it('⇧ still nudges 2yd when the selection is not a single player', () => {
    // a single player gets blocks from ⇧+arrows; anything else keeps the nudge
    useEditorStore.setState({
      tokens: [tok('a', 20, 20), tok('b', 30, 20)],
      selectedIds: ['a', 'b'],
    })
    shift('ArrowUp', 'ArrowUp')
    const s = useEditorStore.getState()
    expect(s.paths).toHaveLength(0)
    expect(s.tokens.map((t) => t.y)).toEqual([18, 18])
  })
})

describe('ball actions', () => {
  it('arms on a player, and Esc cancels it', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'QB', num: '', x: 26, y: 93 })
    const id = useEditorStore.getState().tokens[0].id
    useEditorStore.getState().armBallAction(id, 'toss')
    expect(useEditorStore.getState().ballAction).toEqual({ throwerId: id, type: 'toss' })
    applyShortcut(ev('Escape'))
    expect(useEditorStore.getState().ballAction).toBeNull()
  })

  it('clears once the flight is made, so the mode cannot leak', () => {
    const st = useEditorStore.getState()
    st.addToken({ side: 'offense', pos: 'QB', num: '', x: 26, y: 93 })
    st.addToken({ side: 'offense', pos: 'RB', num: '', x: 26, y: 88 })
    const [qb, rb] = useEditorStore.getState().tokens
    useEditorStore.getState().armBallAction(qb!.id, 'toss')
    useEditorStore.getState().addFlight(qb!.id, rb!.id, 'toss')
    expect(useEditorStore.getState().ballAction).toBeNull()
  })
})

describe('path type hotkeys', () => {
  it('digits label the selected path', () => {
    const p1 = P('p1', null, 'route', [[26, 92], [18, 84]])
    useEditorStore.setState({ paths: [p1], selectedIds: ['p1'], playName: 'T' })
    applyShortcut(ev('3'))
    expect(useEditorStore.getState().paths[0].type).toBe(PATH_TYPE_CHOICES[2])
  })

  it('digits reach the ball types, so a drawn path can be a toss', () => {
    const qb = tok('qb', 26, 92)
    const rb = tok('rb', 18, 86)
    const p1 = P('p1', 'qb', 'route', [[26, 92], [18, 84]])
    useEditorStore.setState({
      tokens: [qb, rb],
      paths: [p1],
      selectedIds: ['p1'],
      playName: 'T',
    })
    const toss = PATH_TYPE_CHOICES.indexOf('toss') + 1
    applyShortcut(ev(String(toss)))
    const after = useEditorStore.getState().paths[0]
    expect(after.type).toBe('toss')
    expect(after.endTokenId).toBe('rb')
  })

  it('refuses a ball action that ends on grass, rather than handing it to nobody', () => {
    const qb = tok('qb', 26, 92)
    const p1 = P('p1', 'qb', 'route', [[26, 92], [18, 84]])
    useEditorStore.setState({ tokens: [qb], paths: [p1], selectedIds: ['p1'], playName: 'T' })
    const toss = PATH_TYPE_CHOICES.indexOf('toss') + 1
    applyShortcut(ev(String(toss)))
    expect(useEditorStore.getState().paths[0].type).toBe('route')
  })

  it('never offers a snap', () => {
    expect(PATH_TYPE_CHOICES).not.toContain('snap')
  })

  it('digits are ignored when nothing is selected', () => {
    applyShortcut(ev('3'))
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })

  it('digits are ignored when the selection is not a path', () => {
    useEditorStore.getState().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const tok = useEditorStore.getState().tokens[0]
    useEditorStore.setState({ selectedIds: [tok.id], playName: 'T' })
    applyShortcut(ev('3'))
    expect(useEditorStore.getState().paths).toHaveLength(0)
  })

  it('digits are ignored when multiple paths are selected', () => {
    useEditorStore.setState({
      paths: [
        P('p1', null, 'route', [[26, 92], [18, 84]]),
        P('p2', null, 'route', [[26, 92], [30, 84]]),
      ],
      selectedIds: ['p1', 'p2'],
      playName: 'T',
    })
    applyShortcut(ev('3'))
    expect(useEditorStore.getState().paths[0].type).toBe('route')
  })
})
