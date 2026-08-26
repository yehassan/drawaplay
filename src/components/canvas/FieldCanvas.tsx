import { useEffect, useRef, useState } from 'react'
import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  clampCamera,
  defaultCamera,
  fitCamera,
  screenToField,
  snap,
  zoomAt,
  bboxOf,
  GUIDE_EPS,
  type Camera,
  type Pt,
} from '../../lib/field'
import { catmullRomPath, dist, minDistToPath, simplifyRDP } from '../../lib/geometry'
import { inferPathType } from '../../lib/infer'
import { resolveFlightTarget } from '../../lib/target'
import { PATH_STYLES, PATH_TYPE_ORDER, PLAYER_DRIVEN } from '../../lib/pathStyles'
import { timelineDuration } from '../../lib/timing'
import { POSITIONS } from '../../lib/positions'
import { useEditorStore, type Token } from '../../stores/editorStore'
import { computeScene } from '../../lib/render'
import { losY as losYof } from '../../lib/formations'
import { paletteFor } from '../../lib/theme'
import { Icon } from '../ui/icons'
import { TypeSample } from '../ui/TypeSample'
import { BallView } from './BallView'
import { Field } from './Field'
import { PathView } from './PathView'
import { TokenView } from './TokenView'

type Session =
  | { type: 'drag'; start: Pt; origins: Map<string, Pt>; began: boolean }
  | { type: 'marquee'; x0: number; y0: number }
  | { type: 'pan'; sx: number; sy: number; cam: Camera }
  | { type: 'draw'; raw: Pt[]; lastSx: number; lastSy: number; moved: boolean }
  | { type: 'pathEnd'; pathId: string; which: 'start' | 'end'; began: boolean }

const CURSORS: Record<string, string> = {
  select: 'cursor-default',
  draw: 'cursor-crosshair',
  erase: 'cursor-crosshair',
  pan: 'cursor-grab',
  text: 'cursor-text',
}

