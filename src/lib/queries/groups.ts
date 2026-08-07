import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GroupRow } from '@/lib/types/database';

export type Db = SupabaseClient<Database>;

export type Group = Pick<GroupRow, 'id' | 'name' | 'group_type' | 'sort_order'>;

export async function fetchGroups(db: Db, orgId: string): Promise<Group[]> {
  const { data, error } = await db
    .from('groups')
    .select('id, name, group_type, sort_order')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('sort_order');

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The athlete ids inside the active group filter.
 *
 * An empty `groupIds` means no filter, and returns null rather than an empty
 * array, because "every athlete" and "no athlete" must not be the same value.
 * CLAUDE.md §3: every multi-athlete screen respects this, and it is held in the
 * URL so a refresh keeps it.
 */
export async function fetchGroupAthleteIds(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<string[] | null> {
  if (groupIds.length === 0) return null;

  const { data, error } = await db
    .from('group_memberships')
    .select('athlete_id')
    .eq('org_id', orgId)
    .in('group_id', [...groupIds])
    .is('removed_at', null);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.athlete_id))];
}

export async function fetchMembershipsByAthlete(
  db: Db,
  orgId: string,
): Promise<Map<string, string[]>> {
  const { data, error } = await db
    .from('group_memberships')
    .select('athlete_id, group_id')
    .eq('org_id', orgId)
    .is('removed_at', null);

  if (error) throw new Error(error.message);

  const byAthlete = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = byAthlete.get(row.athlete_id) ?? [];
    list.push(row.group_id);
    byAthlete.set(row.athlete_id, list);
  }
  return byAthlete;
}

/* ---------------------------------------------------------------------------
 * The Groups screen. screens/groups.md, simplified for this pass: no
 * membership timeline chart, no as-at date time travel, no merge, no drag
 * reorder, no rehab-only write restriction (O-249 is unresolved in the spec
 * itself — "I have assumed" — and RLS already permits coach, medical and
 * admin equally, so this does not add a UI restriction the spec has not
 * actually settled). The two things the spec treats as non-negotiable are
 * built exactly as specified: removal sets removed_at and the row is never
 * deleted, and adding an existing member is a no-op, not an error, backed by
 * the migration 0014 partial unique index.
 * ------------------------------------------------------------------------ */

/** The ten palette colours that clear screens/groups.md's contrast rule in
 * both themes. Slots 2 (Amber) and 10 (Brown) are excluded: the spec's own
 * measurements show both failing 3:1 against --warn and --highlight in dark
 * theme (O-247, unresolved), and a colour picker should not knowingly offer
 * a colour the same document says fails the rule it exists to enforce. */
export const GROUP_COLOURS = [
  { name: 'Blue', light: '#1246C8', dark: '#5AA8FF' },
  { name: 'Green', light: '#007B3F', dark: '#22AB60' },
  { name: 'Purple', light: '#7A2FA8', dark: '#EE9FE6' },
  { name: 'Slate', light: '#41505E', dark: '#6E7F91' },
  { name: 'Indigo', light: '#3B3BAF', dark: '#8C8CF5' },
  { name: 'Cyan', light: '#0F6C87', dark: '#4FC3E8' },
  { name: 'Olive', light: '#5A6B12', dark: '#B4C64A' },
  { name: 'Magenta', light: '#96256E', dark: '#F08CC8' },
  { name: 'Steel', light: '#2F5A6B', dark: '#7FB4C8' },
  { name: 'Plum', light: '#5D2E6B', dark: '#C08FD2' },
] as const;

export type GroupWithCount = Group & {
  description: string | null;
  colour: string | null;
  member_count: number;
  archived: boolean;
};

const GROUP_TYPE_ORDER: Record<string, number> = {
  positional: 0,
  training: 1,
  rehab: 2,
  age: 3,
  custom: 4,
};

export async function fetchGroupsWithCounts(
  db: Db,
  orgId: string,
  includeArchived = false,
): Promise<GroupWithCount[]> {
  let query = db
    .from('groups')
    .select('id, name, description, colour, group_type, sort_order, deleted_at')
    .eq('org_id', orgId);

  if (!includeArchived) query = query.is('deleted_at', null);

  const { data: groups, error } = await query;
  if (error) throw new Error(error.message);
  if (!groups || groups.length === 0) return [];

  const { data: memberships, error: memError } = await db
    .from('group_memberships')
    .select('group_id, athlete_id, athletes!inner(status, deleted_at)')
    .eq('org_id', orgId)
    .is('removed_at', null)
    .is('athletes.deleted_at', null)
    .neq('athletes.status', 'left_club');

  if (memError) throw new Error(memError.message);

  const counts = new Map<string, number>();
  for (const m of memberships ?? []) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }

  return groups
    .map((g) => ({
      id: g.id,
      name: g.name,
      group_type: g.group_type,
      sort_order: g.sort_order,
      description: g.description,
      colour: g.colour,
      member_count: counts.get(g.id) ?? 0,
      archived: g.deleted_at !== null,
    }))
    .sort(
      (a, b) =>
        (GROUP_TYPE_ORDER[a.group_type] ?? 99) - (GROUP_TYPE_ORDER[b.group_type] ?? 99) ||
        a.sort_order - b.sort_order ||
        a.name.localeCompare(b.name),
    );
}

