import Link from 'next/link';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { Pill } from '@/components/Pill/Pill';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchSquadList } from '@/lib/queries/squad';
import { BLANK } from '@/lib/format';
import { availabilityStatus } from '@/lib/status';
import { requireReportAccess } from '@/lib/session';

export const metadata = { title: 'Athlete report · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/reports.md's own entry point list names `athlete-profile.md`,
 *  "Generate report" as the way in — there is no such button on the profile
 *  page in this build, so this picker is the entry point instead: the same
 *  roster squad/page.tsx already renders, linking into the report rather
 *  than the profile. */
export default async function AthleteReportPickerPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, orgName } = await requireReportAccess();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);

  const [groups, rows] = await Promise.all([fetchGroups(db, orgId), fetchSquadList(db, orgId, groupIds)]);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/reports">Reports</Link> · Athlete report
          </p>
          <h1>Pick an athlete</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 10 }}>
        {groupScopeLabel(groups, groupIds)} · {orgName} · {rows.length} athletes
      </p>

      <div style={{ marginBottom: 14 }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      <section className="card flush">
        {rows.length === 0 ? (
          <p className="tiny" style={{ padding: 16 }}>
            No athlete matches this filter.
          </p>
        ) : (
          <table className="tbl">
            <caption className="visually-hidden">Squad roster, choose one for their report</caption>
            <thead>
              <tr>
                <th scope="col" className="r">
                  No.
                </th>
                <th scope="col">Athlete</th>
                <th scope="col">Position</th>
                <th scope="col">Availability</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="r mono">{row.squad_number ?? BLANK}</td>
                  <td>
                    <Link href={`/reports/athlete/${row.id}`} className="nm">
                      {row.first_name} {row.last_name}
                    </Link>
                  </td>
                  <td className="sub">{row.position ?? BLANK}</td>
                  <td>
                    <Pill status={availabilityStatus(row.availability === 'unknown' ? null : row.availability)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
