import type { TextNote } from '../../stores/editorStore'
import { useEditorStore } from '../../stores/editorStore'
import { paletteFor } from '../../lib/theme'

export function TextView({
  note,
  selected,
  onPointerDown,
  onDoubleClick,
}: {
  note: TextNote
  selected: boolean
  onPointerDown: (e: React.PointerEvent<SVGGElement>, id: string) => void
  onDoubleClick: (id: string) => void
}) {
  const fieldTheme = useEditorStore((s) => s.fieldTheme)
  const pal = paletteFor(fieldTheme)

  // approx text width in field yards for hit area / selection outline
  const fontSize = 1.4
  const estW = Math.max(2.5, note.text.length * fontSize * 0.55 + 0.8)
  const estH = fontSize * 1.6

  const isPlaceholder = !note.text
  return (
    <g
      onPointerDown={(e) => onPointerDown(e, note.id)}
      onDoubleClick={() => onDoubleClick(note.id)}
      style={{ cursor: selected ? 'grab' : 'pointer' }}
    >
      <rect
        x={note.x - estW / 2}
        y={note.y - estH / 2}
        width={estW}
        height={estH}
        fill={selected ? 'var(--color-accent-surface)' : 'transparent'}
        fillOpacity={selected ? 0.35 : 0}
        stroke={selected ? 'var(--color-accent-400)' : 'transparent'}
        strokeWidth={selected ? 0.1 : 0}
        rx={0.4}
      />
      <text
        x={note.x}
        y={note.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="var(--font-display)"
        fontWeight={700}
        fill={pal.line}
        opacity={isPlaceholder ? 0.55 : 1}
        stroke="var(--color-chrome-950)"
        strokeWidth={0.07}
        paintOrder="stroke"
      >
        {note.text || 'Text'}
      </text>
    </g>
  )
}
