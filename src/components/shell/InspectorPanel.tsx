import type { ReactNode } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { POSITIONS } from '../../lib/positions'
import { PATH_STYLES, PATH_TYPE_ORDER, PLAYER_DRIVEN } from '../../lib/pathStyles'
import { ROUTE_CONCEPTS } from '../../lib/routeTemplates'
import { TypeSample } from '../ui/TypeSample'
import { Icon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'

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

/** named-route picker (BDB median shapes): reshape a path or create one on a player */
function RouteLibraryGrid({ pathId, tokenId }: { pathId?: string; tokenId?: string }) {
  const applyRouteTemplate = useEditorStore((s) => s.applyRouteTemplate)
  const addTemplateRoute = useEditorStore((s) => s.addTemplateRoute)

  return (
    <div className="mt-4">
      <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
        Route library
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {ROUTE_CONCEPTS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              if (pathId) applyRouteTemplate(pathId, c.key)
              else if (tokenId) addTemplateRoute(tokenId, c.key)
            }}
            title={c.label}
            className="rounded-[12px] border border-[var(--color-inspector-border)] bg-[var(--color-inspector-unselected)] px-1 py-1.5 text-[11px] font-medium text-[var(--color-inspector-text)] transition-colors hover:border-[var(--color-inspector-hover-border)] hover:bg-[var(--color-inspector-hover)]"
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
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
  const allPaths = useEditorStore((s) => s.paths)
  const updatePathType = useEditorStore((s) => s.updatePathType)
  const deletePaths = useEditorStore((s) => s.deletePaths)
  const mirrorPath = useEditorStore((s) => s.mirrorPath)
  const setMotionSnapAt = useEditorStore((s) => s.setMotionSnapAt)
  const setPathTarget = useEditorStore((s) => s.setPathTarget)
  const setPassTrajectory = useEditorStore((s) => s.setPassTrajectory)
  if (!path) return null
  const from = tokens.find((t) => t.id === path.tokenId)

  return (
    <>
      <SectionLabel>Path</SectionLabel>

      <p className="mb-2 text-xs text-chrome-500">
        From{' '}
        <span className="font-semibold text-offense-400">
          {from ? from.num || from.letter || POSITIONS[from.pos].label : '—'}
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
              className={`flex items-center gap-2 rounded-[16px] border px-2.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent-400/60 bg-accent-surface text-accent-400'
                  : 'border-[var(--color-inspector-border)] bg-[var(--color-inspector-unselected)] text-[var(--color-inspector-text)] hover:border-[var(--color-inspector-hover-border)] hover:bg-[var(--color-inspector-hover)]'
              }`}
            >
              <TypeSample type={type} />
              {st.label}
            </button>
          )
        })}
      </div>

      {path.type === 'motion' && (
        <div className="mt-4 rounded-[16px] border border-chrome-700 bg-chrome-850 p-3">
          <p className="text-xs font-semibold text-chrome-300">Motion timing</p>
          <p className="mt-1 text-[11px] leading-relaxed text-chrome-500">
            Where the snap happens along this motion — left = jet/fake (still moving at snap), right = stop before snap.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-chrome-500">Jet</span>
            <input
              type="range"
              min={0.15}
              max={1}
              step={0.05}
              value={path.motionSnapAt ?? 1}
              onChange={(e) => setMotionSnapAt(path.id, Number(e.target.value))}
              className="flex-1 accent-accent-400"
            />
            <span className="text-[10px] text-chrome-500">Stop</span>
          </div>
          <p className="mt-1 text-center text-[10px] font-medium text-chrome-400">
            {(path.motionSnapAt ?? 1) >= 0.95 ? 'Stop before snap' : `Snap at ${Math.round((path.motionSnapAt ?? 1) * 100)}% — jet`}
          </p>
        </div>
      )}

      {['pass', 'handoff', 'toss'].includes(path.type) && (
        <div className="mt-4 rounded-[16px] border border-chrome-700 bg-chrome-850 p-3">
          <p className="text-xs font-semibold text-chrome-300">Throw to</p>
          <p className="mt-1 text-[11px] leading-relaxed text-chrome-500">
            Pick the receiver — the ball will reach them (arrival pins to their route).
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {tokens
              .filter((t) => t.side === 'offense' && t.id !== path.tokenId)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPathTarget(path.id, t.id)}
                  className={`rounded-[12px] border px-2 py-1.5 text-xs font-medium transition-colors ${
                    path.endTokenId === t.id
                      ? 'border-accent-400 bg-accent-400 text-chrome-950'
                      : 'border-chrome-700 bg-chrome-900 text-chrome-300 hover:border-chrome-600 hover:bg-chrome-800'
                  }`}
                >
                  {t.num || t.letter || POSITIONS[t.pos].label}
                </button>
              ))}
          </div>
        </div>
      )}
      {path.type === 'pass' &&
        (() => {
          const thrower = path.tokenId ? tokens.find((t) => t.id === path.tokenId) : null
          const target = path.endTokenId ? tokens.find((t) => t.id === path.endTokenId) : null
          if (!thrower || !target) return null
          const recRoute = allPaths.find(
            (q: import('../../stores/editorStore').PlayPath) =>
              q.tokenId === target.id &&
              q.type !== 'pass' &&
              q.type !== 'handoff' &&
              q.type !== 'toss' &&
              q.type !== 'snap' &&
              q.type !== 'motion' &&
              q.points.length >= 2,
          )
          const toPos = recRoute ? recRoute.points[recRoute.points.length - 1] : { x: target.x, y: target.y }
          const d = Math.hypot(toPos.x - thrower.x, toPos.y - thrower.y)
          const traj = path.passTrajectory ?? 'standard'
          return (
            <div className="mt-4 rounded-[16px] border border-chrome-700 bg-chrome-850 p-3">
              <p className="text-xs font-semibold text-chrome-300">Trajectory</p>
              <p className="mt-1 text-[11px] leading-relaxed text-chrome-500">
                {d.toFixed(1)} yd — touch lofts over the backer, standard is rhythm.
              </p>
              <div className="mt-2 flex rounded-full border border-chrome-700 p-0.5">
                {(['standard', 'touch'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPassTrajectory(path.id, v)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      traj === v ? 'bg-accent-400 text-chrome-950' : 'text-chrome-300 hover:bg-chrome-800'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

      {PLAYER_DRIVEN.has(path.type) && path.type !== 'motion' && (
        <RouteLibraryGrid pathId={path.id} />
      )}

      <button
        type="button"
        onClick={() => mirrorPath(path.id)}
        title="Mirror this path laterally (e.g. flip a wheel side)"
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-chrome-700 py-2 text-xs font-medium text-chrome-300 transition-colors hover:border-chrome-600 hover:bg-chrome-800"
      >
        Mirror ↔
      </button>

      <button
        type="button"
        onClick={() => deletePaths([path.id])}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-chrome-700 py-2 text-xs font-medium text-defense-400 transition-colors hover:border-defense-500/50 hover:bg-defense-500/10"
      >
        Delete path
      </button>
    </>
  )
}

function TextInspector({ noteId }: { noteId: string }) {
  const note = useEditorStore((s) => s.textNotes.find((n) => n.id === noteId))
  const updateTextNote = useEditorStore((s) => s.updateTextNote)
  const deleteTextNotes = useEditorStore((s) => s.deleteTextNotes)
  if (!note) return null
  return (
    <>
      <SectionLabel>Text</SectionLabel>
      <label className="block text-xs text-chrome-500">
        Content
        <input
          value={note.text}
          onChange={(e) => updateTextNote(note.id, e.target.value)}
          placeholder="Text"
          spellCheck={false}
          maxLength={24}
          className="mt-1 w-full rounded-[16px] border border-chrome-700 bg-chrome-850 px-2.5 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
        />
      </label>
      <button
        type="button"
        onClick={() => deleteTextNotes([note.id])}
        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-chrome-700 py-2 text-xs font-medium text-defense-400 transition-colors hover:border-defense-500/50 hover:bg-defense-500/10"
      >
        Delete text
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
  const addPath = useEditorStore((s) => s.addPath)
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
          className="mt-1 w-full rounded-[16px] border border-chrome-700 bg-chrome-850 px-2.5 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
        />
      </label>

      <button
        type="button"
        onClick={() => setBallStart(isHolder ? null : token.id)}
        className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border py-2 text-xs font-medium transition-colors ${
          isHolder
            ? 'border-ball-500/60 bg-accent-surface text-accent-400'
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

      {token.side === 'offense' && <RouteLibraryGrid tokenId={token.id} />}

      {token.side === 'offense' && (
        <div className="mt-3 rounded-[16px] border border-chrome-700 bg-chrome-850 p-3">
          <p className="text-xs font-semibold text-chrome-300">Throw to</p>
          <p className="mt-1 text-[11px] leading-relaxed text-chrome-500">
            Tap a teammate — a pass will reach them (arrival at their route).
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {tokens
              .filter((t) => t.side === 'offense' && t.id !== token.id)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const recRoute = paths.find(
                      (q) =>
                        q.tokenId === t.id &&
                        q.type !== 'pass' &&
                        q.type !== 'handoff' &&
                        q.type !== 'toss' &&
                        q.type !== 'snap' &&
                        q.type !== 'motion' &&
                        q.points.length >= 2,
                    )
                    const toPos = recRoute ? recRoute.points[recRoute.points.length - 1] : { x: t.x, y: t.y }
                    addPath({
                      tokenId: token.id,
                      endTokenId: t.id,
                      type: 'pass',
                      points: [{ x: token.x, y: token.y }, toPos],
                      d: '',
                    })
                  }}
                  className="rounded-[12px] border border-chrome-700 bg-chrome-900 px-2 py-1.5 text-xs font-medium text-chrome-300 transition-colors hover:border-chrome-600 hover:bg-chrome-800"
                >
                  {t.num || t.letter || POSITIONS[t.pos].label}
                </button>
              ))}
          </div>
        </div>
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
  const textNotes = useEditorStore((s) => s.textNotes)
  const toggleInspector = useEditorStore((s) => s.toggleInspector)

  let body: ReactNode
  if (selectedIds.length === 1 && tokens.some((t) => t.id === selectedIds[0])) {
    body = <TokenInspector tokenId={selectedIds[0]} />
  } else if (selectedIds.length === 1 && paths.some((p) => p.id === selectedIds[0])) {
    body = <PathInspector pathId={selectedIds[0]} />
  } else if (selectedIds.length === 1 && textNotes.some((n) => n.id === selectedIds[0])) {
    body = <TextInspector noteId={selectedIds[0]} />
  } else {
    body = <EmptyState count={selectedIds.length} />
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-chrome-800 bg-chrome-900">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
          Inspector
        </p>
        <IconButton label="Collapse inspector" active onClick={toggleInspector} className="!size-7">
          <Icon name="book" className="size-3.5" />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">{body}</div>
    </aside>
  )
}
