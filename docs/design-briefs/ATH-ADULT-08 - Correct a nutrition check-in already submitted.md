# Design brief — ATH-ADULT-08, Correct a nutrition check-in already submitted

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-08 — Correct a nutrition check-in already submitted

**Entry point.** Two places, both real:
- `/nutrition-check-in` when the week already has an answer — the screen shows
  "Change this answer".
- `/my-data` on the nutrition summary — a "Correct" link per week, going to
  `/nutrition-check-in?week={week_start}`.

**Steps.**

1. Press "Change this answer" (or "Correct" from My data).
2. Choose a different chip: "Yes", "Roughly", "No".
3. Press "Done".

**Branches.**

- IF the athlete is not the owner of the check-in THEN the RPC refuses with
  `not_permitted`. There is **no staff write path to this table at all** — a
  coach cannot answer or change a check-in on an athlete's behalf.
- IF the original was already superseded THEN the RPC refuses with
  `entry_not_revisable` — the revision chain stays linear.

**End state.** Back to `/today` or `/my-data`. A new revision row is written and
the old one marked superseded; an `entry_revision.created` audit event is
recorded naming what changed. **The note's text is never recorded** — only its
length before and after.

---


*(Corrections from this pass are already applied above where they were
factual; see §3 of the review for what changed.)*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-08-review.md`** — it carries
the measurements, the findings, and the claims checked against the running
screen. Read it before proposing anything.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **This is the only entry an athlete can correct themselves.** There is no
   staff write path to this table at all. Do not add one, and do not make the
   correction harder to find.
2. **The revision chain stays linear.** A second correction is refused with
   `entry_not_revisable`; the original is kept, never overwritten.
3. **The note's text is never recorded**, only its length before and after —
   migration `0100`. Nothing in a proposal may surface note text into the audit.
4. **The previous answer must arrive pre-selected.** It shows what is being
   changed *from*.
5. **The entrance link is fixed but not sized.** `.linklike` is applied; the
   target is 19.5px against the 44px floor, and sizing it changes layout.

## 5. What a proposal should address

1. **Size the "Change this answer" target** to the 44px floor.
2. **Fix "this week"** in the `ⓘ` banner (§0u).
3. **Consider warning before a second correction**, which will be refused.

Not in scope: the revision model, and the wording of the revision explanation,
which is unusually honest and should stay.
