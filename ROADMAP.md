# DrawAPLAY — Coach Product Roadmap

`SPEC.md` specs the editor, and the editor is largely built. This document is the *product* plan on top of it: what has to exist before a coach's season can run on the app and before anyone can pay for it, in the order I would build it.

The customer is a **coach, youth through small college**. That whole range shares one workflow end to end — the coach is the entire staff, there is no money for tools or procurement, paper still carries the plan, and the week is always build → print → teach → call → review. Serve the workflow and the range is one product.

## Where the range splits, and what it constrains

| | Youth | Small college |
|---|---|---|
| Players per side | 11, 8, 6 (flag is a different game) | almost always 11 |
| Field | sometimes 80yd, small-sided | 100 + end zones, as built |
| Play volume | 10–20 | 100–300, sorted by situation |
| Medium | phone first, finger drawing | laptop, projector, print |
| Who pays | a parent-coach | a program, or a GA's own money |

**Constraint on M9 and M12: the launch product is 11-man only, and the small-sided variants are M12 — but the number of players and the field length must not be baked into the sheet layout or the file format.** They reach the geometry, the formation builder, the drawing surface, the export frame and the print layout. Deferring them is cheap; undoing them is not.

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
| **M10** | The front door | A stranger finds it, draws free, signs up, pays, and finds the same play on another device |
| **M11** | Situation and order | Find a play by down and distance; a script in order |
| **M12** | The depth the range demands | Bulk work, roster names, notes, flip, small-sided fields, league-legal defensive presets |

Numbering continues `SPEC.md`'s list. `SPEC.md`'s M8 (Export & Share) is built — PNG and video shipped as one fixed frame; the read-only share link lands in M10, now that there is a backend to put it behind. Still owed from `SPEC.md` and absorbed here: §5.1 (the library as the *home*, not a modal), §5.3 (save-as-formation), §5.4 (import/export the whole playbook). M8 and M9 pay those off rather than invent them.

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
- **When small-sided formats arrive (M12)** the field becomes a setting and the question of a coach's format has a real answer; that is where a level belongs, not here.

## Youth rules, and what they buy us

Pop Warner at 8U/9U: **no blitzing**, a maximum of **six defenders on the line of scrimmage**, linebackers 3yd off the ball, corners 5, safeties 7, and coaches permitted on the field. No kickoffs or punts at those ages. A mercy rule at 30 points bars passes and outside runs. A minimum-play rule must be met by the end of the third quarter. Two consequences: special teams stay out of scope (nothing to build), and **league-legal defensive presets** become possible — alignments that are legal by construction for the coach's game (M12).

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

Printing and the playbook file are M9, situation is M11, and bulk actions, small-sided geometry and roster names are M12. Pre-drawn plays are not planned: the formation presets are the starting point, and every play in a playbook is the coach's.

## Acceptance

A first-time coach opens the app on an empty playbook, picks a formation, is shown one stroke and one playback, names the play and saves it — never a blank page, never someone else's plays, and never a manual. A returning coach lands on their playbook with the play they had open one tap away.

## Effort

About two days. The library already exists as a modal, so the promotion, the empty state, the Continue row and the breadcrumb are roughly a day; the walkthrough's copy, ghost stroke and step function are the other.

## Risks

- **The walkthrough must show, not explain.** The demo is fifteen seconds and three prompts is the ceiling. A step that needs a paragraph is the wrong step, and an onboarding that teaches the toolbar instead of the first play wastes the only first run there is.
- **Touch is unverified.** The pen is a visible rail button, so it is discoverable, but drag-drawing with a finger has never been tested. If youth coaches are phone-first and the drag does not work there, the walkthrough has to be designed for touch first, not adapted afterwards.
- **The preset list is personnel-coded** (`23 … 00`), which a youth coach may not recognise at a glance. Watch first-run behaviour before deciding whether named formations are worth adding; do not add them on a hunch.
- **11-man only leaves small-school coaches out until M12.** Say so in the product's own words, not just here.

## Decisions

