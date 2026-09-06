import type { AppRole, InjuryTimelineEventType, Json } from '@/lib/types/database';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

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
  status: 'proposed' | 'active';
};

/** Proposals against one injury, both still-pending and already signed off.
 *
 *  Both, rather than only 'proposed', because the medic's screen has to be able
 *  to say "signed off" about the one they approved a minute ago. Filtering to
 *  pending would make an approved proposal vanish from the screen that approved
 *  it, which reads as a failed write. */
export async function fetchInjuryProposals(
  db: Db,
  orgId: string,
  injuryId: string,
): Promise<InjuryProposal[]> {
  const { data, error } = await db
    .from('programme_assignments')
    .select('id, programme_id, starts_on, ends_on, status, programmes(name)')
    .eq('org_id', orgId)
    .eq('injury_id', injuryId)
    .in('status', ['proposed', 'active'])
    .order('starts_on', { ascending: false });
  if (error) throw new Error(error.message);
  type Row = {
    id: string;
    programme_id: string;
    starts_on: string;
    ends_on: string | null;
    status: 'proposed' | 'active';
    programmes: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    assignment_id: r.id,
    programme_id: r.programme_id,
    programme_name: r.programmes?.name ?? 'Programme',
    starts_on: r.starts_on,
    ends_on: r.ends_on,
    status: r.status,
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

/** The medic makes a proposed block live.
 *
 *  Two writes, assignment first. If the event write fails the assignment is
 *  still active, which is the right way round: the athlete has their programme
 *  and the log is short one line, rather than a log that claims a sign-off that
 *  did not happen. */
export async function signOffProposal(
  db: Db,
  orgId: string,
  userId: string,
  input: { assignmentId: string; injuryId: string; programmeName: string },
): Promise<{ error: string | null }> {
  const activated = await mustAffect(
    db
      .from('programme_assignments')
      .update({ status: 'active' })
      .eq('org_id', orgId)
      .eq('id', input.assignmentId)
      .select('id'),
    { refusal: 'Not signed off: making an injury-linked block live belongs to the medic.' },
  );
  if (activated.error) return activated;

  return recordInjuryEvent(db, orgId, userId, 'medic', {
    injuryId: input.injuryId,
    type: 'programme_signed_off',
    payload: { assignment_id: input.assignmentId, programme: input.programmeName },
  });
}

/** The medic sends a proposal back, with a reason.
 *
 *  The reason becomes its own `note` event authored by the medic and linked to
 *  the proposal (decided 2026-09-06) rather than a field on the assignment. Two
 *  consequences worth stating: a second round of changes appends a second note
 *  instead of overwriting the first, so the back-and-forth survives; and the
 *  reason is medic-readable only, like everything else on this timeline.
 *
 *  The assignment itself is left at 'proposed' and is not modified at all — the
 *  S&C edits their own draft in place, which migration 0080's policy allows
 *  precisely so this loop works without a second status. */
export async function requestProposalChanges(
  db: Db,
  orgId: string,
  userId: string,
  input: { assignmentId: string; injuryId: string; reason: string },
): Promise<{ error: string | null }> {
  const reason = input.reason.trim();
  if (reason === '') return { error: 'Say what needs changing — the S&C only sees the reason you give.' };

  return recordInjuryEvent(db, orgId, userId, 'medic', {
    injuryId: input.injuryId,
    type: 'note',
    payload: { assignment_id: input.assignmentId, text: reason, kind: 'changes_requested' },
  });
}
