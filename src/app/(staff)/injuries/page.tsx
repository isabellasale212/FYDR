import Link from 'next/link';
import { CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { GroupFilter } from '@/components/GroupFilter/GroupFilter';
import { PrintButton } from '@/components/PrintButton/PrintButton';
import { ProblemReportsTriage } from '@/components/ProblemReportsTriage/ProblemReportsTriage';
import { fetchGroups } from '@/lib/queries/groups';
import { fetchInjuriesList } from '@/lib/queries/injuries';
import { fetchOpenProblemReports, fetchProblemReportNotes } from '@/lib/queries/problemReports';
import { enumLabel, formatDate } from '@/lib/format';
import { groupScopeLabel } from '@/lib/groupFilter';
import { resolveGroupFilter } from '@/lib/groupFilter.server';
import { requireInjuryAccess } from '@/lib/session';

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
 *  ("staff.dashboard"): this is not a top-level sidebar item. The injuries list
 *  itself needs no role branch — coach and medical see it identically, since it
 *  reads only injuries and availability, never injury_clinical. The "Problem
 *  reports" section added on top of it (migration 0040, 03-flows.md §6) is the one
 *  part of this page that does branch: medical only, per that migration's own
 *  visibility reasoning — the athlete capability that files a report is worded "to
 *  medical staff" (01-roles-and-permissions.md §1), so a coach gets no section, no
 *  badge, and no count, the same way this page's own hub — the place medical
 *  triages what an athlete has sent — is where this build puts it rather than
 *  inventing a new nav destination for it. */
export default async function InjuriesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, orgName, claims, timezone } = await requireInjuryAccess();
  const params = await searchParams;
  const groupIds = await resolveGroupFilter(params.groups);
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);

  // fetchOpenProblemReports is medical-only by RLS (migration 0040) — a coach
  // calling it gets an empty array back, not an error, so this is only ever
  // fetched at all when isMedical is true. See that migration's own header
  // for why coach has no access to this domain, not even existence: the
  // athlete capability that drives it is worded "to medical staff", and the
  // flow it implements (03-flows.md §6) notifies Medical alone.
  const [groups, injuries, problemReports] = await Promise.all([
    fetchGroups(db, orgId),
    fetchInjuriesList(db, orgId, groupIds),
    isMedical ? fetchOpenProblemReports(db, orgId) : Promise.resolve([]),
  ]);

  // Medical's own triage notes on those reports (migration 0055) — one batched
  // fetch for the whole inbox rather than one per row, so it has to wait on the
  // report ids above. Medical-only by RLS, exactly like the reports themselves,
  // and never shown on any athlete surface: see that migration's header for why
  // it is a separate table rather than a column the athlete's own row-select
  // would have handed them.
  const problemReportNotes = problemReports.length > 0
    ? await fetchProblemReportNotes(db, problemReports.map((r) => r.id))
    : [];

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">{groupScopeLabel(groups, groupIds)} · {orgName}</p>
          <h1>Injuries</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isMedical ? (
            <Link href="/injuries/new" className="btn-primary">
              + Injury
            </Link>
          ) : null}
          <PrintButton />
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

      {/* Medical-only, per this migration 0040 header's own reasoning: a
       * report is routed to medical staff by name in
       * 01-roles-and-permissions.md §1, so a coach sees no section, no
       * badge, and no count here at all — not a filtered view of one. */}
      {isMedical ? (
        <section aria-labelledby="problem-reports-title" style={{ marginBottom: 18 }}>
          <h2 className="sect" id="problem-reports-title">
            Problem reports
            {problemReports.length > 0 ? (
              <span className="pill pill-warn num">{problemReports.length}</span>
            ) : null}
          </h2>
          <ProblemReportsTriage
            reports={problemReports}
            notes={problemReportNotes}
            orgId={orgId}
            userId={claims.userId}
            timezone={timezone}
          />
        </section>
      ) : null}

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
                  {i.side ? ` · ${enumLabel(i.side)}` : ''} · since {formatDate(i.onset_date, timezone)}
                  {i.expected_return ? ` · back ${formatDate(i.expected_return, timezone)}` : ''}
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