- The launch product is **11-man only**; 9-, 8- and 6-man arrive in M12, and flag is not in the plan (see M12).
- M9 does the **sheet** before the **file** — the sheet is visible, the file is the safety net.
- **Formations, not plays.** The quickstart's presets are the fast path onto the field, so the app ships no plays of its own; a playbook starts empty and holds only the coach's work.
- **The walkthrough is the first play**, not a tour: three action-gated prompts on the real field, ending with a saved play. Its ghost stroke is a hint on the coach's own formation, never content.
- **No level question.** At 11-man there is nothing for the answer to change; it returns with small-sided formats in M12, when it decides the bodies on the field.
- League-legal **defensive** presets (six on the line, linebackers 3yd off, corners 5, safeties 7) sit in M12, not M8.

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
- The file's play shape is the shape sync stores, so there is one serialization of a play, not two.
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
- Printing is free until M10; from then on it is the Pro gate.
- Export requires an account from M10; the video and the file never require payment, the still is Pro.

---

# M10 — The front door

## Goal

A stranger finds the product, draws a play without an account, signs up to keep it safe and take it with them, pays for the rest, and opens the same playbook on a laptop.

This is the first milestone that is not about football. It is the one that turns the app into a business, and it sits here because everything before it is what the coach is actually paying for.

## The landing page

**One URL.** The product's root is the marketing page to a stranger and the playbook to a signed-in coach. There is no separate marketing site and no `/app` prefix: one deploy, one place to be wrong.

- **The hero is the app.** The loop at the top is a real play rendered by the same `computeScene` the editor uses, autoplaying and repeating — not a recorded video, so it cannot drift from the product and weighs nothing. It is a hand-drawn scenario, never one of the tracking plays: that footage is not ours to advertise with.
- **One sentence, then proof.** What it is, the loop, and a button that goes straight into the editor. No sign-up gate on the button.
- **Three steps, no feature list**: draw it, watch it, print it.
- **Pricing on the page**, one plan, monthly and yearly, with the free tier stated in the same breath.
- **The questions a coach actually asks**: does it work on a phone, does it work offline, is it 11-man, can I print it, what happens to my plays if I stop paying.
- **No cookie banner.** Analytics are cookieless and the funnel is counted in our own database, so nothing needs consent.
- **Legal before money**: privacy, terms, refund policy, and account deletion that is not buried in an email thread.

## Sharing

A shared play is a public, read-only page at `/p/<id>`: the same renderer, no editor, no account to view, revocable by its owner, and `noindex` so a coach's playbook never surfaces in a search result. It is a day of work now that a backend exists, and it is the only growth loop this product has — a coach who sends a play to the staff group chat is showing the product to five other coaches.

The earlier plan deferred share links behind a backend. That reason is gone.

## Accounts

- Email and password, Google, and magic link. Email verification is required before sync, not before drawing.
- **Better Auth in the same Worker**, sessions in D1, httpOnly cookies. Version 1.5 supports D1 directly: no separate auth service and no second bill.
- **Sign-up is offered, never required to draw.** The first play is made signed out; the account appears the first time the coach wants to take something out of the app or keep it safe — export a video, back up the playbook, sync it or pay. A wall before the first stroke throws away the only demo this product gets.
- **A free account stores a backup, not a synced playbook.** One compressed snapshot per save in R2 — cheaper than the verification email it took to create the account — and nothing to reconcile. That is the cheapest acquisition channel available and it is the product's best argument.
- Deleting an account deletes the plays, the snapshots and their R2 objects — a real cascade, with a short restore window and nothing after it.

## Sync

- **The play is the unit.** A write states the revision it started from; if the server has moved on, the incoming version is kept as a conflict copy named after its device rather than silently overwriting.
- **Ordering comes from a server sequence, never a device clock.** Two phones ten minutes apart must not decide which edit won.
- **Deletes are tombstones**, so a play deleted on the phone does not come back from the laptop.
- **Local-first stays.** IndexedDB is the working copy and the network is a background convenience: drawing, playback and printing never wait for a request. Offline is a normal state, not an error.
- **Nothing syncs until sign-in.** A signed-out playbook behaves exactly as it does today, and the first sign-in claims the local playbook in one pass rather than uploading it twice.
- Exports are not synced; video and PNG are regenerated on the device that wants them.
- **A service worker**: installed, the app opens and draws with no network at all.

## Backup — free, and not sync

