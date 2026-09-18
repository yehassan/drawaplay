import { useState } from 'react'
import { exportPNG, exportWebM } from '../../lib/exporters'
import { putPlay, getPlay } from '../../lib/playbook'
import { ALL_FIELD_THEMES, paletteFor, type FieldTheme } from '../../lib/theme'
import { ALL_RULESETS } from '../../lib/field'
import { Icon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'
import { useEditorStore } from '../../stores/editorStore'

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <circle cx="7" cy="17.5" r="3" fill="var(--color-accent-400)" />
      <path
        d="M7 14C7 8 13 10 17.5 4.5"
        fill="none"
        stroke="var(--color-chrome-100)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14.5 4.5h3v3"
        fill="none"
        stroke="var(--color-chrome-100)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Divider() {
  return <div className="mx-1 h-6 w-px shrink-0 bg-chrome-700" aria-hidden="true" />
}

export function TopBar() {
  const playName = useEditorStore((s) => s.playName)
  const renamePlay = useEditorStore((s) => s.renamePlay)
  const openQuickStart = useEditorStore((s) => s.openQuickStart)
  const openLibrary = useEditorStore((s) => s.openLibrary)
  const saveState = useEditorStore((s) => s.saveState)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportBusy, setExportBusy] = useState<string | null>(null)
  const fieldTheme = useEditorStore((s) => s.fieldTheme)
  const setFieldTheme = useEditorStore((s) => s.setFieldTheme)
  const ruleset = useEditorStore((s) => s.ruleset)
  const setRuleset = useEditorStore((s) => s.setRuleset)
  const uiTheme = useEditorStore((s) => s.uiTheme)
  const setUITheme = useEditorStore((s) => s.setUITheme)
  const playId = useEditorStore((s) => s.playId)
  const loadPlay = useEditorStore((s) => s.loadPlay)
  const resetPlayIdentity = useEditorStore((s) => s.resetPlayIdentity)
  const openScout = useEditorStore((s) => s.openScout)
  const tokens = useEditorStore((s) => s.tokens)
  const hasOffense = tokens.some((t) => t.side === 'offense')
  const hasDefense = tokens.some((t) => t.side === 'defense')
  const showScout = tokens.length > 0
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [trashOpen, setTrashOpen] = useState(false)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)

  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-chrome-800 bg-chrome-900 px-3">
      <div className="flex items-center gap-2 pr-1">
        <LogoMark />
        <span className="font-display text-lg font-semibold tracking-tight text-chrome-100">
          Draw<span className="text-accent-400">A</span>PLAY
        </span>
      </div>

      <Divider />

      <button
        type="button"
        onClick={openLibrary}
        title="Playbook library"
        className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-sm text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
      >
        <Icon name="book" className="size-4" />
        Playbook
      </button>
      <Icon name="chevron-down" className="size-3.5 shrink-0 text-chrome-600" />

      <input
        value={playName}
        onChange={(e) => renamePlay(e.target.value)}
        spellCheck={false}
        aria-label="Play name"
        className="w-44 rounded-full bg-transparent px-2 py-1 text-sm font-medium text-chrome-200 outline-none transition-colors hover:bg-chrome-800 focus:bg-chrome-800"
      />

      <span className="hidden items-center gap-1.5 pl-1 text-xs text-chrome-500 lg:flex" title="Changes save automatically to this browser">
        <span
          className={`size-1.5 rounded-full ${
            saveState === 'saving'
              ? 'bg-accent-400 animate-pulse'
              : saveState === 'dirty'
                ? 'bg-amber-400'
                : 'bg-emerald-400/80'
          }`}
        />
        {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved' : 'Saved'}
      </span>

      <div className="min-w-2 flex-1" />

      <IconButton label="Undo (⌘Z)" disabled={!canUndo} onClick={undo}>
        <Icon name="undo" className="size-[18px]" />
      </IconButton>
      <IconButton label="Redo (⇧⌘Z)" disabled={!canRedo} onClick={redo}>
        <Icon name="redo" className="size-[18px]" />
      </IconButton>

      <Divider />

      <IconButton
        label={uiTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        onClick={() => setUITheme(uiTheme === 'dark' ? 'light' : 'dark')}
      >
        <Icon name={uiTheme === 'dark' ? 'sun' : 'moon'} className="size-[18px]" />
      </IconButton>

      <div className="relative">
        <IconButton
          label="Settings"
          active={settingsOpen}
          onClick={() => {
            setSettingsOpen((v) => !v)
            setExportOpen(false)
          }}
        >
          <Icon name="gear" className="size-[18px]" />
        </IconButton>
        {settingsOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-[20px] border border-chrome-700 bg-chrome-900 p-3 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_8px_40px_0px_rgba(0,0,0,0.1)]">
            <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-chrome-500">
              Field fill
            </p>
            <div className="flex gap-1.5">
              {ALL_FIELD_THEMES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  title={`${t.label} turf`}
                  onClick={() => setFieldTheme(t.key as FieldTheme)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-[16px] border px-1 py-1.5 transition-colors ${
                    fieldTheme === t.key
                      ? 'border-accent-400/70 bg-accent-surface'
                      : 'border-chrome-700 hover:border-chrome-600'
                  }`}
                >
                  <span
                    className="block h-6 w-full rounded"
                    style={{ background: `linear-gradient(135deg, ${paletteFor(t.key).stripeA}, ${paletteFor(t.key).stripeB})` }}
                  />
                  <span
                    className={`text-[10px] font-medium ${
                      fieldTheme === t.key ? 'text-accent-400' : 'text-chrome-400'
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
            <p className="pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-chrome-500">
              Ruleset
            </p>
            <div className="flex gap-1.5">
              {ALL_RULESETS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  title={r.hint}
                  onClick={() => setRuleset(r.key)}
                  className={`flex-1 rounded-[16px] border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                    ruleset === r.key
                      ? 'border-accent-400/70 bg-accent-surface text-accent-400'
                      : 'border-chrome-700 text-chrome-400 hover:border-chrome-600'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setExportOpen((v) => !v)
            setSettingsOpen(false)
          }}
          title="Export this play"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-chrome-400 transition-colors hover:bg-chrome-800 hover:text-chrome-200"
        >
          <Icon name="download" className="size-4" />
          {exportBusy ?? 'Export'}
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-52 overflow-hidden rounded-[20px] border border-chrome-700 bg-chrome-900 shadow-[0_0_0_1px_rgba(4,23,43,0.05),0_8px_40px_0px_rgba(0,0,0,0.1)]">
            {[
              {
                label: 'PNG — full diagram',
                hint: 'static, hi-res',
                run: async () => {
                  const st = useEditorStore.getState()
                  await exportPNG({ name: st.playName, tokens: st.tokens, paths: st.paths, textNotes: st.textNotes, ballStartId: st.ballStartId, losSpec: st.losSpec, fieldTheme, ruleset: st.ruleset })
                },
              },
              {
                label: 'Video',
                hint: 'MP4 or WebM — one playback pass',
                run: async () => {
                  const st = useEditorStore.getState()
                  await exportWebM(
                    { name: st.playName, tokens: st.tokens, paths: st.paths, textNotes: st.textNotes, ballStartId: st.ballStartId, losSpec: st.losSpec, fieldTheme, ruleset: st.ruleset },
                    () => setExportBusy('Recording…'),
                  )
                },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={exportBusy !== null}
                onClick={async () => {
                  setExportOpen(false)
                  try {
                    setExportBusy('Exporting…')
                    await item.run()
                  } finally {
                    setExportBusy(null)
                  }
                }}
                className="flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-chrome-800 disabled:opacity-40"
              >
                <span className="text-sm font-medium text-chrome-200">{item.label}</span>
                <span className="text-[10px] text-chrome-500">{item.hint}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showScout && (
        <button
          type="button"
          onClick={openScout}
          title={hasOffense && hasDefense ? 'Change scout team' : hasOffense ? 'Add scout defense' : 'Add scout offense'}
          className="ml-1 hidden items-center gap-1 rounded-full border border-chrome-700 px-3 py-1.5 text-xs font-medium text-chrome-300 hover:border-chrome-600 hover:bg-chrome-800 lg:flex"
        >
          {hasOffense && hasDefense ? 'Scout' : `+ Scout ${hasOffense ? 'defense' : 'offense'}`}
        </button>
      )}

      <button
        type="button"
        onClick={openQuickStart}
        title="Start a new play"
        className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-accent-400 px-3 py-1.5 text-sm font-semibold text-chrome-950 transition-colors hover:bg-accent-300"
      >
        <Icon name="plus" className="size-4" />
        New Play
      </button>

      {playId && (
        <IconButton label="Trash play" onClick={() => setTrashOpen(true)}>
          <Icon name="trash" className="size-[18px]" />
        </IconButton>
      )}

      {trashOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setTrashOpen(false)}>
          <div
            className="rounded-[20px] border border-chrome-700 bg-chrome-900 p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-chrome-100">Move "{playName}" to trash?</p>
            <p className="mt-1 text-xs text-chrome-500">You can restore it from the Playbook.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTrashOpen(false)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-chrome-400 transition-colors hover:bg-chrome-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (playId) {
                    const rec = await getPlay(playId)
                    if (rec) await putPlay({ ...rec, deletedAt: Date.now() })
                  }
                  setTrashOpen(false)
                  resetPlayIdentity()
                  loadPlay({ name: 'Untitled', los: { side: 'ours', n: 25 }, tokens: [], paths: [] })
                }}
                className="rounded-full bg-defense-500 px-3 py-1.5 text-xs font-semibold text-chrome-950 transition-colors hover:bg-defense-400"
              >
                Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
