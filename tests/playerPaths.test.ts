import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'
import { PLAYER_DRIVEN } from '../src/lib/pathStyles'

/**
 * The player panel splits a player's paths into two lists: the movement chain
 * the scheduler walks, and the ball paths either side of them. These lock the
 * membership rules so the two can't blur together.
 */

const st = () => useEditorStore.getState()

beforeEach(() => {
  useEditorStore.setState({
    tokens: [],
    paths: [],
    selectedIds: [],
    past: [],
    future: [],
    ballStartId: null,
  })
})

const addWr = (x: number, num = '') => {
  st().addToken({ side: 'offense', pos: 'WR', num, x, y: 88 })
  return st().tokens[st().tokens.length - 1]!
}

const addQb = () => {
  st().addToken({ side: 'offense', pos: 'QB', num: '', x: 26, y: 93 })
  return st().tokens[st().tokens.length - 1]!
}

/** mirrors what TokenInspector derives */
const movementOf = (id: string) =>
  st().paths.filter((p) => p.tokenId === id && PLAYER_DRIVEN.has(p.type))
// deliberately not the app's own constant — this asserts the rule, not itself
const HANDED_OFF: ReadonlyArray<string> = ['pass', 'handoff', 'toss']
const outgoingOf = (id: string) =>
  st().paths.filter((p) => p.tokenId === id && HANDED_OFF.includes(p.type))

describe('a player can route, then take a toss, then block', () => {
  it('keeps the route and the block in the movement chain', () => {
    const wr = addWr(20)
    st().setPlayerRoute(wr.id, 'go')
    st().addBlock(wr.id, 'forward')
    expect(movementOf(wr.id).map((p) => p.type)).toEqual(['route', 'block'])
  })

  it('shows the toss on both the giver and the receiver', () => {
    const qb = addQb()
    const wr = addWr(20)
    const toss = st().addPath({
      tokenId: qb.id,
      endTokenId: wr.id,
      type: 'toss',
      points: [{ x: 26, y: 93 }, { x: 20, y: 88 }],
      d: '',
    })
    expect(outgoingOf(qb.id)).toHaveLength(1)
    expect(st().paths.find((p) => p.id === toss)!.endTokenId).toBe(wr.id)
  })

  it('keeps the toss out of the movement chain on both sides', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().addPath({
      tokenId: qb.id,
      endTokenId: wr.id,
      type: 'toss',
      points: [{ x: 26, y: 93 }, { x: 20, y: 88 }],
      d: '',
    })
    expect(movementOf(qb.id)).toHaveLength(0)
    expect(movementOf(wr.id)).toHaveLength(0)
    expect(outgoingOf(wr.id)).toHaveLength(0)
  })

  it('reorders block-before-route within the movement chain only', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().setPlayerRoute(wr.id, 'go')
    st().addBlock(wr.id, 'forward')
    st().addPath({
      tokenId: qb.id,
      endTokenId: wr.id,
      type: 'toss',
      points: [{ x: 26, y: 93 }, { x: 20, y: 88 }],
      d: '',
    })
    const block = movementOf(wr.id).find((p) => p.type === 'block')!
    st().reorderPath(block.id, -1)
    expect(movementOf(wr.id).map((p) => p.type)).toEqual(['block', 'route'])
  })
})

describe('addBlock', () => {
  it('is one yard long by default', () => {
    const wr = addWr(20)
    const id = st().addBlock(wr.id, 'forward')!
    const p = st().paths.find((x) => x.id === id)!
    const len = Math.hypot(p.points[1].x - p.points[0].x, p.points[1].y - p.points[0].y)
    expect(len).toBeCloseTo(1, 3)
  })

  it('goes straight ahead for a forward block', () => {
    const wr = addWr(20)
    const id = st().addBlock(wr.id, 'forward')!
    const p = st().paths.find((x) => x.id === id)!
    expect(p.points[1].x).toBeCloseTo(20, 5)
    expect(p.points[1].y).toBeLessThan(88)
  })

  it('angles left and right off the forward axis', () => {
    const wr = addWr(20)
    const leftId = st().addBlock(wr.id, 'left')!
    const left = st().paths.find((x) => x.id === leftId)!
    const rightId = st().addBlock(wr.id, 'right')!
    const right = st().paths.find((x) => x.id === rightId)!
    // an offense player runs up the screen, so his left is -x
    expect(left.points[1].x).toBeLessThan(20)
    expect(right.points[1].x).toBeGreaterThan(20)
  })

  it('mirrors the angle for a defender, who faces the other way', () => {
    st().addToken({ side: 'defense', pos: 'CB', num: '', x: 20, y: 40 })
    const cb = st().tokens[st().tokens.length - 1]!
    const leftId = st().addBlock(cb.id, 'left')!
    const left = st().paths.find((x) => x.id === leftId)!
    // facing down the screen his left is +x, and forward is toward the offense
    expect(left.points[1].x).toBeGreaterThan(20)
    expect(left.points[1].y).toBeGreaterThan(40)
  })

  it('makes a block-typed path off the player', () => {
    const wr = addWr(20)
    const id = st().addBlock(wr.id, 'forward')!
    const p = st().paths.find((x) => x.id === id)!
    expect(p.type).toBe('block')
    expect(p.tokenId).toBe(wr.id)
  })

  it('stacks several blocks, each its own row', () => {
    const wr = addWr(20)
    st().addBlock(wr.id, 'left')
    st().addBlock(wr.id, 'right')
    expect(movementOf(wr.id).filter((p) => p.type === 'block')).toHaveLength(2)
  })

  it('leaves the selection alone and undoes cleanly', () => {
    const wr = addWr(20)
    useEditorStore.setState({ selectedIds: [wr.id] })
    st().addBlock(wr.id, 'forward')
    expect(st().selectedIds).toEqual([wr.id])
    st().undo()
    expect(st().paths).toHaveLength(0)
  })

  it('ignores an unknown player', () => {
    expect(st().addBlock('nope', 'left')).toBeNull()
  })
})
