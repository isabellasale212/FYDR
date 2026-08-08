import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GpsImportForm } from '@/components/GpsImportForm/GpsImportForm';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { fetchRecentImportBatches } from '@/lib/queries/gpsImport';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Import GPS · Fydr' };

/** screens/imports.md, screen 34, cut down hard — lib/queries/gpsImport.ts's
 *  header has the full list of what this build does and does not attempt.
 *  Coach and medical only, matching migration 0026's role table; nobody else
 *  gets a write path onto gps_records, so nobody else gets this screen.
 *  SETTINGS-SPEC.md §6's "GPS exports" gate: role check first (a Basic-tier
 *  admin gets the existing role redirect, not a gate screen naming a
 *  feature they couldn't use either way), tier check second. */
export default async function ImportsPage() {
  const { db, orgId, claims, tier } = await requireStaff();
  if (!claims.roles.includes('coach') && !claims.roles.includes('medical')) redirect('/settings');

  if (!isPremium(tier)) {
    return (
      <PlanGate
        featureName="GPS exports"
        body="Importing vendor GPS files and exporting the parsed records is a Premium feature. Basic clubs work from wellness, gym and nutrition entries."
        metadata="Premium · Catapult, STATSports, Polar CSV · audited exports"
      />
    );
  }

  const batches = await fetchRecentImportBatches(db, orgId);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Settings</p>
          <h1>Import GPS</h1>
        </div>
        <Link href="/settings" className="btn-ghost">
          ← Settings
        </Link>
      </div>

      <div className="stack">
        <GpsImportForm />

        <section className="card" aria-labelledby="history-title">
          <h2 className="card-title" id="history-title">
            Recent imports
          </h2>
          {batches.length === 0 ? (
            <p className="import-sub">No imports yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Imported by</th>
                    <th className="r">Accepted</th>
                    <th className="r">Rejected</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.filename ?? '—'}</td>
                      <td>{b.imported_by_name ?? '—'}</td>
                      <td className="r">{b.accepted_count ?? 0}</td>
                      <td className="r">{b.rejected_count ?? 0}</td>
                      <td className="sub">{new Date(b.created_at).toLocaleString('en-GB')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="cap">
            No revert and no duplicate detection in this build — re-uploading the same file makes a second batch of the same
            rows. See <b>Import GPS data</b> above for the rest of what this pass does and does not do.
          </p>
        </section>
      </div>
    </>
  );
}
