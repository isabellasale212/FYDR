import Link from 'next/link';
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

/* 'kg' is only a safe assumption for absolute loads on genuinely loaded
 * categories — audit finding 31's confirmed example is live data: Box jump
 * is prescribed absolute=60 where 60 is a box height in cm, not a kg load,
 * found while building this migration by querying the org's own programme_
 * exercises rows. plyo/conditioning/mobility exercises show the bare number
 * instead of asserting a unit the schema does not track; the exercise's own
 * notes (already rendered under its name) carry the real unit until this
 * domain has a measurement_type column (real, open gap, too large for this
 * pass — see this page's own note below the table). */
function loadLabel(ex: ResolvedExercise): string {
  if (ex.load_basis === 'none') return 'Bodyweight';
  if (ex.load_basis === 'absolute') {
    if (ex.load_value === null) return '—';
    const bare = ex.category === 'plyo' || ex.category === 'conditioning' || ex.category === 'mobility';
    return bare ? String(ex.load_value) : `${ex.load_value} kg`;
  }
  if (ex.load_basis === 'percent_1rm') {
    if (ex.load_value === null) return '—';
    // This is the squad-generic view — no athlete to resolve against, so it
    // never fabricates a kilogram figure here (that only happens on the
    // per-athlete view, /programmes/[id]/athlete/[athleteId]). What it CAN
    // say honestly, with no athlete in scope, is whether resolution is even
    // possible at all for anyone.
    return ex.one_rm_linked ? `${ex.load_value}% 1RM` : `${ex.load_value}% 1RM — no 1RM test linked`;
  }
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
 *  Two things the spec's own detail view assumes that this schema does not
 *  have, all documented once here rather than silently faked:
 *   - No block start date, so no "week 3 of 8" — programme_blocks has a
 *     sequence and a duration in weeks, not a calendar anchor. The eyebrow
 *     shows block position ("Block 1 of 2"), not a week count.
 *   - No session duration or session "type" (strength/power) column — only
 *     a name, day_number, md_offset. The day header shows what's real.
 *
 *  exercise_overrides exists now (migration 0043, audit findings 29/32) but
 *  this screen still cannot show it meaningfully: it has no athlete in
 *  scope, so the Override column stays "—" here on purpose — showing
 *  tailoring against a squad-generic row would either mean "at least one
 *  assigned athlete has an override on this exercise" (loses who and what)
 *  or nothing at all. The real answer lives one click away, per athlete, at
 *  /programmes/[id]/athlete/[athleteId] — linked from the detail page below.
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
                  /* Marked in the list, not only once opened: rehab is
                     medical's to author and everything else is coach's (see
                     this page's own footer), so which entries are not yours to
                     edit should be visible before you click one. */
                  data-rehab={p.programme_type === 'rehab'}
                >
                  <div className="nm">{p.name}</div>
                  {/* The tint says "this one is different"; the pill says how.
                      A colour alone is not a label, and rehab is the one
                      programme type with a different author and a different
                      reader (CLAUDE.md rule 3), so it gets named. */}
                  {p.programme_type === 'rehab' ? (
                    <span className="pill pill-bad" style={{ marginLeft: 8 }}>
                      rehab
                    </span>
                  ) : null}
                  <div className="tiny" style={{ marginTop: 3 }}>
                    {assignedLine(p)}
                  </div>
                </Link>
              ))}
            </div>
            {isCoach || isMedical ? (
              <Link
                href="/programmes/new"
                className="btn-primary"
                style={{ marginTop: 12, width: '100%', display: 'inline-flex', justifyContent: 'center' }}
              >
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
                  {/* sessionsFlat below shows every block's sessions together,
                   *  not one block at a time — "Block 1 of N" falsely implied
                   *  only the first block was on screen. An honest count,
                   *  disambiguated per-session by blockName where it matters
                   *  (below, when there's more than one block). */}
                  {detail.blocks.length > 0 ? ` · ${detail.blocks.length} block${detail.blocks.length === 1 ? '' : 's'}` : ''}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.025em' }}>{selected.name}</h2>
                  <span className={`pill ${selected.status === 'active' ? 'pill-good' : 'pill-neutral'}`}>
                    {enumLabel(selected.status)}
                  </span>
                  <span className="pill pill-accent">
                    {selected.assigned_athlete_count} athlete{selected.assigned_athlete_count === 1 ? '' : 's'}
                  </span>
                  {/* Duplicate and Assign used to sit here as disabled
                   *  buttons with no write path behind them — an audit
                   *  finding: dead controls in the header teach a coach
                   *  that buttons on this screen might not work. Hidden
                   *  until they do something real; assignment happens in
                   *  the programme builder, linked below. */}
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
                      // Not the audit-B2 bug class: programme_sessions.md_offset is an
                      // authored template value ("this day sits at MD-2"), with no
                      // fixture_id and no calendar date to drift against — unlike
                      // sessions.md_offset (schedule), which is "computed, stored for
                      // history" against a specific fixture_id and can go stale. There
                      // is no real week to re-anchor this to via anchorMdOffsetsToWeek.
                      const md = mdLabel(s.md_offset);
                      return (
                        <div key={s.id} className="prog-day">
                          <div className="prog-day-head">
                            {/* The gym bolt: the design system's single
                                coloured icon, in --gym gold, hand-authored on
                                the 14x14 viewBox every icon in this app uses. */}
                            <svg width="15" height="15" viewBox="0 0 14 14" fill="var(--gym)" aria-hidden="true">
                              <path d="M8.4 0L2.2 8h3.3L5.1 14L11.8 5.6H8.1z" />
                            </svg>
                            <span className="nm">{s.name}</span>
                            <span className="tiny">
                              {s.day_number !== null ? `Day ${s.day_number}` : 'Not day-anchored'}
                            </span>
                            {md ? <span className="pill pill-accent">{md}</span> : null}
                            {/* Which block this session belongs to — only shown
                             *  when there's more than one, since every block's
                             *  sessions render together in this one flat list. */}
                            {detail.blocks.length > 1 ? <span className="tiny">{s.blockName}</span> : null}
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
                                    <span className="prog-ex-num">{ex.sets}</span>
                                    <span className="prog-ex-num">{repsLabel(ex)}</span>
                                    <span className="prog-ex-num">{loadLabel(ex)}</span>
                                    <span className="prog-ex-num" data-quiet="true">
                                      —
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
                )}

              </div>
            )}
          </div>
        </div>
      )}

    </>
  );
}