export function FieldCanvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<Session | null>(null)
  const initRef = useRef(false)

  const [size, setSize] = useState({ w: 0, h: 0 })
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [guides, setGuides] = useState<{ xs: number[]; ys: number[] }>({ xs: [], ys: [] })
  const [liveStroke, setLiveStroke] = useState<{ raw: Pt[]; d: string } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const hintTimer = useRef<number | undefined>(undefined)

  const showHint = (msg: string) => {
    setHint(msg)
    window.clearTimeout(hintTimer.current)
    hintTimer.current = window.setTimeout(() => setHint(null), 2400)
  }

  const tokens = useEditorStore((s) => s.tokens)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const tool = useEditorStore((s) => s.tool)
  const camera = useEditorStore((s) => s.camera)
  const paths = useEditorStore((s) => s.paths)
  const playing = useEditorStore((s) => s.playback.playing)
  const tMs = useEditorStore((s) => s.playback.tMs)
  const ballStartId = useEditorStore((s) => s.ballStartId)
  const typeBarFor = useEditorStore((s) => s.typeBarFor)
  const showTypeBar = useEditorStore((s) => s.showTypeBar)
  const updatePathType = useEditorStore((s) => s.updatePathType)

  // rAF playback clock: tMs is the single source of truth
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const st = useEditorStore.getState()
      const dt = (now - last) * st.playback.speed
      last = now
      const D = timelineDuration(st.paths)
      let t = st.playback.tMs + dt
      if (t >= D) {
        if (st.playback.loop) {
          t %= D
        } else {
          st.seek(D)
          st.togglePlay()
          return
        }
      }
      st.seek(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toLocal = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  // track viewport size
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fitNonce = useEditorStore((s) => s.fitNonce)
  const losSpec = useEditorStore((s) => s.losSpec)
  const fieldTheme = useEditorStore((s) => s.fieldTheme)
  const ruleset = useEditorStore((s) => s.ruleset)
  const fieldPal = paletteFor(fieldTheme)

  // re-fit whenever a whole play loads (scenario / quickstart)
  useEffect(() => {
    if (fitNonce > 0 && size.w > 0) fitToPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitNonce])

  // initial camera once we know the viewport
  useEffect(() => {
    if (!initRef.current && size.w > 0 && size.h > 0) {
      initRef.current = true
      useEditorStore.getState().setCamera(defaultCamera(size.w, size.h))
    }
  }, [size])

  const fitToPlay = () => {
    const st = useEditorStore.getState()
    const pts = st.tokens.map((t) => ({ x: t.x, y: t.y }))
    if (pts.length === 0) {
      st.setCamera(defaultCamera(size.w, size.h))
      return
    }
    const rect = bboxOf(pts, 6)!
    rect.x -= Math.max(0, (26 - rect.w) / 2)
    rect.w = Math.max(rect.w, 26)
    rect.y -= Math.max(0, (26 - rect.h) / 2)
    rect.h = Math.max(rect.h, 26)
    st.setCamera(fitCamera(rect, size.w, size.h))
  }

  // one-shot type bar auto-hides
  useEffect(() => {
    if (!typeBarFor) return
    const h = setTimeout(() => useEditorStore.getState().showTypeBar(null), 3500)
    return () => clearTimeout(h)
  }, [typeBarFor])

  // keyboard: F fits the view to the play
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (!e.metaKey && !e.ctrlKey && e.key.toLowerCase() === 'f') fitToPlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // wheel: ctrl/cmd+wheel zooms (trackpad pinch), plain wheel pans
  useEffect(() => {
    const el = svgRef.current
    if (!el || size.w === 0) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useEditorStore.getState()
      const r = el.getBoundingClientRect()
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      if (e.ctrlKey || e.metaKey) {
        st.setCamera(zoomAt(st.camera, sx, sy, Math.exp(-e.deltaY * 0.0022), size.w, size.h))
      } else {
        st.setCamera(
          clampCamera(
            { ...st.camera, tx: st.camera.tx - e.deltaX, ty: st.camera.ty - e.deltaY },
            size.w,
            size.h,
          ),
        )
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size])

  const onTokenPointerDown = (e: ReactPointerEvent<SVGGElement>, id: string) => {
    const st = useEditorStore.getState()

    const moveOverride = st.tool === 'draw' && (e.metaKey || e.ctrlKey)
    if (st.tool !== 'select' && !moveOverride) return

    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)

    let ids: string[]
    if (e.shiftKey) {
      ids = st.selectedIds.includes(id)
        ? st.selectedIds.filter((s) => s !== id)
        : [...st.selectedIds, id]
    } else if (!st.selectedIds.includes(id)) {
      ids = [id]
    } else {
      ids = st.selectedIds
    }
    st.select(ids)

    const l = toLocal(e)
    const fieldPt = screenToField(st.camera, l.x, l.y)
    const origins = new Map<string, Pt>()
    for (const t of st.tokens) {
      if (ids.includes(t.id)) origins.set(t.id, { x: t.x, y: t.y })
    }
    sessionRef.current = { type: 'drag', start: fieldPt, origins, began: false }
  }

  const onBackgroundPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const st = useEditorStore.getState()

    if (e.button === 1 || st.tool === 'pan') {
      const l = toLocal(e)
      sessionRef.current = { type: 'pan', sx: l.x, sy: l.y, cam: st.camera }
      svgRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (st.tool === 'draw' && e.button === 0) {
      const l = toLocal(e)
      const f = screenToField(st.camera, l.x, l.y)
      sessionRef.current = { type: 'draw', raw: [f], lastSx: l.x, lastSy: l.y, moved: false }
      setLiveStroke({ raw: [f], d: '' })
      svgRef.current?.setPointerCapture(e.pointerId)
      return
    }
    if (st.tool === 'select' && e.button === 0) {
      const l = toLocal(e)
      sessionRef.current = { type: 'marquee', x0: l.x, y0: l.y }
      setMarquee({ x: l.x, y: l.y, w: 0, h: 0 })
      svgRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = sessionRef.current
    if (!s) return
    const st = useEditorStore.getState()

    if (s.type === 'pan') {
      const l = toLocal(e)
      st.setCamera(clampCamera({ ...s.cam, tx: s.cam.tx + l.x - s.sx, ty: s.cam.ty + l.y - s.sy }, size.w, size.h))
      return
    }

    if (s.type === 'marquee') {
      const l = toLocal(e)
      setMarquee({
        x: Math.min(s.x0, l.x),
        y: Math.min(s.y0, l.y),
        w: Math.abs(l.x - s.x0),
        h: Math.abs(l.y - s.y0),
      })
      return
    }

    if (s.type === 'draw') {
      const l = toLocal(e)
      if (dist({ x: l.x, y: l.y }, { x: s.lastSx, y: s.lastSy }) < 3) return
      const f = screenToField(st.camera, l.x, l.y)
      const raw = [...s.raw, f]
      s.raw = raw
      s.lastSx = l.x
      s.lastSy = l.y
      if (!s.moved && dist({ x: l.x, y: l.y }, { x: s.lastSx, y: s.lastSy }) >= 0) s.moved = true
      setLiveStroke({ raw, d: catmullRomPath(simplifyRDP(raw, 2 / st.camera.zoom)) })
      return
    }

    if (s.type === 'pathEnd') {
      const l = toLocal(e)
      const f = screenToField(st.camera, l.x, l.y)
      const x = snap(f.x)
      const y = snap(f.y)
      if (!s.began) {
        st.beginHistory()
        s.began = true
      }

      // snap to nearby tokens
      let anchorTokenId: string | null = null
      let snapCenter: Pt | null = null
      let bx = x
      let by = y
      const r = Math.min(28 / st.camera.zoom, 2)
      let bestD = r
      for (const t of st.tokens) {
        const d = dist({ x, y }, { x: t.x, y: t.y })
        if (d < bestD) {
          bestD = d
          anchorTokenId = t.id
          snapCenter = { x: t.x, y: t.y }
          bx = t.x
          by = t.y
        }
      }

      // keep the endpoint on the token's rim so end markers stay visible
      if (s.which === 'end' && snapCenter) {
        const p = st.paths.find((pp) => pp.id === s.pathId)
        const prev = p && p.points.length >= 2 ? p.points[p.points.length - 2] : null
        if (prev) {
          const trimmed = trimToTokenRim(prev, snapCenter)
          bx = trimmed.x
          by = trimmed.y
        }
      }

      st.setPathEndpointLive(s.pathId, s.which, bx, by, anchorTokenId)
      return
    }

    // drag tokens with grid snap + alignment guides
    const l = toLocal(e)
    const cur = screenToField(st.camera, l.x, l.y)
    const dx = cur.x - s.start.x
    const dy = cur.y - s.start.y

    if (!s.began && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
      st.beginHistory()
      s.began = true
    }

    const targets = [...s.origins].map(([id, o]) => ({
      id,
      x: snap(o.x + dx),
      y: snap(o.y + dy),
    }))

    const others = st.tokens.filter((t) => !s.origins.has(t.id))
    let adjX = 0
    let adjY = 0
    const gx: number[] = []
    const gy: number[] = []

    for (const t of targets) {
      for (const o of others) {
        if (Math.abs(o.x - t.x) < GUIDE_EPS) {
          adjX = o.x - t.x
          gx.push(o.x)
          break
        }
      }
      for (const o of others) {
        if (Math.abs(o.y - t.y) < GUIDE_EPS) {
          adjY = o.y - t.y
          gy.push(o.y)
          break
        }
      }
    }

    const updates: Record<string, Pt> = {}
    for (const t of targets) updates[t.id] = { x: t.x + adjX, y: t.y + adjY }
    st.moveTokensLive(updates)
    setGuides({ xs: gx, ys: gy })
  }

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const s = sessionRef.current
    if (!s) return
    const st = useEditorStore.getState()

    if (s.type === 'marquee') {
      const l = toLocal(e)
      const tiny = Math.abs(l.x - s.x0) < 4 && Math.abs(l.y - s.y0) < 4
      if (tiny) {
        st.select([])
      } else {
        const a = screenToField(st.camera, Math.min(s.x0, l.x), Math.min(s.y0, l.y))
        const b = screenToField(st.camera, Math.max(s.x0, l.x), Math.max(s.y0, l.y))
        st.select(
          st.tokens.filter((t) => t.x >= a.x && t.x <= b.x && t.y >= a.y && t.y <= b.y).map((t) => t.id),
        )
      }
      setMarquee(null)
    }

    if (s.type === 'draw') {
      // a click in pen mode selects whatever is under the cursor
      if (!s.moved) clickSelect(s.lastSx, s.lastSy)
      else finalizeStroke(s.raw)
    }
    if (s.type === 'pathEnd') st.applyScheduleNow()
    if (s.type === 'drag') setGuides({ xs: [], ys: [] })
    sessionRef.current = null
  }

  /** pull an endpoint back to a token's rim so T-bars/arrows/dots stay visible */
  const trimToTokenRim = (prev: Pt, center: Pt): Pt => {
    const dx = center.x - prev.x
    const dy = center.y - prev.y
    const len = Math.hypot(dx, dy)
    if (len === 0) return center
    const gap = Math.min(1.5, len / 2)
    return { x: center.x - (dx / len) * gap, y: center.y - (dy / len) * gap }
  }

  /** pen-mode click: select the nearest player or path under the cursor */
  const clickSelect = (sx: number, sy: number) => {
    const st = useEditorStore.getState()
    const f = screenToField(st.camera, sx, sy)
    let bestTok: string | null = null
    let bestD = 1.05
    for (const t of st.tokens) {
      const d = dist(f, { x: t.x, y: t.y })
      if (d < bestD) {
        bestD = d
        bestTok = t.id
      }
    }
    if (bestTok) {
      st.select([bestTok])
      return
    }
    let bestPath: string | null = null
    let bestPd = 0.45
    for (const p of st.paths) {
      const d = minDistToPath(f, p.points)
      if (d < bestPd) {
        bestPd = d
        bestPath = p.id
      }
    }
    st.select(bestPath ? [bestPath] : [])
  }

  /** rough → slick: simplify, snap ends to tokens, store as a clean bézier path */
  const finalizeStroke = (raw: Pt[]) => {
    setLiveStroke(null)
    if (raw.length < 3) return // accidental click
    const st = useEditorStore.getState()
    let pts = simplifyRDP(raw, 2.5 / st.camera.zoom)
    if (pts.length < 2) pts = [raw[0], raw[raw.length - 1]]

    const radius = Math.min(28 / st.camera.zoom, 2)
    const snapEnd = (p: Pt): Token | null => {
      let best: Token | null = null
      let bestD = radius
      for (const t of st.tokens) {
        const d = dist(p, { x: t.x, y: t.y })
        if (d < bestD) {
          bestD = d
          best = t
        }
      }
      return best
    }

    const startToken = snapEnd(pts[0])
    const endToken = snapEnd(pts[pts.length - 1])
    if (!startToken) {
      showHint('Start routes on a player')
      return
    }
    // magnetic chaining: start snaps to the player's chain tip, end snaps back
    // to the chain root — out-and-back motions complete exactly
    const existingChain = st.paths.filter(
      (q) => q.tokenId === startToken.id && PLAYER_DRIVEN.has(q.type),
    )
    let chainTip: Pt | null = null
    let chainRoot: Pt | null = null
    if (existingChain.length > 0) {
      const lastSibling = existingChain[existingChain.length - 1]!
      chainTip = lastSibling.points[lastSibling.points.length - 1]
      chainRoot = existingChain[0].points[0]
    }

    pts[0] = { x: startToken.x, y: startToken.y }
    const type = inferPathType(pts, { startToken, endToken })
    if (chainTip && dist(pts[0], chainTip) < 2) pts[0] = chainTip
    if (!endToken && chainRoot && dist(pts[pts.length - 1], chainRoot) < 2) {
      pts[pts.length - 1] = chainRoot
    }
    if (endToken) {
      pts[pts.length - 1] = trimToTokenRim(pts[pts.length - 2], {
        x: endToken.x,
        y: endToken.y,
      })
    }

    // a flight drawn to the tip of someone's route targets that player even
    // when no token was under the pen
    const targetId =
      endToken?.id ?? resolveFlightTarget(pts, startToken.id, st.paths, type)

    // H3: flights get canonical geometry. Passes are STRICTLY straight lines;
    // handoffs/tosses may keep a gentle capped loft around bodies.
    if (type === 'pass' || type === 'handoff' || type === 'toss' || type === 'snap') {
      if (type === 'pass' || type === 'snap') {
        pts = [pts[0], pts[pts.length - 1]]
      }
      const a = pts[0]
      const b = pts[pts.length - 1]
      const cx = b.x - a.x
      const cy = b.y - a.y
      const chord = Math.hypot(cx, cy)
      if (chord > 0.5) {
        let maxDev = 0
        for (let i = 1; i < pts.length - 1; i++) {
          const cross = (cx * (pts[i].y - a.y) - cy * (pts[i].x - a.x)) / chord
          if (Math.abs(cross) > Math.abs(maxDev)) maxDev = cross
        }
        if (Math.abs(maxDev) < 0.35) {
          pts = [a, b]
        } else {
          const dev = Math.max(-2, Math.min(2, maxDev))
          const nx = -cy / chord
          const ny = cx / chord
          // Catmull-Rom passes through the middle point → apex ≈ dev
          pts = [a, { x: (a.x + b.x) / 2 + nx * dev, y: (a.y + b.y) / 2 + ny * dev }, b]
        }
      }
    }

    st.addPath({
      tokenId: startToken.id,
      endTokenId: targetId,
      type,
      points: pts,
      d: catmullRomPath(pts),
    })
  }

  const onPathPointerDown = (e: ReactPointerEvent<SVGPathElement>, id: string) => {
    const st = useEditorStore.getState()
    if (st.tool !== 'select' && st.tool !== 'draw') return
    e.stopPropagation()
    st.select([id])
  }

  const onHandlePointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    pathId: string,
    which: 'start' | 'end',
  ) => {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    sessionRef.current = { type: 'pathEnd', pathId, which, began: false }
  }

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const pos = e.dataTransfer.getData('application/x-dap-pos')
    if (!(pos in POSITIONS)) return
    const p = POSITIONS[pos as keyof typeof POSITIONS]
    const st = useEditorStore.getState()
    const l = toLocal(e)
    const f = screenToField(st.camera, l.x, l.y)
    st.addToken({ side: p.side, pos: pos as Token['pos'], num: '', x: snap(f.x), y: snap(f.y) })
  }

  const zoomBy = (factor: number) => {
    const st = useEditorStore.getState()
    st.setCamera(zoomAt(st.camera, size.w / 2, size.h / 2, factor, size.w, size.h))
  }

  const animActive = playing || tMs > 0
  const scene = computeScene(tokens, paths, { tMs, playing, ballStartId })
  const renderedPaths = scene.paths

  const selPath =
    selectedIds.length === 1 && tool === 'select'
      ? renderedPaths.find((p) => p.id === selectedIds[0])
      : undefined

  const typeBarPath = typeBarFor ? renderedPaths.find((p) => p.id === typeBarFor) : undefined
  const typeBarTip = typeBarPath?.points[typeBarPath.points.length - 1]
  const typeBarActive = !!typeBarTip && !playing

  return (
    <div ref={wrapRef} className="absolute inset-0" onDragOver={(e) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }} onDrop={onDrop}>
      <svg
        ref={svgRef}
        onPointerDownCapture={() => {
          const el = document.activeElement as HTMLElement | null
          if (el && el !== document.body && el.blur) el.blur()
        }}
        className={`absolute inset-0 h-full w-full touch-none select-none ${CURSORS[tool]}`}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker
            id="arrow-chalk"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="1.05"
            markerHeight="1.05"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" fill={fieldPal.line} />
          </marker>
          <marker
            id="arrow-gold"
            viewBox="0 0 10 10"
            refX="7.5"
            refY="5"
            markerWidth="1.05"
            markerHeight="1.05"
            markerUnits="userSpaceOnUse"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" fill="var(--color-ball-500)" />
          </marker>
        </defs>
        <g transform={`translate(${camera.tx} ${camera.ty}) scale(${camera.zoom})`}>
          <Field theme={fieldTheme} ruleset={ruleset} />
          {renderedPaths.map((p) => (
            <PathView
              key={p.id}
              path={p}
              selected={selectedIds.includes(p.id)}
              progress={p.progress}
              onPointerDown={onPathPointerDown}
            />
          ))}
          {tokens.map((t) => (
            <TokenView
              key={t.id}
              token={t}
              selected={selectedIds.includes(t.id)}
              posOverride={animActive ? scene.tokenPositions.get(t.id) : undefined}
              onPointerDown={onTokenPointerDown}
            />
          ))}

    
        {/* line-of-scrimmage marker (from quickstart metadata) */}
        {losSpec &&
          (() => {
            const y = losYof(losSpec.side, losSpec.n)
            const label = `${losSpec.side === 'ours' ? 'OWN' : 'OPP'} ${losSpec.n}`
            return (
              <g pointerEvents="none" transform={`translate(${camera.tx} ${camera.ty}) scale(${camera.zoom})`}>
                <line x1={0} y1={y} x2={53.3} y2={y} stroke="var(--color-accent-400)" strokeWidth={0.22} strokeDasharray="1.4 0.9" opacity={0.85} />
                <rect x={40.4} y={y - 1.15} width={12.1} height={2.3} rx={0.5} fill="var(--color-accent-400)" opacity={0.92} />
                <text x={46.45} y={y + 0.08} fontSize={1.35} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#0b0e13" style={{ fontFamily: 'var(--font-display)' }}>
                  {label}
                </text>
              </g>
            )
          })()}

      {/* endpoint handles for the selected path */}
          {selPath && selPath.points.length >= 2 && (
            <>
              {(
                [
                  { pt: selPath.points[0], which: 'start' as const },
                  { pt: selPath.points[selPath.points.length - 1], which: 'end' as const },
                ]
              ).map(({ pt, which }) => (
                <g
                  key={which}
                  onPointerDown={(e) => onHandlePointerDown(e, selPath.id, which)}
                  style={{ cursor: 'grab' }}
                >
                  <circle cx={pt.x} cy={pt.y} r="0.85" fill="transparent" />
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="0.42"
                    fill="var(--color-chrome-950)"
                    stroke="var(--color-accent-400)"
                    strokeWidth="0.16"
                    pointerEvents="none"
                  />
                </g>
              ))}
            </>
          )}

          {scene.ball && <BallView state={scene.ball} />}

          {/* live stroke: faint pen trail + smoothed preview */}
          {liveStroke && liveStroke.raw.length > 1 && (
            <>
              <polyline
                points={liveStroke.raw.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={fieldPal.line}
                strokeWidth="0.1"
                opacity="0.25"
                pointerEvents="none"
              />
              <path
                d={liveStroke.d}
                fill="none"
                stroke={fieldPal.line}
                strokeWidth="0.26"
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            </>
          )}
        </g>

        {/* alignment guides (screen space) */}
        {guides.xs.map((x) => (
          <line
            key={`gx${x}`}
            x1={x * camera.zoom + camera.tx}
            y1={0}
            x2={x * camera.zoom + camera.tx}
            y2={size.h}
            stroke="var(--color-accent-400)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.8"
            pointerEvents="none"
          />
        ))}
        {guides.ys.map((y) => (
          <line
            key={`gy${y}`}
            x1={0}
            y1={y * camera.zoom + camera.ty}
            x2={size.w}
            y2={y * camera.zoom + camera.ty}
            stroke="var(--color-accent-400)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.8"
            pointerEvents="none"
          />
        ))}

        {/* marquee (screen space) */}
        {marquee && marquee.w > 2 && (
          <rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.w}
            height={marquee.h}
            fill="var(--color-accent-400)"
            fillOpacity="0.08"
            stroke="var(--color-accent-400)"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
      </svg>

      {hint && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
          <span className="rounded-full border border-chrome-700 bg-chrome-900/95 px-4 py-1.5 text-sm text-accent-400 shadow-lg backdrop-blur">
            {hint}
          </span>
        </div>
      )}

      {/* one-shot type bar */}
      {typeBarActive && typeBarTip && (
        <div
          className="absolute z-20 flex -translate-x-1/2 gap-0.5 rounded-lg border border-chrome-700 bg-chrome-900/95 p-1 shadow-xl backdrop-blur"
          style={{ left: typeBarTip.x * camera.zoom + camera.tx, top: typeBarTip.y * camera.zoom + camera.ty - 14 }}
        >
          {PATH_TYPE_ORDER.map((t, i) => {
            const active = typeBarPath?.type === t
            return (
              <button
                key={t}
                type="button"
                title={`${PATH_STYLES[t].label} (${i + 1})`}
                onClick={() => {
                  updatePathType(typeBarFor!, t)
                  showTypeBar(null)
                }}
                className={`flex w-[52px] flex-col items-center gap-0.5 rounded-md px-1 py-1 transition-colors ${
                  active ? 'bg-accent-400/20 ring-1 ring-accent-400' : 'hover:bg-chrome-800'
                }`}
              >
                <TypeSample type={t} />
                <span className="text-[8px] font-semibold uppercase leading-none tracking-tight text-chrome-400">
                  {PATH_STYLES[t].label}
                </span>
                <span className="text-[8px] font-bold leading-none text-chrome-600">{i + 1}</span>
              </button>
            )
          })}
          <div className="pointer-events-none absolute -bottom-5 right-0 whitespace-nowrap text-[9px] text-chrome-500">
            1–{PATH_TYPE_ORDER.length} set type · Esc close
          </div>
        </div>
      )}

      {/* view controls */}
      <div className="absolute right-3 bottom-3 flex flex-col gap-1 rounded-xl border border-chrome-700 bg-chrome-900/90 p-1 shadow-lg backdrop-blur">
        <button
          type="button"
          title="Zoom in"
          onClick={() => zoomBy(1.25)}
          className="grid size-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
        >
          <Icon name="plus" className="size-4" />
        </button>
        <button
          type="button"
          title="Zoom out"
          onClick={() => zoomBy(0.8)}
          className="grid size-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
        >
          <Icon name="minus" className="size-4" />
        </button>
        <button
          type="button"
          title="Fit to play (F)"
          onClick={fitToPlay}
          className="grid size-8 place-items-center rounded-lg text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
        >
          <Icon name="fit" className="size-4" />
        </button>
      </div>
    </div>
  )
}
