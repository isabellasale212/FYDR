import Link from 'next/link';
import { ExportBuilderForm } from '@/components/ExportBuilderForm/ExportBuilderForm';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { EXPORT_DOMAINS } from '@/lib/exportDomains';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { fetchExportAthletes } from '@/lib/queries/exportBuilder';
import { fetchGroups } from '@/lib/queries/groups';
import { addDays, todayIso } from '@/lib/format';
import { requireReportAccess } from '@/lib/session';

export const metadata = { title: 'Exports · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DEFAULT_WINDOW_DAYS = 30;

/** docs/screens/exports.md job 1: the staff bulk export builder — see that
 *  file's status note (top) for the full accounting of what's real in this
 *  pass versus what's deferred, and generate/route.ts's own header for the
 *  role-gate and synchronous-generation reasoning.
 *
 *  requireReportAccess(), not requireStaff(): the same coach-or-medical
 *  gate every report page in this build already uses, and the correct one
 *  here — every domain this builder offers is athlete-level performance
 *  detail, so an admin with neither role is turned away before reaching
 *  this page at all, per 01-roles-and-permissions.md §1.
 *
 *  Who: the same global group filter every multi-athlete screen in this app
 *  already uses (CLAUDE.md §3) — resolveGroupFilter/GroupFilter, unchanged
 *  from reports/training/page.tsx and every other report. Selecting a group
 *  here also narrows every other filtered screen, by design (the filter is
 *  genuinely global, not scoped to this page). */
export default async function ExportsPage({ searchParams }: { searchParams: SearchParams }) {
  const { db, orgId, claims, timezone } = await requireReportAccess();
  const sp = await searchParams;
  const groupIds = await resolveGroupFilter(sp.groups);

  const [groups, athletes] = await Promise.all([fetchGroups(db, orgId), fetchExportAthletes(db, orgId, groupIds)]);

  const today = todayIso(timezone);
  const defaultFrom = addDays(today, -(DEFAULT_WINDOW_DAYS - 1));
  const groupLabel = groupScopeLabel(groups, groupIds);

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Exports
          </p>
          <h1>Exports</h1>
        </div>
      </div>

      <p className="sub" style={{ marginBottom: 14, maxWidth: '70ch' }}>
        A CSV per domain, straight to your downloads — no queue to check back on.{' '}
        {claims.roles.includes('medical') ? 'Medical' : 'Coach'} access: every domain below,
        squad-wide.
      </p>

      <div style={{ margin: '0 0 16px' }}>
        <GroupFilter groups={groups} selected={groupIds} />
      </div>

      {athletes.length === 0 ? (
        <div className="empty">
          <h2>No athletes in this filter</h2>
          <p>Choose a different group, or clear the filter to see the whole squad.</p>
        </div>
      ) : (
        <ExportBuilderForm
          domains={EXPORT_DOMAINS}
          groupIds={groupIds}
          groupLabel={groupLabel}
          athleteCount={athletes.length}
          defaultFrom={defaultFrom}
          defaultTo={today}
          today={today}
        />
      )}
    </>
  );
}
