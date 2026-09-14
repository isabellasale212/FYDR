import type { AppRole, InjuryTimelineEventType, Json } from '@/lib/types/database';
import type { Db } from './groups';

/** The injury <-> S&C programme link: one timeline per injury, and a programme
 *  assignment that is not live until the medic signs it off.
 *
 *  WHO READS WHAT, because it is the unusual part and every function here
 *  depends on it. The S&C WRITES to the timeline and cannot READ it — decided
 *  2026-09-06 as a general rule rather than for this feature alone. The reason
 *  is the `note` event type: it is free text attached to an injury, so a
 *  readable log would become a second channel for clinical detail alongside
 *  injury_clinical, which is medic-only and enforced in the database. The S&C
 *  loses nothing they need: the state that concerns them is their own
 *  assignment reading 'proposed' until it goes active, and that lives on
 *  programme_assignments, which they already read.
 *
 *  So `fetchInjuryTimeline` is medic-only and the caller must not invoke it for
 *  anyone else. RLS returns zero rows rather than raising for a non-medic
 *  (injury_timeline_medic_select, migration 0080), which means a page that
 *  called it for an S&C would render an empty timeline rather than fail — a
 *  wrong screen, not a leak, but still wrong. Same two-layer reasoning as
 *  fetchInjuryClinical: the policy is the guarantee, not calling it is the
 *  second layer.
 *
 *  WHAT IS NOT HERE. No update and no delete, for anything in this file.
 *  `authenticated` holds no UPDATE or DELETE grant on injury_timeline_event at
 *  all, so history cannot be rewritten through any path this app could add
 *  later. Two of the five event types are not written from here either:
 *  injury_logged and stage_change are written by triggers on `injuries`
 *  (migrations 0080, 0081), so a stage change recorded through a future import
 *  or a fixture still lands on the timeline. */

export type InjuryTimelineEvent = {
  id: string;
  type: InjuryTimelineEventType;
  payload: Record<string, unknown>;
  created_at: string;
  created_by_role: AppRole;
  author_name: string | null;
};

type TimelineRow = {
  id: string;
  type: InjuryTimelineEventType;
  payload: unknown;
  created_at: string;
  created_by_role: AppRole;
  users: { full_name: string | null } | null;
};

/** MEDIC ONLY — see the header. Oldest first: this is a story, not a feed. */
export async function fetchInjuryTimeline(
  db: Db,
  orgId: string,
  injuryId: string,
): Promise<InjuryTimelineEvent[]> {
  const { data, error } = await db
    .from('injury_timeline_event')
    .select('id, type, payload, created_at, created_by_role, users(full_name)')
    .eq('org_id', orgId)
    .eq('injury_id', injuryId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as TimelineRow[]).map((r) => ({
    id: r.id,
    type: r.type,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    created_at: r.created_at,
    created_by_role: r.created_by_role,
    /* The role is snapshotted on the row and the name is joined live. If the
       person has since been removed the join yields nothing, and the event
       still reads "the S&C proposed a block" rather than disappearing. */
    author_name: r.users?.full_name ?? null,
  }));
}

/** The athlete's open injury, if they have one.
 *
 *  Used on the assign path to decide whether a new assignment is an ordinary one
 *  or a proposal. Reads `injuries` only — never injury_clinical — so it is safe
 *  for the S&C, who holds INJURY_ACCESS but no clinical read. */
export async function fetchOpenInjuryId(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('injuries')
    .select('id')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .neq('status', 'closed')
    .order('onset_date', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.id ?? null;
}

/** Every athlete in the club with an open injury, keyed by athlete id.
 *
 *  One query for the whole assign screen rather than one per athlete in the
 *  picker: the programme builder has to know, for any athlete the S&C might
 *  choose, whether choosing them turns an assignment into a proposal. Reads
 *  `injuries` only, so it is safe for every role that holds INJURY_ACCESS.
 *
 *  Most recent onset wins where an athlete has more than one open injury. The
 *  proposal is linked to one of them, and the newest is the one the block is
 *  being written around. */
export async function fetchOpenInjuryIdsByAthlete(
  db: Db,
  orgId: string,
): Promise<Record<string, string>> {
  const { data, error } = await db
    .from('injuries')
    .select('id, athlete_id, onset_date')
    .eq('org_id', orgId)
    .neq('status', 'closed')
    .order('onset_date', { ascending: false });
  if (error) throw new Error(error.message);
  const byAthlete: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!byAthlete[row.athlete_id]) byAthlete[row.athlete_id] = row.id;
  }
  return byAthlete;
}

