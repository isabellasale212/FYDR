import type { SessionRow } from '@/lib/types/database';
import type { TrainingEntryInput } from '@/lib/validation/training';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';

export type RpeSession = Pick<
  SessionRow,
  'id' | 'title' | 'session_type' | 'starts_at' | 'duration_min' | 'location' | 'md_offset'
>;

const SESSION_COLUMNS = 'id, title, session_type, starts_at, duration_min, location, md_offset';

/** The session context row. Org-scoped: RLS would refuse a cross-org id
 *  anyway, but the query says so too rather than relying on RLS alone to
 *  turn a wrong id into an empty result. */
export async function fetchSessionForRpe(
  db: Db,
  orgId: string,
  sessionId: string,
): Promise<RpeSession | null> {
  const { data, error } = await db
    .from('sessions')
    .select(SESSION_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
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

export type TrainingCorrectionInput = {
  rpe: number;
  duration_min: number;
  comment?: string | null;
};

/** The sanctioned correction path (ADR-005), the training-entry equivalent
 *  of wellness.ts's reviseWellnessEntry — see that function's comment for
 *  the reasoning, which applies unchanged: `revise_training_entry` closes
 *  the original and inserts a new row server side, `session_id` and
 *  `entry_date` are not parameters and cannot be changed by a correction. */
export async function reviseTrainingEntry(
  db: Db,
  originalId: string,
  payload: TrainingCorrectionInput,
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
    /* Same rule as reviseWellnessEntry: never a raw driver string. */
    return { error: humanizeDbError(error.message, 'athlete') };
  }
  return { error: null };
}
