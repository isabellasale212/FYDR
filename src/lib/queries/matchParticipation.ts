import { restrictionLine } from '@/lib/restrictions';
import { mustAffect } from '@/lib/write';
import type { AvailabilityStatus } from '@/lib/types/database';
import { fetchAllPaged } from './paged';
import type { Db } from './groups';

/* Match participation (0127): the coach's post-match sheet on a fixture, and
 * what the match report reads. One row per athlete selected; started, came
 * on, minutes (null = not recorded). Availability at kick-off is not stored —
 * the availability ledger holds the row in force at kickoff_at, read here. */

export type SheetRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  squad_number: number | null;
  /** Null = not selected (no row on the sheet). */
  started: boolean;
  came_on: boolean;
  minutes: number | null;
  selected: boolean;
  /** The row in force at kick-off, or null when none was. */
  availability: AvailabilityStatus | null;
  restrictions: string[];
  /** On the sheet but no longer on the roster (left the club since). */
  offRoster: boolean;
};

export type FixtureSheet = {
  fixture: { id: string; opponent: string; kickoff_at: string; status: string; home_away: string; venue: string | null };
  rows: SheetRow[];
  /** Athletes on the roster (not left, not deleted) — the squad the figure counts over. */
  squad: number;
  recorded: { by: string | null; at: string | null };
};

/** The squad's availability as it stood at one instant: for every athlete,
 *  the row whose window holds the instant. Restrictions pass through
 *  restrictionLine (D1) like every other read. */
export async function fetchAvailabilityAt(db: Db, orgId: string, instant: string): Promise<Map<string, { status: AvailabilityStatus; restrictions: string[] }>> {
  const rows = await fetchAllPaged<{ athlete_id: string; status: AvailabilityStatus; restrictions: string[] | null; effective_from: string }>((from, to) =>
    db
      .from('availability')
      .select('athlete_id, status, restrictions, effective_from')
      .eq('org_id', orgId)
      .lte('effective_from', instant)
      .or(`effective_to.is.null,effective_to.gt.${instant}`)
      .order('effective_from', { ascending: false })
      .order('id')
      .range(from, to),
  );
  const out = new Map<string, { status: AvailabilityStatus; restrictions: string[] }>();
  for (const r of rows) if (!out.has(r.athlete_id)) out.set(r.athlete_id, { status: r.status, restrictions: restrictionLine(r.restrictions) });
  return out;
}

/** The sheet for one fixture: every athlete on the roster with their row if
 *  they have one, and availability at kick-off for all of them. Null when
 *  the fixture is not this club's. */
export async function fetchFixtureSheet(db: Db, orgId: string, fixtureId: string): Promise<FixtureSheet | null> {
  const { data: fixture, error } = await db
    .from('fixtures')
    .select('id, opponent, kickoff_at, status, home_away, venue')
    .eq('org_id', orgId)
    .eq('id', fixtureId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!fixture) return null;

  const [athletesRes, sheetRes, availability] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name, position, squad_number').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club').order('last_name').order('first_name'),
    db.from('match_participation').select('athlete_id, started, came_on, minutes, recorded_by, recorded_at, updated_at').eq('org_id', orgId).eq('fixture_id', fixtureId),
    fetchAvailabilityAt(db, orgId, fixture.kickoff_at),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (sheetRes.error) throw new Error(sheetRes.error.message);
  const byAthlete = new Map((sheetRes.data ?? []).map((r) => [r.athlete_id, r]));

  const rows: SheetRow[] = (athletesRes.data ?? []).map((a) => {
    const r = byAthlete.get(a.id);
    const av = availability.get(a.id);
    return {
      athlete_id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      position: a.position,
      squad_number: a.squad_number,
      started: r?.started ?? false,
      came_on: r?.came_on ?? false,
      minutes: r?.minutes ?? null,
      selected: r !== undefined,
      availability: av?.status ?? null,
      restrictions: av?.restrictions ?? [],
      offRoster: false,
    };
  });
  /* An athlete on the sheet who has since left the club still played: the
     report keeps them. */
  const offRoster = (sheetRes.data ?? []).filter((r) => !rows.some((x) => x.athlete_id === r.athlete_id));
  if (offRoster.length > 0) {
    const { data: gone } = await db.from('athletes').select('id, first_name, last_name, position, squad_number').eq('org_id', orgId).in('id', offRoster.map((r) => r.athlete_id));
    for (const a of gone ?? []) {
      const r = byAthlete.get(a.id)!;
      const av = availability.get(a.id);
      rows.push({ athlete_id: a.id, first_name: a.first_name, last_name: a.last_name, position: a.position, squad_number: a.squad_number, started: r.started, came_on: r.came_on, minutes: r.minutes, selected: true, availability: av?.status ?? null, restrictions: av?.restrictions ?? [], offRoster: true });
    }
  }
  const latest = (sheetRes.data ?? []).map((r) => ({ by: r.recorded_by, at: r.updated_at })).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null;

  return {
    fixture,
    rows,
    squad: athletesRes.data?.length ?? 0,
    recorded: { by: latest?.by ?? null, at: latest?.at ?? null },
  };
}

/** The sheet narrowed to a group scope (CLAUDE.md §3): the rows in scope,
 *  and the squad the figure counts over as the roster in scope. Null scope
 *  is the whole squad. */
