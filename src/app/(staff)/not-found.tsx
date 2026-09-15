import Link from 'next/link';
import { NOT_FOUND, NOT_FOUND_HOME } from '@/lib/notFoundCopy';

export const metadata = { title: 'Not found · Fydr' };

/** The staff shell's not-found — decision-batch-2026-09-15.md #3. Rendered
 *  inside the shell (sidebar, phone tab bar) wherever a page under (staff)
 *  calls notFound(): a malformed athlete id, an injury or a session that
 *  resolves to nothing under this club's row-level security. The words are
 *  lib/notFoundCopy.ts's and do not say which; the frame is the denied
 *  screen's (PATTERN-S6 C7), its sibling. */
export default function StaffNotFound() {
  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">{NOT_FOUND.eyebrow}</p>
          <h1>{NOT_FOUND.title}</h1>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <p style={{ margin: '0 0 var(--sp-16)' }}>{NOT_FOUND.body}</p>
        <Link href={NOT_FOUND_HOME.staff.href} className="btn-primary" style={{ display: 'inline-flex' }}>
          {NOT_FOUND_HOME.staff.label}
        </Link>
      </div>
    </>
  );
}
