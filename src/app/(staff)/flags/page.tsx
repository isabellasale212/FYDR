import { FlagCard } from '@/components/FlagCard/FlagCard';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchFlagsList } from '@/lib/queries/flags';
import { fetchGroups } from '@/lib/queries/groups';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { formatDate, todayIso } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Flags · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, timezone, claims } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const today = todayIso(timezone);

  const hasAccess = claims.roles.includes('coach') || claims.roles.includes('medical');

  if (!hasAccess) {
    return (
      <>
        <div className="topbar">
          <div className="page-head">
            <p className="eyebrow">Squad · {orgName}</p>
            <h1>Flags</h1>
          </div>
          <ThemeToggle />
        </div>
        <div className="empty">
          <h2>Not part of this role</h2>
          <p>
            Flags carry wellness and load detail. Admin manages the club and
            does not read athlete performance data &mdash; see
            01-roles-and-permissions.md §1.
          </p>
        </div>
      </>
    );
  }

  const [groups, flags] = await Promise.all([
    fetchGroups(db, orgId),
    fetchFlagsList(db, orgId, groupIds),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            Squad · {orgName} · {formatDate(today)}
          </p>
          <h1>Flags</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <div className="stack">
        <p className="sub" style={{ margin: 0 }}>
          {flags.length === 0
            ? 'No open flags.'
            : `${flags.length} open flag${flags.length === 1 ? '' : 's'}, most severe first.`}
        </p>

        {flags.length === 0 ? (
          <EmptyState
            title="No open flags"
            body="The squad is within thresholds in this filter. That is the result, not a failure to load."
          />
        ) : (
          flags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              orgId={orgId}
              userId={claims.userId}
              today={today}
            />
          ))
        )}
      </div>
    </>
  );
}
