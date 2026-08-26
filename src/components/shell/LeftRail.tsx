import { useEditorStore, type Tool } from '../../stores/editorStore'
import { Icon, type IconName } from '../ui/icons'
import { IconButton } from '../ui/IconButton'

const TOOLS: ReadonlyArray<{ id: Tool; icon: IconName; label: string }> = [
  { id: 'select', icon: 'select', label: 'Select (V)' },
  { id: 'draw', icon: 'draw', label: 'Pen — draw many routes (D)' },
  { id: 'pan', icon: 'pan', label: 'Pan field (H) — or scroll / middle-drag' },
  { id: 'text', icon: 'text', label: 'Text note (T)' },
]

export function LeftRail() {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const paletteOpen = useEditorStore((s) => s.paletteOpen)
  const togglePalette = useEditorStore((s) => s.togglePalette)

  return (
    <nav className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-chrome-800 bg-chrome-900 py-2">
      {TOOLS.map(({ id, icon, label }) => (
        <IconButton
          key={id}
          label={label}
          active={tool === id}
          onClick={() => setTool(id)}
        >
          <Icon name={icon} className="size-[18px]" />
        </IconButton>
      ))}

      <div className="mt-auto">
        <IconButton
          label={paletteOpen ? 'Hide player palette' : 'Show player palette'}
          active={paletteOpen}
          onClick={togglePalette}
        >
          <Icon name="book" className="size-[18px]" />
        </IconButton>
      </div>
    </nav>
  )
}
