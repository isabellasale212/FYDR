import { redirect } from 'next/navigation';
import Link from 'next/link';
import { RetentionPanel } from '@/components/RetentionPanel/RetentionPanel';
import { RETENTION_SCHEDULE } from '@/lib/retention/schedule';
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
 *  the rest of Settings' admin-only sections. */
export default async function RetentionPage() {
  const { claims } = await requireStaff();
  if (!claims.roles.includes('admin')) redirect('/settings');

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

      <RetentionPanel />
    </>
  );
}
