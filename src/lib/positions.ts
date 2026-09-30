import type { PosId, Side } from '../stores/editorStore'

export const POSITIONS: Record<PosId, { label: string; side: Side }> = {
  QB: { label: 'QB', side: 'offense' },
  RB: { label: 'RB', side: 'offense' },
  FB: { label: 'FB', side: 'offense' },
  WR: { label: 'WR', side: 'offense' },
  TE: { label: 'TE', side: 'offense' },
  C: { label: 'C', side: 'offense' },
  G: { label: 'G', side: 'offense' },
  T: { label: 'T', side: 'offense' },
  DL: { label: 'DL', side: 'defense' },
  LB: { label: 'LB', side: 'defense' },
  CB: { label: 'CB', side: 'defense' },
  S: { label: 'S', side: 'defense' },
}

export const PALETTE_GROUPS: ReadonlyArray<{ side: Side; title: string; positions: readonly PosId[] }> = [
  {
    side: 'offense',
    title: 'Offense',
    positions: ['QB', 'RB', 'FB', 'WR', 'TE', 'C', 'G', 'T'],
  },
  { side: 'defense', title: 'Defense', positions: ['DL', 'LB', 'CB', 'S'] },
]

export const ALIGNMENT_TOKENS: ReadonlyArray<{ pos: PosId; letter: string; title: string }> = [
  { pos: 'WR', letter: 'X', title: 'X — split end' },
  { pos: 'WR', letter: 'Z', title: 'Z — flanker' },
  { pos: 'WR', letter: 'H', title: 'H — slot' },
  { pos: 'WR', letter: 'F', title: 'F — middle slot' },
  { pos: 'TE', letter: 'Y', title: 'Y — in-line TE' },
  { pos: 'TE', letter: 'U', title: 'U — wing/flex TE' },
]
