import type { FixtureRow, SessionRow } from '@/lib/types/database';
import { addDays, anchorMdOffsetsToWeek, dateInTz, zonedTimeToUtcIso } from '@/lib/format';
import { humanizeDbError } from '@/lib/writeErrors';
import { fetchCurrentAvailability } from './availability';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';
import { computeConflicts } from './restrictionConflicts';

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
  | 'updated_at'
>;

export type SessionWithHeadcount = Session & { expected: number | null };

const COLUMNS =
  'id, title, session_type, starts_at, duration_min, location, md_offset, planned_rpe, status, fixture_id, updated_at';

/** The UTC instant range covering local midnight-to-midnight in `timezone`,
 *  for one date or an inclusive multi-day span (`fromDate`..`toDate`).
 *
 *  Audit finding, integration-audit fix plan Batch 2: the previous version
 *  of this built literal UTC-day bounds (`` `${date}T00:00:00Z}` ``..
 *  `` `${date}T23:59:59.999Z}` ``), which is only correct for UTC+0 with no
 *  DST. Europe/London is UTC+1 (BST) for roughly half the year, so any
 *  session between 23:00–00:00 UTC (00:00–01:00 local) was being attributed
 *  to the wrong calendar day everywhere this ran — both the coach and
 *  athlete surfaces, identically, since both called the same broken
 *  primitive. `zonedTimeToUtcIso` (format.ts) is the existing, already-
 *  correct-across-DST primitive for turning a local wall-clock moment into
 *  a UTC instant; this uses it for both edges of the window instead of
 *  assuming the offset is always zero. The upper bound is local next-day
 *  midnight minus 1ms (not `lt` on next midnight) so `fetchSessionsBetween`
 *  can keep using `.lte()` on both ends unchanged.
 *
 *  Exported (only) so scripts/test-schedule-timezone.ts can assert the
 *  boundary directly — every real caller still goes through the functions
 *  below, not this. */
export function rangeBounds(fromDate: string, toDate: string, timezone: string): { from: string; to: string } {
  const from = zonedTimeToUtcIso(fromDate, '00:00', timezone);
  const nextMidnight = zonedTimeToUtcIso(addDays(toDate, 1), '00:00', timezone);
  const to = new Date(new Date(nextMidnight).getTime() - 1).toISOString();
  return { from, to };
}

