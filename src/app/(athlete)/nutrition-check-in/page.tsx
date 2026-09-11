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
  /* ATH-ADULT-08: after submit, the subhead names the thing — the real week
     — never "this week", which is the only correct form for a week a month
     gone. The form itself carries the week in its eyebrow. */
  const weekLabel = `${formatDate(weekStart, timezone)} to ${formatDate(weekEnd, timezone)}`;
  const answerLabel = existing ? (existing.answer === 'yes' ? 'Yes' : existing.answer === 'roughly' ? 'Roughly' : 'No') : null;
  const sentAt = existing?.submitted_at
    ? `${formatDate(existing.submitted_at.slice(0, 10), timezone)} at ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(existing.submitted_at))}`
    : null;
  const afterSubmit = !!existing && !correcting;

  return (
    <>
      <div className="sheet-head">
        <div className="sheet-head-row">
          <div style={{ minWidth: 0 }}>
            <h1 className="t">Weekly check-in</h1>
            {afterSubmit ? <p className="s num">{weekLabel}</p> : null}
          </div>
          <Link href="/today" className="sheet-x" aria-label="Close the check-in">
            <span aria-hidden="true">✕</span>
          </Link>
        </div>
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
        <>
          {/* ATH-ADULT-08, 2026-09-12. The fact the athlete came for — it is
              answered, what with, when — in the one emphasised card; the
              existing sentence about correction beneath it; and the two ways
              out as 44px buttons in the footer: leaving is the common case and
              takes the primary, correcting is the secondary under it.

              THE ANSWER IS THE SPEC'S WORD — Yes / Roughly / No — not the
              board's "Yes, most days / Some days": the wording of an answer
              changes what it means (CLAUDE.md §0.06, D1 in the record).

              NO "once" CAPTION AND NO SPENT STATE: revise_nutrition_checkin
              enforces no once-only rule today, so a caption promising one
              would be untrue. Recorded as C1–C3. */}
          <div className="after-card">
            <h2 className="after-heading">Already answered</h2>
            <p className="after-fact">
              You answered <span className="num">{answerLabel}</span>.
            </p>
            {sentAt ? <p className="after-note num">Sent {sentAt}.</p> : null}
            <p className="after-note">
              This is the one entry you can change yourself. A correction creates a new revision and
              the original is kept.
            </p>
          </div>
          <div className="subm subm-stack">
            <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              Back to Today
            </Link>
            <Link
              href={`/nutrition-check-in?week=${weekStart}&correct=1`}
              className="btn-ghost"
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              Correct this answer
            </Link>
          </div>
        </>
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
