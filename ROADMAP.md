# DrawAPLAY — Coach Product Roadmap

`SPEC.md` specs the editor, and the editor is largely built. This document is the *product* plan on top of it: what has to exist before a coach's season can run on the app, in the order I would build it.

The customer is a **coach, youth through small college**. That whole range shares one workflow end to end — the coach is the entire staff, there is no money for tools or procurement, paper still carries the plan, and the week is always build → print → teach → call → review. Serve the workflow and the range is one product.

## Where the range splits, and what it constrains

| | Youth | Small college |
|---|---|---|
| Players per side | 11, 8, 6, flag 5–7 | almost always 11 |
| Field | sometimes 80yd, small-sided | 100 + end zones, as built |
| Play volume | 10–20 | 100–300, sorted by situation |
| Medium | phone first, finger drawing | laptop, projector, print |
| Who pays | a parent-coach | a program, or a GA's own money |

**Constraint on M8–M10: 11-man is the default and the small-sided variants are M11 — but the number of players and the field length must not be baked into the sheet layout or the file format.** They reach the geometry, the formation builder, the drawing surface, the export frame and the print layout. Deferring them is cheap; undoing them is not.

## The problem this plan solves

Today the app **wins the demo and loses the routine**. Draw a squiggle, watch it move like football: a coach gets that in fifteen seconds. But their week is build the plan, put it on paper, teach it, call it, review it — and only the first step is served. More pen features do not change that.

Three artifacts are missing, and they are what a coach actually carries:

- **the sheet** — what is in their hand on Friday, and in a player's hand all week
- **the file** — the season, safe and portable, handable to an assistant
- **the order** — a script or call sheet above a single play

## Roadmap

| | Milestone | The coach gets |
|---|---|---|
| **M8** | Playbook home, with starters for their level | The app opens as their playbook, never an empty canvas |
| **M9** | The sheet and the file | Plays on paper, the season in a file |
| **M10** | Situation and order | Find a play by down and distance; a script in order |
| **M11** | The depth the range demands | Bulk work, roster names, notes, flip, small-sided fields, league-legal defensive presets |

Numbering continues `SPEC.md`'s list. `SPEC.md`'s M8 (Export & Share) is built — PNG and video shipped as one fixed frame; only the read-only share link remains, deferred behind a backend and not part of this plan. Still owed from `SPEC.md` and absorbed here: §5.1 (the library as the *home*, not a modal), §5.3 (save-as-formation), §5.4 (import/export the whole playbook). M8 and M9 pay those off rather than invent them.

---

# M8 — Playbook home, with starters for their level

## Goal

The app opens as a coach's playbook, not a drawing canvas, and a first-time coach is never looking at an empty grid or a blank field with no way forward.

## Screens

**`playbook` — the new launch surface.** Replaces the editor as what opens first, and is the existing library modal promoted to a screen.

- Header: playbook name (inline edit), the coach's level, search, **New play**, settings.
- **Continue** row: the last-opened play — thumbnail, name, one click into the editor. Today's behaviour, demoted from default to one tap.
- **Starters**: offered while the playbook is small, and reachable from settings afterwards ("Starter playbooks for 12U").
- Folder rail and tag filter: already in the modal.
- Play grid and trash: unchanged cards, thumbnails, duplicate, rename, soft delete, restore.

**`level` — first run only, one screen.** "Who are you coaching?" → 8U · 10U · 12U · High school · College · Just exploring. Skippable, changeable later. It sets defaults, which starters are offered, and which formations the quickstart leads with, and nothing else.

**`editor` — unchanged**, except a breadcrumb back to the playbook in the top bar (`SPEC.md` §4.6 already asks for this).

**`starters` — a screen from the playbook.** One card per set: level, play count, the one-line purpose, the play names visible *before* adding, and **Add to my playbook**. Sets already added say so.

## Flows

- **First run:** level question → playbook with starters highlighted → Add → the set lands in a folder → open a play → edit → breadcrumb back.
- **Later runs:** playbook with Continue at the top; **New play** opens the existing quickstart formation picker.
- **Adding a set:** copies plays in as the coach's own records — fresh ids through `loadPlay`'s remap path — grouped in a folder named for the set, tagged with its level. Adding an already-added set sits behind an explicit **Add again**, so a second tap cannot silently double the playbook.

## Data

