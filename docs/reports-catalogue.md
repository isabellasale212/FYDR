# Fydr report catalogue

**Status.** Drafted 2026-09-13 from the six report specifications
(`docs/screens/19-24`) and the running app, for PATTERN-S7 C1. The S7 prompt cites a
"Fydr report catalogue" in the project; it is not in the repository. When it lands,
this file is reconciled to it and `src/lib/reportCatalogue.ts` follows — the module
mirrors the **Definition** sentences below verbatim, and
`scripts/test-report-catalogue.ts` fails if they drift.

**What a definition sentence is for.** It sits above the numbers, in words, on
the report; the same sentence appears in the print view and in the exported file's
header. It says what the report measures, over what, and who is counted — and
nothing a number below it could contradict.

The header every report shares is in `CHANGELOG-headers-spec.md`. The figure
grammar (denominator, exclusions, words for a missing value) is PATTERN-S7 C2
(`lib/reportFigures.ts`); the empty-state grammar is PATTERN-S6 C8
(`lib/staffEmpty.ts`). Both apply to every entry.

---

## Compliance — `/reports/compliance`

**Definition.** Who has submitted what was expected of them, and who has not — how much of the picture the club actually has, over the period and group chosen.

**The figure.** Submitted of expected, as a percentage, per domain; waived days are excluded and reported as exclusions. Nothing expected reads "Not expected", never "0 of 0".

**Sort.** Worst first, and the table says so: the athlete to chase is at the top.

**Chart.** None. The by-day grid is the picture.

**Columns.** The same for every role that may open it; the nutritionist sees the nutrition domain only.

**Exports.** CSV and PDF, top right; both carry the definition.

## Injury and availability — `/reports/injuries`

**Definition.** Who is unavailable, why in limited terms, when they are expected back, and where injuries are happening, over the period and group chosen.

**The figure.** Three, and no chart: available now of the squad in scope; days lost in the period; new injuries in the period. Athletes with no availability recorded and athletes who joined in the period are named as exclusions.

**Sort.** By expected return, soonest first; unknown returns last and said so.

**Chart.** None. The body-area table stands in for it.

**Columns.** The clinical columns (diagnosis, site detail) are the medic's; a coach reads the status word, the restriction line and the expected return. The nutritionist cannot open this report.

**Exports.** CSV and PDF, top right; a medical export carries "Contains medical information. Handle under the club's data policy." (PATTERN-S7 C3, on the sheet).

## Training — `/reports/training`

**Definition.** How hard each session was for each athlete, judged against a typical session of the same kind for that athlete, from the GPS file for the session chosen.

**The figure.** Athletes on the board of those in scope; the session's dials are the picture. Below five athletes with data the shading goes and the notice says the numbers are unchanged.

**Sort.** Furthest from their own typical first — the athlete whose session was most unlike their normal is at the top.

**Chart.** One: the session's load against the athlete's own band.

**Columns.** The same for every role; Premium only.

**Exports.** CSV and PDF, top right. On a phone the report's reading is the PDF.

## Athlete — `/reports/athlete/[athleteId]`

**Definition.** Everything about one athlete over the period chosen, on one page, in a form that can be printed or handed over.

**The figure.** Their compliance: met of expected, with waived days as exclusions. Each domain panel then carries its own figure with its own denominator.

**Sort.** Not a list; the domains run in one fixed order.

**Chart.** One per domain at most, each with the athlete's own band behind the line.

**Columns.** Injury detail is the medic's; the nutritionist reads the censored availability view.

**Exports.** CSV and PDF, top right; both carry the definition.

## Squad weekly — `/reports/squad`

**Definition.** The squad's week on one page: who has trained how much, how that compares with their own normal, and who is carrying something.

**The figure.** The week's compliance tile: submitted of expected, waived days excluded and named; readiness over the athletes who reported; the squad median only at five athletes with data or more.

**Sort.** Most sessions logged first.

**Chart.** None; the tiles and the load rows are the picture.

**Columns.** The same for every role that may open it.

**Exports.** CSV and PDF, top right; both carry the definition.

## Testing — `/reports/testing`

**Definition.** Test results across the group chosen: where each athlete sits on one test, and what the group's middle looks like over time.

**The figure.** Athletes with a result of those in scope, for the test chosen; the squad median and quartiles only at five athletes with data or more.

**Sort.** By result, best first in the test's own direction (a faster sprint, a higher jump).

**Chart.** One: the median over time, with the quartile band behind it.

**Columns.** The same for every role that may open it.

**Exports.** CSV and PDF, top right; both carry the definition.
