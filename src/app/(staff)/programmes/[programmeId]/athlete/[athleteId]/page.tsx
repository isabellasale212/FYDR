import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OverrideForm } from '@/components/OverrideForm/OverrideForm';
import { OverrideList } from '@/components/OverrideList/OverrideList';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchActiveOverridesForAthlete,
  fetchExercises,
  fetchProgrammeDetail,
  fetchProgrammeExerciseIndex,
  fetchSessionExercises,
  type ResolvedExercise,
} from '@/lib/queries/programmes';
import { enumLabel, formatDate, mdLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Athlete view · Fydr' };

function repsLabel(ex: ResolvedExercise): string {
  if (ex.reps_min === null) return '—';
  if (ex.reps_max === null || ex.reps_max === ex.reps_min) return `${ex.reps_min}`;
  return `${ex.reps_min}–${ex.reps_max}`;
}

/* 'kg' is only a safe assumption for absolute loads on genuinely loaded
 * categories. Audit finding 31's confirmed example — a Box jump prescribed
 * absolute=60 where 60 is a box height in cm, not a kg load — is real, live
 * data (checked while building this), not a hypothetical. plyo/conditioning/
 * mobility exercises show the bare number instead of asserting a unit the
 * schema does not actually carry; the exercise's notes field (already
 * rendered under its name) is where the real unit lives until this domain
 * has a measurement_type column — a real, larger, still-open gap (see this
 * file's own note further down) than this one display fix closes. */
function loadLabel(ex: ResolvedExercise, athleteName: string): string {
  if (ex.load_basis === 'none') return 'Bodyweight';
  if (ex.load_basis === 'absolute') {
    if (ex.load_value === null) return '—';
    const bare = ex.category === 'plyo' || ex.category === 'conditioning' || ex.category === 'mobility';
    return bare ? String(ex.load_value) : `${ex.load_value}kg`;
  }
  if (ex.load_basis === 'percent_bw') return ex.load_value !== null ? `${ex.load_value}% BW` : '—';
  if (ex.load_basis === 'rpe') return ex.load_value !== null ? `RPE ${ex.load_value}` : '—';
  // percent_1rm
  if (ex.resolved_load_kg !== null) {
    return `${ex.resolved_load_kg}kg (${ex.load_value}% 1RM${ex.one_rm_test_date ? `, tested ${formatDate(ex.one_rm_test_date)}` : ''})`;
  }
  if (!ex.one_rm_linked) return `${ex.load_value}% 1RM — no 1RM test linked to this exercise`;
  return `${ex.load_value}% 1RM — 1RM not on file for ${athleteName}`;
}

/** screens/programme-builder.md's "Tailor" tab, scoped to one athlete rather
 *  than the full athlete-by-exercise matrix (audit finding 29: "no per-athlete
 *  view exists"; migration 0043's own header explains why the matrix itself
 *  is not in scope). Two things this page answers that the squad-generic
 *  detail view at /programmes/[id] cannot: what does this specific athlete's
 *  prescription actually resolve to (overrides applied, percent_1rm turned
 *  into a real kilogram figure or an honest "not on file"), and what
 *  tailoring exists for them, with a real remove path. */
export default async function ProgrammeAthletePage({
  params,
}: {
  params: Promise<{ programmeId: string; athleteId: string }>;
}) {
  const { programmeId, athleteId } = await params;
  const { db, orgId, orgName, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');

  const [detail, athleteRow] = await Promise.all([
    fetchProgrammeDetail(db, orgId, programmeId),
    db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).eq('id', athleteId).maybeSingle(),
  ]);
  if (!detail || !athleteRow.data) notFound();

  const athleteName = `${athleteRow.data.first_name} ${athleteRow.data.last_name}`;
  const canEdit =
    (isCoach && detail.programme.programme_type !== 'rehab') ||
    (isMedical && detail.programme.programme_type === 'rehab');

  const sessionsFlat = detail.blocks.flatMap((b) => b.sessions.map((s) => ({ ...s, blockName: b.name })));
  const sessionIds = sessionsFlat.map((s) => s.id);

  const [exercisesBySession, exerciseIndex, exerciseLibrary] = await Promise.all([
    Promise.all(sessionsFlat.map(async (s) => [s.id, await fetchSessionExercises(db, s.id, athleteId)] as const)).then(
      (pairs) => new Map(pairs),
    ),
    fetchProgrammeExerciseIndex(db, sessionIds),
    fetchExercises(db, orgId),
  ]);

  const overrides = await fetchActiveOverridesForAthlete(
    db,
    orgId,
    exerciseIndex.map((e) => e.id),
    athleteId,
  );

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">
            <Link href="/programmes">Gym programme</Link> ·{' '}
            <Link href={`/programmes/${programmeId}`}>{detail.programme.name}</Link> · {athleteName}
          </p>
          <h1>{athleteName}’s programme</h1>
        </div>
        <ThemeToggle />
      </div>

      <p className="eyebrow" style={{ marginBottom: 14 }}>
        Squad · {orgName}
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <span className="pill pill-neutral">{enumLabel(detail.programme.programme_type)}</span>
        {!canEdit ? <span className="tiny">Read only for your role.</span> : null}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title">Tailoring for {athleteName}</h2>
        <OverrideList orgId={orgId} overrides={overrides} canEdit={canEdit} />
        {canEdit ? (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <p className="label" style={{ marginBottom: 8 }}>
              Add an override
            </p>
            <OverrideForm
              orgId={orgId}
              userId={claims.userId}
              athleteId={athleteId}
              exerciseOptions={exerciseIndex}
              substituteOptions={exerciseLibrary}
            />
          </div>
        ) : null}
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {sessionsFlat.map((s) => {
          const exercises = exercisesBySession.get(s.id) ?? [];
          const md = mdLabel(s.md_offset);
          return (
            <div key={s.id} className="card">
              <div className="prog-day-head">
                <span className="nm">
                  {s.blockName} — {s.name}
                </span>
                {md ? <span className="pill pill-accent">{md}</span> : null}
              </div>
              {exercises.length === 0 ? (
                <p className="tiny" style={{ marginTop: 8 }}>
                  Nothing prescribed here for {athleteName} — either the session is empty, or every exercise in it is
                  exempt for them (see Tailoring above).
                </p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <div style={{ minWidth: 480 }}>
                    <div className="prog-ex-row prog-ex-head tiny">
                      <span>Exercise</span>
                      <span>Sets</span>
                      <span>Reps</span>
                      <span>Load</span>
                      <span>Tailoring</span>
                    </div>
                    {exercises.map((ex) => (
                      <div key={ex.programme_exercise_id} className="prog-ex-row">
                        <span>
                          <span className="nm" style={{ fontSize: 13.5 }}>
                            {ex.exercise_name}
                          </span>
                          {ex.notes ? (
                            <span className="tiny" style={{ display: 'block' }}>
                              {ex.notes}
                            </span>
                          ) : null}
                        </span>
                        <span className="tiny">{ex.sets}</span>
                        <span className="tiny">{repsLabel(ex)}</span>
                        <span className="tiny">{loadLabel(ex, athleteName)}</span>
                        <span className="tiny">
                          {ex.is_overridden ? ex.override_types.map((t) => t.replace('_', ' ')).join(', ') : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="cap mono" style={{ marginTop: 14 }}>
        Non-lifting modalities (a jog, a hold) are still forced through this sets/reps/load
        table because programme_exercises has no measurement_type column — a real, open
        schema gap (audit finding 31), too large for this pass. What is shown above is honest
        rather than complete: no fabricated kg on a plyo/conditioning row (see loadLabel’s own
        comment), but a distance or duration still has nowhere structured to live except notes.
      </p>
    </>
  );
}
