# Design brief — ATH-ADULT-06, Rate a session: session not found

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-10. Nothing here is aspirational.

**Read the constraint in §5.1 before anything else.** This screen looks like an
error state and is actually an authorization boundary. The usual advice — make
the error message more specific and more helpful — is the wrong advice here, and
following it would open a real information leak.

---

## 1. What exists now

**`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-06 - Rate a session: session not found.pdf`**
— captured cleanly; `CAPTURE-REPORT.md` records no problem with this flow.

Measured live at 375×812 signed in as a real athlete, at
`/rpe/00000000-0000-4000-8000-000000000000`.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-06 — Rate a session: session not found

**Entry point.** `/rpe/{sessionId}` with an id that does not resolve for this
athlete.

**Steps.**

1. The screen shows the heading "This session isn't there".
   - Interactive elements: the sheet dismiss "✕", and "Back to today".

**End state.** Stays until dismissed; both controls lead to `/today`.

---


**Three of the four claims above are wrong** — the heading, the controls, and
"both controls". See §6.4.

---

## 3. What the screen is made of

| Element | Top | Height | |
|---|---|---|---|
| Sheet head — "✕", `h1` **"How hard was it?"**, 44px spacer | 0 | 98 | |
| `.empty` panel, centred, `rgb(239,243,251)` | 126 | 107 | |
| — empty space — | 233 | **511** | |
| Tab bar | 744 | 58 | |

**Page height 812px — exactly one screen, no scroll.** **HTTP 200**, measured;
no branch calls `notFound()`.

**Six interactive elements, none of them inside the panel:** "Skip to content",
the ✕ (44 × 44, `aria-label="Close"`, → `/today`), and the four tab links.

**The copy, verbatim:**

> **This session isn't there**
> It may have been cancelled or is not one of yours. Nothing is lost — there is
> nothing to rate.

**Type:** `h2` 15px/700 `--text`; `p` 13px `--muted`.

---

## 4. Tokens in play

| Element | Current |
|---|---|
| Empty panel | `rgb(239,243,251)` |
| Heading | `--text` `#13161c`, 15px/700 |
| Body | `--muted` `#484e57`, 13px |
| Page ground | `--phone-bg` `#dbe7fb` |

**The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.**

---

## 5. The constraint any proposal must satisfy

1. **THE VAGUENESS IS LOAD-BEARING. Do not make this message more specific.**
   `training.ts` returns `null` for four different situations and the copy
   covers all of them on purpose:
   - the session never existed,
   - it was cancelled,
   - it belongs to another organisation,
   - **it exists in this organisation but this athlete was never scheduled into
     it.**

   The last is a real security case: org_id + id alone previously let any
   athlete in the org rate **any** session by editing the URL. This check is the
   application half of a two-layer fix whose other half is the RLS policy in
   migration 0046. A message that distinguishes "cancelled" from "not yours"
   tells a URL-editing athlete which session ids are real. **The HTTP 200 is
   part of the same decision** — a 404 would confirm non-existence.
2. **Nothing on this screen may confirm a session exists**, including through
   wording, status code, or a link that behaves differently in the four cases.
3. **The screen must stay safe.** There is nothing to submit and nothing to
   change; it is reached by accident and should stay incapable of causing harm.
4. **The tab bar stays in flow** (`position: static`, per the 2026-09-08
   decision).

---

## 6. Persona review

Full review: **`docs/walkthrough-reviews/ath-adult-06-review.md`**.

### 6.1 The `h1` asks a question the page refuses to answer

The heading is still **"How hard was it?"** — unchanged from the rating form —
directly above a panel reading "This session isn't there". The first line asks
the athlete to rate something; the second says there is nothing to rate. The
page contradicts its own title.

### 6.2 The panel has no control, while its sibling empty state does

The only in-content exit is the ✕ at top-right: a **dismiss**, not a way
forward. The already-rated card in the *same page component* ends with a "Back
to today" link. Two empty states, one file, one athlete — only one of them says
where to go. (The walkthrough claims this screen has that link. It does not.)

### 6.3 511px of empty space

The panel is 107px tall on an 812px screen with the tab bar at 744.

### 6.4 Document errors found, not yet corrected

- **The heading is the `h2`, not the page heading.** The `h1` is "How hard was
  it?".
- **There is no "Back to today" on this screen** — measured; the string does not
  appear in the document. It belongs to the already-rated branch.
- **"Both controls lead to /today"** — there is one in-content control.
- **Undocumented:** the HTTP 200, and that this is also the state for a session
  in the athlete's own org that they were never scheduled into.

### 6.5 What is right and should survive

The reassurance — "Nothing is lost — there is nothing to rate." — does real work
for someone who thinks they have missed a required task. One screen, no scroll,
a correct 44 × 44 dismiss, the tab bar present so nobody is stranded, and a
response that declines to confirm whether the session exists.

---

## 7. What a proposal should address

1. **Resolve the heading contradiction** — without naming the session, which
   would leak (§5.1).
2. **Give the panel a way forward**, matching the sibling already-rated card's
   "Back to today", so the athlete is offered a next step rather than only a
   dismiss. It must go to `/today` unconditionally in all four cases.
3. **Decide what to do with 511px of empty space** — including leaving it empty.
4. **Optionally** use the more specific `aria-label="Close the …"` form already
   used on check-in.

Not in scope: the body copy's wording, which is deliberately imprecise and
should not be "improved"; the status code; and anything that varies by *why* the
session did not resolve.
