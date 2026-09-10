# Persona review — ATH-ADULT-04, Wellness entry: already submitted today

**Persona.** An athlete who has already done their check-in and has opened it
again — usually because they cannot remember whether they did it, or because
they want to change an answer they have been thinking about since.

**Reviewed 2026-09-10.** The past-day branch was measured live at **375×812**
signed in as a real athlete (Conor Moroney, entry of 2026-08-16 via
`/check-in?date=`); the today branch was read from the captured frame in
`ATH-ADULT-04 - Wellness entry: already submitted today.pdf` and from
`check-in/page.tsx`. Both branches of the empty case were reached live.

**Why the today branch was not measured live.** Only Kai Mercer, Alex Grant and
Ben Sullivan have an entry for today on scratch, and reaching one of their
sessions needs a password typed into a sign-in form, which I do not do. The
captured PDF shows that exact state, so the copy and layout below are from a
real render — but the two `href` values in the today branch are read from source,
not clicked. Flagged rather than glossed.

---

## The measured screen

| Element | Top | Size | |
|---|---|---|---|
| Sheet head — date/"This morning", subhead, "✕" | 0 | 82 | ✕ is **44 × 44** |
| Card — "Already submitted" | 110 | — | |
| "You sent … at {HH:MM}" | — | 13px | the one fact the athlete came for |
| Correction paragraph (40 words) | — | 13px | |
| **"Back" link** | **289** | **28.6 × 19.5** | **below the 44px floor** |
| Tab bar — Today / My data / Gym / Me | 744 | 58 each | |

**Page height 812px — it fits exactly one screen, no scroll.** After the card
ends at ~309 there is roughly **435px of empty space** before the tab bar.

**Seven interactive elements**, not two: "Skip to content", "✕", "Back", and the
four tab links.

---

## The finding: the card's only action is invisible as an action

"Back" is styled **identically to the prose above it**. Measured, both:

| | Colour | Size | Weight | Underline |
|---|---|---|---|---|
| "Back" link | `rgb(72,78,87)` | 13px | 400 | none |
| Surrounding paragraph | `rgb(72,78,87)` | 13px | 400 | none |

Identical on every axis. There is no affordance of any kind — not colour, not
weight, not an underline — separating the control from the sentence beside it.

**Why, precisely.** The global reset is `a { color: inherit; text-decoration:
none; }`, so an anchor has no appearance of its own anywhere in this app; it
takes it from a class. `.cap` sets `font-size: var(--fs-13); color:
var(--muted)` — and **there is no `.cap a` rule anywhere in `base.css`**. So a
link dropped into a `.cap` inherits the caption's own colour and stays
undecorated. Confirmed by reading the rendered computed styles, not the source.

The target is **28.6 × 19.5px**. The ✕ in the same view is a correct 44 × 44.
So the screen has one properly-sized control and one under-sized one, and the
under-sized one is the only thing inside the card.

**Blast radius is small and worth stating**, because it decides whether this is
a local fix or a shared one: only three files put a link inside a `.cap` —
`check-in/page.tsx` (both branches), `rpe/[sessionId]/page.tsx`, and
`leaderboards/manage/page.tsx`. A `.cap a` rule would touch all three. Under the
serial rule that is a same-class collision and must be flagged before either
this flow or ATH-ADULT-05 (RPE) is built.

**Mitigating, and it matters:** the ✕ at 44 × 44 goes to exactly the same place
as "Back", and the tab bar is present and correctly sized. Nobody is trapped.
The cost is that the card's own stated way out is the one that does not look
like one.

---

## 1. How many taps, and is any step redundant?

**One tap to leave, and the screen exists only to be left.** There is no task
here. That is the right design — the alternative is a form that collects six
answers and then refuses them, which is what the removed `?correct=1` mode used
to do, and the comment in `page.tsx` records that decision.

**The screen is 46% empty.** The card ends around 309px on an 812px viewport
and the tab bar sits at 744. For a screen whose entire content is one fact and
one paragraph, that is defensible — but it is worth asking whether the fact the
athlete came for ("did I do it, and when") deserves more prominence than 13px
prose in the middle of a lot of nothing.

---

## 2. Does any label or copy not match how this person thinks?

**The subhead is wrong here and it is the same string as the form.** The head
still reads "45 seconds · **5 is always the best you can feel**" on a screen
where there is nothing to do in 45 seconds and no scale to rate. It is the
form's subhead, rendered unconditionally by `page.tsx` outside the
`existing ?` branch. An athlete opening this to check whether they submitted is
told, first, how long a task will take that they cannot start.

**"Already submitted" is exactly right** — it answers the question the athlete
opened the screen to ask, in two words, before anything else.

