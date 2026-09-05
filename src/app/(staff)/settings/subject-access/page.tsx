import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { fetchSarRequests } from '@/lib/queries/sarPack';
import { formatLongDate } from '@/lib/format';
import { SAR_STATUS } from '@/lib/status';
import { requireSubjectAccess } from '@/lib/session';

export const metadata = { title: 'Subject access requests · Fydr' };

function daysUntil(dueAtIso: string): number {
  return Math.ceil((new Date(dueAtIso).getTime() - Date.now()) / 86_400_000);
}

/** screens/exports.md, "Admin, subject access pack", and
 *  09-security-and-compliance.md §6. Entry points: an admin opens a
 *  request from an athlete's own profile ("Generate subject access
 *  pack" — see squad/[athleteId]/page.tsx); this page is the queue every
 *  open request appears in, with the statutory one-month deadline shown
 *  the way §6 insists on: "without a visible queue the deadline is missed
 *  by a part-time club secretary who put the email in a folder." See
 *  lib/queries/sarPack.ts's own header for the reduced, synchronous scope
 *  this pass builds against the full async-worker spec. */
export default async function SubjectAccessPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { db, orgId, claims, timezone } = await requireSubjectAccess();
  const requests = await fetchSarRequests(db, orgId);
  const isAdmin = claims.roles.includes('sport_scientist');
  const isMedical = claims.roles.includes('medic');

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/settings">Settings</Link> · Compliance
          </p>
          <h1>Subject access requests</h1>
        </div>
      </div>

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 14 }}>
        Article 15, UK GDPR. Each request is due within one month. An admin opens a request from an athlete&apos;s own
        profile page; medical reviews any clinical notes it contains before an admin can release it.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          title="No subject access requests"
          body="None have been opened. Start one from an athlete's own profile page."
        />
      ) : (
        <table className="tbl">
          <caption className="visually-hidden">Subject access requests</caption>
          <thead>
            <tr>
              <th scope="col">Athlete</th>
              <th scope="col">Requested</th>
              <th scope="col">Requested by</th>
              <th scope="col">Due</th>
              <th scope="col">Status</th>
              <th scope="col"></th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const days = daysUntil(r.due_at);
              return (
                <tr key={r.id}>
                  <td className="nm">
                    {r.athlete_first_name} {r.athlete_last_name}
                  </td>
                  <td className="num sub">{formatLongDate(r.requested_at, timezone)}</td>
                  <td className="sub">{r.requested_by_name}</td>
                  <td className="num sub">
                    {formatLongDate(r.due_at, timezone)}
                    {r.status !== 'released' ? (
                      <span className={`sub ${days <= 7 ? 'g-bad' : days <= 14 ? 'g-warn' : ''}`} style={{ marginInlineStart: 6 }}>
                        ({days} day{days === 1 ? '' : 's'})
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <Pill status={SAR_STATUS[r.status as keyof typeof SAR_STATUS] ?? SAR_STATUS.pending_review} />
                  </td>
                  <td className="r">
                    {r.status === 'pending_review' && isMedical ? (
                      <Link href={`/settings/subject-access/${r.id}/review`} className="btn-ghost">
                        Review clinical notes →
                      </Link>
                    ) : null}
                    {r.status === 'reviewed' && isAdmin ? (
                      <form action={`/settings/subject-access/${r.id}/release`} method="post">
                        <button type="submit" className="btn-ghost">
                          Release &amp; download →
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
