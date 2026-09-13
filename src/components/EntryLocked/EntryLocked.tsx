import Link from 'next/link';
import { lockedFormLine, type ConsentState } from '@/lib/consentState';

/** PATTERN-S9: an entry form for an athlete not in data. The destination
 *  stays; the card says which state closed it and where that changes —
 *  Settings › Your data for a decline or a withdrawal, the guardian screen
 *  while a guardian is answering. The database refuses the row anyway
 *  (0120's restrictive policies); this is the screen saying so before a tap,
 *  not a silent failure after one. */
export function EntryLocked({ state, title, closeLabel }: { state: ConsentState; title: string; closeLabel: string }) {
  const href = state === 'guardian_pending' ? '/consent/guardian' : '/me/data-consent';
  const label = state === 'guardian_pending' ? 'See where it stands' : 'Settings › Your data';
  return (
    <>
      <div className="sheet-head">
        <Link href="/today" className="sheet-x" aria-label={closeLabel}>
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">{title}</h1>
        <span style={{ width: 44 }} />
      </div>
      <div className="after-card" data-entry-locked={state}>
        <h2 className="after-heading">Not open</h2>
        <p className="after-note">{lockedFormLine(state)}</p>
      </div>
      <div className="subm">
        <Link href={href} className="btn-primary btn-commit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
          {label}
        </Link>
        <Link href="/today" className="btn-ghost" style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-8)', textDecoration: 'none' }}>
          Back to Today
        </Link>
      </div>
    </>
  );
}
