import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore, type PlayPath, type Token } from '../src/stores/editorStore'
import { SCENARIOS, loadScenario } from '../src/lib/scenarios'
import {
  ROUTE_CONCEPTS,
  ROUTE_KEYS,
  routeConcept,
  routeForKeyCode,
} from '../src/lib/routeTemplates'
import { computeScene } from '../src/lib/render'
import { FLIGHT_TYPES } from '../src/lib/pathStyles'
import { ballStateAt, defaultBallStart } from '../src/lib/ball'
import { timelineDuration } from '../src/lib/timing'
import { dist } from '../src/lib/geometry'
import { finalizeStroke } from '../src/lib/stroke'
import { applyShortcut, type ShortcutEvent } from '../src/hooks/useShortcuts'
import type { Pt } from '../src/lib/field'

/**
 * The manual checklist, driven by the real scenarios.
 *
 * Every case here was a hand-checked step in the field guide: scrub a tracking
 * play to mid-motion, aim the pen at a receiver who has already run, relabel the
 * stroke, watch the ball. The reason it was manual is that the pen's decision
 * lived inside FieldCanvas; `lib/stroke.ts` is that decision as a pure
 * function, so each of those steps is a line here instead.
 */

const ZOOM = 16

const st = () => useEditorStore.getState()

const reset = () =>
  useEditorStore.setState({
    tokens: [],
    paths: [],
    textNotes: [],
    selectedIds: [],
    past: [],
    future: [],
    ballStartId: null,
    ballAction: null,
    playback: { playing: false, tMs: 0, speed: 1, loop: false },
  })

beforeEach(reset)

/** load a scenario exactly as the picker does */
function load(scenario: (typeof SCENARIOS)[number]) {
  st().loadPlay(loadScenario(scenario))
  return { tokens: st().tokens, paths: st().paths }
}

/** where every player is drawn at tMs */
const drawnAt = (tokens: Token[], paths: PlayPath[], tMs: number) =>
  computeScene(tokens, paths, { tMs, playing: tMs > 0, ballStartId: null }).tokenPositions

/** the pen's raw polyline: a body of points bowing gently between its ends */
function penStroke(from: Pt, to: Pt, bow = 0.6): Pt[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const n = 6
  return Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1)
    const off = Math.sin(u * Math.PI) * bow
    return { x: from.x + dx * u + nx * off, y: from.y + dy * u + ny * off }
  })
}

interface AimCase {
  scenario: string
  tMs: number
  tokens: Token[]
  paths: PlayPath[]
  drawn: Map<string, Pt>
  from: Token
  target: Token
  raw: Pt[]
}

/**
 * Every moment where a player has genuinely run somewhere and nobody else is
 * drawn near him, so "the pen landed on the man I aimed at" has one answer.
 */
function aimCases(times = [600, 1200, 1800, 2400, 3000]): AimCase[] {
  const out: AimCase[] = []
  for (const scenario of SCENARIOS) {
    const { tokens, paths } = load(scenario)
    const end = timelineDuration(paths)
    for (const tMs of times) {
      if (tMs > end) continue
      const drawn = drawnAt(tokens, paths, tMs)
      for (const target of tokens) {
        if (target.side !== 'offense') continue
        const tip = drawn.get(target.id)!
        if (dist(tip, { x: target.x, y: target.y }) < 3) continue // he has not gone anywhere
        if (tokens.some((o) => o.id !== target.id && dist(drawn.get(o.id)!, tip) < 3)) continue
        const cands = tokens.filter(
          (o) => o.side === 'offense' && dist(drawn.get(o.id)!, tip) >= 6,
        )
        const from = cands.find((o) => o.pos === 'QB') ?? cands[0]
        if (!from) continue
        out.push({
          scenario: scenario.name,
          tMs,
          tokens,
          paths,
          drawn,
          from,
          target,
          raw: penStroke(drawn.get(from.id)!, tip),
        })
      }
    }
  }
  return out
}

let cached: AimCase[] | null = null
const cases = () => (cached ??= aimCases())

/** run a case's stroke through the pen, optionally without the drawn map */
const finish = (c: AimCase, withDrawn: boolean) =>
  finalizeStroke(c.raw, {
    zoom: ZOOM,
    tokens: c.tokens,
    paths: c.paths,
    renderedPositions: withDrawn ? c.drawn : undefined,
  })