export type InjuryProposal = {
  assignment_id: string;
  programme_id: string;
  programme_name: string;
  starts_on: string;
  ends_on: string | null;
  /** 'returned' since 0124 (PATTERN-S3 C6): the medic sent it back with a
   *  reason, carried on the row so the S&C reads it on the proposals list. */
  status: 'proposed' | 'active' | 'returned';
  return_reason: string | null;
};

/** Proposals against one injury: pending, signed off and returned.
 *
 *  All three, rather than only 'proposed', because the medic's screen has to
 *  be able to say "signed off" or "returned" about the one they decided a
 *  minute ago. Filtering to pending would make a decided proposal vanish from
 *  the screen that decided it, which reads as a failed write. */
export async function fetchInjuryProposals(
  db: Db,
  orgId: string,
  injuryId: string,
): Promise<InjuryProposal[]> {
  const { data, error } = await db
    .from('programme_assignments')
    .select('id, programme_id, starts_on, ends_on, status, return_reason, programmes(name)')
    .eq('org_id', orgId)
    .eq('injury_id', injuryId)
    .in('status', ['proposed', 'active', 'returned'])
    .order('starts_on', { ascending: false });
  if (error) throw new Error(error.message);
  type Row = {
    id: string;
    programme_id: string;
    starts_on: string;
    ends_on: string | null;
    status: 'proposed' | 'active' | 'returned';
    return_reason: string | null;
    programmes: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    assignment_id: r.id,
    programme_id: r.programme_id,
    programme_name: r.programmes?.name ?? 'Programme',
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    status: r.status,
    return_reason: r.return_reason,
  }));
}

/** Write one event as the acting role.
 *
 *  `role` is passed in rather than derived here because the policy requires the
 *  writer to actually hold the role they record (migration 0080), and the
 *  caller is the only place that knows which of a multi-role account's roles it
 *  is acting as. A dual coach/S&C proposing a block is acting as the S&C.
 *
 *  NO .select() ON THIS WRITE, and it is the one place in this codebase where
 *  that is correct rather than the G-36 bug. Found by running it, as the S&C,
 *  against the real policy — it is invisible to reasoning and to typechecking.
 *
 *  lib/write.ts says to chain .select() so a refused write cannot read as a
 *  success. That works because PostgREST returns the affected rows. But
 *  RETURNING is a READ, and Postgres applies the SELECT policy to it: the S&C
 *  may write to this table and may never read it, so
 *  `insert(...).select('id')` raises 42501 on a row that inserted perfectly
 *  well. The screen then tells the S&C their proposal was not recorded when it
 *  was — a FALSE refusal, which is the same class of lie as a false success and
 *  arguably worse, because it invites them to try again.
 *
 *  Nothing is lost by dropping it. G-36 is about UPDATE and DELETE, where a
 *  USING mismatch changes no rows and raises nothing. An INSERT that fails
 *  WITH CHECK *does* raise 42501, so the error below is a complete account of
 *  whether the row was written. write.ts's own header states this distinction
 *  in its opening paragraph; this is the first write that actually depends on
 *  it. supabase/tests/400 asserts both halves so the .select() cannot come
 *  back. */
export async function recordInjuryEvent(
  db: Db,
  orgId: string,
  userId: string,
  role: AppRole,
  input: { injuryId: string; type: InjuryTimelineEventType; payload?: Record<string, unknown> },
): Promise<{ error: string | null }> {
  const { error } = await db.from('injury_timeline_event').insert({
    org_id: orgId,
    injury_id: input.injuryId,
    created_by: userId,
    created_by_role: role,
    type: input.type,
    payload: (input.payload ?? {}) as Json,
  });
  if (!error) return { error: null };
  return /row-level security|policy/i.test(error.message)
    ? { error: 'Not saved: only the medic and the S&C can add to an injury timeline.' }
    : { error: error.message };
}

