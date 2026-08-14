import Link from 'next/link';
import { ProblemReportForm } from '@/components/ProblemReportForm/ProblemReportForm';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Toast } from '@/components/Toast/Toast';
import { PROBLEM_REPORT_CATEGORY_LABEL, fetchMyProblemReports } from '@/lib/queries/problemReports';
import { formatDateTime } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Report a problem · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_PILL: Record<string, string> = {
  open: 'pill-warn',
  acknowledged: 'pill-good',
  closed: 'pill-neutral',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Sent · not yet seen',
  acknowledged: 'Seen by medical',
  closed: 'Closed',
};

/** 03-flows.md §6, roadmap screen 36. The real write path behind Today's
 *  "Something not right?" card and Me's "Report a problem" row — both used
 *  to be honest dead ends ("no report-a-problem table exists"); migration
 *  0040 gives this one. Reached from both entry points, so the close X goes
 *  to /today unconditionally, matching every other sheet-styled athlete
 *  page (check-in, rpe) rather than trying to remember which tab sent the
 *  athlete here. Shows the athlete's own reports below the form, per the
 *  same "own-reports list" pattern My Data already uses for every other
 *  entry domain — the visible status is the trust loop this screen exists
 *  to close: an athlete who reports something should be able to see a
 *  person looked at it. */
export default async function ReportProblemPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();
  const params = await searchParams;

  const reports = await fetchMyProblemReports(db, athleteId);

  const toastMessage =
    params.submitted === '1' ? 'Sent · your club’s medical staff will follow up.' : null;

  return (
    <>
      <div className="sheet-head">
        <Link href="/today" className="sheet-x" aria-label="Close">
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">Report a problem</h1>
        <span style={{ width: 44 }} />
      </div>

      {toastMessage ? <Toast message={toastMessage} clearHref="/report-problem" /> : null}

      <ProblemReportForm orgId={orgId} athleteId={athleteId} userId={claims.userId} />

      <section aria-labelledby="my-reports-title" style={{ marginTop: 20 }}>
        <h2 className="sect" id="my-reports-title">
          Your reports
        </h2>
        {reports.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="No reports sent"
            body="Anything you send goes here, along with whether medical has seen it."
          />
        ) : (
          <div className="card flush">
            {reports.map((r, index) => (
              <div key={r.id}>
                {index > 0 ? <div className="hair" /> : null}
                <div className="load-row" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto', padding: '13px 14px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="tiny" style={{ marginBottom: 3 }}>
                      {formatDateTime(r.created_at, timezone)}
                      {r.category ? ` · ${PROBLEM_REPORT_CATEGORY_LABEL[r.category] ?? r.category}` : ''}
                    </div>
                    <div style={{ fontSize: 14 }}>{r.body}</div>
                  </div>
                  <span className={`pill ${STATUS_PILL[r.status] ?? 'pill-neutral'}`}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
