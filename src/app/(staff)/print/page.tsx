import { notFound } from 'next/navigation';
import { printableDoc } from '@/lib/printableDoc';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Print · Fydr' };

/* THE PRINT SCREEN (Isabella, 15 Sept 2026, mobile queue #15): "the
 * generated document has no back button and no way to download it. Add
 * both." On a desktop, Print opens the PDF in a new tab and the browser's
 * viewer does the rest (PATTERN-S7 C4). On a phone that tab is a dead end:
 * no back, no visible save. So at phone width PrintLink comes here instead,
 * with the document's own route in `?doc=`, and this page gives the three
 * things the bare tab could not — the layout's Back (a real history step,
 * BackButton), a Download that saves the file (the route's attachment
 * disposition, lib/pdf.tsx's default), and the document itself, previewed
 * inline and openable in the viewer for whoever wants to print from there.
 *
 * `doc` is one of this app's own PDF routes and nothing else: a same-origin
 * path ending in /pdf, its query kept, its `open` dropped so the two links
 * below decide the disposition. Anything else is not found — this page
 * frames documents, it does not proxy addresses. Not width-gated itself:
 * only the way in is (no desktop control links here). The PDF route does
 * its own requireStaff and its own group scope, as it always has; the
 * requireStaff here only keeps the frame behind sign-in. */
export default async function PrintPage({ searchParams }: { searchParams: Promise<{ doc?: string | string[] }> }) {
  await requireStaff();
  const { doc } = await searchParams;
  const target = printableDoc(typeof doc === 'string' ? doc : null);
  if (!target) notFound();
  const sep = target.includes('?') ? '&' : '?';
  const inline = `${target}${sep}open=1`;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Print</p>
          <h1>Print or save</h1>
        </div>
      </div>

      <div className="card">
        <p className="sub" style={{ margin: 0 }}>
          The document is ready. Save it to this device, or open it in the browser&rsquo;s own viewer to print from there. Back
          returns to the screen it came from.
        </p>
        <div className="print-actions">
          <a href={target} download className="btn-primary">
            Download PDF
          </a>
          <a href={inline} target="_blank" rel="noopener" className="btn-ghost">
            Open in viewer
          </a>
        </div>
        <iframe className="print-preview" src={inline} title="Document preview" />
        <p className="tiny" style={{ marginTop: 'var(--sp-8)' }}>
          On some phones the preview shows the first page only. Download or Open in viewer for the whole document.
        </p>
      </div>
    </>
  );
}