/** The medic approves a proposal — the block goes live for the athlete.
 *
 *  0124 (PATTERN-S3 C6): one write for both surfaces. decide_proposal sets
 *  'active', stamps decided_by/decided_at and writes the programme_signed_off
 *  event itself, so this screen and /programmes/proposals cannot disagree
 *  about what approval is. */
export async function signOffProposal(db: Db, assignmentId: string): Promise<{ error: string | null }> {
  const { error } = await db.rpc('decide_proposal', { p_assignment_id: assignmentId, p_decision: 'approve', p_reason: '' });
  if (error) return { error: proposalDecisionError(error.message) };
  return { error: null };
}

function proposalDecisionError(message: string): string {
  if (/42501|belongs to the medic/.test(message)) return 'Not saved: deciding an injury-linked block belongs to the medic.';
  if (/not_a_proposal/.test(message)) return 'Not saved: that block has already been decided.';
  if (/reason_required/.test(message)) return 'Say what needs changing — the S&C reads the reason on the proposals list.';
  return message;
}

/** The medic sends a proposal back, with a reason.
 *
 *  0124 (PATTERN-S3 C6) replaced the 2026-09-06 shape. The reason now lives on
 *  the assignment row (`return_reason`), which the S&C reads on
 *  /programmes/proposals — the board's "one list both roles see" — and the
 *  status moves to 'returned'. decide_proposal still appends the reason to
 *  the injury timeline as the medic's `note` event, so the clinical log is
 *  unchanged and a second round is a second note. The S&C answers a returned
 *  proposal by assigning again; the returned row stays as the record. */
export async function requestProposalChanges(db: Db, assignmentId: string, rawReason: string): Promise<{ error: string | null }> {
  const reason = rawReason.trim();
  if (reason === '') return { error: 'Say what needs changing — the S&C reads the reason on the proposals list.' };
  const { error } = await db.rpc('decide_proposal', { p_assignment_id: assignmentId, p_decision: 'return', p_reason: reason });
  if (error) return { error: proposalDecisionError(error.message) };
  return { error: null };
}

/** What the profile card says about this injury's rehab programme.
 *
 *  Three states, and 'none' is one of them rather than a null. A medic looking
 *  at the profile needs to tell "nothing proposed yet" apart from "something is
 *  waiting on me", and rendering nothing for the first is indistinguishable from
 *  a card that failed to load.
 *
 *  Week N of M is derived, not stored, and degrades rather than invents: a
 *  programme with no duration_weeks reports its name and no week count instead of
 *  guessing one. N is clamped to M so a block that has run over does not read
 *  "week 6 of 4".
 *
 *  A PROPOSAL WINS OVER A RUNNING PROGRAMME when both exist, because it is the
 *  one with an action attached — the medic can read "active" any time, but a
 *  proposal is waiting on them specifically. */
export type InjuryProgrammeStatus =
  | { kind: 'none' }
  | { kind: 'proposed'; name: string }
  | { kind: 'active'; name: string; week: number | null; totalWeeks: number | null };

export async function fetchInjuryProgrammeStatus(
  db: Db,
  orgId: string,
  injuryId: string,
): Promise<InjuryProgrammeStatus> {
  const { data, error } = await db
    .from('programme_assignments')
    .select('status, starts_on, programmes(name, duration_weeks)')
    .eq('org_id', orgId)
    .eq('injury_id', injuryId)
    .in('status', ['proposed', 'active'])
    .order('starts_on', { ascending: false });
  if (error) throw new Error(error.message);

  type Row = {
    status: 'proposed' | 'active';
    starts_on: string;
    programmes: { name: string; duration_weeks: number | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return { kind: 'none' };

  const proposed = rows.find((r) => r.status === 'proposed');
  if (proposed) return { kind: 'proposed', name: proposed.programmes?.name ?? 'a programme' };

  const live = rows[0]!;
  const totalWeeks = live.programmes?.duration_weeks ?? null;
  const started = Date.parse(`${live.starts_on}T12:00:00Z`);
  const elapsed = Number.isNaN(started)
    ? null
    : Math.floor((Date.now() - started) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const week =
    elapsed === null || elapsed < 1 ? null : totalWeeks === null ? elapsed : Math.min(elapsed, totalWeeks);

  return { kind: 'active', name: live.programmes?.name ?? 'a programme', week, totalWeeks };
}
