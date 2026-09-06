import type { Db } from './groups';
import { isUuid } from '@/lib/uuid';
import { rangeBounds } from './schedule';

/* docs/10-roadmap.md's own gap list: "Audit log viewer (new screen 35) —
 * 01-roles-and-permissions.md (superseded) §2 grants admins access to the audit log and
 * no screen exists." The table (migration 0007) and its RLS (migration 0012,
 * audit_admin_select: admin, own org, no update or delete policy for any
 * role) were both already real and already being written to by a dozen
 * other features before this file existed.
 *
 * Extended for the audit-governance gap the fix gameplan's item 2.5 names:
 * a last-100-rows, no-filter log can't answer "who viewed this athlete's
 * data" — the one question a safeguarding review actually needs, and
 * with a 16-year-old in the seed data it's not a hypothetical. Added:
 * a date range (default last 30 days, overridable to all time), an actor
 * filter (which staff member), an athlete/target filter, free-text search
 * over the action and actor name, and real offset pagination past the old
 * hard cap of 100.
 *
 * The athlete filter is the one worth being honest about. audit_log carries
 * a first-class `athlete_id` column (04-data-model.md §13) and it is set
 * directly by the events that are inherently about one athlete:
 * sar.request, sar.release, timetable.attendance.restriction_override,
 * availability.set, injury_clinical.read. But recordReportView
 * (lib/queries/reports.ts) — the call behind every report.*.view and
 * report.*.export row, which is most of this table's volume — never sets
 * that column; for the athlete-scoped report types ('athlete',
 * 'my_data') it only ever put athlete_id inside the metadata jsonb blob.
 * That's an existing gap in the write path, not something introduced
 * here, and per the gameplan this pass is read/filter only — no new
 * audit-writing, no migration, no touching recordReportView's call
 * sites. So the athlete filter below matches EITHER the real column OR
 * metadata->>'athlete_id', which recovers every report row that already
 * carries the athlete but was never filterable by it. What it can't
 * recover: action types that never recorded an athlete anywhere at all —
 * week_template.applied (squad-wide by nature), user_roles.changed,
 * retention.*, invite.email_sent, user.bulk_invite. Those genuinely have
 * no per-athlete detail to filter on, and the page says so rather than
 * pretending the athlete column covers them. */

export type AuditLogRow = {
  id: number;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  athleteName: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
};

export type AuditActorOption = { id: string; name: string };
export type AuditAthleteOption = { id: string; name: string };

export type AuditLogFilters = {
  entityType: string | null;
  /** Inclusive lower bound, 'YYYY-MM-DD'. Null = no lower bound. */
  from: string | null;
  /** Inclusive upper bound, 'YYYY-MM-DD'. Null = no upper bound. */
  to: string | null;
  actorId: string | null;
  athleteId: string | null;
  /** Free text, matched against `action` and the actor's name. */
  q: string | null;
};

/** PostgREST's `.or()` mini-language uses `,` to separate conditions and
 *  `()` to delimit `.in()` lists. Free text typed by a person can contain
 *  either, so strip them before the term is interpolated into an `.or()`
 *  expression — otherwise a stray comma or bracket changes what the query
 *  asks for rather than what was searched for. Not a tenancy risk (org_id
 *  and RLS are separate, ANDed filters that this string can't reach), but
 *  a correctness one worth closing anyway. */
function sanitizeForOrExpression(raw: string): string {
  return raw.replace(/[,()]/g, ' ').trim();
}

/** Escapes SQL LIKE wildcards so a literal `%` or `_` someone types searches
 *  for that literal character instead of acting as a wildcard. */
function escapeLikeWildcards(raw: string): string {
  return raw.replace(/[%_]/g, (m) => `\\${m}`);
}

export async function fetchEntityTypes(db: Db, orgId: string): Promise<string[]> {
  const { data, error } = await db.from('audit_log').select('entity_type').eq('org_id', orgId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.entity_type))].sort();
}

/** Every staff member (a user with at least one role) in the org, for the
 *  actor filter — the full roster, not just names that already appear in
 *  the log. A safeguarding review needs "did Coach X ever touch this
 *  record" to be answerable as a confirmed no, which means Coach X has to
 *  be selectable even with zero matching rows. */
