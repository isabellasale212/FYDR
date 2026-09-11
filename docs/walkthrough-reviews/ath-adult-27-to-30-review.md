# Persona review — ATH-ADULT-27 to -30

**Reviewed together** as the last four adult flows: one write to staff, two
read-only programme screens, and the offline-conflict notice.

**Reviewed 2026-09-11** at **375×812** as a real athlete (Conor Moroney).
**27 exercised locally without sending; 28 and 29 read-only; 30 from source** —
reasons below.

---

## What was and was not exercised

- **27** — every button state verified by typing into the form and clearing
  it; **nothing sent.** A report is an athlete's own words to medical staff,
  visible on the injury boundary, and the capture run already produced one
  (`ATH-ADULT-27w`) for another athlete.
- **28, 29** — read-only screens, measured.
- **30** — **not produced.** It needs a queued write whose slot is then filled
  by a *different* value from another path. That is producible on the review
  account with a nutrition check-in (the one athlete-correctable domain): queue
  answer A offline, submit answer B online, return to `/today`. It would leave
  Conor with a Week 36 answer he did not give. Reviewed from
  `OutboxFlusher.tsx` instead; ready to produce on your word.

---

## ATH-ADULT-27 — Report a problem to staff

**Measured.** `h1` "Report a problem". Three `aria-pressed` category chips at
44px, ungrouped. "What's going on?" — a 5-row textarea with a live "0/1000"
counter and **no `maxlength`**. "Send to staff", disabled until there is text.
"Your reports" beneath, empty for this athlete. "✕" → `/today`.

**Verified locally:** text → enabled and "4/1000"; 1,001 characters → disabled,
counter replaced by *"That is 1 characters over. Nothing has been cut — trim it
and it will send."*; exactly 1,000 → enabled; a chip toggles on and off with a
second press; cleared → disabled again.

**The copy that matters most is undocumented and right.** Above the form:
*"ⓘ Goes to your club's medical staff. Not a substitute for emergency care — if
this is urgent, contact emergency services or your GP."* Under the list:
*"Anything you send goes here, along with whether medical has seen it."* The
first tells the athlete who reads this and what it is not; the second tells them
they will know when it has been read. Both are **deliberate boundaries** and
both belong in the document — now recorded.

**Doc errors, corrected:** the nutrition check-in "Report a problem" entry point
does not exist (ATH-ADULT-07 measured that screen); the 1,000 limit, the counter
and the over-limit message were unrecorded. **One copy defect:** "1 characters"
(§0aa).

**The over-limit design is good.** No `maxlength` means the athlete's words are
never truncated on paste; the message says so explicitly; the button simply
waits. Keep it.

## ATH-ADULT-28 — View my gym programme