/** the last snap's receiver — who is holding the ball when the play starts */
function holderAfterSnap(paths: PlayPath[], tokens: Token[]): string | null {
  const snap = paths.find((p) => p.type === 'snap' && p.endTokenId)
  return snap?.endTokenId ?? defaultBallStart(paths, tokens)
}

/** the moment the ball is in the first thrower's hands */
function snapEndMs(paths: PlayPath[]): number {
  return paths
    .filter((p) => p.type === 'snap')
    .reduce((m, p) => Math.max(m, p.timing.delayMs + p.timing.durationMs), 0)
}

/**
 * The delivery checklist needs the drawn flight's thrower to be *holding* the
 * ball when it is released, so these cases are the ones whose thrower is the man
 * who comes out of the snap with it.
 */
function deliveries(): { c: AimCase; name: string }[] {
  const out: { c: AimCase; name: string }[] = []
  for (const s of SCENARIOS) {
    const c = cases().find(
      (x) =>
        x.scenario === s.name &&
        x.from.id === holderAfterSnap(x.paths, x.tokens) &&
        dist({ x: x.from.x, y: x.from.y }, { x: x.target.x, y: x.target.y }) >= 6,
    )
    if (c) out.push({ c, name: s.name })
  }
  return out
}

/**
 * draw onto a moving man, call it a route, then relabel it — the checklist flow.
 * The scenario's own deliveries are dropped so this is the only ball in play, and
 * the stroke is handed over right after the snap: the moment its thrower has the
 * ball. (Placing it at the end of the play, as a chip drag would, is exactly the
 * inert case the possession rule now rejects.)
 */
function drawThenRelabel(c: AimCase, type: 'toss' | 'pass' | 'handoff') {
  const played = c.paths.filter((p) => !FLIGHT_TYPES.has(p.type) || p.type === 'snap')
  useEditorStore.setState({ tokens: c.tokens, paths: played, selectedIds: [] })
  const built = finish(c, true)!
  const id = st().addPath({ ...built, type: 'route' })
  st().updatePathType(id, type)
  st().setPathTimingLive(id, { delayMs: snapEndMs(played), durationMs: 450 })
  st().applyScheduleNow()
  return st().paths.find((p) => p.id === id)!
}

/** where the ball is just after a flight completes */
function ballAfter(p: PlayPath) {
  const paths = st().paths
  const tokens = st().tokens
  const t = p.timing.delayMs + p.timing.durationMs + 60
  const positions = new Map(tokens.map((x) => [x.id, { x: x.x, y: x.y }]))
  return ballStateAt(paths, positions, null, t, true, undefined, tokens)!
}

// ---------------------------------------------------------------------------

describe('A — the pen aims at where players are drawn, not where they started', () => {
  it('has cases worth checking, in every scenario', () => {
    expect(cases().length).toBeGreaterThan(50)
    const covered = new Set(cases().map((c) => c.scenario))
    expect([...covered].length).toBe(SCENARIOS.length)
  })

  it('every stroke onto a moving man resolves to that man', () => {
    const wrong = cases()
      .map((c) => ({ c, got: finish(c, true)?.endTokenId }))
      .filter((x) => x.got !== x.c.target.id)
      .map((x) => `${x.c.scenario}@${x.c.tMs}ms ${x.c.from.id}→${x.c.target.id} resolved ${x.got}`)
    expect(wrong).toEqual([])
  })

  it('measuring against rest spots instead gets every one of them wrong', () => {
    // Not just "sometimes": across the whole corpus the receiver has run far
    // enough, and far enough from his own route tip, that rest-spot geometry
    // finds nobody at all — so the stroke is inferred as a plain route, carries
    // no endTokenId, and the ball never changes hands. This is the reported bug
    // stated as an invariant over the 16 scenarios rather than one anecdote.
    const stale = cases().filter((c) => finish(c, false)?.endTokenId !== c.target.id)
    const survivors = cases()
      .filter((c) => finish(c, false)?.endTokenId === c.target.id)
      .map((c) => `${c.scenario}@${c.tMs}ms ${c.from.id}→${c.target.id}`)
    expect(survivors, 'these resolved correctly without the drawn map').toEqual([])
    expect(stale.length).toBe(cases().length)
  })

  it('a stroke that starts on nobody is refused', () => {
    const { tokens, paths } = load(SCENARIOS[0]!)
    const built = finalizeStroke(penStroke({ x: 5, y: 60 }, { x: 5, y: 48 }), {
      zoom: ZOOM,
      tokens,
      paths,
    })
    expect(built).toBeNull()
  })
})