export function dayBounds(date: string, timezone: string): { from: string; to: string } {
  return rangeBounds(date, date, timezone);
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
  /* PAGED. Every caller but one asks for a day or a week and could never have
   * reached PostgREST's silent 1000-row ceiling; fetchAthleteRecentSessions
   * now asks for up to MAX_WINDOW_DAYS (730) because /my-data grew a period
   * selector, and this read is ORG-WIDE — every session for every group, not
   * just the athlete's — so a club running three or four sessions a day is
   * several thousand rows over two seasons.
   *
   * The ordering is what made truncation dangerous rather than merely lossy:
   * `.order('starts_at')` is ASCENDING, so a silently capped result would have
   * been the OLDEST 1000 sessions and every caller that sorts most-recent-first
   * afterwards (fetchAthleteRecentSessions does, then slices) would have shown
   * a year-old session as "recent". `.order('id')` is the unique tiebreak
   * paged.ts's header requires: two sessions can legally start at the same
   * instant, and a tie broken differently on each page duplicates or drops a
   * row across the boundary. */
  return fetchAllPaged<Session>((pageFrom, pageTo) =>
    db
      .from('sessions')
      .select(COLUMNS)
      .eq('org_id', orgId)
      .gte('starts_at', from)
      .lte('starts_at', to)
      .is('deleted_at', null)
      .order('starts_at')
      .order('id')
      .range(pageFrom, pageTo),
  );
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
  timezone: string,
): Promise<SessionWithHeadcount[]> {
  const bounds = dayBounds(date, timezone);
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
  timezone: string,
): Promise<Session[]> {
  const bounds = dayBounds(date, timezone);
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

/** Which of an athlete's own days in a week carry which kinds of session.
 *
 *  Exists for the Today week strip, which could previously only colour a day
 *  by its MD offset — so a training day and a rest day looked identical, and
 *  "what is this week actually like" was unanswerable at a glance. Returns a
 *  date -> session types map; a date absent from the map is a genuine rest
 *  day for this athlete, not merely a day nothing was fetched for.
 *
 *  Same membership-and-participants resolution as fetchAthleteDaySessions
 *  above, widened from one day to a range: a session counts as this
 *  athlete's if they are named on it individually or through a group they
 *  are currently in. Deliberately not a second, looser definition of "my
 *  session" — the two must agree or the strip would contradict the day list
 *  directly beneath it. */
export async function fetchAthleteWeekSessionTypes(
  db: Db,
  orgId: string,
  athleteId: string,
  weekStart: string,
  timezone: string,
): Promise<Map<string, Set<string>>> {
  const bounds = rangeBounds(weekStart, addDays(weekStart, 6), timezone);
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
  const byDate = new Map<string, Set<string>>();
  if (sessions.length === 0) return byDate;

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
      .filter((p) => p.athlete_id === athleteId || (p.group_id !== null && myGroups.has(p.group_id)))
      .map((p) => p.session_id),
  );

  for (const s of sessions) {
    if (!mine.has(s.id)) continue;
    // The session's own local calendar date, not a UTC one — a 19:00 session
    // in a zone ahead of UTC must not land on the following day in the strip.
    const date = dateInTz(new Date(s.starts_at), timezone);
    const set = byDate.get(date) ?? new Set<string>();
    set.add(s.session_type);
    byDate.set(date, set);
  }
  return byDate;
}

export type RecentSession = Session & {
  rpe: number | null;
  session_load: number | null;
  attendance: string | null;
};

/** An athlete's recent sessions with what they reported afterwards. A session
 *  with no entry shows a blank, which is not the same as an easy session.
 *
 *  WINDOW. `from`/`to` used to be a fixed 42 days on /my-data and a fixed
 *  `?days=` on the athlete report. /my-data now drives this from the shared
 *  period model (lib/period.ts), so `to - from` can be MAX_WINDOW_DAYS (730).
 *  Three of the four reads below were unbounded by construction at that width
 *  and are paged; the fourth (group_memberships) is bounded by how many groups
 *  one athlete can be in. See each one's note. */
