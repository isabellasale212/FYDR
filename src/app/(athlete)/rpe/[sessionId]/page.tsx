import Link from 'next/link';
import { RpeForm } from '@/components/RpeForm/RpeForm';
import { fetchSessionForRpe, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { dateInTz, enumLabel, formatDate, formatTime, mdExplainer, mdLabel } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'How hard was it? · Fydr' };

/** MD-2 in "the session ended under 30 minutes ago" gate: RPE taken
 *  immediately after a session is biased by the final drill
 *  (screens/training-entry.md, 04-data-model.md §5). Not configurable
 *  downwards. */
const DUE_DELAY_MIN = 30;

/* `?correct=1` used to switch this page into a correction form. It is no longer
 * read: migration 0058 made `revise_training_entry` coach/medical only at the
 * club's request, so the page has nothing to offer an athlete who arrives with
 * an old link. It falls through to the "Rated" card, which now says who can fix
 * a wrong rating. `searchParams` is dropped from the signature entirely rather
 * than accepted and ignored — an unread parameter in a route's props is the kind
 * of thing that gets quietly re-wired later. */
export default async function RpePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();

  const [session, existing] = await Promise.all([
    fetchSessionForRpe(db, orgId, athleteId, sessionId),
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
  // MD-n re-anchored to this session's own real calendar week — the same
  // primitive (fetchWeekMdLabels/anchorMdOffsetsToWeek) the week-level
  // views use, so this raw single-session view can't disagree with them
  // for the identical session (audit blocker B2). Reuses entryDate above
  // (already the correct local calendar date) — a second, separately
  // .slice(0, 10)-derived "sessionDate" used to sit right next to it,
  // reading the UTC date instead for this one lookup.
  const weekMd = await fetchWeekMdLabels(db, orgId, mondayOf(entryDate), timezone);
  const mdOffset = weekMd.get(entryDate) ?? null;
  const md = mdLabel(mdOffset);

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
          className="tiny num"
          style={{ width: 56, textAlign: 'end', whiteSpace: 'nowrap' }}
        >
          {formatDate(entryDate, timezone)}
        </span>
      </div>

      <div className="sess" style={{ padding: '0 0 14px' }}>
        <span className="tm num">{formatTime(session.starts_at, timezone)}</span>
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
                <span className="num" title={mdExplainer(mdOffset) ?? undefined}>
                  {md}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {existing ? (
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
            RPE <b>{existing.rpe}</b> · {existing.duration_min} min.
          </p>
          {/* Replaces a "Correct this entry" link. Prose, not a disabled button,
            * for the reason spelled out on the check-in page's matching card. */}
          <p className="import-sub" style={{ margin: '10px 0 0' }}>
            A submitted rating can&rsquo;t be edited, by you or by anyone. If this
            one is wrong, tell your coach: they can record a correction against it
            from your profile. If they do, My Data marks that session{' '}
            <b>Corrected</b> and shows you what you first rated it.
          </p>
          <p className="cap" style={{ display: 'flex', gap: 14 }}>
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
