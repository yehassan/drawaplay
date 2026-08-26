# DrawAPLAY — Product & Engineering Spec

A web app where a coach/player **roughly sketches** an American football play (drops player tokens, scribbles routes) and the app renders it back as a **smooth, polished, animated play diagram**. Low-effort input in, broadcast-quality output out.

---

## 1. Vision & Principles

**The one-liner:** Excalidraw-level effort in, NFL broadcast graphics out.

Principles that drive every decision:

1. **Rough is fine.** The user never has to be precise. Snapping, smoothing, and inference are the product's job.
2. **Instant feedback.** Every stroke becomes a clean curve immediately. Playback is one keystroke away (`Space`).
3. **The animation is the deliverable.** Static diagrams are a byproduct. Timing, easing, and ball travel are first-class data, not afterthoughts.
4. **Built for the hundredth play, not the first.** Reuse (formations, templates, duplication, tagging) is core UX, not a settings tab.
5. **Local-first.** Everything works offline against local storage. Cloud sync/sharing layers on top later without changing the core.

---

## 2. Users & Jobs

Primary user: a football coach (youth → high school → semi-pro) or player building a playbook.

Jobs to be done:
- "Show my team what the play looks like when executed."
- "I sketched this on a whiteboard/napkin — recreate it in 60 seconds."
- "Find that play we ran against them last season."
- "Send this play to my QB." (export/share)

---

## 3. Core Loop (the UX)

```
New Play → Pick formation (or blank) → Drop/move players
        → Scribble routes → Auto-smoothed into styled paths
        → Tag path types (route/block/pass/handoff/motion)
        → Set timing (or accept smart defaults)
        → Space = watch it animate beautifully
        → Name/tag/save → lands in Playbook library
```

Target: **under 90 seconds** from blank field to saved, animated play.

---

## 4. Feature Spec

### 4.1 Editor Canvas & Field
- Accurate field: 120yd × 53.3yd (end zones included), yard lines every 5yd, numbers, hash marks (NFL spacing), end zones with team-color fill.
- Orientation toggle: **vertical** (default, end zones top/bottom) / horizontal.
- **Play-area viewport (default):** show only the slice of field the play needs (~40yd × full width), never the whole 120yd field — maximizes how large the field renders on screen.
- **Fit to play is the primary framing behavior:** the viewport derives from token/path extents + padding (clamped by min/max zoom). Fixed yardage applies only to an empty canvas; presets below are shortcuts, not the source of truth.
- View presets: Play area (default) · Red zone (adds goal line + end zone) · Half field · Full field.
- Zoom (wheel/pinch) + pan (space-drag or two-finger).
- Light snap grid (~1yd) with soft magnetic snapping for tokens and path endpoints; alignment guides when tokens share x/y.
- Field theme presets: grass, turf, chalk (minimal/light).

### 4.2 Player Tokens
- Token = circle with jersey number, position-colored ring, subtle drop shadow. Offense vs defense get distinct palettes (e.g., blue vs red families), fully recolorable per play.
- Position presets with default labels/colors: `QB, RB, FB, WR, TE, C, G, T` (OL group), defense: `DL, LB, CB, S`.
- Interactions: drag from palette to place · drag to move (snapped) · double-click to edit number/label · alt-drag to duplicate · delete key to remove.
- Optional extras: coaching "X's and O's" classic mode toggle (plain X/O glyphs).

### 4.3 Drawing & Stroke Processing (the rough→slick pipeline)
This is the heart of the app:

