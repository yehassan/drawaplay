# DrawAPLAY — Coach Product Roadmap

`SPEC.md` specs the editor, and the editor is largely built. This document is the *product* plan on top of it: what has to exist before a coach's season can run on the app, in the order I would build it.

The customer is a **coach, youth through small college**. That whole range shares one workflow end to end — the coach is the entire staff, there is no money for tools or procurement, paper still carries the plan, and the week is always build → print → teach → call → review. Serve the workflow and the range is one product.

## Where the range splits, and what it constrains

| | Youth | Small college |
|---|---|---|
| Players per side | 11, 8, 6 (flag is a different game) | almost always 11 |
| Field | sometimes 80yd, small-sided | 100 + end zones, as built |
| Play volume | 10–20 | 100–300, sorted by situation |
| Medium | phone first, finger drawing | laptop, projector, print |
| Who pays | a parent-coach | a program, or a GA's own money |

**Constraint on M8–M10: the launch product is 11-man only, and the small-sided variants are M11 — but the number of players and the field length must not be baked into the sheet layout or the file format.** They reach the geometry, the formation builder, the drawing surface, the export frame and the print layout. Deferring them is cheap; undoing them is not.

## The problem this plan solves

Today the app **wins the demo and loses the routine**. Draw a squiggle, watch it move like football: a coach gets that in fifteen seconds. But their week is build the plan, put it on paper, teach it, call it, review it — and only the first step is served. More pen features do not change that.

Three artifacts are missing, and they are what a coach actually carries:

- **the sheet** — what is in their hand on Friday, and in a player's hand all week
- **the file** — the season, safe and portable, handable to an assistant
- **the order** — a script or call sheet above a single play

## Roadmap

| | Milestone | The coach gets |
|---|---|---|
| **M8** | Playbook home, and the first play | The app opens as their playbook, and the first play is drawn with them |
| **M9** | The sheet and the file | Plays on paper, the season in a file |
| **M10** | Situation and order | Find a play by down and distance; a script in order |
| **M11** | The depth the range demands | Bulk work, roster names, notes, flip, small-sided fields, league-legal defensive presets |

Numbering continues `SPEC.md`'s list. `SPEC.md`'s M8 (Export & Share) is built — PNG and video shipped as one fixed frame; only the read-only share link remains, deferred behind a backend and not part of this plan. Still owed from `SPEC.md` and absorbed here: §5.1 (the library as the *home*, not a modal), §5.3 (save-as-formation), §5.4 (import/export the whole playbook). M8 and M9 pay those off rather than invent them.

---

# M8 — Playbook home

## Goal

The app opens as a coach's playbook, not a drawing canvas. The playbook holds the coach's own plays and nothing else: there is no library of pre-drawn material, because the formation presets already get a coach onto the field in a few taps, and an empty playbook still shows the next step instead of a blank page.

## Screens

**`playbook` — the new launch surface.** Replaces the editor as what opens first, and is the existing library modal promoted to a screen.

- Header: playbook name (inline edit), search, **New play**, settings.
- **Continue** row: the last-opened play — thumbnail, name, one click into the editor. Today's behaviour, demoted from default to one tap.
- **Empty state**: with no plays, the grid gives way to one card — **Draw your first play, about a minute** — which opens the quickstart's formation step. The way forward is the formation a coach already knows, not a button labelled New play.
- Folder rail and tag filter: already in the modal.
- Play grid and trash: unchanged cards, thumbnails, duplicate, rename, soft delete, restore.

**`editor` — unchanged**, except a breadcrumb back to the playbook in the top bar (`SPEC.md` §4.6 already asks for this).

## Flows

- **First run:** empty playbook → pick a formation → the walkthrough (below) → a saved play → breadcrumb back.
- **Later runs:** playbook with Continue at the top; **New play** opens the existing quickstart formation picker.
- **No shipped plays.** The playbook starts empty on purpose: the first play a coach sees is one they drew, and the app never asks them to curate someone else's material.

## First play — the walkthrough

The empty playbook's card opens the quickstart; once a formation is picked, the walkthrough runs on the real field in three steps. Each waits for the coach to do the thing; none is a Next button.

