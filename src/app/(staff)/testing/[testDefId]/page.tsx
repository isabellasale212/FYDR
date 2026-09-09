import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TestLogGrid } from '@/components/TestLogGrid/TestLogGrid';
import { TestDateNav } from '@/components/TestDateNav/TestDateNav';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchResultsForLogging, fetchTestDates, fetchTestDefinitions } from '@/lib/queries/testing';
import { fetchGroups } from '@/lib/queries/groups';
import { todayIso } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Log results · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function TestLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ testDefId: string }>;
  searchParams: SearchParams;
}) {
  const { testDefId } = await params;
  const { db, orgId, orgName, claims, timezone } = await requireStaff();
  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const today = todayIso(timezone);
  const testDate = typeof sp.date === 'string' ? sp.date : today;

  const definitions = await fetchTestDefinitions(db, orgId);
  const definition = definitions.find((d) => d.id === testDefId);
  if (!definition) notFound();

  const [groups, athletes, testDates] = await Promise.all([
    fetchGroups(db, orgId),
    fetchResultsForLogging(db, orgId, testDefId, testDate, groupIds),
    fetchTestDates(db, orgId, testDefId),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/testing">Testing</Link> · {definition.name}
          </p>
          <h1>{definition.name}</h1>
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 'var(--sp-10)' }}>
        {groupScopeLabel(groups, groupIds)} · {orgName}
      </p>

      <div style={{ marginBottom: 'var(--sp-14)' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <TestDateNav testDefinitionId={testDefId} testDate={testDate} groupIds={groupIds} dates={testDates} timezone={timezone} />

      {athletes.length === 0 && groupIds.length > 0 ? (
        <EmptyState
          title="No athletes in this filter"
          body={`No athletes in the current scope (${groupScopeLabel(groups, groupIds)}). Clear the filter to see everyone.`}
        />
      ) : (
        <TestLogGrid
          orgId={orgId}
          userId={claims.userId}
          testDefinitionId={testDefId}
          testDate={testDate}
          defaultAttempts={definition.default_attempts}
          sideMode={definition.side_mode}
          decimalPlaces={definition.decimal_places}
          unit={definition.unit}
          athletes={athletes}
        />
      )}
    </>
  );
}
