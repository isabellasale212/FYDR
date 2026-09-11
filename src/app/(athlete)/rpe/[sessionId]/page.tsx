import Link from 'next/link';
import { RpeForm } from '@/components/RpeForm/RpeForm';
import { fetchSessionForRpe, fetchTrainingEntryForSession } from '@/lib/queries/training';
import { fetchWeekMdLabels, mondayOf } from '@/lib/queries/schedule';
import { dateInTz, enumLabel, formatDate, formatTime, mdExplainer, mdLabel } from '@/lib/format';
import { DUE_DELAY_MIN, rpeDueAt, rpeIsClosed } from '@/lib/rpeDue';
import { rpeRowName } from '@/lib/todayRows';
import { requireAthlete } from '@/lib/session';

/* "Rate {session name}" since 2026-09-11 (ATH-ADULT-02, RPE decision 3). The
 * heading used to be the question itself, "How hard was it?", and so did the
 * to-do row that opens this screen — which made two sessions to rate read as
 * two identical rows. The row now names the session, so the heading does
 * too, through the same function, and test-control-names-resolve.ts holds
 * the pair to one template. The question survives on the form's own first
 * line, "Rate the whole session, not the hardest bit." */
export const metadata = { title: 'Rate a session · Fydr' };

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
    /* ATH-ADULT-06, 2026-09-12. The message stays deliberately vague: it
       covers a cancelled session, another club's session and one this athlete
       was never in, and it must never say which — so the body is verbatim and
       the status stays 200. What changed: the outcome is stated at heading
       size in the one emphasised card, and the way out is a real button in
       the footer rather than only the ✕. */
    return (
      <>
        <div className="sheet-head">
          <Link href="/today" className="sheet-x" aria-label="Close the session rating">
            <span aria-hidden="true">✕</span>
          </Link>
          <h1 className="t">Rate a session</h1>
          <span style={{ width: 44 }} />
        </div>
        <div className="after-card">
          <h2 className="after-heading">This session isn&rsquo;t there</h2>
          <p className="after-note">
            It may have been cancelled or is not one of yours. Nothing is lost, there is nothing to
            rate.
          </p>
        </div>
        <div className="subm">
          <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
            Back to Today
          </Link>
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

  /* Both gates from lib/rpeDue.ts, the rule Today's to-do row reads: due
     thirty minutes after the end (a session with no duration now counts as
     ending when it starts — it used to skip this gate entirely), closed at
     the end of the following day in club time, the moment the row
     disappears. Nothing in the database refuses a late row; see rpeClosesAt
     for why that is deliberate. */
  const now = Date.now();
  const notYetDue = now < rpeDueAt(session);
  const closed = rpeIsClosed(session, timezone, now);

  return (
    <>
      <div className="sheet-head">
        <Link href="/today" className="sheet-x" aria-label="Close the session rating">
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">{rpeRowName(session.title)}</h1>
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
        <>
          {/* ATH-ADULT-06, 2026-09-12: the fact the athlete came for is the
              largest thing — it is rated, what with, when — in the one
              emphasised card, with the recourse (a person, not a control)
              beneath and the exit as a footer button. The duration is not
              restated here: the session block above already carries it. */}
          <div className="after-card">
            <h2 className="after-heading">Already rated</h2>
            <p className="after-fact num">
              You rated this session {existing.rpe} of 10
              {existing.submitted_at
                ? ` at ${new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: timezone,
                  }).format(new Date(existing.submitted_at))}`
                : ''}
              .
            </p>
            <p className="after-note">
              You can&rsquo;t change a rating yourself. Tell your coach and they can correct it for
              you.
            </p>
            <p className="after-note">The original stays visible in My data, marked Corrected.</p>
          </div>
          <div className="subm">
            <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              Back to Today
            </Link>
          </div>
        </>
      ) : closed ? (
        <div className="banner">
          <span className="g g-faint" aria-hidden="true">
            ◌
          </span>
          <div>
            <b>This session can no longer be rated.</b> A rating is open until the
            end of the day after the session.
          </div>
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
