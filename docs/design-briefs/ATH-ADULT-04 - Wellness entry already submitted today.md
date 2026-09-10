# Design brief — ATH-ADULT-04, Wellness entry: already submitted today

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**What this screen is for.** It is the confirmation surface for the whole
wellness flow. An athlete who cannot remember whether they checked in opens
`/check-in` and this answers them, with a timestamp. It is also where an
athlete who wants to change an answer finds out that they cannot.

---

## 1. What exists now

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-04 - Wellness entry: already submitted today.pdf`**
— cover plus 2 frames. `CAPTURE-REPORT.md` records no problem with this flow;
it captured cleanly.

Verified present before this brief was written, and the today-branch frame was
read out of it directly, because that branch could not be reached live (below).

**One branch was measured live, one was read from the capture.** The past-day
branches (`Already submitted` for 2026-08-16, `Nothing submitted` for
2026-08-13) were measured in the DOM signed in as Conor Moroney via
`/check-in?date=`. The **today** branch needs an athlete who has submitted
today — only Kai Mercer, Alex Grant and Ben Sullivan have, and reaching one of
their sessions means typing a password, which is out of scope. Its copy and
layout come from the captured frame; its two `href` values come from
`check-in/page.tsx`. Flagged so the distinction is not lost.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-04 — Wellness entry: already submitted today

**Entry point.** Opening `/check-in` when today's entry exists.

**Steps.**

1. The screen shows the heading "Already submitted" (or the date heading when
   viewing another day: "This morning" for today, otherwise the formatted date).
   - Interactive elements present: the sheet dismiss control "✕", and a "Back"
     link. No form, no submit button.

**Branches.**

- IF the requested date has no entry and is not today THEN the heading reads
  "Nothing submitted" instead.

**End state.** Stays on `/check-in`; "Back" returns to `/today`.

---


**Two claims in the above are wrong and one is incomplete** — see §6.4. Left
verbatim here so the document and the brief can be compared.

---

## 3. What the screen is made of

Measured in the live DOM at **375×812**.

| Element | Top | Size | |
|---|---|---|---|
| Sheet head — heading, subhead, "✕" | 0 | 82 | ✕ is **44 × 44** |
| Card — `h2.card-title` "Already submitted" | 110 | — | |
| "You sent {today's / {date}'s} check-in at {HH:MM}." | — | 13px `--muted` | |
| Correction paragraph, 40 words | — | 13px `--muted` | |
| **"Back"** | **289** | **28.6 × 19.5** | **under the 44px floor** |
| Tab bar — Today / My data / Gym / Me | 744 | 58 each | |

**Page height 812px — exactly one screen, no scroll.** The card ends around
309px, leaving **~435px empty** before the tab bar.

**Three states, one route.** `/check-in` renders:

| Condition | Heading | Card |
|---|---|---|
| Entry exists for the date | "This morning" (today) or e.g. "Sun 16 Aug" | "Already submitted" + time + correction paragraph |
| No entry, date **is** today | "This morning" | the full `CheckInForm` — this is ATH-ADULT-03 |
| No entry, date is **not** today | the formatted date | "Nothing submitted" — "No check-in was recorded for {date}, and a past day can't be filled in after the fact." |

A **future** date is clamped to today. Measured: `?date=2027-01-01` renders
"This morning" and the live form, not an error.

**`backHref` is shared by "Back" and "✕"** — `/today` when the date is today,
`/my-data?tab=wellness` otherwise. The two controls always agree with each
other.

---

## 4. Tokens in play

| Element | Current |
|---|---|
| Card surface | `--surf` `#fcfdfe` |
| Page ground | `--phone-bg` `#dbe7fb` |
| Card title | `--text` `#13161c`, 16px/800 |
| Body prose (`.import-sub`, `.cap`) | `--muted` `rgb(72,78,87)`, 13px/400 |
| Card radius | `--r-card` `18px` |
| Accent (**unused on this screen**) | `--accent` `#1f6fea` |

Global anchor reset: `a { color: inherit; text-decoration: none; }`. **There is
no `.cap a` rule in `base.css`** — this is why the "Back" link has no
appearance of its own.

**The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.** That file is the constraint list.

---

## 5. The constraint any proposal must satisfy

1. **No correction form, ever.** `wellness_entries` is ADR-005 immutable and
   `revise_wellness_entry` was made coach/medical-only by migration 0058. The
   `?correct=1` mode was removed for exactly this reason, and `page.tsx` records
   the decision: a control that can never become enabled for this reader is
   worse than a sentence naming who can act.
2. **The screen must state the time.** It is the fact that resolves the doubt
   that brought the athlete here.
