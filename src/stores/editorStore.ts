import { create } from 'zustand'
import { catmullRomPath } from '../lib/geometry'
import { applySchedule, timelineDuration, type Timing } from '../lib/timing'
import { resolveFlightTarget } from '../lib/target'
import { PLAYER_DRIVEN } from '../lib/pathStyles'
import type { FieldTheme } from '../lib/theme'
import type { Pt, Ruleset } from '../lib/field'
import type { PathType } from '../lib/pathStyles'

export type Tool = 'select' | 'draw' | 'erase' | 'pan' | 'text'
export type Side = 'offense' | 'defense'
export type PosId = 'QB' | 'RB' | 'FB' | 'WR' | 'TE' | 'C' | 'G' | 'T' | 'DL' | 'LB' | 'CB' | 'S'

export interface Token {
  id: string
  side: Side
  pos: PosId
  num: string
  x: number
  y: number
}

export interface TextNote {
  id: string
  x: number
  y: number
  text: string
}

export interface PlayPath {
  id: string
  /** anchor token — path translates when this token moves */
  tokenId: string | null
  /** token the far end attaches to (block target, pass receiver…) */
  endTokenId: string | null
  type: PathType
  points: Pt[]
  d: string
  timing: Timing
  /** set when the user hand-tuned timing — reschedule preserves it */
  userLocked?: boolean
  /** for motion only: fraction of duration where snap occurs (0.1..1.0, 1 = stop before snap) */
  motionSnapAt?: number
}

export type Speed = 0.5 | 1 | 2

export interface Playback {
  playing: boolean
  /** playhead position in ms within [0, timelineDuration] */
  tMs: number
  speed: Speed
  loop: boolean
}

export interface Camera {
  zoom: number
  tx: number
  ty: number
}

interface Snapshot {
  tokens: Token[]
  paths: PlayPath[]
  textNotes: TextNote[]
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved'

export interface LosSpec {
  side: 'ours' | 'theirs'
  n: number
}

interface EditorState {
  playName: string
  tool: Tool
  quickStartOpen: boolean
  /** line of scrimmage metadata for the current play (from quickstart) */
  losSpec: LosSpec | null
  fieldTheme: FieldTheme
  ruleset: Ruleset
  uiTheme: 'dark' | 'light'
  /** path id whose one-shot type bar is showing */
  typeBarFor: string | null
  /** bumped whenever a whole play loads so the canvas can re-fit */
  fitNonce: number
  /** persisted record id for the current doc (null = not yet saved) */
  playId: string | null
  saveState: 'idle' | 'dirty' | 'saving' | 'saved'
  libraryOpen: boolean
  paletteOpen: boolean
  inspectorOpen: boolean
  tokens: Token[]
  paths: PlayPath[]
  textNotes: TextNote[]
  /** token holding the ball at the snap; null = auto (first handoff, else QB) */
  ballStartId: string | null
  selectedIds: string[]
  camera: Camera
  playback: Playback
  past: Snapshot[]
  future: Snapshot[]

  setTool: (tool: Tool) => void
  openQuickStart: () => void
  closeQuickStart: () => void
  setPlayId: (id: string | null) => void
  /** drop the persisted identity so the next autosave creates a NEW record */
  resetPlayIdentity: () => void
  setSaveState: (s: SaveState) => void
  setFieldTheme: (t: FieldTheme) => void
  setRuleset: (r: Ruleset) => void
  setUITheme: (t: 'dark' | 'light') => void
  openLibrary: () => void
  closeLibrary: () => void
  showTypeBar: (id: string | null) => void
  renamePlay: (name: string) => void
  togglePalette: () => void
  toggleInspector: () => void
  newPlay: () => void