- **`ProfileRecord`** (a small store in the existing IndexedDB, not a change to `PlayRecord`): `level`, `onboardingSeenAt`, `lastOpenedPlayId`, `addedStarterSetIds`.
- **`lib/starterPlaybooks.ts`**: a `CONCEPTS` map of one `Scenario`-shaped builder per concept (the same `tok()`/`path()`/`build()` helpers `scenarios.ts` uses), and `STARTER_SETS` keyed by level as an ordered list of concept keys plus a folder name and a purpose line. Cumulative sets then cost nothing extra, and moving a concept between levels is one list edit. Pure builders, so they are testable without the UI.
- **`lib/levels.ts`**: `LEVELS` (key, label, players per side, field length) and `defaultsFor(level)`. Every level is 11 players and 100 yards today; M11 changes the numbers, not the shape.
- **The launch decision is pure:** `initialScreen({ onboardingSeen, playCount })` → `'level' | 'playbook'`. The store holds `screen` with `openPlaybook()` / `openEditor()`. No router — the app is one screen with modals today and this keeps the dependency list as it is.

## Starter content

The content is more work than the code, and it is the demo. It is built from **shared concepts** — eleven new plays plus three the app already ships cover all three youth levels, because the sets are cumulative.

### The sets

| Level | Size | Plays | Mix |
|---|---|---|---|
| **8U** | 8 | Wedge · Power · Lead ISO · Trap · Dive\* · Direct-snap RB run\* · Counter · Pop Pass | 7 runs, 1 quick pass |
| **10U** | 10 | the 8U eight + Toss sweep\* · Jet Sweep · Boot (Waggle) | 8 runs, 2 passes |
| **12U** | 12 | the 10U ten + Buck Sweep · Reverse · Play-Action Post | 9 runs, 3 passes |
| **High school** | — | the 16 scenarios the app already ships | as they are |
| **College** | — | those 16, plus the five real tracked plays as "study a real rep" | as they are |

`*` ships already and is reused rather than rebuilt: `Dive: snap → handoff → run chain`, `Direct-snap RB run`, `Toss sweep`. So the authoring is **eleven plays, not thirty**. The sets are cumulative on purpose — a level adds the next layer rather than replacing the last — and a coach trims what they will not run, because the set lands as ordinary plays in a folder they own.

**Cut, with reasons:** Power Sweep is what `Toss sweep` already is; Halfback Pass is `Toss then pass`. Both dropped. Boot (Waggle) is close to `Rollout + comeback` and kept, because "Waggle" is the word youth coaches use.

**Every starter play must be warning-free**, the same invariant the shipped scenarios are held to.

**Names come from the sources, not from us.** Each play is named as the coaching material names it. The per-player assignments are standard rules applied to a sourced concept, and they are the part to red-line first.

### Formations at a youth level

The quickstart currently leads with pro personnel sets (11/10/02/01, shotgun, empty). The formation poll puts I-Formation, Double Wing, Single Wing, Wing-T and Power I at the top of youth football; spread and pistol are a minority even at 12U and close to absent below it. So a youth level offers, in order: **I-Formation · Power I · Double Wing · Split Backs · T (non-option) · Wishbone (non-option) · Off-set I**, and only then the shotgun family. A formation preset is the alignment only; the starter plays above are built as explicit positions.

### Why these sets

**How many plays.** A youth team installs about **4–8 plays at 8U** and 6–12 at 12U, and the widely used pattern is a "Base 8" that expands only as the players prove they can execute it. Plays per player per game run around 44, because minimum-play rules require every player to get his reps — so the app is building a small set that gets repped hard, not a deep book. That is also why the youth sets are small and the sheet matters more than the editor.

**Rules, and what they buy us.** Pop Warner at 8U/9U: **no blitzing**, a maximum of **six defenders on the line of scrimmage**, linebackers 3yd off the ball, corners 5, safeties 7, and coaches permitted on the field. No kickoffs or punts at those ages. A mercy rule at 30 points bars passes and outside runs. A minimum-play rule must be met by the end of the third quarter. Three consequences: special teams stay out of scope (nothing to build); **play-action is safe at 8U and 9U**, which is why Pop Pass earns a slot that young; and **level-aware defensive presets** become possible — alignments that are legal for the coach's league by construction (M11).

**Runs vs passes.** There is no citable statistic, and the popular "80% run at 8U" figure is folklore. What is supported is qualitative: a forward pass needs four things right at once and is a change-up, not a base. Hence the progression of one, two and three passes across the three sets, every one of them a quick or play-action throw rather than a dropback.

### Sources