1. **Draw one route.** One player is marked and the prompt says "drag from this player". A ghost stroke draws itself once and fades — motion, not a still, because a still does not show what a drag produces. Any stroke clears the step, whether or not it matches the ghost.
2. **Press play.** The play button pulses once the first stroke lands. The animation is the payoff, and it arrives within seconds of the stroke.
3. **Name it and it's yours.** One line, then save; the coach lands back on the playbook with the play in it.

Then it stops. No tool inventory, no path types, no pass or handoff, no defence editing, no export — those can wait for a second session.

**It never blocks the canvas.** No modal, no overlay that eats a drag. Prompts sit in the field's margin and are dismissed by doing the thing. Skip is one key, and skipping marks it done.

**Deviation is fine.** Extra strokes, moved players, a deleted path — the prompt follows the document, not a script: with no player-driven stroke it asks for one; with a stroke but no playback it asks for the play; played and unsaved it asks for a name.

**The step is derived, not stored.** `firstPlayStep({ strokes, played, saved })` is pure, and only the completion timestamp is persisted, so a reload mid-way resumes where the coach was and a reopened play never restarts the walkthrough.

**No shipped content.** The ghost stroke is a hint drawn on the coach's own formation, not a play in the library.

## Data

- **`ProfileRecord`** (a small store in the existing IndexedDB, not a change to `PlayRecord`): `lastOpenedPlayId`, so **Continue** means the play the coach actually had open rather than the most recently saved one, and `onboardingDoneAt`, which is the only part of the walkthrough that is stored.
- **No launch decision.** With one format there is nothing to ask and nothing to infer: the app opens on the playbook, empty or full. The store holds `screen` with `openPlaybook()` / `openEditor()`. No router — the app is one screen with modals today and this keeps the dependency list as it is.
- **When small-sided formats arrive (M11)** the field becomes a setting and the question of a coach's format has a real answer; that is where a level belongs, not here.

## Youth rules, and what they buy us

Pop Warner at 8U/9U: **no blitzing**, a maximum of **six defenders on the line of scrimmage**, linebackers 3yd off the ball, corners 5, safeties 7, and coaches permitted on the field. No kickoffs or punts at those ages. A mercy rule at 30 points bars passes and outside runs. A minimum-play rule must be met by the end of the third quarter. Two consequences: special teams stay out of scope (nothing to build), and **league-legal defensive presets** become possible — alignments that are legal by construction for the coach's game (M11).

### Sources

1. Pop Warner 2025–26 Rule Book: https://dt5602vnjxv0c.cloudfront.net/portals/21799/docs/rule%20books/25-pw-005_pop_warner_rule_book_2025-2026_updated.pdf
2. AYF 2025 National Rulebook: https://wmfoa.org/files/2025ayfrulebook.pdf
3. USA Football — ADM Junior & Senior Rules Guide: https://assets.usafootball.com/documents/rookietackle/resources/ADM-Junior-and-Senior-Rulebook.pdf

## What gets tested

M8 is mostly a screen, so most of it is checked by hand. The logic it adds is one row and one pure function.

- **The profile row**: the last-opened play survives a reload, and clearing the playbook leaves the row alone.
- **`firstPlayStep`**: no stroke asks for one; a stroke but no playback asks for the play; played and unsaved asks for a name; saved is done. A play opened again with `onboardingDoneAt` set never shows a prompt.
- **The library**: search, folders, rename, duplicate, trash and restore are already covered and unchanged.
- The existing 350 tests and `SCENARIOS`' 16 are unchanged.

## Manual checks

- The playbook opens first, empty and full; the empty state leads to the formation picker; Continue reopens the play the coach had open; the breadcrumb returns to the playbook.
- The walkthrough runs end to end, survives a reload halfway through, can be skipped, and can be done with a finger if the app is used on a phone.
- A coach who has never seen the app reaches a saved, animated, edited play without reading a manual.

## Out of scope for M8

Printing, the playbook file, situation, bulk actions, small-sided geometry, roster names. Those are M9–M11. Pre-drawn plays are not planned: the formation presets are the starting point, and every play in a playbook is the coach's.

## Acceptance

A first-time coach opens the app on an empty playbook, picks a formation, is shown one stroke and one playback, names the play and saves it — never a blank page, never someone else's plays, and never a manual. A returning coach lands on their playbook with the play they had open one tap away.

## Effort

About two days. The library already exists as a modal, so the promotion, the empty state, the Continue row and the breadcrumb are roughly a day; the walkthrough's copy, ghost stroke and step function are the other.

