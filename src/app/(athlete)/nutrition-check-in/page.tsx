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
  // Every real link into this page (the "Change this answer" / "Correct" links
  // below, and check-in reminders elsewhere) only ever points at a week that
  // has already completed. A crafted ?week= is the one way to reach a future
  // week — the UI's own comment above already says it never offers one, so
  // clamp rather than trust the param, same pattern check-in/page.tsx uses for
  // its own ?date=. Minor gap, not a data leak: the server's insert policy
  // would accept a future week anyway, this just keeps this page honest about
  // what it actually offers.
  const requestedWeek = typeof params.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.week) ? params.week : lastCompletedWeek;
  const weekStart = requestedWeek > lastCompletedWeek ? lastCompletedWeek : requestedWeek;
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
          <p className="cap" style={{ display: 'flex', gap: 'var(--sp-14)' }}>
            {/* .linklike on both, 2026-09-10, for the reason set out on the
                check-in page's matching card: without it a <Link> inside a
                .cap renders rgb(72,78,87) / 13px / 400 / no underline, which
                is IDENTICAL to the caption prose around it — the global reset
                is `a { color: inherit; text-decoration: none }` and no
                `.cap a` rule exists. Measured here before the change, both
                links.

                IT MATTERS MORE HERE THAN THERE. On check-in the undecorated
                link was "Back", duplicating a 44px ✕ that did the same job.
                "Change this answer" is the ONLY route into the correction
                flow (ATH-ADULT-08) and it looked like a sentence.

                Scoped to this file rather than a shared `.cap a` rule, so it
                does not restyle rpe/[sessionId]'s already-rated card or
                leaderboards/manage's inline prose link. Target size is still
                19.5px against the 44px floor — left to the design proposal,
                because changing it changes layout. */}
            <Link
              href={`/nutrition-check-in?week=${weekStart}&correct=1`}
              className="linklike"
            >
              Change this answer
            </Link>
            <Link href="/today" className="linklike">
              Back to today
            </Link>
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
