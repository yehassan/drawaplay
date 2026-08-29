import { hashX, numberX, type Ruleset } from './field'
import { PATH_STYLES } from './pathStyles'
import { POSITIONS } from './positions'
import { paletteFor, styleColor, type FieldTheme } from './theme'
import type { Scene } from './render'
import type { LosSpecLike } from './los'
import type { ViewRect } from './render'
import type { TextNote, Token } from '../stores/editorStore'

const CHALK = '#eaf3ea'

export const FIELD_W_YD = 53.3
export const FIELD_L_YD = 120

/** Paint the full animated frame for a scene onto a 2D context (scale = px/yd). */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  input: Scene & { tokens: Token[]; textNotes?: TextNote[] },
  opts: { scale: number; losSpec?: LosSpecLike | null; view?: ViewRect; theme?: FieldTheme; ruleset?: Ruleset },
): void {
  const theme: FieldTheme = opts.theme ?? 'green'
  const pal = paletteFor(theme)
  const s = opts.scale
  const view = opts.view ?? { x: 0, y: 0, w: FIELD_W_YD, h: FIELD_L_YD }
  const W = view.w * s
  const H = view.h * s
  ctx.save()
  ctx.fillStyle = '#0b0e13'
  ctx.fillRect(0, 0, W, H)
  ctx.scale(s, s)
  ctx.translate(-view.x, -view.y)

  // turf + stripes
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = i % 2 ? pal.stripeB : pal.stripeA
    ctx.fillRect(0, i * 5, FIELD_W_YD, 5)
  }
  ctx.fillStyle = pal.endZone
  ctx.fillRect(0, 0, FIELD_W_YD, 10)
  ctx.fillRect(0, 110, FIELD_W_YD, 10)

  // yard lines
  ctx.strokeStyle = pal.line
  ctx.lineCap = 'round'
  for (let y = 15; y <= 105; y += 5) {
    ctx.globalAlpha = 0.85
    ctx.lineWidth = y % 10 === 0 ? 0.28 : 0.18
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(FIELD_W_YD, y)
    ctx.stroke()
  }
  // goal lines + midfield
  ctx.globalAlpha = 1
  ctx.lineWidth = 0.32
  for (const y of [10, 60, 110]) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(FIELD_W_YD, y)
    ctx.stroke()
  }

  // hash marks
  ctx.globalAlpha = 0.55
  ctx.lineWidth = 0.14
  for (let y = 11; y <= 109; y++) {
    const hashes = hashX(opts.ruleset ?? 'nfl')
    for (const x of [2, hashes[0], hashes[1], FIELD_W_YD - 2]) {
      ctx.beginPath()
      ctx.moveTo(x - 0.35, y)
      ctx.lineTo(x + 0.35, y)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // boundary
  ctx.lineWidth = 0.25
  ctx.strokeRect(0, 0, FIELD_W_YD, 120)

  // yard numbers — rotated +90° (left) / −90° (right) to match the SVG field
  ctx.globalAlpha = 0.75
  ctx.fillStyle = pal.line
  ctx.font = `600 ${3.1}px Oswald, "Archivo", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let y = 20; y <= 100; y += 10) {
    const label = String(Math.min(y - 10, 110 - y))
    const cols = numberX(opts.ruleset ?? 'nfl')
    const leftC = cols.left
    const rightC = cols.right
    ctx.save()
    ctx.translate(leftC, y)
    ctx.rotate(Math.PI / 2)
    ctx.fillText(label[0], -1, 0)
    ctx.fillText(label[1], 1, 0)
    ctx.restore()
    ctx.save()
    ctx.translate(rightC, y)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(label[0], -1, 0)
    ctx.fillText(label[1], 1, 0)
    ctx.restore()
  }
  ctx.globalAlpha = 1

  // LOS marker (inline yard math: ours → 110-n, theirs → 10+n)
  const los = opts.losSpec
  if (los) {
    const y = los.side === 'ours' ? 110 - los.n : 10 + los.n
    ctx.save()
    ctx.strokeStyle = 'var(--color-accent-400, #ffb224)'
    ctx.setLineDash([1.4, 0.9])
    ctx.lineWidth = 0.22
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(FIELD_W_YD, y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = '#ffb224'
    ctx.globalAlpha = 0.92
    ctx.fillRect(40.4, y - 1.15, 12.1, 2.3)
    ctx.fillStyle = '#0b0e13'
    ctx.font = `700 ${1.35}px Oswald, sans-serif`
    ctx.fillText(`${los.side === 'ours' ? 'OWN' : 'OPP'} ${los.n}`, 46.45, y + 0.08)
    ctx.restore()
  }

  // paths
  for (const sp of input.paths) {
    const st = PATH_STYLES[sp.type as keyof typeof PATH_STYLES] ?? PATH_STYLES.route
    const p = sp.progress
    if (p <= 0.001 && sp.type !== 'block') continue
    const done = p >= 0.999

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if ((st as { band?: boolean }).band && p > 0) {
      ctx.globalAlpha = 0.16 * Math.min(1, p * 3)
      ctx.strokeStyle = styleColor(st.color, theme)
      ctx.lineWidth = 0.85
      setProgressDash(ctx, sp, p, false)
      ctx.stroke(new Path2D(sp.d))
      ctx.setLineDash([])
    }

    if (sp.type === 'block' && p >= 0.95) {
      const pts = sp.points
      if (pts.length >= 2) {
        const a = pts[pts.length - 2]!
        const b = pts[pts.length - 1]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const len = Math.hypot(dx, dy)
        if (len > 0) {
          const nx = (-dy / len) * 0.55
          const ny = (dx / len) * 0.55
          ctx.strokeStyle = styleColor(st.color, theme)
          ctx.lineWidth = 0.24
          ctx.beginPath()
          ctx.moveTo(b.x + nx, b.y + ny)
          ctx.lineTo(b.x - nx, b.y - ny)
          ctx.stroke()
        }
      }
    }

    const hiddenUntilLaunch =
      (sp.type === 'pass' || sp.type === 'handoff' || sp.type === 'toss' || sp.type === 'snap') &&
      p <= 0.001
    if (!hiddenUntilLaunch) {
      const flight = ['pass', 'handoff', 'toss', 'snap'].includes(sp.type)
      const reveal = (!st.dash && !done) || (flight && !done)
      ctx.globalAlpha = !st.dash || flight ? 0.92 : Math.min(0.92, Math.max(0.05, p * 4))
      ctx.strokeStyle = styleColor(st.color, theme)
      ctx.lineWidth = st.width
      if (reveal) {
        const len = approxLen(sp.points)
        ctx.setLineDash([Math.max(0.01, len * p), len + 5])
      } else if (st.dash) {
        ctx.setLineDash(st.dash.split(' ').map(Number))
      } else {
        ctx.setLineDash([])
      }
      ctx.stroke(new Path2D(sp.d))
      ctx.setLineDash([])

      if (done && (st as { arrow?: string }).arrow) drawArrow(ctx, sp.points, styleColor(st.color, theme))
      if ((st as { endDot?: boolean }).endDot && done) {
        const lastP = sp.points[sp.points.length - 1]
        ctx.fillStyle = st.color
        ctx.beginPath()
        ctx.arc(lastP.x, lastP.y, 0.22, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }

  // text notes
  if (input.textNotes) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `700 1.4px Oswald, sans-serif`
    for (const n of input.textNotes) {
      if (!n.text) continue
      ctx.save()
      ctx.fillStyle = '#0b0e13'
      ctx.strokeStyle = '#0b0e13'
      ctx.lineWidth = 0.22
      ctx.globalAlpha = 0.5
      ctx.strokeText(n.text, n.x, n.y)
      ctx.globalAlpha = 1
      ctx.fillStyle = styleColor(CHALK, theme)
      ctx.fillText(n.text, n.x, n.y)
      ctx.restore()
    }
  }

  // tokens
  for (const t of input.tokens) {
    const pos = input.tokenPositions?.get(t.id) ?? t
    const ring = t.side === 'offense' ? '#60a5fa' : '#f87171'
    ctx.fillStyle = '#000'
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(pos.x, pos.y + 0.14, 0.69, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.fillStyle = '#101720'
    ctx.strokeStyle = ring
    ctx.lineWidth = 0.15
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, 0.69, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    const label = t.num || POSITIONS[t.pos]?.label || ''
    if (label) {
      ctx.fillStyle = ring
      ctx.font = `700 ${0.8}px Oswald, "Archivo", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, pos.x, pos.y + 0.04)
    }
  }

  // ball
  const ball = input.ball
  if (ball) {
    ctx.save()
    ctx.translate(ball.pos.x, ball.pos.y)
    ctx.fillStyle = '#000'
    ctx.globalAlpha = ball.flying ? 0.18 : 0.28
    ctx.beginPath()
    ctx.ellipse(0, ball.flying ? 0.6 : 0.3, 0.4, 0.15, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.rotate((ball.angleDeg * Math.PI) / 180)
    ctx.fillStyle = '#c98a2b'
    ctx.strokeStyle = '#5b3a10'
    ctx.lineWidth = 0.06
    ctx.beginPath()
    ctx.ellipse(0, 0, 0.52, 0.33, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.strokeStyle = CHALK
    ctx.lineWidth = 0.07
    ctx.beginPath()
    ctx.moveTo(-0.24, 0)
    ctx.lineTo(0.24, 0)
    ctx.stroke()
    for (const lx of [-0.1, 0, 0.1]) {
      ctx.beginPath()
      ctx.moveTo(lx, -0.09)
      ctx.lineTo(lx, 0.09)
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.restore()
}

function setProgressDash(
  ctx: CanvasRenderingContext2D,
  sp: { points: { x: number; y: number }[] },
  p: number,
  _flight: boolean,
): void {
  const len = approxLen(sp.points)
  ctx.setLineDash([Math.max(0.01, len * p), len + 5])
  void _flight
}

function approxLen(pts: { x: number; y: number }[]): number {
  let len = 0
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  }
  return Math.max(len, 0.01)
}

function drawArrow(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], color: string): void {
  if (pts.length < 2) return
  const a = pts[pts.length - 2]!
  const b = pts[pts.length - 1]!
  const ang = Math.atan2(b.y - a.y, b.x - a.x)
  ctx.save()
  ctx.translate(b.x, b.y)
  ctx.rotate(ang)
  ctx.fillStyle = color
  const s = 0.55
  ctx.beginPath()
  ctx.moveTo(0.45 * s, 0)
  ctx.lineTo(-0.55 * s, 0.6 * s)
  ctx.lineTo(-0.55 * s, -0.6 * s)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
