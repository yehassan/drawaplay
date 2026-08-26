export type PathType =
  | 'route'
  | 'drop'
  | 'block'
  | 'pass'
  | 'handoff'
  | 'toss'
  | 'snap'
  | 'motion'
  | 'run'

export interface PathStyle {
  label: string
  color: string
  width: number
  /** stroke-dasharray in field units */
  dash?: string
  /** arrowhead marker id suffix */
  arrow?: 'chalk' | 'gold'
  /** wide translucent band underneath (run lanes) */
  band?: boolean
  /** filled dot at the end (ball spot for handoffs/snaps) */
  endDot?: boolean
}

export const CHALK = '#eef2f7'
export const GOLD = 'var(--color-ball-500)'

export const PATH_STYLES: Record<PathType, PathStyle> = {
  route: { label: 'Route', color: CHALK, width: 0.26, arrow: 'chalk' },
  drop: { label: 'Drop/Rollout', color: '#ffd166', width: 0.26, arrow: 'chalk' },
  block: { label: 'Block', color: '#aeb9c9', width: 0.24 },
  pass: { label: 'Pass', color: GOLD, width: 0.24, dash: '0.75 0.5', arrow: 'gold' },
  handoff: { label: 'Handoff', color: CHALK, width: 0.24, dash: '0.55 0.35', arrow: 'chalk', endDot: true },
  toss: { label: 'Toss', color: 'var(--color-ball-500)', width: 0.24, dash: '0.9 0.45', arrow: 'gold', endDot: true },
  snap: { label: 'Snap', color: CHALK, width: 0.24, endDot: true },
  motion: { label: 'Motion', color: CHALK, width: 0.17, dash: '0.12 0.42', arrow: 'chalk' },
  run: { label: 'Run lane', color: CHALK, width: 0.26, arrow: 'chalk', band: true },
}

export const PATH_TYPE_ORDER: readonly PathType[] = [
  'route',
  'drop',
  'block',
  'pass',
  'handoff',
  'toss',
  'snap',
  'motion',
  'run',
]

/** path types whose anchor player travels along the path; the rest are ball-only */
export const PLAYER_DRIVEN: ReadonlySet<PathType> = new Set([
  'route',
  'drop',
  'run',
  'motion',
  'block',
])

/** compact uppercase names for timeline chips */
export const SHORT_LABELS: Record<PathType, string> = {
  route: 'Route',
  drop: 'Drop',
  block: 'Block',
  pass: 'Pass',
  handoff: 'Handoff',
  toss: 'Toss',
  snap: 'Snap',
  motion: 'Motion',
  run: 'Run',
}
