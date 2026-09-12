# Persona review — ATH-ADULT-03, Submit the morning wellness entry

**Persona.** An athlete on their own phone, first thing, half-awake, standing
in a kitchen, one hand. This is the task the app asks them to do *every single
morning*, and the screen's own subhead promises it in 45 seconds.

**Reviewed 2026-09-10** against the running screen at **375×812** and again at
**375×667** (iPhone SE / older 8-class handsets), signed in as a real athlete
with no entry yet for today (Conor Moroney), plus `CheckInForm.tsx`,
`ScaleInput.tsx`, `base.css` and `lib/outbox.ts`.

**Nothing was submitted to produce this review.** The form is pure local
`useState` until `onSubmit`, so the five scales could be answered and the
resulting layout measured without writing a row. The wellness entry is
one-shot per athlete per day and ADR-005 immutable; spending Conor's real
entry on a measurement was not an acceptable trade.

---

## The measured screen

Every number is read from the live DOM, not computed from the stylesheet.

| Element | Top | Height | |
|---|---|---|---|
| Sheet head — "This morning" + subhead + "✕" | 0 | 82 | |
| Sleep stepper — "−" / "7.0 hours" / "+" | 110 | 44 | pre-filled, already valid |
| Scale 1 — Sleep quality | 166 | 118 | |
| Scale 2 — Soreness | 295 | 118 | |
| Scale 3 — Fatigue | 425 | 118 | |
| Scale 4 — Mood | 554 | 118 | |
| Scale 5 — Stress | 684 | 118 | ends at **801** — clears the fold by **11px** |
| `<details>` "Add heart rate or weight" | ~830 | — | below the fold, collapsed |
| "Comment or injury issue (optional)" | ~900 | — | below the fold |
| **Submit button** | **1030** | 51 | **229px below the fold** |
| Immutability note | 1089 | 75 | **below the button** |

Page height **1,272px** on an 812px viewport — 1.57 screens.

**Tap target check.** Each scale option measures **55.3 × 44px** with 8px gaps —
the 44px floor is genuinely met, on the real screen, not just in the stylesheet.
An earlier measurement of mine read these as 1px tall; that was my selector
picking up the clipped `<label class="visually-hidden">` that carries the
"3, All right" screen-reader text, not the target. **There is no tap-target
defect here.** Recorded because the wrong number nearly went into this review.

---

## The defect this review found

**`.subm` is authored as a sticky footer and does not stick.** Not a design
opinion — a broken rule, reproduced and traced.

```
.subm        { position: sticky; bottom: 0; }   /* intent: pin to the viewport */
.phone-body  { flex: 1; min-height: 0; overflow-y: auto; }
.phone       { min-height: 100dvh; }            /* ← min-height, not height */
```

