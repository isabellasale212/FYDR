import type { ReportFigureCopy } from '@/lib/reportFigureCards';

/** PATTERN-S7 C1 (2026-09-13): the one emphasised figure a report leads
 *  with. In this order, the board's: the label, the count with its
 *  denominator, the value, the sample, the exclusions in a full sentence.
 *  The surface is the wash family's (the profile hero's), the value at
 *  --fs-48 — the system's mapping of the board's --blue-100 card at 48px. */
export function ReportFigure({ label, count, value, sample, exclusions }: ReportFigureCopy) {
  return (
    <section className="card rfig" aria-label={label}>
      <p className="rfig-label">{label}</p>
      <p className="rfig-count num">{count}</p>
      <p className="rfig-value num">{value}</p>
      <p className="rfig-sample">{sample}</p>
      <p className="rfig-exclusions">{exclusions}</p>
    </section>
  );
}
