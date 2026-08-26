import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clamp } from '../../lib/field'
import { PATH_STYLES, SHORT_LABELS } from '../../lib/pathStyles'
import { timelineDuration } from '../../lib/timing'
const isFlight = (t: string) =>
  t === 'pass' || t === 'handoff' || t === 'toss' || t === 'snap'
import { useEditorStore, type PlayPath } from '../../stores/editorStore'
import { Icon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'

type ChipDrag =
  | { kind: 'scrub' }
  | { kind: 'chip'; id: string; mode: 'move' | 'resize'; startX: number; delayMs: number; durationMs: number }

function fmt(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`
}

export function BottomDock() {
  const playing = useEditorStore((s) => s.playback.playing)
  const tMs = useEditorStore((s) => s.playback.tMs)
  const speed = useEditorStore((s) => s.playback.speed)
  const loop = useEditorStore((s) => s.playback.loop)
  const togglePlay = useEditorStore((s) => s.togglePlay)
  const seek = useEditorStore((s) => s.seek)
  const cycleSpeed = useEditorStore((s) => s.cycleSpeed)
  const toggleLoop = useEditorStore((s) => s.toggleLoop)

  const paths = useEditorStore((s) => s.paths)
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const select = useEditorStore((s) => s.select)
  const beginHistory = useEditorStore((s) => s.beginHistory)
  const setPathTimingLive = useEditorStore((s) => s.setPathTimingLive)
  const setPathLocked = useEditorStore((s) => s.setPathLocked)

  const D = timelineDuration(paths)
  // NLE-style tracks: one FIXED row per path (creation order) — rows never
  // reshuffle while dragging, so a chip always stays under your cursor
  const TRACK_H = 16
  const GAP = 3
  const orderedTracks = paths
  const trackRef = useRef<HTMLDivElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ChipDrag | null>(null)

  const scrubTo = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    seek(clamp((clientX - r.left) / r.width, 0, 1) * D)
  }

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'scrub' }
    scrubTo(e.clientX)
  }

  const onLanePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d || d.kind !== 'chip') return
    const lane = laneRef.current
    if (!lane) return
    const pxPerMs = lane.getBoundingClientRect().width / D

    if (d.mode === 'move') {
      const delayMs = clamp(d.delayMs + (e.clientX - d.startX) / pxPerMs, 0, D - 250)
      setPathTimingLive(d.id, { delayMs })
    } else {
      const durationMs = clamp(d.durationMs + (e.clientX - d.startX) / pxPerMs, 250, D)
      setPathTimingLive(d.id, { durationMs })
    }
  }

  const onLanePointerUp = () => {
    dragRef.current = null
  }

  const onChipPointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    p: PlayPath,
    mode: 'move' | 'resize',
  ) => {
    e.stopPropagation()
    select([p.id])
    beginHistory()
    laneRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = {
      kind: 'chip',
      id: p.id,
      mode,
      startX: e.clientX,
      delayMs: p.timing.delayMs,
      durationMs: p.timing.durationMs,
    }
  }

  return (
    <footer className="flex shrink-0 flex-col border-t border-chrome-800 bg-chrome-900">
      {/* timing tracks — one row per path, NLE style */}
      <div
        ref={laneRef}
        className="relative mx-4 mt-2 h-[64px] select-none overflow-y-auto rounded-md border border-chrome-700 bg-chrome-850"
        onPointerMove={onLanePointerMove}
        onPointerUp={onLanePointerUp}
        onPointerCancel={onLanePointerUp}
      >
        {paths.length === 0 ? (
          <p className="grid h-9 place-items-center text-[11px] text-chrome-600">
            Draw paths to build the timeline
          </p>
        ) : (
          <div className="relative" style={{ height: orderedTracks.length * TRACK_H + (orderedTracks.length + 1) * GAP }}>
          {orderedTracks.map((p, row) => {
            const st = PATH_STYLES[p.type]
            const active = selectedIds.includes(p.id)
            return (
              <div
                key={p.id}
                title={
                  p.userLocked
                    ? `${st.label} (timing locked — Alt+click to unlock)`
                    : `${st.label} — drag to shift, right edge to resize${isFlight(p.type) ? '' : ', Alt+click to lock'}`
                }
                className={`group absolute flex items-center overflow-hidden rounded ${
                  active ? 'ring-1 ring-accent-400' : 'ring-1 ring-on-chip/15'
                }`}
                style={{
                  top: row * TRACK_H + GAP,
                  height: TRACK_H,
                  left: `${(p.timing.delayMs / D) * 100}%`,
                  width: `${(p.timing.durationMs / D) * 100}%`,
                  background: st.color,
                  opacity: active ? 1 : p.userLocked ? 0.95 : 0.75,
                }}
                onPointerDown={(e) => {
                  if (e.altKey && !isFlight(p.type)) {
                    e.stopPropagation()
                    setPathLocked(p.id, !p.userLocked)
                    return
                  }
                  onChipPointerDown(e, p, 'move')
                }}
              >
                <span className="pointer-events-none truncate px-1.5 text-[9px] font-bold uppercase leading-none tracking-wide text-on-chip/85">
                  {p.userLocked ? '⏳ ' : ''}
                  {SHORT_LABELS[p.type]}
                </span>
                <div
                  className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-on-chip/0 group-hover:bg-on-chip/25"
                  onPointerDown={(e) => onChipPointerDown(e, p, 'resize')}
                />
              </div>
            )
          })}
          </div>
        )}
        {/* playhead on the chip lane */}
        {paths.length > 0 && (
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-accent-400/90"
            style={{ left: `${(tMs / D) * 100}%` }}
          />
        )}
      </div>

      {/* transport */}
      <div className="flex min-h-0 flex-1 items-center gap-3 px-4 pb-2 pt-1.5">
        <button
          type="button"
          onClick={togglePlay}
          title="Play / pause (Space)"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-400 text-chrome-950 shadow-lg shadow-accent-400/20 transition-colors hover:bg-accent-300 disabled:pointer-events-none disabled:opacity-35"
          disabled={paths.length === 0}
        >
          <Icon name={playing ? 'pause' : 'play'} className="size-5 translate-x-px" />
        </button>

        <span className="shrink-0 font-mono text-xs tabular-nums text-chrome-400">
          {fmt(Math.min(tMs, D))} <span className="text-chrome-600">/ {fmt(D)}</span>
        </span>

        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          onPointerMove={(e) => dragRef.current?.kind === 'scrub' && scrubTo(e.clientX)}
          onPointerUp={() => (dragRef.current = null)}
          className="relative mx-1 h-1.5 min-w-0 flex-1 cursor-pointer overflow-hidden rounded-full bg-chrome-800"
        >
          <div
            className="h-full rounded-full bg-accent-400 transition-none"
            style={{ width: `${Math.min(100, (tMs / D) * 100)}%` }}
          />
        </div>

        <button
          type="button"
          onClick={cycleSpeed}
          title="Playback speed"
          className="shrink-0 rounded-md px-2 py-1 font-mono text-xs font-semibold text-chrome-300 transition-colors hover:bg-chrome-800"
        >
          {speed}×
        </button>
        <IconButton label="Loop" active={loop} onClick={toggleLoop}>
          <Icon name="loop" className="size-[18px]" />
        </IconButton>
      </div>
    </footer>
  )
}
