import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TestLogGrid } from '@/components/TestLogGrid/TestLogGrid';
import { TestDateNav } from '@/components/TestDateNav/TestDateNav';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchAssignedAthleteIds, fetchResultsForLogging, fetchTestAssignments, fetchTestDates, fetchTestDefinitions } from '@/lib/queries/testing';
import { TestAssignmentPanel } from '@/components/TestAssignmentPanel/TestAssignmentPanel';
import { TEST_DEFINE, hasAnyRole } from '@/lib/access';
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

  const [groups, athletes, testDates, assignments, assignedIds, rosterRes] = await Promise.all([
    fetchGroups(db, orgId),
    fetchResultsForLogging(db, orgId, testDefId, testDate, groupIds),
    fetchTestDates(db, orgId, testDefId),
    /* 0130: the assign control — the rows, the resolved count, the roster to
       pick from. */
    fetchTestAssignments(db, orgId, testDefId),
    fetchAssignedAthleteIds(db, testDefId),
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club').order('last_name'),
  ]);
  if (rosterRes.error) throw new Error(rosterRes.error.message);
  const canAssign = hasAnyRole(claims.roles, TEST_DEFINE);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/testing">Testing</Link> · {definition.name}
          </p>
          <h1>{definition.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-10)', alignItems: 'center' }}>
          {/* 3.5 (16 Sept 2026): the group filter, a dropdown in the top right. */}
          <GroupFilter groups={groups} selected={groupIds} />
        </div>
      </div>

      <p className="eyebrow" style={{ marginBottom: 'var(--sp-10)' }}>
        {groupScopeLabel(groups, groupIds)} · {orgName}
      </p>


      <div style={{ marginBottom: 'var(--sp-14)' }}>
        <TestAssignmentPanel
          orgId={orgId}
          userId={claims.userId}
          testDefinitionId={testDefId}
          testName={definition.name}
          assignments={assignments}
          groups={groups}
          athletes={rosterRes.data ?? []}
          assignedCount={assignedIds.size}
          canManage={canAssign}
        />
      </div>

      <TestDateNav testDefinitionId={testDefId} testDate={testDate} groupIds={groupIds} dates={testDates} timezone={timezone} />

      {athletes.length === 0 && assignedIds.size === 0 ? (
        <EmptyState
          title="Nobody is assigned this test"
          body="Assign a group, an athlete or the whole squad above and the sheet fills with them."
        />
      ) : athletes.length === 0 && groupIds.length > 0 ? (
        <EmptyState
          title="No assigned athletes in this filter"
          body={`None of the athletes this test is assigned to are in the current scope (${groupScopeLabel(groups, groupIds)}). Clear the filter to see all of them.`}
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
