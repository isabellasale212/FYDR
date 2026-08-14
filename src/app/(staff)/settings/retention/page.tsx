import { redirect } from 'next/navigation';
import Link from 'next/link';
import { RetentionPanel } from '@/components/RetentionPanel/RetentionPanel';
import { RETENTION_SCHEDULE } from '@/lib/retention/schedule';
import { fetchRetentionNightlyReports } from '@/lib/retention/history';
import { formatDateTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Data retention · Fydr' };

/** 09-security-and-compliance.md §7's retention schedule, given a real
 *  screen — previously named as not built ("Exports, billing and data
 *  retention on the Settings screen") alongside two things that stay
 *  genuinely out of scope: billing (12-product-tiers.md §7.2 — this
 *  product is sold, not self-serve, so there is no billing screen to
 *  build at all, by design, not by gap) and full automation across every
 *  category the schedule names (see lib/retention/schedule.ts's own
 *  per-row notes for exactly which categories this pass can act on for
 *  real and which are preview-only, and why). Admin only, same gate as
 *  the rest of Settings' admin-only sections.
 *
 *  §7 also asks for "a nightly Edge Function" — migration 0033 is that
 *  piece, a real pg_cron job rather than an Edge Function (this build has
 *  no Edge Function deployment, pg_cron needs none), deliberately
 *  read-only rather than destructive, per §7's own caution a few
 *  paragraphs later ("run it in report-only mode... read the reports").
 *  The table below is where an admin actually reads them. */
export default async function RetentionPage() {
  const { db, orgId, claims, timezone } = await requireStaff();
  if (!claims.roles.includes('admin')) redirect('/settings');

  const nightlyReports = await fetchRetentionNightlyReports(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Compliance
          </p>
          <h1>Data retention</h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 14 }}>
        The schedule below is this club&apos;s default. Two categories can be actually run from here — import files
        and closed-injury clinical detail — the rest are preview only, and this page says exactly why for each one.
        A run never happens without a preview first.
      </p>

      <section className="card" aria-labelledby="schedule-title">
        <h2 className="card-title" id="schedule-title">
          The schedule
        </h2>
        <table className="tbl">
          <caption className="visually-hidden">Data retention schedule</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Retention</th>
              <th scope="col">Clock starts</th>
              <th scope="col">Automated here</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION_SCHEDULE.map((row) => (
              <tr key={row.category}>
                <td className="nm">
                  {row.category}
                  {row.note ? <p className="tiny">{row.note}</p> : null}
                </td>
                <td className="sub">{row.retention}</td>
                <td className="sub">{row.clockStartsOn}</td>
                <td>{row.automated ? <span className="g-good">Yes</span> : <span className="sub">Preview only</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" aria-labelledby="nightly-title">
        <h2 className="card-title" id="nightly-title">
          Nightly reports
        </h2>
        <p className="import-sub" style={{ marginBottom: 10 }}>
          Runs automatically every night at 02:15 UTC, read-only — the same two counts the preview above shows,
          recorded whether or not anyone opens this page.
        </p>
        {nightlyReports.length === 0 ? (
          <p className="cap">No nightly report has run yet. The next one runs at 02:15 UTC.</p>
        ) : (
          <table className="tbl">
            <caption className="visually-hidden">Nightly retention reports</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col" className="r">
                  Import files eligible
                </th>
                <th scope="col" className="r">
                  Injuries eligible
                </th>
              </tr>
            </thead>
            <tbody>
              {nightlyReports.map((r) => (
                <tr key={r.occurredAt}>
                  <td className="mono sub">{formatDateTime(r.occurredAt, timezone)}</td>
                  <td className="r mono">{r.importBatchesEligible}</td>
                  <td className="r mono">{r.injuriesEligible}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <RetentionPanel />
    </>
  );
}
