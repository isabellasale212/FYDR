# Fydr documentation index

**Written 13 September 2026. This file says what is authoritative and where it
lives. When two documents disagree, the one named here wins.**

The repo is the source of truth for anything anyone acts on, because the
builder and reviewer can only read the repo. The claude.ai Project holds
strategy and a current-state page, and points here for everything else.

## Start here

| Question | File |
|---|---|
| What are we building, and how complete must it be? | `decisions/scope.md` |
| What platform, and how is it delivered? | `platform-decision.md` |
| What notifications does the product send? | `platform-decision.md`, part two |
| What is left to do? | `architecture/to-do.md` |
| What design items are unbuilt and undecided? | `design-decisions-outstanding.md` |
| What does each report say it is? | `reports-catalogue-source.md` |
| How do we deploy? | `runbook-deploy-*.md` |
| What are the binding rules for an agent session? | `../CLAUDE.md` |
| What rules does every screen follow? | `decisions/design-constitution.md` |
| Which design system does the code use? | `decisions/design-system-adoption.md` |
| What happens to an entry with no signal? | `decisions/offline-and-queue-states.md` |
| What does a wrong field look like? | `decisions/invalid-field-pattern.md` |
| At what width does the layout become the phone one? | `decisions/breakpoints.md` |
| What happens when a club downgrades? | `decisions/premium-downgrade.md` |
| Why is a screen missing? | `decisions/absence-rule.md` |
| What lawful basis do we process on? | `decisions/lawful-basis-open.md` (OPEN) |
| Nutrition, leaderboards and report shapes | `designs/PATTERN-S10-final/` |
| What did Isabella decide on 13 September? | `decisions/decision-batch-2026-09-13.md` |
| What did Isabella decide on 14 September? | `decisions/decision-batch-2026-09-14.md` |
| What did Isabella decide on 15 September? | `decisions/decision-batch-2026-09-15.md` |
| Do the loading skeletons earn their place, and how fast is production? | `decisions/skeleton-gate.md` |
| What counts as a weigh-in, and when may the body mass rule speak? | `decisions/body-mass-rule.md` |
| When does a gym programme session actually happen? | `decisions/programme-dates.md` |
| What did Isabella decide on 15 September (afternoon)? | `decisions/decision-batch-2026-09-15-pm.md` |
| What is agreed but not yet sent to the builder? | `queue-pending.md` |
| What changed in the design handover? | `design-programme-corrections-2026-09-13.md` |

## The layers, and which beats which

1. **`../CLAUDE.md`** is the contract. Design freeze, permissions, testing
   rules. Nothing below it overrides it.
2. **`decisions/` and the top-level decision documents** are standing
   decisions. Dated, and each says what it supersedes.
3. **The numbered specs, `00-` to `20-`** describe the product. They are
   referenced by path in 82 source files, so **they are not moved or renamed**.
   Where a spec disagrees with a standing decision, the decision wins and the
   spec is stale.
4. **The `.docx` specifications and walkthroughs** are the original inputs.
   They are not maintained. Read them for intent, never for current truth.

## Known stale, do not act on

- `decisions/adr-002-react-native-expo.md` — superseded by
  `platform-decision.md`. There is no native app.
- `Fydr_-_Architecture_To-Do_List.md` — the archive. Full incident history and
  reasoning, worth reading; several statements now wrong. The working list is
  `architecture/to-do.md`.
- `access-matrix.md` — stale on the nutritionist's report access. The standing
  decision is narrower and has been made twice.
- Any document naming Apple Health, a native iOS app, a separate athlete
  codebase, or push notifications as on hold.

## Precedence, when two documents disagree

1. **The final board's `notes.md`** for anything visual or behavioural.
2. **The Claude Code build prompt** for build behaviour and order.
3. **The persona review** for what the app does today.
4. **The walkthrough** for flow structure.
5. **The spec** for original intent.

A standing decision in `decisions/` beats all five. If a board and the code
disagree about what exists, that is an "Open against code" item: report it, do
not design around it.

## Two habits that caught real problems

- **Measure, do not infer.** Read the rendered DOM, not the stylesheet. At
  least three walkthrough claims were wrong when measured.
- **Test with single-role users.** Seed accounts holding every role hid what a
  real coach can see, twice.

## Rules for writing documentation here

- One home per fact. A document copied into two places will drift, and has
  twice.
- A decision that supersedes another says so, with a date, in the new document.
  The old document gets a one-line banner and is not deleted.
- If the builder acts on it, it lives in the repo. Not in the Project, not in a
  chat message, not in a `.docx`.
