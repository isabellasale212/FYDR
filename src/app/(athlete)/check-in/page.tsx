import Link from 'next/link';
import { CheckInForm } from '@/components/CheckInForm/CheckInForm';
import { fetchWellnessByAthlete, fetchWellnessDay } from '@/lib/queries/wellness';
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
  const [existing, recent] = await Promise.all([
    fetchWellnessDay(db, athleteId, entryDate),
    fetchWellnessByAthlete(db, athleteId, {
      from: addDays(entryDate, -7),
      to: addDays(entryDate, -1),
    }),
  ]);

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

              NO "Corrected" PILL YET: the board draws one for a past day
              corrected by staff, but this page's fetch reads
              wellness_entries_current without revision_of, so the page cannot
              tell a corrected day from an original. That is a query change,
              recorded as C1 in docs/overnight-records-2026-09-12.md. */}
          <div className="after-card">
            <h2 className="after-heading">Already submitted</h2>
            <p className="after-fact num">
              {entryDate === today ? 'You sent today' : `You sent ${formatDate(entryDate, timezone)}`}
              &rsquo;s check-in at{' '}
              {existing.submitted_at
                ? new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: timezone,
                  }).format(new Date(existing.submitted_at))
                : '—'}
              .
            </p>
            {/* The recourse is a person, not a control: a control that can
              * never become enabled for this reader is a worse answer than a
              * sentence telling them who can do the thing, and what happens to
              * the original — the reason an athlete hesitates to report a
              * mistake is the fear that "correcting it" means someone sees them
              * changing their answer. */}
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
