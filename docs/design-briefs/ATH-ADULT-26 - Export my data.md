# Design brief — ATH-ADULT-26, Export my data

**For Claude Design.** Everything below is the current state, measured on the
running application on 2026-09-11. Nothing here is aspirational.

---

## 1. The flow, verbatim from the walkthrough document

## ATH-ADULT-26 — Export my data

**Entry point.** "Me" → "Export my data CSV ›".

**Steps.**

1. Press "Export my data CSV ›" (a plain `<a>` to `/me/export`, not a client link).

**End state.** A CSV download of the athlete's own data. Verified 2026-09-11 by
fetching the endpoint: `200`, `Content-Type: text/csv; charset=utf-8`,
`Content-Disposition: attachment; filename="my-fydr-data-{athleteId}.csv"`,
93 lines, opening with a comment line — "# Your data, exported from Fydr.
Everything you submitted yourself: profile, wellness check-ins, training
ratings, gym s…". The filename carries the athlete's own id.

---


*Factual corrections from this pass are already applied above.*

---

## 2. Persona review

**Full review: `docs/walkthrough-reviews/ath-adult-23-to-26-review.md`** — covers
all four flows, with what was and was not exercised and why.

## 3. Tokens in play

The full palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`. That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

1. **A plain `<a>`, not a client-side link.** The browser must handle it as a
   download; a Next `<Link>` would try to route to it.
2. **The file's first line explains itself** — "# Your data, exported from
   Fydr. Everything you submitted yourself…" — and should keep doing so.
3. **`Content-Disposition: attachment`** with a filename; do not render the CSV
   inline.

## 5. What a proposal should address

1. **Nothing.** One tap, one correctly-headed file. If the "Me" screen as a
   whole is redesigned, this row keeps its "CSV" hint so the athlete knows what
   they will get before tapping.
