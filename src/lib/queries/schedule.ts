import type { FixtureRow, SessionRow } from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';

export type Session = Pick<
  SessionRow,
  | 'id'
  | 'title'
  | 'session_type'
  | 'starts_at'
  | 'duration_min'
  | 'location'
  | 'md_offset'
  | 'planned_rpe'
  | 'status'
  | 'fixture_id'
>;

export type SessionWithHeadcount = Session & { expected: number | null };

const COLUMNS =
  'id, title, session_type, starts_at, duration_min, location, md_offset, planned_rpe, status, fixture_id';

function dayBounds(date: string): { from: string; to: string } {
  return { from: `${date}T00:00:00Z`, to: `${date}T23:59:59.999Z` };
}

async function fetchSessionsBetween(
  db: Db,
  orgId: string,
  from: string,
  to: string,
): Promise<Session[]> {
  /* A cancelled session is included, not filtered out: screens/schedule.md
   * §6.14 renders it strikethrough and 50% opacity rather than removing it,
   * because a coach checking the week needs to see that Tuesday's session
   * was cancelled, not just find it missing with no explanation. Caught
   * live: this filter predated any way to actually cancel a session, so it
   * silently made every cancelled session vanish instead. Only a deleted
   * session (a different, rarer state — see deleteSession) is excluded. */
  const { data, error } = await db
    .from('sessions')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .is('deleted_at', null)
    .order('starts_at');

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Today's timetable with the headcount each session expects.
 *
 *  Participants are held as groups more often than as individuals, because that
 *  is how a coach builds a week, so the count expands group_memberships. */
export async function fetchDaySessions(
  db: Db,
  orgId: string,
  date: string,
  groupIds: readonly string[],
): Promise<SessionWithHeadcount[]> {
  const bounds = dayBounds(date);
  const sessions = await fetchSessionsBetween(db, orgId, bounds.from, bounds.to);
  if (sessions.length === 0) return [];

  const [participants, memberships, scope] = await Promise.all([
    db
      .from('session_participants')
      .select('session_id, athlete_id, group_id')
      .eq('org_id', orgId)
      .in(
        'session_id',
        sessions.map((s) => s.id),
      ),
    db
      .from('group_memberships')
      .select('group_id, athlete_id')
      .eq('org_id', orgId)
      .is('removed_at', null),
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);

  if (participants.error) throw new Error(participants.error.message);
  if (memberships.error) throw new Error(memberships.error.message);

  const groupMembers = new Map<string, string[]>();
  for (const m of memberships.data ?? []) {
    const list = groupMembers.get(m.group_id) ?? [];
    list.push(m.athlete_id);
    groupMembers.set(m.group_id, list);
  }

  const inScope = scope ? new Set(scope) : null;

  return sessions.map((session) => {
    const athleteIds = new Set<string>();
    for (const p of participants.data ?? []) {
      if (p.session_id !== session.id) continue;
      if (p.athlete_id) athleteIds.add(p.athlete_id);
      if (p.group_id) {
        for (const id of groupMembers.get(p.group_id) ?? []) athleteIds.add(id);
      }
    }
    const counted = inScope
      ? [...athleteIds].filter((id) => inScope.has(id))
      : [...athleteIds];

    return {
      ...session,
      expected: counted.length > 0 ? counted.length : null,
    };
  });
}

/** One athlete's sessions on one day: whatever they are named in directly, plus
 *  whatever their groups are named in. */
export async function fetchAthleteDaySessions(
  db: Db,
  orgId: string,
  athleteId: string,
  date: string,
): Promise<Session[]> {
  const bounds = dayBounds(date);
  const [sessions, memberships] = await Promise.all([
    fetchSessionsBetween(db, orgId, bounds.from, bounds.to),
    db
      .from('group_memberships')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('removed_at', null),
  ]);

  if (memberships.error) throw new Error(memberships.error.message);
  if (sessions.length === 0) return [];

  const myGroups = new Set((memberships.data ?? []).map((m) => m.group_id));

  const { data, error } = await db
    .from('session_participants')
    .select('session_id, athlete_id, group_id')
    .eq('org_id', orgId)
    .in(
      'session_id',
      sessions.map((s) => s.id),
    );

  if (error) throw new Error(error.message);

  const mine = new Set(
    (data ?? [])
      .filter(
        (p) =>
          p.athlete_id === athleteId ||
          (p.group_id !== null && myGroups.has(p.group_id)),
      )
      .map((p) => p.session_id),
  );

  return sessions.filter((s) => mine.has(s.id));
}

export type RecentSession = Session & {
  rpe: number | null;
  session_load: number | null;
  attendance: string | null;
};

/** An athlete's recent sessions with what they reported afterwards. A session
 *  with no entry shows a blank, which is not the same as an easy session. */
export async function fetchAthleteRecentSessions(
  db: Db,
  orgId: string,
  athleteId: string,
  from: string,
  to: string,
  limit = 8,
): Promise<RecentSession[]> {
  const [sessions, entries, attendance, memberships] = await Promise.all([
    fetchSessionsBetween(db, orgId, `${from}T00:00:00Z`, `${to}T23:59:59.999Z`),
    db
      .from('training_entries_current')
      .select('session_id, rpe, session_load')
      .eq('athlete_id', athleteId)
      .gte('entry_date', from)
      .lte('entry_date', to),
    db
      .from('session_attendance')
      .select('session_id, attendance')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId),
    db
      .from('group_memberships')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('removed_at', null),
  ]);

  if (entries.error) throw new Error(entries.error.message);
  if (attendance.error) throw new Error(attendance.error.message);
  if (memberships.error) throw new Error(memberships.error.message);
  if (sessions.length === 0) return [];

  const myGroups = new Set((memberships.data ?? []).map((m) => m.group_id));

  const { data: participants, error } = await db
    .from('session_participants')
    .select('session_id, athlete_id, group_id')
    .eq('org_id', orgId)
    .in(
      'session_id',
      sessions.map((s) => s.id),
    );

  if (error) throw new Error(error.message);

  const mine = new Set(
    (participants ?? [])
      .filter(
        (p) =>
          p.athlete_id === athleteId ||
          (p.group_id !== null && myGroups.has(p.group_id)),
      )
      .map((p) => p.session_id),
  );

  const entryBySession = new Map(
    (entries.data ?? [])
      .filter((e) => e.session_id !== null)
      .map((e) => [e.session_id as string, e]),
  );
  const attendanceBySession = new Map(
    (attendance.data ?? []).map((a) => [a.session_id, a.attendance]),
  );

  return sessions
    .filter((s) => mine.has(s.id))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, limit)
    .map((s) => ({
      ...s,
      rpe: entryBySession.get(s.id)?.rpe ?? null,
      session_load: entryBySession.get(s.id)?.session_load ?? null,
      attendance: attendanceBySession.get(s.id) ?? null,
    }));
}

