import type { AppRole, BaselineTypeEnum, FlagDomain, FlagSeverity, ThresholdComparisonEnum } from '@/lib/types/database';
import { METRIC_REGISTRY, metricLabel } from '@/lib/metrics';
import type { Db } from './groups';

/* Thresholds. screens/thresholds.md, screen 30. Coach only — 01-roles-and-
 * permissions.md §2, "Set thresholds" is Y for coach and blank for medical,
 * admin and athlete, confirmed against the real RLS grant (0012: "grant
 * select, insert, update", no delete grant at all, so "delete" in the spec's
 * own interactions table is the soft delete this file implements).
 *
 * Simplified against the full spec: no recalibration engine (a second
 * feature in its own right, already cut from Flags for the same reason), no
 * "test this threshold against real data" preview, no group-specific
 * targeting in the editor (applies_to_group_id stays null, "all squad",
 * which is what every seeded threshold already uses). What is built is the
 * actual job: read the rules, write new ones, turn one off, retire one for
 * good without losing the flags it already raised. */

export type ThresholdComparison = ThresholdComparisonEnum;
export type BaselineType = BaselineTypeEnum;

export type Threshold = {
  id: string;
  name: string;
  description: string | null;
  domain: FlagDomain;
  metric: string;
  comparison: ThresholdComparison;
  value: number;
  baseline_type: BaselineType;
  baseline_days: number | null;
  consecutive_days: number;
  severity: FlagSeverity;
  notify_roles: AppRole[];
  is_active: boolean;
};

const COLUMNS =
  'id, name, description, domain, metric, comparison, value, baseline_type, baseline_days, consecutive_days, severity, notify_roles, is_active';

export async function fetchThresholds(
  db: Db,
  orgId: string,
  includeInactive = true,
): Promise<Threshold[]> {
  let query = db.from('thresholds').select(COLUMNS).eq('org_id', orgId).is('deleted_at', null);

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query.order('domain').order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Threshold[];
}

export type ThresholdInput = {
  name: string;
  description: string | null;
  domain: FlagDomain;
  metric: string;
  comparison: ThresholdComparison;
  value: number;
  baseline_type: BaselineType;
  baseline_days: number | null;
  consecutive_days: number;
  severity: FlagSeverity;
  notify_roles: AppRole[];
};

