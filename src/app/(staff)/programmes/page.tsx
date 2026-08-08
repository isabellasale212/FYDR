import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle/ThemeToggle';
import {
  fetchProgrammeDetail,
  fetchProgrammeListDetails,
  fetchSessionExercises,
  type ProgrammeListItem,
  type ResolvedExercise,
} from '@/lib/queries/programmes';
import { enumLabel, mdLabel } from '@/lib/format';
import { requireStaff } from '@/lib/session';

export const metadata = { title: 'Gym programme · Fydr' };

function loadLabel(ex: ResolvedExercise): string {
  if (ex.load_basis === 'none') return 'Bodyweight';
  if (ex.load_basis === 'absolute') return ex.load_value !== null ? `${ex.load_value}kg` : '—';
  if (ex.load_basis === 'percent_1rm') return ex.load_value !== null ? `${ex.load_value}% 1RM` : '—';
  if (ex.load_basis === 'percent_bw') return ex.load_value !== null ? `${ex.load_value}% BW` : '—';
  return ex.load_value !== null ? `RPE ${ex.load_value}` : '—';
}

function repsLabel(ex: ResolvedExercise): string {
  if (ex.reps_min === null) return '—';
  if (ex.reps_max === null || ex.reps_max === ex.reps_min) return `${ex.reps_min}`;
  return `${ex.reps_min}–${ex.reps_max}`;
}

function assignedLine(p: ProgrammeListItem): string {
  const athletes = `${p.assigned_athlete_count} athlete${p.assigned_athlete_count === 1 ? '' : 's'}`;
  const unit = p.programme_type === 'rehab' ? 'stage' : 'day';
  const sessions = `${p.session_count} ${unit}${p.session_count === 1 ? '' : 's'}`;
  return `${athletes} · ${sessions}`;
}

/** screens/gym-programmes.md rebuilt to GYM-PROGRAMME-SPEC.md's master-detail
 *  layout: a 300px programme list on the left, a full detail panel (blocks
 *  of day containers, each an exercise table) on the right, selection held
 *  in the URL (?p=<id>) rather than client state so a link to a specific
 *  programme is shareable and survives a refresh — the same pattern already
 *  used for the testing log's ?groups= filter.
 *
 *  Three things the spec's own detail view assumes that this schema does
 *  not have, all documented once here rather than silently faked:
 *   - No block start date, so no "week 3 of 8" — programme_blocks has a
 *     sequence and a duration in weeks, not a calendar anchor. The eyebrow
 *     shows block position ("Block 1 of 2"), not a week count.
 *   - No session duration or session "type" (strength/power) column — only
 *     a name, day_number, md_offset. The day header shows what's real.
 *   - No exercise_overrides table (migration 0021's own header says so
 *     explicitly, and GYM-PROGRAMME-SPEC.md §6 independently lists "the
 *     override editor" under "not designed") — so the Override column is
 *     always "—", captioned once, not fabricated per row.
 *
 *  Duplicate and Assign are real buttons, honestly inert (disabled, with a
 *  title explaining why) — GYM-PROGRAMME-SPEC.md §6 names both as
 *  prototype-only itself ("Assign should open a group picker... does
 *  nothing in the prototype"). The one real write path this build has —
 *  the full ProgrammeBuilder at /programmes/[id], create/edit blocks,
 *  sessions, exercises, and real assignment — is kept reachable via an
 *  "Edit programme" link per item, unchanged, not stranded by this rebuild. */