## Risks

- **The walkthrough must show, not explain.** The demo is fifteen seconds and three prompts is the ceiling. A step that needs a paragraph is the wrong step, and an onboarding that teaches the toolbar instead of the first play wastes the only first run there is.
- **Touch is unverified.** The pen is a visible rail button, so it is discoverable, but drag-drawing with a finger has never been tested. If youth coaches are phone-first and the drag does not work there, the walkthrough has to be designed for touch first, not adapted afterwards.
- **The preset list is personnel-coded** (`23 … 00`), which a youth coach may not recognise at a glance. Watch first-run behaviour before deciding whether named formations are worth adding; do not add them on a hunch.
- **11-man only leaves small-school coaches out until M11.** Say so in the product's own words, not just here.

## Decisions

- The launch product is **11-man only**; 9-, 8- and 6-man arrive in M11, and flag is not in the plan (see M11).
- M9 does the **sheet** before the **file** — the sheet is visible, the file is the safety net.
- **Formations, not plays.** The quickstart's presets are the fast path onto the field, so the app ships no plays of its own; a playbook starts empty and holds only the coach's work.
- **The walkthrough is the first play**, not a tour: three action-gated prompts on the real field, ending with a saved play. Its ghost stroke is a hint on the coach's own formation, never content.
- **No level question.** At 11-man there is nothing for the answer to change; it returns with small-sided formats in M11, when it decides the bodies on the field.
- League-legal **defensive** presets (six on the line, linebackers 3yd off, corners 5, safeties 7) sit in M11, not M8.

---

# M9 — The sheet and the file

## Goal

A play leaves the screen: the coach prints it for Friday, and can hand the season to an assistant as one file.

## The sheet

- **Print from wherever a play exists**: "Print this play" in the editor, and select-then-print in the playbook.
- **One play per page**, portrait letter or A4, the diagram as large as the page allows with the play's name beneath it. No header, no logo, no watermark.
- **The page is white.** Printing is not a screen: the sheet uses a paper palette — white ground, dark ink, solid offence, dashed routes — because most coaches print on a school copier, and a green field is a wet page.
- **One geometry rule.** The printed diagram comes from the same `frameView` the video uses, with the page's aspect instead of 9:16, so the play grows to the paper, density follows the play, and nothing is cropped. A play that cannot fill the page is centred and padded, never cut.
- **Browser print, not a PDF library.** The sheet is a print stylesheet and a print route; the coach gets a PDF from the print dialog when they want one. No new dependency, works offline, works on every device.
- **Save an alignment as a formation** (`SPEC.md` §5.3): "Save these eleven as a formation" stores the coach's own alignment, which then appears in their quickstart. It is their formation, not a shipped one — the same rule as plays.

## The file

- **One JSON file, the whole playbook**: version, exportedAt, plays, folders, scripts, and every field needed to replay a play exactly — tokens, paths, timings, ball start, line of scrimmage, notes.
- **Import is additive.** It never deletes what is there. Every incoming play gets a fresh id, folders match by name or are created, and a file that fails validation imports nothing at all.
- **One version forward.** A file from a newer version is refused with a sentence the coach can act on, never half-read.
- **No thumbnails or video in the file.** Both are derived, and a playbook should stay small enough to email.

## Data

- `lib/sheet.ts`: page layout per play, built on `frameView` with a paper aspect; pure, so the layout is tested without a printer.
- `lib/playbookFile.ts`: `exportPlaybook(records) → Blob` and `importPlaybook(json) → { plays, folders, scripts }`, versioned and pure.
- `ProfileRecord` unchanged.

## What gets tested

- **Round trip**: export → import → export produces the same plays, paths and timings, with ids remapped once and stable afterwards.
- **Refusals**: a truncated file, a newer version, and a file with one bad play each import nothing and say why.
- **The sheet**: one play per page, the whole play inside the page box, and a density floor — the same invariants the video frame already holds.
- **A saved formation** appears in the quickstart and reproduces the same eleven positions.

## Manual checks

- Print a play on a real printer or copier, at letter and A4, in colour and in black and white.
- Export a playbook, clear the browser, import it, and open a play: it animates exactly as before.

## Acceptance

A coach prints one play and pins it up, and hands a season to an assistant as a single file that comes back intact.

## Effort

About three days: the sheet is one, the file and its tests two.

## Risks

