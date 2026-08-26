import { SCENARIOS } from '../../lib/scenarios'
import { useEditorStore } from '../../stores/editorStore'

export function ScenarioPicker() {
  const loadPlay = useEditorStore((s) => s.loadPlay)
  const resetPlayIdentity = useEditorStore((s) => s.resetPlayIdentity)

  return (
    <label className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-chrome-700 bg-chrome-900/90 py-1 pl-2.5 pr-1 text-xs text-chrome-400 shadow-lg backdrop-blur">
      <span className="font-medium">Scenario</span>
      <select
        value=""
        onChange={(e) => {
          const s = SCENARIOS.find((x) => x.name === e.target.value)
          if (s) {
            resetPlayIdentity()
            loadPlay({ ...s.build(), name: s.name })
          }
          e.target.value = ''
          e.currentTarget.blur()
        }}
        className="cursor-pointer rounded bg-transparent px-1 py-0.5 font-medium text-accent-400 outline-none hover:bg-chrome-800"
        title="Load a test scenario"
      >
        <option value="" disabled>
          Load scenario…
        </option>
        {SCENARIOS.map((s) => (
          <option key={s.name} value={s.name} className="bg-chrome-900 text-chrome-200">
            {s.name}
          </option>
        ))}
      </select>
    </label>
  )
}
