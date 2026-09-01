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

/** How many decimal places a ranked value is printed to, from the metric alone.
 *
 *  Exists because until migration 0056 there were two eligible metrics, both unitless
 *  integers, so every display site could get away with its own inline guess — and the
 *  guesses had already diverged: the staff board and the athlete board detail used
 *  `unit === '' ? 0 : 1`, while the athlete board LIST hardcoded 1 and printed session
 *  load as "1240.0". With nine GPS metrics live, both of those are wrong in new ways:
 *  a distance is a whole number of metres (9868 m, never 9868.0 m) and a max speed is
 *  meaningless rounded to one place (9.3 m/s hides the difference between two athletes
 *  0.04 apart). One function, keyed on the metric's own unit, so a metric added to the
 *  catalogue tomorrow renders the same in every one of the five places that print it.
 *
 *  Keyed on `unit` rather than on `key` deliberately: a new distance metric in metres
 *  gets the right answer here without this file having to learn its name. The fallback
 *  is the old `unit === '' ? 0 : 1` rule, so nothing that existed before this function
 *  changed behaviour except where it was already wrong. */
export function metricDecimals(metric: Pick<MetricDefinition, 'unit'> | null | undefined): number {
  const unit = metric?.unit ?? '';
  // Speeds: two places. The whole point of a max-speed board is the small gap.
  if (unit === ' m/s') return 2;
  // Distances in metres, and every unitless count (efforts, accelerations, session
  // load, sessions attended, player load): whole numbers.
  if (unit === ' m' || unit === '') return 0;
  return 1;
}

export type Leaderboard = {
  id: string;
  name: string;
  metric_key: string;
  aggregation: string;
  population_type: string;
  group_id: string | null;
  /** Resolved via the `groups(name)` embed below, same join shape as
   *  nutritionTargets.ts's `t.groups?.name` (identical FK: `group_id references
   *  groups(id)`, `isOneToOne: false` in the generated types either way). null
   *  unless population_type === 'group'; groups are soft-deleted (deleted_at), never
   *  hard-deleted, so an archived group still resolves a real name here rather than
   *  going missing out from under an old board. */
  group_name: string | null;
  athlete_ids: string[] | null;
  window_type: string;
  window_days: number | null;
  visibility: string;
  athlete_view: string;
  top_n: number;
  created_at: string;
};

const BOARD_COLUMNS =
  'id, name, metric_key, aggregation, population_type, group_id, athlete_ids, window_type, window_days, visibility, athlete_view, top_n, created_at, groups(name)';

/** BOARD_COLUMNS' `groups(name)` embed lands as `{ groups: { name: string } | null }`
 *  on the raw row (postgrest-js, many-to-one) — this flattens it to `group_name` so
 *  every caller of fetchStaffBoards/fetchBoard/fetchMyBoards gets the plain
 *  `Leaderboard` shape instead of every display site re-doing `board.groups?.name`. */
function mapBoardRow(row: Omit<Leaderboard, 'group_name'> & { groups: { name: string } | null }): Leaderboard {
  const { groups, ...rest } = row;
  return { ...rest, group_name: groups?.name ?? null };
}

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
  return (data ?? []).map(mapBoardRow);
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
  return data ? mapBoardRow(data) : null;
}

/** Friendly copy for a board's population, replacing the four sites that used to
 *  print the raw `population_type` check-constraint value ('squad' | 'group' |
 *  'selected') straight into the UI. Deliberately its own function here rather than
 *  folded into groupFilter.ts's `groupScopeLabel`: that one names the *global,
 *  session-wide group filter* a screen is currently narrowed to (its own doc comment:
 *  "every header eyebrow, CSV caption and PDF meta line"), a different concept from a
 *  board's own *configured* population — conflating the two would mean a filtered
 *  staff view of a squad-wide board could print the filter's group name where the
 *  board's own scope belongs. One shared function per concept, same reasoning
 *  groupScopeLabel itself gives for existing at all: "the label can never drift
 *  per-screen" — four call sites needed exactly one definition, not four copies.
 *
 *  `selectedNames`, when supplied, must already be RLS-cleared for the caller (see
 *  fetchAthleteNames below) — this function never queries. Without it, 'selected'
 *  falls back to a real count ("3 selected athletes"), not a bare generic label:
 *  athlete_ids is already fetched on every Leaderboard row, so the count costs
 *  nothing extra even where names aren't available. */
export function populationLabel(
  board: Pick<Leaderboard, 'population_type' | 'group_name' | 'athlete_ids'>,
  selectedNames?: readonly string[] | null,
): string {
  if (board.population_type === 'squad') return 'Whole squad';
  if (board.population_type === 'group') return board.group_name ?? 'Unknown group';
  // population_type === 'selected'
  if (selectedNames && selectedNames.length > 0) return selectedNames.join(', ');
  const count = board.athlete_ids?.length ?? 0;
  return count === 1 ? '1 selected athlete' : `${count} selected athletes`;
}

/** Real names for a 'selected' board's athlete_ids, for the two staff display sites
 *  only. Judgement call, not an oversight: an athlete-scoped `db` cannot use this —
 *  `athletes_self_select` (migration 0012) restricts a non-staff caller's SELECT on
 *  `athletes` to their own row (`id = auth_athlete_id()`), so this returns at most one
 *  name for an athlete caller regardless of how many ids are passed in. Building a
 *  security-definer RPC to give an athlete the real names of the rest of a 'selected'
 *  population (compute_leaderboard's own pattern, migration 0016) is a real, larger
 *  change deferred here; the two athlete-surface display sites call populationLabel()
 *  with no `selectedNames` argument and get the count-only branch instead — see their
 *  own comments. */
export async function fetchAthleteNames(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
): Promise<Map<string, string>> {
  if (athleteIds.length === 0) return new Map();
  const { data, error } = await db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .in('id', [...athleteIds]);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((a) => [a.id, `${a.first_name} ${a.last_name}`]));
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
    (boards ?? []).map(mapBoardRow).map(async (board) => {
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