export type NextFixture = {
  id: string;
  opponent: string;
  kickoff_at: string;
  venue: string | null;
  home_away: string;
  competition: string | null;
};

/* ---------------------------------------------------------------------------
 * The Schedule screen. screens/schedule.md, screen 15, "simplified" per
 * 10-roadmap.md's own Phase 1a scope note: no week templates, no MD-n
 * planner, no drag-to-move, no month view, session creation only (no edit,
 * no cancel, no delete UI yet — those are real gaps, not silently skipped).
 * Medical's write access matches the real RLS grant (coach and medical both
 * Y on "Create/edit schedule and sessions"), not the narrower rehab-only
 * restriction the spec itself calls an unconfirmed assumption (O-349).
 * ------------------------------------------------------------------------ */

export type WeekSession = SessionWithHeadcount & { entry_date: string };

/** Monday of the ISO week containing `dateIso`, per the mobile wireframe's
 *  Monday-to-Sunday week. */
export function mondayOf(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const day = d.getUTCDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** One md_offset per date in a 7-day window, keyed on the ISO date string —
 *  ATHLETE-APP-SPEC.md §5's week strip needs a matchday label per day,
 *  which is a property of that day's own scheduled session(s), not a
 *  formula on the date. Org-wide, no participant filtering: the week strip
 *  labels the day, not "does this athlete train that day", and two
 *  sessions landing on the same real date always carry the same md_offset
 *  by construction, so the last one written per day is as good as any. */
export async function fetchWeekMdLabels(
  db: Db,
  orgId: string,
  weekStart: string,
): Promise<Map<string, number | null>> {
  const weekEndDate = new Date(`${weekStart}T12:00:00Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const to = `${weekEndDate.toISOString().slice(0, 10)}T23:59:59.999Z`;

  const sessions = await fetchSessionsBetween(db, orgId, `${weekStart}T00:00:00Z`, to);
  const byDate = new Map<string, number | null>();
  for (const s of sessions) {
    byDate.set(s.starts_at.slice(0, 10), s.md_offset);
  }
  return byDate;
}

export async function fetchWeekSessions(
  db: Db,
  orgId: string,
  weekStart: string,
  groupIds: readonly string[],
): Promise<WeekSession[]> {
  const from = `${weekStart}T00:00:00Z`;
  const weekEndDate = new Date(`${weekStart}T12:00:00Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const to = `${weekEndDate.toISOString().slice(0, 10)}T23:59:59.999Z`;

  const sessions = await fetchSessionsBetween(db, orgId, from, to);
  if (sessions.length === 0) return [];

  const [participants, memberships, scope] = await Promise.all([
    db
      .from('session_participants')
      .select('session_id, athlete_id, group_id')
      .eq('org_id', orgId)
      .in('session_id', sessions.map((s) => s.id)),
    db
      .from('group_memberships')
      .select('group_id, athlete_id')
      .eq('org_id', orgId)
      .is('removed_at', null),
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);

  if (participants.error) throw new Error(participants.error.message);
  if (memberships.error) throw new Error(memberships.error.message);

  const groupMembers = new Map<string, string[]>();
  for (const m of memberships.data ?? []) {
    const list = groupMembers.get(m.group_id) ?? [];
    list.push(m.athlete_id);
    groupMembers.set(m.group_id, list);
  }
  const inScope = scope ? new Set(scope) : null;

  return sessions.map((session) => {
    const athleteIds = new Set<string>();
    for (const p of participants.data ?? []) {
      if (p.session_id !== session.id) continue;
      if (p.athlete_id) athleteIds.add(p.athlete_id);
      if (p.group_id) for (const id of groupMembers.get(p.group_id) ?? []) athleteIds.add(id);
    }
    const counted = inScope ? [...athleteIds].filter((id) => inScope.has(id)) : [...athleteIds];

    return {
      ...session,
      expected: counted.length > 0 ? counted.length : null,
      entry_date: session.starts_at.slice(0, 10),
    };
  });
}

/* ---------------------------------------------------------------------------
 * SCHEDULE-SPEC.md's grid rebuild. Real, additive to everything above — the
 * existing fetchWeekSessions stays exactly as it is (dashboard.ts depends on
 * its exact return shape in three places), and this is a second, richer
 * fetch for the one screen that needs per-session group names and the real
 * resolved athlete-ID set, not just a headcount.
 *
 * The spec's own fixture data (§10) gives every session a single literal
 * `group` string, including two values — 'Staff' and 'Matchday 23' — that
 * have no real backing anywhere in this schema: `groups.group_type` is a
 * closed enum (positional/training/rehab/age/custom, and 04-data-model.md
 * §17.13 is explicit it does not gain a 'team' value either), and there is
 * no matchday-squad-selection table (schedule.ts's own fixture-detail
 * header already documents that gap: "needs a fixture_selections table that
 * does not exist anywhere in the schema"). A real session can carry zero,
 * one, or several real groups (session_participants), never a single fixed
 * label. So this build does not offer 'Staff' or 'Matchday 23' as
 * assignable groups anywhere in the UI — only the org's real groups plus
 * "whole squad" (zero groups named) are real, assignable states — and the
 * spec's 'Staff never clashes / never counts toward contact time' rule is
 * reimplemented on real data instead: a session with zero real athlete
 * participants (the honest proxy for "nobody named is an athlete") is
 * excluded from clash detection and every contact-minute total, which
 * produces the same real outcome without inventing a fake group. See
 * scheduleGeometry.ts's own header for the clash-detection half of this. */

export type GridSession = Session & {
  entry_date: string;
  groupIds: string[];
  groupNames: string[];
  athleteIds: string[];
};

export async function fetchWeekSessionsDetailed(
  db: Db,
  orgId: string,
  weekStart: string,
  groupIds: readonly string[],
  allGroups: readonly { id: string; name: string }[],
): Promise<GridSession[]> {
  const from = `${weekStart}T00:00:00Z`;
  const weekEndDate = new Date(`${weekStart}T12:00:00Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const to = `${weekEndDate.toISOString().slice(0, 10)}T23:59:59.999Z`;

  const sessions = await fetchSessionsBetween(db, orgId, from, to);
  if (sessions.length === 0) return [];

  const [participants, memberships, scope] = await Promise.all([
    db
      .from('session_participants')
      .select('session_id, athlete_id, group_id')
      .eq('org_id', orgId)
      .in('session_id', sessions.map((s) => s.id)),
    db
      .from('group_memberships')
      .select('group_id, athlete_id')
      .eq('org_id', orgId)
      .is('removed_at', null),
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);

  if (participants.error) throw new Error(participants.error.message);
  if (memberships.error) throw new Error(memberships.error.message);

  const groupMembers = new Map<string, string[]>();
  for (const m of memberships.data ?? []) {
    const list = groupMembers.get(m.group_id) ?? [];
    list.push(m.athlete_id);
    groupMembers.set(m.group_id, list);
  }
  const groupNameById = new Map(allGroups.map((g) => [g.id, g.name]));
  const inScope = scope ? new Set(scope) : null;

  return sessions.map((session) => {
    const athleteIds = new Set<string>();
    const groupIdsForSession = new Set<string>();
    for (const p of participants.data ?? []) {
      if (p.session_id !== session.id) continue;
      if (p.athlete_id) athleteIds.add(p.athlete_id);
      if (p.group_id) {
        groupIdsForSession.add(p.group_id);
        for (const id of groupMembers.get(p.group_id) ?? []) athleteIds.add(id);
      }
    }
    const counted = inScope ? [...athleteIds].filter((id) => inScope.has(id)) : [...athleteIds];
    const groupIdList = [...groupIdsForSession];

    return {
      ...session,
      entry_date: session.starts_at.slice(0, 10),
      groupIds: groupIdList,
      groupNames: groupIdList.map((id) => groupNameById.get(id) ?? 'Unnamed group'),
      athleteIds: counted,
    };
  });
}

/** Real group → athlete-id membership, org-wide. The schedule workspace
 *  needs this client-side so that changing a session's assigned groups via
 *  the edit-mode chips (a local, unpublished overlay — see §9) can
 *  recompute that session's real attendee set live, for clash detection
 *  and contact-minute totals that stay honest while the coach is still
 *  editing, not just after publish. Small table, org-scoped, fetched once
 *  per page load. */
export async function fetchGroupMembership(db: Db, orgId: string): Promise<Record<string, string[]>> {
  const { data, error } = await db
    .from('group_memberships')
    .select('group_id, athlete_id')
    .eq('org_id', orgId)
    .is('removed_at', null);
  if (error) throw new Error(error.message);

  const out: Record<string, string[]> = {};
  for (const m of data ?? []) {
    (out[m.group_id] ??= []).push(m.athlete_id);
  }
  return out;
}

export type DbSessionType = Session['session_type'];

export type TypicalStats = { count: number; mins: number };

const emptyTypical = (): Record<DbSessionType, TypicalStats> => ({
  training: { count: 0, mins: 0 },
  gym: { count: 0, mins: 0 },
  match: { count: 0, mins: 0 },
  testing: { count: 0, mins: 0 },
  recovery: { count: 0, mins: 0 },
  meeting: { count: 0, mins: 0 },
  rehab: { count: 0, mins: 0 },
});

export type NormalWeek = {
  weeksUsed: number;
  byType: Record<DbSessionType, TypicalStats>;
  totalMins: number;
  totalCount: number;
};

/** SCHEDULE-SPEC.md §7: "Typical is the mean of the last eight weeks with a
 *  Saturday fixture." This org's real history (checked live against
 *  SUPABASE_DB_URL before writing this) spans about five weeks, not eight,
 *  and a real fixture here isn't always a Saturday (one real fixture in
 *  this data kicks off on a Sunday) — so the real, honest version of the
 *  rule is "the mean of the real weeks on record that contain a fixture,
 *  capped at eight," and the UI states however many weeks that actually
 *  was rather than asserting eight. `weeksUsed` is what the caller must
 *  render, not a hardcoded "eight-week mean". Degrades gracefully: as real
 *  history accumulates past eight fixture weeks, this starts capping at the
 *  spec's literal number on its own. */
export async function fetchNormalWeek(
  db: Db,
  orgId: string,
  allGroups: readonly { id: string; name: string }[],
  weekStart: string,
  groupIds: readonly string[],
  maxWeeks = 8,
): Promise<NormalWeek> {
  const { data: matches, error } = await db
    .from('sessions')
    .select('starts_at')
    .eq('org_id', orgId)
    .eq('session_type', 'match')
    .is('deleted_at', null)
    .lt('starts_at', `${weekStart}T00:00:00Z`)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);

  const seenWeeks = new Set<string>();
  const weeks: string[] = [];
  for (const m of matches ?? []) {
    const wk = mondayOf(m.starts_at.slice(0, 10));
    if (!seenWeeks.has(wk)) {
      seenWeeks.add(wk);
      weeks.push(wk);
      if (weeks.length >= maxWeeks) break;
    }
  }

  if (weeks.length === 0) {
    return { weeksUsed: 0, byType: emptyTypical(), totalMins: 0, totalCount: 0 };
  }

  const weekSessions = await Promise.all(
    weeks.map((wk) => fetchWeekSessionsDetailed(db, orgId, wk, groupIds, allGroups)),
  );

  const byType = emptyTypical();
  let totalMins = 0;
  let totalCount = 0;

  for (const sessions of weekSessions) {
    for (const s of sessions) {
      // Staff-only proxy (no real athlete named) — excluded wherever
      // minutes are totalled, same rule "this week" applies. §11 rule 6.
      if (s.athleteIds.length === 0) continue;
      const mins = s.duration_min ?? 0;
      byType[s.session_type].count += 1;
      byType[s.session_type].mins += mins;
      totalMins += mins;
      totalCount += 1;
    }
  }

  const weeksUsed = weeks.length;
  (Object.keys(byType) as DbSessionType[]).forEach((t) => {
    byType[t] = { count: byType[t].count / weeksUsed, mins: byType[t].mins / weeksUsed };
  });

  return { weeksUsed, byType, totalMins: totalMins / weeksUsed, totalCount: totalCount / weeksUsed };
}

export type WeekFixture = { opponent: string; kickoff_at: string; home_away: string };

/** Real fixtures kicking off inside one Monday-to-Sunday week, for the
 *  grid header's eyebrow line (SCHEDULE-SPEC.md §2: "MD SATURDAY 8 · V
 *  ASHFIELD RFC" in the mockup) — this build composes that clause from a
 *  real fixture instead of the spec's fictional opponent name. */
export async function fetchWeekFixtures(db: Db, orgId: string, weekStart: string): Promise<WeekFixture[]> {
  const weekEndDate = new Date(`${weekStart}T12:00:00Z`);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const to = `${weekEndDate.toISOString().slice(0, 10)}T23:59:59.999Z`;

  const { data, error } = await db
    .from('fixtures')
    .select('opponent, kickoff_at, home_away')
    .eq('org_id', orgId)
    .gte('kickoff_at', `${weekStart}T00:00:00Z`)
    .lte('kickoff_at', to)
    .is('deleted_at', null)
    .order('kickoff_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchCurrentSeasonId(db: Db, orgId: string): Promise<string | null> {
  const { data, error } = await db
    .from('seasons')
    .select('id')
    .eq('org_id', orgId)
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export type NewSessionInput = {
  title: string;
  sessionType: string;
  startsAt: string;
  durationMin: number | null;
  location: string | null;
  mdOffset: number | null;
  groupIds: string[];
};

export async function createSession(
  db: Db,
  orgId: string,
  userId: string,
  input: NewSessionInput,
): Promise<{ error: string | null }> {
  const seasonId = await fetchCurrentSeasonId(db, orgId);
  if (!seasonId) return { error: 'No current season is set up for this club.' };

  const { data: session, error } = await db
    .from('sessions')
    .insert({
      org_id: orgId,
      season_id: seasonId,
      session_type: input.sessionType as Session['session_type'],
      title: input.title.trim(),
      starts_at: input.startsAt,
      duration_min: input.durationMin,
      location: input.location,
      md_offset: input.mdOffset,
      created_by: userId,
    })
    .select('id')
    .single();

  if (error || !session) return { error: error?.message ?? 'Could not create the session.' };

  if (input.groupIds.length > 0) {
    const { error: participantsError } = await db.from('session_participants').insert(
      input.groupIds.map((groupId) => ({
        org_id: orgId,
        session_id: session.id,
        group_id: groupId,
      })),
    );
    if (participantsError) return { error: participantsError.message };
  }

  return { error: null };
}

/* ---------------------------------------------------------------------------
 * Session detail: view, edit, cancel, delete. screens/session-detail.md,
 * screen 16, simplified the same way session creation was: the Overview
 * fields only. No attendance tab, no load tab, no restriction-conflict
 * warning system (that whole mechanic depends on availability.restrictions
 * matching, a separate subsystem this build does not have yet), no gym or
 * GPS actuals, no offline queue, no realtime broadcast on cancellation. All
 * real, documented cuts, not silent ones. Group participants only, same as
 * creation: no individual-athlete assignment yet.
 * ------------------------------------------------------------------------ */

export type SessionDetail = Session & {
  groupIds: string[];
  hasRecordedData: boolean;
};

export async function fetchSessionDetail(
  db: Db,
  orgId: string,
  sessionId: string,
): Promise<SessionDetail | null> {
  const { data: session, error } = await db
    .from('sessions')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('id', sessionId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!session) return null;

  const [participants, attendance, entries] = await Promise.all([
    db
      .from('session_participants')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId),
    db
      .from('session_attendance')
      .select('id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId)
      .limit(1),
    db
      .from('training_entries')
      .select('id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId)
      .limit(1),
  ]);

  if (participants.error) throw new Error(participants.error.message);
  if (attendance.error) throw new Error(attendance.error.message);
  if (entries.error) throw new Error(entries.error.message);

  const groupIds = (participants.data ?? [])
    .map((p) => p.group_id)
    .filter((id): id is string => id !== null);

  return {
    ...session,
    groupIds,
    hasRecordedData: (attendance.data?.length ?? 0) > 0 || (entries.data?.length ?? 0) > 0,
  };
}

export type UpdateSessionInput = NewSessionInput;

export async function updateSession(
  db: Db,
  orgId: string,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('sessions')
    .update({
      session_type: input.sessionType as Session['session_type'],
      title: input.title.trim(),
      starts_at: input.startsAt,
      duration_min: input.durationMin,
      location: input.location,
      md_offset: input.mdOffset,
    })
    .eq('id', sessionId)
    .eq('org_id', orgId);

  if (error) return { error: error.message };

  /* Group participants are reconciled by delete-then-insert, not a diff,
   * because this build only assigns whole groups (see NewSessionInput).
   * Only group_id rows are touched, so a seeded individual-athlete row (if
   * one exists) survives an edit made through this form. Not atomic:
   * screens/session-detail.md specifies one RPC transaction for this. A
   * failed insert right after a successful delete would leave the session
   * with no participants — a real, documented gap in this simplified
   * build, not a silent one. */
  const { error: deleteError } = await db
    .from('session_participants')
    .delete()
    .eq('org_id', orgId)
    .eq('session_id', sessionId)
    .not('group_id', 'is', null);

  if (deleteError) return { error: deleteError.message };

  if (input.groupIds.length > 0) {
    const { error: insertError } = await db.from('session_participants').insert(
      input.groupIds.map((groupId) => ({
        org_id: orgId,
        session_id: sessionId,
        group_id: groupId,
      })),
    );
    if (insertError) return { error: insertError.message };
  }

  return { error: null };
}

/** screens/schedule.md: "Cancel session — expectations for that session are
 *  waived, not deleted." This build does not yet generate
 *  compliance_expectations rows at all (that lands with the flag engine's
 *  wider compliance work), so there is nothing to waive here — a real,
 *  documented cut, not a silent one. */
export async function cancelSession(
  db: Db,
  orgId: string,
  sessionId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', sessionId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

/** The reverse of cancelSession, per session-detail.md's lifecycle diagram:
 *  Cancelled -> Planned. */
export async function reinstateSession(
  db: Db,
  orgId: string,
  sessionId: string,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('sessions')
    .update({ status: 'planned' })
    .eq('id', sessionId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

/** Soft delete, and only when it is safe: screens/schedule.md's own rule is
 *  "permitted only when the session is in the future and has no
 *  session_attendance and no training_entries. Otherwise cancel is the only
 *  option," with the exact refusal message from session-detail.md's
 *  validation table. */
export async function deleteSession(
  db: Db,
  orgId: string,
  sessionId: string,
): Promise<{ error: string | null }> {
  const [session, attendance, entries] = await Promise.all([
    db.from('sessions').select('starts_at').eq('id', sessionId).eq('org_id', orgId).maybeSingle(),
    db
      .from('session_attendance')
      .select('id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId)
      .limit(1),
    db
      .from('training_entries')
      .select('id')
      .eq('org_id', orgId)
      .eq('session_id', sessionId)
      .limit(1),
  ]);

  if (session.error) return { error: session.error.message };
  if (attendance.error) return { error: attendance.error.message };
  if (entries.error) return { error: entries.error.message };

  if ((attendance.data?.length ?? 0) > 0 || (entries.data?.length ?? 0) > 0) {
    return { error: 'This session has recorded data. Cancel it instead.' };
  }
  if (session.data && new Date(session.data.starts_at).getTime() < Date.now()) {
    return { error: 'This session is in the past. Cancel it instead of deleting it.' };
  }

  const { error } = await db
    .from('sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

export async function fetchNextFixture(
  db: Db,
  orgId: string,
  fromIso: string,
): Promise<NextFixture | null> {
  const { data, error } = await db
    .from('fixtures')
    .select('id, opponent, kickoff_at, venue, home_away, competition')
    .eq('org_id', orgId)
    .gte('kickoff_at', fromIso)
    .eq('status', 'scheduled')
    .is('deleted_at', null)
    .order('kickoff_at')
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/* ---------------------------------------------------------------------------
 * Fixture detail. screens/fixture-detail.md, screen 17, simplified to the
 * Details tab only. Route per 20-route-map.md line 107,
 * `/schedule/fixtures/:fixtureId` — the route-map's naming wins over the
 * screen doc's own `/schedule/fixture/{id}` header, same rule applied for
 * session detail above. Two whole tabs are real, documented cuts:
 *   - Selection never got built: it needs a `fixture_selections` table that
 *     does not exist anywhere in the schema (route-map gap G-3). Building
 *     it would mean inventing a table the project's own gap tracker says
 *     needs a spec decision first, not a page decision.
 *   - Availability tiles (available/modified/unavailable counts as at
 *     today) are a real subsystem in their own right, not a quick add —
 *     deferred rather than built half-heartedly under this pass.
 * There is also no `/schedule/fixtures/new`: this pass completes an
 * existing entity's own page, the same shape as the session detail pass,
 * not a new creation surface.
 * ------------------------------------------------------------------------ */

export type Fixture = Pick<
  FixtureRow,
  | 'id'
  | 'opponent'
  | 'kickoff_at'
  | 'venue'
  | 'home_away'
  | 'competition'
  | 'importance'
  | 'status'
  | 'result'
>;

const FIXTURE_COLUMNS =
  'id, opponent, kickoff_at, venue, home_away, competition, importance, status, result';

export type FixtureDetail = Fixture & { weekSessions: WeekSession[] };

export async function fetchFixtureDetail(
  db: Db,
  orgId: string,
  fixtureId: string,
): Promise<FixtureDetail | null> {
  const { data: fixture, error } = await db
    .from('fixtures')
    .select(FIXTURE_COLUMNS)
    .eq('org_id', orgId)
    .eq('id', fixtureId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!fixture) return null;

  const { data: sessions, error: sessionsError } = await db
    .from('sessions')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .eq('fixture_id', fixtureId)
    .is('deleted_at', null)
    .order('starts_at');

  if (sessionsError) throw new Error(sessionsError.message);

  const weekSessions: WeekSession[] = (sessions ?? []).map((s) => ({
    ...s,
    expected: null,
    entry_date: s.starts_at.slice(0, 10),
  }));

  return { ...fixture, weekSessions };
}

export type UpdateFixtureInput = {
  opponent: string;
  kickoffAt: string;
  venue: string | null;
  homeAway: Fixture['home_away'];
  competition: string | null;
  importance: Fixture['importance'];
  result: string | null;
};

export async function updateFixture(
  db: Db,
  orgId: string,
  fixtureId: string,
  input: UpdateFixtureInput,
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('fixtures')
    .update({
      opponent: input.opponent.trim(),
      kickoff_at: input.kickoffAt,
      venue: input.venue,
      home_away: input.homeAway,
      competition: input.competition,
      importance: input.importance,
      result: input.result,
    })
    .eq('id', fixtureId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}

/** One setter for every status a fixture can be in, rather than one
 *  function per transition: screens/fixture-detail.md's mockup shows
 *  scheduled, postponed, cancelled and played all reachable from the same
 *  screen, and the RLS grant does not distinguish between them. */
export async function setFixtureStatus(
  db: Db,
  orgId: string,
  fixtureId: string,
  status: Fixture['status'],
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('fixtures')
    .update({ status })
    .eq('id', fixtureId)
    .eq('org_id', orgId);
  return { error: error?.message ?? null };
}
