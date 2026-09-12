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

  const existing = await fetchCheckinForWeek(db, athleteId, weekStart);
  /* ATH-ADULT-08 C1–C3 (2026-09-12). ONCE. A check-in can be corrected one
     time (migration 0107 refuses a second as entry_already_corrected). The
     page reads the chain, so a spent week is refused BEFORE the form is
     offered: ?correct=1 on it shows the spent state, never a form that fails
     on save. ?saved=1 is only a heading choice on top of the same read — the
     server re-reads the chain, nothing about the state is trusted from the
     URL. */
  const spent = !!existing?.prior;
  const justSaved = spent && params.saved === '1';
  const correcting = params.correct === '1' && !!existing && !spent;
  const weekEnd = addDays(weekStart, 6);
  /* ATH-ADULT-08: after submit, the subhead names the thing — the real week
     — never "this week", which is the only correct form for a week a month
     gone. The form itself carries the week in its eyebrow. */
  const weekLabel = `${formatDate(weekStart, timezone)} to ${formatDate(weekEnd, timezone)}`;
  const label = (answer: 'yes' | 'roughly' | 'no'): string => (answer === 'yes' ? 'Yes' : answer === 'roughly' ? 'Roughly' : 'No');
  const stamp = (iso: string): string =>
    `${formatDate(iso.slice(0, 10), timezone)} at ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone }).format(new Date(iso))}`;
  const answerLabel = existing ? label(existing.answer) : null;
  const priorLabel = existing?.prior ? label(existing.prior.answer) : null;
  const sentAt = existing?.submitted_at ? stamp(existing.submitted_at) : null;
  /* When the live row is the correction, its submitted_at is when the
     correction was made; the original's is when the week was first answered. */
  const correctedAt = existing?.prior && existing.submitted_at ? stamp(existing.submitted_at) : null;
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
          lastCompletedWeek={lastCompletedWeek}
          correction={{
            originalId: existing.id,
            initialAnswer: existing.answer,
            initialNote: existing.note ?? '',
          }}
        />
      ) : existing && justSaved ? (
        <>
          {/* C2: a saved correction stays here rather than leaving for My data,
              so the athlete sees it landed — the new answer, when, the
              original kept, and that it cannot change again. */}
          <div className="after-card">
            <h2 className="after-heading">Correction saved</h2>
            <p className="after-fact">
              You answered <span className="num">{answerLabel}</span>.
            </p>
            <p className="after-note num">
              Saved {correctedAt}. Your original answer, {priorLabel}, is kept.
            </p>
            <p className="after-note">My data shows the week marked Corrected, with both versions.</p>
            <p className="after-note">This answer can’t be changed again.</p>
          </div>
          <div className="subm subm-stack">
            <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              Back to Today
            </Link>
          </div>
        </>
      ) : existing && spent ? (
        <>
          {/* C1, the spent state: the one correction is used. Stated before
              any control, with the Corrected pill beside the heading (the
              same mark the wellness check-in carries), both values named,
              and the coach as the remaining route. No correction offered. */}
          <div className="after-card">
            <h2 className="after-heading">
              Already answered
              <span className="pill pill-neutral" style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                Corrected
              </span>
            </h2>
            <p className="after-fact">
              You answered <span className="num">{answerLabel}</span>.
            </p>
            <p className="after-note num">
              Corrected {correctedAt}. Originally {priorLabel}.
            </p>
            <p className="after-note">
              You have used your one correction for this check-in, so it can’t be changed again.
            </p>
            <p className="after-note">If it still looks wrong, tell your coach. Both versions stay visible in My data.</p>
          </div>
          <div className="subm subm-stack">
            <Link href="/today" className="btn-primary" style={{ display: 'flex', justifyContent: 'center' }}>
              Back to Today
            </Link>
          </div>
        </>
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

              THE "once" CAPTION (C3) sits in the footer above the buttons,
              and is true since migration 0107 — a second correction is
              refused, and this page shows the spent state instead of the
              form (C1). */}
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
            <p className="cap subm-caption">You can correct this once after you submit.</p>
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
          lastCompletedWeek={lastCompletedWeek}
        />
      )}
    </>
  );
}