  addToken: (t: Omit<Token, 'id'>) => void
  renameToken: (id: string, num: string) => void
  moveTokensLive: (updates: Record<string, { x: number; y: number }>) => void
  deleteTokens: (ids: string[]) => void
  nudgeSelected: (dx: number, dy: number) => void
  duplicateSelected: () => void
  addPath: (p: Omit<PlayPath, 'id' | 'timing'>) => string
  updatePathType: (id: string, type: PathType) => void
  applyScheduleNow: () => void
  setPathTimingLive: (
    id: string,
    patch: { delayMs?: number; durationMs?: number },
  ) => void
  setPathLocked: (id: string, userLocked: boolean) => void
  setMotionSnapAt: (id: string, snapAt: number) => void
  reorderPath: (id: string, dir: -1 | 1) => void
  setPathEndpointLive: (
    id: string,
    which: 'start' | 'end',
    x: number,
    y: number,
    anchorTokenId?: string | null,
  ) => void
  deletePaths: (ids: string[]) => void
  addTextNote: (t: Omit<TextNote, 'id'>) => string
  updateTextNote: (id: string, text: string) => void
  moveTextNotesLive: (updates: Record<string, { x: number; y: number }>) => void
  deleteTextNotes: (ids: string[]) => void
  deleteSelected: () => void
  select: (ids: string[]) => void
  setBallStart: (id: string | null) => void
  loadPlay: (play: {
    name: string
    tokens: Token[]
    paths: Omit<PlayPath, 'id' | 'timing'>[]
    textNotes?: TextNote[]
    los?: LosSpec | null
    fieldTheme?: FieldTheme
    ruleset?: Ruleset
  }) => void
  setCamera: (cam: Camera) => void

  togglePlay: () => void
  seek: (tMs: number) => void
  cycleSpeed: () => void
  toggleLoop: () => void

