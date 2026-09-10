import type { Token } from '../stores/editorStore'
import { HASH_X, losY, type Hash } from './formations'

export type Shell = '1-high' | '2-high'

export interface DefenseFrontDef {
  key: string
  dl: number
  lb: number
  cb: number
  s: number
  formation: string
}

export const DEFENSE_FRONTS: DefenseFrontDef[] = [
  { key: 'nickel', dl: 4, lb: 2, cb: 3, s: 2, formation: 'Nickel 4-2-5' },
]

export const DEFENSE_SHELLS: ReadonlyArray<{ key: Shell; label: string; hint: string }> = [
  { key: '1-high', label: '1-High', hint: 'single-high safety, SS in the box' },
  { key: '2-high', label: '2-High', hint: 'two-high safeties' },
]

interface SeedToken extends Omit<Token, 'id'> {
  id: string
}

export interface DefenseSpec {
  front: string
  shell: Shell
  hash: Hash
  side: 'ours' | 'theirs'
  yardLine: number
}

export interface BuiltDefense {
  name: string
  tokens: SeedToken[]
}

/**
 * All coords: dx lateral from the ball x, depth = yards on the DEFENSIVE
 * side of the LOS (positive toward the defense's own goal).
 *
 * LB/DB numbers are frame-1 medians from bdbtrackingdata/week1.csv
 * (2018 tracking, 1034 plays): LB depth 3.5 / |lat| 3.5, CB depth 4.2 /
 * |lat| 12.6, S depth 10.4 / |lat| 6.1. DL is synthetic (line play is
 * untracked in that file) — standard 4-man front at 0.8yd.
 */
export function buildDefenseFormation(spec: DefenseSpec): BuiltDefense {
  const { front, shell, hash, side, yardLine } = spec
  const bx = HASH_X[hash]
  const ly = losY(side, yardLine)

  const toks: SeedToken[] = []
  const tok = (id: string, pos: Token['pos'], dx: number, depth: number): void => {
    toks.push({
      id,
      side: 'defense',
      pos,
      num: '',
      x: Math.max(1.5, Math.min(51.8, bx + dx)),
      y: ly - depth,
    })
  }

  switch (front) {
    case 'nickel':
    default:
      // 4-man line (synthetic — untracked in BDB week1)
      tok('DL1', 'DL', -6.5, 0.8)
      tok('DL2', 'DL', -2.2, 0.8)
      tok('DL3', 'DL', 2.2, 0.8)
      tok('DL4', 'DL', 6.5, 0.8)
      // linebackers (BDB median depth 3.5 / |lat| 3.5)
      tok('LB1', 'LB', -3.5, 3.5)
      tok('LB2', 'LB', 3.5, 3.5)
      // outside corners (BDB median depth 4.2 / |lat| 12.6)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      // nickel back over the slot
      tok('NB', 'CB', 6, 3)
      if (shell === '1-high') {
        // box safety + single-high (BDB 1-deep: ~7yd box / ~12.8yd high)
        tok('SS', 'S', -6, 7)
        tok('FS', 'S', 4, 12.5)
      } else {
        // two-high shell (BDB median depth 10.4 / |lat| 6.1)
        tok('SS', 'S', -6, 10.5)
        tok('FS', 'S', 6, 10.5)
      }
      break
  }

  const def: DefenseFrontDef = DEFENSE_FRONTS.find((f) => f.key === front)!
  return {
    name: `${def.formation} · ${shell} · ${side === 'ours' ? 'Own' : 'Opp'} ${yardLine}`,
    tokens: toks,
  }
}
