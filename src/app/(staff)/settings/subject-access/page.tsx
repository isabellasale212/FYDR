import Link from 'next/link';
import { SETTINGS_ADMIN, CLINICAL_ONLY, hasAnyRole } from '@/lib/access';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { Pill } from '@/components/Pill/Pill';
import { fetchSarRequests } from '@/lib/queries/sarPack';
import { formatLongDate } from '@/lib/format';
import { SAR_STATUS } from '@/lib/status';
import { requireSubjectAccess } from '@/lib/session';
import { sarDueWords, sarNextStep, type SarStatus } from '@/lib/subjectAccess/words';

export const metadata = { title: 'Subject access requests · Fydr' };

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
  const isAdmin = hasAnyRole(claims.roles, SETTINGS_ADMIN);
  const isMedical = hasAnyRole(claims.roles, CLINICAL_ONLY);

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

      <p className="import-sub" style={{ marginTop: -6, marginBottom: 'var(--sp-14)' }}>
        Article 15, UK GDPR. Each request is due within one month. The sport scientist opens a request from an
        athlete&apos;s own profile page; the medic reviews any clinical notes it contains before the sport scientist can
        release it. The athlete sees the same stage, in the same words, on their own Privacy and my data page.
      </p>

      {error ? (
        <p className="form-error" role="alert" style={{ marginBottom: 'var(--sp-14)' }}>
          {error}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <EmptyState
          title="No subject access requests"
          body="None have been opened. Start one from an athlete's own profile page."
        />
      ) : (
        /* PATTERN-S8 C12: cards below 900px. */
        <div style={{ overflowX: 'auto' }}>
        <table className="tbl tbl-cards">
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
              /* PATTERN-S8 C10: the same due words and the same "waiting on
                 whom" the athlete reads on /me/privacy (lib/subjectAccess/words). */
              const due = sarDueWords(r.due_at, r.status as SarStatus);
              return (
                <tr key={r.id}>
                  <td className="nm" data-label="Athlete">
                    {r.athlete_first_name} {r.athlete_last_name}
                  </td>
                  <td className="num sub" data-label="Requested">{formatLongDate(r.requested_at, timezone)}</td>
                  <td className="sub" data-label="Requested by">{r.requested_by_name}</td>
                  <td className="num sub" data-label="Due">
                    {formatLongDate(r.due_at, timezone)}
                    {due ? (
                      <span className={`sub ${due.tone === 'bad' ? 'g-bad' : due.tone === 'warn' ? 'g-warn' : ''}`} style={{ marginInlineStart: 'var(--s-3)' }}>
                        ({due.text})
                      </span>
                    ) : null}
                  </td>
                  <td data-label="Status">
                    <Pill status={SAR_STATUS[r.status as keyof typeof SAR_STATUS] ?? SAR_STATUS.pending_review} />
                    <span className="tiny sar-next" style={{ display: 'block', marginTop: 'var(--sp-4)' }}>
                      {sarNextStep(r.status as SarStatus)}
                    </span>
                  </td>
                  <td className="r">
                    {/* No label: the action is its own words. */}
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
        </div>
      )}
    </>
  );
}
