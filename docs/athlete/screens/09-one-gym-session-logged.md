# One logged gym session

## 1. Where it sits

Reached from the gym region of My data. Route
`/my-data/gym/[gymSessionLogId]`.

## 2. Who reaches it and when

An athlete looking at a session they logged. Added to fill a gap My data's own
header comment named as missing.

## 3. What you see

An eyebrow above the heading — "Gym · Lower A · complete" (ATH-ADULT-13 C1,
12 September 2026): the domain, the programme session's name through the
athlete-safe RPC, and the log's status in a word. The date as the heading,
with a "Corrected" pill beside it when any set has a prior revision (§0v); the
gym history list's row carries the same pill (C3), off the live sets'
`revision_of`. Then, since ATH-ADULT-13 (12 September 2026), **a two-up
hero card**: "Total volume" — the live sets' tonnage as a 48px figure with "kg"
as its unit, over "N sets across M exercises" (or "N sets · recomputed after a
correction" when a set was revised; true, because 0045's `revise_gym_set_log`
recomputes the stored total from live sets and this page sums live sets) — and
"Session RPE" over "as you rated it". A session with no load on any set reads
**"Not logged"** in the tonnage slot; an unrated session reads **"Not rated"**.
The one-line summary the page always had ("6 sets logged · session RPE 6.0 ·
3240 kg total") is kept beneath the card.

Then the sets logged in that session, as a table: set number, exercise, reps,
load, and a "Correct" button per row. **An absent reps or load reads "Not
logged"**, never a dash and never a zero. Beneath the table: "A correction keeps
the original. Corrections stay open on a finished session."

When a set was corrected, the "What you reported" card opens with "Set 1 was
corrected on Fri 14 Aug. Both values are kept on record." (C3 — the date is the
correction row's own `logged_at`) and lists each corrected set's prior values
in words ("8 reps at 100 kg → now 8 reps at 102.5 kg"; "8 reps, load not
logged" when a value was absent).

## 4. What the athlete enters here

Nothing. Read only.

## 5. Every number shown

Weights and repetitions as logged. **No metric ID: these are the raw entries, not
a computed metric.**

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Back to gym history | Footer, full width, sticky | Returns to the gym tab | `/my-data?tab=gym` | nothing | no | never |
| Correct | Each set row | Opens the inline correction (reps, load; Save / Cancel) | stays | `revise_gym_set_log` | no | while another row is being corrected |

**One way back.** The shell's own Back button stands down on this route
(`BackButton`'s `SELF_DISMISSING`), so the footer button is the only back
control — the board draws one, and §0w's third item recorded the pair as this
flow's redundancy question. The footer button is the secondary (`.btn-ghost`):
the primary is reserved for a future Save correction.

## 7. Offline and sync

Read only.

## 8. Notifications

None.

## 9. Permissions

None.

## 10. States

Loading, **not found**, error.

**The not found state is a security decision, not an oversight.**
`fetchGymSessionLog` reads `gym_session_logs_current`, which is RLS self only, so
another athlete's id produces exactly the same "not found" as a missing row
**rather than a 403**. A 403 would confirm the row exists.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy. Thumb reach is acceptable:
primary actions sit low.

## 12. Open issues

None found.

## 13. What the 12 September pass (ATH-ADULT-13) changed, and what it recorded

Built from the "ATH-ADULT-12-13 · FINAL" board, A items only; the record with a
recommendation per item is `docs/overnight-records-2026-09-12.md`:

- **One way back** (§6): a full-width "Back to gym history" in a sticky footer
  replaces the 15px text link, and the shell's Back stands down here.
- **The summary line is the hero** (§3): tonnage and session RPE at the My data
  hero size (`.rd-value`, 48px), each over its derivation; the original line
  kept beneath.
- **"N sets · recomputed after a correction"** when a set was revised.
- **Absent values are words** — "Not logged" in the cells and in "What you
  reported"; "Not rated" for a missing session RPE.
- **The footer note** is the board's two sentences.

Built later the same day: the eyebrow (C1) and the history list's "Corrected"
pill with the dated sentence on the detail (C3). Recorded, not built: tapping a
row to correct with the logger's panel and a Save correction / Cancel footer
(C2, with 09 C1); the per-row "Corrected · was 100 kg × 8" marker (D1, folds
the card once C2 lands; the 3px bar is declined); "4 of 6 shown" on a small
phone and no tab bar on this screen (both declined). §0v's "What you reported"
card stays as built.
