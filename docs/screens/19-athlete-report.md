# 19. Athlete report

## 1. Page name and URL

**Athlete report**, at `/reports/athlete/[athleteId]`.

Everything about one athlete over a chosen period, on one page, in a form that
can be printed or handed over.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything except the clinical record | Nothing. Exports only | The eight clinical fields | Base, with GPS regions on Premium | `requireReportAccess`, `src/lib/session.ts:120` |
| Coach | Yes | Same | Nothing. Exports only | The eight clinical fields | Same | Same |
| Medic | Yes | Same | Nothing. Exports only | None on this page. The clinical record lives on the injury record | Same | Same |
| S&C | Yes | Same, with the limited injury view | Nothing | The eight clinical fields | Same | **NOT BUILT** |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | Same | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing here. An athlete gets their own data through the subject access process, not this screen | Nothing | The whole page | n/a | Middleware, then guard, then database |

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/athlete/[athleteId]/page.tsx:85`; a product package check at `src/app/(staff)/reports/athlete/[athleteId]/page.tsx:516`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- An athlete's name on the picker.
- A direct link, carrying a period.

---

## 4. What you see

**A header** with the athlete's name and the period, and a breadcrumb back.

**A period selector.**

**Wellness over the period**, with the athlete's own normal range behind it.

**Training load**, including the acute to chronic ratio where enough days have
data.

**GPS**, on the Premium package: total distance, high speed distance, and the
date of the most recent record, so a coach can see how current the picture is.

**Testing and personal bests.**

**Availability over the period**, in the limited form.

**Two download buttons**, a spreadsheet and a PDF.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-001 | Readiness | How ready the athlete says they feel | Daily across the period, and a mean | Blank on days with no check-in |
| MET-006 | The shaded band | This athlete's own normal range | 14 days, rolling | No band until 14 days exist |
| MET-003 | Sleep hours | Hours slept, self reported | Daily | Blank |
| MET-007 | Session load | Rating times minutes | Per session | Blank if either is missing |
| None | Sessions logged / completed | Gym sessions in the period. **Logged** means the session has at least one live set (`gym_set_logs_current`) — a session opened and abandoned is not logged, since the log row is written the moment the screen opens (§0u, decided 10 September 2026, built 12 September). **Completed** is the log's status. Logged is therefore a superset of completed | The period | 0 |
| MET-010 | Acute to chronic ratio | This week's work against a typical week | 7 over 28 days | **Withheld entirely below 21 days with data**, rather than estimated |
| MET-017 | Total distance | How far, from GPS | Per session and summed | Blank without an upload. **Premium** |
| MET-018 | High speed distance | How far above the vendor's high speed threshold | Per session and summed | Blank. **Premium.** The threshold is the vendor's, not Fydr's |
| MET-029 | Best on the day | **The best attempt on a test day, not a lifetime best.** See D-40 | Per test date | Blank |
| MET-013 | Availability | Whether they can train and play | Across the period | Unknown where no record exists |
| MET-012 | Compliance | Share of this athlete's expected entries that arrived — and, for session RPE, arrived **in time**: before the end of the following club-local day, the same `rpeClosesAt` rule the compliance report, Today and the RPE screen use (§0ad, 12 September 2026). Judged on the original submission, never a staff correction's time; matched per session. Waived days excluded from both sides | The period | Blank, not 0, when nothing was expected |

**Latest date** appears beside the GPS figures. It is not a metric: it is the date
of the most recent record, shown so that a full looking report built on month old
data cannot be mistaken for a current one.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Period selector | Below the header | Changes the window for every region | Stays here, period in the address | Nothing | Report access | None | A period the data cannot express is disabled with its reason |
| Download spreadsheet | Header | Downloads the report as a spreadsheet | A server route | Nothing. It records that the report was viewed | Report access | None | Never |
| Download PDF | Header | Downloads the report as a PDF | A server route | As above | Report access | None | Never |
| Reports breadcrumb | Header | Back to the hub | `/reports` | Nothing | Report access | None | Never |

**The two downloads carry the same permission as this page**, checked on the
server rather than by hiding the button. This is the rule everywhere, and it
exists because two download routes once answered a plain request with the full
GPS board while the screen above them was correctly gated.

**Viewing a report is recorded.** Reading a named athlete's data is an auditable
act, so the report view is written to the audit log. This is not a side effect: it
is part of what makes named athlete data defensible to hold.

---

## 7. How this page is built, in plain English

Built on the server. Every region is fetched together rather than in sequence.

The GPS regions are asked for only on the Premium package, so a Base club does
not pay for a query whose result cannot be shown.

The period lives in the address.

---

## 8. States

**Loading.** Renders when ready.

**Empty.** A new athlete shows each region saying so rather than showing zeroes.

**Partial.** A period with gaps draws gaps, not zeroes.

**Ratio withheld.** Where fewer than 21 of the trailing 28 days have data, the
ratio is absent with its reason, rather than a number built on too little.

**Error.** Surfaces as an error.

**No permission.** Redirected to Settings with a reason.

**Wrong tier.** The GPS regions are absent on Base. **UNVERIFIED whether they are
hidden or replaced with an upsell.**

**Offline.** Not handled.

---

## 9. Open issues

- **The nutritionist should not reach this report.** Decision D-01.
- **UNVERIFIED: what the GPS regions show on the Base package.** Decision D-20
  proposes a general rule; this screen is one of the places it must be applied.
- **Resolved, and it was a real fault that has already been fixed.** The
  downloads once ignored the period: asking for a season exported 28 days and said
  nothing about it (`src/app/(staff)/reports/athlete/[athleteId]/export/route.ts:31`).
  Screen and downloads now resolve the period through the same function, so they
  cannot diverge. Recorded so the question is not re-opened.
