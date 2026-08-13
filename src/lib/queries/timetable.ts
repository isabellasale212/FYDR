import type { AvailabilityStatus, Database } from '@/lib/types/database';
import { humanizeDbError } from '@/lib/writeErrors';
import { fetchCurrentAvailability } from './availability';
import { fetchGroupAthleteIds, type Db } from './groups';
import type { Session } from './schedule';

// No dedicated exported alias for these two enums in lib/types/database.ts
// (only a handful of enums get one) — same local-alias pattern lib/tier.ts
// already established for subscription_tier, not a new convention.
export type AttendanceStatus = Database['public']['Enums']['attendance_status'];
type SessionType = Database['public']['Enums']['session_type'];

/* screens/timetable.md, screen 11 — read-and-capture, the day-level face of
 * the scheduling spine. This build cuts hard against the doc's own layout,
 * which is itself explicitly "provisional, awaiting client design
 * photographs" and written mobile-first (CalendarStrip, BottomSheet,
 * ConfirmSheet — none of which exist in this web codebase; SessionCard and
 * EmptyState do, and are reused). What's real and unreduced: the four jobs
 * the doc names — sessions in order, resolved rosters, attendance capture,
 * and the restriction warning (03-flows.md §6's hard rule, warn not block).
 *
 * session_attendance (migration 0003) already existed with a real,
 * unused-until-now RLS grant for coach/medical insert+update, and
 * migration 0016's leaderboards feature already references it as an
 * eligible metric source — a leaderboard type nothing could ever have
 * populated results for until this file existed.
 *
 * Restriction conflict detection uses only the doc's own literal default
 * table (no contact → match sessions; no sprinting → high-RPE non-match,
 * non-recovery sessions), matched against real session_type/planned_rpe
 * columns. The doc's fuller version also matches session *tags*, which
 * this schema's sessions table does not have a column for at all — not
 * cut for convenience, there is nothing to read. Every restriction still
 * displays as plain text on the athlete's row regardless of whether it
 * trips the automated conflict banner; only the banner itself is reduced,
 * never the underlying information a coach sees. */

export type TimetableParticipant = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
  availability_status: AvailabilityStatus | 'unknown';
  restrictions: string[];
  conflicts: string[];
  attendance: AttendanceStatus | null;
  modified_reason: string | null;
};

export type TimetableSession = Session & {
  participants: TimetableParticipant[];
};

/** The doc's own shipped default for `organisations.settings ->
 *  'restriction_conflicts'` — not read from settings in this pass (no
 *  screen writes that key yet, so there is nothing there to diverge from
 *  the default), applied directly. Substring match, case-insensitive: real
 *  restriction text in this org includes phrases like "no contact" inside
 *  a longer string ("no contact, no scrummaging"), never an exact token. */
function computeConflicts(sessionType: SessionType, plannedRpe: number | null, restrictions: string[]): string[] {
  const lower = restrictions.map((r) => r.toLowerCase());
  const conflicts: string[] = [];
  if (sessionType === 'match' && lower.some((r) => r.includes('no contact'))) {
    conflicts.push('no contact');
  }
  if (
    sessionType !== 'match' &&
    sessionType !== 'meeting' &&
    sessionType !== 'recovery' &&
    plannedRpe !== null &&
    plannedRpe >= 7 &&
    lower.some((r) => r.includes('no sprinting'))
  ) {
    conflicts.push('no sprinting');
  }
  return conflicts;
}

function dayBounds(date: string): { from: string; to: string } {
  return { from: `${date}T00:00:00Z`, to: `${date}T23:59:59.999Z` };
}

export async function fetchTimetableDay(
  db: Db,
  orgId: string,
  date: string,
  groupIds: readonly string[],
): Promise<TimetableSession[]> {
  const bounds = dayBounds(date);
  const { data: sessions, error: sessErr } = await db
    .from('sessions')
    .select('id, title, session_type, starts_at, duration_min, location, md_offset, planned_rpe, status, fixture_id')
    .eq('org_id', orgId)
    .gte('starts_at', bounds.from)
    .lte('starts_at', bounds.to)
    .is('deleted_at', null)
    .order('starts_at');
  if (sessErr) throw new Error(sessErr.message);
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const [participantsRes, membershipsRes, scope] = await Promise.all([
    db.from('session_participants').select('session_id, athlete_id, group_id').eq('org_id', orgId).in('session_id', sessionIds),
    db.from('group_memberships').select('group_id, athlete_id').eq('org_id', orgId).is('removed_at', null),
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);
  if (participantsRes.error) throw new Error(participantsRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);

  const groupMembers = new Map<string, string[]>();
  for (const m of membershipsRes.data ?? []) {
    const list = groupMembers.get(m.group_id) ?? [];
    list.push(m.athlete_id);
    groupMembers.set(m.group_id, list);
  }

  const athleteIdsBySession = new Map<string, Set<string>>();
  for (const p of participantsRes.data ?? []) {
    const set = athleteIdsBySession.get(p.session_id) ?? new Set<string>();
    if (p.athlete_id) set.add(p.athlete_id);
    if (p.group_id) for (const id of groupMembers.get(p.group_id) ?? []) set.add(id);
    athleteIdsBySession.set(p.session_id, set);
  }

  const inScope = scope ? new Set(scope) : null;
  const allAthleteIds = new Set<string>();
  for (const set of athleteIdsBySession.values()) {
    for (const id of set) {
      if (!inScope || inScope.has(id)) allAthleteIds.add(id);
    }
  }
  const athleteIds = [...allAthleteIds];

  if (athleteIds.length === 0) {
    return sessions.map((s) => ({ ...s, participants: [] }));
  }

  const [athletesRes, availability, attendanceRes] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name, squad_number')
      .eq('org_id', orgId)
      .in('id', athleteIds)
      .is('deleted_at', null),
    fetchCurrentAvailability(db, orgId, athleteIds),
    db
      .from('session_attendance')
      .select('session_id, athlete_id, attendance, modified_reason')
      .eq('org_id', orgId)
      .in('session_id', sessionIds)
      .in('athlete_id', athleteIds),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (attendanceRes.error) throw new Error(attendanceRes.error.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));
  const attendanceByKey = new Map(
    (attendanceRes.data ?? []).map((a) => [`${a.session_id}:${a.athlete_id}`, a]),
  );

  return sessions.map((session) => {
    const ids = [...(athleteIdsBySession.get(session.id) ?? new Set<string>())].filter(
      (id) => !inScope || inScope.has(id),
    );
    const participants: TimetableParticipant[] = ids
      .map((athleteId) => {
        const athlete = athleteById.get(athleteId);
        if (!athlete) return null;
        const avail = availByAthlete.get(athleteId);
        const restrictions = avail?.restrictions ?? [];
        const record = attendanceByKey.get(`${session.id}:${athleteId}`);
        return {
          athlete_id: athleteId,
          first_name: athlete.first_name,
          last_name: athlete.last_name,
          squad_number: athlete.squad_number,
          availability_status: avail?.status ?? 'unknown',
          restrictions,
          conflicts: computeConflicts(session.session_type, session.planned_rpe, restrictions),
          attendance: record?.attendance ?? null,
          modified_reason: record?.modified_reason ?? null,
        };
      })
      .filter((p): p is TimetableParticipant => p !== null)
      .sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));

    return { ...session, participants };
  });
}

