import { useEditorStore } from '../../stores/editorStore'
import { FieldCanvas } from '../canvas/FieldCanvas'
import { ScenarioPicker } from '../canvas/ScenarioPicker'

export function CanvasStage() {
  const tokenCount = useEditorStore((s) => s.tokens.length)

  return (
    <main className="relative min-w-0 flex-1 overflow-hidden bg-chrome-950">
      <div className="canvas-vignette pointer-events-none absolute inset-0" />
      <FieldCanvas />
      <ScenarioPicker />
      {tokenCount === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-5 text-center text-sm text-chrome-500">
          Drag players from the palette onto the field · scroll to pan ·{' '}
          <span className="text-chrome-400">⌘</span>-scroll to zoom
        </p>
      )}
    </main>
  )
}
