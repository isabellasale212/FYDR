import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TestHistoryList } from '@/components/TestHistoryList/TestHistoryList';
import { TestTrendChart } from '@/components/TestTrendChart/TestTrendChart';
import { fetchHistory, fetchTestDefinitions } from '@/lib/queries/testing';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Test history · Fydr' };

export default async function TestAthleteHistoryPage({
  params,
}: {
  params: Promise<{ testDefId: string; athleteId: string }>;
}) {
  const { testDefId, athleteId } = await params;
  const { db, orgId, orgName, timezone } = await requireStaff();

  const [definitions, history, athleteRes] = await Promise.all([
    fetchTestDefinitions(db, orgId),
    fetchHistory(db, orgId, athleteId, testDefId),
    db.from('athletes').select('first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
  ]);
  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition || !athleteRes.data) notFound();

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
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName} · {definition.name}
      </p>

      {history.length === 0 ? (
        <div className="card">
          <p className="tiny">No results logged yet.</p>
        </div>
      ) : (
        <div className="stack">
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