The account's first job is to make the work safe, and that part is free.

- **The whole playbook, every time.** Every save writes one compressed snapshot of the entire playbook to R2, with a pointer row in D1 — every play, folder, tag, timing and note. There is no coverage cap: "ten of your plays are safe" is a half-truth and a support ticket, and the eleventh is usually the new game plan. The 25-play limit is on creating new plays, and it never decides what a snapshot contains: a coach over the line, for any reason, has every play backed up.
- **Restore-only.** A snapshot never pushes itself to a device and never merges. Restoring is an explicit action that replaces the local playbook, behind a confirm that names what is being replaced.
- **One source device.** Saves carry a device label. A device that is not the source cannot silently become one: it asks, and the question says plainly that the other device's changes will not be merged.
- **A lapse freezes sync, never deletes.** A coach who stops paying keeps every snapshot, keeps backing up as a free account, and can still restore; synced rows stop changing rather than disappearing. Pro is what keeps two devices the same, not what keeps the work alive.
- **Retention is time, not coverage**: the last 20 snapshots and at least 90 days, pruned by one job, and the newest is never pruned.
- **Writes are rate-limited; coverage is not.** One snapshot per minute of change, because a snapshot per keystroke is a bill, not a feature.

This is deliberately not sync. Sync is a different job — two devices kept identical while both are being edited — and it is what Pro sells.

## Billing

- **RevenueCat Web, on its own billing engine over Stripe.** RevenueCat Billing gives a hosted checkout, the subscription lifecycle, a customer portal and receipts without building any of them, and one `pro` entitlement the server checks. Stripe is the gateway; RevenueCat is not the merchant of record, so sales tax runs through Stripe Tax at 50¢ per transaction in registered locations.
- **The free tier is the trial.** No timed trial, because a coach's season has gaps. Free, once there is an account, is the whole editor with the playbook backed up: the walkthrough, the animation as video, the file, share links, a restore-only backup with no coverage cap, and **up to 25 plays**. Pro buys **a season** — unlimited plays, live sync, the sheet and the PNG still — at **$9/month or $59/year**, priced to be the coach's own money rather than a program's purchase order.
- **Three reasons to pay, in the order a coach meets them.** Capacity — the 25th play, because a season needs more room than a game plan. Paper — the sheet and the still, the artifacts he hands out on Friday. Continuity — two devices kept identical, which only a staff needs. They arrive as one plan, because a menu of three would be a worse product and a worse business.
- **The cap is capacity, not safety.** Twenty-five plays is a game plan's worth: enough to build, watch and print through a real Friday, and then the season asks for more. It blocks a new play; it never takes one away, never edits one, never stops an export, and never touches the backup. A coach already over the line keeps every play he made, and only new ones wait.
- **Paper is the second gate.** The sheet and the PNG still are the same purchase: the still is 2160×3840, a coach can print it, so giving it away would make the print gate a formality. Video stays free because motion is the demo and the only share loop this product has — a coach who sends a clip to the staff group chat is the advertisement.
- **Sync is the third gate, and the smallest.** Only a staff with two devices needs two devices kept identical. A youth coach with one phone is buying capacity and paper.
- **The server decides; the client only hides buttons.** Entitlement is a row written by the RevenueCat webhook, checked on sync and on print.
- **Webhooks are verified and idempotent**: signature checked, event id stored, duplicate delivery ignored, unknown types logged and ignored. A daily reconcile pulls from RevenueCat, so a dropped webhook cannot leave a paying coach locked out.
- **The file is never held hostage.** Exporting the whole playbook stays free for every account, including one that has stopped paying, because a coach's season is not collateral for a subscription. The file is also the reason a lapsed coach can come back without having lost a year.
- **Honest limit: printing, export and the play limit happen in the browser and cannot be enforced by a server.** All three are UI gates; sync is the one the server can actually check. That is the right trade — a coach who opens the browser's developer tools to print one page was never going to pay.
- **Refunds and comps** happen in RevenueCat's dashboard and a support inbox. No admin UI in this milestone.
- RevenueCat is free below $2,500 monthly tracked revenue, then 1%. If sales-tax registration becomes the bottleneck, RevenueCat also supports Paddle as merchant of record, at roughly 5% + 50¢ and no filings.

