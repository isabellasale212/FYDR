import Link from 'next/link';
import { NutritionCheckinForm } from '@/components/NutritionCheckinForm/NutritionCheckinForm';
import { fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { mondayOf } from '@/lib/queries/schedule';
import { addDays, formatDate, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'Weekly check-in · Fydr' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/nutrition-checkin.md, screen 45. Spec presents this as a bottom
 *  sheet over Today; built as a full page instead, the same simplification
 *  already made for check-in and RPE. Defaults to the most recently
 *  completed week &mdash; "the ISO week just ended" &mdash; not the one in
 *  progress, even though the server's own insert policy technically allows
 *  the current week too; the UI never offers it, matching the spec's own
 *  entry-point table. */
export default async function NutritionCheckInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, orgId, athleteId, claims, timezone } = await requireAthlete();
  const params = await searchParams;
  const today = todayIso(timezone);
  const lastCompletedWeek = addDays(mondayOf(today), -7);
  const weekStart = typeof params.week === 'string' ? params.week : lastCompletedWeek;
  const correcting = params.correct === '1';

  const existing = await fetchCheckinForWeek(db, athleteId, weekStart);
  const weekEnd = addDays(weekStart, 6);

  return (
    <>
      <div className="sheet-head">
        <Link href="/today" className="sheet-x" aria-label="Close">
          <span aria-hidden="true">✕</span>
        </Link>
        <h1 className="t">Weekly check-in</h1>
        <span style={{ width: 44 }} />
      </div>

      {existing && existing.id && correcting ? (
        <NutritionCheckinForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          timezone={timezone}
          weekStart={weekStart}
          correction={{
            originalId: existing.id,
            initialAnswer: existing.answer,
            initialNote: existing.note ?? '',
          }}
        />
      ) : existing ? (
        <div className="card">
          <h2 className="card-title">
            <span className="g-good" aria-hidden="true">
              ✓{' '}
            </span>
            Already answered
          </h2>
          <p className="import-sub" style={{ marginBottom: 0 }}>
            For {formatDate(weekStart, timezone)} to {formatDate(weekEnd, timezone)}, you answered{' '}
            <b>
              {existing.answer === 'yes' ? 'Yes' : existing.answer === 'roughly' ? 'Roughly' : 'No'}
            </b>
            .
          </p>
          <p className="cap" style={{ display: 'flex', gap: 14 }}>
            <Link href={`/nutrition-check-in?week=${weekStart}&correct=1`}>Change this answer</Link>
            <Link href="/today">Back to today</Link>
          </p>
        </div>
      ) : (
        <NutritionCheckinForm
          orgId={orgId}
          athleteId={athleteId}
          userId={claims.userId}
          timezone={timezone}
          weekStart={weekStart}
        />
      )}
    </>
  );
}
