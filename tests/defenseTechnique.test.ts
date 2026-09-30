import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'
import { buildDefenseFormation } from '../src/lib/defenseFormations'
import { buildFormation } from '../src/lib/formations'
import { olAnchors, techniqueX } from '../src/lib/techniques'
import type { Token } from '../src/stores/editorStore'

const offense = (): Token[] => buildFormation({ personnel: '11', underCenter: false, hash: 'center', side: 'theirs', yardLine: 20 }).tokens

const defense = (): Token[] =>
  buildDefenseFormation({ front: 'nickel', shell: '2-high', hash: 'center', side: 'theirs', yardLine: 20 }).tokens

const loadBoth = (): { dl: string } => {
  const tokens = [...offense(), ...defense()]
  useEditorStore.setState({ tokens, defenseRefX: 26.65, defenseTech: {}, past: [], future: [] })
  const dl = tokens.find((t) => t.side === 'defense' && t.pos === 'DL')!
  return { dl: dl.id }
}

const xOf = (id: string): number => useEditorStore.getState().tokens.find((t) => t.id === id)!.x

beforeEach(() => {
  useEditorStore.setState({ tokens: [], defenseRefX: null, defenseTech: {}, past: [], future: [] })
})

describe('setDefenseTechnique', () => {
  it('moves the lineman to the resolved x', () => {
    const { dl } = loadBoth()
    const anchors = olAnchors(useEditorStore.getState().tokens, 26.65)
    useEditorStore.getState().setDefenseTechnique(dl, 5, false)
    expect(xOf(dl)).toBeCloseTo(techniqueX(anchors, 5, false), 5)
  })

  it('records the assignment so the chip stays lit', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 3, true)
    expect(useEditorStore.getState().defenseTech[dl]).toEqual({
      tech: 3,
      inverted: true,
      mirrored: false,
    })
  })

  it('inverted lands inboard of the straight technique on the same side', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 3, false)
    const straight = xOf(dl)
    useEditorStore.getState().setDefenseTechnique(dl, 3, true)
    const inverted = xOf(dl)
    const c = useEditorStore.getState().tokens.find((t) => t.pos === 'C')!.x
    expect(Math.abs(inverted - c)).toBeLessThan(Math.abs(straight - c))
  })

  it('anchors on the live offensive line, not the fallback', () => {
    useEditorStore.setState({
      tokens: [...offense(), ...defense()],
      defenseRefX: 10,
    })
    const anchors = olAnchors(useEditorStore.getState().tokens, 10)
    const dl = useEditorStore
      .getState()
      .tokens.find((t) => t.side === 'defense' && t.pos === 'DL')!.id
    useEditorStore.getState().setDefenseTechnique(dl, 0, false)
    expect(xOf(dl)).toBeCloseTo(anchors.c, 5)
  })

  it('keeps a lineman on the field when a wide technique runs off the edge', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 9, false)
    const x = xOf(dl)
    expect(x).toBeGreaterThanOrEqual(1.5)
    expect(x).toBeLessThanOrEqual(51.8)
  })

  it('pushes an undo point so the move is revertible', () => {
    const { dl } = loadBoth()
    const before = xOf(dl)
    useEditorStore.getState().setDefenseTechnique(dl, 7, false)
    expect(useEditorStore.getState().past.length).toBe(1)
    useEditorStore.getState().undo()
    expect(xOf(dl)).toBeCloseTo(before, 5)
  })

  it('closes the chip row after a pick', () => {
    const { dl } = loadBoth()
    useEditorStore.setState({ techBarFor: dl })
    useEditorStore.getState().setDefenseTechnique(dl, 2, false)
    expect(useEditorStore.getState().techBarFor).toBeNull()
  })

  it('ignores an unknown token', () => {
    loadBoth()
    useEditorStore.getState().setDefenseTechnique('nope', 3, false)
    expect(useEditorStore.getState().past.length).toBe(0)
  })
})

describe('hand-dragging a lineman', () => {
  it('drops the technique assignment so the chip stops claiming it', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 3, false)
    expect(useEditorStore.getState().defenseTech[dl]).toBeDefined()
    const t = useEditorStore.getState().tokens.find((x) => x.id === dl)!
    useEditorStore.getState().moveTokensLive({ [dl]: { x: t.x + 2, y: t.y } })
    expect(useEditorStore.getState().defenseTech[dl]).toBeUndefined()
  })

  it('leaves other linemen assigned', () => {
    const { dl } = loadBoth()
    const other = useEditorStore
      .getState()
      .tokens.filter((t) => t.side === 'defense' && t.pos === 'DL')
      .map((t) => t.id)[1]
    useEditorStore.getState().setDefenseTechnique(dl, 3, false)
    useEditorStore.getState().setDefenseTechnique(other, 5, false)
    useEditorStore.getState().moveTokensLive({ [dl]: { x: xOf(dl) + 2, y: 0 } })
    expect(useEditorStore.getState().defenseTech[other]).toEqual({
      tech: 5,
      inverted: false,
      mirrored: false,
    })
  })
})

describe('clearDefenseTechnique', () => {
  it('forgets the assignment without moving the player', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 3, false)
    const at = xOf(dl)
    useEditorStore.getState().clearDefenseTechnique(dl)
    expect(useEditorStore.getState().defenseTech[dl]).toBeUndefined()
    expect(xOf(dl)).toBeCloseTo(at, 5)
  })

  it('is a no-op when nothing is assigned', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().clearDefenseTechnique(dl)
    expect(useEditorStore.getState().past.length).toBe(0)
  })
})

describe('persisting techniques through loadPlay', () => {
  it('remaps assignment keys onto the fresh token ids', () => {
    useEditorStore.getState().loadPlay({
      name: 'Mint',
      tokens: [...offense(), ...defense()],
      paths: [],
      defenseRefX: 26.65,
      defenseTech: { DL1: { tech: 4, inverted: true, mirrored: false } },
    })
    const st = useEditorStore.getState()
    const keys = Object.keys(st.defenseTech)
    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toBe('DL1')
    expect(st.tokens.some((t) => t.id === keys[0])).toBe(true)
  })

  it('drops assignments whose token did not survive', () => {
    useEditorStore.getState().loadPlay({
      name: 'Ghost',
      tokens: [...defense()],
      paths: [],
      defenseRefX: 26.65,
      defenseTech: { DL1: { tech: 4, inverted: true, mirrored: false }, NOPE: { tech: 0, inverted: false, mirrored: false } },
    })
    expect(Object.keys(useEditorStore.getState().defenseTech)).toHaveLength(1)
  })

  it('starts clean when a play carries no assignments', () => {
    useEditorStore.getState().loadPlay({
      name: 'Plain',
      tokens: [...defense()],
      paths: [],
    })
    expect(useEditorStore.getState().defenseTech).toEqual({})
  })

  it('clears stale assignments when a template play loads', () => {
    const { dl } = loadBoth()
    useEditorStore.getState().setDefenseTechnique(dl, 5, false)
    useEditorStore.getState().loadPlay({ name: 'New', tokens: [...defense()], paths: [] })
    expect(useEditorStore.getState().defenseTech).toEqual({})
  })
})
