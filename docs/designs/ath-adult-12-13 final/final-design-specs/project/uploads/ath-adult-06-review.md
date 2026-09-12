# Persona review — ATH-ADULT-06, Rate a session: session not found

**Persona.** An athlete who tapped an RPE row that has gone stale — the session
was cancelled after they last opened the app, or they followed an old
notification — and now has to work out whether they have done something wrong.

**Reviewed 2026-09-10** against the running screen at **375×812**, signed in as a
real athlete (Conor Moroney) at `/rpe/00000000-0000-4000-8000-000000000000`,
plus `rpe/[sessionId]/page.tsx` and `lib/queries/training.ts`.

---

## The measured screen

| Element | Top | Height | |
|---|---|---|---|
| Sheet head — "✕", `h1` **"How hard was it?"**, 44px spacer | 0 | 98 | |
| `.empty` panel, centred, `rgb(239,243,251)` | 126 | 107 | `h2` 15px/700, `p` 13px `--muted` |
| — empty space — | 233 | **511** | |
| Tab bar | 744 | 58 | |

**Page height 812px — exactly one screen, no scroll.**

**Six interactive elements, one of them in the content:** "Skip to content", the
"✕" (44 × 44, `aria-label="Close"`, → `/today`), and the four tab links. The
`.empty` panel itself contains **no control at all**.

**The response is HTTP 200**, measured — not a 404. No branch of this page calls
`notFound()`.

---

## The thing this screen actually is

**It is an authorization boundary wearing an error message.** `training.ts`
resolves a session only when the athlete is genuinely a participant — named
individually or via a current group — so `null` covers four different cases at
once:

- the session never existed,
- it was cancelled,
- it belongs to another organisation,
- it exists in this organisation but this athlete was never scheduled into it.

That last one is the security case: the check was added because org_id + id
alone let any athlete in the org rate **any** session by editing the URL, and it
is the application half of a two-layer fix whose other half is the RLS policy in
migration 0046. The copy — "It may have been cancelled or is not one of yours" —
was written to cover all four without revealing which. The 200 status is
consistent with that: a 404 would confirm non-existence, and confirming
non-existence is exactly what this page must not do.

**This is the single most important constraint on any redesign of this screen,
and it points the opposite way to normal error-message advice.** A more helpful,
more specific message here is a worse screen, not a better one.

---

## 1. How many taps, and is any step redundant?

**One tap to leave**, and there is nothing else to do. Correct for a dead end.

**But the only in-content control is a dismiss.** The "✕" sits top-right at
44 × 44 and goes to `/today`. Inside the panel that explains the problem there
is no way forward at all — the athlete either finds the ✕, or uses the tab bar.
Nobody is trapped, but the screen never offers a next step; it only offers a way
to close.

**Its sibling empty state does offer one.** The already-rated card on this very
same page component ends with a "Back to today" link. Two empty states, same
file, same athlete, and only one of them tells you where to go.

---

## 2. Does any label or copy not match how this person thinks?

**The `h1` asks a question the page then refuses to let them answer.** The
heading is still **"How hard was it?"** — unchanged from the rating form —
directly above a panel reading "This session isn't there". The first line the
athlete reads asks them to rate something; the second says there is nothing to
rate. The page contradicts its own title.

**The body copy is genuinely good and should survive any redesign.** "It may
have been cancelled or is not one of yours. Nothing is lost — there is nothing
to rate." It is vague in exactly the way it has to be (above), and the second
sentence does real emotional work: an athlete who thinks they have missed a
required task is told plainly that they have not. That is the right instinct for
a screen most likely reached by someone worried they are in trouble.

**"Close" is a thinner `aria-label` than the same control gets elsewhere.**
Check-in uses `aria-label="Close the check-in"`; both RPE branches use bare
"Close". Minor, but the more specific version is better and already exists.

---

## 3. Where is a mistake most likely, and can it be undone?

**No mistake is possible here** — there is nothing to submit and nothing to
change. The screen is entirely safe, which is appropriate for a state reached by
accident.

The mistake has already happened upstream: the athlete tapped something that no
longer leads anywhere. Worth noting that **§0r makes this more likely to be
confusing than it needs to be** — every RPE row on Today reads "How hard was
it?" regardless of session, so an athlete who lands here cannot tell from memory
*which* session went missing.

---

## 4. Anything they must read that the screen could infer?

No — and it deliberately must not infer more. See above.

---

## 5. Is there a moment where it's unclear whether something worked?

**One, and it is the reason the h1 matters.** An athlete arriving at a heading
that says "How hard was it?" may reasonably spend a moment looking for the
rating control before reading the panel. On a screen that is 511px empty below
the message, the eye has nowhere else to go, so this resolves quickly — but the
question is asked before the answer that it cannot be answered.

---

## Summary for design

1. **The `h1` still reads "How hard was it?"** above a panel saying the session
   is not there. The page's title contradicts its own content.
2. **The panel contains no control.** The only in-content exit is the ✕ at
   top-right, a dismiss rather than a way forward — while the sibling
   already-rated state on the same page *does* offer "Back to today".
3. **511px of empty space** below a 107px panel.
4. **The vagueness is deliberate and load-bearing.** Any proposal that makes the
   message more specific breaks an authorization boundary.
5. **`aria-label="Close"`** could be the more specific form already used on
   check-in.

Right as it stands: the copy's reassurance ("Nothing is lost — there is nothing
to rate."); one screen, no scroll; a correct 44 × 44 dismiss; the tab bar
present so nobody is stranded; and a response that declines to confirm whether
the session exists.

---

## Claims checked against the running screen

| Walkthrough claim | Verdict |
|---|---|
| Reached at `/rpe/{id}` with an id that does not resolve **for this athlete** | **Correct**, and the phrasing is more precise than it looks — an id that resolves for someone else in the same org also lands here, by design |
| **"The screen shows the heading 'This session isn't there'"** | **Wrong element.** That is the `h2` inside `.empty`. The `h1` is "How hard was it?", unchanged from the rating form. |
| **"Interactive elements: the sheet dismiss '✕', and 'Back to today'."** | **Wrong.** There is **no "Back to today"** on this screen — measured, the string does not appear in the document. That link belongs to the page's *already-rated* branch. The real count is six: "Skip to content", "✕", and four tab links. |
| **"both controls lead to `/today`"** | **Wrong** — there is one in-content control, not two. The ✕ does lead to `/today`. |
| **End state.** Stays until dismissed | **Correct** |
| — | **Not documented:** the response is **HTTP 200**, not 404 — deliberate, since a 404 would confirm the session does not exist. |
| — | **Not documented:** this state is also what an athlete sees for a session that exists in their own org but that they were never scheduled into. That is the security case the check was built for. |

Recorded, not corrected in the walkthrough `.md`.
