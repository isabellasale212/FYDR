import type {
  AthleteStatus,
  AvailabilityStatus,
  DominantSide,
} from '@/lib/types/database';
import {
  fetchCurrentAvailability,
  fetchOpenInjuries,
  type OpenInjury,
  type CurrentAvailability,
} from './availability';
import { fetchGroupAthleteIds, fetchMembershipsByAthlete, type Db } from './groups';
import { fetchAllPaged } from './paged';
import { mustAffect } from '@/lib/write';

export type SquadRow = {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  squad_number: number | null;
  status: AthleteStatus;
  availability: AvailabilityStatus | 'unknown';
  restrictions: string[];
  group_ids: string[];
};

/** Morning wellness submissions per athlete over a trailing window, plus the
 *  most recent one on record.
 *
 *  COUNTS ENTRIES, NOT SCORES. "5 of 7" is how many mornings they filled the
 *  form in, which is a different question from how they felt — the picker's own
 *  footer says so, because a bar that could be read as a readiness score would
 *  be actively misleading next to an availability pill.
 *
 *  Reads wellness_entries_current, never the base table: a corrected entry
 *  writes a new revision and supersedes the old one (CLAUDE.md rule 6), so the
 *  base table would count one morning twice. Paged for the same reason every
 *  other submission read here is — one row per athlete per day, which a squad
 *  over a season pushes past PostgREST's ceiling, and a short page would
 *  silently understate submissions rather than error.
 *
 *  `lastEntry` is deliberately all-time BACKWARDS, not bounded by the window:
 *  an athlete who last submitted three weeks ago should show that date rather
 *  than a dash that reads the same as "never".
 *
 *  BOUNDED AT BOTH ENDS, THOUGH, AND THAT IS NOT PEDANTRY. A trailing window
 *  written as `entry_date >= from` alone counts anything dated after `from`,
 *  including dates in the future — and this org's own data has wellness rows
 *  dated 2033, which made one athlete read "2 of 7" while his real last entry
 *  was three weeks ago. formatDate prints no year, so "2033-07-29" rendered as
 *  "Fri 29 Jul" and looked entirely plausible. An entry dated after today has
 *  not happened yet, so it counts towards neither figure. */
export async function fetchWellnessRecency(
  db: Db,
  athleteIds: readonly string[],
  fromDate: string,
  toDate: string,
): Promise<Map<string, { last7: number; lastEntry: string | null }>> {
  const out = new Map<string, { last7: number; lastEntry: string | null }>();
  if (athleteIds.length === 0) return out;

  const rows = await fetchAllPaged<{ athlete_id: string | null; entry_date: string | null }>(
    (pageFrom, pageTo) =>
      db
        .from('wellness_entries_current')
        .select('athlete_id, entry_date')
        .in('athlete_id', [...athleteIds])
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
  );

  for (const r of rows) {
    if (!r.athlete_id || !r.entry_date) continue;
    // Not yet happened: neither a submission in the window nor a "last report".
    if (r.entry_date > toDate) continue;
    const cur = out.get(r.athlete_id) ?? { last7: 0, lastEntry: null };
    if (r.entry_date >= fromDate) cur.last7 += 1;
    if (cur.lastEntry === null || r.entry_date > cur.lastEntry) cur.lastEntry = r.entry_date;
    out.set(r.athlete_id, cur);
  }
  return out;
}

export async function fetchSquadList(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<SquadRow[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db
    .from('athletes')
    .select('id, first_name, last_name, position, squad_number, status')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');

  if (scope) athleteQuery = athleteQuery.in('id', scope);

  const [athletes, availability, memberships] = await Promise.all([
    athleteQuery.order('squad_number', { nullsFirst: false }),
    fetchCurrentAvailability(db, orgId, scope),
    fetchMembershipsByAthlete(db, orgId),
  ]);

  if (athletes.error) throw new Error(athletes.error.message);

  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));

  return (athletes.data ?? []).map((a) => {
    const current = availByAthlete.get(a.id);
    return {
      id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      position: a.position,
      squad_number: a.squad_number,
      status: a.status,
      availability: current?.status ?? 'unknown',
      restrictions: current?.restrictions ?? [],
      group_ids: memberships.get(a.id) ?? [],
    };
  });
}

export type AthleteProfile = {
  id: string;
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  position: string | null;
  squad_number: number | null;
  date_of_birth: string | null;
  height_cm: number | null;
  dominant_side: DominantSide | null;
  status: AthleteStatus;
  joined_at: string | null;
  team_name: string | null;
  group_names: string[];
  availability: CurrentAvailability | null;
  open_injuries: OpenInjury[];
};

/* Coach-side edit for the four bio cells at the top of the athlete profile
 * (position, squad number, height, dominant side) — everything in
 * pp-detail-row except Age (computed from date_of_birth, not a field) and
 * Weight (its own logged-history flow, BodyWeightPanel). Backed by a real,
 * already-shipped policy: athletes_manage_update (migration 0012) grants
 * exactly coach and admin an update on this row — medical is deliberately
 * absent ("medical reads for context and does not edit the roster," same
 * migration's own comment), and admin never reaches this page at all
 * (AthletePage's hasAccess check above is coach/medical only). So in
 * practice this is coach-only, enforced twice: the UI hides/disables the
 * control for anyone else (CLAUDE.md rule 2 — a display choice, not the
 * boundary), and RLS rejects the write regardless of what a client sends.
 * No new migration, no new policy — this just wires up a write path the
 * schema already allows and the profile page never offered. */