export function scopeSheet(full: FixtureSheet, scope: readonly string[] | null): FixtureSheet {
  if (!scope) return full;
  const inScope = new Set(scope);
  return { ...full, rows: full.rows.filter((r) => inScope.has(r.athlete_id)), squad: full.rows.filter((r) => inScope.has(r.athlete_id) && !r.offRoster).length };
}

/** Fixtures that have kicked off, newest first — the report's selector. */
export async function fetchPastFixtures(db: Db, orgId: string, now: string): Promise<{ id: string; opponent: string; kickoff_at: string; status: string; sheet_rows: number }[]> {
  const { data, error } = await db
    .from('fixtures')
    .select('id, opponent, kickoff_at, status')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .lte('kickoff_at', now)
    .neq('status', 'cancelled')
    .order('kickoff_at', { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((f) => f.id);
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: rows } = await db.from('match_participation').select('fixture_id').eq('org_id', orgId).in('fixture_id', ids);
    for (const r of rows ?? []) counts.set(r.fixture_id, (counts.get(r.fixture_id) ?? 0) + 1);
  }
  return (data ?? []).map((f) => ({ ...f, sheet_rows: counts.get(f.id) ?? 0 }));
}

export type SheetInput = { athleteId: string; selection: 'started' | 'came_on' | 'unused' | 'none'; minutes: number | null };

/** Save the sheet: upsert a row for every selected athlete, remove the row
 *  of an athlete no longer selected. Each write is the coach's own session
 *  under RLS (SESSION_EDIT) and audited by trigger. Minutes on an unselected
 *  athlete is refused here in words: a number with nobody behind it. */
export async function saveSheet(db: Db, orgId: string, userId: string, fixtureId: string, input: readonly SheetInput[]): Promise<{ error: string | null; saved: number; removed: number }> {
  const bad = input.find((r) => r.selection === 'none' && r.minutes !== null);
  if (bad) return { error: 'Not saved: minutes were entered for an athlete not marked as selected. Mark them started, came on or selected, or clear the minutes.', saved: 0, removed: 0 };
  const badMinutes = input.find((r) => r.minutes !== null && (!Number.isInteger(r.minutes) || r.minutes < 0 || r.minutes > 120));
  if (badMinutes) return { error: 'Not saved: minutes are a whole number from 0 to 120.', saved: 0, removed: 0 };

  const selected = input.filter((r) => r.selection !== 'none');
  const { data: existing, error: readErr } = await db.from('match_participation').select('athlete_id').eq('org_id', orgId).eq('fixture_id', fixtureId);
  if (readErr) return { error: readErr.message, saved: 0, removed: 0 };
  const keep = new Set(selected.map((r) => r.athleteId));
  const toRemove = (existing ?? []).map((r) => r.athlete_id).filter((id) => !keep.has(id));

  if (selected.length > 0) {
    const { error } = await db.from('match_participation').upsert(
      selected.map((r) => ({
        org_id: orgId,
        fixture_id: fixtureId,
        athlete_id: r.athleteId,
        started: r.selection === 'started',
        came_on: r.selection === 'came_on',
        minutes: r.minutes,
        recorded_by: userId,
      })),
      { onConflict: 'fixture_id,athlete_id' },
    );
    if (error) return { error: /42501|row-level security/i.test(error.message) ? 'Not saved: the post-match sheet is the coach’s and the sport scientist’s to write.' : error.message, saved: 0, removed: 0 };
  }
  if (toRemove.length > 0) {
    const r = await mustAffect(db.from('match_participation').delete().eq('org_id', orgId).eq('fixture_id', fixtureId).in('athlete_id', toRemove).select('id'), {
      refusal: 'Not saved: the rows to remove could not be removed.',
    });
    if (r.error) return { error: r.error, saved: selected.length, removed: 0 };
  }
  return { error: null, saved: selected.length, removed: toRemove.length };
}

/** Match sessions with no fixture — the orphans an attach action can link. */
export async function fetchUnlinkedMatchSessions(db: Db, orgId: string): Promise<{ id: string; title: string; starts_at: string }[]> {
  const { data, error } = await db
    .from('sessions')
    .select('id, title, starts_at')
    .eq('org_id', orgId)
    .eq('session_type', 'match')
    .is('fixture_id', null)
    .is('deleted_at', null)
    .order('starts_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Fixtures within a week either side of an instant — what an orphan match
 *  session may be attached to. */
export async function fetchFixturesNear(db: Db, orgId: string, instant: string): Promise<{ id: string; opponent: string; kickoff_at: string }[]> {
  const t = new Date(instant).getTime();
  const from = new Date(t - 7 * 86_400_000).toISOString();
  const to = new Date(t + 7 * 86_400_000).toISOString();
  const { data, error } = await db.from('fixtures').select('id, opponent, kickoff_at').eq('org_id', orgId).is('deleted_at', null).gte('kickoff_at', from).lte('kickoff_at', to).order('kickoff_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Attach an existing match session to a fixture (the orphan's answer —
 *  an attach action, never a backfill). Audited by 0104's sessions trigger. */
export async function attachSessionToFixture(db: Db, orgId: string, fixtureId: string, sessionId: string): Promise<{ error: string | null }> {
  return mustAffect(
    db.from('sessions').update({ fixture_id: fixtureId }).eq('org_id', orgId).eq('id', sessionId).eq('session_type', 'match').is('fixture_id', null).is('deleted_at', null).select('id'),
    { refusal: 'Not attached: that session is not an unlinked match session of this club, or attaching sessions belongs to the coach and the sport scientist.' },
  );
}