1. Capture raw pointer samples (throttled by distance, not time).
2. **Simplify:** Ramer–Douglas–Peucker (ε ≈ 2–4px).
3. **Smooth:** fit Catmull-Rom through remaining points → convert to cubic béziers. No visible wobble ever ships.
4. **Anchor origin (required):** every path originates at a player — a stroke must begin on/near a token or it is discarded with a hint ("Start routes on a player"). Endpoints snap to a player when close (~24px); otherwise they end in open field, which is legitimate for routes (blocks/passes typically end on a player anyway). Anchored paths follow their player both when repositioned in the editor and during playback.
5. **Infer intent (v1 heuristics):**
   - Straight-ish short stroke near two tokens → suggest *block* (T-stub).
   - Long forward stroke ending deep → *route*.
   - Arc between two distant tokens → *pass*.
   - User can always override via inspector; inference just sets defaults.
6. Live preview: while drawing, show the smoothed curve under the pen trail so the user sees the "slickening" happen in real time.

### 4.4 Path Types & Styles
| Type | Default look | Notes |
|---|---|---|
| Route | Solid, arrowhead | The workhorse |
| Block | Short stub ending in a perpendicular T-bar at the contact point (far end) | Anchored at blocker, bar at defender |
| Pass | Dashed arc | Ball flies this arc during playback |
| Handoff / Pitch | Curved arrow w/ ball icon | Ball transfers ownership |
| Motion | Thin dotted line | Pre-snap movement |
| Run lane | Thick translucent band | QB/RB carry path |

Per-path overrides: color, dash pattern, arrowheads, line weight. All styled via a shared design-token system so everything looks coherent automatically.

### 4.5 Animation Engine
- **Timeline model:** global play duration (default ~4s). Each path has `delay` + `duration` + `easing`; defaults are auto-derived (e.g., routes staggered by depth so everyone arrives "on time"; motion paths finish pre-snap).
- Playback: players translate along their anchored paths with cubic ease-in-out; route strokes draw themselves in sync (stroke-dashoffset); ball follows its carrier, arcs on passes, transfers on handoffs.
- Controls: play/pause (`Space`), scrub bar, step-forward/back frame-by-frame, loop toggle, speed (0.5×/1×/2×).
- Implementation: single rAF clock driving declarative state (t ∈ [0,1]) → pure render. No CSS-transition spaghetti; scrubbing must be perfect because t is the source of truth.
- 60fps target with ~11 offensive + 11 defensive tokens and ~15 paths.

### 4.6 Panels & Layout
- **Left rail:** tools (select, draw, erase, pan, text annotation) + token palette (collapsible offense/defense groups).
- **Right inspector:** context-sensitive — token props (number, label, color, size) or path props (type, style, timing: delay/duration/easing sliders with live mini-preview).
- **Bottom timeline:** scrubber + per-path timing chips (draggable to change delay/duration visually).
- **Top bar:** play name (inline edit), autosave indicator, undo/redo, orientation/theme toggles, Export menu, "Playbook" breadcrumb back to library.

### 4.7 Editing Ergonomics
- Full undo/redo (command stack, coalesced stroke events) — `⌘Z` / `⇧⌘Z`.
- Keyboard: `V` select, `D` draw, `E` erase, `Space` play, `⌘D` duplicate selection, arrows nudge, `Esc` deselect.
- Multi-select (marquee + shift-click); group-move keeps relative positions.
- Delete path ≠ delete player; deleting a player deletes its anchored paths (with confirm-on-multi).

