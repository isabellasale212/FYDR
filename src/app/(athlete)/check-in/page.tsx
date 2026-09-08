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
            <p className="s">
              45 seconds &middot; <b>5 is always the best you can feel</b>
            </p>
          </div>
          <Link href={backHref} className="sheet-x" aria-label="Close the check-in">
            <span aria-hidden="true">✕</span>
          </Link>
        </div>
      </div>

      {existing ? (
        <div className="card">
          <h2 className="card-title">Already submitted</h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            {entryDate === today ? 'You sent today' : `You sent ${formatDate(entryDate, timezone)}`}
            &rsquo;s check-in at{' '}
            <span className="num">
              {existing.submitted_at
                ? new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: timezone,
                  }).format(new Date(existing.submitted_at))
                : '—'}
            </span>
            .
          </p>
          {/* What used to be a "Correct this entry" link. It is prose, not a
            * disabled button: a control that can never become enabled for this
            * reader is a worse answer than a sentence telling them who can do
            * the thing. Says what happens to the original too, because the
            * reason an athlete hesitates to report a mistake is the fear that
            * "correcting it" means someone sees them changing their answer —
            * they should know it is recorded either way. */}
          <p className="import-sub" style={{ margin: '10px 0 0' }}>
            A submitted check-in can&rsquo;t be edited, by you or by anyone. If
            something in it is wrong, tell your coach: they can record a
            correction against it from your profile. If they do, My Data marks
            that day <b>Corrected</b> and shows you what you first reported.
          </p>
          <p className="cap" style={{ display: 'flex', gap: 14 }}>
            <Link href={backHref}>Back</Link>
          </p>
        </div>
      ) : entryDate === today ? (
        <CheckInForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          entryDate={today}
          lastNightSleepHours={lastSleep}
        />
      ) : (
        <div className="card">
          <h2 className="card-title">Nothing submitted</h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            No check-in was recorded for {formatDate(entryDate, timezone)}, and a
            past day can&rsquo;t be filled in after the fact.
          </p>
          <p className="cap">
            <Link href={backHref}>Back</Link>
          </p>
        </div>
      )}
    </>
  );
}
