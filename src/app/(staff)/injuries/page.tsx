import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchInjuriesList } from '@/lib/queries/injuries';
import { enumLabel, formatDate } from '@/lib/format';
import { parseGroupParam } from '@/lib/groupFilter';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Injuries · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const AVAIL_PILL: Record<string, string> = {
  available: 'pill-good',
  modified: 'pill-warn',
  unavailable: 'pill-bad',
};

/** screens/injury-dashboard.md, screen 12, cut down hard — see
 *  lib/queries/injuries.ts's header for exactly what and why. Reached from the
 *  Dashboard's availability card, per 20-route-map.md's own parent
 *  ("staff.dashboard"): this is not a top-level sidebar item. Coach and medical see
 *  the identical list — it reads only injuries and availability, never
 *  injury_clinical, so there is nothing here that needs a role branch. */
export default async function InjuriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims } = await requireStaff();
  const params = await searchParams;
  const groupIds = parseGroupParam(params.groups);
  const isMedical = claims.roles.includes('medical');

  const [groups, injuries] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuriesList(db, orgId, groupIds),
  ]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Injuries</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isMedical ? (
            <Link href="/injuries/new" className="btn-primary">
              + Injury
            </Link>
          ) : null}
          <PrintButton />
          <ThemeToggle />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
        <Link href="/injuries/team-allocation" className="tiny">
          Team allocation →
        </Link>
        <Link href="/injuries/rehab-groups" className="tiny">
          Rehab groups →
        </Link>
      </div>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {injuries.length === 0 ? (
        <EmptyState
          title="No open injuries"
          body="Every injury in this filter has been closed, or none has been recorded."
        />
      ) : (
        <div className="card flush injuries-board">
          {injuries.map((i) => (
            <Link key={i.id} href={`/injuries/${i.id}`} className="load-row" style={{ gridTemplateColumns: '1fr auto auto', textDecoration: 'none', color: 'inherit' }}>
              <div>
                <span className="nm">
                  {i.first_name} {i.last_name}
                </span>
                <div className="tiny">
                  {enumLabel(i.body_area)}
                  {i.side ? ` · ${enumLabel(i.side)}` : ''} · since {formatDate(i.onset_date)}
                  {i.expected_return ? ` · back ${formatDate(i.expected_return)}` : ''}
                </div>
              </div>
              {i.availability_status ? (
                <span className={`pill ${AVAIL_PILL[i.availability_status] ?? 'pill-neutral'}`}>
                  {enumLabel(i.availability_status)}
                </span>
              ) : (
                <span className="tiny">·</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <p className="cap">
        {isMedical
          ? 'Full clinical detail opens from each record. Nothing here is shown to coaching staff except availability status, restrictions, body area and expected return.'
          : 'Availability status, restrictions, body area and expected return only. Diagnosis and clinical notes are medical only and are not on this screen.'}
      </p>
    </>
  );
}
