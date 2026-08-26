import type { PointerEvent as ReactPointerEvent } from 'react'
import { PATH_STYLES } from '../../lib/pathStyles'
import { styleColor } from '../../lib/theme'
import { useEditorStore } from '../../stores/editorStore'
import type { PlayPath } from '../../stores/editorStore'

interface PathViewProps {
  path: PlayPath
  selected: boolean
  /** 0..1 how much of this path has played out; 1 renders it complete */
  progress: number
  onPointerDown: (e: ReactPointerEvent<SVGPathElement>, id: string) => void
}

/** perpendicular T-bar at the end of a block (the contact point) */
function BlockBar({ path, visible }: { path: PlayPath; visible: boolean }) {
  const p = path.points
  if (p.length < 2 || !visible) return null
  const a = p[p.length - 2]
  const b = p[p.length - 1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return null
  const half = 0.55
  const nx = (-dy / len) * half
  const ny = (dx / len) * half
  return (
    <path
      d={`M ${b.x + nx} ${b.y + ny} L ${b.x - nx} ${b.y - ny}`}
      stroke={PATH_STYLES.block.color}
      strokeWidth="0.24"
      strokeLinecap="round"
      pointerEvents="none"
    />
  )
}

export function PathView({ path, selected, progress, onPointerDown }: PathViewProps) {
  const theme = useEditorStore((s) => s.fieldTheme)
  const base = PATH_STYLES[path.type]
  const st = { ...base, color: styleColor(base.color, theme) }
  const last = path.points[path.points.length - 1]
  const mainColor = selected ? 'var(--color-accent-400)' : st.color
  const done = progress >= 0.999
  const flight = path.type === 'pass' || path.type === 'handoff' || path.type === 'snap'

  // flights stay invisible until the ball is released, then draw themselves
  // along with the ball; they only take their final (dashed) style at arrival
  const hiddenUntilLaunch = flight && progress <= 0.001
  const solidDraw = !flight && !st.dash && !done
  const revealActive = solidDraw || (flight && !done)

  return (
    <>
      {/* fat invisible hit stroke */}
      <path
        d={path.d}
        fill="none"
        stroke="transparent"
        strokeWidth="0.9"
        onPointerDown={(e) => onPointerDown(e, path.id)}
        style={{ cursor: 'pointer' }}
      />

      {st.band && progress > 0 && (
        <path
          d={path.d}
          fill="none"
          stroke={mainColor}
          strokeWidth="0.85"
          strokeLinecap="round"
          opacity={(selected ? 0.28 : 0.16) * Math.min(1, progress * 3)}
          pathLength={solidDraw ? 1 : undefined}
          strokeDasharray={solidDraw ? `${progress} 1.01` : undefined}
          pointerEvents="none"
        />
      )}

      <BlockBar path={path} visible={path.type === 'block' && progress >= 0.95} />

      {!hiddenUntilLaunch && (
        <path
          d={path.d}
          fill="none"
          pointerEvents="none"
          stroke={mainColor}
          strokeWidth={selected ? st.width + 0.08 : st.width}
          strokeDasharray={
            revealActive ? `${progress} 1.01` : st.dash ?? undefined
          }
          strokeLinecap="round"
          strokeLinejoin="round"
          markerEnd={st.arrow && done && !selected ? `url(#arrow-${st.arrow})` : undefined}
          opacity={
            selected || !st.dash || flight
              ? 0.92
              : Math.min(0.92, progress * 4)
          }
          pathLength={revealActive ? 1 : undefined}
        />
      )}

      {st.endDot && last && done && !selected && (
        <circle cx={last.x} cy={last.y} r="0.22" fill={st.color} pointerEvents="none" />
      )}
    </>
  )
}
