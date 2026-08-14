import type {
  AvailabilityReason,
  AvailabilityStatus,
  BodyArea,
  BodySide,
} from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';

/* Availability, as a coach may read it.
 *
 * Body area, availability, restrictions and expected return. Never a
 * diagnosis. injury_clinical is not selected from, not joined to, and is not
 * named in the Database type this client is built against, so it cannot be.
 * CONTRACT.md rule 3, ADR-007. */

export type CurrentAvailability = {
  athlete_id: string;
  status: AvailabilityStatus;
  restrictions: string[] | null;
  reason_category: AvailabilityReason | null;
  injury_id: string | null;
  effective_from: string;
  note: string | null;
};

export type OpenInjury = {
  id: string;
  athlete_id: string;
  body_area: BodyArea;
  side: BodySide | null;
  onset_date: string;
  expected_return: string | null;
};

export type AvailabilityCounts = {
  available: number;
  modified: number;
  unavailable: number;
  unknown: number;
  total: number;
};

export type NotFullyAvailableRow = {
  athlete_id: string;
  name: string;
  position: string | null;
  squad_number: number | null;
  status: AvailabilityStatus | 'unknown';
  restrictions: string[];
  reason_category: AvailabilityReason | null;
  body_area: BodyArea | null;
  side: BodySide | null;
  expected_return: string | null;
};

export async function fetchCurrentAvailability(
  db: Db,
  orgId: string,
  athleteIds: string[] | null,
): Promise<CurrentAvailability[]> {
  let q = db
    .from('availability')
    .select(
      'athlete_id, status, restrictions, reason_category, injury_id, effective_from, note',
    )
    .eq('org_id', orgId)
    .is('effective_to', null);

  if (athleteIds) q = q.in('athlete_id', athleteIds);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOpenInjuries(
  db: Db,
  orgId: string,
  athleteIds: string[] | null,
): Promise<OpenInjury[]> {
  let q = db
    .from('injuries')
    .select('id, athlete_id, body_area, side, onset_date, expected_return')
    .eq('org_id', orgId)
    .neq('status', 'closed')
    .is('deleted_at', null);

  if (athleteIds) q = q.in('athlete_id', athleteIds);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

type ScopedAthlete = {
  id: string;
  first_name: string;
  last_name: string;
  position: string | null;
  squad_number: number | null;
};

async function fetchScopedAthletes(
  db: Db,
  orgId: string,
  athleteIds: string[] | null,
): Promise<ScopedAthlete[]> {
  let q = db
    .from('athletes')
    .select('id, first_name, last_name, position, squad_number')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');

  if (athleteIds) q = q.in('id', athleteIds);

  const { data, error } = await q.order('squad_number', { nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAvailabilityCounts(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<AvailabilityCounts> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const [athletes, availability] = await Promise.all([
    fetchScopedAthletes(db, orgId, scope),
    fetchCurrentAvailability(db, orgId, scope),
  ]);

  const byAthlete = new Map(availability.map((a) => [a.athlete_id, a]));
  const counts: AvailabilityCounts = {
    available: 0,
    modified: 0,
    unavailable: 0,
    unknown: 0,
    total: athletes.length,
  };

  for (const athlete of athletes) {
    const current = byAthlete.get(athlete.id);
    if (!current) counts.unknown += 1;
    else counts[current.status] += 1;
  }
  return counts;
}

/** Everyone who is not fully available, named, with the restriction and where
 *  they are in the return. Ordered unavailable first: that is the order the
 *  question is asked in. */
export async function fetchNotFullyAvailable(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<NotFullyAvailableRow[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const [athletes, availability, injuries] = await Promise.all([
    fetchScopedAthletes(db, orgId, scope),
    fetchCurrentAvailability(db, orgId, scope),
    fetchOpenInjuries(db, orgId, scope),
  ]);

  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a]));
  const injuryById = new Map(injuries.map((i) => [i.id, i]));

  const order: Record<string, number> = {
    unavailable: 0,
    modified: 1,
    unknown: 2,
  };

  return athletes
    .map((athlete): NotFullyAvailableRow | null => {
      const current = availByAthlete.get(athlete.id);
      const status = current?.status ?? 'unknown';
      if (status === 'available') return null;

      const injury = current?.injury_id
        ? injuryById.get(current.injury_id)
        : undefined;

      return {
        athlete_id: athlete.id,
        name: `${athlete.first_name} ${athlete.last_name}`,
        position: athlete.position,
        squad_number: athlete.squad_number,
        status,
        restrictions: current?.restrictions ?? [],
        reason_category: current?.reason_category ?? null,
        body_area: injury?.body_area ?? null,
        side: injury?.side ?? null,
        expected_return: injury?.expected_return ?? null,
      };
    })
    .filter((r): r is NotFullyAvailableRow => r !== null)
    .sort(
      (a, b) =>
        (order[a.status] ?? 3) - (order[b.status] ?? 3) ||
        a.name.localeCompare(b.name),
    );
}

export type AthleteAvailability = {
  current: CurrentAvailability | null;
  injury: OpenInjury | null;
};

export async function fetchAthleteAvailability(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<AthleteAvailability> {
  const [availability, injuries] = await Promise.all([
    fetchCurrentAvailability(db, orgId, [athleteId]),
    fetchOpenInjuries(db, orgId, [athleteId]),
  ]);

  const current = availability[0] ?? null;
  // Same fix as injuries.ts's fetchInjuryDetail (integration-audit majors,
  // Bug 3): an athlete can be unavailable for a non-injury reason (illness,
  // personal leave) while separately having an unrelated open injury on
  // record — falling back to `injuries[0]` in that case attached the wrong
  // injury's body_area/expected_return to an availability row it isn't
  // linked to. Null, not an arbitrary guess, when there's no real link.
  const injury = current?.injury_id
    ? (injuries.find((i) => i.id === current.injury_id) ?? null)
    : null;

  return { current, injury };
}