export async function createThreshold(
  db: Db,
  orgId: string,
  userId: string,
  input: ThresholdInput,
): Promise<{ error: string | null }> {
  const { error } = await db.from('thresholds').insert({
    org_id: orgId,
    created_by: userId,
    name: input.name.trim(),
    description: input.description,
    domain: input.domain,
    metric: input.metric,
    comparison: input.comparison,
    value: input.value,
    baseline_type: input.baseline_type,
    baseline_days: input.baseline_type === 'absolute' ? null : input.baseline_days,
    consecutive_days: input.consecutive_days,
    severity: input.severity,
    notify_roles: input.notify_roles,
    source: 'custom',
  });

  if (error) {
    if (error.code === '23505') {
      return { error: `A threshold called "${input.name.trim()}" already exists.` };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function setThresholdActive(
  db: Db,
  id: string,
  orgId: string,
  isActive: boolean,
): Promise<void> {
/* G-34. `.select('id')` so a refusal is sayable. An UPDATE that RLS filters
   matches no row and does NOT raise, so checking `error` alone reported success
   and changed nothing. This is a single row addressed by id that was on screen a
   moment ago, so zero rows can only mean refused. */
  const { data, error } = await db
    .from('thresholds')
    .update({ is_active: isActive })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Not saved: thresholds belong to the coach and the sport scientist.');
  }
}

/** screens/thresholds.md job 1: "make the rules legible... the UI renders it
 *  as one sentence". */
export function describeThreshold(t: Pick<Threshold, 'metric' | 'comparison' | 'value' | 'baseline_type' | 'baseline_days' | 'consecutive_days'>): string {
  const label = metricLabel(t.metric);
  const unit = METRIC_REGISTRY[t.metric]?.unit ?? '';
  const days = t.consecutive_days === 1 ? '1 day' : `${t.consecutive_days} consecutive days`;

  let rule: string;
  switch (t.comparison) {
    case 'below':
      rule = `${label} is below ${t.value}${unit}`;
      break;
    case 'above':
      rule = `${label} is above ${t.value}${unit}`;
      break;
    case 'pct_change_below':
      rule = `${label} drops by more than ${t.value}%`;
      break;
    case 'pct_change_above':
      rule = `${label} rises by more than ${t.value}%`;
      break;
    case 'z_score':
      rule = `${label} is ${Math.abs(t.value)} standard deviations ${t.value < 0 ? 'below' : 'above'}`;
      break;
    default:
      rule = `${label} crosses ${t.value}${unit}`;
  }

  const baselineFragment =
    t.baseline_type === 'personal_rolling'
      ? `the athlete's own ${t.baseline_days ?? 28}-day average`
      : t.baseline_type === 'squad_mean'
        ? "the squad's average that day"
        : null;

  /* What the baseline actually does depends on the comparison — this
   * sentence must render what the rule EVALUATES (screens/thresholds.md's
   * own evaluation SQL), not decorate every rule with the same connector.
   * The audit (S1, analysis finding 46) caught the previous version
   * claiming "above 1.3, against the athlete's own 28-day average", which
   * reads as a personal-relative trip condition when an `above`/`below`
   * rule is an absolute cutoff whatever its baseline_type: per that SQL,
   * `above` fires on `value > p_value`, full stop. For those comparisons a
   * non-absolute baseline only (a) gates firing behind
   * min_baseline_observations and (b) supplies the "vs their 28-day norm"
   * context recorded on each flag — so the sentence now says exactly that.
   * z_score and pct_change genuinely evaluate against the baseline, and
   * keep it inside the trip clause. */
  if (t.comparison === 'z_score') {
    return `Fires when ${rule}${baselineFragment ? ` ${baselineFragment}` : ''}, for ${days} running.`;
  }
  if (t.comparison === 'pct_change_below' || t.comparison === 'pct_change_above') {
    return `Fires when ${rule}${baselineFragment ? ` against ${baselineFragment}` : ''}, for ${days} running.`;
  }
  const context =
    baselineFragment === null
      ? ''
      : ` The cutoff is absolute; ${baselineFragment} is recorded on each flag for context.`;
  return `Fires when ${rule}, for ${days} running.${context}`;
}

/** The org's active ACWR flag rule, from an already-fetched threshold list —
 *  the real "flags above X" number every surface must quote instead of a
 *  hardcoded constant (audit S1: the profile said "flags above 1.50" while
 *  the seeded rule fires above 1.30). Null when no active rule exists,
 *  which callers must render as "no flag rule active", never as a made-up
 *  number. */
export function findActiveAcwrThreshold(thresholds: readonly Threshold[]): Threshold | null {
  return thresholds.find((t) => t.metric === 'load.acwr' && t.is_active) ?? null;
}

/** Give a club Fydr's starter set of five thresholds (migration 0059).
 *
 *  Coach, verbatim: "do we have general default thresholds for each club to use
 *  and start with?" Until 0059 the answer was no — nothing in the schema had
 *  ever inserted a threshold for a real organisation, so a new club sat on an
 *  empty rules list AND a flag engine (migration 0052) with nothing to evaluate,
 *  raising zero flags forever without ever saying so. This is the coach-facing
 *  half of the fix; the migration's own header carries the full investigation.
 *
 *  Returns how many rows were inserted. 0 is a legitimate, non-error answer and
 *  means the club has had a threshold at some point — including one it has since
 *  RETIRED. seed_default_thresholds() acts only on an organisation with no
 *  threshold row at all, so a coach who cleared the rules on purpose never gets
 *  them reinstated behind their back, whether they cleared four of five or all
 *  five (0059 correction (c): the guard used to ignore soft-deleted rows, which
 *  made "cleared everything" indistinguishable from "never configured" and let
 *  the migration's own backfill re-seed a club overnight). Callers should read 0
 *  as "nothing to do", not as a failure, and should not tell the coach the club
 *  "already has thresholds" — it may have none live and still be ineligible.
 *
 *  Four of the five arrive active. 'Wellness compliance low' arrives switched off
 *  by design: its metric is a count of wellness entries, so on a club that has
 *  never submitted anything it reads 0 rather than "no data" and would flag the
 *  whole squad on day one. It is one click from live on this same screen.
 *
 *  No org/role check here, deliberately, and this is the CLAUDE.md rule 2 point:
 *  the function is SECURITY INVOKER, so the gate is the thresholds_coach_insert
 *  RLS policy — a non-coach, or a coach naming another org's id, is refused by
 *  Postgres (42501) rather than by anything this file could be persuaded to skip.
 *  orgId is passed as an argument only because the RPC needs a target; it is
 *  never what authorises the write. */
export async function seedDefaultThresholds(
  db: Db,
  orgId: string,
): Promise<{ inserted: number; error: string | null }> {
  const { data, error } = await db.rpc('seed_default_thresholds', { p_org_id: orgId });

  if (error) {
    // 42501 is the RLS refusal, which for this screen means "you are not a coach
    // in this club". Anything else is genuinely unexpected and says so.
    if (error.code === '42501') {
      return { inserted: 0, error: 'Only a coach can set up the default thresholds.' };
    }
    return { inserted: 0, error: error.message };
  }
  return { inserted: typeof data === 'number' ? data : 0, error: null };
}

/** Soft delete: deleted_at, never a row removal — there is no delete grant
 *  on this table at all (migration 0012), and the spec's own edge case says
 *  flags keep their threshold_id and render "threshold no longer exists"
 *  rather than losing what a coach was told at the time. */
export async function archiveThreshold(db: Db, id: string, orgId: string): Promise<void> {
/* G-34. `.select('id')` so a refusal is sayable. An UPDATE that RLS filters
   matches no row and does NOT raise, so checking `error` alone reported success
   and changed nothing. This is a single row addressed by id that was on screen a
   moment ago, so zero rows can only mean refused. */
  const { data, error } = await db
    .from('thresholds')
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Not saved: thresholds belong to the coach and the sport scientist.');
  }
}

/** Who set the club's thresholds, and when — STAFF-SS-01 C2 (2026-09-12), the
 *  line that closes every attention panel: "Thresholds set by Jane Pemberton
 *  · 24 Aug · Change ›". ONE STORED DATE EVERYWHERE (the board's own
 *  correction): the most recently changed ACTIVE threshold's `updated_at`
 *  (0006's trigger keeps it), and the person who created that row — the
 *  table records `created_by`, not an editor, so "set by" is the author of
 *  the last-changed rule. The club's defaults (0059) carry no creator and
 *  read "the club defaults". Null when the club has no active threshold. */
export type ThresholdProvenance = {
  /** The person's name, or null for a default rule. */
  setBy: string | null;
  /** YYYY-MM-DD of the latest change, in the caller's timezone to format. */
  changedAt: string;
  active: number;
};

export async function fetchThresholdProvenance(db: Db, orgId: string): Promise<ThresholdProvenance | null> {
  const { data, error } = await db
    .from('thresholds')
    .select('id, created_by, updated_at')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .order('id');
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const latest = rows[0];
  if (!latest) return null;
  let setBy: string | null = null;
  if (latest.created_by) {
    const { data: user } = await db.from('users').select('full_name').eq('id', latest.created_by).maybeSingle();
    setBy = user?.full_name ?? null;
  }
  return { setBy, changedAt: latest.updated_at, active: rows.length };
}
