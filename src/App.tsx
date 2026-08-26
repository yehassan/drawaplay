import { BottomDock } from './components/shell/BottomDock'
import { CanvasStage } from './components/shell/CanvasStage'
import { InspectorPanel } from './components/shell/InspectorPanel'
import { LeftRail } from './components/shell/LeftRail'
import { TokenPalette } from './components/shell/TokenPalette'
import { TopBar } from './components/shell/TopBar'
import { PlaybookModal } from './components/shell/PlaybookModal'
import { QuickStartModal } from './components/shell/QuickStartModal'
import { usePersistence } from './hooks/usePersistence'
import { useShortcuts } from './hooks/useShortcuts'
import { useUITheme } from './hooks/useUITheme'
import { useEditorStore } from './stores/editorStore'

export default function App() {
  const paletteOpen = useEditorStore((s) => s.paletteOpen)
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
        <InspectorPanel />
      </div>
      <BottomDock />
      <QuickStartModal />
      <PlaybookModal />
    </div>
  )
}
