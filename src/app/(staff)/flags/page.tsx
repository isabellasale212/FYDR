import Link from 'next/link';
import { FlagCard } from '@/components/FlagCard/FlagCard';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { fetchFlagsList } from '@/lib/queries/flags';
import { fetchGroups } from '@/lib/queries/groups';
import { groupScopeLabel } from '@/lib/groupFilter';
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

  /* Optional ?date= filter — added so the dashboard's "Need you" tile (which
   * counts flags raised on one specific day) has a real destination that
   * shows exactly that set, instead of linking back to itself (audit coach
   * finding 13). A plain YYYY-MM-DD string; anything else is ignored rather
   * than thrown, since a malformed date here should just show everything. */
  const dateParam = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;

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

  const [groups, allFlags] = await Promise.all([
    fetchGroups(db, orgId),
    fetchFlagsList(db, orgId, groupIds),
  ]);

  const flags = dateParam ? allFlags.filter((f) => f.flag_date === dateParam) : allFlags;

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            {groupScopeLabel(groups, groupIds)} · {orgName} · {formatDate(today)}
          </p>
          <h1>Flags</h1>
        </div>
        <ThemeToggle />
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {dateParam ? (
        <p className="sub" style={{ margin: '0 0 10px' }}>
          Filtered to flags raised on <b>{formatDate(dateParam)}</b> —{' '}
          <Link href={`/flags${groupIds.length > 0 ? `?groups=${groupIds.join(',')}` : ''}`} className="linklike">
            show every open flag
          </Link>
        </p>
      ) : null}

      <div className="stack">
        <p className="sub" style={{ margin: 0 }}>
          {flags.length === 0
            ? dateParam
              ? `No flags raised on ${formatDate(dateParam)}.`
              : 'No open flags.'
            : `${flags.length} open flag${flags.length === 1 ? '' : 's'}, most severe first · ${
                flags.filter((f) => f.status === 'raised' || f.status === 'notified').length
              } awaiting acknowledgement.`}
        </p>

        {flags.length === 0 ? (
          <EmptyState
            title={dateParam ? 'No flags that day' : 'No open flags'}
            body={
              dateParam
                ? `Nothing was raised on ${formatDate(dateParam)} in the current scope — the count on the dashboard may be for a different day if you've since navigated. Show every open flag above to check.`
                : groupIds.length > 0
                  ? `No open flags in the current scope (${groupScopeLabel(groups, groupIds)}) — clear the filter to check the whole squad.`
                  : 'The squad is within thresholds. That is the result, not a failure to load.'
            }
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