describe('A — and the ball ends up with him, not with the thrower', () => {
  it('has a delivery to check in most scenarios', () => {
    expect(deliveries().length).toBeGreaterThanOrEqual(10)
  })

  for (const type of ['toss', 'pass', 'handoff'] as const) {
    it(`a stroke drawn onto a moving man and relabelled ${type} delivers to him`, () => {
      const failures: string[] = []
      for (const { c, name } of deliveries()) {
        const flight = drawThenRelabel(c, type)
        if (flight.type !== type || flight.endTokenId !== c.target.id) {
          failures.push(`${name}: ${type} resolved ${flight.endTokenId}`)
          continue
        }
        const ball = ballAfter(flight)
        const away = dist(ball.pos, { x: c.target.x, y: c.target.y })
        const throwerCarry = { x: c.from.x + 0.55, y: c.from.y - 0.35 }
        if (away > 1) failures.push(`${name}: ball ${away.toFixed(2)}yd from him`)
        if (dist(ball.pos, throwerCarry) <= 1) failures.push(`${name}: ball never left the thrower`)
      }
      expect(failures).toEqual([])
    })
  }
})

describe('B — a ball action with no pen at all', () => {
  it('delivers to the carrier in every scenario', () => {
    const failures: string[] = []
    for (const scenario of SCENARIOS) {
      reset()
      const { tokens, paths } = load(scenario)
      const from = tokens.find((t) => t.id === holderAfterSnap(paths, tokens))
      const to =
        tokens.find((t) => t.side === 'offense' && t.id !== from?.id && t.pos === 'RB') ??
        tokens.find((t) => t.side === 'offense' && t.id !== from?.id)
      if (!from || !to) {
        failures.push(`${scenario.name}: no pair to work with`)
        continue
      }

      const played = paths.filter((p) => !FLIGHT_TYPES.has(p.type) || p.type === 'snap')
      useEditorStore.setState({ paths: played })
      const id = st().addFlight(from.id, to.id, 'toss')
      if (!id) {
        failures.push(`${scenario.name}: no flight created`)
        continue
      }
      st().setPathTimingLive(id, { delayMs: snapEndMs(played), durationMs: 450 })
      st().applyScheduleNow()

      const flight = st().paths.find((p) => p.id === id)!
      const away = dist(ballAfter(flight).pos, { x: to.x, y: to.y })
      if (flight.endTokenId !== to.id || away > 1) {
        failures.push(`${scenario.name}: endTokenId ${flight.endTokenId}, away ${away.toFixed(2)}yd`)
      }
    }
    expect(failures).toEqual([])
  })

  it('armed → flight → disarmed, and a self-throw changes nothing', () => {
    const { tokens } = load(SCENARIOS[0]!)
    const qb = tokens.find((t) => t.pos === 'QB')!
    const rb = tokens.find((t) => t.pos === 'RB') ?? tokens.find((t) => t.pos === 'WR')!
    st().armBallAction(qb.id, 'toss')
    expect(st().ballAction).not.toBeNull()
    expect(st().addFlight(qb.id, qb.id, 'toss')).toBeNull()
    // a click that goes nowhere leaves the mode armed — the caller clears it
    expect(st().ballAction).not.toBeNull()
    st().addFlight(qb.id, rb.id, 'toss')
    expect(st().ballAction).toBeNull()
  })
})

