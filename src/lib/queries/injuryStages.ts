import type { Db } from './groups';

/* PATTERN-S3 C3 (0123): return-to-play stages as data. Two readers — the
 * medic (the ladder and its history on the injury record) and the athlete
 * (their own ladder on the status screen). A coach's session reads nothing
 * here at the database, so nothing here needs a role check of its own. */

export type InjuryProtocol = { injury_id: string; total_stages: number; current_stage: number; opened_at: string };

export type StageEvent = {
  id: string;
  from_stage: number | null;
  to_stage: number;
  moved_by: string | null;
  moved_at: string;
  restriction_line: string | null;
  criteria_reviewed: boolean;
  reason: string | null;
};

/** The protocol for one injury, with the current stage (kept on the row by
 *  move_injury_stage; 0 = opened, not yet on a stage). Null when none is open. */
export async function fetchInjuryProtocol(db: Db, injuryId: string): Promise<InjuryProtocol | null> {
  const { data: p } = await db.from('injury_protocols').select('injury_id, total_stages, current_stage, opened_at').eq('injury_id', injuryId).maybeSingle();
  if (!p) return null;
  return { injury_id: p.injury_id, total_stages: p.total_stages, current_stage: p.current_stage, opened_at: p.opened_at };
}

/** Every move, newest first — the medic's history on the record. */
export async function fetchStageEvents(db: Db, injuryId: string): Promise<StageEvent[]> {
  const { data, error } = await db
    .from('injury_stage_events')
    .select('id, from_stage, to_stage, moved_by, moved_at, restriction_line, criteria_reviewed, reason')
    .eq('injury_id', injuryId)
    .order('seq', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The athlete's own: the protocol on their open injury, if any. */
export async function fetchMyProtocol(db: Db, athleteId: string): Promise<InjuryProtocol | null> {
  const { data: open } = await db.from('injuries').select('id').eq('athlete_id', athleteId).neq('status', 'closed').is('deleted_at', null).order('onset_date', { ascending: false }).limit(1).maybeSingle();
  if (!open) return null;
  return fetchInjuryProtocol(db, open.id);
}

/** What the medic's advance asks for, said before the move (the board's
 *  confirmation: who will read what). */
export const STAGE_ADVANCE_RULE = 'Advancing moves one stage. Rewrite the restriction line for the new stage — it is what the coach and the athlete read — and confirm the criteria in the club’s protocol were reviewed. Any other stage needs a reason.';
export const RESTRICTION_HINT = 'Coach visible. Describe the restriction, not the injury. Do not name a diagnosis or a protocol.';
