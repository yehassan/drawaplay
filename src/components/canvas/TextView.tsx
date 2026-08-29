import { useEffect, useRef, useState } from 'react'
import type { TextNote } from '../../stores/editorStore'
import { useEditorStore } from '../../stores/editorStore'
import { paletteFor } from '../../lib/theme'

export function TextView({
  note,
  selected,
  onPointerDown,
}: {
  note: TextNote
  selected: boolean
  onPointerDown: (e: React.PointerEvent<SVGGElement>, id: string) => void
}) {
  const updateTextNote = useEditorStore((s) => s.updateTextNote)
  const fieldTheme = useEditorStore((s) => s.fieldTheme)
  const pal = paletteFor(fieldTheme)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setDraft(note.text), [note.text])
  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    const t = draft.trim()
    if (t && t !== note.text) updateTextNote(note.id, t)
    else if (!t) updateTextNote(note.id, '')
    setEditing(false)
  }

  const cancel = () => {
    setDraft(note.text)
    setEditing(false)
  }

  // approx text width in field yards for hit area / selection outline
  const fontSize = 1.4
  const estW = Math.max(2.5, note.text.length * fontSize * 0.55 + 0.8)
  const estH = fontSize * 1.6

  if (editing) {
    return (
      <g transform={`translate(${note.x} ${note.y})`}>
        <foreignObject x={-estW / 2} y={-estH / 2} width={estW} height={estH}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') cancel()
            }}
            onBlur={commit}
            placeholder="Text"
            maxLength={24}
            className="h-full w-full rounded bg-chrome-900 px-1 text-center text-sm text-chrome-100 outline-none"
            style={{ fontFamily: 'var(--font-display)' }}
          />
        </foreignObject>
      </g>
    )
  }

  return (
    <g
      onPointerDown={(e) => onPointerDown(e, note.id)}
      onDoubleClick={() => setEditing(true)}
      style={{ cursor: selected ? 'grab' : 'pointer' }}
    >
      <rect
        x={note.x - estW / 2}
        y={note.y - estH / 2}
        width={estW}
        height={estH}
        fill="transparent"
        stroke={selected ? 'var(--color-accent-400)' : 'transparent'}
        strokeWidth={selected ? 0.08 : 0}
        rx={0.3}
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
        stroke="var(--color-chrome-950)"
        strokeWidth={0.07}
        paintOrder="stroke"
      >
        {note.text || 'Text'}
      </text>
    </g>
  )
}