describe('C — each ⇧ key picks its own concept, on either side of the field', () => {
  /**
   * Pinned independently of the source. Both tables state what the coach gets
   * for a keystroke, so a re-pointed binding or a reshaped concept fails here
   * instead of the test quietly agreeing with whatever it finds. (The first
   * version of this read `concept.breaks` and `ROUTE_KEYS[i].code`, which made
   * it blind to exactly the swaps it exists to catch.)
   */
  const BINDINGS: ReadonlyArray<readonly [code: string, key: string]> = [
    ['Digit1', 'go'],
    ['Digit2', 'post'],
    ['Digit3', 'corner'],
    ['Digit4', 'slant'],
    ['Digit5', 'hitch'],
    ['Digit6', 'out'],
    ['Digit7', 'in'],
    ['Digit8', 'cross'],
    ['Digit9', 'flat'],
    ['Digit0', 'screen'],
    ['Minus', 'angle'],
    ['Equal', 'wheel'],
  ]
  const BREAKS: Record<string, 'in' | 'out' | 'straight'> = {
    go: 'straight',
    post: 'in',
    corner: 'out',
    slant: 'in',
    hitch: 'out',
    out: 'out',
    in: 'in',
    cross: 'in',
    flat: 'out',
    screen: 'out',
    angle: 'out',
    wheel: 'out',
  }

  const pressShift = (code: string) =>
    applyShortcut({
      key: code.startsWith('Digit') ? '!' : code === 'Minus' ? '_' : '+',
      code,
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
    } as ShortcutEvent)

  const placeWr = (x: number) => {
    st().addToken({ side: 'offense', pos: 'WR', num: '', x, y: 88 })
    const id = st().tokens.at(-1)!.id
    useEditorStore.setState({ selectedIds: [id] })
    return id
  }

  it('is 12 keys for 12 concepts', () => {
    expect(ROUTE_KEYS).toHaveLength(ROUTE_CONCEPTS.length)
    expect(BINDINGS).toHaveLength(ROUTE_CONCEPTS.length)
  })

  it('binds the number row to those concepts, in library order', () => {
    const wrong = BINDINGS.filter(([code, key]) => routeForKeyCode(code)?.key !== key).map(
      ([code, key]) => `${code} → ${routeForKeyCode(code)?.key ?? 'nothing'}, wanted ${key}`,
    )
    expect(wrong).toEqual([])
  })

  it('binds nothing else in the row', () => {
    expect(routeForKeyCode('KeyA')).toBeNull()
    expect(routeForKeyCode('Backquote')).toBeNull()
  })

  it('describes every concept the way a coach would', () => {
    const wrong = ROUTE_CONCEPTS.filter((c) => c.breaks !== BREAKS[c.key]).map(
      (c) => `${c.label} says ${c.breaks}, expected ${BREAKS[c.key]}`,
    )
    expect(wrong).toEqual([])
  })

  BINDINGS.forEach(([code, key]) => {
    const concept = routeConcept(key)
    it(`⇧ on ${code} draws a ${concept.label} that breaks ${BREAKS[key]}`, () => {
      for (const x of [12, 41]) {
        reset()
        const wr = placeWr(x)
        pressShift(code)

        const route = st().paths.find((p) => p.tokenId === wr)
        expect(route, `${concept.label} created no route`).toBeTruthy()
        expect(route!.type).toBe('route')

        const lateral = route!.points.at(-1)!.x - route!.points[0]!.x
        const dir = BREAKS[key]!
        if (dir === 'straight') {
          expect(Math.abs(lateral), `${concept.label} from x=${x}`).toBeLessThan(0.2)
        } else {
          // 'in' is toward the middle: +x from the left hash side, −x from the right
          const inward = x < 26.65 ? 1 : -1
          expect(Math.sign(lateral), `${concept.label} from x=${x}`).toBe(
            dir === 'in' ? inward : -inward,
          )
        }
      }
    })
  })

  it('a second key reshapes the one route instead of stacking a second', () => {
    const wr = placeWr(12)
    pressShift('Digit1') // go — two points, dead straight
    expect(st().paths.filter((p) => p.tokenId === wr)).toHaveLength(1)
    expect(st().paths[0]!.points).toHaveLength(2)
    pressShift('Digit2') // post — three points, breaking in
    expect(st().paths.filter((p) => p.tokenId === wr)).toHaveLength(1)
    const route = st().paths[0]!
    expect(route.points).toHaveLength(3)
    expect(Math.sign(route.points.at(-1)!.x - route.points[0]!.x)).toBe(1)
  })

  it('routes go to offence only; blocks go to anyone', () => {
    st().addToken({ side: 'defense', pos: 'CB', num: '', x: 20, y: 84 })
    const cb = st().tokens.at(-1)!.id
    useEditorStore.setState({ selectedIds: [cb] })
    pressShift('Digit1')
    expect(st().paths).toHaveLength(0)

    pressShift('ArrowLeft')
    expect(st().paths).toHaveLength(1)
    expect(st().paths[0]!.type).toBe('block')
  })
})

