import { beforeEach, describe, expect, it } from 'vitest'
import { playWarnings } from '../src/lib/warnings'
import { canApplyPathType } from '../src/lib/target'
import { reschedule } from '../src/lib/timing'
import { SCENARIOS, loadScenario } from '../src/lib/scenarios'
import { useEditorStore } from '../src/stores/editorStore'
import type { PlayPath, Token } from '../src/stores/editorStore'

const st = () => useEditorStore.getState()

const tok = (id: string, pos: Token['pos'], x: number, y: number): Token => ({
  id,
  side: 'offense',
  pos,
  num: '',
  x,
  y,
})

const path = (
  id: string,
  type: PlayPath['type'],
  points: [number, number][],
  extra: Partial<PlayPath> = {},
): PlayPath => ({
  id,
  type,
  tokenId: null,
  endTokenId: null,
  points: points.map(([x, y]) => ({ x, y })),
  d: '',
  timing: { delayMs: 0, durationMs: 600 },
  ...extra,
})

const timed = (paths: PlayPath[]): PlayPath[] => {
  const s = reschedule(paths)
  return paths.map((p) => ({ ...p, timing: s.get(p.id)! }))
}

const crew = [
  tok('C', 'C', 26.5, 89),
  tok('QB', 'QB', 26.5, 87),
  tok('RB', 'RB', 24, 86.5),
  tok('WR', 'WR', 10, 80),
  tok('TE', 'TE', 40, 82),
]

/** the ball gets to the QB and nowhere else, and the WR throws anyway */
const inertThrow = () =>
  timed([
    path('snap', 'snap', [[26.5, 89], [26.5, 87]], { tokenId: 'C', endTokenId: 'QB' }),
    path('stray', 'pass', [[10, 80], [24, 74]], { tokenId: 'WR', endTokenId: 'TE' }),
  ])

/** snap to the QB, toss to the back, then the back throws it */
const chain = () =>
  timed([
    path('snap', 'snap', [[26.5, 89], [26.5, 87]], { tokenId: 'C', endTokenId: 'QB' }),
    path('toss', 'toss', [[26.5, 87], [24, 86.5]], { tokenId: 'QB', endTokenId: 'RB' }),
    path('flat', 'pass', [[24, 86.5], [18, 78]], { tokenId: 'RB', endTokenId: 'WR' }),
  ])

describe('a throw by a player who never gets the ball', () => {
  it('is reported, naming the thrower and who holds it instead', () => {
    const w = playWarnings(crew, inertThrow(), null)
    expect(w).toHaveLength(1)
    expect(w[0]!.targetIds).toEqual(['stray'])
    expect(w[0]!.message).toBe(
      'WR never gets the ball, so this pass never happens — it is still with QB.',
    )
  })

  it('goes away once something hands him the ball first', () => {
    const before = inertThrow()
    expect(playWarnings(crew, before, null)).toHaveLength(1)
    // same throw, but now the snap goes to the man making it
    const fixed = timed([
      path('snap', 'snap', [[26.5, 89], [10, 80]], { tokenId: 'C', endTokenId: 'WR' }),
      path('stray', 'pass', [[10, 80], [24, 74]], { tokenId: 'WR', endTokenId: 'TE' }),
    ])
    expect(playWarnings(crew, fixed, null)).toEqual([])
  })
})

describe('the ball is handed down a chain', () => {
  it('produces no warnings', () => {
    expect(playWarnings(crew, chain(), null)).toEqual([])
  })

  it('reports the second thrower when the link before him is missing', () => {
    const broken = chain().filter((p) => p.id !== 'toss')
    const w = playWarnings(crew, broken, null)
    expect(w.map((x) => x.targetIds[0])).toEqual(['flat'])
  })

  it('does not let a throw that never happens hand the ball on', () => {
    // WR never gets it, so neither does the man he supposedly threw to.
    // If an inert throw still transferred possession, the second would fire.
    const stacked = timed([
      path('snap', 'snap', [[26.5, 89], [26.5, 87]], { tokenId: 'C', endTokenId: 'QB' }),
      path('stray', 'pass', [[10, 80], [40, 82]], { tokenId: 'WR', endTokenId: 'TE' }),
      path('onward', 'pass', [[40, 82], [24, 86.5]], { tokenId: 'TE', endTokenId: 'RB' }),
    ])
    const w = playWarnings(crew, stacked, null)
    expect(w.map((x) => x.targetIds[0])).toEqual(['stray', 'onward'])
  })
})

