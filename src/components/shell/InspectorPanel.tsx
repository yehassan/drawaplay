import { useState, type ReactNode } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { posLabel } from '../../lib/positions'
import {
  FLIGHT_TYPES,
  PATH_STYLES,
  PLAYER_DRIVEN,
  TYPE_FAMILY,
  type BlockDir,
} from '../../lib/pathStyles'
import { ROUTE_CONCEPTS } from '../../lib/routeTemplates'
import { forwardY } from '../../lib/formations'
import { TypeSample } from '../ui/TypeSample'
import { Icon } from '../ui/icons'
import { IconButton } from '../ui/IconButton'

const BLOCK_DIRS: ReadonlyArray<{ key: BlockDir; label: string; title: string }> = [
  { key: 'left', label: '←', title: 'Block to his left' },
  { key: 'forward', label: '↑', title: 'Block straight ahead' },
  { key: 'right', label: '→', title: 'Block to his right' },
]

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
  ['1-9', 'Set path type (when a path is selected)'],
  ['Alt+click chip', 'Lock / unlock timing'],
  ['⌘Z', 'Undo'],
  ['⇧⌘Z', 'Redo'],
  ['Esc', 'Deselect / exit pen'],
  ['Backspace', 'Delete selection'],
]

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="pb-2 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
      {children}
    </p>
  )
}

/**
 * Named-route picker (BDB median shapes). Given a token it creates or reshapes
 * that player's route; given a path it reshapes that path.
 */
