import type { Token } from '../stores/editorStore'

export type Hash = 'center' | 'left' | 'right'

export const FIELD_CENTER_X = 26.65
/** NFL hash-mark centers */
export const HASH_X: Record<Hash, number> = {
  center: FIELD_CENTER_X,
  left: 23.583,
  right: 29.75,
}

/**
 * Offense attacks toward decreasing y (top of screen = opponent's end zone at y=10;
 * own goal line at y=110).
 */
export function losY(side: 'ours' | 'theirs', yardLine: number): number {
  return side === 'ours' ? 110 - yardLine : 10 + yardLine
}

export interface PersonnelDef {
  key: string
  rb: number
  te: number
  wr: number
  formation: string
  /** suggested snap alignment */
  uc: boolean
}

export const PERSONNEL: PersonnelDef[] = [
  { key: '23', rb: 2, te: 3, wr: 0, formation: 'Goal-line I-Form', uc: true },
  { key: '22', rb: 2, te: 2, wr: 1, formation: 'Unbalanced I-Form', uc: true },
  { key: '21', rb: 2, te: 1, wr: 2, formation: 'Balanced I-Form', uc: true },
  { key: '20', rb: 2, te: 0, wr: 3, formation: 'Strong I-Form', uc: true },
  { key: '13', rb: 1, te: 3, wr: 1, formation: 'Balanced Inline', uc: true },
  { key: '12', rb: 1, te: 2, wr: 2, formation: 'Overload TE Left · Twins Right', uc: true },
  { key: '11', rb: 1, te: 1, wr: 3, formation: 'Balanced Shotgun', uc: false },
  { key: '10', rb: 1, te: 0, wr: 4, formation: 'Shotgun Trips', uc: false },
  { key: '02', rb: 0, te: 2, wr: 3, formation: 'Spread Empty · Flex TE', uc: false },
  { key: '01', rb: 0, te: 1, wr: 4, formation: 'Empty Flex Slot', uc: false },
  { key: '00', rb: 0, te: 0, wr: 5, formation: 'Compressed 5-WR', uc: false },
]

interface SeedToken extends Omit<Token, 'id'> {
  id: string
}

export interface FormationSpec {
  personnel: string
  underCenter: boolean
  hash: Hash
  side: 'ours' | 'theirs'
  yardLine: number
}

export interface BuiltFormation {
  name: string
  tokens: SeedToken[]
  snap: { tokenId: string; endTokenId: string; points: [{ x: number; y: number }, { x: number; y: number }] }
}