`min-height` lets `.phone` grow to its content (measured 1,272px), so
`.phone-body`'s `flex: 1; min-height: 0` is never bounded and its `overflow-y:
auto` pane never scrolls (`scrollHeight === clientHeight`, measured). The
**document** scrolls instead. But `position: sticky` resolves against the
nearest scroll container, which is `.phone-body` — a container that never
scrolls. The sticky is therefore inert.

**Proved by scrolling it, not by reading the CSS:**

| Document scroll | `.subm` top in viewport | |
|---|---|---|
| 0 | 1015 | |
| 200 | 815 | moved 1:1 with the scroll |
| 460 (page bottom) | 555 | |

A working `bottom: 0` sticky would have pinned at top ≤ 642 and never moved.
It moves exactly with the page: it is an ordinary static block.

**Blast radius: all four athlete write forms** — `CheckInForm`,
`RpeForm`, `NutritionCheckinForm`, `ProblemReportForm` all use `.subm`. This is
not an ATH-ADULT-03 detail; it is the athlete write-shell.

**The fix is one property on a shared rule** (`.phone` → `height: 100dvh` or
`max-height`, so the body pane scrolls internally). That is a change to the
shell every athlete screen renders inside, which is **well outside the scoped
freeze exception** — it would alter scrolling on every athlete screen at once,
not just the flow under review. **Flagged, not fixed.** Filed separately as an
architecture to-do.

---

## The second measured finding: the count is written in a colour you can't read

The progress counter lives in the **disabled** button's label, and the disabled
state is dimmed **twice**:

```
.subm .btn-primary:disabled  { opacity: var(--o-disabled); }        /* 0.45 */
.subm .btn-primary[disabled] { background: rgb(var(--accent-rgb) / 0.35); }
```

Both rules match, so a 35%-alpha accent fill is then composited at 45% opacity.
Measured from the rendered pixels, not computed from the tokens — screenshot
clipped to the button and sampled:

| State | Button fill | Label glyph | Contrast |
|---|---|---|---|
| Disabled — "Submit entry · 5 to go" | `rgb(221,230,250)` | `rgb(253,254,255)` | **1.24:1** |
| Enabled — "Submit entry" | `rgb(56,110,226)` | `rgb(255,255,255)` | **4.67:1** |

The label is 16px/700. The enabled state passes WCAG AA comfortably. The
disabled state is white-on-almost-white.

**This is not automatically a WCAG failure** — 1.4.3 exempts text that is part
of an inactive control, and strictly this button is inactive. But that
exemption assumes disabled means *nothing here needs reading*, and here the
opposite is true: the disabled label is the only place in the entire flow that
says how many answers are outstanding. The design is asking the athlete to read
the one string it has styled to be unreadable.

Worth noting the two rules were probably not intended to compound — either
alone would give a legible disabled state.

---

## 1. How many taps, and is any step redundant?

**Six taps and a scroll**, minimum: five scale taps, one scroll gesture, one
submit. Sleep defaults to 7.0 and is already valid, so the stepper is genuinely
optional — that is a good default and it earns its place at the top.

Nothing is redundant. The five scales are the entry; there is no confirm step,
no review screen, no "are you sure". For a daily task that restraint is right.

**But the scroll is not optional and it is not signposted.** At 375×812 the
five scales end at 801 and the fold is 812. The athlete answers all five
without ever scrolling — the screen looks, correctly, like the whole task fits.
Then the thing they need next is 229px below the last thing they can see, with
nothing at the fold suggesting there is more.

**At 375×667 it is worse in a more honest way**: only three of five scales are
above the fold, so the athlete is scrolling from the start and arrives at the
button naturally. The 812 case is the trap, because it *almost* fits.

---

## 2. Does any label or copy not match how this person thinks?

**The subhead is doing real work and is the best copy on the screen.**
"45 seconds · 5 is always the best you can feel" resolves the one genuine
ambiguity in the flow — that 5 means *no soreness* and *very relaxed*, not
*most soreness* and *most stressed*. Every scale also carries its own end
labels ("Very sore" → "No soreness"), so the rule is stated twice. Keep both.

**"This morning" is a heading, not a date**, and that is correct for the daily
case — but ATH-ADULT-04 notes the same screen renders a formatted date when
viewing another day. Nothing on this screen tells the athlete which one they
are looking at beyond the words themselves. For the daily path this is fine.

**The toast on arrival at `/today` reads "Wellness submitted · queued, syncs on
signal" unconditionally** — the same words on a perfect connection as on no
connection, because the outbox row is genuinely written before either network
call resolves, so it is literally true. It is still the phrase most likely to
be misread as *it hasn't sent yet* by someone who is not thinking about
outboxes. Worth a design look, but the copy is honest and the architecture
behind it is deliberate; this is a low-priority note, not a fault.

---

## 3. Where is a mistake most likely, and can it be undone?

**This is the screen where a mistake cannot be undone, and it is the screen
that says so least well.**

`training_entries`/`wellness_entries` are ADR-005 immutable. An athlete cannot
revise their own wellness entry — correction is staff-only
(`ENTRY_CORRECTION`: sport scientist, coach, medic). The screen does explain
this, in 40 words at 13px in `--muted` grey:

> "Once this is sent it can't be edited. If you get a number wrong, tell your
> coach — they can record a correction, and My Data will show you both what
> they changed it to and what you first reported."

That paragraph is **below the submit button** (note at y1089, button at y1030).
So the sequence for a half-awake athlete is: scroll past everything, find the
button, tap it — and the explanation of irreversibility is underneath the
control it applies to, read only by someone who scrolled *past* the button
without pressing it.

The content of the note is genuinely good — it names the recourse, names who
can do it, and promises the original stays visible in My Data. It is placed
where it cannot do its job.

**The likely mistake itself is a mis-tap on a scale**, and that one *is*
recoverable: tapping another option just changes local state, and the per-scale
readout updates. Before submit, everything is freely editable. The cliff is
exactly at the button.

---

## 4. Anything they must read that the screen could infer?

No. This screen asks for five subjective ratings that cannot be inferred, and
it pre-fills the one thing it can reasonably guess (7.0 hours' sleep). Heart
rate and body mass — the two values a wearable *could* supply — are correctly
tucked behind a collapsed `<details>` rather than asked for every morning.

The comment field was deliberately moved *out* of that disclosure (per
`CHANGELOG-athlete-app-edits.md`) and relabelled "Comment or injury issue
(optional)", on the reasoning that "something hurts" is the one thing an
athlete may need to say on any given morning and it should not be two taps
down. That reasoning is sound — but the field now sits at ~900px, below the
fold, on a screen whose primary control is also below the fold. An athlete who
woke up with a sore hamstring has to scroll past the button to find the place
to say so.

---

## 5. Is there a moment where it's unclear whether something worked?

**Yes, and this is the finding that matters most for the daily case.**

The transition from *incomplete* to *submittable* is expressed **entirely on the
button** — the label changes from "Submit entry · 5 to go" to "Submit entry",
and `disabled` clears. Measured: answering all five scales changes the label,
enables the control, **and scrolls nothing**. The page height does not change.
The athlete's view is identical before and after the form becomes valid.

So the aggregate progress counter — the "N to go" that the walkthrough document
correctly identifies as the *only* completion message in the flow ("there is no
error message; the count *is* the message") — lives on a control the athlete
cannot see while they are doing the counting.

What *is* visible is per-scale: each scale's readout goes from "not answered"
in amber to "3 of 5". That is good, and it means a careful athlete can audit
themselves. But it is five separate signals with no total, and the total exists
229px below the fold.

The combination of this and the broken sticky is the whole story of the screen:
**the control that tells you how far you have to go, and the control you press
when you get there, are the same control, and it is the one thing on the screen
you never see until you go looking for it.**

---

## Summary for design

1. **The sticky submit footer does not stick** — a real defect in `.subm` /
   `.phone`, affecting all four athlete write forms. Traced to
   `min-height: 100dvh` on a shell whose `overflow-y: auto` pane consequently
   never scrolls. Flagged, not fixed: it is a shared shell rule outside the
   scoped freeze exception.
2. **The primary action is 229px below the fold at 812, 414px at 667**, on a
   screen whose content otherwise fits almost exactly one viewport. The 812
   case is the dangerous one because the five scales clear the fold by 11px, so
   the screen looks complete when it is not.
3. **Completion is signalled only on the off-screen button.** Per-scale
   readouts are visible; the aggregate "N to go" is not. Consider surfacing
   progress where the answering happens.
4. **The disabled button's label measures 1.24:1 against its own fill**, because
   `:disabled` and `[disabled]` dim it twice and compound. That label is the
   flow's only outstanding-count. Enabled is 4.67:1 and fine.
5. **The immutability warning is below the button it warns about.** Good copy,
   wrong side of the control. This is the only irreversible action in the
   athlete app.
6. **The comment/injury field is below the fold**, despite having been
   deliberately promoted out of the disclosure precisely so it would be easy to
   reach.

Not faults, and worth preserving in any redesign: the 44px targets are real,
the double-stated polarity rule ("5 is always the best you can feel" plus
per-scale end labels) is genuinely helpful, sleep is sensibly pre-filled, and
the flow has no confirm step to slow down a daily task.

---

## Claims checked against the running screen

| Walkthrough claim | Verdict |
|---|---|
| Five scales, order sleep quality → soreness → fatigue → mood → stress | **Correct**, measured in DOM order |
| Options labelled "{step}, {word}" | **Correct** — e.g. "1, Very sore" … "5, No soreness" |
| Stepper `aria-label`s "Half an hour less/more sleep" | **Correct** |
| Button "Submit entry · {N} to go" when incomplete, disabled | **Correct**, observed both states |
| Button "Submit entry" when all five answered, enabled | **Correct**, observed on transition |
| Placeholder "Anything you want your coach or medical staff to know." | **Correct** |
| Network failure → outbox, deliberately silent | **Correct** — `lib/outbox.ts`, `enqueueWellness` before the network call resolves |
| End state `/today?submitted=1` → toast | **Correct** — "Wellness submitted · queued, syncs on signal" |
| Dismiss control "✕" | **Correct** — an `<a href="/today">`, `aria-label="Close the check-in"` |
| **"A sentence above the button states the entry cannot be edited"** | **Wrong twice.** It is **40 words in three sentences**, and it is **below** the button (note y1089, button y1030). |
| **Step 1's "also visible at this step" list** | **Incomplete.** Omits the `<details>` disclosure "Add heart rate or weight" and the two fields inside it ("Resting heart rate (bpm)", "Body mass (kg)"), the visible label "Comment or injury issue (optional)", the sleep readout "7.0 hours", and the per-scale readouts ("not answered" / "{N} of 5"). The document's own standard is every interactive element visible at each step. |

The two document errors are **left uncorrected in the walkthrough `.md`**,
recorded here for review rather than silently fixed.