- **Paper is not a screen.** Route colours and hairlines that read on a monitor vanish on a copier. The paper palette is the work, and it needs a real printer.
- **For some coaches this file is the only copy.** An import that half-succeeds is worse than one that refuses; validation happens before a single record is written.

## Decisions

- The sheet prints through the browser; no PDF library.
- The file is JSON and additive; import never replaces.

---

# M10 — Situation and order

## Goal

A coach finds the play for the moment, and puts plays in the order they will be called.

## Situation

- Four fields, the four a coach says out loud: **down** (1–4), **distance** (short 1–3, medium 4–6, long 7+), **zone** (backed up, own half, crossing, red zone, goal line), **hash** (left, centre, right). Free tags for everything else.
- Set on the play, in the inspector or on the playbook card. Optional: a play without a situation is still a play.
- **Finding** is a filter row in the playbook — pick down and distance, see what fits. No query syntax and no search operators.

## The order

- A **script** is an ordered list of plays with one line of text per call. It references plays; it never copies them, so editing a play edits the call.
- Built by adding from a play card or dragging in the playbook; reordered by drag or by moving a line up and down.
- **Printing a script uses M9's sheet**: one line per call and a diagram for each, in the same paper palette.
- A play can sit in many scripts. Deleting a play leaves the script naming the gap rather than silently renumbering the calls.

## Data

- `PlayRecord.situation?: { down?, distance?, zone?, hash? }`; tags already exist on the record.
- `ScriptRecord { id, name, entries: { playId, note? }[], createdAt, updatedAt }` in the same IndexedDB.
- Filtering is pure: `matchesSituation(play, query)`.

## What gets tested

- Filtering across every field and combination, with unset fields meaning "any".
- A script survives a play being edited, and names the gap when a play is deleted.
- A script prints in call order, one line per call.

## Acceptance

A coach sets third and four, finds the plays that fit in two taps, builds a ten-call script and prints it.

## Effort

About three days.

## Risks

- **Taxonomy creep.** Four fields are a filter; eight are a database. Nothing joins this list without a coach asking for it.
- **A script is not a game plan.** It sequences plays; it does not model clock, score or opponent. Resist that.

## Decisions

- Situation lives on the play, not on the call.
- Scripts reference plays; they never copy them.

---

# M11 — The depth the range demands

## Goal

The things a coach notices after a season, and the formats the rest of the market plays.

## What ships

- **Bulk work**: multi-select in the playbook; move to folder, tag, print, delete — each one a single undo.
- **Roster names**: a name alongside the number on a token, printed and exported; `tokenLabel` still owns the on-field text.
- **Play notes**: a short free-text note per play, under the diagram on the sheet and in the inspector.
- **Flip**: mirror a play left to right, tokens and paths together, as one undoable action.
- **Small-sided formats**: 9-, 8- and 6-man. The field becomes a setting — length, width, hash offsets, number columns — each format gets its own formation table, and the quickstart filters to the coach's format. The sheet and the file already carry geometry as data, so neither changes shape.
- **League-legal defensive presets**: six on the line, linebackers three yards off, corners five, safeties seven — alignments that are legal by construction for the coach's game.

## Not in scope: flag

Five-a-side has no blocking and a different start. The play grammar cannot express it, and a preset that pretends otherwise would draw a play that reads like tackle. Flag is a separate product decision, not a format toggle.

## Data

- A `format` on the profile (11, 9, 8, 6) with field dimensions attached; a roster name on the token.
- Formation presets become `Record<Format, PersonnelDef[]>`.

## What gets tested

- Every format places the right number of players on its own field, with nobody off it.
- Flip is its own inverse: flipping twice restores the play exactly.
- A bulk action over ten plays is one undo and never crosses folders silently.
- A six-man play travels through the sheet and the file without either changing shape.

## Acceptance

A six-man coach runs the same first-play walkthrough on an 80×40 field, prints it and exports it. An eleven-man coach with a hundred plays can tag and file them in a minute.

## Effort

About two weeks, most of it the field and the preset tables.

## Risks

- **Small-sided formats are a second customer.** Their vocabulary differs from eleven-man. Watch one six-man coach before building the third table.
- **Bulk actions are dangerous at scale.** One undo, and nothing happens to a play the coach cannot see.

## Decisions

- The field is a value, never a constant, before M11 starts.
- Flag is out until the play grammar can express it.
