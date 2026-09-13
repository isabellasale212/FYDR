import Link from 'next/link';
import { SIDEBAR_ROWS } from '@/components/Sidebar/rows';
import { deniedCopy } from '@/lib/denied';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Not available · Fydr' };

/** PATTERN-S6 C7 (2026-09-13): where every staff role gate lands when it
 *  refuses — requireReport, requireReportAccess, requireInjuryAccess,
 *  requireSubjectAccess, requirePlatformStaff, the analytics gate and the
 *  three subject-access routes. Reads no reason and echoes no path: the
 *  screen says what is true without saying what exists. The words are
 *  lib/denied.ts's; what the role covers is the sidebar's own list for it. */
export default async function DeniedPage() {
  const { fullName, claims } = await requireStaff();
  const covers = SIDEBAR_ROWS.filter((row) => row.roles.some((r) => claims.roles.includes(r))).map((row) => row.label);
  const copy = deniedCopy({ fullName, roles: claims.roles, covers });
  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Not available</p>
          <h1>{copy.title}</h1>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <p style={{ margin: '0 0 var(--sp-12)' }}>{copy.body}</p>
        <p className="sub" style={{ margin: '0 0 var(--sp-4)' }}>
          {copy.identity}
        </p>
        <p className="sub" style={{ margin: '0 0 var(--sp-16)' }}>
          {copy.covers}
        </p>
        <Link href={copy.action.href} className="btn-primary" style={{ display: 'inline-flex' }}>
          {copy.action.label}
        </Link>
      </div>
    </>
  );
}
