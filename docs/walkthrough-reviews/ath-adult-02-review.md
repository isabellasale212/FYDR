# Persona review — ATH-ADULT-02, Land on Today and read what is outstanding

**Persona.** An athlete on their own phone, tired after training, standing up,
one hand. Not at a desk, not reviewing UI, not patient.

**Reviewed 2026-09-10** against the running screen at **375×812**, signed in as a
real athlete with a **populated** to-do list (Conor Moroney, three outstanding),
plus `today/page.tsx` and `lib/queries/compliance.ts`.

**Why a second account was needed.** The obvious session — Alex Grant — had had
his wellness, RPE and check-in submitted by the walkthrough captures earlier the
same day, so his Today reads "You're up to date". That is ATH-ADULT-32, a
different flow. Reviewing it and calling it this one would have been the same
substitution that put two wrong claims in the ATH-ADULT-01 brief.

---

## The measured screen

Every number below is read from the live DOM, not computed from the stylesheet.

| Element | Top | Height | |
|---|---|---|---|
| Header, date, greeting | 0 | 109 | |
| **"THIS WEEK" strip** | 137 | **285** | **35% of the viewport** |
| Availability banner | 450 | 83 | 133 when unavailable with a note |
| **"To do" heading** | **561** | 23 | |
| Row 1 — Wellness | 593 | 82 | fully visible |
| Row 2 — RPE | 676 | 82 | fully visible |
| Row 3 — Weekly check-in | 759 | 100 | **cut off at the 812 fold** |
| "TODAY" sessions | 889 | 104 | below the fold |

Page height **1,079px** — 1.33 screens. **Two of three to-do rows are fully
visible.**

---

## 1. How many taps, and is any step redundant?

**Landing costs nothing** — the screen is the destination. Starting a task is
**one tap** on a row, and the rows are 82–100px tall, roughly twice the 44px
minimum, which is right for a tired thumb.

**But the third task costs a scroll first.** With three outstanding, the last
row is cut by the fold. The count says "3 left" while two are reachable.

**Nothing is redundant in the actions.** The redundancy is above them: **285px of
"THIS WEEK" strip containing zero interactive elements** — verified, not
inferred: there is no link, button or handler inside `.wk-card`. It is the
largest single object on the screen and the person cannot act on any part of it.
Together with the header and banner, **561px of an 812px screen is consumed
before the first thing they can do.**

---

## 2. Does any label or copy not match how this person thinks?

**"How hard was it?" is a question where a name should be** — and this is a
defect, not a preference. `today/page.tsx` carries a comment stating that the
session's own name is used for an RPE row: *"The SESSION's name is the title for
an RPE task — 'Team run', not 'Training'"*. **It is not.**
`lib/queries/compliance.ts:144` sets `label: 'How hard was it?'` as a fixed
string. The `session_id` is carried on the row and its name is never looked up.

So an athlete with two sessions to rate sees two identical rows reading "How hard
was it?", with nothing to tell them apart — precisely the failure the comment
says was fixed. The walkthrough document repeated the comment's claim.

**"45 seconds" and "20 seconds" are the best copy on the screen.** They answer
the only question a tired person is really asking — *how long is this going to
take* — and they are the reason a to-do row is tappable rather than avoidable.

**"To do" and "3 left" are plain and right.** Nobody has to decode them.

---

## 3. Where is a mistake most likely, and can it be undone?

**This screen writes nothing, so there is no mistake to make on it.** The risk is
different: **an item is missed rather than mistaken.**

The count says "3 left" and two are on screen. A person who taps the two they can
see, finishes them, and puts the phone away has done what the visible screen
asked. The third — the weekly check-in — is the one most easily lost, and it is
also the one whose window is longest, so nothing chases it that day.

**Nothing here is permanent or silent.** Every task remains outstanding until
done, and the count is the recovery mechanism. But the count is a number the
person has to reconcile against what they can see, which is work the screen is
asking them to do.

---

## 4. Anything they must read that the screen could infer?

**The week strip, at 285px, is the clearest case.** It shows the seven days with
their MD offsets. On the day itself, the athlete is standing in it. The one part
that is genuinely about *today* — the matchday offset — is **already in the
header**, at y=0, as "THU 10 SEPT · MD-2".

**The availability banner grows exactly when it should shrink.** Measured: 83px
when it reads "Available / Everything is on."; **133px** when it carries a status,
a reason and a note. So an athlete who is unavailable — who has more to absorb
and often less patience — is pushed **50px further** from the things they can act
on. The screen spends the most space on the person with the least appetite for
it.

---

## 5. Is there a moment where it's unclear whether something worked?

**Not on this screen, and that is a real strength.** The to-do list *is* the
status: a completed task leaves it, and the count drops. There is no separate
confirmation to hunt for, and returning from a task shows the list already
changed, with a toast.

**The one soft spot is the empty state.** When everything is done the list is
replaced by "You're up to date. / Nothing expected of you today is outstanding."
That is unambiguous — but it occupies the same slot as the list, so a person
returning mid-morning sees a *differently shaped* screen and has to read it to
learn nothing is wrong. A quieter confirmation in the same shape as the list
would be read faster. Minor.

---

## Summary for design

| # | Finding | Weight |
|---|---|---|
| 1 | **561px of an 812px screen** before the first actionable element; the 285px week strip has **zero** interactive elements | **Highest** |
| 2 | With three outstanding, **only two rows are fully visible**; "3 left" is a count the person must reconcile against what they can see | **High** |
| 3 | RPE rows read **"How hard was it?"**, a fixed string — two sessions to rate produce two identical rows. The source comment claims the session name is used; it is not | **High** — a defect, not a preference |
| 4 | The availability banner is **50px taller** when the news is bad, pushing actions further away from the person least able to hunt for them | Medium |
| 5 | Empty state changes the shape of the screen rather than the content of the list | Low |

**Protect in any redesign:** 82–100px row targets; "45 seconds" / "20 seconds",
which is the copy that makes the tasks feel small; the greeting's genuine
time-of-day awareness in the **organisation's** timezone; and the fact that the
list is its own status, so nothing needs confirming.

---

## Claims checked against the running screen

Four claims in the walkthrough document were tested rather than trusted.

| Claim | Verdict |
|---|---|
| Greeting is time-of-day aware in the org timezone | **True** — `Morning` <12, `Afternoon` <18, `Evening`, formatted in the org zone |
| No Due/Optional pill on rows | **True** |
| Cancelled sessions render at 55% opacity | **True, and incomplete** — the name is also struck through, which the document omits |
| An RPE row shows the session's own name | **False** — a fixed "How hard was it?" |
