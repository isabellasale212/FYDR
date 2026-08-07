import type { Db } from './groups';

/* Leaderboards. screens/leaderboards.md, screen 26, simplified — see the migration file
 * (supabase/migrations/0016_leaderboards.sql) header for the exact cuts: no movement
 * ("up 3 since 1 July"), no test/GPS/gym metrics (no source tables yet), no admin
 * aggregate view, no medical-suppression management screen (suppression itself works,
 * reached from the board detail page rather than a dedicated manager). */

export type MetricDefinition = {
  key: string;
  domain: string;
  label: string;
  unit: string;
  higher_is_better: boolean;
  aggregations: string[];
  leaderboard_eligible: boolean;
  ineligible_reason: string | null;
  min_population: number;
};

const METRIC_COLUMNS =
  'key, domain, label, unit, higher_is_better, aggregations, leaderboard_eligible, ineligible_reason, min_population';

export async function fetchMetricCatalogue(db: Db): Promise<MetricDefinition[]> {
  const { data, error } = await db.from('metric_definitions').select(METRIC_COLUMNS).order('key');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchEligibleMetrics(db: Db): Promise<MetricDefinition[]> {
  const all = await fetchMetricCatalogue(db);
  return all.filter((m) => m.leaderboard_eligible);
}

export type Leaderboard = {
  id: string;
  name: string;
  metric_key: string;
  aggregation: string;
  population_type: string;
  group_id: string | null;
  athlete_ids: string[] | null;
  window_type: string;
  window_days: number | null;
  visibility: string;
  athlete_view: string;
  top_n: number;
  created_at: string;
};

const BOARD_COLUMNS =
  'id, name, metric_key, aggregation, population_type, group_id, athlete_ids, window_type, window_days, visibility, athlete_view, top_n, created_at';

/** Every board in the org, published or draft — the staff list. Coach and medical only;
 *  RLS itself refuses this select to anyone else, this is just the read. */
export async function fetchStaffBoards(db: Db, orgId: string): Promise<Leaderboard[]> {
  const { data, error } = await db
    .from('leaderboards')
    .select(BOARD_COLUMNS)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('visibility', { ascending: false })
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchBoard(db: Db, orgId: string, boardId: string): Promise<Leaderboard | null> {
  const { data, error } = await db
    .from('leaderboards')
    .select(BOARD_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', boardId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export type RankedRow = {
  position: number;
  athlete_id: string;
  first_name: string;
  last_name: string;
  value: number;
  record_count: number;
  is_tied: boolean;
  previous_position: number | null;
};

/** The one function this whole screen turns on. Returns nothing a caller is not
 *  entitled to: see the migration file's own comment on why this is security definer
 *  with the authorisation built in, not the invoker-rights function the spec itself
 *  shows — empty rows are the correct response to "not entitled", not an error, so this
 *  never throws for a permission reason, only for a genuinely missing/ineligible board. */
export async function fetchBoardRanking(db: Db, boardId: string): Promise<RankedRow[]> {
  const { data, error } = await db.rpc('compute_leaderboard', { p_leaderboard_id: boardId });
  if (error) throw new Error(error.message);
  return (data ?? []) as RankedRow[];
}

/** Every published board the calling athlete actually appears on. There is no single
 *  RPC for this in the simplified schema (the spec's own version cross-joins
 *  compute_leaderboard in one query; done here as one RPC call per candidate board
 *  instead, which is fine at this catalogue's current size and is a documented
 *  performance cut if the board count ever grows past a handful). */
export async function fetchMyBoards(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<{ board: Leaderboard; own: RankedRow }[]> {
  const { data: boards, error } = await db
    .from('leaderboards')
    .select(BOARD_COLUMNS)
    .eq('org_id', orgId)
    .eq('visibility', 'published')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);

  const results = await Promise.all(
    (boards ?? []).map(async (board) => {
      const rows = await fetchBoardRanking(db, board.id);
      const own = rows.find((r) => r.athlete_id === athleteId);
      return own ? { board, own } : null;
    }),
  );

  return results
    .filter((r): r is { board: Leaderboard; own: RankedRow } => r !== null)
    .sort((a, b) => a.own.position - b.own.position);
}

export type NewLeaderboardInput = {
  name: string;
  metricKey: string;
  aggregation: string;
  populationType: 'squad' | 'group';
  groupId: string | null;
  windowType: 'days' | 'season' | 'all_time';
  windowDays: number | null;
  visibility: 'staff' | 'published';
};

export async function createLeaderboard(
  db: Db,
  orgId: string,
  userId: string,
  input: NewLeaderboardInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await db
    .from('leaderboards')
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      metric_key: input.metricKey,
      aggregation: input.aggregation,
      population_type: input.populationType,
      group_id: input.populationType === 'group' ? input.groupId : null,
      window_type: input.windowType,
      window_days: input.windowType === 'days' ? input.windowDays : null,
      visibility: input.visibility,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data.id, error: null };
}

export async function setBoardVisibility(
  db: Db,
  orgId: string,
  boardId: string,
  visibility: 'staff' | 'published',
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('leaderboards')
    .update({ visibility })
    .eq('id', boardId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

export async function deleteBoard(
  db: Db,
  orgId: string,
  boardId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('leaderboards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', boardId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

/** "Leave this leaderboard", or the global "leave every board" when boardId is null.
 *  screens/leaderboards.md: no reason required, effective immediately. */
export async function optOut(
  db: Db,
  orgId: string,
  athleteId: string,
  userId: string,
  boardId: string | null,
): Promise<{ error: string | null }> {
  const { error } = await db.from('leaderboard_opt_outs').insert({
    org_id: orgId,
    athlete_id: athleteId,
    leaderboard_id: boardId,
    opted_out_by: userId,
    opt_out_source: 'athlete',
  });
  return { error: error?.message ?? null };
}

/** Rejoining: end the athlete's own opt-out row rather than delete it, so the history —
 *  itself a stored record of a past, lawful disclosure decision — is retained. */
export async function optBackIn(
  db: Db,
  orgId: string,
  athleteId: string,
  boardId: string | null,
): Promise<{ error: string | null }> {
  let query = db
    .from('leaderboard_opt_outs')
    .update({ ended_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('ended_at', null);
  query = boardId ? query.eq('leaderboard_id', boardId) : query.is('leaderboard_id', null);
  const { error } = await query;
  return { error: error?.message ?? null };
}

/** Medical suppression: same table, a different opt_out_source, gated server side by
 *  RLS to the medical role only — see migration 0016's
 *  leaderboard_opt_outs_medical_insert policy. */
export async function suppressAthlete(
  db: Db,
  orgId: string,
  athleteId: string,
  userId: string,
  boardId: string,
  reason: string,
): Promise<{ error: string | null }> {
  const { error } = await db.from('leaderboard_opt_outs').insert({
    org_id: orgId,
    athlete_id: athleteId,
    leaderboard_id: boardId,
    opted_out_by: userId,
    opt_out_source: 'medical',
    reason,
  });
  return { error: error?.message ?? null };
}

export async function fetchMyOptOuts(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<{ id: string; leaderboard_id: string | null }[]> {
  const { data, error } = await db
    .from('leaderboard_opt_outs')
    .select('id, leaderboard_id')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .eq('opt_out_source', 'athlete')
    .is('ended_at', null);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Whether this athlete has granted leaderboard_visibility — the under-18 opt-in.
 *  Meaningless for an adult (they are on by default), read regardless so the Me
 *  screen can show the toggle's true state either way. */
export async function fetchLeaderboardConsent(
  db: Db,
  athleteId: string,
): Promise<{ granted: boolean } > {
  const { data, error } = await db
    .from('athlete_consents')
    .select('granted_at, withdrawn_at')
    .eq('athlete_id', athleteId)
    .eq('purpose', 'leaderboard_visibility')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { granted: !!data && data.granted_at !== null && data.withdrawn_at === null };
}

const NOTICE_VERSION = '2026.1';

export async function grantLeaderboardVisibility(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<{ error: string | null }> {
  const { error } = await db.from('athlete_consents').upsert(
    {
      org_id: orgId,
      athlete_id: athleteId,
      purpose: 'leaderboard_visibility',
      granted_at: new Date().toISOString(),
      withdrawn_at: null,
      notice_version: NOTICE_VERSION,
    },
    { onConflict: 'athlete_id,purpose' },
  );
  return { error: error?.message ?? null };
}

export async function withdrawLeaderboardVisibility(
  db: Db,
  athleteId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('athlete_consents')
    .update({ withdrawn_at: new Date().toISOString() })
    .eq('athlete_id', athleteId)
    .eq('purpose', 'leaderboard_visibility');
  return { error: error?.message ?? null };
}
