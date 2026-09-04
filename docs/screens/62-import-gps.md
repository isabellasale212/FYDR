# 62. Import GPS

## 1. Page name and URL

**Import GPS**, at `/settings/imports`.

Brings GPS data into Fydr from a file exported by the club's vendor.
**Premium package only.**

**Everything in the GPS half of this app depends on this screen.** Nothing else
puts GPS data in.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | The upload and the history | Upload a file | None | **Premium** | Coach or medical at `src/app/(staff)/settings/imports/page.tsx:30`, plus a package check |
| Coach | Yes | The upload and the history | Upload a file | None | **Premium** | Same |
| Medic | Yes | The upload and the history | Upload a file | None | **Premium** | Same |
| S&C | **No today.** Yes in the agreed model | Nothing today | Nothing today | The whole page | **Premium** | Same line |
| Nutritionist | **No** | Nothing | Nothing | The whole page | **Premium** | Same line |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard |

**The upload route refuses on the Base package with a sentence**, not an empty
result: *GPS import is a Premium feature, and this club is on Basic.*

## 3. How you get here

- The Import GPS link in Settings.

## 4. What you see

**What the file must contain.** Ten exact column headings, shown on screen,
because there is deliberately no vendor detection and no column mapping. A club
whose export does not match is expected to re-head it in a spreadsheet.

**The upload control.**

**The history**, one row per import, with who did it, when, and how many rows were
accepted and rejected.

## 5. Every number on this page

| Metric ID | Label on screen | What it means | Time window | When missing |
|---|---|---|---|---|
| None | Accepted | Rows that became GPS records | This import | Zero, if the file matched the header but held no valid rows |
| None | Rejected | Rows that did not, **each with its row number and reason** | This import | Zero is the good outcome |

**Rows are numbered as a spreadsheet numbers them**, counting the header as row 1,
so a coach can go straight to the row the message names.

**Everything this screen accepts becomes MET-017 to MET-024.** Two further
measures, running distance and high intensity efforts, are rankable and displayed
but **cannot be uploaded**, because they are not among the ten headings. Decision
D-24.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Download the template | Header | Gives you a file with the ten correct headings | A server route | Nothing | Coach or medic | None | Never |
| **Upload a file** | The body | Reads it, validates every row, and writes the ones that pass | Stays here, with the result | **Creates GPS records**, and an import batch recording who and when | Coach or medic, **and Premium, both checked on the server** | The result is shown before anything else happens | Refuses on Base with a sentence |
| Export a past import | The history | Downloads what a previous import contained | A server route | Nothing | Same | None | Never |

**Three ways a file is refused, each with a different message.**

**The header does not match.** Nothing is imported and the screen says the header
is wrong, rather than importing a mangled subset.

**A row is not a number where one is required.** That row is rejected by number
and named column.

**A speed is implausible.** A maximum speed outside 0 to 12.5 metres per second is
rejected with the likely cause spelled out: check the column is really metres per
second and not kilometres per hour or miles per hour.

**No measurement units are ever converted.** The only conversion is minutes to
seconds for duration, which is a change of scale and is reversed on export.

## 7. How this page is built, in plain English

Built on the server. The upload is a server route that parses the file, validates
each row, and writes the accepted ones together with a record of the import.

Re-uploading a file is a real thing coaches do, and the import is built expecting
it.

## 8. States

**Base package.** Refused with a sentence explaining what the feature is.
**Header mismatch.** Nothing imported, the header named as the problem.
**Valid header, no rows.** Says the file has a valid header but no data.
**Partial success.** The normal case: accepted and rejected counts, with every
rejection given a row number and a reason.
**Error.** Surfaces as an error. **Offline.** The connection sentence.

## 9. Open issues

- **The S&C cannot reach this**, although GPS is central to their work. Part of
  the role remap, decision D-07.
- **Two displayed measures can never be uploaded.** Decision D-24.
- **UNVERIFIED: whether re-uploading the same file duplicates its rows or replaces
  them.** Files searched: `src/lib/queries/gpsImport.ts`. The file's own header
  says re-uploading is expected, which implies it is handled, but the behaviour is
  not stated. **Worth resolving before sign-off.**
