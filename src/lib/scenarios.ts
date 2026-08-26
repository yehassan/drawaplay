import type { PathType } from './pathStyles'
import type { PlayPath, Token } from '../stores/editorStore'

type Seg = [number, number][]

interface SeedPath {
  tokenId: string
  endTokenId?: string | null
  type: PathType
  seg: Seg
}

interface SeedToken extends Token {
  x: number
  y: number
}

export interface Scenario {
  name: string
  description: string
  build(): { tokens: Token[]; paths: Omit<PlayPath, 'id' | 'timing'>[]; name: string }
}

const T = (id: string, side: 'offense' | 'defense', pos: SeedToken['pos'], x: number, y: number): SeedToken => ({ id, side, pos, num: '', x, y })
const P = (tokenId: string, type: PathType, seg: Seg, endTokenId?: string): SeedPath => ({ tokenId, type, seg, endTokenId })

function build(name: string, tokens: SeedToken[], seeds: SeedPath[]): Scenario['build'] {
  return () => ({
    name,
    tokens: tokens.map((t) => ({ ...t })),
    paths: seeds.map((s) => ({
      tokenId: s.tokenId,
      endTokenId: s.endTokenId ?? null,
      type: s.type,
      points: s.seg.map(([x, y]) => ({ x, y })),
      d: '',
    })),
  })
}

// shared personnel
const OFFENSE_LINE: SeedToken[] = [
  T('LT', 'offense', 'T', 22.9, 89.7),
  T('C', 'offense', 'C', 26.5, 90),
  T('RT', 'offense', 'T', 30.1, 89.7),
]
const DEFENSE_FRONT: SeedToken[] = [
  T('DL1', 'defense', 'DL', 22.5, 86),
  T('DL2', 'defense', 'DL', 30.5, 86),
]

export const SCENARIOS: Scenario[] = [
  {
    name: 'Slant–flat (stationary QB)',
    description: 'Quick game: two routes off a snap, pass synced to the flat tip.',
    build: build(
      'Slant–Flat',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 93),
        T('WR1', 'offense', 'WR', 12, 88.5),
        T('WR2', 'offense', 'WR', 41, 88.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('LT', 'block', [[21.5, 89], [22.3, 87]]),
        P('RT', 'block', [[31.5, 89], [30.7, 87]]),
        P('WR1', 'route', [[12, 88], [14.5, 83.5], [17, 79]]),
        P('WR2', 'route', [[41, 88], [47.2, 86.9]]),
        P('QB', 'pass', [[26.4, 92.4], [36, 88.5], [46.6, 87.1]], 'WR2'),
      ],
    ),
  },
  {
    name: 'Rollout + comeback',
    description: 'Slow QB rollout gates the throw; ball meets the comeback at its break.',
    build: build(
      'Rollout Comeback',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 93),
        T('WR1', 'offense', 'WR', 41, 88.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('QB', 'drop', [[26.6, 93], [21.5, 91.5], [18.5, 89.5]]),
        P('WR1', 'route', [[41, 88], [40, 81.5], [44, 78]]),
        P('QB', 'pass', [[18.5, 89.3], [30, 82], [43.8, 78.3]], 'WR1'),
      ],
    ),
  },
  {
    name: 'Dropback + curl',
    description: 'Three-step drop at QB cadence; curl arrives as the ball does.',
    build: build(
      'Dropback Curl',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 95),
        T('WR1', 'offense', 'WR', 40, 88.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 94.6]], 'QB'),
        P('QB', 'drop', [[26.5, 95.2], [26.2, 91], [26, 88.5]]),
        P('WR1', 'route', [[40, 88], [38.5, 82.5], [42.5, 78], [45, 80.5]]),
        P('QB', 'pass', [[26, 88.3], [33.5, 83.5], [44.6, 80.8]], 'WR1'),
      ],
    ),
  },
  {
    name: 'Dive: snap → handoff → run chain',
    description: 'RB steps to the LOS, handoff meets him there, run lane continues.',
    build: build(
      'Dive Chain',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 86.5),
        T('RB', 'offense', 'RB', 25.8, 94.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('RB', 'route', [[25.8, 94], [25.9, 91.6]]),
        P('QB', 'handoff', [[26.4, 92.8], [25.95, 91.4]], 'RB'),
        P('RB', 'run', [[25.95, 91.4], [25.4, 80], [25, 70]]),
      ],
    ),
  },
  {
    name: 'Double read: screen + post',
    description: 'Two throws off one QB — both fly, chronologically.',
    build: build(
      'Double Read',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 93),
        T('WR1', 'offense', 'WR', 12, 88.5),
        T('WR2', 'offense', 'WR', 40, 88.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('WR1', 'motion', [[12, 88], [15, 85.5]]),
        P('WR1', 'route', [[15, 85.3], [14, 80.5], [13.5, 76.5]]),
        P('WR2', 'route', [[40, 88], [39, 81.5], [43.5, 75]]),
        P('QB', 'pass', [[26.3, 92.3], [16, 80], [13.8, 76.9]], 'WR1'),
        P('QB', 'pass', [[26.3, 92.3], [34, 80], [43, 75.4]], 'WR2'),
      ],
    ),
  },
  {
    name: 'Direct-snap RB run',
    description: 'Center default holder: snap goes straight to the RB.',
    build: build(
      'Direct Snap Run',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 33, 92),
        T('RB', 'offense', 'RB', 27.4, 91.6),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [27.3, 91.3]], 'RB'),
        P('RB', 'run', [[27.35, 91.45], [28, 80], [28.5, 70]]),
      ],
    ),
  },
  {
    name: 'Pre-snap motion + slant',
    description: 'Motion settles before the snap; everything downstream shifts.',
    build: build(
      'Motion Slant',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 93),
        T('WR1', 'offense', 'WR', 12, 88.5),
        T('WR2', 'offense', 'WR', 41, 88.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('WR1', 'motion', [[12, 88], [17.5, 85.5]]),
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('WR1', 'route', [[17.5, 85.3], [20.5, 80.5], [23, 77]]),
        P('QB', 'pass', [[26.3, 92.3], [24.5, 84], [22.6, 77.4]], 'WR1'),
      ],
    ),
  },
  {
    name: 'Toss sweep',
    description: 'QB pitches outside to the RB sweeping; ball meets him at the turn.',
    build: build(
      'Toss Sweep',
      [
        ...OFFENSE_LINE,
        T('QB', 'offense', 'QB', 26.5, 93),
        T('RB', 'offense', 'RB', 25.5, 94.5),
        ...DEFENSE_FRONT,
      ],
      [
        P('C', 'snap', [[26.5, 90], [26.5, 92.6]], 'QB'),
        P('RB', 'route', [[25.5, 94], [28, 92.5], [32, 90.8]]),
        P('QB', 'toss', [[26.4, 92.4], [29.5, 91.2], [31.6, 90.9]], 'RB'),
        P('RB', 'run', [[32, 90.7], [34, 82], [35.5, 72]]),
      ],
    ),
  },
]

/** convenience for the picker */
export function loadScenario(scenario: Scenario) {
  const built = scenario.build()
  return { name: scenario.name, tokens: built.tokens, paths: built.paths }
}
