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
npm test         # vitest run (250 tests, 21 suites)
```

## Directory map

```
src/lib/            pure, dependency-light logic (unit-tested)
  field.ts          field geometry + camera math
  geometry.ts       RDP simplify, Catmull-Rom→bézier, polyline utils
  timing.ts         scheduling engine
  easing.ts         pathEased — pure progress curve + seam flags, no scheduler deps
  actorPosition.ts  renderedPosAt — the ONE 'where is this player at t' answer
  infer.ts          path-type intent inference
  target.ts         flight target resolution (directional cone)
  pathStyles.ts     PathType union, per-type styles, PLAYER_DRIVEN set
  ball.ts           ball ownership / flight state
  formations.ts     quickstart personnel builder
  scenarios.ts      hand-drawn seed plays for the canvas scenario picker
  scenarioBuilders.ts  shared Scenario/seed types + T/P/build helpers
  trackingScenarios.ts  GENERATED real plays from the BDB feed (weeks 2-3)
  positions.ts      palette position metadata
src/stores/editorStore.ts   single zustand store (state + all actions)
src/components/
  canvas/           FieldCanvas (interaction hub), Field, TokenView, PathView, BallView, ScenarioPicker
  shell/            TopBar, LeftRail, TokenPalette, CanvasStage, InspectorPanel, BottomDock, QuickStartModal
  ui/               icons, IconButton, TypeSample
src/hooks/useShortcuts.ts   global keyboard shortcuts
tests/              vitest suites — see "Test suites" below
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

`reschedule(paths)` returns a `Map<id, Timing>` and runs 3 iterations of this order (measured: it is already settled after the first, and movement timings are bit-identical either way — the loop is defensive, not load-bearing):

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

**Seams are speed-continuous.** Two of one player's chained movements meeting used to both sit at zero velocity, so he came to a **dead stop** wherever he changed movement — worst at the moment he received the ball (3.2% of plateau speed for 48ms, under half speed for 240ms). `pathEased` takes `easeIn`/`easeOut` flags; `progressAt` in `actorPosition.ts` lifts the ramp only where a movement actually *touches* a neighbour, never across a real gap. Token position and the stroke reveal must both come from `progressAt`, or the player outruns the tip of his own line by 0.6yd. `tests/chainSpeed.test.ts` polices this, including that the last movement of a chain still decelerates — the one case where `rampIn` is 0 and any divide by it yields Infinity and freezes him.

## Drawing & rendering pipeline

- Freehand capture (distance-thinned 3px) → RDP simplify (ε 2.5px screen) → Catmull-Rom → bézier `d`
- **Magnetic chaining**: new player-driven segment start snaps to that player's chain tip; end snaps to the chain root (both within 2yd) — enables out-and-back motion
- **Flight canonicalization**: pass/snap are STRICTLY straight lines (both at draw and on reclassify in `updatePathType`); handoff/toss may keep a capped loft (≤2yd)
- Endpoint snap radius is `min(28px / zoom, 2.0)` (zoom-independent, H8)
- Rendering is SVG: a single transform group `translate(zoom) scale`; all strokes in field units

**Flight two-anchor warp** (in `FieldCanvas`): pass/handoff/toss arcs have their start pinned to the thrower's release point and end pinned to the target's arrival point, both evaluated at their **fixed instants** (release / arrival time — NOT live-tracking `min(tMs, …)`). Flights are invisible until launched, then self-draw with the ball. Blocks re-trim their end to the defender's rim each frame.