export async function fetchAthletesInNoGroup(
  db: Db,
  orgId: string,
): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const [athletes, memberships] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club'),
    db.from('group_memberships').select('athlete_id').eq('org_id', orgId).is('removed_at', null),
  ]);

  if (athletes.error) throw new Error(athletes.error.message);
  if (memberships.error) throw new Error(memberships.error.message);

  const grouped = new Set((memberships.data ?? []).map((m) => m.athlete_id));
  return (athletes.data ?? [])
    .filter((a) => !grouped.has(a.id))
    .sort((a, b) => a.last_name.localeCompare(b.last_name));
}

export async function createGroup(
  db: Db,
  input: {
    orgId: string;
    name: string;
    description: string | null;
    colour: string | null;
    groupType: string;
  },
): Promise<{ error: string | null }> {
  const { error } = await db.from('groups').insert({
    org_id: input.orgId,
    name: input.name.trim(),
    description: input.description,
    colour: input.colour,
    group_type: input.groupType as Group['group_type'],
  });

  if (error) {
    if (error.code === '23505') {
      return { error: `A group called "${input.name.trim()}" already exists.` };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function archiveGroup(db: Db, id: string, orgId: string): Promise<void> {
  const { error } = await db
    .from('groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
}

export async function restoreGroup(db: Db, id: string, orgId: string): Promise<void> {
  const { error } = await db
    .from('groups')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);
}

export type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  colour: string | null;
  group_type: string;
  archived: boolean;
};

export type MemberRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
  position: string | null;
  added_at: string;
};

export type PastMemberRow = MemberRow & { removed_at: string };

export async function fetchGroupDetail(
  db: Db,
  orgId: string,
  groupId: string,
): Promise<GroupDetail | null> {
  const { data, error } = await db
    .from('groups')
    .select('id, name, description, colour, group_type, deleted_at')
    .eq('org_id', orgId)
    .eq('id', groupId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    colour: data.colour,
    group_type: data.group_type,
    archived: data.deleted_at !== null,
  };
}

export async function fetchGroupMembers(
  db: Db,
  orgId: string,
  groupId: string,
): Promise<{ current: MemberRow[]; past: PastMemberRow[] }> {
  const { data, error } = await db
    .from('group_memberships')
    .select(
      'athlete_id, added_at, removed_at, athletes!inner(first_name, last_name, squad_number, position, deleted_at)',
    )
    .eq('org_id', orgId)
    .eq('group_id', groupId)
    .is('athletes.deleted_at', null)
    .order('added_at', { ascending: false });

  if (error) throw new Error(error.message);

  const current: MemberRow[] = [];
  const past: PastMemberRow[] = [];

  for (const row of data ?? []) {
    const athlete = row.athletes;
    if (!athlete) continue;
    const base = {
      athlete_id: row.athlete_id,
      first_name: athlete.first_name,
      last_name: athlete.last_name,
      squad_number: athlete.squad_number,
      position: athlete.position,
      added_at: row.added_at,
    };
    if (row.removed_at === null) current.push(base);
    else past.push({ ...base, removed_at: row.removed_at });
  }

  current.sort((a, b) => a.last_name.localeCompare(b.last_name));
  past.sort((a, b) => b.removed_at.localeCompare(a.removed_at));

  return { current, past };
}

/** A no-op, reported as a skip, if the athlete already has a live membership
 *  — screens/groups.md's own validation rule, backed by the migration 0014
 *  partial unique index so a race lands the same way. */
export async function addGroupMember(
  db: Db,
  orgId: string,
  groupId: string,
  athleteId: string,
): Promise<{ skipped: boolean }> {
  const { error } = await db.from('group_memberships').insert({
    org_id: orgId,
    group_id: groupId,
    athlete_id: athleteId,
  });

  if (error) {
    if (error.code === '23505') return { skipped: true };
    throw new Error(error.message);
  }
  return { skipped: false };
}

/** Sets removed_at. Never deletes the row — group_memberships is history-
 *  preserving by design (04-data-model.md §3), and the schema itself refuses
 *  a delete regardless (migration 0002's foreign keys aside, there is no
 *  delete grant and no delete policy on this table). */
export async function removeGroupMember(
  db: Db,
  orgId: string,
  groupId: string,
  athleteId: string,
): Promise<void> {
  const { error } = await db
    .from('group_memberships')
    .update({ removed_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('group_id', groupId)
    .eq('athlete_id', athleteId)
    .is('removed_at', null);

  if (error) throw new Error(error.message);
}