/** all coords: dx relative to ball x, dy = yards BEHIND the LOS (positive) */
export function buildFormation(spec: FormationSpec): BuiltFormation {
  const { personnel, underCenter, hash, side, yardLine } = spec
  const bx = HASH_X[hash]
  const ly = losY(side, yardLine)
  const qbDy = underCenter ? 1.6 : 5

  const toks: SeedToken[] = []
  const tok = (
    _id_num_unused: string,
    pos: Token['pos'],
    dx: number,
    dyBehindLosOrAbs: number,
    letter?: string,
    absoluteY = false,
  ): void => {
    toks.push({
      id: _id_num_unused,
      side: 'offense',
      pos,
      num: '',
      letter,
      x: Math.max(1.5, Math.min(51.8, bx + dx)),
      y: absoluteY ? dyBehindLosOrAbs : ly + dyBehindLosOrAbs,
    })
  }

  // offensive line on the ball
  tok('LT', 'T', -3.6, 0)
  tok('LG', 'G', -1.8, 0)
  tok('C', 'C', 0, 0, '61')
  tok('RG', 'G', 1.8, 0)
  tok('RT', 'T', 3.6, 0)

  // quarterback
  tok('QB', 'QB', 0, qbDy, '')

  switch (personnel) {
    case '23':
      tok('RB1', 'RB', 0, 3.6, 'F')
      tok('RB2', 'RB', 0, 5.6, 'T')
      tok('TE1', 'TE', -5.4, 0, 'Y')
      tok('TE2', 'TE', 5.4, 0, 'U')
      tok('TE3', 'TE', 6.9, 0.85, 'H')
      break
    case '22':
      tok('RB1', 'RB', 0, 3.6, 'F')
      tok('RB2', 'RB', 0, 5.6, 'T')
      tok('TE1', 'TE', 5.4, 0, 'Y')
      tok('TE2', 'TE', 7.05, 0, 'U')
      tok('WR1', 'WR', -16, 0.3, 'X')
      break
    case '21':
      tok('RB1', 'RB', 0, 3.6, 'F')
      tok('RB2', 'RB', 0, 5.6, 'T')
      tok('TE1', 'TE', -5.4, 0, 'Y')
      tok('WR1', 'WR', -9, 0.3, 'X')
      tok('WR2', 'WR', 9, 0.3, 'Z')
      break
    case '20':
      tok('RB1', 'RB', -1.2, 3.9, 'F')
      tok('RB2', 'RB', 0, 5.6, 'T')
      tok('WR1', 'WR', -17, 0.2, 'X')
      tok('WR2', 'WR', 9, 0.6, 'H')
      tok('WR3', 'WR', 17, 0.2, 'Z')
      break
    case '13':
      tok('RB1', 'RB', 0, 4.6, 'T')
      tok('TE1', 'TE', -5.4, 0, 'Y')
      tok('TE2', 'TE', 5.4, 0, 'U')
      tok('TE3', 'TE', -6.9, 0.85, 'H')
      tok('WR1', 'WR', 16, 0.2, 'X')
      break
    case '12':
      tok('RB1', 'RB', 0, 4.6, 'T')
      tok('TE1', 'TE', -5.4, 0, 'Y')
      tok('TE2', 'TE', -7.05, 0, 'U')
      tok('WR1', 'WR', 10, 0.6, 'H')
      tok('WR2', 'WR', 17, 0.2, 'Z')
      break
    case '11':
      tok('RB1', 'RB', -1.55, 5.35, 'T')
      tok('TE1', 'TE', 5.4, 0, 'Y')
      tok('WR1', 'WR', -17, 0.2, 'X')
      tok('WR2', 'WR', -10, 0.6, 'H')
      tok('WR3', 'WR', 17, 0.2, 'Z')
      break
    case '10':
      tok('RB1', 'RB', -1.55, 5.35, 'T')
      tok('WR1', 'WR', -17, 0.2, 'X')
      tok('WR2', 'WR', 9, 0.7, 'H')
      tok('WR3', 'WR', 13, 0.45, 'Y')
      tok('WR4', 'WR', 17, 0.2, 'Z')
      break
    case '02':
      tok('TE1', 'TE', 6, 0.5, 'Y')
      tok('TE2', 'TE', -10, 0.6, 'U')
      tok('WR1', 'WR', -17, 0.2, 'X')
      tok('WR2', 'WR', 10, 0.6, 'H')
      tok('WR3', 'WR', 17, 0.2, 'Z')
      break
    case '01':
      tok('TE1', 'TE', -10.5, 0.6, 'Y')
      tok('WR1', 'WR', -17, 0.2, 'X')
      tok('WR2', 'WR', 10, 0.55, 'H')
      tok('WR3', 'WR', 13.8, 0.95, 'F')
      tok('WR4', 'WR', 17, 0.2, 'Z')
      break
    case '00':
      tok('WR2', 'WR', -10, 0.7, 'X')
      tok('WR1', 'WR', -7, 0.4, 'H')
      tok('WR3', 'WR', 6.5, 0.35, 'F')
      tok('WR4', 'WR', 8.8, 0.75, 'Y')
      tok('WR5', 'WR', 11.2, 0.4, 'Z')
      break
    default:
      tok('RB1', 'RB', 0, 4.5, 'T')
      tok('WR1', 'WR', -15, 0.2, 'X')
      tok('WR2', 'WR', 15, 0.2, 'Z')
      tok('TE1', 'TE', 5.4, 0, 'Y')
  }

  const qb = toks.find((t) => t.id === 'QB')!
  const def: PersonnelDef = PERSONNEL.find((p) => p.key === personnel)!
  return {
    name: `${def?.key ?? personnel} Personnel · ${side === 'ours' ? 'Own' : 'Opp'} ${yardLine}`,
    tokens: toks,
    snap: {
      tokenId: 'C',
      endTokenId: 'QB',
      points: [
        { x: bx, y: ly },
        { x: qb.x, y: qb.y },
      ],
    },
  }
}
