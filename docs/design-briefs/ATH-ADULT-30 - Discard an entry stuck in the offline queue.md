# Design brief — ATH-ADULT-30, Discard an entry stuck in the offline queue

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-30 — Discard an entry stuck in the offline queue

**Entry point.** `/today`, when a queued write has failed in a way that will
never succeed (a conflict). `OutboxFlusher` is rendered on `/today` **only** —
which is why every domain's outbox retries from there and nowhere else.

**Merely-waiting writes ARE shown**, contrary to an earlier version of this
document: a `role="status"` line reads "☁ {n} entries are saved on this phone
and will send when you have signal." (singular: "entry is"). What is *not*
shown is a retry — that happens silently on the next `/today` load.

**Steps.**

1. A `role="alert"` notice names the stuck entry: **"One saved entry could not
   be sent: you already have {label} from another tab or device, and that one is
   what is showing."** — where the label is "your check-in for {date}",
   "your rating for {date}" or "your check-in for the week of {date}".
2. Press "Discard this one" (a `.btn-ghost` inside the notice).

**How a conflict is decided.** On a duplicate-key error the flusher does a
targeted lookup: if the row already on the server matches what was queued, the
queued copy is dropped silently as a delivered replay; only if it *differs* is
it marked a conflict and surfaced. So the notice means "two different answers
for the same slot", never "you pressed twice".

**Gym sets are never surfaced.** Their branch assumes any duplicate is the
athlete's own replay and dequeues it as sent, with no lookup — the code's own
comment calls the proper check "a reasonable follow-up but a separate,
out-of-scope change". A set logged offline with different numbers from one that
later landed in the same slot is discarded without notice.

**Branches.**

- IF the write is merely queued (offline, retryable) THEN the "☁ saved on this
  phone" status line shows, and it is retried on the next `/today` load. The
  *retry* is silent; the *count* is not.
- A conflict is **the one queued-write outcome that is surfaced**.

**End state.** The queued item is removed; the entry is not submitted.

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

1. **Retry stays silent; only a genuine conflict is surfaced.** The athlete has
   done the thing; a notice for every queued write would train them to ignore
   notices.
2. **A conflict means two different answers for one slot** — never a double
   press. The notice must keep naming the *other* answer ("you already have your
   check-in for {date} from another tab or device") so the athlete can tell
   which is showing.
3. **"Discard this one" stays one tap**, and discarding must never touch the
   server row that won.
4. **The pending count stays** — "saved on this phone and will send when you
   have signal" is the right reassurance and is already built.

## 5. What a proposal should address

1. **Nothing in the design.** This is the best-reasoned piece of offline UX in
   the athlete app and the document simply under-described it. The gym branch's
   silent discard is a defect (§0aa), not a design question.
