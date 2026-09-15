'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toUserMessage, withWriteTimeout } from '@/lib/writeErrors';
import {
  addExerciseToSession,
  assignProgramme,
  setAssignmentStartDate,
  createBlock,
  createSession,
  type Assignee,
  type BlockWithSessions,
  type Exercise,
} from '@/lib/queries/programmes';
import type { LoadBasis, ProgrammeType } from '@/lib/types/database';
import { enumLabel, formatDate, mdLabel } from '@/lib/format';
import type { AssignmentArithmetic } from '@/lib/assignmentCount';
import { assignmentEndsOn, assignmentFinished, programmeLengthWeeks } from '@/lib/programmeDates';

type Athlete = { id: string; first_name: string; last_name: string };
type Group = { id: string; name: string };

type Props = {
  orgId: string;
  userId: string;
  programmeId: string;
  programmeType: ProgrammeType;
  canEdit: boolean;
  blocks: readonly BlockWithSessions[];
  exercises: readonly Exercise[];
  assignees: readonly Assignee[];
  /** PATTERN-S5 C4 (2026-09-13): the distinct athlete count and its
   *  arithmetic — lib/assignmentCount.ts — the Assigned card's headline. */
  assignment: AssignmentArithmetic;
  athletes: readonly Athlete[];
  groups: readonly Group[];
  programmeName: string;
  /** The club's today (todayIso(timezone)) — the start date's default, and
   *  what "finished" is judged against. programme-dates.md (0132). */
  today: string;
  timezone: string;
  /* athlete id -> their open injury id. Empty for every viewer who is not an
     S&C, which is what makes the proposal path theirs alone. Passed as DATA
     rather than as a predicate: a function prop on a Client Component
     typechecks and then throws at runtime. */
  openInjuryByAthlete: Record<string, string>;
};

const LOAD_BASES: LoadBasis[] = ['absolute', 'percent_1rm', 'percent_bw', 'rpe', 'none'];
// percent_1rm is back on this picker (migration 0043 — audit finding 29). It
// only ever resolves for an exercise with exercises.one_rm_test_definition_id
// set, so the option stays selectable here — the exercise picker just above
// determines whether it can actually be prescribed, per
// screens/programme-builder.md's own validation rule: "percent_1rm chosen and
// exercises.one_rm_test_definition_id is null → Block". Link a test from the
// exercise library (/programmes/exercises) first.