export async function updateAthleteBio(
  db: Db,
  orgId: string,
  athleteId: string,
  input: {
    position: string | null;
    squadNumber: number | null;
    heightCm: number | null;
    dominantSide: DominantSide | null;
  },
): Promise<{ error: string | null }> {
  /* G-36. athletes UPDATE is the coach, the medic and the sport scientist
     (0071). The screen gates on ATHLETE_BIO_EDIT, so this is the second lock
     and the one that speaks up when the two disagree. */
  return mustAffect(
    db
      .from('athletes')
      .update({
        position: input.position,
        squad_number: input.squadNumber,
        height_cm: input.heightCm,
        dominant_side: input.dominantSide,
      })
      .eq('org_id', orgId)
      .eq('id', athleteId)
      .select('id'),
    { refusal: 'Not saved: editing an athlete\u2019s details belongs to the coach, the medic and the sport scientist.' },
  );
}

export async function fetchAthlete(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<AthleteProfile | null> {
  const { data, error } = await db
    .from('athletes')
    .select(
      'id, first_name, last_name, preferred_name, position, squad_number, date_of_birth, height_cm, dominant_side, status, joined_at, default_team_id',
    )
    .eq('org_id', orgId)
    .eq('id', athleteId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const [teams, groups, memberships, availability, injuries] = await Promise.all([
    db
      .from('teams')
      .select('id, name')
      .eq('org_id', orgId)
      .is('deleted_at', null),
    db
      .from('groups')
      .select('id, name')
      .eq('org_id', orgId)
      .is('deleted_at', null),
    fetchMembershipsByAthlete(db, orgId),
    fetchCurrentAvailability(db, orgId, [athleteId]),
    fetchOpenInjuries(db, orgId, [athleteId]),
  ]);

  const teamName =
    (data.default_team_id
      ? (teams.data ?? []).find((t) => t.id === data.default_team_id)?.name
      : undefined) ?? null;

  const groupNameById = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const groupNames = (memberships.get(athleteId) ?? [])
    .map((id) => groupNameById.get(id))
    .filter((n): n is string => Boolean(n));

  return {
    id: data.id,
    first_name: data.first_name,
    last_name: data.last_name,
    preferred_name: data.preferred_name,
    position: data.position,
    squad_number: data.squad_number,
    date_of_birth: data.date_of_birth,
    height_cm: data.height_cm,
    dominant_side: data.dominant_side,
    status: data.status,
    joined_at: data.joined_at,
    team_name: teamName,
    group_names: groupNames,
    availability: availability[0] ?? null,
    open_injuries: injuries,
  };
}

/* ---------------------------------------------------------------------------
 * Screen 63, Add athlete. The first and only place this app creates an athlete.
 * ------------------------------------------------------------------------- */

export type NewAthleteInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  position: string | null;
  squadNumber: number | null;
};

export type SquadNumberHolder = { squad_number: number; name: string };

/** The live squad numbers and who holds them.
 *
 *  Read for the form so a clash can be named as it is typed, which is what the
 *  spec asks for: "refused with a sentence naming the athlete who already holds
 *  it". A count would satisfy the constraint; only a name satisfies the person
 *  standing there wondering which number to use instead.
 *
 *  Not sensitive: the squad list already shows every name and number to every
 *  staff role, so this hands the form nothing the reader cannot already see. */
export async function fetchSquadNumbersInUse(db: Db, orgId: string): Promise<SquadNumberHolder[]> {
  const { data, error } = await db
    .from('athletes')
    .select('squad_number, first_name, last_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .not('squad_number', 'is', null)
    .order('squad_number');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    squad_number: r.squad_number as number,
    name: `${r.first_name} ${r.last_name}`,
  }));
}

export type CreateAthleteResult =
  | { ok: true; athleteId: string }
  | { ok: false; error: string };

/** Create the athlete record.
 *
 *  `.select('id')` and a row-count check, per lib/write.ts: athletes_manage_insert
 *  is a WITH CHECK, so a refused INSERT does raise rather than pass silently --
 *  but the id is needed anyway to link an invite, and asking for it means the
 *  "no rows" case is handled rather than assumed.
 *
 *  23505 is the squad number, and it is reported as the business rule it is
 *  rather than as a permission problem. That distinction has bitten this project
 *  repeatedly in the other direction: 42501 means the policy refused the PERSON,
 *  23505 means a rule refused the ROW, and a message that confuses them sends
 *  somebody to ask for access they already have. */
export async function createAthlete(
  db: Db,
  orgId: string,
  input: NewAthleteInput,
): Promise<CreateAthleteResult> {
  const { data, error } = await db
    .from('athletes')
    .insert({
      org_id: orgId,
      first_name: input.firstName,
      last_name: input.lastName,
      date_of_birth: input.dateOfBirth,
      position: input.position,
      squad_number: input.squadNumber,
      status: 'active',
    })
    .select('id');

  if (error) {
    if (/athletes_org_squad_number_live|duplicate key/i.test(error.message)) {
      return {
        ok: false,
        error: `Squad number ${input.squadNumber} is already taken. Choose another, or free it up on the athlete who holds it.`,
      };
    }
    if (/athletes_dob_plausible/.test(error.message)) {
      return { ok: false, error: 'Check the date of birth: it must be in the past and within the last 80 years.' };
    }
    if (/row-level security|42501/i.test(error.message)) {
      return { ok: false, error: 'Not saved: adding an athlete belongs to the sport scientist.' };
    }
    return { ok: false, error: error.message };
  }

  const id = data?.[0]?.id;
  if (!id) return { ok: false, error: 'Not saved: adding an athlete belongs to the sport scientist.' };
  return { ok: true, athleteId: id };
}