describe('E — regressions around the pen and the digit keys', () => {
  it('a stroke drawn at rest is still a plain route from the player', () => {
    st().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const wr = st().tokens[0]!
    const built = finalizeStroke(penStroke({ x: 12, y: 88 }, { x: 13, y: 74 }), {
      zoom: ZOOM,
      tokens: st().tokens,
      paths: st().paths,
    })!
    expect(built.tokenId).toBe(wr.id)
    expect(built.type).toBe('route')
    expect(built.endTokenId).toBeNull()
  })

  it('digit 9 does nothing — a snap is never hand-picked', () => {
    load(SCENARIOS[0]!)
    const path = st().paths.find((p) => p.type === 'route')!
    useEditorStore.setState({ selectedIds: [path.id] })
    applyShortcut({ key: '9', code: 'Digit9' } as ShortcutEvent)
    expect(st().paths.find((p) => p.id === path.id)!.type).toBe('route')
  })

  it('a stroke drawn onto a player stops at his rim, not his centre', () => {
    const c = cases().find((x) => dist(x.raw[0]!, x.drawn.get(x.target.id)!) > 6)!
    const built = finish(c, true)!
    const tip = c.drawn.get(c.target.id)!
    const far = built.points.at(-1)!
    const gap = dist(far, tip)
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(1.5 + 1e-6)
  })

  it('a second stroke for the same player starts at his chain tip', () => {
    st().addToken({ side: 'offense', pos: 'WR', num: '', x: 12, y: 88 })
    const wr = st().tokens[0]!
    const first = finalizeStroke(penStroke({ x: 12, y: 88 }, { x: 12, y: 78 }), {
      zoom: ZOOM,
      tokens: st().tokens,
      paths: st().paths,
    })!
    expect(first.type).toBe('route')
    st().addPath({ ...first, type: 'route' })
    const tip = st().paths[0]!.points.at(-1)!
    expect(tip.y).toBeLessThan(88)

    // drawn back near where he started, as a coach would — it must still leave
    // from where his last movement ended, or he teleports back to his spot
    const second = finalizeStroke(penStroke({ x: 12, y: 88 }, { x: 24, y: 88 }), {
      zoom: ZOOM,
      tokens: st().tokens,
      paths: st().paths,
    })!
    expect(second.tokenId).toBe(wr.id)
    expect(second.points[0]).toEqual(tip)
  })
})

describe('F — how a toss finds its moment', () => {
  const place = (pos: Token['pos'], x: number, y: number) => {
    st().addToken({ side: 'offense', pos, num: '', x, y })
    return st().tokens.at(-1)!.id
  }

  it('fires right after the snap when the thrower never moves', () => {
    const c = place('C', 26.6, 93)
    const qb = place('QB', 26.6, 95)
    const rb = place('RB', 24, 96)
    st().addPath({
      tokenId: c,
      endTokenId: qb,
      type: 'snap',
      points: [{ x: 26.6, y: 93 }, { x: 26.6, y: 95 }],
      d: '',
    })
    st().addFlight(qb, rb, 'toss')
    const snap = st().paths.find((p) => p.type === 'snap')!
    const toss = st().paths.find((p) => p.type === 'toss')!
    expect(toss.timing.delayMs).toBe(snap.timing.delayMs + snap.timing.durationMs)
  })

  it('follows his drop when he has one', () => {
    const c = place('C', 26.6, 93)
    const qb = place('QB', 26.6, 95)
    const rb = place('RB', 24, 96)
    st().addPath({
      tokenId: c,
      endTokenId: qb,
      type: 'snap',
      points: [{ x: 26.6, y: 93 }, { x: 26.6, y: 95 }],
      d: '',
    })
    st().addPath({
      tokenId: qb,
      endTokenId: null,
      type: 'drop',
      points: [{ x: 26.6, y: 95 }, { x: 26.6, y: 100 }],
      d: '',
    })
    st().addFlight(qb, rb, 'toss')
    st().applyScheduleNow()
    const drop = st().paths.find((p) => p.type === 'drop')!
    const toss = st().paths.find((p) => p.type === 'toss')!
    expect(toss.timing.delayMs).toBe(drop.timing.delayMs + drop.timing.durationMs - 100)
    expect(toss.timing.delayMs).toBeGreaterThan(300)
  })
})
