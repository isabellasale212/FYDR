import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GroupRow } from '@/lib/types/database';

export type Db = SupabaseClient<Database>;

export type Group = Pick<GroupRow, 'id' | 'name' | 'group_type' | 'sort_order'>;

/** One canonical group ordering for the whole app: type section first
 *  (positional, training, rehab, age, custom — the same sectioning the
 *  Groups settings page renders), then sort_order, then name.
 *
 *  This used to exist only inside fetchGroupsWithCounts, while fetchGroups
 *  ordered by raw sort_order alone — but sort_order is scoped per group_type
 *  (see createGroup below), so ordering by it across types interleaves
 *  sections in whatever tie-break the database happens to pick. The audit
 *  caught the symptom (coach finding 17): /schedule, the one filter-bar
 *  consumer of fetchGroupsWithCounts, showed its chips as "…Rehab, Academy"
 *  while every fetchGroups page showed "…Academy, Rehab". Both fetchers now
 *  sort through this comparator, so the chip row reads identically on every
 *  screen. */
const GROUP_TYPE_ORDER: Record<string, number> = {
  positional: 0,
  training: 1,
  rehab: 2,
  age: 3,
  custom: 4,
};

function compareGroups(a: Pick<GroupRow, 'name' | 'group_type' | 'sort_order'>, b: Pick<GroupRow, 'name' | 'group_type' | 'sort_order'>): number {
  return (
    (GROUP_TYPE_ORDER[a.group_type] ?? 99) - (GROUP_TYPE_ORDER[b.group_type] ?? 99) ||
    a.sort_order - b.sort_order ||
    a.name.localeCompare(b.name)
  );
}

export async function fetchGroups(db: Db, orgId: string): Promise<Group[]> {
  const { data, error } = await db
    .from('groups')
    .select('id, name, group_type, sort_order')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
  return (data ?? []).sort(compareGroups);
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
    .sort(compareGroups);
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
  // groups.sort_order defaults to 0 at the table level (migration 0009),
  // and this insert used to leave it at that default for every new group —
  // meaning the second group ever created of a given type collided with
  // the first at sort_order 0. Harmless for display (fetchGroupsWithCounts
  // ties on name), but a real bug for moveGroup() (GroupReorderButtons):
  // swapping two identical sort_order values changes nothing, so the
  // reorder buttons would silently do nothing for exactly the groups most
  // likely to need reordering — two just created in the same section.
  // Computed here rather than left to a DB default or trigger because
  // sort_order's own scope (per org *and* group_type, matching how the
  // Groups list page and moveGroup both already section by type) isn't
  // expressible as a single-column default.
  const { data: siblings, error: siblingsError } = await db
    .from('groups')
    .select('sort_order')
    .eq('org_id', input.orgId)
    .eq('group_type', input.groupType as Group['group_type'])
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (siblingsError) return { error: siblingsError.message };
  const nextSortOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { error } = await db.from('groups').insert({
    org_id: input.orgId,
    name: input.name.trim(),
    description: input.description,
    colour: input.colour,
    group_type: input.groupType as Group['group_type'],
    sort_order: nextSortOrder,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: `A group called "${input.name.trim()}" already exists.` };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** screens/groups.md's role table: "Create, rename, recolour, reorder,
 *  archive groups" — this is the rename/recolour/redescribe operation the
 *  doc names explicitly ("Rename, recolour, redescribe | `update groups
 *  set ...`") that this codebase had a create form and an archive button
 *  for, but no edit path at all until now. group_type is deliberately not
 *  editable here: the doc's own list of writable fields is name, colour
 *  and description, not type — a group's positional/rehab/age/custom
 *  category is closer to an identity than an attribute the same "Edit"
 *  flow should casually reassign. */
export async function updateGroup(
  db: Db,
  id: string,
  orgId: string,
  input: { name: string; description: string | null; colour: string | null },
): Promise<{ error: string | null }> {
  const { error } = await db
    .from('groups')
    .update({
      name: input.name.trim(),
      description: input.description,
      colour: input.colour,
    })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) {
    if (error.code === '23505') {
      return { error: `A group called "${input.name.trim()}" already exists.` };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** screens/groups.md's role table names "reorder" among the four writable
 *  operations, and GroupsPage's own header comment already narrows the cut
 *  precisely: "no drag reorder" — not "no reorder". A step control moving
 *  one group at a time is real reorder, just not the drag interaction that
 *  comment specifically excludes (which would mean a real drag-and-drop
 *  dependency, per CLAUDE.md §4's "don't add a dependency without stating
 *  what it does" — this needs none).
 *
 *  Ordering is scoped to the group's own group_type, matching exactly what
 *  the Groups list page already renders as one section per type
 *  (fetchGroupsWithCounts's own GROUP_TYPE_ORDER) — "move up" inside
 *  Positional groups has no meaning against a Rehab group sitting in a
 *  different section entirely. Swaps sort_order with the immediate
 *  neighbour in that type, computed from a fresh read each call rather
 *  than trusting a client-held index, so two staff reordering the same
 *  section at once can't desync it. */
export async function moveGroup(
  db: Db,
  orgId: string,
  groupId: string,
  direction: 'up' | 'down',
): Promise<{ error: string | null }> {
  const { data: target, error: targetError } = await db
    .from('groups')
    .select('id, group_type, sort_order')
    .eq('org_id', orgId)
    .eq('id', groupId)
    .maybeSingle();
  if (targetError) return { error: targetError.message };
  if (!target) return { error: 'That group no longer exists.' };

  const { data: siblings, error: siblingsError } = await db
    .from('groups')
    .select('id, sort_order, name')
    .eq('org_id', orgId)
    .eq('group_type', target.group_type)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (siblingsError) return { error: siblingsError.message };

  const ordered = siblings ?? [];
  const index = ordered.findIndex((g) => g.id === groupId);
  if (index === -1) return { error: 'That group no longer exists.' };

  const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
  const neighbour = ordered[neighbourIndex];
  if (!neighbour) return { error: null }; // already first/last — a no-op, not an error

  const [a, b] = await Promise.all([
    db.from('groups').update({ sort_order: neighbour.sort_order }).eq('id', target.id).eq('org_id', orgId),
    db.from('groups').update({ sort_order: target.sort_order }).eq('id', neighbour.id).eq('org_id', orgId),
  ]);

  if (a.error) return { error: a.error.message };
  if (b.error) return { error: b.error.message };
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
