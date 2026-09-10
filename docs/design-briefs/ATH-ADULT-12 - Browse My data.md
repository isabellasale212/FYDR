# Design brief — ATH-ADULT-12, Browse My data

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-12 — Browse My data

**Entry point.** The "My data" tab. Direct URL `/my-data`, or `/my-data?tab=…`.

**Steps.**

1. The screen loads on the Wellness tab, heading "My data".
   - Segment links, all three always visible: "Wellness", "Gym", "Tests".
     (Route keys are `wellness`, `gym`, `testing` — the **label** is "Tests" but
     the URL says `testing`.)
   - **Three segments, five destinations.** The segment control offers only
     Wellness / Gym / Tests, but `?tab=training` and `?tab=nutrition` are real
     views reached from cards further down the Wellness tab: "Sessions and RPE —
     what you trained and how hard it felt ›" and "Weekly check-ins — your
     nutrition answers, week by week ›". Neither has a segment.
   - Also visible **on the Wellness tab**: the period selector (a `<select>`
     defaulting to **"Last 28 days"**, with Today / Last 7 days / Last 28 days /
     This season / Last 365 days / All on record); a "Readiness" chart;
     "History"; a "See all {N} days →" link; and a flag notice when one exists.
   - **"Your tests" is on `?tab=testing`; the weekly check-ins are on
     `?tab=nutrition`.** An earlier version of this document listed all of them
     as visible on one screen, and listed a "Correct" link per week here —
     measured 2026-09-10, there is no "Correct" link on any My data tab.
2. Press a segment to switch tab; press "See all {N} {noun} →" to expand a list.

**Branches.**

- IF the athlete has hidden leaderboards (ATH-ADULT-18) THEN the leaderboard
  area is replaced by a gate offering "Show them again".
- IF a period has no data THEN an empty state renders in place of the chart.
- IF an entry was corrected THEN the row shows "What you reported:"; if the
  original falls outside the visible window it reads instead "What you first
  reported is older than the window shown here."

**End state.** Stays on `/my-data` with the tab in the URL.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-12-review.md`** — measurements,
findings, and every claim checked against the running screen. Read it first.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **Empty states must stay honest.** "Nothing logged yet" is shown because the
   window genuinely contains nothing; a proposal must not fabricate zeroes or
   silently widen the range without saying so.
2. **The period control's "Today" option keeps its explanatory label** — "Today
   — one day cannot show your usual range" — which explains the trap inside the
   control.
3. **Corrected entries must remain distinguishable from originals** where the
   app already does this (wellness). Gym does not yet (§0v).
4. **Nothing on this screen writes.**

## 5. What a proposal should address

1. **The segment control lists three of five destinations.** RPE and nutrition
   history have no segment and are reached from cards on the Wellness tab.
2. **Design for the athlete returning from a long absence.** Someone back from
   injury, an off-season or a loan spell opens My data, and the 28-day default
   shows "Nothing logged yet" over a real history sitting just outside it. The
   app knows the difference between *no data in this window* and *no data at
   all*; the screen currently says the same thing for both.

   **Scoping note:** this was surfaced by a review account whose sessions are
   dated August because seed dates drift as a database ages (**§0f**), not by a
   product fault — a weekly-training athlete would not hit it. Do not design for
   the seed; design for the returning athlete, who hits it for real.
