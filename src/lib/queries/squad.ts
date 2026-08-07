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
