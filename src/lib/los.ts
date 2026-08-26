/** LOS metadata shared by quickstart, store, persistence, and exports. */
export interface LosSpecLike {
  side: 'ours' | 'theirs'
  n: number
}

export function losLabel(los: LosSpecLike | null | undefined): string | null {
  if (!los) return null
  return `${los.side === 'ours' ? 'OWN' : 'OPP'} ${los.n}`
}
