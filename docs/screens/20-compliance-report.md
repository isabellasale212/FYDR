# 20. Compliance report

## 1. Page name and URL

**Compliance**, at `/reports/compliance`.

Who has submitted what was expected of them, and who has not. It answers "how
much of the picture do I actually have", which is a different question from "how
is the squad doing".

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. Exports only | None | Base | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Everything | Nothing. Exports only | None | Base | Same |
| Medic | Yes | Everything | Nothing. Exports only | None | Base | Same |
| S&C | Yes | Everything | Nothing | None | Base | **NOT BUILT** |
| Nutritionist | Yes | Everything | Nothing | None | Base | **NOT BUILT.** Compliance carries no injury information, so the nutritionist keeps this report in full |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**This is one of the two reports a nutritionist keeps.** Nothing on it is injury
or medical information.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/compliance/page.tsx:65`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The Compliance card on the reports hub.
- The Compliance link on the dashboard's Outstanding entries card.
- `/compliance`, an older address that redirects here.

---

## 4. What you see

**The header is one template shared by all five reports** (and specified in
`CHANGELOG-headers-spec.md`). Five rows, always in this order:

1. **Back**, a pill at the top left, to the screen you came from.
2. **The group chips**, Whole squad first with a tick when it is active, then
   the club's own groups. The filter sits above everything now rather than over
   the table, which is the truth: it scopes every number on the screen.
3. **The eyebrow**, where the screen has one, on the left with the **actions**
   on the right.
4. **The title**.
5. **The scope subheading**, directly under the title: who this report covers,
   over what window, and how many athletes. It sits **below** the title rather
   than above it, which is a deliberate change from the canvas: a qualifier
   read before the thing it qualifies is just a string of words.
6. **The tabs** on the left with the **period control** on the right, so the
   control that scopes every tab rides the tab row rather than a row of its own.

**The gap from the header to whatever the screen puts first is 20px on every
one of the six**, set once on the header rather than on each screen's first
block, so they are equal by construction rather than by six numbers agreeing.

**The squad mean**, the headline share of expected entries received.

**Under half**, naming the athletes whose submission rate has fallen below fifty
percent. This is the actionable part: a mean tells you the weather, a list tells
you who to speak to.

**Waived days**, days that were not counted against anybody. A waived day is not
non compliance and must never be presented as such.

**Last entry**, per athlete, so an athlete who has gone quiet is visible even when
their percentage looks survivable.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-012 | Squad mean | Share of expected entries that arrived | The chosen period | **Empty, not zero**, when nothing was expected. Nobody expected is not the same as nobody complying |
| MET-012 | Under half | Athletes below fifty percent | The chosen period | An empty list is a good outcome and says so |
| None | Waived days | Days deliberately not counted | The chosen period | Zero is a real answer |
| None | Last entry | When this athlete last entered anything — a late RPE included | Looks back beyond the period on purpose | Says the athlete has never submitted, rather than showing a blank |

**Waived days are a count, not a metric**, and they exist to stop the mean lying.
A day nobody was expected to submit on, a rest day for instance, would otherwise
drag every percentage down.

**An RPE counts only if it was submitted in time** — §0ad, decided 2026-09-12.
"In time" is before the end of the following club-local day: the instant the
RPE screen stops accepting a rating and Today's row disappears, `rpeClosesAt` in
`src/lib/rpeDue.ts`, read by all three so they cannot disagree. A rating entered
later — when the coach chased, a week on — is a **miss** for the count, and still
an entry for the **Last entry** column, because "3 weeks ago" beside a rating
made yesterday would be false. Two details a reader of the number should know:

- The time judged is the **athlete's original submission**. A staff correction
  is a new revision stamped with the correction's own time; the report reads the
  original row (`training_entries`, `revision_of` null), so correcting an
  on-time rating a week later does not turn it into a miss.
- Each RPE expectation names a **session**, and is matched to the rating for
  that session. Before this an athlete with a morning and an afternoon session
  who rated one was credited with both.

A session the report cannot find any more (removed after its expectation was
generated) has no window to judge against, so a rating for it counts. Wellness
and gym are unchanged: an entry on the day counts.

**A rating made offline is judged by when it was made.** The athlete app's
outbox sends the time it queued the rating, and the database keeps it as
`submitted_at` when it is earlier than the arrival time and within 24 hours of
it (migration 0105) — so a rating made in time with no signal does not become a
miss when the phone reconnects the next day, and a phone's clock cannot move a
rating more than a day, or forwards at all. The athlete report's own compliance
figure reads the same classifier (`fetchAthleteCompliancePct`), so the two
cannot disagree about an athlete.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff who can reach the page | None | Never |
| Group chips | Second row of the header | Narrows every number on the screen to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Same | None | Never |
| Period selector | Header | Changes the window | Stays here, period in the address | Nothing | Report access | None | A period the data cannot express is disabled with its reason |
| An athlete's name | The lists | Opens that athlete | `/squad/[athleteId]` | Nothing | Report access | None | Never |
| Download spreadsheet | Header | Downloads the report | A server route | Records that the report was viewed | Report access | None | Never |
| Download PDF | Header | Downloads the report | A server route | As above | Report access | None | Never |

**Nothing on this page changes any data.**

---

## 7. How this page is built, in plain English

Built on the server.

**Compliance is measured against expectation records, not against the roster.**
The database generates one expectation per athlete per day, and the percentage is
what arrived divided by what was expected. An athlete who was not expected to
submit does not count against anyone.

That has one consequence a coach should know: **if expectations have not been
generated for a period, that period reads as nothing expected rather than as
total non compliance.** This is the correct behaviour, and it is also why
applying a week template can leave a week looking unmeasured until the next
nightly run. Decision D-30.

---

## 8. States

**Loading.** Renders when ready.

**Nothing expected.** The mean is empty rather than zero or a hundred percent, and
the screen says nothing was expected. This distinction is the most important
state on the page.

**Empty under half list.** Says so, as a good outcome.

**Error.** Surfaces as an error.

**No permission.** Redirected to Settings with a reason.

**Wrong tier.** Not applicable. Compliance is on every package.

**Offline.** Not handled.

---

## 9. Open issues

- **UNVERIFIED: who can waive a day, and whether it is recorded who did.**
  Waiving changes what everyone's percentage means, so it should be attributable.
  Files searched: `src/lib/queries/compliance.ts`,
  `supabase/migrations/0006_thresholds_flags_compliance.sql`,
  `supabase/migrations/0044_generate_compliance_expectations.sql`.
- **The fifty percent line in Under half is not explained anywhere.** Whether it
  is the right threshold, and whether a club should be able to set it, is
  **decision D-32**.
