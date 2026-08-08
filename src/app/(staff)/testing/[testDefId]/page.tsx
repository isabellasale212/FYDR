import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TestLogGrid } from '@/components/TestLogGrid/TestLogGrid';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchResultsForLogging, fetchTestDefinitions } from '@/lib/queries/testing';
import { fetchGroups } from '@/lib/queries/groups';
import { addDays, formatDate, todayIso } from '@/lib/format';
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

  const [groups, athletes] = await Promise.all([
    fetchGroups(db, orgId),
    fetchResultsForLogging(db, orgId, testDefId, testDate, groupIds),
  ]);

  // Plain <Link href> for day navigation, same as before — but it has to
  // carry the group filter forward too, or clicking "Next day" silently
  // clears it. GroupFilter's own client-side apply() already preserves
  // whatever's in the URL when *it's* the one changing; this is the other
  // direction, changing the date while a filter is active.
  const dayHref = (date: string) =>
    groupIds.length > 0 ? `/testing/${testDefId}?date=${date}&groups=${groupIds.join(',')}` : `/testing/${testDefId}?date=${date}`;

  const activeGroupNames = groups.filter((g) => groupIds.includes(g.id)).map((g) => g.name);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/testing">Testing</Link> · {definition.name}
          </p>
          <h1>{definition.name}</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        Squad · {orgName}
      </p>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Link href={dayHref(addDays(testDate, -1))} className="btn-ghost">
          ‹ Previous day
        </Link>
        <span className="nm mono">{formatDate(testDate)}</span>
        <Link href={dayHref(addDays(testDate, 1))} className="btn-ghost">
          Next day ›
        </Link>
      </div>

      {athletes.length === 0 && groupIds.length > 0 ? (
        <EmptyState
          title="No athletes in this filter"
          body={`No athletes in ${activeGroupNames.join(', ') || 'the selected group'} are in this squad. Clear the filter to see everyone.`}
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