  beginHistory: () => void
  undo: () => void
  redo: () => void
}

let lastNudgeAt = 0

const uid = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random().toString(36).slice(2)}`

const snap = (s: Snapshot): Snapshot => ({
  tokens: s.tokens.map((t) => ({ ...t })),
  paths: s.paths.map((p) => ({ ...p })),
  textNotes: s.textNotes.map((n) => ({ ...n })),
})

export const useEditorStore = create<EditorState>((set, get) => ({
  playName: 'Untitled Play',
  tool: 'select',
  quickStartOpen: true,
  paletteOpen: true,
  inspectorOpen: true,
  tokens: [],
  paths: [],
  textNotes: [],
  ballStartId: null,
  selectedIds: [],
  camera: { zoom: 16, tx: 0, ty: 0 },
  typeBarFor: null,
  fitNonce: 0,
  losSpec: null,
  fieldTheme: 'green',
  ruleset: 'nfl',
  uiTheme: (typeof localStorage !== 'undefined' && localStorage.getItem('dap-ui-theme') === 'light' ? 'light' : 'dark') as 'dark' | 'light',
  playId: null,
  saveState: 'idle',
  libraryOpen: false,
  playback: { playing: false, tMs: 0, speed: 1, loop: false },
  past: [],
  future: [],

  togglePlay: () =>
    set((s) => {
      if (s.paths.length === 0) return {}
      // replay from the top when finished
      if (
        !s.playback.playing &&
        !s.playback.loop &&
        s.playback.tMs >= timelineDuration(s.paths)
      ) {
        return { playback: { ...s.playback, playing: true, tMs: 0 } }
      }
      return { playback: { ...s.playback, playing: !s.playback.playing } }
    }),

  seek: (tMs) => set((s) => ({ playback: { ...s.playback, tMs } })),

  cycleSpeed: () =>
    set((s) => ({
      playback: {
        ...s.playback,
        speed: s.playback.speed === 0.5 ? 1 : s.playback.speed === 1 ? 2 : 0.5,
      },
    })),

  toggleLoop: () =>
    set((s) => ({ playback: { ...s.playback, loop: !s.playback.loop } })),

  setTool: (tool) => set({ tool, typeBarFor: null }),

  openQuickStart: () => set({ quickStartOpen: true, typeBarFor: null }),
  closeQuickStart: () => set({ quickStartOpen: false }),
  setPlayId: (playId) => set({ playId }),
  resetPlayIdentity: () => set({ playId: null, saveState: 'dirty' }),
  setSaveState: (saveState) => set({ saveState }),
  setFieldTheme: (fieldTheme) => set({ fieldTheme }),
  setRuleset: (ruleset: Ruleset) => set({ ruleset }),
  setUITheme: (uiTheme) => {
    set({ uiTheme })
    if (typeof localStorage !== 'undefined') localStorage.setItem('dap-ui-theme', uiTheme)
  },
  openLibrary: () => set({ libraryOpen: true, typeBarFor: null }),
  closeLibrary: () => set({ libraryOpen: false }),
  showTypeBar: (typeBarFor) => set({ typeBarFor }),
  renamePlay: (playName) => set({ playName }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  newPlay: () =>
    set((s) => ({
      playName: 'Untitled Play',
      tool: 'select',
      tokens: [],
      paths: [],
      textNotes: [],
      ballStartId: null,
      selectedIds: [],
      past: [],
      future: [],
      camera: s.camera,
      playback: { ...s.playback, playing: false, tMs: 0 },
    })),

  addToken: (t) => {
    const token: Token = { ...t, id: uid() }
    get().beginHistory()
    set((s) => ({ tokens: [...s.tokens, token], selectedIds: [token.id] }))
  },

  renameToken: (id, num) =>
    set((s) => ({
      tokens: s.tokens.map((t) => (t.id === id ? { ...t, num } : t)),
    })),

  moveTokensLive: (updates) =>
    set((s) => {
      const deltas = new Map<string, Pt>()
      for (const t of s.tokens) {
        const u = updates[t.id]
        if (u) deltas.set(t.id, { x: u.x - t.x, y: u.y - t.y })
      }
      return {
        tokens: s.tokens.map((t) => {
          const u = updates[t.id]
          return u ? { ...t, x: u.x, y: u.y } : t
        }),
        paths: s.paths.map((p) => {
          if (!p.tokenId) return p
          const d = deltas.get(p.tokenId)
          if (!d || (d.x === 0 && d.y === 0)) return p
          const points = p.points.map((pt) => ({ x: pt.x + d.x, y: pt.y + d.y }))
          return { ...p, points, d: catmullRomPath(points) }
        }),
      }
    }),

  deleteTokens: (ids) => {
    if (ids.length === 0) return
    get().beginHistory()
    set((s) => ({
      tokens: s.tokens.filter((t) => !ids.includes(t.id)),
      // deleting a player deletes its anchored paths
      paths: s.paths.filter((p) => !p.tokenId || !ids.includes(p.tokenId)),
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
    }))
  },

  addPath: (p) => {
    const created: PlayPath = { ...p, id: uid(), timing: { delayMs: 0, durationMs: 600 } }
    get().beginHistory()
    set((s) => ({
      paths: applySchedule([...s.paths, created]),
      // select the new path so the inspector/type bar is ready — but keep
      // whatever tool is armed (pen stays sticky)
      selectedIds: [created.id],
      typeBarFor: created.id,
    }))
    return created.id
  },

  // hand-tuned timing locks the path against future reschedules
  setPathTimingLive: (id, patch) =>
    set((s) => ({
      paths: s.paths.map((p) =>
        p.id === id
          ? {
              ...p,
              userLocked: true,
              timing: {
                delayMs: patch.delayMs ?? p.timing.delayMs,
                durationMs: Math.max(
                  250,
                  patch.durationMs ?? p.timing.durationMs,
                ),
              },
            }
          : p,
      ),
    })),

  setPathLocked: (id, userLocked) => {
    get().beginHistory()
    set((s) => ({
      paths: s.paths.map((p) => (p.id === id ? { ...p, userLocked } : p)),
    }))
  },

  setMotionSnapAt: (id, snapAt) => {
    const clamped = Math.max(0.1, Math.min(1, snapAt))
    get().beginHistory()
    set((s) => ({
      paths: applySchedule(s.paths.map((p) => (p.id === id ? { ...p, motionSnapAt: clamped } : p))),
    }))
  },

  /** swap a player-driven path with its previous/next sibling (draw order = play order) */
  reorderPath: (id, dir) => {
    const paths = get().paths
    const idx = paths.findIndex((p) => p.id === id)
    if (idx < 0) return
    const p = paths[idx]!
    if (!p.tokenId || !PLAYER_DRIVEN.has(p.type)) return
    const siblings = paths
      .map((q, i) => ({ q, i }))
      .filter(({ q }) => q.tokenId === p.tokenId && PLAYER_DRIVEN.has(q.type))
    const si = siblings.findIndex((x) => x.q.id === id)
    const gj = si + dir
    if (si < 0 || gj < 0 || gj >= siblings.length) return
    get().beginHistory()
    const next = [...paths]
    const gi = siblings[si].i
    const gj2 = siblings[gj].i
    ;[next[gi], next[gj2]] = [next[gj2], next[gi]]
    set({ paths: applySchedule(next) })
  },

  updatePathType: (id, type) => {
    get().beginHistory()
    set((s) => ({
      paths: applySchedule(
        s.paths.map((p) => {
          if (p.id !== id) return p
          // reclassifying to a flight: resolve a target from nearby path tips
          const endTokenId =
            p.endTokenId ?? resolveFlightTarget(p.points, p.tokenId, s.paths, type)
          // passes & snaps are strictly straight, whatever was drawn
          const points =
            (type === 'pass' || type === 'snap') && p.points.length > 1
              ? [p.points[0], p.points[p.points.length - 1]]
              : p.points
          return { ...p, type, endTokenId, points, d: catmullRomPath(points) }
        }),
      ),
    }))
  },

  applyScheduleNow: () =>
    set((s) => ({ paths: applySchedule(s.paths) })),

  setPathEndpointLive: (id, which, x, y, anchorTokenId) =>
    set((s) => ({
      paths: s.paths.map((p) => {
        if (p.id !== id) return p
        const points = p.points.slice()
        if (which === 'start') points[0] = { x, y }
        else points[points.length - 1] = { x, y }
        return {
          ...p,
          points,
          tokenId: which === 'start' && anchorTokenId !== undefined ? anchorTokenId : p.tokenId,
          endTokenId:
            which === 'end' && anchorTokenId !== undefined ? anchorTokenId : p.endTokenId,
          d: catmullRomPath(points),
        }
      }),
    })),

  deletePaths: (ids) => {
    if (ids.length === 0) return
    get().beginHistory()
    set((s) => ({
      paths: s.paths.filter((p) => !ids.includes(p.id)),
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
    }))
  },

  addTextNote: (t) => {
    const note: TextNote = { ...t, id: uid() }
    get().beginHistory()
    set((s) => ({ textNotes: [...s.textNotes, note], selectedIds: [note.id] }))
    return note.id
  },

  updateTextNote: (id, text) =>
    set((s) => ({
      textNotes: s.textNotes.map((n) => (n.id === id ? { ...n, text } : n)),
    })),

  moveTextNotesLive: (updates) =>
    set((s) => ({
      textNotes: s.textNotes.map((n) => {
        const u = updates[n.id]
        return u ? { ...n, x: u.x, y: u.y } : n
      }),
    })),

  deleteTextNotes: (ids) => {
    if (ids.length === 0) return
    get().beginHistory()
    set((s) => ({
      textNotes: s.textNotes.filter((n) => !ids.includes(n.id)),
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
    }))
  },

  nudgeSelected: (dx, dy) => {
    const s = get()
    if (s.selectedIds.length === 0) return
    const now = Date.now()
    if (now - lastNudgeAt > 700) s.beginHistory() // one undo per nudge burst
    lastNudgeAt = now
    set((st) => ({
      tokens: st.tokens.map((t) =>
        st.selectedIds.includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t,
      ),
      textNotes: st.textNotes.map((n) =>
        st.selectedIds.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
      ),
    }))
  },

  duplicateSelected: () => {
    const s = get()
    if (s.selectedIds.length === 0) return
    s.beginHistory()
    set((st) => {
      const tokenClones = st.tokens
        .filter((t) => st.selectedIds.includes(t.id))
        .map((t) => ({ ...t, id: uid(), x: t.x + 1.5, y: t.y + 1.5 }))
      const noteClones = st.textNotes
        .filter((n) => st.selectedIds.includes(n.id))
        .map((n) => ({ ...n, id: uid(), x: n.x + 1.5, y: n.y + 1.5 }))
      if (tokenClones.length === 0 && noteClones.length === 0) return {}
      return {
        tokens: [...st.tokens, ...tokenClones],
        textNotes: [...st.textNotes, ...noteClones],
        selectedIds: [...tokenClones.map((c) => c.id), ...noteClones.map((c) => c.id)],
      }
    })
  },

  deleteSelected: () => {
    const { selectedIds, tokens, paths, textNotes } = get()
    const tokenIds = selectedIds.filter((id) => tokens.some((t) => t.id === id))
    const pathIds = selectedIds.filter((id) => paths.some((p) => p.id === id))
    const noteIds = selectedIds.filter((id) => textNotes.some((n) => n.id === id))
    if (tokenIds.length > 0) get().deleteTokens(tokenIds)
    if (pathIds.length > 0) get().deletePaths(pathIds)
    if (noteIds.length > 0) get().deleteTextNotes(noteIds)
  },

  select: (ids) => set({ selectedIds: ids }),

  setBallStart: (ballStartId) =>
    set((s) => ({
      ballStartId,
      playback: { ...s.playback, playing: false, tMs: 0 },
    })),

  loadPlay: (play) =>
    set((s) => {
      // remap seed token ids to fresh ids so path anchors follow
      const idMap = new Map<string, string>()
      const tokens = play.tokens.map((t) => {
        const id = uid()
        idMap.set(t.id, id)
        return { ...t, id }
      })
      const paths = applySchedule(
        play.paths.map((p) => ({
          ...p,
          id: uid(),
          timing: { delayMs: 0, durationMs: 600 },
          // d is derived from points — rebuild it so seeded/loaded plays
          // (scenarios, quickstart) draw instead of rendering empty
          d: catmullRomPath(p.points),
          // old saves may carry stale locks on derived flights — drop them
          userLocked:
            p.userLocked && !['pass', 'handoff', 'toss', 'snap'].includes(p.type)
              ? true
              : undefined,
          tokenId: p.tokenId ? idMap.get(p.tokenId) ?? null : null,
          endTokenId: p.endTokenId ? idMap.get(p.endTokenId) ?? null : null,
        })),
      )
      const textNotes = (play.textNotes ?? []).map((n) => ({ ...n, id: uid() }))
      return {
        playName: play.name,
        losSpec: play.los ?? null,
        fieldTheme: play.fieldTheme ?? s.fieldTheme,
        ruleset: play.ruleset ?? s.ruleset,
        tokens,
        paths,
        textNotes,
        ballStartId: null,
        selectedIds: [],
        past: [],
        future: [],
        playback: { ...s.playback, playing: false, tMs: 0 },
        fitNonce: s.fitNonce + 1,
      }
    }),

  setCamera: (camera) => set({ camera }),

  beginHistory: () =>
    set((s) => ({
      past: [...s.past.slice(-49), snap({ tokens: s.tokens, paths: s.paths, textNotes: s.textNotes })],
      future: [],
      typeBarFor: null,
      // any edit returns the play to rest so the editor always shows true positions
      playback: { ...s.playback, playing: false, tMs: 0 },
    })),

  undo: () => {
    const { past, future, tokens, paths, textNotes, selectedIds } = get()
    if (past.length === 0) return
    const prev = past[past.length - 1]
    set({
      tokens: prev.tokens,
      paths: prev.paths,
      textNotes: prev.textNotes,
      past: past.slice(0, -1),
      future: [snap({ tokens, paths, textNotes }), ...future],
      selectedIds: selectedIds.filter(
        (id) =>
          prev.tokens.some((t) => t.id === id) ||
          prev.paths.some((p) => p.id === id) ||
          prev.textNotes.some((n) => n.id === id),
      ),
    })
  },

  redo: () => {
    const { past, future, tokens, paths, textNotes, selectedIds } = get()
    if (future.length === 0) return
    const next = future[0]
    set({
      tokens: next.tokens,
      paths: next.paths,
      textNotes: next.textNotes,
      past: [...past, snap({ tokens, paths, textNotes })],
      future: future.slice(1),
      selectedIds: selectedIds.filter(
        (id) =>
          next.tokens.some((t) => t.id === id) ||
          next.paths.some((p) => p.id === id) ||
          next.textNotes.some((n) => n.id === id),
      ),
    })
  },
}))