export function ProgrammeBuilder({
  orgId,
  userId,
  programmeId,
  programmeType,
  canEdit,
  blocks,
  exercises,
  assignees,
  assignment,
  athletes,
  groups,
  programmeName,
  today,
  timezone,
  openInjuryByAthlete,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [addingBlock, setAddingBlock] = useState(false);
  const [blockName, setBlockName] = useState('');
  const [blockWeeks, setBlockWeeks] = useState('4');

  const [addingSessionTo, setAddingSessionTo] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [sessionWeek, setSessionWeek] = useState('1');
  const [sessionDay, setSessionDay] = useState('1');

  const [addingExerciseTo, setAddingExerciseTo] = useState<string | null>(null);
  const [exerciseId, setExerciseId] = useState(exercises[0]?.id ?? '');
  const [sets, setSets] = useState('3');
  const [repsMin, setRepsMin] = useState('8');
  const [repsMax, setRepsMax] = useState('10');
  const [loadBasis, setLoadBasis] = useState<LoadBasis>('absolute');
  const [loadValue, setLoadValue] = useState('');
  const [restSeconds, setRestSeconds] = useState('90');

  const [assigning, setAssigning] = useState(false);
  const [assignScope, setAssignScope] = useState<'athlete' | 'group'>('athlete');
  const [assignAthleteId, setAssignAthleteId] = useState(athletes[0]?.id ?? '');
  const [assignGroupId, setAssignGroupId] = useState(groups[0]?.id ?? '');
  /* programme-dates.md: the S&C chooses week 1 day 1 at the moment they
     assign. Defaults to today — a date, never an invented one on the row. */
  const [assignStartsOn, setAssignStartsOn] = useState(today);

  const blockMutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        createBlock(createClient(), orgId, programmeId, {
          name: blockName,
          sequence: blocks.length + 1,
          durationWeeks: Number(blockWeeks) || 4,
          focus: null,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setAddingBlock(false);
      setBlockName('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const sessionMutation = useMutation({
    mutationFn: (blockId: string) =>
      withWriteTimeout(
        createSession(createClient(), orgId, blockId, {
          name: sessionName,
          weekNumber: Number(sessionWeek) || 1,
          dayNumber: sessionDay.trim() === '' ? null : Number(sessionDay),
          sequence: (blocks.find((b) => b.id === blockId)?.sessions.length ?? 0) + 1,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setAddingSessionTo(null);
      setSessionName('');
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  const exerciseMutation = useMutation({
    mutationFn: (sessionId: string) =>
      withWriteTimeout(
        addExerciseToSession(createClient(), orgId, sessionId, {
          exerciseId,
          sequence:
            (blocks.flatMap((b) => b.sessions).find((s) => s.id === sessionId)?.exercise_count ?? 0) + 1,
          sets: Number(sets) || 1,
          repsMin: repsMin.trim() === '' ? null : Number(repsMin),
          repsMax: repsMax.trim() === '' ? null : Number(repsMax),
          loadBasis,
          loadValue: loadValue.trim() === '' ? null : Number(loadValue),
          restSeconds: restSeconds.trim() === '' ? null : Number(restSeconds),
          notes: null,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setAddingExerciseTo(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  /* An injured athlete, chosen by an S&C, makes this a proposal rather than an
     assignment: it is written as 'proposed', linked to the injury, and reaches
     the athlete only when the medic signs it off. Group assignments are never
     proposals — a group is not one person with one injury. */
  const proposedInjuryId =
    assignScope === 'athlete' ? (openInjuryByAthlete[assignAthleteId] ?? null) : null;

  const assignMutation = useMutation({
    mutationFn: () =>
      withWriteTimeout(
        assignProgramme(createClient(), orgId, userId, {
          programmeId,
          athleteId: assignScope === 'athlete' ? assignAthleteId : null,
          groupId: assignScope === 'group' ? assignGroupId : null,
          programmeType,
          programmeName,
          proposeAgainstInjuryId: proposedInjuryId,
          startsOn: assignStartsOn,
        }),
      ),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setAssigning(false);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });

  /* Setting (or moving) an assignment's start date — an assignment made
     before dates existed is unmapped until the S&C sets one here. */
  const [datingId, setDatingId] = useState<string | null>(null);
  const [datingValue, setDatingValue] = useState(today);
  const dateMutation = useMutation({
    mutationFn: (input: { assignmentId: string; startsOn: string }) =>
      withWriteTimeout(setAssignmentStartDate(createClient(), orgId, input.assignmentId, input.startsOn)),
    onSuccess: (result) => {
      if (result.error) return setError(result.error);
      setError(null);
      setDatingId(null);
      router.refresh();
    },
    onError: (err) => setError(toUserMessage(err, 'staff')),
  });
  const lengthWeeks = programmeLengthWeeks(blocks, null);

  return (
    <div className="stack">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {blocks.map((block) => (
        <section key={block.id} className="card">
          <h2 className="card-title">
            {block.name} <span className="tiny num">{block.duration_weeks}w</span>
          </h2>
          {block.sessions.length === 0 ? (
            <p className="tiny">No sessions yet.</p>
          ) : (
            <div className="stack" style={{ gap: 'var(--sp-6)' }}>
              {block.sessions.map((s) => (
                <div key={s.id}>
                  <div className="load-row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <div>
                      <span className="nm">{s.name}</span>
                      <div className="tiny">
                        Week {s.week_number}
                        {s.day_number ? ` · Day ${s.day_number}` : ''}
                        {/* Not the audit-B2 bug class — see programmes/page.tsx's note:
                            programme_sessions.md_offset is an authored template value,
                            no fixture_id, nothing to re-anchor. */}
                        {mdLabel(s.md_offset) ? ` · ${mdLabel(s.md_offset)}` : ''} · {s.exercise_count}{' '}
                        exercise{s.exercise_count === 1 ? '' : 's'}
                      </div>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setAddingExerciseTo(addingExerciseTo === s.id ? null : s.id);
                          setExerciseId(exercises[0]?.id ?? '');
                        }}
                      >
                        + Exercise
                      </button>
                    ) : null}
                  </div>
                  {addingExerciseTo === s.id ? (
                    <div className="card" style={{ marginTop: 'var(--sp-8)', borderColor: 'var(--accent)' }}>
                      {exercises.length === 0 ? (
                        <p className="tiny">
                          No exercises in the library yet. Add one on the exercise library page first.
                        </p>
                      ) : (
                        <div className="stack" style={{ gap: 'var(--sp-8)' }}>
                          <label>
                            <span className="label">Exercise</span>
                            <select className="field" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
                              {exercises.map((ex) => (
                                <option key={ex.id} value={ex.id}>
                                  {ex.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
                            <label style={{ flex: 1 }}>
                              <span className="label">Sets</span>
                              <input className="field" type="number" inputMode="numeric" min="1" value={sets} onChange={(e) => setSets(e.target.value)} />
                            </label>
                            <label style={{ flex: 1 }}>
                              <span className="label">Reps min</span>
                              <input className="field" type="number" inputMode="numeric" min="0" value={repsMin} onChange={(e) => setRepsMin(e.target.value)} />
                            </label>
                            <label style={{ flex: 1 }}>
                              <span className="label">Reps max</span>
                              <input className="field" type="number" inputMode="numeric" min="0" value={repsMax} onChange={(e) => setRepsMax(e.target.value)} />
                            </label>
                          </div>
                          <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
                            <label style={{ flex: 1 }}>
                              <span className="label">Load basis</span>
                              <select
                                className="field"
                                value={loadBasis}
                                onChange={(e) => setLoadBasis(e.target.value as LoadBasis)}
                              >
                                {LOAD_BASES.map((b) => (
                                  <option key={b} value={b}>
                                    {enumLabel(b)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ flex: 1 }}>
                              <span className="label">
                                {loadBasis === 'absolute'
                                  ? 'Load (kg)'
                                  : loadBasis === 'percent_1rm'
                                    ? '% of 1RM'
                                    : loadBasis === 'percent_bw'
                                      ? '% bodyweight'
                                      : loadBasis === 'rpe'
                                        ? 'Target RPE'
                                        : 'Load'}
                              </span>
                              {/* A bodyweight exercise says what it logs, in
                                  words (PATTERN-S5, 2026-09-12): a plain value,
                                  not a disabled field — the row says which
                                  numbers this screen owns. */}
                              {loadBasis === 'none' ? (
                                <span className="nm pb-reads-only">logs reps only</span>
                              ) : (
                                <input
                                  className="field"
                                  type="number"
                                  step="0.5"
                                  inputMode="decimal"
                                  value={loadValue}
                                  onChange={(e) => setLoadValue(e.target.value)}
                                />
                              )}
                            </label>
                            <label style={{ flex: 1 }}>
                              <span className="label">Rest (s)</span>
                              <input
                                className="field"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                value={restSeconds}
                                onChange={(e) => setRestSeconds(e.target.value)}
                              />
                            </label>
                          </div>
                          {loadBasis === 'percent_1rm' && !exercises.find((e) => e.id === exerciseId)?.one_rm_test_definition_id ? (
                            <p className="form-error" role="alert">
                              {exercises.find((e) => e.id === exerciseId)?.name ?? 'This exercise'} has no linked 1RM
                              test — link one from the exercise library first, or choose a different load basis. A
                              percentage with nothing to resolve against would show every athlete “1RM not on file”.
                            </p>
                          ) : null}
                          <div style={{ display: 'flex', gap: 'var(--sp-10)' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => exerciseMutation.mutate(s.id)}
                              disabled={
                                exerciseMutation.isPending ||
                                (loadBasis === 'percent_1rm' && !exercises.find((e) => e.id === exerciseId)?.one_rm_test_definition_id)
                              }
                            >
                              {exerciseMutation.isPending ? 'Adding…' : 'Add to session'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setAddingExerciseTo(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {canEdit ? (
            addingSessionTo === block.id ? (
              <div className="card" style={{ marginTop: 'var(--sp-10)', borderColor: 'var(--accent)' }}>
                <div className="stack" style={{ gap: 'var(--sp-8)' }}>
                  <label>
                    <span className="label">Session name</span>
                    <input className="field" value={sessionName} onChange={(e) => setSessionName(e.target.value)} placeholder="Lower A" />
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--sp-8)' }}>
                    <label style={{ flex: 1 }}>
                      <span className="label">Week</span>
                      <input className="field" type="number" inputMode="numeric" min="1" value={sessionWeek} onChange={(e) => setSessionWeek(e.target.value)} />
                    </label>
                    <label style={{ flex: 1 }}>
                      <span className="label">Day (optional)</span>
                      <input className="field" type="number" inputMode="numeric" min="1" max="7" value={sessionDay} onChange={(e) => setSessionDay(e.target.value)} />
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--sp-10)' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!sessionName.trim() || sessionMutation.isPending}
                      onClick={() => sessionMutation.mutate(block.id)}
                    >
                      {sessionMutation.isPending ? 'Adding…' : 'Add session'}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setAddingSessionTo(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-ghost"
                style={{ marginTop: 'var(--sp-10)' }}
                onClick={() => {
                  setAddingSessionTo(block.id);
                  setSessionName('');
                }}
              >
                + Session
              </button>
            )
          ) : null}
        </section>
      ))}

      {canEdit ? (
        addingBlock ? (
          <div className="card" style={{ borderColor: 'var(--accent)' }}>
            <div className="stack" style={{ gap: 'var(--sp-8)' }}>
              <label>
                <span className="label">Block name</span>
                <input className="field" value={blockName} onChange={(e) => setBlockName(e.target.value)} placeholder="Accumulation" />
              </label>
              <label>
                <span className="label">Duration, weeks</span>
                <input className="field" type="number" inputMode="numeric" min="1" max="20" value={blockWeeks} onChange={(e) => setBlockWeeks(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 'var(--sp-10)' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!blockName.trim() || blockMutation.isPending}
                  onClick={() => blockMutation.mutate()}
                >
                  {blockMutation.isPending ? 'Adding…' : 'Add block'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setAddingBlock(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setAddingBlock(true)}>
            + Block
          </button>
        )
      ) : null}

      <section className="card" aria-labelledby="assign-title">
        <h2 className="card-title" id="assign-title">
          Assigned
        </h2>
        {/* PATTERN-S5 C4: the headline is distinct athletes against the
            squad, never assignment rows or group sizes added; the arithmetic
            beneath it says how the number was reached. */}
        <p className="pb-assign-headline num">{assignment.headline}</p>
        {assignment.arithmetic ? (
          <p className="tiny pb-assign-arith num">{assignment.arithmetic}</p>
        ) : null}
        {assignees.length === 0 ? (
          <p className="tiny">Nobody assigned yet.</p>
        ) : (
          /* One row per assignment, with its dates (programme-dates.md, 0132):
             week 1 day 1 and the last day that falls out of it, or "no start
             date" for one made before dates existed — set here, the next time
             it is touched. Overlap is allowed, so nothing here checks it. */
          <div className="stack" style={{ gap: 'var(--sp-6)' }}>
            {assignees.map((a) => {
              const endsOn = assignmentEndsOn(a.starts_on, lengthWeeks);
              const finished = assignmentFinished(a.starts_on, today, lengthWeeks);
              return (
                <div key={a.id} className="chiprow" style={{ alignItems: 'center' }} data-assignment-row>
                  <span className="chip-static">{a.athlete_name ?? a.group_name}</span>
                  {datingId === a.id ? (
                    <>
                      <input
                        className="field"
                        type="date"
                        value={datingValue}
                        onChange={(e) => setDatingValue(e.target.value)}
                        aria-label={`Start date for ${a.athlete_name ?? a.group_name}`}
                        style={{ maxWidth: 180 }}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => dateMutation.mutate({ assignmentId: a.id, startsOn: datingValue })}
                        disabled={dateMutation.isPending}
                      >
                        {dateMutation.isPending ? 'Saving…' : 'Save date'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setDatingId(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tiny num">
                        {a.starts_on === null
                          ? 'no start date'
                          : `from ${formatDate(a.starts_on, timezone)}${endsOn ? ` to ${formatDate(endsOn, timezone)}` : ''}${finished ? ' · finished' : ''}`}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ minHeight: 32, padding: '5px var(--s-6)' }}
                          onClick={() => {
                            setDatingValue(a.starts_on ?? today);
                            setDatingId(a.id);
                          }}
                        >
                          {a.starts_on === null ? 'Set start date' : 'Change date'}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {canEdit ? (
          assigning ? (
            <div style={{ marginTop: 'var(--sp-10)' }}>
              <div className="chiprow">
                <button type="button" className="squad-chip" aria-pressed={assignScope === 'athlete'} onClick={() => setAssignScope('athlete')}>
                  One athlete
                </button>
                <button
                  type="button"
                  className="squad-chip"
                  aria-pressed={assignScope === 'group'}
                  onClick={() => setAssignScope('group')}
                  disabled={groups.length === 0}
                >
                  A group
                </button>
              </div>
              <div style={{ marginTop: 'var(--sp-8)' }}>
                {assignScope === 'athlete' ? (
                  <select className="field" value={assignAthleteId} onChange={(e) => setAssignAthleteId(e.target.value)}>
                    {athletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.first_name} {a.last_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select className="field" value={assignGroupId} onChange={(e) => setAssignGroupId(e.target.value)}>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div style={{ marginTop: 'var(--sp-8)' }}>
                <label className="label" htmlFor="assign-starts-on">
                  Starts on
                </label>
                <input
                  id="assign-starts-on"
                  className="field"
                  type="date"
                  value={assignStartsOn}
                  onChange={(e) => setAssignStartsOn(e.target.value)}
                  style={{ maxWidth: 200 }}
                />
                <p className="tiny" style={{ marginTop: 'var(--sp-4)' }}>
                  Week 1, day 1 is this day.
                  {lengthWeeks !== null && assignmentEndsOn(assignStartsOn, lengthWeeks)
                    ? ` ${lengthWeeks} week${lengthWeeks === 1 ? '' : 's'}: the last day is ${formatDate(assignmentEndsOn(assignStartsOn, lengthWeeks), timezone)}.`
                    : ''}
                </p>
              </div>
              {programmeType === 'rehab' && assignScope === 'athlete' ? (
                <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
                  Assigning this rehab programme will suspend any active gym programme this
                  athlete is already on.
                </p>
              ) : null}
              {/* Said BEFORE the button, not after the write. The S&C should know
                  the block is going to sit and wait for the medic while they are
                  still choosing, rather than pressing Assign and finding out from
                  a changed label. */}
              {proposedInjuryId ? (
                <p className="tiny" style={{ marginTop: 'var(--sp-6)' }}>
                  This athlete has an open injury, so this goes to the medic as a
                  proposal. It will not reach the athlete until a medic signs it off.
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: 'var(--sp-10)', marginTop: 'var(--sp-10)' }}>
                <button type="button" className="btn-primary" onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending}>
                  {assignMutation.isPending
                    ? proposedInjuryId
                      ? 'Proposing…'
                      : 'Assigning…'
                    : proposedInjuryId
                      ? 'Propose'
                      : 'Assign'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setAssigning(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn-ghost" style={{ marginTop: 'var(--sp-10)' }} onClick={() => setAssigning(true)}>
              + Assign
            </button>
          )
        ) : null}
      </section>
    </div>
  );
}
