import type { BallState } from '../../lib/ball'

export function BallView({ state }: { state: BallState }) {
  return (
    <g transform={`translate(${state.pos.x} ${state.pos.y})`} pointerEvents="none">
      <ellipse
        cy={state.flying ? 0.6 : 0.3}
        rx="0.4"
        ry="0.15"
        fill="#000"
        opacity={state.flying ? 0.18 : 0.28}
      />
      <g transform={`rotate(${state.angleDeg})`}>
        <ellipse
          rx="0.52"
          ry="0.33"
          fill="var(--color-ball-500)"
          stroke="#5b3a10"
          strokeWidth="0.06"
        />
        <line x1="-0.24" x2="0.24" stroke="#eef2f7" strokeWidth="0.07" />
        <line x1="-0.1" y1="-0.09" x2="-0.1" y2="0.09" stroke="#eef2f7" strokeWidth="0.06" />
        <line x1="0" y1="-0.09" x2="0" y2="0.09" stroke="#eef2f7" strokeWidth="0.06" />
        <line x1="0.1" y1="-0.09" x2="0.1" y2="0.09" stroke="#eef2f7" strokeWidth="0.06" />
      </g>
    </g>
  )
}