export async function fetchAthleteRecentSessions(
  db: Db,
  orgId: string,
  athleteId: string,
  from: string,
  to: string,
  timezone: string,
  limit = 8,
): Promise<RecentSession[]> {
  const bounds = rangeBounds(from, to, timezone);

  /* Resolved BEFORE the participants read, not alongside it, because that read
   * now filters on the group list rather than filtering in memory afterwards.
   * Bounded: one row per group this athlete is currently in. */
  const memberships = await db
    .from('group_memberships')
    .select('group_id')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('removed_at', null);
  if (memberships.error) throw new Error(memberships.error.message);
  const myGroups = (memberships.data ?? [])
    .map((m) => m.group_id)
    .filter((id): id is string => id !== null);

  const [sessions, entries, attendance, participants] = await Promise.all([
    fetchSessionsBetween(db, orgId, bounds.from, bounds.to),

    /* PAGED. `training_entries_one_live_per_session` (migration 0004) bounds
     * this to one row per session, not one per day — an athlete with two
     * sessions a day is past 1000 rows before the 500th day. */
    fetchAllPaged<{ session_id: string | null; rpe: number | null; session_load: number | null }>(
      (pageFrom, pageTo) =>
        db
          .from('training_entries_current')
          .select('session_id, rpe, session_load')
          .eq('athlete_id', athleteId)
          .gte('entry_date', from)
          .lte('entry_date', to)
          .order('entry_date')
          .order('id')
          .range(pageFrom, pageTo),
    ),

    /* PAGED. This read has NO date filter at all and never had one — it is
     * every attendance row this athlete has ever had, which passes 1000 in
     * about three seasons regardless of the window asked for. Pre-existing
     * exposure, not one the period selector created, but it is the same silent
     * ceiling and it is fixed here rather than left because the fix is three
     * lines. */
    fetchAllPaged<{ session_id: string; attendance: string | null }>((pageFrom, pageTo) =>
      db
        .from('session_attendance')
        .select('session_id, attendance')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .order('session_id')
        .order('id')
        .range(pageFrom, pageTo),
    ),

    /* PAGED, AND INVERTED. This used to be `.in('session_id', <every session
     * in the window>)` and then filtered in memory. At 42 days that was a few
     * dozen ids; at 730 days it is every session the CLUB ran — several
     * thousand UUIDs, ~37 bytes each, in a GET query string, which is a URL
     * length failure long before it is a row-count one.
     *
     * Asking the question from the athlete's side instead removes both
     * problems: the filter is "named individually, or named through a group I
     * am currently in", which is the identical definition of "my session" the
     * in-memory filter applied, expressed in SQL. It returns one row per
     * session this athlete is on rather than one per session the club ran, and
     * the intersection with the windowed `sessions` list below is what bounds
     * it to the period — participations outside the window simply never match.
     *
     * Still paged: over a club's lifetime one athlete can accumulate more than
     * 1000 participations. `id` is the primary key (migration 0003) and the
     * only unique order available — a group row has a null athlete_id, so
     * (session_id, athlete_id) is not unique. */
    fetchAllPaged<{ session_id: string }>((pageFrom, pageTo) => {
      const q = db.from('session_participants').select('session_id').eq('org_id', orgId);
      // `.or()` with an empty `in.()` list is a PostgREST syntax error, so an
      // athlete in no groups asks the narrower question rather than a broken one.
      const scoped =
        myGroups.length > 0
          ? q.or(`athlete_id.eq.${athleteId},group_id.in.(${myGroups.join(',')})`)
          : q.eq('athlete_id', athleteId);
      return scoped.order('id').range(pageFrom, pageTo);
    }),
  ]);

  if (sessions.length === 0) return [];

  const mine = new Set(participants.map((p) => p.session_id));

  const entryBySession = new Map(
    entries.filter((e) => e.session_id !== null).map((e) => [e.session_id as string, e]),
  );
  const attendanceBySession = new Map(attendance.map((a) => [a.session_id, a.attendance]));

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
 *  by construction, so the last one written per day is as good as any.
 *
 *  Offsets are re-anchored to this week's OWN matchday
 *  (anchorMdOffsetsToWeek, format.ts): a stored md_offset counts toward
 *  whichever fixture the session was created against, which for a
 *  historical week can be a fixture in a later week — the audit caught an
 *  actual matchday labelled "MD-7" that way. */
export async function fetchWeekMdLabels(
  db: Db,
  orgId: string,
  weekStart: string,
  timezone: string,
): Promise<Map<string, number | null>> {
  const bounds = rangeBounds(weekStart, addDays(weekStart, 6), timezone);

  const sessions = await fetchSessionsBetween(db, orgId, bounds.from, bounds.to);
  const byDate = new Map<string, { isMatch: boolean; storedMdOffset: number | null }>();
  for (const s of sessions) {
    // Same bug class as this file's own dayBounds()/rangeBounds() (audit
    // Batch 2), a level down: `starts_at` is a stored UTC instant, and
    // `.slice(0, 10)` reads its UTC calendar date, not the org's local
    // one — a session between 23:00-00:00 UTC (00:00-01:00 local in BST)
    // would be bucketed under the wrong day here. dateInTz (format.ts) is
    // the shared primitive for this, same as every other fix below.
    const date = dateInTz(new Date(s.starts_at), timezone);
    const cur = byDate.get(date) ?? { isMatch: false, storedMdOffset: null };
    byDate.set(date, {
      isMatch: cur.isMatch || s.session_type === 'match',
      storedMdOffset: s.md_offset ?? cur.storedMdOffset,
    });
  }
  return anchorMdOffsetsToWeek(
    [...byDate.entries()].map(([date, v]) => ({ date, isMatch: v.isMatch, storedMdOffset: v.storedMdOffset })),
  );
}

export async function fetchWeekSessions(
  db: Db,
  orgId: string,
  weekStart: string,
  groupIds: readonly string[],
  timezone: string,
): Promise<WeekSession[]> {
  const bounds = rangeBounds(weekStart, addDays(weekStart, 6), timezone);

  const sessions = await fetchSessionsBetween(db, orgId, bounds.from, bounds.to);
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
      // Local calendar date, not the UTC one — see fetchWeekMdLabels's
      // byDate map above for the full explanation of this bug class.
      entry_date: dateInTz(new Date(session.starts_at), timezone),
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
  /** Restriction-to-session-card linkage (integration audit Batch 3): how
   *  many of this session's participants have a currently-open restriction
   *  that `computeConflicts` (restrictionConflicts.ts) flags as relevant to
   *  this session's type/intensity — the same heuristic TimetableSessionCard
   *  already surfaces per-athlete. SelectedSessionPanel has no participant
   *  roster to name names against, so this is a count for a summary banner,
   *  not a per-athlete list; a coach who needs the who goes to Timetable. */
  restrictionConflictCount: number;
};

export async function fetchWeekSessionsDetailed(
  db: Db,
  orgId: string,
  weekStart: string,
  groupIds: readonly string[],
  allGroups: readonly { id: string; name: string }[],
  timezone: string,
): Promise<GridSession[]> {
  const bounds = rangeBounds(weekStart, addDays(weekStart, 6), timezone);

  const sessions = await fetchSessionsBetween(db, orgId, bounds.from, bounds.to);
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

  // Restriction-to-session-card linkage: resolve every in-scope athlete's
  // current restrictions once, batched, same pattern fetchTimetableDay
  // already uses — not a new query shape, and not one call per session.
  const athleteIdsBySession = new Map<string, Set<string>>();
  const allAthleteIds = new Set<string>();
  for (const session of sessions) {
    const set = new Set<string>();
    for (const p of participants.data ?? []) {
      if (p.session_id !== session.id) continue;
      if (p.athlete_id) set.add(p.athlete_id);
      if (p.group_id) for (const id of groupMembers.get(p.group_id) ?? []) set.add(id);
    }
    athleteIdsBySession.set(session.id, set);
    for (const id of set) {
      if (!inScope || inScope.has(id)) allAthleteIds.add(id);
    }
  }
  const availability = allAthleteIds.size > 0 ? await fetchCurrentAvailability(db, orgId, [...allAthleteIds]) : [];
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));

  return sessions.map((session) => {
    const athleteIds = athleteIdsBySession.get(session.id) ?? new Set<string>();
    const groupIdsForSession = new Set<string>();
    for (const p of participants.data ?? []) {
      if (p.session_id !== session.id) continue;
      if (p.group_id) groupIdsForSession.add(p.group_id);
    }
    const counted = inScope ? [...athleteIds].filter((id) => inScope.has(id)) : [...athleteIds];
    const groupIdList = [...groupIdsForSession];
    const restrictionConflictCount = counted.filter((id) => {
      const avail = availByAthlete.get(id);
      if (!avail) return false;
      return computeConflicts(session.session_type, session.planned_rpe, avail.restrictions ?? []).length > 0;
    }).length;

    return {
      ...session,
      // Local calendar date, not the UTC one — see fetchWeekMdLabels's
      // byDate map above for the full explanation of this bug class.
      entry_date: dateInTz(new Date(session.starts_at), timezone),
      groupIds: groupIdList,
      groupNames: groupIdList.map((id) => groupNameById.get(id) ?? 'Unnamed group'),
      athleteIds: counted,
      restrictionConflictCount,
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
  timezone: string,
  maxWeeks = 8,
): Promise<NormalWeek> {
  const { data: matches, error } = await db
    .from('sessions')
    .select('starts_at')
    .eq('org_id', orgId)
    .eq('session_type', 'match')
    .is('deleted_at', null)
    .lt('starts_at', zonedTimeToUtcIso(weekStart, '00:00', timezone))
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);

  const seenWeeks = new Set<string>();
  const weeks: string[] = [];
  for (const m of matches ?? []) {
    // Local calendar date, not the UTC one — see fetchWeekMdLabels's
    // byDate map above for the full explanation of this bug class.
    const wk = mondayOf(dateInTz(new Date(m.starts_at), timezone));
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
    weeks.map((wk) => fetchWeekSessionsDetailed(db, orgId, wk, groupIds, allGroups, timezone)),
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
export async function fetchWeekFixtures(
  db: Db,
  orgId: string,
  weekStart: string,
  timezone: string,
): Promise<WeekFixture[]> {
  const bounds = rangeBounds(weekStart, addDays(weekStart, 6), timezone);

  const { data, error } = await db
    .from('fixtures')
    .select('opponent, kickoff_at, home_away')
    .eq('org_id', orgId)
    .gte('kickoff_at', bounds.from)
    .lte('kickoff_at', bounds.to)
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

export type CurrentSeason = { id: string; name: string; starts_on: string; ends_on: string };

/** The current season's real date bounds, not just its id.
 *
 *  Added for the testing report's "season's best" tile, which needs to
 *  bound test_date against a real range — lib/queries/testingReport.ts's
 *  own header still says "there is no season table in this schema to bound
 *  it against". That statement is simply out of date: `seasons` has existed
 *  since migration 0003 with starts_on/ends_on, and 0016_leaderboards.sql's
 *  window_type = 'season' branch already resolves a season window off it in
 *  SQL. This is the TypeScript-side equivalent of that same lookup, so the
 *  two surfaces agree on what "this season" means.
 *
 *  `.is('deleted_at', null)` matters here and is deliberately not a copy of
 *  fetchCurrentSeasonId above: the seasons_one_current unique index (0003)
 *  is PARTIAL — `where is_current and deleted_at is null` — so a
 *  soft-deleted season that was current when it was deleted can legally
 *  coexist with the live current one. Without the filter maybeSingle() sees
 *  two rows and throws. (fetchCurrentSeasonId has the same latent gap; left
 *  alone rather than changed underneath its existing callers in an
 *  unrelated feature, but it is a real bug and is flagged as one.)
 *
 *  starts_on/ends_on are `date` columns, not timestamptz, so they are
 *  compared as plain YYYY-MM-DD strings against test_results.test_date
 *  (also a `date`). CLAUDE.md rule 5 governs instants; a calendar date that
 *  is already stored date-typed has no timezone to convert and must not be
 *  pushed through dateInTz, which would shift it by a day near midnight. */
export async function fetchCurrentSeason(db: Db, orgId: string): Promise<CurrentSeason | null> {
  const { data, error } = await db
    .from('seasons')
    .select('id, name, starts_on, ends_on')
    .eq('org_id', orgId)
    .eq('is_current', true)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
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

  if (error || !session)
    return { error: error ? humanizeDbError(error.message, 'staff') : 'Could not create the session.' };

  if (input.groupIds.length > 0) {
    const { error: participantsError } = await db.from('session_participants').insert(
      input.groupIds.map((groupId) => ({
        org_id: orgId,
        session_id: session.id,
        group_id: groupId,
      })),
    );
    if (participantsError) return { error: humanizeDbError(participantsError.message, 'staff') };
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

/** `expectedUpdatedAt` is the session's `updated_at` as read at the moment
 *  the caller last loaded it (ScheduleWorkspace's `baseById` snapshot, or
 *  SessionEditForm's server-fetched `SessionDetail`) — the optimistic-lock
 *  token for the conflict check below. */
export type UpdateSessionInput = NewSessionInput & { expectedUpdatedAt: string };

/** Conflict message shown verbatim (never humanized further — see the two
 *  call sites, both of which pass it straight through). */
export const SESSION_CHANGED_ELSEWHERE_ERROR =
  'This session was changed elsewhere since this page loaded. Reload to see the latest version, then make your change again.';

export async function updateSession(
  db: Db,
  orgId: string,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<{ error: string | null }> {
  /* Optimistic concurrency lock. schedule.ts's own sessions table gets
   * `updated_at` bumped on every UPDATE by the `set_updated_at` trigger
   * (migration 0010) — already there, nothing new to add for this. The
   * write is scoped `.eq('updated_at', input.expectedUpdatedAt)` in
   * addition to id/org_id, so it only lands if nobody has touched this row
   * since the caller last read it.
   *
   * Audit finding (Part A): ScheduleWorkspace.handlePublish resends every
   * field from a `baseById` snapshot frozen at page load for whichever
   * fields the local edit patch didn't touch (only start/duration/groups
   * are ever in that patch — see ScheduleGrid/types.ts's EditOverlay
   * comment). If another tab or another staff member (SessionEditForm on
   * `/schedule/[sessionId]`, a genuinely concurrent live write) changed
   * this session's title/location/type/mdOffset after this tab's page
   * loaded, publishing an unrelated start-time change here would silently
   * overwrite that other change back to the stale snapshot value — no
   * error anywhere.
   *
   * Two fixes were on the table: (a) this lock, or (b) never resend a
   * field the local patch didn't actually touch. (b) is cheaper but only
   * protects the fields this particular UI happens not to expose for
   * editing today — it is incidental, not structural, and it does nothing
   * for a genuine race on a field this UI *does* let the user change
   * (two coaches both nudging the same session's start time at once would
   * still silently pick a winner with (b)). The lock here is strictly
   * broader: it catches every concurrent change to the row, on any field,
   * from either write path, and turns it into a clear, actionable error
   * instead of a silent overwrite — which is also the app's established
   * pattern for concurrent-write safety elsewhere (ADR-005's
   * revise_wellness_entry / revise_training_entry: never silently clobber,
   * always surface a "this changed, go look again" error). Chosen for that
   * reason, at the cost of a bit more plumbing (`updated_at` now flows
   * through `Session`/`BaseSession`/`SessionDetail` to reach this call).
   */
  const { data: updated, error } = await db
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
    .eq('org_id', orgId)
    .eq('updated_at', input.expectedUpdatedAt)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) return { error: humanizeDbError(error.message, 'staff') };

  if (!updated) {
    // Zero rows matched the lock predicate. Either the row is gone (soft
    // deleted since this page loaded) or — far more likely — someone else
    // wrote to it, which moved `updated_at` out from under us. Tell them
    // apart so the message is honest rather than generic.
    const { data: stillExists, error: existsError } = await db
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle();
    if (existsError) return { error: humanizeDbError(existsError.message, 'staff') };
    if (!stillExists) {
      return { error: 'This session no longer exists. It may have been deleted.' };
    }
    return { error: SESSION_CHANGED_ELSEWHERE_ERROR };
  }

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

  if (deleteError) return { error: humanizeDbError(deleteError.message, 'staff') };

  if (input.groupIds.length > 0) {
    const { error: insertError } = await db.from('session_participants').insert(
      input.groupIds.map((groupId) => ({
        org_id: orgId,
        session_id: sessionId,
        group_id: groupId,
      })),
    );
    if (insertError) return { error: humanizeDbError(insertError.message, 'staff') };
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
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
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
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
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

  if (session.error) return { error: humanizeDbError(session.error.message, 'staff') };
  if (attendance.error) return { error: humanizeDbError(attendance.error.message, 'staff') };
  if (entries.error) return { error: humanizeDbError(entries.error.message, 'staff') };

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
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
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
  timezone: string,
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
    // Local calendar date, not the UTC one — see fetchWeekMdLabels's
    // byDate map above for the full explanation of this bug class.
    entry_date: dateInTz(new Date(s.starts_at), timezone),
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
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
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
  return { error: error ? humanizeDbError(error.message, 'staff') : null };
}
