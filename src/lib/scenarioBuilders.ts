import type { PathType } from './pathStyles'
import type { PlayPath, Token } from '../stores/editorStore'
import { simplifyRDP } from './geometry'
import type { Timing } from './timing'

type Seg = [number, number][]

export interface SeedPath {
  tokenId: string
  endTokenId?: string | null
  type: PathType
  seg: Seg
  /** real frame-derived timing (10Hz): preserved verbatim via userLocked */
  timing?: Timing
}

export interface SeedToken extends Token {
  x: number
  y: number
}

export interface SeedText {
  x: number
  y: number
  text: string
}

export interface Scenario {
  name: string
  description: string
  build(): { tokens: Token[]; paths: (Omit<PlayPath, 'id' | 'timing'> & { timing?: Timing })[]; textNotes: { id: string; x: number; y: number; text: string }[]; name: string }
}

export const tok = (
  id: string,
  side: 'offense' | 'defense',
  pos: SeedToken['pos'],
  x: number,
  y: number,
  num = '',
): SeedToken => ({ id, side, pos, num, x, y })
export const path = (tokenId: string, type: PathType, seg: Seg, endTokenId?: string | null, timing?: Timing): SeedPath => ({ tokenId, type, seg, endTokenId, timing })

/**
 * Tracking-data seeds carry 10Hz sampling jitter (e.g. the ball hook at the
 * catch). Same RDP pass the pen uses, tuned for yards: eps 1.0 kills the
 * ~0.9yd catch hook but keeps real breaks (hitch/slant cuts deviate yards).
 */
export const bdb = (seg: Seg): Seg => {
  const pts = seg.map(([x, y]) => ({ x, y }))
  return simplifyRDP(pts, 1.0).map((p) => [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10] as [number, number])
}
/** tracking-data path: same RDP pass as bdb(), plus real frame timing */
export const pbdb = (tokenId: string, type: PathType, seg: Seg, endTokenId?: string | null, timing?: Timing): SeedPath =>
  path(tokenId, type, bdb(seg), endTokenId, timing)

export function build(name: string, tokens: SeedToken[], seeds: SeedPath[], texts: SeedText[] = []): Scenario['build'] {
  return () => ({
    name,
    tokens: tokens.map((t) => ({ ...t })),
    paths: seeds.map((s) => ({
      tokenId: s.tokenId,
      endTokenId: s.endTokenId ?? null,
      type: s.type,
      points: s.seg.map(([x, y]) => ({ x, y })),
      d: '',
      ...(s.timing ? { timing: s.timing, userLocked: true } : {}),
    })),
    textNotes: texts.map((t, i) => ({ id: `txt${i}`, ...t })),
  })
}
