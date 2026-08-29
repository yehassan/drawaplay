# Path Sequencing Rules

## Speeds

| Path type | Speed | Notes |
|-----------|-------|-------|
| Route | 6 yd/s | WR-speed |
| Drop/Rollout | 2.4 yd/s | QB drops back deliberately |
| Run | 5.5 yd/s | Ball carrier |
| Pass/Handoff/Toss/Snap | 14 yd/s | Ball flight |

Duration = distance / speed, minimum 300ms.

---

## Phase ordering (runs 3 iterations to settle chains)

### Phase 1 — Motion (pre-snap)
- All `motion` paths play **before the snap**, regardless of when they were drawn
- They chain in draw order: motion 2 starts when motion 1 ends, etc.
- Motion **never** counts as a receiving window for passes

### Phase 2 — Snap
- Fires **after all motion completes**
- Duration: 300ms (the center exchange)

### Phase 3 — Everyone else
- All non-motion, non-snap paths start **when the snap ends**
- This includes routes, drops, blocks, runs, passes, handoffs, tosses

### Phase 3.5 — Per-player chaining
- A player's own player-driven paths (route, drop, run, block) sequence in draw order
- Example: if a player has two routes drawn, the second starts when the first ends
- Motion is excluded — it already lives in Phase 1

### Phase 4 — Flights (pass, handoff, toss)

**Pass (to a receiver with a route):**
- Ball **arrives** exactly when the receiver's connected route completes
- Flight duration ≈ 40% of the route's duration (clamped 300ms–1800ms)
- Launch is pulled back so arrival lands on the route's end
- If the thrower isn't ready in time, launch is held and flight is compressed

**Pass (thrower readiness):**
- Stationary thrower: waits `RELEASE_HITCH_MS` (550ms) after snap before throwing
- Thrower with own drop/rollout: releases when that movement ends (minus 100ms overlap)

**Handoff / Toss:**
- Fixed 450ms exchange
- Starts at `snapEnd` (synced with the line's fire-off, same as other routes)
- Not gated by the thrower's movement

### Phase 5 — Possession gating
- After a handoff/toss/snap completes, **every other move** of the receiver must start at or after the delivery completes
- Exception: the one path that feeds the exchange (the RB's step toward the LOS) — its end is what the delivery syncs to, so it's excluded
- "Feeder" is detected by which path's end is closest to the delivery's arrival time

---

## Other rules

- **`userLocked` paths** are preserved verbatim — their timing is never overwritten (except flights, which are always derived)
- **Timeline floor** is 1500ms minimum
- **Easing**: trapezoid velocity profile with a fixed 220ms ramp at start and end — not per-path normalized cubic. Keeps perceived acceleration identical across short and long routes.
