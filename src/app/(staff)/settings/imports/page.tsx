import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GpsImportForm } from '@/components/GpsImportForm/GpsImportForm';
import { PlanGate } from '@/components/PlanGate/PlanGate';
import { countImportBatches, fetchRecentImportBatches } from '@/lib/queries/gpsImport';
import { formatDateTime } from '@/lib/format';
import { requireStaff } from '@/lib/session';
import { isPremium } from '@/lib/tier';

export const metadata = { title: 'Import GPS · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The recent list stays short by default. A club importing after every
 *  session accumulates hundreds of batches, and an unbounded table is a bad
 *  landing state for a screen whose primary job is still "upload a file" —
 *  but the coach asked for ALL previous imports, so ?all=1 is a real,
 *  linkable, no-JavaScript route to the complete history. */
const DEFAULT_LIMIT = 20;

/** screens/imports.md, screen 34, cut down hard — lib/queries/gpsImport.ts's
 *  header has the full list of what this build does and does not attempt.
 *  Coach and medical only, matching migration 0026's role table; nobody else
 *  gets a write path onto gps_records, so nobody else gets this screen.
 *  SETTINGS-SPEC.md §6's "GPS exports" gate: role check first (a Basic-tier
 *  admin gets the existing role redirect, not a gate screen naming a
 *  feature they couldn't use either way), tier check second. */
export default async function ImportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, tier, timezone } = await requireStaff();
  if (!claims.roles.includes('coach') && !claims.roles.includes('medic')) redirect('/settings');

  if (!isPremium(tier)) {
    return (
      <PlanGate
        featureName="GPS exports"
        body="Importing vendor GPS files and exporting the parsed records is a Premium feature. Basic clubs work from wellness, gym and nutrition entries."
        metadata="Premium · Catapult, STATSports, Polar CSV · audited exports"
      />
    );
  }

  const params = await searchParams;
  const showAll = params.all === '1';
  const [batches, totalBatches] = await Promise.all([
    fetchRecentImportBatches(db, orgId, showAll ? null : DEFAULT_LIMIT),
    countImportBatches(db, orgId),
  ]);

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
          <div
            style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}
          >
            <h2 className="card-title" id="history-title">
              {showAll ? 'All imports' : 'Recent imports'}
            </h2>
            {/* Only offered when it would actually change what is on screen —
                a "show all" link on a club with six imports is noise. */}
            {totalBatches > DEFAULT_LIMIT ? (
              <Link href={showAll ? '/settings/imports' : '/settings/imports?all=1'} className="btn-ghost">
                {showAll ? `Show latest ${DEFAULT_LIMIT}` : `Show all ${totalBatches}`}
              </Link>
            ) : null}
          </div>

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
                    <th className="r">Export</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id}>
                      <td>{b.filename ?? '—'}</td>
                      <td>{b.imported_by_name ?? '—'}</td>
                      <td className="r">{b.accepted_count ?? 0}</td>
                      <td className="r">{b.rejected_count ?? 0}</td>
                      {/* formatDateTime in the org's timezone, not the old
                          toLocaleString(): that rendered on the server, so a
                          batch imported at 00:30 club time showed the wrong
                          calendar day for any club not on the server's zone.
                          CLAUDE.md rule 5. */}
                      <td className="sub">{formatDateTime(b.created_at, timezone)}</td>
                      <td className="r">
                        {/* A batch with nothing accepted inserted no
                            gps_records rows, so its export would be a header
                            and a caption. Say "no rows" instead of handing
                            over an empty file that looks like a failure. */}
                        {(b.accepted_count ?? 0) > 0 ? (
                          <a
                            href={`/settings/imports/${b.id}/export`}
                            className="btn-ghost"
                            aria-label={`Export the ${b.accepted_count} records from ${b.filename ?? 'this import'} as CSV`}
                          >
                            CSV
                          </a>
                        ) : (
                          <span className="tiny">no rows</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="cap">
            Each export contains the accepted GPS records that batch inserted, matched by batch,
            not by date — so re-importing the same session stays separable. Rejected rows are not
            stored and cannot be exported. An export is a record of what was imported, not an
            import file: to upload, start from the template on the form above. There is no revert
            and no duplicate detection yet — re-uploading the same file makes a second batch of the
            same rows. Check the list above before re-uploading.
          </p>
        </section>
      </div>
    </>
  );
}
