import type { PointerEvent as ReactPointerEvent } from 'react'
import { POSITIONS } from '../../lib/positions'
import type { Pt } from '../../lib/field'
import type { Token } from '../../stores/editorStore'

interface TokenViewProps {
  token: Token
  selected: boolean
  /** animated position during playback; undefined = rest position */
  posOverride?: Pt
  onPointerDown: (e: ReactPointerEvent<SVGGElement>, id: string) => void
}

const SIDE_COLOR: Record<Token['side'], string> = {
  offense: 'var(--color-offense-400)',
  defense: 'var(--color-defense-400)',
}

export function TokenView({ token, selected, posOverride, onPointerDown }: TokenViewProps) {
  const color = SIDE_COLOR[token.side]
  const label = token.num || token.letter || POSITIONS[token.pos].label

  return (
    <g
      transform={`translate(${posOverride ? posOverride.x : token.x} ${posOverride ? posOverride.y : token.y})`}
      onPointerDown={(e) => onPointerDown(e, token.id)}
      style={{ cursor: 'grab' }}
    >
      {/* generous hit area */}
      <circle r="1.02" fill="transparent" />

      <g className="dap-pop">
        {/* soft shadow */}
        <circle r="0.69" cy="0.14" fill="#000" opacity="0.35" />

        {/* body */}
        <circle r="0.69" fill="#101720" stroke={color} strokeWidth="0.15" />

        <text
          y="0.08"
          fill={color}
          fontSize="0.64"
          fontWeight="700"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: 'var(--font-display)', userSelect: 'none' }}
          pointerEvents="none"
        >
          {label}
        </text>

        {selected && (
          <circle
            r="0.96"
            fill="none"
            stroke="var(--color-accent-400)"
            strokeWidth="0.09"
            strokeDasharray="0.3 0.21"
            pointerEvents="none"
          />
        )}
      </g>
    </g>
  )
}
