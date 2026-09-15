import Link from 'next/link';

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
 * AT PHONE WIDTH IT GOES TO /print INSTEAD (Isabella, 15 Sept 2026, mobile
 * queue #15): a new tab holding a bare PDF has no back control and, on a
 * phone, no obvious way to save the file. So below 768px the same control
 * is a link to the print screen, in this tab — the layout's Back leaves
 * it, its Download saves the file, its Open in viewer is the desktop
 * behaviour for whoever wants it. Two anchors, one shown per width by
 * base.css's gate (data-desktop-only / data-phone-only); the desktop one
 * is exactly what it was. Presentation, not permission: the PDF route
 * answers either way.
 *
 * `href` is the screen's own PDF route, with its query. A plain anchor, not
 * a button: it navigates. */
export function PrintLink({ href, className = 'btn-ghost' }: { href: string; className?: string }) {
  const url = href.includes('?') ? `${href}&open=1` : `${href}?open=1`;
  return (
    <>
      <a href={url} className={className} target="_blank" rel="noopener" title="Opens the PDF in a new tab. Print it from there." data-desktop-only="">
        Print
      </a>
      <Link href={`/print?doc=${encodeURIComponent(href)}`} className={className} data-phone-only="">
        Print
      </Link>
    </>
  );
}
