import type { ReportFigureCopy } from '@/lib/reportFigureCards';

/** PATTERN-S7 C1 (2026-09-13): the one emphasised figure a report leads
 *  with. In this order, the board's: the label, the count with its
 *  denominator, the value, the sample. The surface is the wash family's
 *  (the profile hero's), the value at --fs-48 — the system's mapping of the
 *  board's --blue-100 card at 48px.
 *
 *  THE EXCLUSIONS SENTENCE IS NOT DRAWN since 16 Sept 2026 (Isabella, the
 *  evening queue, the text rule, category 4: "keep the figure, remove the
 *  sentence — '0 of 203', '0 of 29 athletes with a rating' stay; the prose
 *  beneath goes"). The copy is still built by lib/reportFigureCards.ts —
 *  every page still states its exclusions to this component — so the fact
 *  is one prop away if the ruling changes; it is just not on the screen. */
export function ReportFigure({ label, count, value, sample }: ReportFigureCopy) {
  return (
    <section className="card rfig" aria-label={label}>
      <p className="rfig-label">{label}</p>
      <p className="rfig-count num">{count}</p>
      <p className="rfig-value num">{value}</p>
      <p className="rfig-sample">{sample}</p>
    </section>
  );
}
