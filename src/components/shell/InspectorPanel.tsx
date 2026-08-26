import type { ReactNode } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { POSITIONS } from '../../lib/positions'
import { PATH_STYLES, PATH_TYPE_ORDER, PLAYER_DRIVEN } from '../../lib/pathStyles'
import { TypeSample } from '../ui/TypeSample'
import { Icon } from '../ui/icons'

const SHORTCUTS: ReadonlyArray<readonly [string, string]> = [
  ['V', 'Select'],
  ['D', 'Pen (sticky)'],
  ['H / wheel', 'Pan field'],
  ['⌘+wheel', 'Zoom'],
  ['F', 'Fit to play'],
  ['Space', 'Play / pause'],
  ['Arrows', 'Nudge (⇧ = 2yd)'],
  ['⌘D', 'Duplicate selection'],
  ['Del', 'Delete selection'],
  ['Alt+click chip', 'Lock / unlock timing'],
  ['⌘Z', 'Undo'],
  ['⇧⌘Z', 'Redo'],
  ['Esc', 'Deselect / exit pen'],
]

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
      {children}
    </p>
  )
}

function EmptyState({ count }: { count: number }) {
  return (
    <>
      <div className="rounded-xl border border-dashed border-chrome-700 p-6 text-center">
        <Icon name="select" className="mx-auto size-6 text-chrome-600" />
        <p className="mt-3 text-sm font-medium text-chrome-300">
          {count > 1 ? `${count} items selected` : 'Nothing selected'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-chrome-500">
          Click a player or path on the field to edit its properties.
        </p>
      </div>

      <div className="mt-6">
        <SectionLabel>Shortcuts</SectionLabel>
        <ul className="space-y-1.5">
          {SHORTCUTS.map(([key, action]) => (
            <li key={key} className="flex items-center justify-between text-xs text-chrome-400">
              <span>{action}</span>
              <kbd className="rounded border border-chrome-700 bg-chrome-850 px-1.5 py-0.5 font-mono text-[10px] text-chrome-300">
                {key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}


function PathInspector({ pathId }: { pathId: string }) {
  const path = useEditorStore((s) => s.paths.find((p) => p.id === pathId))
  const tokens = useEditorStore((s) => s.tokens)
  const updatePathType = useEditorStore((s) => s.updatePathType)
  const deletePaths = useEditorStore((s) => s.deletePaths)
  if (!path) return null
  const from = tokens.find((t) => t.id === path.tokenId)

  return (
    <>
      <SectionLabel>Path</SectionLabel>

      <p className="mb-2 text-xs text-chrome-500">
        From{' '}
        <span className="font-semibold text-offense-400">
          {from ? from.num || POSITIONS[from.pos].label : '—'}
        </span>{' '}
        · inferred, click to change
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {PATH_TYPE_ORDER.map((type) => {
          const st = PATH_STYLES[type]
          const active = path.type === type
          return (
            <button
              key={type}
              type="button"
              onClick={() => updatePathType(path.id, type)}
              title={`Mark as ${st.label}`}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent-400/60 bg-accent-400/10 text-accent-400'
                  : 'border-chrome-700 bg-chrome-850 text-chrome-300 hover:border-chrome-600 hover:bg-chrome-800'
              }`}
            >
              <TypeSample type={type} />
              {st.label}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => deletePaths([path.id])}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-chrome-700 py-2 text-xs font-medium text-defense-400 transition-colors hover:border-defense-500/50 hover:bg-defense-500/10"
      >
        Delete path
      </button>
    </>
  )
}

function TokenInspector({ tokenId }: { tokenId: string }) {
  const token = useEditorStore((s) => s.tokens.find((t) => t.id === tokenId))
  const tokens = useEditorStore((s) => s.tokens)
  const paths = useEditorStore((s) => s.paths)
  const select = useEditorStore((s) => s.select)
  const reorderPath = useEditorStore((s) => s.reorderPath)
  const renameToken = useEditorStore((s) => s.renameToken)
  const ballStartId = useEditorStore((s) => s.ballStartId)
  const setBallStart = useEditorStore((s) => s.setBallStart)
  if (!token) return null

  // this player's movement sequence, in play order
  const chain = paths.filter((p) => p.tokenId === token.id && PLAYER_DRIVEN.has(p.type))

  const autoHolder = tokens.find((t) => t.pos === 'QB')?.id ?? null
  const holderId = ballStartId ?? autoHolder
  const isHolder = holderId === token.id

  return (
    <>
      <SectionLabel>Player</SectionLabel>

      <label className="block text-xs text-chrome-500">
        Jersey number / label
        <input
          value={token.num}
          onChange={(e) => renameToken(token.id, e.target.value)}
          placeholder={POSITIONS[token.pos].label}
          spellCheck={false}
          maxLength={3}
          className="mt-1 w-full rounded-lg border border-chrome-700 bg-chrome-850 px-2.5 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
        />
      </label>

      <button
        type="button"
        onClick={() => setBallStart(isHolder ? null : token.id)}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
          isHolder
            ? 'border-ball-500/60 bg-ball-500/10 text-accent-400'
            : 'border-chrome-700 bg-chrome-850 text-chrome-300 hover:border-chrome-600 hover:bg-chrome-800'
        }`}
      >
        {isHolder ? 'Ball starts with this player' : 'Give this player the ball'}
      </button>
      {ballStartId === null && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-chrome-600">
          Auto: the QB (or first handoff) gets the ball when unset.
        </p>
      )}

      {chain.length > 0 && (
        <div className="mt-3">
          <p className="pb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
            Movement sequence
          </p>
          <ul className="space-y-1">
            {chain.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center gap-2 rounded-lg border border-chrome-700 bg-chrome-850 px-2 py-1.5"
              >
                <span className="w-4 text-center font-mono text-[10px] text-chrome-500">{i + 1}</span>
                <TypeSample type={p.type} />
                <button
                  type="button"
                  onClick={() => select([p.id])}
                  className="flex-1 text-left text-xs text-chrome-300 hover:text-accent-400"
                >
                  {PATH_STYLES[p.type].label}
                </button>
                <button
                  type="button"
                  title="Move earlier"
                  disabled={i === 0}
                  onClick={() => reorderPath(p.id, -1)}
                  className="px-1 text-xs text-chrome-400 hover:text-accent-400 disabled:opacity-25"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Move later"
                  disabled={i === chain.length - 1}
                  onClick={() => reorderPath(p.id, 1)}
                  className="px-1 text-xs text-chrome-400 hover:text-accent-400 disabled:opacity-25"
                >
                  ↓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-relaxed text-chrome-500">
        Routes drawn from this player stay attached and will follow it during playback.
      </p>
    </>
  )
}

export function InspectorPanel() {
  const selectedIds = useEditorStore((s) => s.selectedIds)
  const tokens = useEditorStore((s) => s.tokens)
  const paths = useEditorStore((s) => s.paths)

  let body: ReactNode
  if (selectedIds.length === 1 && tokens.some((t) => t.id === selectedIds[0])) {
    body = <TokenInspector tokenId={selectedIds[0]} />
  } else if (selectedIds.length === 1 && paths.some((p) => p.id === selectedIds[0])) {
    body = <PathInspector pathId={selectedIds[0]} />
  } else {
    body = <EmptyState count={selectedIds.length} />
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-chrome-800 bg-chrome-900">
      <p className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
        Inspector
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">{body}</div>
    </aside>
  )
}
