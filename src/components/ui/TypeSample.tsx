import { PATH_STYLES, type PathType } from '../../lib/pathStyles'
import { styleColor, type FieldTheme } from '../../lib/theme'
import { useEditorStore } from '../../stores/editorStore'

export function TypeSample({ type }: { type: PathType }) {
  const theme: FieldTheme = useEditorStore((s) => s.fieldTheme)
  const base = PATH_STYLES[type]
  const st = { ...base, color: styleColor(base.color, theme) }
  return (
    <svg viewBox="0 0 36 14" className="h-3.5 w-9">
      {type === 'block' ? (
        <>
          <path d="M10 7H30" stroke={st.color} strokeWidth="2" strokeLinecap="round" />
          <path d="M30 1.8V12.2" stroke={st.color} strokeWidth="2" strokeLinecap="round" />
        </>
      ) : type === 'run' ? (
        <>
          <path d="M4 7C12 7 22 7 30 7" stroke={st.color} strokeWidth="6" opacity="0.18" strokeLinecap="round" />
          <path d="M4 7C12 7 22 7 27 7" stroke={st.color} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M28 3.4L33 7L28 10.6z" fill={st.color} />
        </>
      ) : (
        <>
          <path
            d="M4 11C12 11 24 9 29 4"
            fill="none"
            stroke={st.color}
            strokeWidth={st.width * 7}
            strokeDasharray={st.dash ?? undefined}
            strokeLinecap="round"
          />
          {st.arrow && <path d="M27 2.2L32.5 3L29.5 8z" fill={st.color} />}
          {st.endDot && <circle cx="31.5" cy="3.4" r="1.6" fill={st.color} />}
        </>
      )}
    </svg>
  )
}
