import { LEGAL_PLACEHOLDERS, type LegalRef } from '@/lib/legalPlaceholders';

/** PATTERN-S9's legal gate, drawn: a dashed line on the well fill, the
 *  reference, and one caption naming who supplies it (lib/legalPlaceholders
 *  holds the words). `sameAs` is the guardian page's "same wording as the
 *  athlete screen", shown by reference so a reviewer can see the strings
 *  match. */
export function LegalPlaceholder({ id, sameAs }: { id: LegalRef; sameAs?: string }) {
  const p = LEGAL_PLACEHOLDERS[id];
  return (
    <div className="legal-pending" data-lines={p.lines} data-legal={id} role="note" aria-label={`${id}, wording to come`}>
      <span className="legal-pending-ref num">{sameAs ? `${id} — ${sameAs}` : `${id} · solicitor to supply`}</span>
      <span className="legal-pending-cap">{p.needs}</span>
    </div>
  );
}
