import type {
  AvailabilityReason,
  AvailabilityStatus,
  BodyArea,
  BodySide,
  InjuryStatus,
} from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';
import type { AvailabilityLedgerRow } from '@/lib/availabilityHistory';
import { restrictionLine } from '@/lib/restrictions';

/* Availability, as a coach may read it.
 *
 * Body area, availability, restrictions and expected return. Never a
 * diagnosis. injury_clinical is not selected from, not joined to, and is not
 * named in the Database type this client is built against, so it cannot be.
 * CONTRACT.md rule 3, ADR-007. */

export type CurrentAvailability = {
  /** Who set it and when — the read-only owner line (STAFF-SS-02-05 C5). */
  set_by: string | null;
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
  /** The recovery stage: open, rehab, return_to_play. Never 'closed' — the query
   *  filters those out, but the enum is not narrowed here because the column is
   *  the column and a narrower type would be a claim the database does not make. */
  status: InjuryStatus;
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
  /** The open injury's own id, when the current availability row is actually
   *  linked to one (same `injury?.id` this row's body_area/side/
   *  expected_return already come from) — never a diagnosis, just the
   *  primary key of a row already read from the coach-safe `injuries` table
   *  above. Lets a caller link through to the existing, correctly
   *  role-gated /injuries/[injuryId] page for "the rest of the record"
   *  instead of a screen re-deciding what's safe to show. */
  injury_id: string | null;
};

export async function fetchCurrentAvailability(
  db: Db,
  orgId: string,
  athleteIds: string[] | null,
): Promise<CurrentAvailability[]> {
  let q = db
    .from('availability')
    .select(
      'athlete_id, status, restrictions, reason_category, injury_id, effective_from, note, set_by',
    )
    .eq('org_id', orgId)
    .is('effective_to', null);

  if (athleteIds) q = q.in('athlete_id', athleteIds);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Every availability row for one athlete, oldest first — the ledger the
 *  history screen reads (PATTERN-S3 C7). No window: the record is the
 *  record. Paged, because a club three seasons deep with a busy medic
 *  writes more rows than one page holds; `id` breaks ties. Read through
 *  availability_staff_select, which every staff role has (0074). */
export async function fetchAvailabilityLedger(db: Db, orgId: string, athleteId: string): Promise<AvailabilityLedgerRow[]> {
  const rows = await fetchAllPaged<AvailabilityLedgerRow>((from, to) =>
    db
      .from('availability')
      .select('id, status, restrictions, reason_category, injury_id, effective_from, effective_to, set_by, note')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('effective_from', { ascending: true })
      .order('id')
      .range(from, to),
  );
  return rows;
}

export async function fetchOpenInjuries(
  db: Db,
  orgId: string,
  athleteIds: string[] | null,
): Promise<OpenInjury[]> {
  let q = db
    .from('injuries')
    /* `status` added 2026-09-08 for the athlete's availability banner: it is the
       injury's recovery stage (open / rehab / return_to_play) and without it the
       athlete is told they are restricted but never how far along they are. The
       staff surfaces already had it from their own query. */
    .select('id, athlete_id, body_area, side, onset_date, expected_return, status')
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
        restrictions: restrictionLine(current?.restrictions),
        reason_category: current?.reason_category ?? null,
        body_area: injury?.body_area ?? null,
        side: injury?.side ?? null,
        expected_return: injury?.expected_return ?? null,
        injury_id: injury?.id ?? null,
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
