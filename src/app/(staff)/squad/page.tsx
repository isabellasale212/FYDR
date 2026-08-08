import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { RosterTable } from '@/components/RosterTable/RosterTable';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Squad overview · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SquadPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName } = await requireStaff();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, rows] = await Promise.all([
    fetchGroups(db, orgId),
    fetchSquadList(db, orgId, groupIds),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Squad overview</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/settings/groups" className="btn-ghost">
            Manage groups
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <section className="card">
        <h2 className="card-title">
          {rows.length} athletes
          {groupIds.length > 0 ? ' in the selected groups' : ' in the squad'}
        </h2>
        <p className="import-sub">
          Availability is set by medical staff. A coach reads it and never writes
          it.
        </p>
        <RosterTable orgId={orgId} groupIds={groupIds} initialRows={rows} />
      </section>
    </>
  );
}
