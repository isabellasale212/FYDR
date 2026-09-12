# Overnight summary — 2026-09-12 (builder, `build/walkthrough`)

Every commit below carries its full handover in its own message body (`git show <hash>`).
Scratch only (`stfgzkuvczbpxyevxkak`); nothing deployed, no production read or write, no
`vercel`, no `npm audit fix`. Every commit: normal merge of `origin/athlete-spec-builder`
first (no conflicts all night), tests first, full prebuild green, explicit `git add` paths,
pushed. Records: `docs/overnight-records-2026-09-12.md`. Questions:
`docs/overnight-questions-2026-09-12.md` ("## Builder", 1–4).

## Part 1 — brand accent, 02 follow-up, decided defects

- `e6ab6b1` **Brand accent** — `--accent #17489b` light / `#2a6ddf` dark, the four light accent
  inks collapsed to one, `--accent-border`, `--focus`, `--wk-match-border`, PDF accent,
  `--lk-trace`; dark `--accent-pill-text #8fb4ff`, dark `--bad-text #ff7460` (its contrast
  exemption removed, the accent exemption narrowed to dark); ADR-009; 112-assertion guard.
- `4b7b4fa` **ATH-ADULT-02 follow-up** — the week strip compact above To do, no avatar, athlete
  cards at `--r-toggle`, a warm availability line.
- `71035f5` **§0al (first half)** — a network failure at publish keeps the week in
  sessionStorage and never refreshes it away.
- `f2b72ea` **§0ak** — one group-filter cookie, written by every chip row, read by every
  multi-athlete screen.
- `586520d` **§0ah** — a session cannot be created or edited without a duration (boundary; the
  column stays nullable — Builder question 1; the week-template path — question 2).
- `d8938b1` **§0z** — "Turn notifications back on" restores each type's prior state (migration
  0103, `mute_notifications` / `unmute_notifications`, 20 pgTAP assertions).
- `4c7a127` **§0ar** — a failed sign-in's audit row records the user agent.
- `f5a59c4` **§0al (second half)** — sessions and session_participants are audited (migration
  0104, 21 pgTAP assertions).
- `dd02445` **§0ao** — tests that expect a failure capture `console.error`; the prebuild chain
  writes nothing to stderr.
- `068e5ba` + `e052fd0` **§0u** — "Sessions logged" counts a gym session only once it has a live
  set (the second commit fixed a pronoun in a comment the inclusive-copy guard caught; the
  first was committed with that guard red because the chain used `;` — never again, every
  later commit is `prebuild && commit`).
- `ea93b20` **§0aa** — no decided direction; question 3 with a recommendation
  (`resolveGymSetConflict`), not built.
- `eff27bb` **§0ai** — the create-session form refuses an empty type and no groups (the grid's
  "Add to day" — question 4).

## Part 2 — design folders, A items only, one flow per commit