1. Coach Parker — 10 Best Youth Football Plays: https://coachparker.org/2022/03/17/best-youth-football-plays/
2. Coach Parker — Best Youth Football Offense, by Age (carries the formation poll): https://coachparker.org/2024/01/29/best-youth-football-offense/
3. Coach Parker — How Many Plays in a Playbook: https://coachparker.org/2020/06/10/how-many-plays-in-a-playbook/
4. Coach Parker — Beast Offense, the Base 8: https://coachparker.org/2017/06/30/beast-offense-plays-the-base-8-best-beast-plays/
5. Coach Parker — Top 5 Wing-T Plays: https://coachparker.org/2020/06/09/youth-football-wing-t-plays/
6. Youth Football Online — 10 Best Youth Football Run Plays: https://youthfootballonline.com/10-best-youth-football-plays-run-plays/
7. Youth Football Online — 8 Best Formations for Youth Football: https://youthfootballonline.com/8-best-offenses-for-youth-football/
8. Pop Warner 2025–26 Rule Book: https://dt5602vnjxv0c.cloudfront.net/portals/21799/docs/rule%20books/25-pw-005_pop_warner_rule_book_2025-2026_updated.pdf
9. AYF 2025 National Rulebook: https://wmfoa.org/files/2025ayfrulebook.pdf
10. USA Football — ADM Junior & Senior Rules Guide: https://assets.usafootball.com/documents/rookietackle/resources/ADM-Junior-and-Senior-Rulebook.pdf
11. Kerr et al. — play counts and injury incidence in youth football: https://pmc.ncbi.nlm.nih.gov/articles/PMC5687240/

**Not sourced, and left for a coach:** the exact play names above, and any claim about a run/pass percentage by age.

## What gets tested

Vitest, in `tests/`. The launch screen's React wiring stays manual, as the rest of the app's event wiring is.

- **Every play in every starter set**, loaded through `loadPlay`: `playWarnings` empty, every flight in `flightLaunches` actually fires, nothing off the field. This extends the existing corpus invariant from the shipped scenarios to the starters.
- **`defaultsFor(level)`**: every shipped level maps to the geometry the field actually renders — so a future 8-man level cannot silently draw on a 120-yard field.
- **`initialScreen`**: first run → `level`; onboarded with no plays → `playbook` with starters; with plays → `playbook`.
- **Add a set**: N plays in, N records out, ids remapped, folder assigned, level tagged; adding twice does not duplicate unless explicitly asked.
- **Coverage**: every key in `LEVELS` has a starter set, so a new level cannot ship with nothing to open.
- **Token spacing**: no two tokens in a starter play or a youth formation closer than the app's comfortable spacing (~1.5yd). A double-tight youth line is tight by design and will find this first.
- **Youth formations**: each places 11 players, none overlapping, and draws as a real alignment rather than free-floating tokens.
- The existing 350 tests and `SCENARIOS`' 16 are unchanged.

## Manual checks

- Launch screen, level question, Continue card, and add-then-open behave in a browser.
- A coach who has never seen the app reaches a saved, animated, edited play without being told anything.

## Out of scope for M8

Printing, the playbook file, situation, bulk actions, small-sided geometry, roster names. Those are M9–M11.

## Acceptance

A first-time coach picks their level, adds a starter set, opens a play, edits it, and returns to the playbook — never seeing an empty grid or a blank field with no way forward — and every starter play at every level is warning-free.

## Effort

About 4 days. The screens are roughly a day, because the library already exists as a modal; the eleven starter plays and the youth formation family are the rest, and they are the part that needs a coach's eye.

## Risks

- **Starter content quality.** It is the demo and it needs a coach's review, not my guess at what 8U runs.
- **The level setting must stay small.** Defaults and which starters are offered. The moment it becomes a scheme-complexity switch it splits the product in two.
- **Double-tight youth lines are tight by design.** A token's body is 0.69yd and the app draws comfortably at ~1.5yd between centres; a Double Wing or Power I line at youth splits may land closer than that. If the spacing test fails, the fix is the drawing, not the formation.
- **Wedge blocking is restricted in several youth leagues and states.** Wedge is in the 8U set because it tops the coaching lists, but confirm it is legal where the coach plays before building it; the swap is a lead play or a sneak.

## Decisions taken, pending objection

- 11-man is the default; 8-man, 6-man and flag are M11.
- M9 does the **sheet** before the **file** — the sheet is visible, the file is the safety net.
- Youth starter sets are **cumulative** — 8 plays at 8U, 10 at 10U, 12 at 12U — and built from shared concepts, so the authoring is eleven plays plus three that already ship.
- The sets are **small on purpose**: a youth team installs 4–8 plays at 8U and 6–12 at 12U, and a coach trims what they will not run.
- Level-aware **defensive** presets (six on the line, linebackers 3yd off, corners 5, safeties 7) sit in M11, not M8.
