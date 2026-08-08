'use client';

/* 06-design-system.md §14.7's own "Smaller gaps" table names this exact
 * pairing: "No print styles | Clubs print the availability board | A print
 * stylesheet forcing the light theme, removing shadows, and keeping
 * glyphs." screens/dashboard.md and screens/injury-dashboard.md both cite
 * the same real workflow — a physio pins a printed availability board on
 * the treatment room wall — as the reason this isn't cosmetic. The
 * stylesheet half lives in base.css's `@media print` block; this is the
 * trigger, since neither page had one. window.print() renders whatever is
 * on screen through that stylesheet — there is no separate print view to
 * keep in sync with the real one. */
export function PrintButton() {
  return (
    <button type="button" className="btn-ghost no-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