export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p: selectedParam } = await searchParams;
  const { db, orgId, orgName, claims } = await requireStaff();
  const isCoach = claims.roles.includes('coach');
  const isMedical = claims.roles.includes('medical');
  const programmes = await fetchProgrammeListDetails(db, orgId);

  const selected = programmes.find((p) => p.id === selectedParam) ?? programmes[0] ?? null;

  const detail = selected ? await fetchProgrammeDetail(db, orgId, selected.id) : null;
  const sessionsFlat = detail ? detail.blocks.flatMap((b) => b.sessions.map((s) => ({ ...s, blockName: b.name }))) : [];
  const exercisesBySession = new Map<string, ResolvedExercise[]>(
    await Promise.all(sessionsFlat.map(async (s) => [s.id, await fetchSessionExercises(db, s.id)] as const)),
  );

  const canEditSelected =
    !!selected && ((isCoach && selected.programme_type !== 'rehab') || (isMedical && selected.programme_type === 'rehab'));

  return (
    <>
      <div className="topbar">
        <div className="page-head">
          <p className="eyebrow">Squad · {orgName}</p>
          <h1>Gym programme</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/programmes/exercises" className="btn-ghost">
            Exercise library
          </Link>
          <ThemeToggle />
        </div>
      </div>

      {programmes.length === 0 ? (
        <div className="card">
          <p className="tiny">No programmes yet.</p>
          {isCoach || isMedical ? (
            <Link href="/programmes/new" className="btn-primary" style={{ marginTop: 12, display: 'inline-flex' }}>
              + New programme
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="prog-body">
          <div>
            <div className="stack" style={{ gap: 8 }}>
              {programmes.map((p) => (
                <Link
                  key={p.id}
                  href={`/programmes?p=${p.id}`}
                  className="prog-item"
                  data-selected={p.id === selected?.id}
                >
                  <div className="nm">{p.name}</div>
                  <div className="tiny" style={{ marginTop: 3 }}>
                    {assignedLine(p)}
                  </div>
                </Link>
              ))}
            </div>
            {isCoach || isMedical ? (
              <Link href="/programmes/new" className="btn-primary" style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}>
                + New programme
              </Link>
            ) : null}
          </div>

          <div className="prog-detail">
            {!selected || !detail ? (
              <div className="card">
                <p className="tiny">Programme not found.</p>
              </div>
            ) : (
              <div className="card">
                <p className="eyebrow">
                  {enumLabel(selected.programme_type)}
                  {detail.blocks.length > 0 ? ` · Block 1 of ${detail.blocks.length}` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 19 }}>{selected.name}</h2>
                  <span className="pill pill-neutral">{enumLabel(selected.status)}</span>
                  <span className="pill pill-accent">
                    {selected.assigned_athlete_count} athlete{selected.assigned_athlete_count === 1 ? '' : 's'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <button type="button" className="btn-ghost" disabled title="Not built yet — see the caption below.">
                      Duplicate
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled
                      title="Not built yet — assign athletes from the programme builder instead."
                    >
                      Assign
                    </button>
                  </div>
                </div>
                {selected.goal ? (
                  <p className="tiny" style={{ marginTop: 6 }}>
                    {selected.goal}
                  </p>
                ) : null}
                <p className="tiny" style={{ marginTop: 4 }}>
                  <Link href={`/programmes/${selected.id}`}>
                    {canEditSelected ? 'Edit this programme →' : 'View full detail →'}
                  </Link>
                </p>

                {sessionsFlat.length === 0 ? (
                  <p className="tiny" style={{ marginTop: 14 }}>
                    No sessions built for this programme yet.
                  </p>
                ) : (
                  <div className="stack" style={{ marginTop: 14, gap: 12 }}>
                    {sessionsFlat.map((s) => {
                      const exercises = exercisesBySession.get(s.id) ?? [];
                      const md = mdLabel(s.md_offset);
                      return (
                        <div key={s.id} className="prog-day">
                          <div className="prog-day-head">
                            <span className="nm">{s.name}</span>
                            <span className="tiny">
                              {s.day_number !== null ? `Day ${s.day_number}` : 'Not day-anchored'}
                            </span>
                            {md ? <span className="pill pill-accent">{md}</span> : null}
                          </div>
                          {exercises.length === 0 ? (
                            <p className="tiny" style={{ padding: '10px 12px' }}>
                              No exercises prescribed yet.
                            </p>
                          ) : (
                            <div style={{ overflowX: 'auto' }}>
                              <div style={{ minWidth: 430 }}>
                                <div className="prog-ex-row prog-ex-head tiny">
                                  <span>Exercise</span>
                                  <span>Sets</span>
                                  <span>Reps</span>
                                  <span>Load</span>
                                  <span>Override</span>
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
                                    <span className="tiny">{loadLabel(ex)}</span>
                                    <span className="tiny">—</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="cap mono" style={{ marginTop: 14 }}>
                  Overrides are per athlete and never rewrite the general programme — this build has no
                  exercise_overrides table yet, so Override reads &ldquo;&mdash;&rdquo; for every row rather than guessing.
                  Duplicate and Assign are real buttons with no write path behind them yet; assign a group or
                  athlete from the programme builder linked above instead.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="cap">
        Coach authors gym, conditioning and nutrition programmes. Medical authors rehab
        programmes only, and reads every gym programme for context.
      </p>
    </>
  );
}
