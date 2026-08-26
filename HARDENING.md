# DrawAPLAY — Hardening Plan (pre-M6)

**Objective this plan serves:** *"Enable the user to robustly draw plays and have them animated in realistic sequencing."* Every item below is judged against that sentence: does drawing survive messy real-world input, and does playback read like real football?

Status legend: **[DECIDED]** committing to this · **[PROPOSED]** needs your sign-off · **[Q]** question for you.

---

## Part 1 — Confirmed defects & UX gaps (from your testing)

### H1 · Run lanes must bind to where the player *will be*, not where he stands **[DECIDED]**
You flagged: run lane requires origination on the RB's body, but the run happens post-handoff, elsewhere.

Root problem: strokes are drawn in *present space* but represent *future positions*. We already solved this for flights (two-anchor warp); player-driven chains need the same treatment.

**Fix — "runtime start-binding":**
- When playback activates a player-driven path whose start point ≠ wherever the chain has actually taken the player, translate the whole segment so its start = the player's current position at activation (same linear-warp math as flights; shape preserved).
- While drawing, magnetically snap a new stroke's start to the previous sibling's tip when within 2yd (visual continuity cue), but the runtime binding makes precision unnecessary.
- Consequence: origination-on-a-player stays required (it identifies WHO runs), but WHERE you start drawing no longer matters. This also fixes "run lane drawn from RB's pre-snap spot."

### H2 · QB movement too slow/fast tuning **[DECIDED]**
Drop speed drops from 3.5 → **2.4 yd/s** (deliberate cadence). All speeds become named constants in one place (`timing.ts`) so tuning is one-line:
`ROUTE 6 · DROP 2.4 · BALL 14 · RUN 5.5 (new, slightly slower than routes)`.

### H3 · Flights get canonical geometry **[DECIDED: straight + capped loft]**
Pass/handoff/snap arcs currently inherit scribble curvature and wobble.
- At finalize, flights discard intermediate points and store a **clean curve**: straight line by default (`smooth straight lines` per your note), with optional single control point derived from drawn deviation — capped at 2yd perpendicular — so a lofted corner or toss arc is expressible but never wobbly.
- The two-anchor warp then operates on a 2–3 point bézier: always smooth, cheap.

### H4 · Ball ownership model breaks on multi-read plays **[DECIDED — latent bug]**
Today flights only fly if `f.tokenId === currentOwner`, walked chronologically. A QB with two passes (screen + post) silently kills the second flight once the first transfers possession.
**Fix:** ownership becomes an unconditional chronological event list — every flight flies in its window regardless of prior transfers; possession after each flight = its `endTokenId`. Ball position during overlapping windows = latest-launched flight. Simpler code, matches user intent, enables double-move concepts.

### H5 · Tool grammar unification — kill mode switching **[DECIDED]**
Your friction: draw → click route to retype → forced back to Select. Re-ideated grammar:

| Gesture | Behavior (in BOTH select & pen modes) |
|---|---|
| Drag on empty ≥4px | Pen armed? draw · else marquee |
| Click (<4px) | Smart-select token/path under cursor |
| Drag token body | Move it |
| ⌘/Alt+drag token | Move even while pen armed |
| Alt+click anything | Delete it |
| Wheel / ⌘wheel / middle-drag / Space-drag | Pan / zoom |

- `D` arms **sticky pen**: many strokes in a row, no auto-switch away. `V`/Esc disarms.
- Finishing a stroke still auto-selects it → inspector ready, pen stays armed for the next route.
- Rail collapses to **Select · Pen · Text** (+ palette toggle). Pan tool button and Erase tool removed (gestures above replace them; keep `E` as momentary erase-cursor alias).

### H6 · One-shot type bar **[DECIDED]**
On stroke completion, render a compact floating chip-row near the path tip: `R B P H S M D` (route/block/pass/handoff/snap/motion/drop). One click retypes instantly without hunting the inspector; fades after 3s or first click elsewhere. Inspector remains the full editor.

### H7 · Center defaults as ball handler **[DECIDED]**
New plays resolve ball-start to **C** when present (explicit pick > handoff origin > C > QB). Matches direct-snap runs and shotgun snaps alike.

### H8 · Snap radius must be zoom-independent **[DECIDED — bug]**
Endpoint snap radius is `28px / zoom`; zoomed out (zoom≈5) that's a 5.6yd lasso — mis-snaps to distant tokens/routes. Cap at `min(28px, 2.0yd)` in both endpoint snapping and target resolution (which already uses fixed 3yd — reduce to 2.5yd and prefer nearest-tip tie-breaks).

---

## Part 2 — Latent issues found by audit