**The time is the useful detail and it is buried.** "You sent today's check-in
at 12:37." is the sentence that resolves the real doubt, and it is 13px muted
prose under a bold title. It could carry more weight than the paragraph
underneath it.

**The correction paragraph is good copy in the right place** — unlike
ATH-ADULT-03's, which sits below the button it warns about, this one is
genuinely informational and is placed where it will be read. It names the
recourse (tell your coach), says who can act, and promises the original stays
visible. It also pre-empts the real fear: that asking for a correction looks
like changing your answer.

---

## 3. Where is a mistake most likely, and can it be undone?

**There is no mistake available on this screen**, which is the point of it. The
athlete cannot submit, cannot edit, cannot delete. The only actions leave.

The one navigational surprise: **"Back" and "✕" do not always go to the same
place across branches.** `backHref` is `/today` when the date is today, and
`/my-data?tab=wellness` otherwise. Both controls use it, so they always agree
with each other — but an athlete who reached the past-day view from My Data is
returned to My Data, and one who opened today's is returned to Today. That is
correct behaviour, and it is the opposite of what the walkthrough document
claims (see below).

---

## 4. Anything they must read that the screen could infer?

No. Everything on the screen is either the answer to the question that brought
them ("you sent it, at this time") or the answer to the obvious follow-up
("can I change it — no, and here is who can").

The screen could arguably infer one more thing: whether the entry has *already*
been corrected by staff. The paragraph explains that My Data marks a corrected
day **Corrected**, but this screen does not say whether that has happened to
this entry. An athlete who asked their coach to fix something yesterday has to
go to My Data to find out whether it was done. Worth raising, not a defect.

---

## 5. Is there a moment where it's unclear whether something worked?

**No — and this screen is the reason ATH-ADULT-03's ambiguity is survivable.**
It is the confirmation surface for the whole wellness flow: an athlete who is
not sure their morning entry went through opens `/check-in` and gets an
unambiguous answer with a timestamp. It does its job.

The only residual uncertainty is the one in §4 — whether a requested correction
has landed — and that is a different question from whether the entry exists.

---

## Summary for design

1. **"Back" has no affordance at all** — identical colour, size, weight and
   decoration to the prose beside it, at a 28.6 × 19.5px target against the
   44px floor. Root cause is that `.cap` has no link rule and the global `a`
   reset removes colour and underline. Three files affected; same-class
   collision with ATH-ADULT-05.
2. **The form's subhead renders on a screen with no form.** "45 seconds · 5 is
   always the best you can feel" is unconditional and belongs to the task this
   screen exists to say you have already done.
3. **The timestamp is the payload and is styled as an aside.** "You sent today's
   check-in at 12:37." answers the question that brought the athlete here.
4. **~435px of empty space** below the card on an 812px screen.
5. **Consider surfacing correction status** — the screen explains that
   corrections get marked in My Data but not whether this entry has one.

Right as it stands and worth preserving: "Already submitted" as the first two
words; no fake correction form; the ✕ at a real 44 × 44; the whole screen in one
viewport with no scroll; and `backHref` returning the athlete to wherever they
actually came from.

---

## Claims checked against the running screen

| Walkthrough claim | Verdict |
|---|---|
| Heading "Already submitted" | **Correct** — `h2.card-title`, both branches |
| Date heading "This morning" today, formatted date otherwise | **Correct** — `h1.t`; measured "Sun 16 Aug", PDF shows "This morning" |
| No form, no submit button | **Correct** |
| IF the date has no entry and is not today THEN "Nothing submitted" | **Correct** — measured on 2026-08-13: "No check-in was recorded for Thu 13 Aug, and a past day can't be filled in after the fact." |
| Stays on `/check-in` | **Correct** |
| **"Interactive elements present: the sheet dismiss control '✕', and a 'Back' link."** | **Incomplete.** Seven interactive elements: "Skip to content", "✕", "Back", and the four tab-bar links (Today, My data, Gym, Me), all present and 58px tall. |
| **"'Back' returns to `/today`."** | **Wrong for the branch the document itself describes.** `backHref` is `/today` only when the date is today; for any other day both "Back" and "✕" go to `/my-data?tab=wellness`. Measured: both anchors read `/my-data?tab=wellness` on 2026-08-16. |
| Step 1's element list generally | **Omits** the submitted-at time ("You sent … at 12:37.") and the 40-word correction paragraph — the screen's entire content. |
| — | **Not documented at all:** a future date is clamped to today (`entryDate = requestedDate > today ? today : requestedDate`). **Measured**, not inferred: `?date=2027-01-01` renders the heading "This morning" and the live form with all five scales, rather than an error or an empty state. |

These are recorded, not yet corrected in the walkthrough `.md`.
