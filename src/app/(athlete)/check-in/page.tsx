import Link from 'next/link';
import { CheckInForm } from '@/components/CheckInForm/CheckInForm';
import { fetchWellnessByAthlete, fetchWellnessDay } from '@/lib/queries/wellness';
import { fetchWellnessWithRevisions } from '@/lib/queries/entryRevisions';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Morning check-in · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reached two ways: plain `/check-in` for today's entry (the everyday path), or
 *  `/check-in?date=...` from My Data to look at a past day. `date` only ever
 *  narrows which existing entry is SHOWN — a date with no entry yet does not
 *  open a backdated submission form, which is a different, undiscussed feature.
 *
 *  The third way is gone: `?correct=1` used to put CheckInForm into a correction
 *  mode that called `revise_wellness_entry`. Migration 0058 made that RPC
 *  coach/medical only at the club's request, so the parameter is no longer read
 *  and no longer linked to anywhere. An athlete who has an old bookmark lands on
 *  the ordinary "Already submitted" card below, which tells them what to do
 *  instead — not on a form that would collect six answers and then refuse them. */
export default async function CheckInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();
  const today = todayIso(timezone);
  const params = await searchParams;
  const requestedDate = typeof params.date === 'string' ? params.date : today;
  const entryDate = requestedDate > today ? today : requestedDate;

  /* TWO QUERIES AGAIN. The seven-day window exists to find the previous
     night's sleep hours for the reference beside the stepper. The redesign
     removed that reference and this query with it; both are back, because
     "7.0" with nothing to compare it to gives an athlete no way to notice they
     have typed last night's number into tonight's field. */
  const [existing, recent, chains] = await Promise.all([
    fetchWellnessDay(db, athleteId, entryDate),
    fetchWellnessByAthlete(db, athleteId, {
      from: addDays(entryDate, -7),
      to: addDays(entryDate, -1),
    }),
    /* ATH-ADULT-04 C1 (decided 2026-09-12): the day's revision chain — the
       read My data's history rows use — so a corrected day is told from an
       original. The _current view alone cannot say. */
    fetchWellnessWithRevisions(db, orgId, athleteId, { from: entryDate, to: entryDate }),
  ]);
  /* Corrected: a chain with something behind the live row, the same test My
     data applies. C4: naming who corrected it is what My data already does,
     and docs/athlete/visibility.md withholds nothing about it. */
  const corrected = chains.find((c) => c.priorRevisions.length > 0) ?? null;
  /* "You sent … at": the athlete's own submission time. The _current row on a
     corrected day is the staff revision, stamped with the correction's
     moment; the original is the oldest row in the chain. */
  const sentAt = corrected?.priorRevisions[0]?.submitted_at ?? existing?.submitted_at ?? null;

  const lastSleep =
    [...recent].reverse().find((e) => e.sleep_hours !== null)?.sleep_hours ?? null;

  const backHref = entryDate === today ? '/today' : '/my-data?tab=wellness';
  /* ATH-ADULT-04: the exit is a button labelled after where it goes. Today's
     entry returns to Today; a past day opened from My data returns to My data.
     There is no referrer to consult — the branch is the destination. */
  const backLabel = entryDate === today ? 'Back to Today' : 'Back to My data';

  return (
    <>
      {/* Spec §7.2: a drag handle, then the title at 22/800 with its sub
          beneath, and a 34px round close on the right. The title it replaces
          was 16px and centred between the close and the date, which read as a
          dialog's chrome rather than as the name of the thing being done.

          "This morning" is 23c's title and is right for the common case; a
          check-in opened for another day says which day instead, because
          "this morning" would then be false. */}
      {/* No drag handle, against §7.2 and deliberately: this is a route, not a
          sheet over a scrim, and it has no swipe-to-dismiss. A handle that does
          not drag is a lie about a gesture. The rest of §7.2's header is
          here. */}
      <div className="sheet-head">
        <div className="sheet-head-row">
          <div style={{ minWidth: 0 }}>
            <h1 className="t">
              {entryDate === today ? 'This morning' : formatDate(entryDate, timezone)}
            </h1>
            {/* ATH-ADULT-04: the form's subhead belongs to the form. It used
                to render unconditionally, telling an athlete who had already
                submitted how long a task takes that they could not start. 23c's
                directive — how long it takes, then the one rule that makes
                every scale readable — now appears only when the form does. */}
            {!existing && entryDate === today ? (
              <p className="s">
                45 seconds &middot; <b>5 is always the best you can feel</b>
              </p>
            ) : null}
          </div>
          <Link href={backHref} className="sheet-x" aria-label="Close the check-in">
            <span aria-hidden="true">✕</span>
          </Link>
        </div>
      </div>

      {existing ? (
        <>
          {/* ATH-ADULT-04, 2026-09-12. The fact the athlete came for is the
              largest thing on the screen: it is in, when, and what to do if
              it is wrong — in that order. One emphasised card (--wash-accent),
              nothing decorative in the space below it, and the way out is a
              44px button in the footer labelled after its destination.

              THE "Corrected" PILL (C1, 2026-09-12) sits beside the heading for
              a day staff corrected, with who and when beneath the fact — the
              same words as My data's history row. */}
          <div className="after-card">
            <h2 className="after-heading">
              Already submitted
              {corrected ? (
                <span className="pill pill-neutral" style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                  Corrected
                </span>
              ) : null}
            </h2>
            <p className="after-fact num">
              {entryDate === today ? 'You sent today' : `You sent ${formatDate(entryDate, timezone)}`}
              &rsquo;s check-in at{' '}
              {sentAt
                ? new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: timezone,
                  }).format(new Date(sentAt))
                : '—'}
              .
            </p>
            {/* The recourse is a person, not a control: a control that can
              * never become enabled for this reader is a worse answer than a
              * sentence telling them who can do the thing, and what happens to
              * the original — the reason an athlete hesitates to report a
              * mistake is the fear that "correcting it" means someone sees them
              * changing their answer. */}
            {corrected ? (
              <p className="after-note">
                {`Corrected by ${corrected.correctedBy ?? 'a member of staff'}${
                  corrected.correctedAt ? ` on ${formatDate(corrected.correctedAt, timezone)}` : ''
                }. What you first reported is in My data.`}
              </p>
            ) : null}
            <p className="after-note">
              You can&rsquo;t change an entry yourself. Tell your coach or medical staff and they
              can correct it for you.
            </p>
            <p className="after-note">The original stays visible in My data, marked Corrected.</p>
          </div>
          <div className="subm">
            <Link href={backHref} className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              {backLabel}
            </Link>
          </div>
        </>
      ) : entryDate === today ? (
        <CheckInForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          entryDate={today}
          lastNightSleepHours={lastSleep}
        />
      ) : (
        <>
          <div className="after-card">
            <h2 className="after-heading">Nothing submitted</h2>
            <p className="after-note">
              No check-in was recorded for {formatDate(entryDate, timezone)}, and a past day
              can&rsquo;t be filled in after the fact.
            </p>
          </div>
          <div className="subm">
            <Link href={backHref} className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              {backLabel}
            </Link>
          </div>
        </>
      )}
    </>
  );
}