| # | Issue | Fix |
|---|---|---|
| L1 | Pitch/toss not represented (you listed toss plays) | Add **Toss** as a style variant of handoff (longer arc, same scheduling) — new type only if you want inspector separation **[Q1]** |
| L2 | Blocks anchor to blocker only; moving a DL leaves stale block tips | Trim-at-runtime: re-trim block end to defender's current rim each frame (cheap, uses existing warp plumbing) |
| L3 | Two routes' tips near each other (bunch) may resolve pass to wrong target | Target resolution prefers paths whose tip lies within a narrower cone along the pass direction; ties → nearest |
| L4 | Timeline chips are overwritten by every reschedule — user-tuned timings lost | Add `userLocked` flag set when a chip is dragged; reschedule skips locked paths (still respects them as constraints) |
| L5 | No visual indication of chain order on a player with multiple paths | Inspector (token selected) lists its movement sequence with reorder buttons; timeline chips already show temporal order |
| L6 | `timelineDuration` floor 2500ms pads short plays | Floor drops to 1500ms |
| L7 | Erase during playback pauses via beginHistory ✓ but selection highlight persists on deleted items | Prune-on-delete already handles; add e2e assert |
| L8 | Passes from non-QB (halfback throwbacks) work but inference labels them 'pass' only if curved ≥10yd — short HB passes infer 'block' | Inference exemption: strokes starting from a player who possesses ball (per ball-start resolution) never infer block |
| L9 | Speed changes alter all durations retroactively (good) but FLIGHT_MAX cap can make arrival ≠ route end when thrower ready very early | **[DECIDED]** Keep cap at 1800ms; football-real late arrivals documented as intended |
| L10 | Undo of reschedule-heavy ops (type change) feels jumpy visually | Keep as-is; chips animate via CSS transition 150ms |

---

## Part 3 — Test matrix (encode as `npm test` scenarios)

Each = scheduled timings + sampled ball/player positions asserted within ε. Suite lives in `tests/scenarios.test.ts` (Vitest), promoted from the tsx scratch suite.

| ID | Scenario | Key assertions |
|---|---|---|
| T1 | Stationary-QB slant (existing S1) | sync ≤1ms; lands on WR; flies mid-window |
| T2 | Rollout + comeback (S2) | release gated by rollout; arrival at break |
| T3 | Dropback + snap + curl (S3) | snap@0; curl≥snapEnd; drop slow; pass gated+synced |
| T4 | Dive: handoff→dive (S4/S5) | handoff meets approach tip; run waits; ownership transfers |
| T5 | **Pitch/toss sweep**: toss to pitch man widening outside | toss arrives at his path tip; warp keeps arc attached both ends |
| T6 | **QB pre-snap motion** (QB shifts left, then snap/drop) | motion [0..m]; snap@m; drop@m; everything shifts together |
| T7 | **WR motion into bunch**, pass to either tip | target resolution picks intended tip (directional cone, L3) |
| T8 | **Double-read**: screen + post off same QB | both flights fly (H4); ball follows chronology; ends carried by last receiver |
| T9 | **Direct-snap RB run** (no QB involvement, C default holder H7) | ball starts at C; handoff-less run animates from snap |
| T10 | **Play-action bootleg**: fake handoff (handoff→RB who blocks-ish/runs) + QB rollout pass | handoff syncs; rollout gates; pass syncs to boot target |
| T11 | Chain binding: run lane drawn 6yd away from RB chain tip | playback binds start to chain tip (H1); shape preserved |
| T12 | Zoom-out stress: endpoints snapped at zoom=5 | no mis-snap beyond 2yd cap (H8) |
| T13 | Locked chip respected (L4): drag pass chip later, edit another route | locked timing preserved; others reschedule around it |
| T14 | Undo across: stroke→retype(H6)→drag endpoint | history coherent, playback resets cleanly |

## Execution checkpoints

| Phase | Contents | Exit criteria |
|---|---|---|
| **HA** Mechanics | H1 binding, H3 canonical flights, H4 ownership rewrite, H8 radius caps, H2/H7 constants | T1,T4,T5,T9,T11,T12 green |
| **HB** Sequencing depth | Toss as separate type (L1), L2 block retrim, L3 cone, multi-motion cases | T6,T7,T8,T10 green |
| **HC** Tooling | H5 grammar, H6 type bar, rail collapse | manual pass: full slant-flat concept without touching V; E/alt-delete parity |
| **HD** Timing polish | L4 locked chips, L5 chain list, L6 floor, Q2 decision | T13,T14 green; your eyeball pass on drop speed |
| **HE** Regression | promote suites to Vitest + CI script; fix stragglers | whole matrix green in one command |

Estimate: HA 2d · HB 1–2d · HC 1–2d · HD 1d · HE ½d.

---

## Amendment A1 — Scenario loader (added post-HA, user request)

Manual testing no longer requires re-drawing plays. A **scenario picker** on the canvas loads pre-built plays matching the test matrix:

- `src/lib/scenarios.ts`: seeds for Slant–flat, Rollout+comeback, Dropback+curl, Dive chain, Double-read, Direct-snap run, Pre-snap motion, Toss sweep (handoff arc until L1 lands). Coordinates mirror the Vitest/tsx suites so manual and automated tests verify the same geometry.
- Store action `loadPlay()` replaces tokens/paths (reschedules, resets history/playback/ball-start).
- UI: floating `Load scenario…` select, top-left of canvas.
- Seeds double as M9 onboarding content.

Cost: ~½ day. No phase reordering; HB starts after this is green.

---

## Decisions (grill-back, all resolved)

1. **Toss = separate inspector type**, shared scheduling logic with handoff (own label + arc style). HB builds it as a type, not a variant.
2. **Hang-time cap stays 1800ms** (snappy).
3. **Pass geometry: straight by default + capped loft** — drawn bow preserved up to 2yd perpendicular as a single smooth curve.
4. **Blocks keep sliding along their line** during playback; add L2 runtime re-trim so they track moving defenders.
5. **Pen mode: ⌘/Alt-drag moves players**; plain clicks select. Confirmed acceptable.

All items are now unblocked for execution in HA → HE order.

## Questions for you (grill-back)

_(all answered — see Decisions above)_
