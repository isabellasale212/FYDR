import type { SessionRow } from '@/lib/types/database';
import type { TrainingEntryInput } from '@/lib/validation/training';
import type { TrainingCorrection } from '@/lib/validation/entryCorrection';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';

export type RpeSession = Pick<
  SessionRow,
  'id' | 'title' | 'session_type' | 'starts_at' | 'duration_min' | 'location' | 'md_offset'
>;

const SESSION_COLUMNS = 'id, title, session_type, starts_at, duration_min, location, md_offset';

/** The session context row. Org-scoped: RLS would refuse a cross-org id
 *  anyway, but the query says so too rather than relying on RLS alone to
 *  turn a wrong id into an empty result.
 *
 *  Two more checks, added together (audit finding, Part B):
 *
 *  1. `deleted_at is null` — previously missing entirely, so a link to a
 *     since-soft-deleted session stayed ratable if it was open (or
 *     bookmarked) before the delete. One line, folded in here rather than
 *     given its own query.
 *
 *  2. A real participant check. This used to be org_id + id only, which
 *     means any athlete in the org could rate ANY session id in that org —
 *     not just one they were actually scheduled into — by editing the URL.
 *     `fetchAthleteRecentSessions` (this file's neighbour, schedule.ts)
 *     already filters this way for the session list; this is the exact
 *     same resolution (named individually, or via a group the athlete
 *     currently belongs to) ported to the single-session case, so an
 *     unscheduled session now returns null here — same as a cancelled or
 *     wrong-org one — and the page's existing "isn't there... or is not
 *     one of yours" copy (rpe/[sessionId]/page.tsx) already anticipated
 *     exactly this case.
 *
 *  This is the application-layer half of a two-layer fix. The RLS policy
 *  on training_entries (training_athlete_insert, migration 0012) is
 *  tightened to match in migration 0046 — see that migration's comment for
 *  why both layers are worth doing here (it turned out not to need a
 *  nontrivial function: the same EXISTS-over-session_participants shape
 *  the existing session_participants_self_select policy already uses).
 *  This check stays regardless: it denies access before the RPE form even
 *  renders, rather than letting the athlete fill it in and only fail on
 *  submit. */
export async function fetchSessionForRpe(
  db: Db,
  orgId: string,
  athleteId: string,
  sessionId: string,
): Promise<RpeSession | null> {
  const { data: session, error } = await db
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) return null;

  const [participants, memberships] = await Promise.all([
    db
      .from('session_participants')
      .select('athlete_id, group_id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId),
    db
      .from('group_memberships')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('removed_at', null),
  ]);

  if (participants.error) throw new Error(participants.error.message);
  if (memberships.error) throw new Error(memberships.error.message);

  const myGroups = new Set((memberships.data ?? []).map((m) => m.group_id));
  const isParticipant = (participants.data ?? []).some(
    (p) => p.athlete_id === athleteId || (p.group_id !== null && myGroups.has(p.group_id)),
  );

  return isParticipant ? session : null;
}

export type TrainingEntry = {
  id: string;
  rpe: number;
  duration_min: number;
  submitted_at: string | null;
};

/** Whether this athlete has already rated this session. `training_entries_
 *  current`, never the base table (README: read the view, never the base). */
export async function fetchTrainingEntryForSession(
  db: Db,
  athleteId: string,
  sessionId: string,
): Promise<TrainingEntry | null> {
  const { data, error } = await db
    .from('training_entries_current')
    .select('id, rpe, duration_min, submitted_at')
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || data.id === null || data.rpe === null || data.duration_min === null) {
    return null;
  }
  return {
    id: data.id,
    rpe: data.rpe,
    duration_min: data.duration_min,
    submitted_at: data.submitted_at,
  };
}

/** Insert a self-reported rating. session_load is computed server-side by the
 *  training_entries_session_load trigger (migration 0010): rpe × duration_min,
 *  never sent from the client, and never shown back to the athlete
 *  (screens/training-entry.md: "the session load is not shown"). */
export async function submitTrainingEntry(
  db: Db,
  input: TrainingEntryInput,
  identity: { orgId: string; athleteId: string; userId: string },
): Promise<void> {
  const { error } = await db.from('training_entries').insert({
    id: input.id,
    org_id: identity.orgId,
    athlete_id: identity.athleteId,
    session_id: input.session_id,
    entry_date: input.entry_date,
    rpe: input.rpe,
    duration_min: input.duration_min,
    comment: input.comment ? input.comment : null,
    source: 'self_report',
    created_by: identity.userId,
  });

  if (error) throw new Error(error.message);
}

/** The sanctioned correction path (ADR-005), the training-entry equivalent
 *  of wellness.ts's reviseWellnessEntry — see that function's comment for
 *  the reasoning, which applies unchanged: `revise_training_entry` closes
 *  the original and inserts a new row server side, `session_id` and
 *  `entry_date` are not parameters and cannot be changed by a correction,
 *  and it is **staff only since migration 0058**.
 *
 *  `session_load` is deliberately absent from the payload: the
 *  `training_entries_session_load` trigger recomputes rpe x duration_min on
 *  the inserted revision, so a corrected RPE cannot leave a stale load
 *  behind for ACWR to read. */
export async function reviseTrainingEntry(
  db: Db,
  originalId: string,
  payload: TrainingCorrection,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc('revise_training_entry', {
    p_original_id: originalId,
    p_new_id: crypto.randomUUID(),
    p_payload: payload,
  });

  if (error) {
    if (error.message.includes('entry_not_revisable')) {
      return {
        error:
          'This entry has already been corrected once, or no longer exists. Refresh to see the latest.',
      };
    }
    if (error.message.includes('not_permitted')) {
      return {
        error:
          'Only coaching or medical staff can correct an entry. Refresh and sign in again if you believe you hold that role.',
      };
    }
    /* Same rule as reviseWellnessEntry: never a raw driver string, and the
       same 'staff' audience since the only caller is now a staff screen. */
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}
