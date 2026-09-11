# Design brief — ATH-ADULT-27, Report a problem to staff

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-27 — Report a problem to staff

**Entry point.** Two places:
- "Me" → "Report a problem ›".
- Direct URL `/report-problem`.
- ~~The nutrition check-in form's "Report a problem" link~~ — **does not exist.**
  Measured on `/nutrition-check-in` 2026-09-10 (ATH-ADULT-07): no such link.

**Steps.**

1. Optionally press a category chip: "Injury or pain", "Wellbeing", "Something
   else". Pressing the selected chip again clears it.
2. Type into the body field (`id="report-body"`, label "What's going on?",
   5 rows, **1,000-character limit** shown as a live "{n}/1000" counter). The
   textarea has no `maxlength`; over the limit the counter is replaced by
   "That is {n} characters over. Nothing has been cut — trim it and it will
   send." and the button disables. At exactly 1,000 it still sends.
   - Above the form: an `ⓘ` line — **"Goes to your club's medical staff. Not a
     substitute for emergency care — if this is urgent, contact emergency
     services or your GP."** Under "Your reports": "Anything you send goes
     here, along with whether medical has seen it."
   - The three category chips are `aria-pressed` toggles at 44px, ungrouped.
3. Press the send button.

**Send button states.**

| Label | When |
|---|---|
| "Send to staff" | Default. |
| "Sending…" | In flight. |
| Disabled | Body empty or over the character limit. |

**Branches.**

- Category is optional; the body is not.
- IF the body exceeds the limit THEN the button is disabled.

**End state.** Stays on `/report-problem`; the report appears under "Your
reports" and a toast with "Dismiss" confirms. Also visible throughout: the "✕"
dismiss → `/today`.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-27-to-30-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **The emergency-care line stays, above the form, verbatim in substance** —
   who reads this, and that it is not emergency care. An athlete in real
   trouble must read it before typing.
2. **No `maxlength`.** The athlete's words are never truncated; the button
   waits. Keep the over-limit message's "Nothing has been cut".
3. **"Your reports" keeps showing whether medical has seen each one.**
4. **The category is optional; the body is not.**

## 5. What a proposal should address

1. **Group the three category chips** so they announce as one choice.
2. **The unverified sent state** — "Sending…", the toast, the report appearing
   under "Your reports" — was not exercised. Do not assume it.

Out of scope: "1 characters" (§0aa, build work).
