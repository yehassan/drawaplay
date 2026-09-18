import { BottomDock } from './components/shell/BottomDock'
import { CanvasStage } from './components/shell/CanvasStage'
import { InspectorPanel } from './components/shell/InspectorPanel'
import { LeftRail } from './components/shell/LeftRail'
import { TokenPalette } from './components/shell/TokenPalette'
import { TopBar } from './components/shell/TopBar'
import { Icon } from './components/ui/icons'
import { PlaybookModal } from './components/shell/PlaybookModal'
import { QuickStartModal } from './components/shell/QuickStartModal'
import { ScoutModal } from './components/shell/ScoutModal'
import { usePersistence } from './hooks/usePersistence'
import { useShortcuts } from './hooks/useShortcuts'
import { useUITheme } from './hooks/useUITheme'
import { useEditorStore } from './stores/editorStore'

export default function App() {
  const paletteOpen = useEditorStore((s) => s.paletteOpen)
  const inspectorOpen = useEditorStore((s) => s.inspectorOpen)
  const toggleInspector = useEditorStore((s) => s.toggleInspector)
  useShortcuts()
  usePersistence()
  useUITheme()

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <LeftRail />
        {paletteOpen && <TokenPalette />}
        <CanvasStage />
        {inspectorOpen ? (
          <InspectorPanel />
        ) : (
          <button
            type="button"
            onClick={toggleInspector}
            title="Expand inspector"
            aria-label="Expand inspector"
            className="flex w-7 shrink-0 flex-col items-center gap-2 border-l border-chrome-800 bg-chrome-900 py-3 text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
          >
            <span className="grid size-6 place-items-center rounded">
              <Icon name="book" className="size-3.5" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] [writing-mode:vertical-rl]">
              Inspector
            </span>
          </button>
        )}
      </div>
      <BottomDock />
      <QuickStartModal />
      <ScoutModal />
      <PlaybookModal />
    </div>
  )
}