### 4.8 Text & Annotations
- Free text labels on field (e.g., "vs Cover 2"), small note pin per play (coach's notes in sidebar).

---

## 5. Repeated Use — Playbook Management

The second session must be faster than the first.

### 5.1 Library (home screen)
- Grid of **play cards**: live-rendered thumbnail (mid-animation frame or static final frame), name, tags, formation badge, updated-at.
- Search by name; filter by tag, side (off/def), formation, personnel.
- Sort: recent, alphabetical, manual (drag to reorder).
- Card actions: open, duplicate, rename, tag, delete (soft-delete w/ trash).

### 5.2 Organization
- **Folders/collections** (e.g., "Red Zone", "3rd Down", "Week 5 gameplan") — a play can live in one folder + have many tags.
- Tags are freeform with autocomplete from existing tags.

### 5.3 Reuse Machinery
- **Formation picker** at play creation: blank, I-Form, Shotgun, Pistol, Trips, Bunch, Empty, Goal-line, plus any formation the user saved from an existing play ("save as formation").
- **Duplicate play** — the #1 reuse action; duplicated plays open immediately in editor.
- **Personnel quick-set:** "11 personnel" auto-populates skill positions.
- Defensive counterpart mode: overlay a defensive look on the same play card (phase 2 idea, noted for later).

### 5.4 Durability
- **Autosave** on every mutation (debounced ~500ms) to IndexedDB; explicit "Saved ✓" indicator.
- Lightweight **version history**: snapshot on open + every N minutes; restore from a list (last 20).
- **Export/Import** whole playbook as a single JSON file (backup + device transfer).
- Per-play exports: PNG (static), GIF/WebM (animated), and a shareable read-only URL (post-v1, needs a thin backend).

---

## 6. Data Model

```ts
type Play = {
  id: string
  name: string
  folderId?: string
  tags: string[]
  side: 'offense' | 'defense'
  field: { orientation: 'h'|'v'; crop: 'full'|'half'; theme: string }
  tokens: Token[]
  paths: Path[]
  ball: { carrierId: TokenId | null }        // resolved during playback
  timeline: { durationMs: number; loop: boolean }
  notes?: string
  createdAt: number; updatedAt: number
}

type Token = {
  id: string
  kind: 'offense' | 'defense'
  pos: 'QB'|'RB'|'FB'|'WR'|'TE'|'C'|'G'|'T'|'DL'|'LB'|'CB'|'S'
  num: string            // jersey number / label
  x: number; y: number   // field coords, yards (floats)
  color?: string         // override
}

type Path = {
  id: string
  tokenId: TokenId       // anchor (null = free-floating, e.g., pass arc)
  type: 'route'|'block'|'pass'|'handoff'|'motion'|'run'
  beziers: [pt, pt, pt, pt][]   // post-smoothing geometry, field coords
  style: { color?: string; dashed?: boolean; width?: number }
  timing: { delayMs: number; durationMs: number; easing: 'inOut'|'out'|'linear' }
}
```

Storage: IndexedDB via a thin repository layer (`playsRepo`) so the backend can swap in later. Schema versioned from day one.

Derived/cached: thumbnail (rendered offscreen at save time), search index (name+tags lowercased).

---

## 7. Tech Stack & Architecture

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React + TypeScript** | Fast SPA, no SSR needs |
| State | **Zustand** + immer patches (for undo) | Small, command-stack-friendly |
| Rendering | **SVG** (field + tokens + paths) driven by rAF clock | Crisp at any zoom, easy hit-testing, dashoffset trick for self-drawing strokes; Canvas only if perf demands later |
| Geometry | Custom RDP + Catmull-Rom→bézier (~150 LOC, no dep) | Tiny, testable |
| Persistence | **IndexedDB** (idb wrapper) | Local-first |
| Styling | Tailwind + design tokens | Speed + coherence |
| Tests | Vitest (geometry, timeline math, repo) + Playwright smoke (core loop e2e) | The smoothing/timing math is the crown jewels — unit-test it hard |

Architecture rule: **editor state is serializable data, always.** Rendering is a pure function of `(play, t)`. This single rule buys us undo, scrubbing, thumbnails, export, and future sync almost for free.

---

## 8. Visual Design Language

- Dark, broadcast-style UI chrome (near-black slate) so the green field pops; light "chalkboard" theme available.
- One accent color drives UI; play colors are semantic (offense/defense/ball) and user-tunable.
- Tokens: flat circles, 2px ring, soft shadow, bold condensed numerals (sports-jersey feel — e.g., Archivo/Oswald family).
- Paths: rounded caps/joins everywhere; arrowheads as markers; nothing thinner than 2px at default zoom.
- Micro-interactions: tokens settle with a tiny scale-bounce on placement; paths "ink in" when drawn; play button pulses subtly when unsaved changes exist.

---

## 9. Milestones

Each milestone ends demoable. Acceptance criteria are the definition of done.

### M0 — Scaffold & Foundations (½ wk)
Vite+React+TS+Tailwind+Zustand wired; design tokens; app shell (top bar, left rail, right inspector, bottom dock placeholders); CI-less lint/typecheck scripts.
✅ Empty editor shell renders, hot reload works, tokens defined.

### M1 — Field & Token Placement (1 wk)
Accurate field renderer (all markings), zoom/pan, token palette, drag-place/move/select/delete, snapping + alignment guides, undo/redo for token ops.
✅ Can lay down a full 11-person offense in <30s; undo works flawlessly.

### M2 — Draw & Smooth (1 wk) ⭐ core risk retired here
Freehand capture → RDP → Catmull-Rom → bézier pipeline; live smoothed preview while drawing; endpoint snapping to tokens; erase tool.
✅ A sloppy mouse scribble becomes a clean curve instantly; feels good with trackpad and mouse.

### M3 — Path Semantics (¾ wk)
Path types with default styles + arrowheads/markers; inspector editing (type/style); intent inference v1 (block/route/pass suggestions); anchored paths follow moved tokens.
✅ Draw a full passing concept (5 routes + block + pass arc) and it reads clearly at a glance.

### M4 — Animation Engine (1 wk) ⭐ the wow moment
Timeline model, rAF clock, per-path delay/duration/easing with smart defaults, self-drawing strokes, scrubber + play/pause/loop/speed, bottom timeline chips.
✅ Press space on a smokescreen-simple slant-flat play and it looks genuinely slick; scrubbing is frame-perfect.

### M5 — Ball & Polish (¾ wk)
Ball entity (carrier tracking, pass arcs with flight + shadow, handoff transfer), placement micro-interactions, empty-state art, sound-off-by-default polish pass.
✅ A run play (handoff → run lane) animates correctly end-to-end.

### M6 — Persistence & Playbook Library (1 wk)
IndexedDB repo + autosave; library home with cards/thumbnails/search/filter/tags/folders; duplicate/rename/delete/trash.
✅ Close browser mid-edit, reopen, nothing lost; can build and navigate a 10-play playbook comfortably.

### M7 — Reuse Workflows (¾ wk)
Formation picker incl. save-as-formation; personnel quick-set; template plays; import/export playbook JSON.
✅ Second similar play takes <30s starting from a formation + duplicate.

### M8 — Export & Share (¾ wk)
PNG export (static, hi-res); WebM/GIF recording of playback (MediaRecorder / frame-baked); share-link read-only viewer behind a minimal backend (defer if backend is out of scope for v1 — PNG/video still stand alone).
✅ Coach can drop an animated play into a group chat.

### M9 — Hardening & Delight (1 wk)
Full keyboard map, a11y pass (focus order, contrast), perf budget check (60fps @ 22 tokens/15 paths), error boundaries, onboarding hint overlay on first run, seed content (3 example plays).
✅ Feels like a product, not a prototype. Core-loop e2e test green.

**Total: ~8 weeks** solo, sequenced so the riskiest unknowns (smoothing quality, animation feel) land in M2/M4, early enough to pivot.

---

## 10. Non-Goals (v1)

Real-time multiplayer collaboration · native mobile apps · opponent-scouting/AI features · printable playbook PDFs (trivial later from PNG export) · defensive-overlay mode (parked) · cloud accounts (local-first until proven).

## 11. Open Questions (decide by M4)

1. Smart-default timing: derive purely from path length, or weight by "football logic" (snap → drop → break)? Start with length + type weights, tune by feel.
2. Should defense animate too in v1, or render static? (Lean: static-with-motion-toggle.)
3. GIF vs WebM priority for chat-share (WebM smaller; GIF universal) — ship WebM first, GIF if cheap via ffmpeg.wasm.
