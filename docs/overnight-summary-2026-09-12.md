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

## Prebuild chain

`… && test:ath-adult-04 && test:ath-adult-06 && test:ath-adult-08 && test:ath-adult-09 &&
test:ath-adult-10 && test:ath-adult-12 && test:ath-adult-13` — 17 new TS guards in the chain
tonight (brand-accent through ath-adult-13) plus two pgTAP files (590, 600), all green at
`ab3d97e`.
