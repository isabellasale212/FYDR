import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { TestBests } from '@/components/TestBests/TestBests';
import { TestHistoryList } from '@/components/TestHistoryList/TestHistoryList';
import { TestTrendChart } from '@/components/TestTrendChart/TestTrendChart';
import { computeTestBestsBySide, fetchHistory, fetchTestDefinitions } from '@/lib/queries/testing';
import { fetchCurrentSeason } from '@/lib/queries/schedule';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Test history · Fydr' };

/* This is "the testing report for individual athletes" the coach's second
 * request names — /reports/testing is the squad-wide one, and this is the
 * per-athlete page it links into. Season's best, all-time best and the trend
 * between them land here rather than on the squad grid because all three are
 * facts about one athlete's own history on one test.
 *
 * Print and download sit here too. The squad report at /reports/testing
 * already had Export CSV and Export PDF (it was only missing Print); this
 * page had no way to get a result off the screen at all. */
export default async function TestAthleteHistoryPage({
  params,
}: {
  params: Promise<{ testDefId: string; athleteId: string }>;
}) {
  const { testDefId, athleteId } = await params;
  const { db, orgId, orgName, timezone } = await requireStaff();

  const [definitions, history, athleteRes, season] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    fetchHistory(db, orgId, athleteId, testDefId),
    db.from('athletes').select('first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
    fetchCurrentSeason(db, orgId),
  ]);
  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition || !athleteRes.data) notFound();

  // Derived from the same `history` rows the list below renders, by the one
  // shared best-picking rule in lib/queries/testing.ts. No second query and
  // no second definition of "best" that could disagree with the squad grid.
  // Split by side for a per_side test, matching the trend chart underneath:
  // a left hand and a right hand are two measurements, not one.
  const bestsBySide = computeTestBestsBySide(history, definition, season);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/testing">Testing</Link> ·{' '}
            <Link href={`/testing/${testDefId}`}>{definition.name}</Link> · {athleteRes.data.first_name}{' '}
            {athleteRes.data.last_name}
          </p>
          <h1>
            {athleteRes.data.first_name} {athleteRes.data.last_name}
          </h1>
        </div>
        {/* Top right, per the request. Same three-control set the other
         * report screens use: print what is on screen, or take the data
         * away as CSV or PDF. The print stylesheet in base.css hides
         * buttons and .btn-ghost links, so these do not print themselves. */}
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          <PrintButton />
          <a href={`/testing/${testDefId}/${athleteId}/export`} className="btn-ghost">
            Export CSV
          </a>
          <a href={`/testing/${testDefId}/${athleteId}/pdf`} className="btn-ghost">
            Export PDF
          </a>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 'var(--sp-14)' }}>
        Squad · {orgName} · {definition.name}
      </p>

      {history.length === 0 ? (
        <div className="card">
          <p className="tiny">No results logged yet.</p>
        </div>
      ) : (
        <div className="stack">
          <TestBests
            bestsBySide={bestsBySide}
            unit={definition.unit}
            decimalPlaces={definition.decimal_places}
            higherIsBetter={definition.higher_is_better}
            seasonName={season?.name ?? null}
            timezone={timezone}
          />
          <TestTrendChart
            rows={history}
            unit={definition.unit}
            decimalPlaces={definition.decimal_places}
            higherIsBetter={definition.higher_is_better}
            timezone={timezone}
          />
          <TestHistoryList
            orgId={orgId}
            testDefinitionId={testDefId}
            athleteId={athleteId}
            rows={history}
            unit={definition.unit}
            decimalPlaces={definition.decimal_places}
            timezone={timezone}
          />
        </div>
      )}
    </>
  );
}
