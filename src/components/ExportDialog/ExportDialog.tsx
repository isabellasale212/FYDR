'use client';

import { useState } from 'react';
import { Dialog } from '@/components/Dialog/Dialog';
import { MEDICAL_EXPORT_LINE, exportSentences, type ExportDescriptor } from '@/lib/exportDescriptor';

/* PATTERN-S7 C3 (2026-09-13): the export dialog names the file before it
 * is written, states what it holds — the window, the scope with its count,
 * every filter, the row count — carries the medical line on the medic's
 * copy, and says that the download is written to the audit log with the
 * row count. The primary action IS the download (a plain link to the
 * route, which writes the audit row and returns the file); Cancel writes
 * nothing. The dialog is B11's one pattern; an export qualifies because a
 * disclosure that leaves the system cannot be taken back. */
type Props = { href: string; descriptor: ExportDescriptor; label?: string; className?: string };

export function ExportDialog({ href, descriptor, label = 'Export CSV', className = 'rhead-btn' }: Props) {
  const [open, setOpen] = useState(false);
  const lines = exportSentences(descriptor);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Export ${descriptor.fileName}`}
        tone={descriptor.medical ? 'bad' : 'warn'}
        actions={
          <>
            <a href={href} className="btn-primary" download={descriptor.fileName} onClick={() => setOpen(false)}>
              Download {descriptor.fileName}
            </a>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </>
        }
      >
        <ul className="dlg-lines">
          {lines.map((l) => (
            <li key={l} className={l === MEDICAL_EXPORT_LINE ? 'dlg-line-medical' : undefined}>
              {l}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
