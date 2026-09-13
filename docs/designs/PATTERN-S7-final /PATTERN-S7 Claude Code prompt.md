# Pattern S7: build reports and analytics

**For Claude Code.** Build from the final Claude Design board.

The approved design is **"PATTERN-S7 · FINAL"** (13 artboards) in `docs/designs/pattern-s7-final/`, with `notes.md` and the board images beside it, plus **Fydr report catalogue** in the project. It supersedes every other report or analytics design.

- Use `notes.md` for exact tokens and sizes, and the catalogue for each report's definition.
- This prompt sets the behaviour.
- Where they conflict, stop and ask me.

## Step 1. Report before building

Answer each from the code. Wait for my reply before Step 2.

1. **Export audit:** is an export logged today? No export type was found among the audit log's twelve derived types. If it is not logged, build the audit row before the dialog promises it.
2. **PDF and print:** six `/pdf` handlers and a print stylesheet exist separately. Which survives? They must become one renderer producing one document.
3. **The group filter** is a cookie on one screen and a URL parameter on another (§0ak). Make it one global filter and report where it was inconsistent.
4. **Weekly bars:** for each metric, is a weekly value summed or meaned? Report the current behaviour per metric.
5. **Compliance:** confirm there is no cutoff, and list the real column names.
6. **Suppression:** the below-five rule exists on the training report only. What is needed to apply it to every report and every analytics panel?
7. **Readiness:** the built analytics screen draws 0 to 100. Is that formula documented anywhere? Until it is, plot the mean of the morning answers out of 5.
8. **Analytics roles:** can any role other than the sport scientist reach `/analytics`? The builder at `/analytics/build` is reachable by URL and linked from nothing: confirm and decide whether it stays.
9. **Injury report exclusions:** does it exclude, count or omit athletes with no availability status?
10. **Period crossing a squad change:** how is the denominator computed when an athlete joined mid-period?

## Step 2. The report shell

Build one shell used by all six reports: title, definition sentence, period and group, figure with denominator and exclusions, at most one chart, table, exports and print. Consider extracting it as `components/patterns/ReportShell`.

- The definition sentence comes from the catalogue and appears on screen, in the print view and in the export header.
- Every figure carries its denominator. Exclusions are a full sentence, including "Nobody is excluded".
- Missing values are words, never zeros. Worst first, never alphabetical.
- Percentage shading only, suppressed below five athletes with data. Below that, the ranking, shading and chart go, and the figure stays.
- Withheld report absent, withheld column absent, only an impossible export disabled.
- The role note sits on the report.
- The group filter recomputes every figure, denominator and export.

## Step 3. Export and print

- The dialog names the file before it is written: scope, period, row count and order, columns, how missing values are written, the header line, and the file name.
- Every export writes an audit row: report, scope, period, row count, who and when.
- Exports carrying diagnosis, mechanism or treatment detail add "Contains medical information. Handle under the club's data policy." to the header and print footer. A compliance export states that it holds none.
- **One renderer for print and PDF.** Same pages, header, footer and pagination. Use `--print-paper` and `--print-ink` so a dark-mode user does not print a dark sheet.

## Step 4. Analytics, four panels

- Training load, Wellness, Gym volume, Acute to chronic. Athlete picker, Compare two, and the group filter as "compare against".
- Every panel states what it measures, the window, what the ground is, and n.
- Bars, zero-based, with the axis line stating the range and the grain ("Axis 0 to 2.00 · one bar per week").
- One bar per day up to a fortnight, one per week beyond a month. Summed for volume, meaned for scored, as answered in Step 1.
- One accent. A comparison labels each series at the end of its own bars. No second hue.
- Hover or tap a bar shows its period and value. Tap persists until the next tap. **No value is available on hover alone.**
- A morning with no entry has no bar, a dashed stub, and reads "Not submitted".
- The threshold is a zone, drawn only when the club has set one, named and dated. No default 1.5 line.
- Below the minimum points, the panel is suppressed and says why, with one 44px action.
- **Analytics has no export.**

## New tokens

Approved: `--print-paper`, `--print-ink`, `--w-dialog`. Add them to the design system doc in the same commit.

## Verify

- Screenshots of all 13 frames on the real build.
- An export, then the audit row it wrote.
- The same report printed and exported as PDF, compared page for page.
- A medical export showing the confidentiality line in the header and print footer.
- A group filter applied, with every figure, denominator and export changing.
- An analytics panel with too few points: suppressed, with its reason.
- A tap readout on a touch device.

Commit one step at a time.