function RouteLibraryGrid({ pathId, tokenId }: { pathId?: string; tokenId?: string }) {
  const applyRouteTemplate = useEditorStore((s) => s.applyRouteTemplate)
  const setPlayerRoute = useEditorStore((s) => s.setPlayerRoute)

  return (
    <div>
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
              else if (tokenId) setPlayerRoute(tokenId, c.key)
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

const TRANSFER_TYPES = [
  { key: 'handoff' as const, label: 'Hand off' },
  { key: 'toss' as const, label: 'Toss' },
  { key: 'pass' as const, label: 'Pass' },
]

/**
 * The ball track: an ordered list of who has the ball and how they got it.
 * This is the authoring surface for possession — every row *is* the delivery
 * path, so removing a row removes the transfer and clicking one lets you adjust
 * its geometry.
 */
function BallTimeline() {
  const paths = useEditorStore((s) => s.paths)
  const tokens = useEditorStore((s) => s.tokens)
  const select = useEditorStore((s) => s.select)
  const deletePaths = useEditorStore((s) => s.deletePaths)
  const addTransfer = useEditorStore((s) => s.addTransfer)
  const setPathTarget = useEditorStore((s) => s.setPathTarget)
  const [picking, setPicking] = useState<typeof TRANSFER_TYPES[number]['key'] | null>(null)

  const nameOf = (id: string | null | undefined) => {
    const tk = tokens.find((x) => x.id === id)
    return tk ? tk.num || tk.letter || posLabel(tk.pos) : '?'
  }

  // deliveries in the order the ball changes hands
  const track = paths
    .filter((p) => FLIGHT_TYPES.has(p.type) && p.endTokenId)
    .sort((a, b) => a.timing.delayMs - b.timing.delayMs)

  const targets = tokens.filter((t) => t.side === 'offense')

  return (
    <div className="mb-4 border-b border-chrome-800 pb-4">
      <SectionLabel>Ball</SectionLabel>

      {track.length === 0 ? (
        <p className="rounded-xl border border-dashed border-chrome-700 px-3 py-2.5 text-[11px] leading-relaxed text-chrome-600">
          Nothing changes hands yet. Hand the ball off, toss it, or throw it.
        </p>
      ) : (
        <ul className="space-y-1">
          {track.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-lg border border-chrome-700 bg-chrome-850 px-2 py-1.5"
            >
              <span className="w-4 text-center font-mono text-[10px] text-chrome-500">{i + 1}</span>
              <TypeSample type={p.type} />
              <button
                type="button"
                title="Edit this delivery"
                onClick={() => select([p.id])}
                className="flex-1 truncate text-left text-xs text-chrome-300 hover:text-accent-400"
              >
                {nameOf(p.endTokenId)}
              </button>
              <select
                value={p.endTokenId ?? ''}
                onChange={(e) => setPathTarget(p.id, e.target.value || null)}
                title="Who receives it"
                className="rounded border border-chrome-700 bg-chrome-900 px-1 py-0.5 text-[10px] text-chrome-300 outline-none focus:border-accent-400/60"
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nameOf(t.id)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title="He never gets the ball"
                onClick={() => deletePaths([p.id])}
                className="px-1 text-xs text-chrome-400 hover:text-defense-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {TRANSFER_TYPES.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setPicking(picking === x.key ? null : x.key)}
            className={`rounded-[12px] border px-1 py-2 text-[11px] font-medium transition-colors ${
              picking === x.key
                ? 'border-accent-400/60 bg-accent-surface text-accent-400'
                : 'border-[var(--color-inspector-border)] bg-[var(--color-inspector-unselected)] text-[var(--color-inspector-text)] hover:border-[var(--color-inspector-hover-border)] hover:bg-[var(--color-inspector-hover)]'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {picking && (
        <div className="mt-2">
          <p className="pb-1 text-[10px] uppercase tracking-[0.06em] text-chrome-600">
            {TRANSFER_TYPES.find((x) => x.key === picking)!.label} to
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {targets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  addTransfer(picking, t.id)
                  setPicking(null)
                }}
                className="rounded-[12px] border border-chrome-700 bg-chrome-900 px-2 py-1.5 text-xs font-medium text-chrome-300 transition-colors hover:border-chrome-600 hover:bg-chrome-800"
              >
                {nameOf(t.id)}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const setRouteDepth = useEditorStore((s) => s.setRouteDepth)
  if (!path) return null
  const from = tokens.find((t) => t.id === path.tokenId)

  return (
    <>
      <SectionLabel>Path</SectionLabel>

      <p className="mb-2 text-xs text-chrome-500">
        From{' '}
        <span className="font-semibold text-offense-400">
          {from ? from.num || from.letter || posLabel(from.pos) : 'nothing'}
        </span>{' '}
        · drag the end handle onto a player to re-anchor
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {TYPE_FAMILY[path.type].map((type, i) => {
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
              <span className="ml-auto text-[9px] font-bold leading-none text-chrome-500">
                {i + 1}
              </span>
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
                  {t.num || t.letter || posLabel(t.pos)}
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

      {path.type === 'route' && <RouteLibraryGrid pathId={path.id} />}

      {path.type === 'route' &&
        (() => {
          const anchor = path.tokenId ? tokens.find((t) => t.id === path.tokenId) : null
          if (!anchor || path.points.length < 2) return null
          const lastY = path.points[path.points.length - 1].y
          const curDepth = Math.max(
            4,
            Math.min(18, (lastY - anchor.y) * forwardY(anchor.side)),
          )
          return (
            <div className="mt-4 rounded-[16px] border border-chrome-700 bg-chrome-850 p-3">
              <p className="text-xs font-semibold text-chrome-300">Break depth</p>
              <p className="mt-1 text-[11px] leading-relaxed text-chrome-500">
                How many yards downfield the break lands — drag to adjust.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] text-chrome-500">4 yd</span>
                <input
                  type="range"
                  min={4}
                  max={18}
                  step={0.5}
                  value={curDepth}
                  onChange={(e) => setRouteDepth(path.id, Number(e.target.value))}
                  className="flex-1 accent-accent-400"
                />
                <span className="text-[10px] text-chrome-500">18 yd</span>
              </div>
              <p className="mt-1 text-center text-[10px] font-medium text-chrome-400">
                {curDepth.toFixed(1)} yd
              </p>
            </div>
          )
        })()}

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
  const paths = useEditorStore((s) => s.paths)
  const select = useEditorStore((s) => s.select)
  const reorderPath = useEditorStore((s) => s.reorderPath)
  const renameToken = useEditorStore((s) => s.renameToken)
  const addBlock = useEditorStore((s) => s.addBlock)
  if (!token) return null

  // his movement sequence, in play order — this is the chain the scheduler
  // walks, so the row order is the order he does things
  const movement = paths.filter((p) => p.tokenId === token.id && PLAYER_DRIVEN.has(p.type))
  // picking a concept reshapes his route in place; there is only ever one
  const routePath = movement.find((p) => p.type === 'route')

  return (
    <>
      <SectionLabel>Player</SectionLabel>

      <label className="block text-xs text-chrome-500">
        Jersey number / label
        <input
          value={token.num}
          onChange={(e) => renameToken(token.id, e.target.value)}
          placeholder={posLabel(token.pos)}
          spellCheck={false}
          maxLength={3}
          className="mt-1 w-full rounded-[16px] border border-chrome-700 bg-chrome-850 px-2.5 py-1.5 text-sm font-medium text-chrome-200 outline-none focus:border-accent-400/60"
        />
      </label>

      <div className="mt-4">
        <p className="pb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-chrome-500">
          Movement
        </p>
        <p className="pb-2 text-[11px] leading-relaxed text-chrome-600">
          Done one after another, in this order. Use the arrows to change it.
        </p>
        {movement.length > 0 && (
          <ul className="mb-2 space-y-1">
            {movement.map((p, i) => (
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
                  title="Do this one earlier"
                  disabled={i === 0}
                  onClick={() => reorderPath(p.id, -1)}
                  className="px-1 text-xs text-chrome-400 hover:text-accent-400 disabled:opacity-25"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Do this one later"
                  disabled={i === movement.length - 1}
                  onClick={() => reorderPath(p.id, 1)}
                  className="px-1 text-xs text-chrome-400 hover:text-accent-400 disabled:opacity-25"
                >
                  ↓
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          {token.side === 'offense' && (
            <div>
              <p className="pb-1 text-[10px] uppercase tracking-[0.06em] text-chrome-600">
                {routePath ? 'Route shape' : 'Give him a route'}
              </p>
              <RouteLibraryGrid tokenId={token.id} />
            </div>
          )}
          <div>
            <p className="pb-1 text-[10px] uppercase tracking-[0.06em] text-chrome-600">
              + Block · pick a side
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {BLOCK_DIRS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => addBlock(token.id, d.key)}
                  title={d.title}
                  className="rounded-[12px] border border-[var(--color-inspector-border)] bg-[var(--color-inspector-unselected)] px-2 py-2 text-sm font-semibold text-[var(--color-inspector-text)] transition-colors hover:border-[var(--color-inspector-hover-border)] hover:bg-[var(--color-inspector-hover)]"
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

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
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">
        <BallTimeline />
        {body}
      </div>
    </aside>
  )
}