## What runs where

Checked against Cloudflare's published pricing and limits, October 2026:

- **One Worker** serves the app and the API. Static assets are free and unlimited; the paid Workers plan is $5/month and includes 10M requests and 30M CPU-ms.
- **D1** holds users, sessions, plays, entitlements and webhook events: 5GB included, $0.75/GB-month beyond, 10GB maximum per database, 25B rows read and 50M written included per month. A play is a few kilobytes, so a thousand coaches with a hundred plays each stay inside the included tier. Each database is single-threaded — fine at this size, and the first thing to watch if writes ever queue.
- **R2** for playbook snapshots and shared pages: 10GB free, no egress fee.
- **Turnstile** on sign-up and password reset, free.
- **Resend** for verification and reset mail: 3,000 emails a month free, 100 a day.
- **No other platform.** No Postgres, no second host, no separate auth vendor, no CMS.

The alternative was Supabase or Firebase, which bundle auth with a database. Cloudflare wins because the app is already a static bundle and the API is small: the same deploy serves both, static traffic costs nothing, and the only stranger in the stack is email. The cost is that auth, sync and billing are ours to write and ours to keep running — which is the work below, not a hidden extra.

## Data

```
users         id, email, created_at, deleted_at
sessions      Better Auth
plays         id (client uuid), user_id, name, folder_id, tags, data JSON, rev, seq, updated_at, deleted_at
folders       id (client uuid), user_id, name, rev, seq, updated_at, deleted_at
entitlements  user_id, pro_until, source, updated_at
webhook_log   event_id, type, received_at
snapshots     id, user_id, seq, device, r2_key, bytes, created_at
```

- The play id is generated on the device and kept, so an offline play is never renumbered when it uploads.
- `rev` is per row; `seq` is per user and assigned by the server.
- Folders sync like plays, so the playbook a coach sees on the laptop is the one they filed on the phone.
- A snapshot's body is a gzipped playbook in R2; D1 stores only the pointer, so a 300-play season never approaches the 2MB row limit.
- `data` is the same serialized play the file format defines — one shape with three uses: IndexedDB, the file, the server.

## What gets tested

- **Entitlement**: a signed-out request cannot sync; a free account cannot sync; a cancelled subscription loses pro at period end, not mid-session; a webhook replayed twice changes nothing.
- **Sync**: two devices converge; a delete does not resurrect; an offline edit merges; a conflicting edit produces a named conflict copy instead of a loss.
- **Auth**: verification, reset, session expiry, and account deletion removing every play.
- **Export**: a signed-out client is asked for an account before a video, a PNG or the file; a free account can take the video and the file but not the still.
- **The landing page**: it renders with the app's own renderer, the loop stays under 2MB, and nothing moves under `prefers-reduced-motion`.
- **The share page**: no editor, no account, and a revoked link 404s.
- **Backup**: a restore replaces the local playbook and never merges; a second device cannot overwrite the source without confirming; a lapsed account can still restore; pruning never removes the newest snapshot.
- **Capacity**: a free playbook refuses the 26th play with the reason shown, while every existing play stays editable, exportable and backed up; a playbook already over the line is never trimmed.

## Manual checks

- Buy with a test card, cancel, and confirm access ends when the period does.
- Sign up on a phone, draw, open a laptop, find the play.
- Turn the network off, draw, reconnect, nothing lost and nothing duplicated.
- Open the installed app with the server unreachable: it still draws.
- Clear the browser on a signed-in phone, restore from the account, and get the playbook back exactly.

## Acceptance

A stranger lands, draws a play without an account, signs up to make it safe and export it, pays when the season outgrows the playbook, and finds it on a laptop. A coach who never pays can still draw, watch and export a video of each of his 25 plays, keep them backed up, and take them home in one file.

## Effort

About three and a half weeks of one person's time: landing page and legal two days, accounts three, schema and sync four, backup two, billing three, sharing one, hardening two.

## Risks

