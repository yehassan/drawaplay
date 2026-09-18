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
  { key: '34', dl: 3, lb: 4, cb: 2, s: 2, formation: 'Base 3-4' },
  { key: '43', dl: 4, lb: 3, cb: 2, s: 2, formation: 'Base 4-3' },
  { key: '52', dl: 5, lb: 2, cb: 2, s: 2, formation: 'Bear 5-2' },
  { key: '335', dl: 3, lb: 3, cb: 3, s: 2, formation: 'Nickel 3-3-5' },
  { key: 'dime', dl: 4, lb: 1, cb: 4, s: 2, formation: 'Dime 4-1-6' },
  { key: '326', dl: 3, lb: 2, cb: 4, s: 2, formation: 'Dime 3-2-6' },
  { key: '317', dl: 3, lb: 1, cb: 4, s: 3, formation: 'Dollar 3-1-7' },
  { key: '146', dl: 1, lb: 4, cb: 4, s: 2, formation: 'Quarter 1-4-6' },
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
 * |lat| 12.6, S depth 10.4 / |lat| 6.1; nickel (innermost CB) depth 2.8 /
 * |lat| 9.1. DL is synthetic (line play is untracked in that file) —
 * standard 4-man front at 0.8yd.
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

  /** safety shell shared by every front */
  const shells = (
    t: (id: string, pos: Token['pos'], dx: number, depth: number) => void,
    sh: Shell,
  ): void => {
    if (sh === '1-high') {
      // box safety + single-high (BDB 1-deep: ~7yd box / ~12.8yd high)
      t('SS', 'S', -6, 7)
      t('FS', 'S', 4, 12.5)
    } else {
      // two-high shell (BDB median depth 10.4 / |lat| 6.1)
      t('SS', 'S', -6, 10.5)
      t('FS', 'S', 6, 10.5)
    }
  }

  switch (front) {
    case 'dime': {
      // dime 4-1-6: textbook 4 corners + 2 safeties. The dimeback mirrors
      // the nickel over the opposite slot (BDB innermost-CB 2.8yd / |lat|
      // 9.1). BDB week-1 also shows teams playing a 3rd safety as the
      // 6th DB ~3:1 — kept as a future variant, not the default.
      tok('DL1', 'DL', -6.5, 0.8)
      tok('DL2', 'DL', -2.2, 0.8)
      tok('DL3', 'DL', 2.2, 0.8)
      tok('DL4', 'DL', 6.5, 0.8)
      tok('MIKE', 'LB', 0, 4.5)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      tok('NB', 'CB', 9, 2.5)
      tok('DIME', 'CB', -9, 2.5)
      shells(tok, shell)
      break
    }
    case '34': {
      // 3-4 base (BDB 4LB+2CB+2S plays, n=32): edge OLBs up on the
      // line (median depth 1.3 / |lat| 6.3), inside backers at
      // depth 4.0 / |lat| 2.5; 3-man line is synthetic
      tok('DL1', 'DL', -3.5, 0.8)
      tok('DL2', 'DL', 0, 0.8)
      tok('DL3', 'DL', 3.5, 0.8)
      tok('OLB1', 'LB', -6.3, 1.3)
      tok('OLB2', 'LB', 6.3, 1.3)
      tok('ILB1', 'LB', -2.5, 4)
      tok('ILB2', 'LB', 2.5, 4)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      shells(tok, shell)
      break
    }
    case '43': {
      // 4-3 — balanced 4-man line, MIKE + WILL/SAM off
      tok('DL1', 'DL', -6.5, 0.8)
      tok('DL2', 'DL', -2.2, 0.8)
      tok('DL3', 'DL', 2.2, 0.8)
      tok('DL4', 'DL', 6.5, 0.8)
      tok('MIKE', 'LB', 0, 3.5)
      tok('SAM', 'LB', -3.5, 3.5)
      tok('WILL', 'LB', 3.5, 3.5)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      shells(tok, shell)
      break
    }
    case '52': {
      // Bear 5-2 — 5 tight linemen clogging interior gaps
      tok('DL1', 'DL', -7.5, 0.8)
      tok('DL2', 'DL', -3.8, 0.8)
      tok('DL3', 'DL', 0, 0.8)
      tok('DL4', 'DL', 3.8, 0.8)
      tok('DL5', 'DL', 7.5, 0.8)
      tok('MIKE', 'LB', -2.5, 4)
      tok('WILL', 'LB', 2.5, 4)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      shells(tok, shell)
      break
    }
    case '335': {
      // Nickel 3-3-5 — 3-man line, triangle backers, nickel over slot
      tok('DL1', 'DL', -3.5, 0.8)
      tok('DL2', 'DL', 0, 0.8)
      tok('DL3', 'DL', 3.5, 0.8)
      tok('MIKE', 'LB', 0, 4)
      tok('SAM', 'LB', -3.5, 3.5)
      tok('WILL', 'LB', 3.5, 3.5)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      tok('NB', 'CB', 9, 2.5)
      shells(tok, shell)
      break
    }
    case '326': {
      // Dime 3-2-6 — 3-man line, 2 backers, 4 corners + 2 safeties
      tok('DL1', 'DL', -3.5, 0.8)
      tok('DL2', 'DL', 0, 0.8)
      tok('DL3', 'DL', 3.5, 0.8)
      tok('MIKE', 'LB', -2.5, 4)
      tok('WILL', 'LB', 2.5, 4)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      tok('NB', 'CB', 9, 2.5)
      tok('DIME', 'CB', -9, 2.5)
      shells(tok, shell)
      break
    }
    case '317': {
      // Dollar 3-1-7 — 7 DBs, single MIKE, extra deep safety
      tok('DL1', 'DL', -3.5, 0.8)
      tok('DL2', 'DL', 0, 0.8)
      tok('DL3', 'DL', 3.5, 0.8)
      tok('MIKE', 'LB', 0, 4.5)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      tok('NB', 'CB', 9, 2.5)
      tok('DIME', 'CB', -9, 2.5)
      shells(tok, shell)
      // 7th DB as deep middle
      tok('DOLLAR', 'S', 0, 15)
      break
    }
    case '146': {
      // Quarter 1-4-6 — 1 nose, 4 backers, 6 DBs (prevent)
      tok('NT', 'DL', 0, 0.8)
      tok('OLB1', 'LB', -6.3, 1.3)
      tok('OLB2', 'LB', 6.3, 1.3)
      tok('ILB1', 'LB', -2.5, 4)
      tok('ILB2', 'LB', 2.5, 4)
      tok('CB1', 'CB', -12.6, 4.2)
      tok('CB2', 'CB', 12.6, 4.2)
      tok('NB', 'CB', 9, 2.5)
      tok('DIME', 'CB', -9, 2.5)
      shells(tok, shell)
      break
    }
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
      // nickel over the slot (BDB innermost-CB median depth 2.8 / |lat| 9.1 —
      // ~1yd in front of the LB level, not on it)
      tok('NB', 'CB', 9, 2.5)
      shells(tok, shell)
      break
  }

  const def: DefenseFrontDef = DEFENSE_FRONTS.find((f) => f.key === front)!
  return {
    name: `${def.formation} · ${shell} · ${side === 'ours' ? 'Own' : 'Opp'} ${yardLine}`,
    tokens: toks,
  }
}