| Flow | Commit | Built | Recorded only |
|---|---|---|---|
| ATH-ADULT-04 | `99db8a6` | after-card "Already submitted", the fact first, the exit a button | — |
| ATH-ADULT-06 | `13f68e4` | "Already rated" / "This session isn't there" at heading size, "Back to Today" button | — |
| ATH-ADULT-08 | `a69c958` | "Already answered", two exits as buttons, a correction that names its week, "Your answer" tag | the second question (the live check-in has one); once-only correction |
| ATH-ADULT-09 | `e50d5da` | borderless exercise card, sticky logger header | the set-by-set rebuild; the 56/52/48 size tokens (B, as told); the colour reversal of the 2026-09-08 gold decisions (D4); wake lock, haptics, PBs, the summary |
| ATH-ADULT-10 | `1771cf0` | "Finish early" as a dashed neutral control | moving it to the header; the confirmation; the early summary |
| ATH-ADULT-11 | — (in `e50d5da`'s record) | nothing buildable | the footer swap; the "corrected · was" strip |
| ATH-ADULT-12 | `e581211` | absent values as words ("Not submitted" / "Not logged"), hero figure at `--fs-48`, rows at 44px, value column right-aligned | five segments (reverses §13 + guard), white active segment, uncoloured deltas vs the 28-day average, the fact line, Sessions/Nutrition as hero tabs, empty-period states with "Show this season", assigned-only tests, a period menu, the tab bar's gold glyph, readiness "of 5", `--chart-h` / `--chart-stroke` |
| ATH-ADULT-13 | `98cfeec` | the summary as a two-up hero, one full-width "Back to gym history" (shell Back stands down — closes §0w's third item), "recomputed after a correction", "Not logged" / "Not rated" | the eyebrow (needs two more columns), tap-a-row correction with a Save/Cancel footer, the per-row "Corrected · was" marker and the list pill, "4 of 6 shown", no tab bar |
| STAFF-SS-01 | `ab3d97e` | **nothing — as instructed** | all of it; D1: the board's bottom bar + More sheet reverses §0af's decided "compact top bar with a menu"; B1: eight named tokens do not exist here; the §0ae trigger is the prompt's own gate and is a permissions migration |

## Skipped, and why

- **STAFF-SS-01** — not built, per instruction; morning decision (D1 above).
- **Gym logger size tokens 56 / 52 / 48** — B, as known in advance; not built.
- **§0aa** — no decided direction on the to-do list; question filed instead.
- **§0ah NOT NULL** and **§0ai grid gating** — beyond the decided boundary; questions filed.
- **Every reversal of a recorded decision** (09 D4 gold → accent, 12 D1–D4, STAFF-SS-01 D1)
  — recorded with a recommendation, not built: a spec conflict by the overnight rule.
- **Anything needing a new query** (last-entry-per-domain, assigned tests, the per-session
  revised flag, the session eyebrow, per-exercise bests) — C, recorded.

## Corrections to handovers, made after the push (no amend, no force-push)

- `98cfeec`'s handover says "no fixture has a corrected set". Wrong: James Barnes
  (`j.barnes@`) has `/my-data/gym/d9e83019-6c15-47a0-a3a4-17a6914d0651` (2 Sept, set 1
  corrected). Captured after the commit: "3 sets · recomputed after a correction", the
  "Not rated" hero word, and the reworded "What you reported" all render as built
  (session scratchpad `shots/13/after-corrected-*`).

## For the morning (read-only files I could not tick)

- `docs/Fydr_-_Architecture_To-Do_List.md`: §0w third item (the 15px "Back to gym history"
  link) is closed by `98cfeec`; §0al's second half by `f5a59c4`; §0z by `d8938b1`; §0ar by
  `4c7a127`; §0ao by `dd02445`; §0u item 1 by `068e5ba`; §0ah and §0ai at the boundary
  (questions 1, 2, 4 for the rest); §0ak by `f2b72ea`.
- `06-my-data.md` §10 still says the period control is gone; the code has had it back since
  the same afternoon and §12 records the disagreement as a decision.

## Added after the queue — §0ad (compliance cutoff), morning of 2026-09-12

- `9ec24c8` **§0ad** — an RPE counts only if its original submission was before `rpeClosesAt`
  (`rpeSubmittedInTime`, `lib/complianceRpe.ts`); matched per session; the report reads
  originals from `training_entries`. Scratch, this season: 284 of 631 (was 302 under the
  old rule — 17 double-credited day matches, 1 genuinely late).
- `d02ae17`, `922f2ff` — merges of `origin/athlete-spec-builder`; the same questions-file
  conflict twice (the reviewer's branch has no Builder section), resolved as ruled:
  their Reviewer list, then Builder 1–6.
- `67cf9aa` **Builder Q5** — the athlete report's compliance figure uses the same
  classifier and the same session read (`queries/rpeSessionWindows.ts`). James Barnes,
  this season: 51% (was 52%).
- `0c63b4c` **Builder Q6** — the outbox sends `queuedAt`; migration 0105's trigger keeps
  it only when earlier than arrival and within 24 hours (pgTAP 610: kept at 2h and 24h,
  arrival at 30h and for a clock set ahead; a staff correction untouched). Scratch only.

## The second queue — afternoon/evening of 2026-09-12 (standing approvals in force)

- **1. Athlete card spacing** — already built before the queue (`94099bd`, `--gap-body`
  28 → 20px; the in-list gap judged and left). Nothing further.
- `75c6a6e` **§0aa** — `resolveGymSetConflict`: a gym set queued offline whose slot holds
  different numbers is a visible conflict on Today with both values and two ways out
  ("Use my numbers" corrects the live set; "Keep what is showing" drops the queued one);
  the same numbers under another id dequeue as delivered. Verified on scratch with a
  colliding queue against James Barnes's set 2.
- `5003959` **§0at** — migration 0106: `gym_session_logs_current.total_volume_kg` is derived
  from the live sets (filtered to loaded sets, null otherwise); the stored column is dead.
  Not too slow: 0.455 ms for the whole org, 0.1 ms for the biggest session (6 sets).
  45 of 45 complete sessions now carry a tonnage (41 were null).
- **4. ATH-ADULT-04 / 06 / 08 — nothing further built.** Every A and B item was built in
  the first queue. The remaining items are C without a decided direction on the to-do
  list (04 C1 the corrected state on the check-in page, C4 "Corrected by"; 06 C1 the
  subhead; 08 C1–C3 the once-only correction and the saved state) or D (08 D2 the second
  question). Skipped under the rule.
- **5. ATH-ADULT-09 / 10 / 11 — nothing further built.** 09 has a D (D4, the colour
  reversal of the 2026-09-08 decisions) → the flow is skipped under the rule; its B items
  are the unapproved 56/52/48 sizes (B1, B2), a motion token (B3, protected) and the 48px
  chip (B4, tied to the rebuild). 10 and 11 are C items with no decided direction.
- **6. ATH-ADULT-12 / 13 — nothing further built.** 12 has D1–D7 → skipped under the rule;
  its B items are either new tokens with no substitute (B1 chart tokens) or tied to a D
  (B2 `--blue-200`, B3 segment labels) or a C (B4, B5). 13's remaining items are C (the
  eyebrow needs two more columns; the row-tap correction; the per-row marker) with no
  decided direction.
- `af09c17` **STAFF-SS-01, the staff phone shell** — built as decided: below 768px a 64px
  title bar (page name + active group chip), a bottom bar of Dashboard / Squad / Schedule /
  a role slot (Flags · Gym · Nutrition) / More, and a More sheet (52px rows, Log out at a
  real size, a real disclosure); the sidebar's rows moved to `Sidebar/rows.ts` so both
  shells draw one table; the 44px floor for staff controls below 768 in the same block;
  the board's eight missing tokens each mapped to an existing one, none added. All 60
  staff routes affected (listed in the handover); before/after on seven screens at
  375×812 plus the desktop dashboard unchanged. Not built: the dashboard rebuild (C2),
  the Flags badge (C3), reminders (C4), the §0ae trigger (C5) — none decided.
- Question 7 filed: the board's "only the active chip appears" for the in-page group bar.

## Prebuild chain

`… && test:ath-adult-04 && test:ath-adult-06 && test:ath-adult-08 && test:ath-adult-09 &&
test:ath-adult-10 && test:ath-adult-12 && test:ath-adult-13 && test:rpe-compliance-cutoff &&
test:athlete-gap-body && test:gym-set-conflict && test:gym-tonnage-derived &&
test:staff-phone-shell` — 22 new TS guards in the chain today plus four pgTAP files
(590, 600, 610, 620), all green at the last commit.

---

## Reviewer (appended the morning of 2026-09-12, after the merge to `3103ad9`)

**What happened to the poll.** The 30-minute cron was armed at 22:41 and never fired — the session sat idle overnight and the scheduler only fires into an active session. The one merge made overnight was the first pass, before the cron: `6618b7f` + `5ae00ea` (ATH-ADULT-03 / §0s) as `b13cc29`, spot-checked and recorded (`25c0f73`, `1aa26af`). Everything else the builder pushed was merged this morning in one go.

**The merge.** One conflict, `docs/overnight-questions-2026-09-12.md` (both sections written by both sides); aborted per the rule, Isabella ruled "reviewer section verbatim, Builder section appended", and by then the builder had resolved it identically on their side (`d02ae17`, `922f2ff`), so the morning merge of `3103ad9` was a clean fast-forward. Dev server restarted. Prebuild after the merge: see the last line.

**Handovers recorded, one spot-check each** (to-do list §0ac-style block; walkthrough sections 04, 06, 08, 10, 12, 13 annotated; decisions log linked to `e6ab6b1` and `4b7b4fa`):

| Commit | Claim checked | Result |
|---|---|---|
| `e6ab6b1` accent | the four token values and their dated comments in `tokens.css` | as stated, light `#17489b`, dark `#2a6ddf`, `#8fb4ff`, `#ff7460`, each "11 Sept 2026, Isabella's decision" |
| `4b7b4fa` 02 follow-up | `/today` as Conor at 375 | cards `border-radius: 9px`, no avatar, This week above To do |
| `71035f5` §0al publish | source | sessionStorage round-trip; `router.refresh()` only `if (!networkFailed)` |
| `f2b72ea` §0ak | live, both directions as Jane | report → squad carried "Forwards"; squad → report carried "Backs + Forwards · 29 athletes"; reset |
| `586520d` §0ah | `/schedule/new` DOM | duration `required`, `min=5`, default 60 |
| `d8938b1` §0z | scratch DB | `mute_notifications` / `unmute_notifications`, `muted_at` column present |
| `4c7a127` §0ar | source | failure row spreads `user_agent` as the success row does |
| `f5a59c4` §0al audit | scratch DB | `sessions_audit`, `session_participants_audit` triggers; one `sessions.create/.delete`, one `session_participants.add` row from the builder's test |
| `dd02445` §0ao | `npm run test:sign-in-audit` | 0 stderr lines (was 21), passes |
| `068e5ba`+`e052fd0` §0u | source | "logged" = at least one live set (`squadWeeklyReport.ts:156`) |
| `ea93b20` §0aa, `ab3d97e` SS-01 | `git show --stat` | docs only, nothing built — as stated |
| `eff27bb` §0ai | live submit with a name and no group | "Choose at least one group." `role=alert`, focus to the fieldset, no navigation |
| `99db8a6` 04, `a69c958` 08 | source (Conor has no entry today / check-in still due) | after-cards with heading + `.btn-primary` exits as stated |
| `13f68e4` 06 | `/rpe/<bogus>` live | "This session isn't there" `<h2>` 28px; "Back to Today" `a.btn-primary` |
| `e50d5da` 09 | `/gym/b4373061` live | `.gym-ex-card` border 0, no shadow; `.gym-head` sticky top 0; set keys still 42px (expected, B) |
| `1771cf0` 10 | same page | "Finish early · 0 of 12" `.btn-ghost.gym-finish-early`, 1px dashed, 44px |
| `e581211` 12 | `/my-data` live | hero 48px, four "Not …" words, rows 73px, values right-aligned — **and §0at, below** |
| `98cfeec` 13 | Conor's 11 Aug session | one back control, "Back to gym history" `.btn-ghost` 335×57; hero "6.8" 48px |
| `9ec24c8` §0ad | `/reports/compliance` live | "284 of 631 submitted" this season |
| `67cf9aa` Q5 | `/reports/athlete/…000002` live | James Barnes 51% |
| `0c63b4c` Q6 / 0105 | scratch DB | `training_entries_clamp_submitted_at` trigger present |

**Found while checking (`e581211`), filed as §0at, group 1 on the pilot list:** `total_volume_kg` is written only by the correction RPC — 41 of 45 complete sessions with live sets on scratch have a null total, and the four with one are exactly the corrected ones. My data's Gym history now says "Not logged" beside a detail page that sums the same sets to 4762 kg (Conor, 11 Aug); staff volume means average the corrected four. The words are right; the column is the bug.

**Closed on the to-do list:** §0al (both halves), §0ak, §0ah (form), §0z, §0ar, §0ao, §0u (both), §0ai (form), §0ad, §0w's third item. **Left open with a note:** §0aa (no direction — Builder Q3). **Pilot list moved:** group 1 lost items 2, 4, 5, 8 and gained §0at; §0aa now reads "decision, then build".

**For Isabella, in the questions file (Reviewer 6–9):** STAFF-SS-01's D1 (bottom bar vs §0af's top bar), §0aa's direction, §0at's fix direction, and the note that 0103/0104/0105 are on scratch only.

**Prebuild after the merge (reviewer machine, dev server running):** 98 suites, 0 failed; `next build` exit 0.

**Migrations:** scratch is at 0105; production at 0102. 0103, 0104, 0105 are on scratch and not on production.