describe('a ball action with nobody to catch it', () => {
  it('is reported', () => {
    const paths = timed([path('stray', 'pass', [[10, 80], [24, 74]], { tokenId: 'WR' })])
    const w = playWarnings(crew, paths, null)
    expect(w.map((x) => x.id)).toEqual(['no-receiver:stray'])
  })

  it('is left behind when the man it was aimed at is deleted', () => {
    useEditorStore.setState({
      playName: 'T',
      tokens: crew,
      paths: timed([path('stray', 'pass', [[10, 80], [24, 74]], { tokenId: 'WR', endTokenId: 'TE' })]),
      selectedIds: [],
      ballStartId: null,
      past: [],
      future: [],
    })
    st().deleteTokens(['TE'])
    const after = st().paths[0]!
    expect(after.endTokenId).toBeNull()
    expect(playWarnings(st().tokens, st().paths, st().ballStartId).map((x) => x.id)).toEqual([
      'no-receiver:stray',
    ])
  })
})

describe('a ball action needs a receiver, decided where the coach picks it', () => {
  it('allows a line ending on a teammate and refuses one ending on grass', () => {
    const onGrass = path('p', 'route', [[10, 80], [24, 74]], { tokenId: 'WR' })
    const onTeammate = path('p', 'route', [[10, 80], [40, 82]], { tokenId: 'WR' })
    expect(canApplyPathType(onGrass, 'pass', [onGrass], crew)).toBe(false)
    expect(canApplyPathType(onTeammate, 'pass', [onTeammate], crew)).toBe(true)
    expect(canApplyPathType(onGrass, 'route', [onGrass], crew)).toBe(true)
  })

  it('refuses a thrower-less line, which is not a ball action either', () => {
    const orphan = path('p', 'route', [[10, 80], [40, 82]])
    expect(canApplyPathType(orphan, 'toss', [orphan], crew)).toBe(false)
  })

  it('always stores a receiver when the store accepts the mark', () => {
    useEditorStore.setState({
      playName: 'T',
      tokens: crew,
      paths: [path('p', 'route', [[10, 80], [40, 82]], { tokenId: 'WR' })],
      selectedIds: ['p'],
      ballStartId: null,
      past: [],
      future: [],
    })
    st().updatePathType('p', 'pass')
    expect(st().paths[0]!.endTokenId).toBe('TE')
  })

  it('keeps the receiver a throw already has, even one nobody is standing under', () => {
    // drawn at a receiver mid-route, so nothing is under the end at rest
    const aimed = path('p', 'pass', [[10, 80], [30, 60]], { tokenId: 'WR', endTokenId: 'TE' })
    expect(canApplyPathType(aimed, 'pass', [aimed], crew)).toBe(true)
    useEditorStore.setState({
      playName: 'T',
      tokens: crew,
      paths: [aimed],
      selectedIds: ['p'],
      ballStartId: null,
      past: [],
      future: [],
    })
    st().updatePathType('p', 'handoff')
    expect(st().paths[0]!.endTokenId).toBe('TE')
  })

  it('leaves the type alone when there is nobody to throw to', () => {
    useEditorStore.setState({
      playName: 'T',
      tokens: crew,
      paths: [path('p', 'route', [[10, 80], [24, 74]], { tokenId: 'WR' })],
      selectedIds: ['p'],
      ballStartId: null,
      past: [],
      future: [],
    })
    st().updatePathType('p', 'pass')
    expect(st().paths[0]!.type).toBe('route')
    expect(st().past).toEqual([])
  })
})

describe('the plays the app ships with', () => {
  beforeEach(() => {
    useEditorStore.setState({ playName: 'T', past: [], future: [] })
  })

  it('are all legal plays, with no warnings at all', () => {
    for (const scenario of SCENARIOS) {
      const loaded = loadScenario(scenario)
      st().loadPlay(loaded)
      const { tokens, paths, ballStartId } = st()
      expect(playWarnings(tokens, paths, ballStartId), scenario.name).toEqual([])
      // and the picker guard never blocks a throw these plays already contain
      for (const p of paths) {
        expect(canApplyPathType(p, p.type, paths, tokens), `${scenario.name}/${p.id}/${p.type}`).toBe(
          true,
        )
      }
    }
  })
})
