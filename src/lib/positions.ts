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