**Measured.** "My programme" / eyebrow "GYM · ACCUMULATION · WEEK 1" /
**"Pre-season strength" as a second `<h1>`** / "Sessions" with three rows
(Lower A, Upper B, Power — each with phase, week, day, and MD-n where set) /
"Nutrition targets" (Protein 190g, Carbohydrate 440g, "Your standing target.
Guidance only — nothing to log here.") / "Meal ideas ›" **once**. One screen.

**Two `h1`s** — §0aa. **"Meal ideas" renders once**, not twice; there is no
separate "Nutrition" section. Both corrected in the document.

**"Guidance only — nothing to log here."** is the right sentence for a target
the athlete cannot act on in-app. Keep it.

## ATH-ADULT-29 — View meal ideas

**Measured.** "Meal ideas", 1,752px. A "Back" button *and* a "My programme"
link — the two-back-controls pairing, now on a fourth athlete screen. Opening
copy: *"Portions below are scaled to your last recorded weight, 98.5 kg, on a
training day. Reference only — nothing here is logged or tracked."* Then, for a
club with no recipes of its own: *"Your club hasn't added its own recipes to
the library yet — these are the standard starting meal ideas everyone begins
with."* Meals by time from 07:00, with scaled portions.

**The finding: "your last recorded weight" is not the number the athlete
recorded.** It reads `body_composition` — the staff skinfold measurement, 98.5
kg — while `/me` shows "Body mass 106.0 kg · self-reported" from the athlete's
own wellness entries. Two sources by design, one sentence that hides the
distinction. An athlete who typed 106 this morning cannot tell which the app
believes. **§0aa** — a copy fix, not a data one; the two sources are a
deliberate trust distinction and the 7.5 kg gap is probably seed drift (§0f).

**"Your club hasn't added its own recipes…" is honest and should stay.**

## ATH-ADULT-30 — Discard an entry stuck in the offline queue

**From `OutboxFlusher.tsx`, rendered on `/today` only.** Three things the
document had wrong or missing:

1. **Pending writes ARE shown** — a `role="status"` line: *"☁ {n} entries are
   saved on this phone and will send when you have signal."* The document said
   nothing is shown. The *retry* is silent; the *count* is not.
2. **The conflict notice's copy**: *"One saved entry could not be sent: you
   already have {your check-in for {date} / your rating for {date} / your
   check-in for the week of {date}} from another tab or device, and that one is
   what is showing."* with "Discard this one" as a `.btn-ghost` inside it.
3. **How a conflict is decided.** On a duplicate-key error the flusher does a
   targeted lookup; a server row that *matches* the queued one is dropped
   silently as a delivered replay, and only a *differing* row is surfaced. So
   the notice means "two different answers for one slot", never "you pressed
   twice". That is exactly right, and it is why the earlier gym duplicate test
   (§0u) produced no notice.

**Gym sets are never surfaced.** Their branch assumes every duplicate is the
athlete's own replay and dequeues it as sent, no lookup — the code comment
calls the proper check "a reasonable follow-up". **§0aa.**

**The design here is good and worth saying so.** Retrying silently is right —
the athlete has done the thing. Surfacing only a genuine two-answers conflict,
with the other answer named and a one-tap discard, is the minimum that could
possibly work and it is what is built. The document just under-described it.

---

## Summary for design

1. **"Your last recorded weight" does not say whose record.** *(29 — §0aa, copy.)*
2. **Two `h1`s on `/programme`.** *(28 — §0aa.)*
3. **"1 characters over".** *(27 — §0aa.)*
4. **Gym offline duplicates silently discarded.** *(30 — §0aa, acknowledged in code.)*
5. **Two back controls on `/programme/nutrition`** — fourth athlete screen with
   the pairing. *(29 — design; §0y carries the guard gap.)*
6. Right and worth keeping: the emergency-care line and "whether medical has
   seen it"; no `maxlength` with an honest over-limit message; "Guidance only —
   nothing to log here."; the club-has-no-recipes disclosure; and the whole
   conflict design on `/today`.

---

## Claims checked against the running screen

| Claim | Verdict |
|---|---|
| **27: nutrition check-in "Report a problem" link** | **Wrong — does not exist.** Corrected. |
| 27: three chips, second press clears | **Correct** |
| 27: `id="report-body"`, label "What's going on?" | **Correct** |
| 27: "Send to staff" disabled when empty or over limit | **Correct** — limit is 1,000, verified at 4 / 1,000 / 1,001 |
| 27: "Sending…", toast with "Dismiss", report under "Your reports" | **Not verified** — not sent |
| 27: "✕" → `/today` | **Correct** |
| **28: "Meal ideas ›" in two places** | **Wrong — once.** Corrected. |
| **28: a "Nutrition" section** | **Wrong — "Nutrition targets" only.** Corrected. |
| 28: "My programme", programme name, "Sessions" | **Correct** — programme name is a second `h1` |
| 28: empty state when no programme | **Not verified** — this athlete has one |
| 29: "Meal ideas", "My programme" back link | **Correct**, plus an unlisted "Back" button. Corrected. |
| **30: merely-queued writes not shown** | **Wrong — a pending count is shown.** Corrected. |
| 30: `role="alert"` notice, "Discard this one" | **Correct** in source; copy now recorded |
| 30: a conflict is the one surfaced outcome | **Correct** — for wellness, RPE, nutrition; **gym never surfaces**. Corrected. |