3. **`backHref` must stay branch-aware.** Returning a past-day viewer to Today
   would strand them away from My Data, where they came from.
4. **The 44px floor applies to "Back".** It is currently 28.6 × 19.5.
5. **`.cap` is shared, but this flow no longer needs it touched.** The
   affordance defect is **fixed** (2026-09-10) by putting the existing
   `.linklike` class on this file's two "Back" links — not by adding a `.cap a`
   rule, which would also restyle `rpe/[sessionId]`'s already-rated card and
   `leaderboards/manage`'s inline prose link. **The ATH-ADULT-05 collision this
   brief first claimed does not exist**: the RPE rating form has no `.cap` link
   (measured). Any proposal that still wants a shared `.cap a` rule must flag it.
6. **The tab bar stays in flow.** `position: static`, per the recorded
   2026-09-08 decision — screens 01-12 of the reference draw a solid bar in
   flow, and document-scroll is the shell's model.

---

## 6. Persona review

Full review: **`docs/walkthrough-reviews/ath-adult-04-review.md`**.

### 6.1 "Back" had no affordance at all — fixed narrowly, sizing still open

Measured computed styles, link versus the paragraph beside it:

| | Colour | Size | Weight | Underline |
|---|---|---|---|---|
| "Back" | `rgb(72,78,87)` | 13px | 400 | none |
| Surrounding prose | `rgb(72,78,87)` | 13px | 400 | none |

Identical on every axis, at a **28.6 × 19.5px** target. The global `a` reset
strips colour and underline; `.cap` supplies the muted caption colour; no
`.cap a` rule exists to give it back. The card's only action is indistinguishable
from a sentence.

The ✕ in the same view is a correct **44 × 44** and goes to the same place, and
the tab bar is present, so nobody was stranded — but the screen's own stated way
out was the one that did not look like one.

**Fixed 2026-09-10, narrowly**: both "Back" links in `check-in/page.tsx` now use
the existing `.linklike` affordance. Measured after — `rgb(0,100,220)` / 600 /
underlined, **5.35:1** on `--surf`, prose unchanged. No new pattern, no shared
rule, one file.

**Still for design: the target is 28.9 × 19.5px** against the app's own 44px
floor. Sizing it changes layout, so it was not decided here.

### 6.2 The form's subhead renders on a screen with no form

The head still reads "45 seconds · **5 is always the best you can feel**". It
is rendered unconditionally, outside the `existing ?` branch. An athlete opening
this to check whether they submitted is told how long a task will take that they
cannot start, and given the rating-polarity rule for scales that are not there.

### 6.3 The rest, in short

- **The timestamp is the payload and is styled as an aside** — "You sent today's
  check-in at 12:37." sits as 13px muted prose beneath a bold title.
- **~435px of empty space** below the card on an 812px screen.
- **Correction status is not shown.** The paragraph explains that a corrected
  day is marked **Corrected** in My Data, but this screen does not say whether
  this entry has one, so an athlete who asked for a fix must go elsewhere to
  find out.
- **Good and worth keeping:** "Already submitted" as the first two words; the
  refusal to draw a correction form; the ✕ at a real 44 × 44; one viewport with
  no scroll; branch-aware `backHref`; and a correction paragraph that pre-empts
  the real fear — that asking for a fix looks like changing your answer.

### 6.4 Document errors found, not yet corrected

- **"'Back' returns to `/today`" is wrong** for the branch the document itself
  describes. It is `/today` only when the date is today; otherwise both "Back"
  and "✕" go to `/my-data?tab=wellness`. Measured on 2026-08-16.
- **The interactive-element list is incomplete** — seven elements, not two:
  "Skip to content", "✕", "Back", and the four tab links.
- **Step 1 omits the screen's entire content** — the submitted-at time and the
  40-word correction paragraph.
- **The future-date clamp is undocumented.**

Recorded for review rather than silently fixed, per the standing instruction.

---

## 7. What a proposal should address

1. **Give "Back" a 44px target.** Its affordance is already fixed (§6.1); the
   size is not, because changing it changes layout. `.cap` is shared with two
   other screens, so a shared rule must be flagged (§5.5).
2. **Stop the form's subhead appearing where there is no form**, or give this
   screen its own.
3. **Give the timestamp the weight of an answer**, since it is what the athlete
   opened the screen to get.
4. **Decide what to do with ~435px of empty space** — including the option of
   leaving it empty, which is a legitimate answer for a screen with one job.

Not in scope: adding any route to editing or correcting the entry (§5.1), and
the tab bar's position (§5.6).
