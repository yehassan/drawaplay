# AGENTS.md

Guidance for AI agents (and future maintainers) working on **DrawAPLAY** — a web app for roughly sketching American football plays and rendering them as smooth, realistically-sequenced animations.

## Project overview

The core loop: a coach picks a formation (quickstart modal), drops player tokens, scribbles routes with a "sticky pen", and the app turns that rough input into broadcast-quality animated playback. The product thesis (from `SPEC.md`): *editor state is always serializable data; rendering is a pure function of `(play, time)`* — that one rule buys undo, scrubbing, thumbnails, export, and future sync for free.

`SPEC.md` is the product/engineering spec (milestones M0–M9). `HARDENING.md` is the polish plan (phases HA–HE) — **complete**. This file is the living implementation reference.

## Stack

- **Vite 8 · React 19 · TypeScript 6 · Tailwind v4** (CSS-first `@theme` tokens in `src/index.css`)
- **Zustand** (single store, `src/stores/editorStore.ts`)
- **Vitest** for tests, **oxlint** for linting
- No router, no backend — local-first, IndexedDB persistence is the next milestone (M6)

## Commands

```sh
npm run dev      # vite dev server
npm run build    # tsc -b && vite build (typecheck + build)
npm run lint     # oxlint
npm test         # vitest run (29 tests, 4 suites)
```

## Directory map

```
src/lib/            pure, dependency-light logic (unit-tested)
  field.ts          field geometry + camera math
  geometry.ts       RDP simplify, Catmull-Rom→bézier, polyline utils
  timing.ts         scheduling engine + easing
  infer.ts          path-type intent inference
  target.ts         flight target resolution (directional cone)
  pathStyles.ts     PathType union, per-type styles, PLAYER_DRIVEN set
  ball.ts           ball ownership / flight state
  formations.ts     quickstart personnel builder
  scenarios.ts      seed plays for the canvas scenario picker
  positions.ts      palette position metadata
src/stores/editorStore.ts   single zustand store (state + all actions)
src/components/
  canvas/           FieldCanvas (interaction hub), Field, TokenView, PathView, BallView, ScenarioPicker
  shell/            TopBar, LeftRail, TokenPalette, CanvasStage, InspectorPanel, BottomDock, QuickStartModal
  ui/               icons, IconButton, TypeSample
src/hooks/useShortcuts.ts   global keyboard shortcuts
tests/              vitest suites (scheduling, ball, targeting, formations)
```

## Coordinate system (critical)

All positions are **field yards**, stored as floats. Vertical orientation:
- `x ∈ [0, 53.3]` (field width), `y ∈ [0, 120]` (length)
- **Offense attacks upward** (decreasing `y`). Own goal line = `y = 110`, opponent's = `y = 10`
- Screen transform: `screen = field * zoom + t` (`Camera { zoom, tx, ty }` in `field.ts`)
- Hash marks: left `23.583`, center `26.65`, right `29.75` (`HASH_X` in both `field.ts` and `formations.ts`)
- Yard line → y: `losY('ours', n) = 110 - n`, `losY('theirs', n) = 10 + n`
- Token body radius is `0.69yd`; keep centers ≥ ~1.5yd apart when placing

## Data model (editorStore)

```ts
Token     { id, side: 'offense'|'defense', pos: PosId, num: string, x, y }
PlayPath  { id, tokenId, endTokenId, type: PathType, points: Pt[], d: string, timing: Timing, userLocked? }
Camera    { zoom, tx, ty }
Playback  { playing, tMs, speed: 0.5|1|2, loop }
Timing    { delayMs, durationMs }
PathType  'route' | 'drop' | 'block' | 'pass' | 'handoff' | 'toss' | 'snap' | 'motion' | 'run'
```

Key store state: `tokens`, `paths`, `ballStartId` (explicit ball holder, null = auto), `selectedIds` (ids of both tokens and paths), `camera`, `playback`, `past`/`future` (snapshot undo stack of `{tokens, paths}`), `typeBarFor`, `fitNonce`, `quickStartOpen`.

Key actions: `addPath` (returns new id, auto-selects), `moveTokensLive` (no history — caller does `beginHistory`), `setPathEndpointLive`, `setPathTimingLive` (sets `userLocked`), `reorderPath`, `loadPlay` (remaps ids, reschedules, bumps `fitNonce`), `beginHistory` (also pauses/resets playback), `undo`/`redo`.

**Undo convention**: mutations that begin a user gesture call `beginHistory()` ONCE at gesture start (coalesced), then mutate via the `*Live` actions without touching history. `addPath`/`addToken`/`delete*`/`updatePathType` push history internally.

## The scheduling engine (`lib/timing.ts`)

`reschedule(paths)` returns a `Map<id, Timing>` and runs 3 iterations of this order:

1. **motion** — pre-snap, chained among itself by draw order, ALWAYS before the snap regardless of when drawn
2. **snap** — fires after motion completes
3. **everyone else** — starts when the snap completes
4. **per-player chain** — a player's own player-driven paths sequence in draw order (skips motion)
5. **flights** (pass/handoff/toss) — chain off thrower readiness (`RELEASE_HITCH_MS = 550` for stationary throwers, or their own drop/rollout end) and their target's route:
   - **arrival is pinned to the connected route's end** (motion never counts as a receiving window)
   - **pass duration ≈ 40% of the connected route's duration** (clamped `MIN_DURATION_MS`..`FLIGHT_MAX_MS`)
   - if the thrower isn't ready in time, hold release and compress the flight (arrival still lands on the break)
6. **possession** — a receiver's later-drawn paths (run/route/drop) wait for their handoff/snap to complete

`userLocked` paths are preserved verbatim and treated as fixed constraints. `timelineDuration` floor is `1500ms`.

Speeds (`naturalDuration`): `ROUTE 6`, `DROP 2.4`, `RUN 5.5`, `BALL 14` yd/s.

**Easing** (`pathEased`) is a **trapezoid velocity profile with an absolute 220ms ramp** — NOT per-path normalized cubic. This keeps perceived acceleration identical across short and long routes. Do not regress this to `easeInOutCubic`.

## Drawing & rendering pipeline

- Freehand capture (distance-thinned 3px) → RDP simplify (ε 2.5px screen) → Catmull-Rom → bézier `d`
- **Magnetic chaining**: new player-driven segment start snaps to that player's chain tip; end snaps to the chain root (both within 2yd) — enables out-and-back motion
- **Flight canonicalization**: pass/snap are STRICTLY straight lines (both at draw and on reclassify in `updatePathType`); handoff/toss may keep a capped loft (≤2yd)
- Endpoint snap radius is `min(28px / zoom, 2.0)` (zoom-independent, H8)
- Rendering is SVG: a single transform group `translate(zoom) scale`; all strokes in field units

**Flight two-anchor warp** (in `FieldCanvas`): pass/handoff/toss arcs have their start pinned to the thrower's release point and end pinned to the target's arrival point, both evaluated at their **fixed instants** (release / arrival time — NOT live-tracking `min(tMs, …)`). Flights are invisible until launched, then self-draw with the ball. Blocks re-trim their end to the defender's rim each frame.

## Ball model (`lib/ball.ts`)

`defaultBallStart(paths, tokens)`: explicit pick > **snap origin** > **handoff origin** > **C** > QB > first offensive player.

`ballStateAt(...)`: flights are **unconditional chronological events** (H4) — every flight flies in its own window (double-read plays work). While airborne, the most-recently-launched flight containing `tMs` owns the ball; possession transfers to a flight's `endTokenId` when it completes.

## UX grammar (sticky pen)

- `D` arms a **sticky pen** (draws many routes, never auto-disarms); finishing a stroke auto-selects it and pops the **one-shot type bar** (R/B/P/H/Toss/Snap/Motion/Drop minis) at the path tip
- Clicks select in every tool; `⌘/Ctrl+drag` moves players while pen is armed; Delete/Backspace deletes the selection
- Pan: `H` tool, wheel scroll, middle-drag. Zoom: `⌘+wheel`. Fit: `F`
- Full shortcut list lives in `InspectorPanel.tsx` (and `useShortcuts.ts`)

## Conventions & gotchas

- `verbatimModuleSyntax` + `noUnusedLocals` + `erasableSyntaxOnly` are ON — use `import type`, no enums, no unused imports
- No code comments unless asked (this project's user instruction)
- oxlint `react/rules-of-hooks` enforced
- When editing `timing.ts` `reschedule`, preserve the phase order and the `assign()` helper that guards locked paths — scheduling regressions are the most common breakage
- `addPath`/`loadPlay` generate fresh `uid()`s and `loadPlay` must **remap seed token ids** so path anchors survive
- Test conventions: pure lib logic → vitest in `tests/`; component/interaction → manual via the scenario picker (top-left of canvas)
- Color/design tokens are defined in `src/index.css` under `@theme` (`chrome-*`, `accent-*`, `offense/defense/ball`, `field-*`, `chalk`); fonts are `Archivo` (sans) + `Oswald` (display)

## Persistence (M6)

- `lib/playbook.ts` — IndexedDB repo (`drawaplay`/`plays`), in-memory fallback when IDB is unavailable; soft-delete (`deletedAt`) + trash listing; pure helpers (`matchesQuery`, `newRecord`, `touchName`)
- `hooks/usePersistence.ts` — restores the most recent play on mount, then debounce-saves (650ms) whenever tokens/paths/name/ballStart change; drives TopBar save-state dot
- Play identity: store `playId`; template loads (scenario picker / quickstart / library "New play") call `resetPlayIdentity()` so each becomes its own record
- Library home = `shell/PlaybookModal.tsx`: cards with live SVG thumbnails (`lib/thumb.ts`), search, open, duplicate, double-click rename, trash w/ restore & purge

## Status

Hardening (HA–HE) + M6 persistence/playbook are complete — 39 vitest tests across 5 suites. Next up: defense formations, then M8 exports/sharing.
