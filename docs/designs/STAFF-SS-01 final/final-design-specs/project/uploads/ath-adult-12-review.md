# Persona review — ATH-ADULT-12, Browse My data

**Persona.** An athlete looking back — usually for one thing: am I trending
better or worse, and did that session I did actually get recorded.

**Reviewed 2026-09-10** at **375×812** as a real athlete (Conor Moroney) across
all four reachable tabs and several periods.

---

## The measured screen

`h1` **"My data"**, page **1,304px** on an 812 viewport. Segment links
**"Wellness" / "Gym" / "Tests"** (route keys `wellness` / `gym` / `testing`).
Wellness tab carries a period `<select>`, a "Readiness" chart, "History", and a
"See all 28 days →" link.

**Period options:** "Today — one day cannot show your usual range", "Last 7
days", "Last 28 days", "This season · 2026/27", "Last 365 days", "All on
record". **The default is "Last 28 days"** (`month`), measured from the
`<select>` value.

---

## The findings

### 1. Three segments, five destinations

The segment control offers three tabs. Two more real views exist —
`?tab=training` and `?tab=nutrition` — reached only from cards partway down the
Wellness tab: "Sessions and RPE — what you trained and how hard it felt ›" and
"Weekly check-ins — your nutrition answers, week by week ›".

So an athlete looking for their RPE history or their nutrition answers must
first know to scroll the Wellness tab, and the segment control — the one thing
on screen that claims to enumerate what My data contains — lists three of five.
**Design finding**, not a defect: the cards are real and reachable.

### 2. The default period hides real history at a boundary

At the default 28 days, Conor's Gym tab reads **"Nothing logged yet"** and his
Nutrition tab **"Nothing answered yet"** — while at "This season" the Gym tab
shows two sessions. His complete sessions are 11 and 13 August; the review ran
on 10 September, so they sit just outside a 28-day window.

**The trigger here is seed drift, not a product fault.** Conor's sessions are
dated August because `seed.sql` authors dates as offsets from `current_date` and
the data has aged — §0f, which exists precisely so this does not resurface as a
surprise. A real athlete training weekly would never see this.

**What survives the seed explanation is a real question**: the empty state is
honest — the data genuinely is not in range — but "Nothing logged yet" reads as
*you have never done this*, not *not in the last 28 days*. That matters for the
athlete the default cannot serve: **one returning from a long absence** — injury,
off-season, a loan spell — for whom the 28-day window is empty and the history
they want to see is real and just outside it.

**This also corrects the capture report**, which recorded the default as
"Today". It is "Last 28 days"; the effect is similar but the boundary is not,
and a 28-day window is exactly the kind that looks like a full history while
hiding a session from 29 days ago.

### 3. There is no "Correct" link on any My data tab

Checked across all four. The ATH-ADULT-08 document lists `/my-data` as one of
two entry points into the nutrition correction flow, via "a 'Correct' link per
week". It does not exist. The only route is "Change this answer" on
`/nutrition-check-in`. **Corrected in the walkthrough.**

---

## 1. How many taps, and is any step redundant?

**One tap per tab**, and the segments are always visible. Reaching RPE or
nutrition history costs a scroll plus a tap on a card whose existence is not
advertised by the segments (finding 1).

## 2. Does any label or copy not match how this person thinks?

**"Tests" is labelled "Tests" and routed `testing`** — invisible to an athlete,
and correct in the document.

**"Today — one day cannot show your usual range"** is an unusually good option
label: it explains why the narrowest choice is rarely what you want, inside the
control, rather than leaving the athlete to discover an empty chart.

**"Nothing logged yet" is the wrong words for "nothing in this window"**
(finding 2). The same wording appears on the nutrition tab.

## 3. Where is a mistake most likely, and can it be undone?

**Nothing here writes**, so nothing can be got wrong. The available mistake is
one of belief — concluding you have no history when you have simply chosen a
narrow period — and it is fully undoable by widening the period, if the athlete
thinks to.

## 4. Anything they must read that the screen could infer?

**It could infer the period.** An athlete whose most recent session is 29 days
old is shown an empty tab at a default that cannot include it. Widening
automatically when a window is empty but data exists outside it would remove the
one real trap on this screen.

## 5. Is there a moment where it's unclear whether something worked?

**Yes — the empty state is indistinguishable from having no data at all.**
Nothing on the empty tab says "there is data outside this window", which is
precisely the case that produces it.

---

## Summary for design

1. **Three segments, five destinations** — RPE and nutrition history have no
   segment and are reached from cards on another tab.
2. **The athlete returning from a long absence** sees "Nothing logged yet" — copy
   that reads as *never* rather than *not lately* — because their history sits
   outside the 28-day default. (This surfaced via seed drift, §0f; the design
   question is the returning athlete, not the default.)
3. **No "Correct" link exists on My data** — the ATH-ADULT-08 entry point was
   documentation, not behaviour.
4. Right and worth keeping: the "Today — one day cannot show your usual range"
   option label, the always-visible segments, and honest empty states rather
   than fabricated zeroes.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| Loads on Wellness, heading "My data" | **Correct** |
| Three segments always visible, keys `wellness`/`gym`/`testing` | **Correct** |
| Period selector, "Readiness" chart, "History" | **Correct**, on the Wellness tab |
| "See all {N} {noun} →" | **Correct** — "See all 28 days →" |
| **"Sessions"; "Weekly check-in" with a "Correct" link per week; "Your tests" all visible** | **Wrong.** Those live on `?tab=training`, `?tab=nutrition` and `?tab=testing`; **no "Correct" link exists on any tab.** **Corrected.** |
| Empty state when a period has no data | **Correct** — "Nothing logged yet" / "Nothing answered yet" |
| Hidden-leaderboard gate | **Not verified** — needs ATH-ADULT-18 state |
| Corrected rows show "What you reported:" | **Not verified for wellness**; **does not happen for gym** (§0v) |
