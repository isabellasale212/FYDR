import Link from 'next/link';
import { CheckInForm } from '@/components/CheckInForm/CheckInForm';
import { fetchWellnessByAthlete, fetchWellnessDay } from '@/lib/queries/wellness';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Morning check-in · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Reached two ways: plain `/check-in` for today's entry (the everyday
 *  path), or `/check-in?date=...&correct=1` from My Data's "Correct this
 *  entry" link (wellness-entry.md's documented entry point) to revise a
 *  past day. `date` only ever narrows which existing entry is shown or
 *  corrected — a date with no entry yet and no `correct` flag does not open
 *  a backdated submission form, which is a different, undiscussed feature
 *  from correcting one that already exists. */
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
  const correcting = params.correct === '1';

  const [existing, recent] = await Promise.all([
    fetchWellnessDay(db, athleteId, entryDate),
    fetchWellnessByAthlete(db, athleteId, {
      from: addDays(entryDate, -7),
      to: addDays(entryDate, -1),
    }),
  ]);

  const lastSleep =
    [...recent].reverse().find((e) => e.sleep_hours !== null)?.sleep_hours ??
    null;

  const backHref = entryDate === today ? '/today' : '/my-data?tab=wellness';

  return (
    <>
      <div className="sheet-head">
        <Link href={backHref} className="sheet-x" aria-label="Close the check-in">
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">
          {correcting ? 'Correct check-in' : 'Morning check-in'}
        </h1>
        <span
          className="tiny mono"
          style={{ width: 56, textAlign: 'end', whiteSpace: 'nowrap' }}
        >
          {formatDate(entryDate)}
        </span>
      </div>

      {existing && existing.id && correcting ? (
        <CheckInForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          entryDate={entryDate}
          lastNightSleepHours={lastSleep}
          correction={{
            originalId: existing.id,
            initial: {
              sleep_hours: existing.sleep_hours,
              sleep_quality: existing.sleep_quality,
              fatigue: existing.fatigue,
              soreness: existing.soreness,
              stress: existing.stress,
              mood: existing.mood,
            },
          }}
        />
      ) : existing ? (
        <div className="card">
          <h2 className="card-title">Already submitted</h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            {entryDate === today ? 'You sent today' : `You sent ${formatDate(entryDate)}`}
            &rsquo;s check-in at{' '}
            <span className="mono">
              {existing.submitted_at
                ? new Intl.DateTimeFormat('en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                    timeZone: timezone,
                  }).format(new Date(existing.submitted_at))
                : '—'}
            </span>
            . Entries can&rsquo;t be edited directly &mdash; correcting one
            keeps the original and records a new, dated revision instead.
          </p>
          <p className="cap" style={{ display: 'flex', gap: 14 }}>
            <Link href={`/check-in?date=${entryDate}&correct=1`}>
              Correct this entry
            </Link>
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
            No check-in was recorded for {formatDate(entryDate)}. There is
            nothing to correct.
          </p>
          <p className="cap">
            <Link href={backHref}>Back</Link>
          </p>
        </div>
      )}
    </>
  );
}
