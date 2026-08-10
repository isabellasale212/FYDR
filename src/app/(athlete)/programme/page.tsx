import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState/EmptyState';
import { fetchMyProgrammeSessions } from '@/lib/queries/programmes';
import { fetchOutstandingCount } from '@/lib/queries/compliance';
import { fetchCheckinForWeek } from '@/lib/queries/nutrition';
import { resolveTargetForDate } from '@/lib/queries/nutritionTargets';
import { mondayOf } from '@/lib/queries/schedule';
import { Toast } from '@/components/Toast/Toast';
import { addDays, mdLabel, todayIso } from '@/lib/format';
import { requireAthlete } from '@/lib/session';

export const metadata = { title: 'My programme · Fydr' };

const TARGET_ROWS = [
  { key: 'energy_kcal', label: 'Energy', unit: ' kcal', litres: false },
  { key: 'protein_g', label: 'Protein', unit: 'g', litres: false },
  { key: 'carbs_g', label: 'Carbohydrate', unit: 'g', litres: false },
  { key: 'fluid_ml', label: 'Fluid', unit: 'L', litres: true },
] as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** screens/my-programme.md / ATHLETE-APP-SPEC.md §11, four cards: programme
 *  header, prescribed exercises (the gym/rehab session list this screen
 *  already had), nutrition targets, and a rehab card only when one exists.
 *
 * The spec's nutrition-targets bars plot intake against target (§11's own
 * numbers: "3,050 / 3,200 kcal · 95%"). There is no real "3,050" anywhere —
 * CLAUDE.md rule 8 and the live schema agree there is no daily intake
 * table to compute one from (see nutritionTargets.ts's own comment on
 * exactly this cut). What's real is the target half only, so these rows
 * show the standing target with no progress fill rather than a fabricated
 * percentage — the same "guidance only, nothing to log" framing Today's
 * card used before this pass folded it in here instead of keeping the
 * same numbers in two places.
 *
 * No "assigned by" line: programme_assignments carries no coach name this
 * query resolves today. No rehab-phase card: still the Injuries clinical
 * boundary's own territory, not this screen's, per this file's own
 * previous note. */
export default async function MyProgrammePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { db, athleteId, timezone } = await requireAthlete();
  const params = await searchParams;
  const today = todayIso(timezone);
  const nutritionWeekStart = addDays(mondayOf(today), -7);

  const [sessions, nutritionCheckin, target] = await Promise.all([
    fetchMyProgrammeSessions(db, athleteId),
    fetchCheckinForWeek(db, athleteId, nutritionWeekStart),
    resolveTargetForDate(db, athleteId, today),
  ]);
  const outstanding = await fetchOutstandingCount(db, athleteId, today, !!nutritionCheckin);

  const programmeName = sessions[0]?.programme_name ?? null;
  const programmeType = sessions[0]?.programme_type ?? null;
  const blockName = sessions[0]?.block_name ?? null;
  const weekNumber = sessions[0]?.week_number ?? null;

  return (
    <>
      <div className="hd">
        <h1 className="d">My programme</h1>
        <span className={`pill status-pill ${outstanding > 0 ? 'pill-warn' : 'pill-good'}`}>
          {outstanding > 0 ? (
            <>
              <span className="mono">{outstanding}</span> to do
            </>
          ) : (
            'Up to date'
          )}
        </span>
      </div>

      {typeof params.submitted === 'string' ? (
        <Toast message="Gym session logged." clearHref="/programme" />
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="No programme assigned"
          body="Nothing has been assigned to you yet. Check back once your coach or physio sets one up."
        />
      ) : (
        <>
          <div className="prog-header">
            <p className="eyebrow">
              {programmeType === 'rehab' ? 'Rehab' : 'Gym'}
              {blockName ? ` · ${blockName}` : ''}
              {weekNumber ? ` · Week ${weekNumber}` : ''}
            </p>
            <h1>{programmeName}</h1>
          </div>

          <div className="card">
            <h2 className="card-title">Sessions</h2>
            <div className="card flush" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
              {sessions.map((s, index) => (
                <div key={s.session_id}>
                  {index > 0 ? <div className="hair" /> : null}
                  <Link
                    href={`/gym/${s.session_id}`}
                    className="load-row"
                    style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
                  >
                    <div>
                      <span className="nm">{s.session_name}</span>
                      <div className="tiny">
                        {s.block_name} · Week {s.week_number}
                        {s.day_number ? ` · Day ${s.day_number}` : ''}
                        {mdLabel(s.md_offset) ? ` · ${mdLabel(s.md_offset)}` : ''}
                      </div>
                    </div>
                    <span className="chev" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {target ? (
        <div className="card">
          <h2 className="card-title">Nutrition targets</h2>
          <p className="import-sub">
            {target.md_specific ? `Set for ${mdLabel(target.md_offset) ?? 'today'}.` : 'Your standing target.'}{' '}
            Guidance only &mdash; nothing to log here.
          </p>
          {TARGET_ROWS.map((row) => {
            const raw = target[row.key];
            if (raw === null) return null;
            const value = row.litres ? (raw / 1000).toFixed(1) : raw;
            return (
              <div className="target-bar" key={row.key}>
                <div className="th">
                  <span className="k">{row.label}</span>
                  <span className="v mono">
                    {value}
                    {row.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
