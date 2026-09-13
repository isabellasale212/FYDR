# PATTERN-S7 · FINAL: reports and analytics, notes

Thirteen artboards: eleven staff desktop at 1440×900, two staff phone at 375×812. Signed in as Jane Pemberton (sport scientist) except artboard 4, Ruth Callaghan (medical). Ashcombe Rugby Club, 30 athletes. Board instant: Friday 11 September 2026, 09:12 Europe/London.

**Artboards.** 1 Reports index · 2 Compliance, full shell · 3 The same report, Forwards, last 7 days · 4 Injury and availability, medic, with its role note · 5 Too little data to be meaningful · 6 Empty in this period, data outside it · 7 Export dialog · 8 Print view · 9 Analytics, four panels, one athlete against the squad · 10 Compare two, labelled series · 11 Too little data in the window · 12 Reports index on a phone · 13 A report read on a phone.

## What changed, and on which token

### Reports

**One shell, six reports, and the differences are the columns.** Title, definition sentence, the period and group it covers, the figure with its denominator, one chart at most, the table, and the two exports at the top right.
`PageHeader + one --surf definition card + one --blue-100 figure card + TableShell`

**The definition sentence sits above the numbers, in words.** The same sentence appears in the print view and in the exported file's header.
`--surf card on --shadow, --t-body at --w-regular in --text, capped at 100ch`

**Every figure carries its denominator and its exclusions.** "684 of 814" before "84%", then the sample, then the exclusions in a full sentence. When nothing is excluded the report says "Nobody is excluded".
`emphasised figure card --blue-100 / --blue-200 · 48px --font-num at --w-semi, tabular-nums · one per report`

**A missing entry is a dash and a word, never a zero.**

**Lowest first, because the athlete to chase is at the top.** Never alphabetically, and the header says so.

**Percentage shading is the pct band scale, and it is the only shading in the family.** `--heat-pct-1..5`, suppressed below five athletes with data.

**One chart per report, axes in words, and the band behind the line.** The injury report has three figures and no chart at all.

**Below five athletes with data, shading and the chart go, and the notice says the numbers are unchanged.** The figure stays.

**Empty in this period names the most recent record and its date.** Never "never" when the truth is "not in this period".

**The export dialog names the file before it is written.** Scope, period, row count and order, columns, how missing values are written, the header line, then the file name.
`--surf dialog at --w-dialog over --scrim · one primary with --ring-action`

**Exports live at the top right, on every surface and every width.** On the phone they sit first under the title, because the pitch-side use of a report is to send the PDF.

**The print view drops navigation and controls and keeps the definition.**
`--print-paper / --print-ink, 2px --line-strong under the header, 1px --hair between rows`

**A withheld report is absent; a withheld column is absent; only an impossible export is disabled.**

**The role note is on the report, not only in the settings matrix.**

**The period control explains why the narrow choice is usually wrong.**

**The group filter is global here too, and the report is not an exception.** It re-filters the table, recomputes every figure, rewrites every denominator, can suppress shading, and is carried into both exports.

**Every export is logged, and a medical export says how to handle it.** Dialog, file header and audit row carry report, scope, period, row count and who exported it with the timestamp. Anything carrying diagnosis, mechanism or treatment detail adds "Contains medical information. Handle under the club's data policy." to the header and the print footer; a compliance export states that it holds none.

**The print view and the exported PDF are one document.** One renderer, one layout, one definition sentence.

### Analytics

**Every panel states what it measures, over what window, what the ground is, and n.** One line under the title, above the plot, never a tooltip.

**One accent, and a series named at the end of its own bars.** Every bar is `--accent`, including both series of a comparison: two steps of one hue asks a reader to hold a key in their head, and a second hue would make the reference read as a third series. A comparison labels its series directly, at the height of that series' last value. The reference is drawn over the bars as two dashed `--tick` edges; a club zone adds a `--track-off` fill because it is a stated range rather than a computed spread.

**Bars mean the axis starts at zero, and the axis line says where it starts.** "Axis 0 to 2.00 · one bar per week · hover a bar for its value". A line chart may be truncated, and then the same line says so in words.

**One bar per day up to a fortnight, one bar per week beyond a month.** Summed for volume measures, meaned for scored ones; the definition line says which.

**Hovering or tapping a bar prints its period and its value, and nothing else moves.** Hover shows and leaving hides; a tap shows the same chip and stays until the reader taps the bar again or anywhere else in the panel. No crosshair, no animation, no reflow.

**No value in this product is available on hover alone.** A pointer is not a given: the same staff member reads this at a desk and on a tablet in a gym. Every value a decision rests on is printed without interaction, in the definition line, the figure, or the report the panel points at.

**A morning with no entry has no bar, and the baseline says so.** A 2px dashed stub, and a readout of "Not submitted".

**The threshold is a zone, it appears only when the club has set one, and it is named and dated.** "0.80 to 1.30 · set by Jane Pemberton, 24 Aug". Where a club zone is drawn the squad band is not, and the definition line says which is showing. No default 1.5 line.

**Analytics has no export of its own.** A question worth keeping leaves as a report: the thing with a definition, a row count, a print layout and an audit row.

### Screen-specific

**The index is grouped by what the question is about.** About the squad over a period; about one athlete, session or test. The built page has six ungrouped cards; the grouping is this board's proposal.

**The training report keeps its own extra controls, and stays a desktop screen.** At phone width it is 4,711px of charts, so the phone reading of it is the PDF.

## New tokens

- **Approved:** `--print-paper: #ffffff` and `--print-ink: #12161c`, fixed across themes so a dark-mode user does not print a dark sheet. The only tokens that ignore the theme.
- **Approved:** `--w-dialog: 640px`.
- **Candidate:** `--line-dashed-drop`, not used on this board.
- **Candidate:** `components/patterns/ReportShell`. Title, definition, controls, figure, chart, table and exports recur identically on six pages.

## Open against code

1. Compliance has no cutoff, and the screen did not say so (§0ad). The cutoff decision is the club's.
2. Compliance column names are not documented.
3. The group filter is a cookie on one screen and a URL parameter on another (§0ak, defect).
4. Period navigation is one-directional on the current period.
5. **Confirm the audit row for an export exists.** No export type was among the audit log's twelve derived types when measured. Do not promise logging in the dialog until it does.
6. Whether a medical export is marked as one. The marking has to follow the role that ran it.
7. **Six `/pdf` handlers and a print stylesheet exist separately.** Two renderers for one document; reconciling them is not optional.
8. Where the club threshold zone is set, and what it applies to.
9. **Whether a weekly bar is summed or meaned, per metric.** A weekly bar that silently meaned total distance would understate a week by the number of sessions in it.
10. The wellness readiness formula is not documented. The panel plots the mean of the four answers out of 5; the built screen draws 0 to 100 for the same panel.
11. Nothing states the definition inside the exported file today.
12. Suppression below five is specified for the training report only.
13. The injury report's excluded athletes.
14. What a report does when a period crosses a squad change.
15. The analytics builder exists in code with no entry point. Nothing on this board was read off it.
16. Whether the sport scientist is the only role with Analytics.
