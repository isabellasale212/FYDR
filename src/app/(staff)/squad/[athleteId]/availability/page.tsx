import Link from 'next/link';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { AthleteDomainDenied } from '@/components/AthleteDomainShell/AthleteDomainShell';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { loadAthleteDomainContext } from '@/lib/athleteDomain.server';
import { buildHistory } from '@/lib/availabilityHistory';
import { formatDateTime } from '@/lib/format';
import { fetchAvailabilityLedger } from '@/lib/queries/availability';
import { fetchUserNames } from '@/lib/queries/users';

export const metadata = { title: 'Availability history · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Availability history for one athlete — PATTERN-S3 C7 (2026-09-12).
 *
 *  One row per change, newest first: when, the status word, the restriction
 *  line as it read then, what changed, who set it. Never edited and never
 *  removed — a correction adds a row. The availability table is already this
 *  ledger (every change closes the open interval and inserts a row), so this
 *  screen is a read, not a view or a trigger; lib/availabilityHistory.ts is
 *  the arithmetic and is tested with rows.
 *
 *  Who sees it: every staff role that can open the athlete's domain pages
 *  (loadAthleteDomainContext, the default set) — the same readers as the
 *  profile's availability line. What they see is what they may read: the
 *  restriction line passes through lib/restrictions.ts's rule for everyone,
 *  so a protocol stage never appears here; "what changed" names status,
 *  restrictions, the reason category and the injury link and nothing else.
 *  The status column carries no tone: a history is a list of facts. */
export default async function AvailabilityHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: SearchParams;
}) {
  const { athleteId } = await params;
  const sp = await searchParams;
  /* The context resolves a period for the domain pages; this screen has no
     window (the record is the record), so the allow-list is the widest and
     the value is not read. */
  const ctx = await loadAthleteDomainContext(athleteId, sp, { allowed: ['all'], screenDefault: 'all' });
  if (ctx.denied) return <AthleteDomainDenied orgName={ctx.orgName} domain="Availability" />;
  const { db, orgId, timezone, athlete } = ctx;

  const ledger = await fetchAvailabilityLedger(db, orgId, athleteId);
  const names = await fetchUserNames(db, orgId, ledger.map((r) => r.set_by));
  const history = buildHistory(ledger, names);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/squad">Squad overview</Link> ·{' '}
            <Link href={`/squad/${athleteId}`}>
              {athlete.first_name} {athlete.last_name}
            </Link>
          </p>
          <h1>Availability history</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          <a href={`/squad/${athleteId}/availability/export`} className="btn-ghost">
            Export CSV
          </a>
          <PrintButton />
        </div>
      </div>

      <p className="cap" style={{ margin: '0 0 var(--sp-12)' }}>
        Every change since the record began, one row per change, newest first. A row is never edited and never
        removed &mdash; a correction adds a row.{' '}
        {history.length > 0 ? `${history.length} ${history.length === 1 ? 'change' : 'changes'} on record.` : ''}
      </p>

      {history.length === 0 ? (
        <EmptyState
          title="Nothing on record"
          body="No availability has been recorded for this athlete yet. The first row appears when medical staff or a coach set a status."
        />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <caption className="visually-hidden">Availability changes, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Status</th>
                  <th scope="col">Restrictions</th>
                  <th scope="col">What changed</th>
                  <th scope="col">Set by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="num sub">{formatDateTime(row.at, timezone)}</td>
                    <td>{row.statusLabel}{row.current ? ' · current' : ''}</td>
                    <td className="sub">{row.restrictionLine}</td>
                    <td>{row.changed}</td>
                    <td className="sub">{row.setBy ?? 'Not recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 'var(--sp-14)' }}>
        <p className="label">What a row holds</p>
        <p className="cap" style={{ marginTop: 'var(--sp-6)' }}>
          The moment the change took effect, the status word, the restriction line as it read then, what changed
          against the row before, and the person. The status column carries no tone: a history is a list of facts, not
          a list of alarms. Nothing clinical is derived here &mdash; the medic&rsquo;s clinical record has its own screen.
        </p>
        <p className="cap" style={{ marginTop: 'var(--sp-8)' }}>
          If a club disputes an injury, this screen and its CSV are the record.
        </p>
      </div>
    </>
  );
}
