import Link from 'next/link';
import { PREMIUM_ONLY, SIDEBAR_ROWS } from '@/components/Sidebar/rows';
import { deniedCopy } from '@/lib/denied';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Not available · Fydr' };

/** PATTERN-S6 C7 (2026-09-13): where every staff role gate lands when it
 *  refuses — requireReport, requireReportAccess, requireInjuryAccess,
 *  requireSubjectAccess, requirePlatformStaff, the analytics gate and the
 *  three subject-access routes. Reads no reason and echoes no path — only
 *  the denial log's reference (0112) the gate carried in ?r=: the screen
 *  says what is true without saying what exists. The words are
 *  lib/denied.ts's; what the role covers is the sidebar's own list for it. */
export default async function DeniedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { fullName, claims, tier } = await requireStaff();
  /* The one thing read from the address: the denial log's reference (0112),
     which the refusing gate carried here. Not a reason, not a path. */
  const sp = await searchParams;
  const reference = typeof sp.r === 'string' ? sp.r : null;
  /* The sidebar's own list for the role, on the club's own plan: a wholly
     premium destination (D-20) is not "covered" for a basic club, so it is
     not named here either — the screen says what is true. */
  const covers = SIDEBAR_ROWS.filter((row) => row.roles.some((r) => claims.roles.includes(r)) && (isPremium(tier) || !PREMIUM_ONLY.has(row.id))).map((row) => row.label);
  const copy = deniedCopy({ fullName, roles: claims.roles, covers, reference });
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
        <p className="sub" style={{ margin: copy.reference ? '0 0 var(--sp-4)' : '0 0 var(--sp-16)' }}>
          {copy.covers}
        </p>
        {copy.reference ? (
          <p className="sub num" style={{ margin: '0 0 var(--sp-16)' }}>
            {copy.reference}
          </p>
        ) : null}
        <Link href={copy.action.href} className="btn-primary" style={{ display: 'inline-flex' }}>
          {copy.action.label}
        </Link>
      </div>
    </>
  );
}
