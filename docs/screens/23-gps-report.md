# 23. GPS report

## 1. Page name and URL

**GPS report**, at `/reports/gps`. **Was "Training report" at `/reports/training`
until 13 September 2026**, when the catalogue addendum split the training report
in two: this per-session GPS board is the **GPS report** (premium), and the RPE ×
minutes report is the **Training load report**, every club, at
`/reports/training-load` (`65-training-load-report.md`). Neither keeps the old
name, because that name was the ambiguity. `/reports/training` is a permanent
redirect to `/reports/gps` carrying the query (`?mode=match`, `?session=`,
`?groups=`, `?range=`), so an old link lands where it always did. The report key
is `gps` (`requireReport('gps')`; audit rows before 13 September say `training`);
the exports are `gps-report-<date>.csv` and `.pdf`.

How hard each session actually was, judged against a typical session of the same
kind for that athlete. **Premium package only.**

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything | Nothing. Exports only | None | **Premium** | `requireReportAccess` at `src/lib/session.ts:120`, then a package check |
| Coach | Yes | Everything | Nothing. Exports only | None | **Premium** | Same |
| Medic | Yes | Everything | Nothing | None | **Premium** | Same |
| S&C | Yes | Everything | Nothing | None | **Premium** | **NOT BUILT** |
| Nutritionist | **No** in the target model | Nothing | Nothing | The whole page | **Premium** | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**A club on the Base package cannot open this report at all**, and its two
downloads refuse with a status and a sentence rather than an empty file. That
matters: both routes once answered a plain request with the complete GPS board
while this screen was correctly gated, because the buttons were simply never drawn
(`src/lib/session.ts:126`). A hidden button is not a gate.

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireReportAccess()` at `src/app/(staff)/reports/gps/page.tsx:252`; a product package check at `src/app/(staff)/reports/gps/page.tsx:254`; a product package check at `src/app/(staff)/reports/gps/page.tsx:256`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- The GPS report card on the reports hub, marked Premium.

---

## 4. What you see

**The definition sentence, on the training-session board** (PATTERN-S7 C1; the
catalogue addendum, 13 September 2026): "Per-session GPS totals for each athlete,
from the files imported for that session. An athlete with no GPS file for a session
shows as no record, never as zero." — on screen, in the CSV's first line and under
the PDF's title. The match board draws none: its sentence is on hold in the
catalogue until the "who played, minutes" question is ruled on (the code's answer:
the app records attendance and the team allocation, not who played or minutes).

**Exports first under the title on a phone; the board's phone reading is the PDF**
(PATTERN-S7 C11, 13 September 2026). Below 768px the shared header puts the
eyebrow-and-exports row directly under the title (CSS order on `.rhead`, desktop
untouched), and this report adds one line under its scope line, drawn on a phone only:
"This board is laid out for a desktop. On a phone, read it as the PDF — Export PDF is
above." The board itself does not reflow.

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

**Two modes**, training and match, because the questions differ.

**A set of dials**, each a measure scored as a percentage of a typical session of
the same kind, with a sentence under each saying what the number means in words.

**A written read of the session**, naming which measure drove the verdict rather
than leaving a coach to compare five dials.

**Per athlete figures** beneath.

---

**One emphasised figure leads the Board** (PATTERN-S7 C1, 13 September 2026;
`components/ReportFigure`, `lib/reportFigureCards.ts`): "On the board" ("Played, on the
board" on the match board) — the count before the percentage ("21 of 30" then "70%"),
the session and its date as the sample, then the exclusions in a full sentence: "9 of 30
in this filter have no GPS record for this session and are not on the board." or "Every
athlete in this filter has a GPS record for this session — nobody is excluded.", with
"Fewer than five have data, so shading is off; the numbers are unchanged." when the squad
floor applies. It replaces the tiny coverage line above the board; both PDFs lead their
Board section with the same figure.

**Empty states follow the one grammar** (PATTERN-S6 C8, 13 September 2026;
`lib/staffEmpty.ts`). A group filter that leaves nobody on the board reads "No
GPS record for Academy. None of the 5 athletes in Academy has a GPS record for
this session. Nothing is missing — the filter is what is empty." with one action,
"Show the whole squad", that clears the filter — the cookie as well as the URL,
the way the chip row's "Clear filter" does (§0ak), since a link to a bare URL
would resolve back to the same cookie — and keeps the session. A club with
no GPS file imported at all reads "No GPS record on record for the club. Nothing
is missing — no GPS file has been imported yet. A session appears here once its
GPS file is imported from Settings › Imports." (the match board's version adds
that an upcoming fixture has no record by design). Never "never".

**Every figure carries its denominator, an exclusions sentence, and words for a
missing value** (PATTERN-S7 C2, 13 September 2026; `lib/reportFigures.ts`). The
board's line reads "n = 21 athletes · 9 of 30 in this filter have no GPS record
for this session and are not on the board" (or "… every athlete in this filter
has a GPS record for this session — nobody is excluded"; a match board counts
"played"): a row exists only for an athlete with a record, and the rest of the
filter is absent, not zero — so it is counted. A missing value is words: "No
data" on a board cell and in every comparison table, "No best yet" where an
athlete has no maximum to be a percentage of, "Not set" for a venue, location or
duration, "Result not entered" — never a dash.

**The scatter's bands are a shape as well as a hue** (the accessibility sweep's
Class 3.5, 15 September 2026). Each athlete's dot — total distance across, high
speed running up — sits in one of four bands against their own normal or their
unit's: far above is a filled circle, above a filled square, in line a ring, and
below a dashed circle, with the same fills and strokes as before; the legend draws
the four the same way, and a dot's label reads the band in words ("Below their
normal") along with the name, the unit and the two distances. A dot with no
high-intensity-efforts value is not drawn (the point needs all three figures), so
a session imported without HIE draws no scatter.

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-026 | The dial percentages and their sentences | How this session compares with a typical session **of the same title** for this athlete | All earlier sessions with that title, within the period | Says "not enough data to read this session yet" rather than showing a number |
| MET-017 | Total distance | How far, from GPS | This session | Blank |
| MET-018 | High speed distance | Distance above the vendor's high speed threshold | This session | Blank |
| MET-019 | Sprint distance | Distance at the vendor's sprint threshold | This session | Blank |
| MET-021 | Player load | The vendor's own summary of work done | This session | Blank |
| MET-027 | Halves | **Not built, and labelled as absent** | n/a | An explicit, labelled absence, never an invented number |

**Two things a coach should understand about these numbers.**

**"A typical session of this kind" means one with the same title.** The database
has no session subtype, so the title is what groups repeating sessions. Calling
every Tuesday session "Conditioning" is therefore doing real work, and renaming
one breaks its own history.

**The session being scored is never part of its own reference.** Applied
everywhere a reference is computed, not just the headline.

**The five verdicts** and their cutoffs are in MET-026. **Nothing explains where
those cutoffs came from**, which is decision D-11.

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Back | Top left of the header | Returns to the screen you came from | Browser history | Nothing | Any staff who can reach the page | None | Never |
| Group chips | Second row of the header | Narrows every number on the screen to a group | Stays here, group in the address | Nothing. A cookie remembers the choice | Same | None | Never |
| Training and match mode | Header | Switches which question is being asked | Stays here, mode in the address | Nothing | Report access, Premium | None | Never |
| Session chooser | Header | Picks the session to read | Stays here | Nothing | Same | None | Never |
| Group filter chips | Header | Narrows to a group | Stays here | Nothing. A cookie remembers it | Same | None | Never |
| An athlete's name | Per athlete rows | Opens that athlete | `/squad/[athleteId]` | Nothing | Same | None | Never |
| Download spreadsheet and PDF | Header | Download the report | Server routes | Record that the report was viewed | Same, **checked on the server** | None | Never drawn on Base, **and refused on the server as well** |

---

## 7. How this page is built, in plain English

Built on the server.

Sessions are grouped by title to build the reference. The date of each session is
read in the club's local timezone rather than sliced from the stored timestamp,
because a session late in the evening otherwise lands on the wrong day.

Match GPS exists for real completed matches, recorded at a single flat duration
for every athlete, because nothing in the database records who started and who
came on. That is why the halves split does not exist: there is no honest way to
produce one, so the screen labels its absence instead of inventing it.

---

## 8. States

**Basic package.** Gone (D-20 without exception, 15 September 2026): absent from
the reports index, refused at the URL through the denied screen and logged
(`gps_report_premium`); the CSV and PDF routes refuse the same way. No locked
page: the Settings plan page is where a club learns what Premium contains.

**Loading.** Renders when ready.

**Not enough history.** A session with no earlier sessions of the same title
cannot be scored, and says so in words.

**No GPS for the session.** The dials that need it are absent with their reason.

**Halves.** Always absent, always labelled.

**Error.** Surfaces as an error.

**No permission.** Redirected with a reason.

**Wrong tier.** The whole page refuses on Base, and so do both downloads.

**Offline.** Not handled.

---

## 9. Open issues

- **Four cutoffs decide every verdict on this page and none is explained.**
  Decision D-11. Until it is answered, MET-026 is marked unverified on its
  thresholds.
- **Renaming a session silently detaches it from its own history**, because the
  title is the grouping key. Worth a warning on the session edit screen.
  **Decision D-33.**
- **The nutritionist should not reach this report.** Decision D-01.
