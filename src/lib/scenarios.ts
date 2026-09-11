import type { PathType } from './pathStyles'
import type { PlayPath, Token } from '../stores/editorStore'
import { simplifyRDP } from './geometry'

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

interface SeedText {
  x: number
  y: number
  text: string
}

export interface Scenario {
  name: string
  description: string
  build(): { tokens: Token[]; paths: Omit<PlayPath, 'id' | 'timing'>[]; textNotes: { id: string; x: number; y: number; text: string }[]; name: string }
}

const T = (id: string, side: 'offense' | 'defense', pos: SeedToken['pos'], x: number, y: number): SeedToken => ({ id, side, pos, num: '', x, y })
const P = (tokenId: string, type: PathType, seg: Seg, endTokenId?: string): SeedPath => ({ tokenId, type, seg, endTokenId })

/**
 * Tracking-data seeds carry 10Hz sampling jitter (e.g. the ball hook at the
 * catch). Same RDP pass the pen uses, tuned for yards: eps 1.0 kills the
 * ~0.9yd catch hook but keeps real breaks (hitch/slant cuts deviate yards).
 */
const BDB = (seg: Seg): Seg => {
  const pts = seg.map(([x, y]) => ({ x, y }))
  return simplifyRDP(pts, 1.0).map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number])
}
/** tracking-data path: same RDP pass as BDB() */
const PBDB = (tokenId: string, type: PathType, seg: Seg, endTokenId?: string): SeedPath =>
  P(tokenId, type, BDB(seg), endTokenId)

function build(name: string, tokens: SeedToken[], seeds: SeedPath[], texts: SeedText[] = []): Scenario['build'] {
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
    textNotes: texts.map((t, i) => ({ id: `txt${i}`, ...t })),
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
  {
    name: 'BDB: Julio hitch vs Mills (real tracking)',
    description: '2018 week-1 NFL tracking (ATL@PHI): hitch, bail coverage, real ball arc. Timing re-derived by the app.',
    build: build(
      'BDB Hitch',
      [
        T('QB', 'offense', 'QB', 26.7, 91.7),
        T('WR1', 'offense', 'WR', 44.1, 91.4),
        T('CB1', 'defense', 'CB', 43.4, 83.9),
      ],
      [
        PBDB('QB', 'drop', [[26.7, 91.7], [26.7, 92.1], [26.5, 93.9], [26.4, 95.9], [26.7, 96.5], [27.1, 96.2], [27.7, 96.2]]),
        PBDB('WR1', 'route', [[44.1, 91.4], [44.1, 91.0], [44.0, 88.4], [44.1, 86.4], [44.5, 82.4], [44.8, 81.0], [45.9, 80.2], [47.9, 81.1], [49.2, 81.5]]),
        PBDB('CB1', 'route', [[43.4, 83.9], [43.5, 83.8], [43.8, 82.6], [44.3, 80.1], [44.6, 78.5], [44.9, 77.0], [45.4, 74.8], [47.1, 74.4], [48.4, 74.9]]),
        PBDB('QB', 'pass', [[27.0, 96.9], [29.4, 95.7], [33.9, 92.2], [37.8, 89.4], [41.5, 86.7], [44.9, 84.3]], 'WR1'),
      ],
      [{ x: 45.5, y: 78.5, text: 'HITCH' }],
    ),
  },
  {
    name: 'BDB: full play — DAL@CAR shovel-pass TD drive (real tracking)',
    description: '2018 week-1 NFL tracking: all 13 tracked players (lines untracked), slant vs tight man, contested catch, tackle. Timing re-derived by the app.',
    build: build(
      'BDB Full Play',
      [
        T('QB', 'offense', 'QB', 24.2, 68.7),
        T('RB', 'offense', 'RB', 22.1, 69.4),
        T('WR1', 'offense', 'WR', 8.7, 65.3),
        T('WR2', 'offense', 'WR', 36.4, 66.2),
        T('WR3', 'offense', 'WR', 46.5, 66.2),
        T('TE', 'offense', 'TE', 28.5, 65.4),
        T('LB1', 'defense', 'LB', 26.4, 61.0),
        T('LB2', 'defense', 'LB', 21.2, 62.2),
        T('CB1', 'defense', 'CB', 46.3, 63.5),
        T('CB2', 'defense', 'CB', 36.1, 63.3),
        T('CB3', 'defense', 'CB', 8.6, 59.2),
        T('FS', 'defense', 'S', 25.9, 44.8),
        T('SS', 'defense', 'S', 28.8, 63.0),
      ],
      [
        PBDB('QB', 'drop', [[24.2, 68.7], [24.2, 68.9], [23.8, 69.2], [23.3, 69.5], [22.3, 69.9]]),
        PBDB('RB', 'route', [[22.1, 69.4], [22.5, 69.2], [24.9, 67.7], [26.6, 66.3], [26.4, 65.9]]),
        PBDB('WR1', 'route', [[8.7, 65.3], [8.6, 64.1], [8.7, 62.5], [10.8, 59.4], [12.7, 58.5], [16.8, 58.2]]),
        PBDB('WR2', 'route', [[36.4, 66.2], [37.3, 66.4], [40.6, 66.5], [43.8, 65.8], [45.4, 65.4]]),
        PBDB('WR3', 'route', [[46.5, 66.2], [46.6, 65.8], [47.4, 63.9], [49.4, 61.2], [49.8, 57.6]]),
        PBDB('TE', 'route', [[28.5, 65.4], [29.5, 65.4], [31.0, 66.1], [32.9, 66.2], [33.5, 66.0]]),
        PBDB('LB1', 'route', [[26.4, 61.0], [26.9, 61.4], [27.7, 62.6], [28.6, 62.6], [30.0, 62.6]]),
        PBDB('LB2', 'route', [[21.2, 62.2], [21.5, 63.1], [22.3, 65.3], [22.8, 67.8], [23.0, 69.4]]),
        PBDB('CB1', 'route', [[46.3, 63.5], [46.4, 63.4], [47.0, 62.4], [49.0, 60.3], [49.9, 56.9]]),
        PBDB('CB2', 'route', [[36.1, 63.3], [36.4, 63.2], [38.8, 63.3], [42.5, 63.9], [45.3, 64.2]]),
        PBDB('CB3', 'route', [[8.6, 59.2], [8.5, 58.3], [8.6, 57.6], [10.5, 56.6], [12.4, 57.1], [16.8, 58.5]]),
        PBDB('FS', 'route', [[25.9, 44.8], [26.0, 44.6], [25.6, 44.0], [23.9, 44.8], [21.5, 47.9]]),
        PBDB('SS', 'route', [[28.8, 63.0], [28.9, 63.3], [29.0, 65.0], [29.4, 65.8], [31.3, 65.9]]),
        PBDB('QB', 'pass', [[24.4, 69.2], [24.6, 69.2], [20.2, 64.8], [17.2, 61.8], [14.5, 59.0], [15.0, 58.1]], 'WR1'),
      ],
      [
        { x: 13.5, y: 60.5, text: 'SLANT' },
        { x: 41, y: 68, text: 'SCREEN' },
        { x: 51.5, y: 59.5, text: 'GO' },
        { x: 24, y: 64, text: 'FLAT' },
      ],
    ),
  },
]

/** convenience for the picker */
export function loadScenario(scenario: Scenario) {
  const built = scenario.build()
  return { name: scenario.name, tokens: built.tokens, paths: built.paths }
}
