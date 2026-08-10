import Link from 'next/link';
import { RpeForm } from '@/components/RpeForm/RpeForm';
import { fetchSessionForRpe, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { dateInTz, enumLabel, formatDate, formatTime, mdLabel } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'How hard was it? · Fydr' };

/** MD-2 in "the session ended under 30 minutes ago" gate: RPE taken
 *  immediately after a session is biased by the final drill
 *  (screens/training-entry.md, 04-data-model.md §5). Not configurable
 *  downwards. */
const DUE_DELAY_MIN = 30;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RpePage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: SearchParams;
}) {
  const { sessionId } = await params;
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();
  const qp = await searchParams;
  const correcting = qp.correct === '1';

  const [session, existing] = await Promise.all([
    fetchSessionForRpe(db, orgId, sessionId),
    fetchTrainingEntryForSession(db, athleteId, sessionId),
  ]);

  if (!session) {
    return (
      <>
        <div className="sheet-head">
          <Link href="/today" className="sheet-x" aria-label="Close">
            <span aria-hidden="true">✕</span>
          </Link>
          <h1 className="t">How hard was it?</h1>
          <span style={{ width: 44 }} />
        </div>
        <div className="empty">
          <h2>This session isn&rsquo;t there</h2>
          <p>
            It may have been cancelled or is not one of yours. Nothing is lost
            &mdash; there is nothing to rate.
          </p>
        </div>
      </>
    );
  }

  const entryDate = dateInTz(new Date(session.starts_at), timezone);
  const md = mdLabel(session.md_offset);

  const dueAt =
    session.duration_min !== null
      ? new Date(session.starts_at).getTime() +
        (session.duration_min + DUE_DELAY_MIN) * 60_000
      : null;
  const notYetDue = dueAt !== null && Date.now() < dueAt;

  return (
    <>
      <div className="sheet-head">
        <Link href="/today" className="sheet-x" aria-label="Close">
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">How hard was it?</h1>
        <span
          className="tiny mono"
          style={{ width: 56, textAlign: 'end', whiteSpace: 'nowrap' }}
        >
          {formatDate(entryDate)}
        </span>
      </div>

      <div className="sess" style={{ padding: '0 0 14px' }}>
        <span className="tm mono">{formatTime(session.starts_at)}</span>
        <div>
          <div className="ti">
            {session.title}
            <span className="pill pill-neutral">
              {enumLabel(session.session_type)}
            </span>
          </div>
          <div className="lo">
            {session.location ?? 'Location not set'}
            {md ? (
              <>
                {' · '}
                <span className="mono">{md}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {existing && correcting ? (
        <RpeForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          sessionId={session.id}
          entryDate={entryDate}
          scheduledDurationMin={session.duration_min}
          sessionTitle={session.title}
          correction={{
            originalId: existing.id,
            initial: { rpe: existing.rpe, duration_min: existing.duration_min },
          }}
        />
      ) : existing ? (
        <div className="card">
          <h2 className="card-title">
            <span className="g-good" aria-hidden="true">
              ✓{' '}
            </span>
            Rated
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            {existing.submitted_at
              ? `Rated at ${new Intl.DateTimeFormat('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: timezone,
                }).format(new Date(existing.submitted_at))}. `
              : ''}
            RPE <b>{existing.rpe}</b> · {existing.duration_min} min. Entries
            can&rsquo;t be edited directly &mdash; correcting one keeps the
            original and records a new, dated revision instead.
          </p>
          <p className="cap" style={{ display: 'flex', gap: 14 }}>
            <Link href={`/rpe/${session.id}?correct=1`}>Correct this entry</Link>
            <Link href="/today">Back to today</Link>
          </p>
        </div>
      ) : notYetDue ? (
        <div className="banner">
          <span className="g g-faint" aria-hidden="true">
            ◌
          </span>
          <div>
            <b>Not quite yet.</b> Rating a session straight away is biased by
            the last drill. Come back {DUE_DELAY_MIN} minutes after it ends.
          </div>
        </div>
      ) : (
        <RpeForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          sessionId={session.id}
          entryDate={entryDate}
          scheduledDurationMin={session.duration_min}
          sessionTitle={session.title}
        />
      )}
    </>
  );
}
