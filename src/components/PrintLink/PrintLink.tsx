/* Print opens the PDF — PATTERN-S7 C4, ruled 2026-09-13 (batch B10), built
 * 2026-09-14: "the PDF survives and Print opens it; printing becomes a
 * two-step action, accepted." There is one renderer for print and PDF, the
 * document lib/pdf.tsx produces, so a printed page carries what the screen
 * cannot promise to — its own title, its definition sentence, the club, the
 * period, the "not for redistribution" footer — and a dark-mode user never
 * prints a dark sheet. This control opens that document in a new tab with
 * an inline disposition (`?open=1`); the browser's viewer does the printing.
 * The print stylesheet (`@media print`) that used to print the live screen,
 * sidebar and all, is gone with it — this replaced components/PrintButton
 * and its window.print().
 *
 * `href` is the screen's own PDF route, with its query. A plain anchor, not
 * a button: it navigates. */
export function PrintLink({ href, className = 'btn-ghost' }: { href: string; className?: string }) {
  const url = href.includes('?') ? `${href}&open=1` : `${href}?open=1`;
  return (
    <a href={url} className={className} target="_blank" rel="noopener" title="Opens the PDF in a new tab. Print it from there.">
      Print
    </a>
  );
}