export async function fetchActors(db: Db, orgId: string): Promise<AuditActorOption[]> {
  const { data, error } = await db.from('user_roles').select('user_id, users!user_roles_user_id_fkey(full_name)').eq('org_id', orgId);
  if (error) throw new Error(error.message);
  const byId = new Map<string, string>();
  for (const r of data ?? []) {
    const name = r.users?.full_name;
    if (r.user_id && name) byId.set(r.user_id, name);
  }
  return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** The full active roster, for the athlete/target filter — same reasoning
 *  as fetchActors: pick a name, get a real answer, even a zero. */
export async function fetchAthleteOptions(db: Db, orgId: string): Promise<AuditAthleteOption[]> {
  const { data, error } = await db.from('athletes').select('id, first_name, last_name').eq('org_id', orgId).is('deleted_at', null).order('last_name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({ id: a.id, name: `${a.last_name}, ${a.first_name}` }));
}

export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function fetchAuditLog(
  db: Db,
  orgId: string,
  filters: AuditLogFilters,
  page: number,
  pageSize: number,
  /** Resolves an athlete name for rows where the only reference is
   *  metadata->>'athlete_id' (report views) rather than the joined
   *  `athletes` relation (which only follows the real FK column). Pass the
   *  same roster fetchAthleteOptions already returned — no extra query. */
  athleteNameById: ReadonlyMap<string, string>,
  timezone: string,
): Promise<AuditLogPage> {
  let query = db
    .from('audit_log')
    .select(
      'id, action, entity_type, entity_id, metadata, occurred_at, actor_role, athlete_id, users(full_name), athletes(first_name, last_name)',
      { count: 'exact' },
    )
    .eq('org_id', orgId)
    .order('occurred_at', { ascending: false });

  if (filters.entityType) query = query.eq('entity_type', filters.entityType);
  // Same fix as schedule.ts's own dayBounds()/rangeBounds() (integration-
  // audit Batch 2): literal `${date}T00:00:00Z`/`T23:59:59.999Z` bounds are
  // only correct for UTC+0 with no DST, so a filter of "8 Aug" could miss
  // (or wrongly include) an event right at the edge of the org's local
  // day. rangeBounds(date, date, timezone) is the same primitive schedule.ts
  // uses for a single day, reused here for each independent from/to edge
  // rather than reinvented (from and to are each optional and set
  // independently, so this can't just call rangeBounds(from, to, tz) once).
  if (filters.from) query = query.gte('occurred_at', rangeBounds(filters.from, filters.from, timezone).from);
  if (filters.to) query = query.lte('occurred_at', rangeBounds(filters.to, filters.to, timezone).to);
  if (filters.actorId && isUuid(filters.actorId)) query = query.eq('actor_id', filters.actorId);
  if (filters.athleteId && isUuid(filters.athleteId)) {
    // Matches the real column (sar.request/release, restriction overrides,
    // availability changes, clinical reads) OR the metadata-only reference
    // that report views carry instead. See this file's header.
    query = query.or(`athlete_id.eq.${filters.athleteId},metadata->>athlete_id.eq.${filters.athleteId}`);
  }
  if (filters.q && filters.q.trim()) {
    const term = sanitizeForOrExpression(filters.q);
    if (term) {
      const likeTerm = escapeLikeWildcards(term);
      const { data: matchingUsers, error: userErr } = await db
        .from('users')
        .select('id')
        .eq('org_id', orgId)
        .ilike('full_name', `%${likeTerm}%`);
      if (userErr) throw new Error(userErr.message);
      const actorIds = (matchingUsers ?? []).map((u) => u.id);
      const parts = [`action.ilike.%${likeTerm}%`];
      if (actorIds.length > 0) parts.push(`actor_id.in.(${actorIds.join(',')})`);
      query = query.or(parts.join(','));
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => {
    const metadataAthleteId = typeof r.metadata === 'object' && r.metadata && 'athlete_id' in r.metadata ? (r.metadata as Record<string, unknown>).athlete_id : null;
    const athleteName = r.athletes
      ? `${r.athletes.last_name}, ${r.athletes.first_name}`
      : typeof metadataAthleteId === 'string'
        ? (athleteNameById.get(metadataAthleteId) ?? null)
        : null;
    return {
      id: r.id,
      actorName: r.users?.full_name ?? null,
      actorRole: r.actor_role,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      athleteName,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      occurredAt: r.occurred_at,
    };
  });

  return { rows, total: count ?? rows.length, page, pageSize };
}