Both anchors and the token loop go through **`renderedPosAt`** (`lib/actorPosition.ts`) — there is exactly one implementation. It was two, and they disagreed: the ball was aimed using a movement the player wasn't drawn on, and it ignored the translation that closes a seam between movements (0.47yd and 0.20yd errors). A thrower or receiver with no animated movement falls back to the token's rest position, so a flight can no longer be left pointing at empty grass (the Dive scenario's handoff used to release 6.3yd behind the QB). Because both sides share the function they agree by construction, so `tests/actorPosition.test.ts` is what polices it — the flight-exchange suite cannot detect the shared function being wrong. Six mutations of these rules are each caught by at least one test.

## Ball model (`lib/ball.ts`)

`defaultBallStart(paths, tokens)`: explicit pick > **snap origin** > **handoff origin** > **C** > QB > first offensive player.

`ballStateAt(...)`: flights are **unconditional chronological events** (H4) — every flight flies in its own window (double-read plays work). While airborne, the most-recently-launched flight containing `tMs` owns the ball; possession transfers to a flight's `endTokenId` when it completes.

## UX grammar (sticky pen)

- `D` arms a **sticky pen** (draws many routes, never auto-disarms); finishing a stroke auto-selects it and the type is then set in the path inspector. The old floating type bar at the stroke tip is gone
- Clicks select in every tool; `⌘/Ctrl+drag` moves players while pen is armed; Delete/Backspace deletes the selection
- Pan: `H` tool, wheel scroll, middle-drag. Zoom: `⌘+wheel`. Fit: `F`
- A selected path's type is set by digit keys `1`..`8`, indexing `PATH_TYPE_CHOICES` in order (`route, drop, run, motion, block, pass, handoff, toss`). `snap` is deliberately NOT in that list — it is derived, never hand-picked
- Full shortcut list lives in `InspectorPanel.tsx` (and `useShortcuts.ts`)

## Real tracking plays

`src/lib/trackingScenarios.ts` is **generated** — four plays lifted from `bdbtrackingdata/` (BDB weeks 2-3), one per shape worth checking. Every coordinate is a real 10Hz tracked position and every timing is the real frame time, seeded `userLocked`, so the app replays the play as it happened rather than re-deriving it. The hand-drawn scenarios show what the app thinks a play looks like; these show whether it agrees with reality. Each has a catch followed by a run lane, so they are also the regression corpus for the chain-speed fix.

Regenerate with `tools/extractTrackingScenarios.mjs` (CSV → JSON) then `tools/emitTrackingScenarios.mjs` (JSON → TS). Three things about those CSVs are counter-intuitive and are documented in the tool header: the axes are transposed relative to week 1 (x is length), the ball's `team` column is the literal string `football` so it cannot identify the offense, and the attacking axis must come from the two teams' centroids at the snap rather than the throw vector — on a jet sweep the throw points sideways and using it rotates the field 90°.

## Conventions & gotchas

- `verbatimModuleSyntax` + `noUnusedLocals` + `erasableSyntaxOnly` are ON — use `import type`, no enums, no unused imports
- No code comments unless asked (this project's user instruction)
- oxlint `react/rules-of-hooks` enforced
- When editing `timing.ts` `reschedule`, preserve the phase order and the `assign()` helper that guards locked paths — scheduling regressions are the most common breakage
- `addPath`/`loadPlay` generate fresh `uid()`s and `loadPlay` must **remap seed token ids** so path anchors survive
- **Flight timings are userLocked like everything else.** They used to be exempt, which made a hand-set flight duration in BottomDock revert on the next schedule and made real ball timing unreplayable. Do not re-exempt them.
- Movement strokes must be drawn on `boundPoints` (seam-closed), the same geometry the token renders on — raw points leave a 0.92yd break where a movement was authored off its predecessor
- Test conventions: pure lib logic → vitest in `tests/`; component/interaction → manual via the scenario picker (top-left of canvas)
- Color/design tokens are defined in `src/index.css` under `@theme` (`chrome-*`, `accent-*`, `offense/defense/ball`, `field-*`, `chalk`); fonts are `Archivo` (sans) + `Oswald` (display)

## Persistence (M6)

- `lib/playbook.ts` — IndexedDB repo (`drawaplay`/`plays`), in-memory fallback when IDB is unavailable; soft-delete (`deletedAt`) + trash listing; pure helpers (`matchesQuery`, `newRecord`, `touchName`)
- `hooks/usePersistence.ts` — restores the most recent play on mount, then debounce-saves (650ms) whenever tokens/paths/name/ballStart change; drives TopBar save-state dot
- Play identity: store `playId`; template loads (scenario picker / quickstart / library "New play") call `resetPlayIdentity()` so each becomes its own record
- Library home = `shell/PlaybookModal.tsx`: cards with live SVG thumbnails (`lib/thumb.ts`), search, open, duplicate, double-click rename, trash w/ restore & purge

## Ball exchange — what this work was, and what it changed

The goal was a ball exchange that lands where a receiver actually is. It is worth recording how it went, because the first three attempts were wrong in ways that only executing them revealed.

**A plan that sounded right and was not.** The proposal was to derive flight duration from `catchMoment` — sample the receiver's rendered position, find the moment he is nearest the drawn flight line, and set `duration = catchTime - release`. Built in a sandbox and measured, it made the game worse: a 5.4yd toss became a 1056ms lob (5.2 yd/s, slower than a running back), and a 57yd touchdown landed 13.4yd short because `FLIGHT_MAX_MS` truncated the flight. Two coupled errors. `duration = catchTime - release` forces release to be `ready`, deleting the deliberate **late launch** (`launchAt = targetEnd - dur`) that lets a ball leave as late as possible before the break. And scoring on *proximity to the aim point* optimises for "when does he happen to pass nearest where I stopped dragging", which on a sweep is his flat break, not his hands. Grid resolution was a red herring (≤56ms spread); the **scoring** was first-order (up to 1348ms). Abandoned — the existing model is already coherent.

**What that work actually found.** `catchMoment` is unused dead code and the "arrival pinned to the receiver" rule is sound; the visible defects were elsewhere. Two implementations of "where is this player at t" disagreed (now one, `renderedPosAt`), a thrower/receiver with no movement was never warped onto the token (now falls back to rest position), movement strokes were drawn on different geometry than the token (now both use `boundPoints`), and every movement seam was a **dead stop** (now speed-continuous). It also turned out **no test would have caught the ball missing the receiver at all** — every ball-vs-receiver assertion sat *after* arrival, where the offset is a constant 0.6495yd by construction. That gap is now closed by a paired arrival/release invariant.

**Method note.** Three reviews were run against this work, and each time the reviewer was instructed to *execute* rather than reason. That is the only reason the failures were found: two of my own plans were materially wrong and reading them a third time would not have shown it. The same discipline applies to the tests — every behavioural claim is mutation-checked, because roughly a third of the tests written in that state passed for the wrong reason (tautological fixtures, `Infinity` from a divide-by-zero, an equivalent mutant mistaken for a missing assertion).

## Test suites

```
actorPosition    the shared position function: seam closure, tie-break, selection
ball             ownership, default ball start, flight windows
catchPoint       the unused catchMoment helper (scoring + collinear geometry)
chainSpeed       seams are speed-continuous; token stays on its own stroke tip
defenseFormations  fronts, shells, standoff
flightExchange   the safety net — every visible flight lands on its own receiver
loadPlay         id remapping on template load
persistence      IndexedDB playbook helpers
playerPaths      setPlayerRoute / addBlock
positions        posLabel / coercePos recovery
possession       possession transfer timing
render           computeScene, view fitting
routeTemplates   route library
ruleset          offense/defense rules
scheduling       reschedule phases and timing rules
shortcuts        digit → path type
targeting        resolveFlightTarget
textNotes        canvas annotations
theme            field theme tokens
formations       quickstart personnel
export           svg/png export
```

## Status

Hardening (HA–HE), M6 persistence/playbook and defense formations are complete — 250 vitest tests across 21 suites. The ball exchange was reworked against real tracking data (see above). Next up: M8 exports/sharing.

Known-unfixed, deliberately left: the ball's angle while carried is hardcoded to `-35°` and its offset from the holder is fixed in field space, so on a sharp cut the ball slides around the runner (45° off his heading on the Toss sweep). The fix is to rotate both by the holder's heading, which is not recorded anywhere yet — there is no single answer for "which way is this player facing".