/** Insert-or-update, the real unique(session_id, athlete_id) constraint as
 *  the upsert target. overrideReason is set only when this write is a
 *  coach choosing "full" over a flagged conflict (03-flows.md §6: warn,
 *  never block, but log it) — screens/timetable.md's own AttendanceControl
 *  contract keeps that as a separate onOverride callback from onChange, so
 *  the audit write only happens on that specific path, not on every mark. */
export async function recordAttendance(
  db: Db,
  orgId: string,
  userId: string,
  actorRole: 'coach' | 'medical',
  input: {
    sessionId: string;
    athleteId: string;
    status: AttendanceStatus;
    modifiedReason: string | null;
    overrideReason?: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('session_attendance')
    .upsert(
      {
        org_id: orgId,
        session_id: input.sessionId,
        athlete_id: input.athleteId,
        attendance: input.status,
        modified_reason: input.status === 'modified' ? input.modifiedReason : null,
        recorded_by: userId,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,athlete_id' },
    );
  /* Never the raw driver string (audit S5 / coach finding 11: "permission
   * denied for table session_attendance" reached a coach verbatim) —
   * everything returned from here is written for the screen. */
  if (error) return { error: humanizeDbError(error.message, 'staff') };

  if (input.overrideReason) {
    // Real audit_log columns (reports.ts's recordReportView is the existing
    // precedent this follows): athlete_id has its own dedicated column,
    // not a metadata key — a query for "every override affecting this
    // athlete" should not have to reach into JSON to find them.
    const { error: auditErr } = await db.from('audit_log').insert({
      org_id: orgId,
      actor_id: userId,
      actor_role: actorRole,
      action: 'timetable.attendance.restriction_override',
      entity_type: 'session_attendance',
      entity_id: input.sessionId,
      athlete_id: input.athleteId,
      metadata: { reason: input.overrideReason, restriction_conflict: true },
    });
    // A failed audit write does not undo the attendance record — the coach
    // already has the athlete on the pitch, and refusing the real write
    // because the paper trail failed would be strictly worse. Surfaced as
    // a soft error string instead of thrown, same reasoning as every other
    // best-effort write in this codebase.
    if (auditErr)
      return {
        error: `The attendance mark saved, but the override note did not. ${humanizeDbError(auditErr.message, 'staff')}`,
      };
  }

  return { error: null };
}

/** "Mark all present": fills every athlete in this session who has no
 *  attendance record yet. Never overwrites an existing mark — this is a
 *  convenience for the common case (everyone who turned up), not a reset,
 *  and a coach who already recorded one absence should not have it
 *  silently undone by a bulk action pressed a minute later. Not in the
 *  doc's own behaviour table; this is the documented interpretation taken,
 *  not a guess left unstated. */
export async function bulkMarkPresent(
  db: Db,
  orgId: string,
  userId: string,
  sessionId: string,
  athleteIds: readonly string[],
): Promise<{ error: string | null }> {
  if (athleteIds.length === 0) return { error: null };
  const { data: existing, error: existingErr } = await db
    .from('session_attendance')
    .select('athlete_id')
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .in('athlete_id', [...athleteIds]);
  if (existingErr) return { error: humanizeDbError(existingErr.message, 'staff') };

  const already = new Set((existing ?? []).map((r) => r.athlete_id));
  const toMark = athleteIds.filter((id) => !already.has(id));
  if (toMark.length === 0) return { error: null };

  const { error } = await db.from('session_attendance').insert(
    toMark.map((athleteId) => ({
      org_id: orgId,
      session_id: sessionId,
      athlete_id: athleteId,
      attendance: 'full' as AttendanceStatus,
      recorded_by: userId,
      recorded_at: new Date().toISOString(),
    })),
  );
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}