- **Sync is the hard part**, and the version worth building is deliberately small: per-play revisions, conflict copies, tombstones. A real CRDT is a month and solves a problem one coach with two devices does not have.
- **The backend is a promise.** Uptime, backups, deletion and privacy are now the product's problem. D1 Time Travel gives 30 days of point-in-time recovery; a weekly export to R2 is the belt to that braces.
- **Charging for print is a bet.** It is the fairest gate — pay for the routine — and it is still a bet, to be watched with real coaches before the free tier hardens.
- **D1 is single-threaded per database.** Fine for thousands of coaches; if that changes, shard by user, which the schema already allows because every row is owned.
- **Email deliverability** is a real setup job: SPF, DKIM, DMARC and a warm domain. A reset email in spam is a customer lost.
- **A landing page is not a business.** This milestone makes the product buyable; it does not make anyone want it. That is the demo, and the demo is already built.
- **Restore is a rule, not a merge.** The first coach who restores onto a device that was also being edited will lose the weaker copy if the confirm is read carelessly; the confirm must name the playbook and the time it replaces.
- **A backup is a promise.** The night before a game is exactly when it must work. Test a restore every month, and treat an outage on that night as the most expensive hour of the year.
- **The 25th play is the bet.** Capacity — not sync, not paper — is what most coaches will pay for, and 25 is a guess. Test it with the first fifty coaches, only ever move it up, and grandfather early buyers.

## Decisions

- **Cloudflare** for hosting and backend: one Worker, D1 for data, R2 for snapshots and share pages.
- **RevenueCat for billing**, its own billing engine, Stripe underneath, one `pro` entitlement, one plan.
- **Anonymous-first**: no account is required to draw, only to export, back up, sync or pay.
- **Free is the trial**: the editor, the animation, video export, the file, share links, a whole-playbook restore-only backup, and 25 plays on one device, forever, for any account; Pro buys a season — unlimited plays, sync, the sheet and the still.
- **The landing page is the app's own renderer**, on the app's own domain, with no CMS and no recorded video.
- **Share links are in**, public and revocable, because the backend that was blocking them now exists.
- **Backup covers the whole playbook and is free; sync is paid.** Safety is not an upgrade, and a cap on coverage is a nag. The cloud copy is never merged, only owned.

---

# M11 — Situation and order

## Goal

A coach finds the play for the moment, and puts plays in the order they will be called.

## Situation

- Four fields, the four a coach says out loud: **down** (1–4), **distance** (short 1–3, medium 4–6, long 7+), **zone** (backed up, own half, crossing, red zone, goal line), **hash** (left, centre, right). Free tags for everything else.
- Set on the play, in the inspector or on the playbook card. Optional: a play without a situation is still a play.
- **Finding** is a filter row in the playbook — pick down and distance, see what fits. No query syntax and no search operators.

## Present

- A play fills the screen with playback and nothing else: no rails, no inspector, no pen. The playbook is used in a staff meeting, not only while drawing.
- A script steps forward and back call by call, so the meeting follows the order rather than a search box.
- Presenting is part of Pro. It is the clearest thing a coach can point at when asked what he pays for.

## The order

- A **script** is an ordered list of plays with one line of text per call. It references plays; it never copies them, so editing a play edits the call.
- Built by adding from a play card or dragging in the playbook; reordered by drag or by moving a line up and down.
- **Printing a script uses M9's sheet**: one line per call and a diagram for each, in the same paper palette.
- A play can sit in many scripts. Deleting a play leaves the script naming the gap rather than silently renumbering the calls.

## Data

- `PlayRecord.situation?: { down?, distance?, zone?, hash? }`; tags already exist on the record.
- `ScriptRecord { id, name, entries: { playId, note? }[], createdAt, updatedAt }` in the same IndexedDB, and synced the same way plays are.
- Filtering is pure: `matchesSituation(play, query)`.

## What gets tested

- Filtering across every field and combination, with unset fields meaning "any".
- A script survives a play being edited, and names the gap when a play is deleted.
- A script prints in call order, one line per call.
- Presenting shows the play and nothing else; a script steps forward and back in order.

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
- Presenting is a viewing mode, not a slide deck: no transitions, themes or embedded video.
- Presenting and the printed call sheet are Pro; finding a play is free.

---

# M12 — The depth the range demands

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

- The field is a value, never a constant, before M12 starts.
- Flag is out until the play grammar can express it.
