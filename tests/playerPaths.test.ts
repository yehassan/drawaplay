import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../src/stores/editorStore'
import { FLIGHT_TYPES, PLAYER_DRIVEN } from '../src/lib/pathStyles'

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
const outgoingOf = (id: string) =>
  st().paths.filter((p) => p.tokenId === id && FLIGHT_TYPES.has(p.type) && p.type !== 'snap')
const incomingOf = (id: string) =>
  st().paths.filter((p) => p.endTokenId === id && FLIGHT_TYPES.has(p.type))

describe('a player can route, then take a toss, then block', () => {
  it('keeps the route and the block in the movement chain', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().setPlayerPathType(wr.id, 'route')
    st().setPlayerPathType(wr.id, 'block')
    expect(movementOf(wr.id).map((p) => p.type)).toEqual(['route', 'block'])
  })

  it('shows the toss on both the giver and the receiver', () => {
    const qb = addQb()
    const wr = addWr(20)
    const toss = st().setPlayerPathType(qb.id, 'toss')!
    st().setPathTarget(toss, wr.id)
    expect(outgoingOf(qb.id)).toHaveLength(1)
    expect(incomingOf(wr.id)).toHaveLength(1)
  })

  it('keeps the toss out of the movement chain on both sides', () => {
    const qb = addQb()
    const wr = addWr(20)
    const toss = st().setPlayerPathType(qb.id, 'toss')!
    st().setPathTarget(toss, wr.id)
    expect(movementOf(qb.id)).toHaveLength(0)
    expect(movementOf(wr.id)).toHaveLength(0)
  })

  it('reorders block-before-route within the movement chain only', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().setPlayerPathType(wr.id, 'route')
    st().setPlayerPathType(wr.id, 'block')
    const toss = st().setPlayerPathType(qb.id, 'toss')!
    st().setPathTarget(toss, wr.id)
    const block = movementOf(wr.id).find((p) => p.type === 'block')!
    st().reorderPath(block.id, -1)
    expect(movementOf(wr.id).map((p) => p.type)).toEqual(['block', 'route'])
  })
})

describe('throwToPlayer', () => {
  it('creates a pass from the holder to the player', () => {
    const qb = addQb()
    const wr = addWr(20)
    const id = st().throwToPlayer(wr.id)!
    const p = st().paths.find((x) => x.id === id)!
    expect(p.type).toBe('pass')
    expect(p.tokenId).toBe(qb.id)
    expect(p.endTokenId).toBe(wr.id)
  })

  it('leaves the selection alone', () => {
    const qb = addQb()
    const wr = addWr(20)
    useEditorStore.setState({ selectedIds: [wr.id] })
    st().throwToPlayer(wr.id)
    expect(st().selectedIds).toEqual([wr.id])
  })

  it('aims at the end of his route', () => {
    const qb = addQb()
    const wr = addWr(20)
    const route = st().setPlayerPathType(wr.id, 'route')!
    const rp = st().paths.find((p) => p.id === route)!
    const tip = rp.points[rp.points.length - 1]
    st().throwToPlayer(wr.id)
    const pass = st().paths.find((p) => p.type === 'pass')!
    expect(pass.points[pass.points.length - 1]).toEqual(tip)
  })

  it('is idempotent — no second pass to the same player', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().throwToPlayer(wr.id)
    st().throwToPlayer(wr.id)
    expect(st().paths.filter((p) => p.type === 'pass')).toHaveLength(1)
  })

  it('respects an explicit ball holder', () => {
    const qb = addQb()
    const rb = addWr(18, 'RB')
    const wr = addWr(30, 'X')
    st().setBallStart(rb.id)
    st().throwToPlayer(wr.id)
    expect(st().paths.find((p) => p.type === 'pass')!.tokenId).toBe(rb.id)
  })

  it('refuses a defender', () => {
    const qb = addQb()
    st().addToken({ side: 'defense', pos: 'CB', num: '', x: 20, y: 40 })
    const cb = st().tokens[st().tokens.length - 1]!
    expect(st().throwToPlayer(cb.id)).toBeNull()
  })

  it('refuses throwing to yourself', () => {
    const qb = addQb()
    expect(st().throwToPlayer(qb.id)).toBeNull()
  })

  it('undo removes it', () => {
    const qb = addQb()
    const wr = addWr(20)
    st().throwToPlayer(wr.id)
    expect(st().paths).toHaveLength(1)
    st().undo()
    expect(st().paths).toHaveLength(0)
  })
})