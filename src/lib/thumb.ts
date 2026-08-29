import { PATH_STYLES } from './pathStyles'
import type { PlayPath, TextNote, Token } from '../stores/editorStore'
import { paletteFor, type FieldTheme } from './theme'

export interface ThumbPlay {
  tokens: Pick<Token, 'x' | 'y' | 'side'>[]
  paths: Pick<PlayPath, 'points' | 'type'>[]
  textNotes?: Pick<TextNote, 'x' | 'y' | 'text'>[]
}

/**
 * Static mini-preview of a play as an SVG string — pure, dependency-free,
 * safe for dangerouslySetInnerHTML in playbook cards.
 */
export function thumbSvg(
  tokens: ThumbPlay['tokens'],
  paths: ThumbPlay['paths'],
  theme: FieldTheme = 'green',
  textNotes: ThumbPlay['textNotes'] = [],
): string {
  const pal = paletteFor(theme)
  const ink = pal.line
  const routeInk = theme === 'white' ? '#24303c' : ink
  // content bbox with padding; fall back to a sensible window
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (x: number, y: number): void => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  for (const t of tokens) consider(t.x, t.y)
  for (const p of paths) for (const pt of p.points) consider(pt.x, pt.y)
  for (const n of textNotes) consider(n.x, n.y)

  if (!Number.isFinite(minX)) {
    minX = 10
    minY = 60
    maxX = 43
    maxY = 100
  }
  const pad = 4
  const w = Math.max(20, maxX - minX + pad * 2)
  const h = Math.max(28, maxY - minY + pad * 2)

  const parts: string[] = []
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}" preserveAspectRatio="xMidYMid meet">`,
  )
  parts.push(`<rect x="${(minX - pad).toFixed(1)}" y="${(minY - pad).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${pal.stripeA}"/>`)
  // LOS hint at the topmost token cluster? keep minimal: midfield-style line omitted.

  for (const p of paths) {
    const st = PATH_STYLES[p.type as keyof typeof PATH_STYLES] ?? PATH_STYLES.route
    if (p.points.length < 2) continue
    const d =
      p.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ')
    parts.push(
      `<path d="${d}" fill="none" stroke="${routeInk}" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"${st.dash ? ` stroke-dasharray="1.6 1"` : ''} opacity="0.95"/>`,
    )
  }
  for (const t of tokens) {
    const ring = t.side === 'offense' ? '#60a5fa' : '#f87171'
    parts.push(
      `<circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="0.85" fill="#101720" stroke="${ring}" stroke-width="0.22"/>`,
    )
  }
  for (const n of textNotes) {
    const txt = (n.text || 'Text').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    parts.push(`<text x="${n.x.toFixed(1)}" y="${n.y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="1.8" font-family="Oswald" font-weight="700" fill="${ink}">${txt}</text>`)
  }
  parts.push('</svg>')
  return parts.join('')
}
