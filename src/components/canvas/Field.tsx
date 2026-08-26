import { FIELD_W, hashX, numberX, type Ruleset } from '../../lib/field'
import { paletteFor, type FieldTheme } from '../../lib/theme'

function YardNumbers({ theme, ruleset }: { theme: FieldTheme; ruleset: Ruleset }) {
  const pal = paletteFor(theme)
  const cols = numberX(ruleset)
  const rows = []
  for (let y = 20; y <= 100; y += 10) {
    const label = String(Math.min(y - 10, 110 - y))
    rows.push({ y, label })
  }
  return (
    <g fill={pal.line} opacity="0.75" style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }} fontSize="3.1" textAnchor="middle" dominantBaseline="central">
      {rows.map(({ y, label }) => {
        const leftC = cols.left
        const rightC = cols.right
        return (
          <g key={y}>
            {/* left column: +90° clockwise → zeros face down */}
            <g transform={`rotate(90 ${leftC} ${y})`}>
              {[0, 1].map((i) => (
                <text key={i} x={leftC + (i - 0.5) * 2} y={y}>
                  {label[i]}
                </text>
              ))}
            </g>
            {/* right column: −90° counterclockwise → non-zero digit faces down */}
            <g transform={`rotate(-90 ${rightC} ${y})`}>
              {[0, 1].map((i) => (
                <text key={i} x={rightC + (i - 0.5) * 2} y={y}>
                  {label[i]}
                </text>
              ))}
            </g>
          </g>
        )
      })}
    </g>
  )
}

export function Field({ theme, ruleset }: { theme: FieldTheme; ruleset?: Ruleset }) {
  const hashes = hashX(ruleset ?? 'nfl')
  const pal = paletteFor(theme)
  const stripes = []
  for (let i = 0; i < 24; i++) stripes.push(i)

  const yardLines = []
  for (let y = 15; y <= 105; y += 5) yardLines.push(y)

  const ticks = []
  for (let y = 11; y <= 109; y++) ticks.push(y)

  return (
    <g>
      {/* mowing stripes */}
      {stripes.map((i) => (
        <rect key={i} x={0} y={i * 5} width={FIELD_W} height={5} fill={i % 2 ? pal.stripeB : pal.stripeA} />
      ))}

      {/* end zones */}
      <rect x={0} y={0} width={FIELD_W} height={10} fill={pal.endZone} />
      <rect x={0} y={110} width={FIELD_W} height={10} fill={pal.endZone} />

      {/* yard lines */}
      <g stroke={pal.line} strokeOpacity="0.85">
        {yardLines.map((y) => (
          <line key={y} x1={0} y1={y} x2={FIELD_W} y2={y} strokeWidth={y % 10 === 0 ? 0.28 : 0.18} />
        ))}
      </g>

      {/* goal lines + midfield */}
      <g stroke={pal.line} strokeWidth="0.32">
        <line x1={0} y1={10} x2={FIELD_W} y2={10} />
        <line x1={0} y1={60} x2={FIELD_W} y2={60} />
        <line x1={0} y1={110} x2={FIELD_W} y2={110} />
      </g>

      {/* hash marks + sideline ticks */}
      <g stroke={pal.line} strokeOpacity="0.55" strokeWidth="0.14">
        {ticks.map((y) =>
          [2, hashes[0], hashes[1], FIELD_W - 2].map((x) => (
            <line key={`${x}-${y}`} x1={x - 0.35} y1={y} x2={x + 0.35} y2={y} />
          )),
        )}
      </g>

      {/* boundary */}
      <rect x={0} y={0} width={FIELD_W} height={120} fill="none" stroke={pal.line} strokeWidth="0.25" />

      <YardNumbers theme={theme} ruleset={ruleset ?? 'nfl'} />
    </g>
  )
}
