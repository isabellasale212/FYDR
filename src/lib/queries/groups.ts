/* ═══ EVERY group_memberships AND athletes READ IN THIS FILE PAGES ═══════════
 *
 * PostgREST answers any request with at most `db-max-rows` rows, and this
 * project sets it explicitly (`max_rows = 1000` in supabase/config.toml).
 * Hitting that ceiling is SILENT: no error, no short page — exactly 1000 rows
 * that are indistinguishable from a complete answer. So every read here whose
 * result set is unbounded by construction goes through fetchAllPaged
 * (./paged.ts), which loops until a page comes back short.
 *
 * ── Count ROWS. Never a proxy for rows ────────────────────────────────────
 *
 * `analytics.ts` used to carry a header saying its presets "do not need" to
 * page because "they pull 28 and 56 days". That sentence is the reason a real
 * truncation bug survived review: the ceiling counts ROWS, and days are not
 * rows — 28 days × 40 athletes is 1,120 of them. Do not re-derive the same
 * mistake in this file's units. "A club only has a handful of groups" and "a
 * squad is only 40 people" are the same error wearing different clothes.
 *
 * The real row counts here, because `group_memberships` is one row per
 * athlete per group AND is history-preserving — removeGroupMember sets
 * removed_at and the row is never deleted (04-data-model.md §3), so a row is
 * created and never destroyed:
 *
 *   fetchMembershipsByAthlete   whole org, live rows: athletes × groups each.
 *                               200 athletes × 4 groups = 800 and climbing.
 *   fetchGroupsWithCounts       same org-wide live shape. Truncation here
 *                               silently UNDERCOUNTS the member badge.
 *   fetchAthletesInNoGroup      same org-wide live shape — and truncation
 *                               INVENTS members-of-no-group out of athletes
 *                               whose membership row fell off the page.
 *   fetchGroupAthleteIds        live rows in the SELECTED groups only, so the
 *                               smallest of these — but it backs the global
 *                               group filter (CLAUDE.md §3, which makes that
 *                               filter mandatory on every multi-athlete
 *                               screen), so a short read quietly shrinks the
 *                               filter's scope and omits athletes from every
 *                               such screen at once.
 *   fetchGroupMembers           ONE group, but deliberately reads removed
 *                               rows too (it renders a past-members list), so
 *                               it accumulates across every season the group
 *                               has existed. Bounded by history, not by size.
 *
 * The `athletes` read in fetchAthletesInNoGroup pages for the same reason: one
 * row per athlete in the org, with no bound but the club's own size.
 *
 * ── What deliberately does NOT page, and the row argument for it ──────────
 *
 * The `groups` table reads (fetchGroups, fetchGroupsWithCounts' first query,
 * fetchGroupDetail, and the sibling lookups in createGroup/moveGroup). One row
 * per group, and a group is created by hand by a coach and named in a UI list
 * they have to scroll: a real club runs tens, and 1000 hand-made groups is not
 * a scale this product has. That is an argument about the number of ROWS the
 * table can hold, which is the only kind that counts. If groups ever become
 * machine-generated, this reasoning expires and they must page too.
 * createGroup's and moveGroup's sibling reads are additionally narrowed to one
 * group_type and, for createGroup, `.limit(1)`.
 *
 * ═══ EVERY PAGED QUERY ENDS IN `.order('id')`. NOT A STYLE POINT ═════════
 *
 * PostgREST turns `.range(from, to)` into LIMIT/OFFSET, and each page is a
 * SEPARATE execution of the query. Postgres promises no stable order among
 * rows that tie under ORDER BY and may pick a different plan for OFFSET 0 than
 * for OFFSET 1000, so a tied row can come back on BOTH sides of a page
 * boundary or on NEITHER. Ties are the normal case here, not an edge case:
 * every membership added in one bulk assignment shares an `added_at`. `id` is
 * group_memberships' and athletes' primary key (migration 0002) and so breaks
 * every remaining tie. Sort columns need not appear in the select list.
 * ------------------------------------------------------------------------ */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GroupRow } from '@/lib/types/database';
import { humanizeDbError } from '@/lib/writeErrors';
import { fetchAllPaged, type PagedResponse } from './paged';
import { mustAffect, mustAffectOrThrow } from '@/lib/write';

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

  /* Paged: bounded only by how many athletes sit in the selected groups, and
   * a short read here silently narrows the global group filter on every
   * multi-athlete screen at once. `id` is the total order. */
  type Row = { athlete_id: string };
  const data = await fetchAllPaged<Row>((from, to) =>
    db
      .from('group_memberships')
      .select('athlete_id')
      .eq('org_id', orgId)
      .in('group_id', [...groupIds])
      .is('removed_at', null)
      .order('id')
      .range(from, to) as unknown as PagedResponse<Row>,
  );

  return [...new Set(data.map((r) => r.athlete_id))];
}

export async function fetchMembershipsByAthlete(
  db: Db,
  orgId: string,
): Promise<Map<string, string[]>> {
  /* Paged: unfiltered across the whole org — athletes × groups-per-athlete.
   * The caller collapses these into a Map, so read order does not matter to
   * it; `id` is here to make the pages a partition rather than to sort. */
  type Row = { athlete_id: string; group_id: string };
  const data = await fetchAllPaged<Row>((from, to) =>
    db
      .from('group_memberships')
      .select('athlete_id, group_id')
      .eq('org_id', orgId)
      .is('removed_at', null)
      .order('id')
      .range(from, to) as unknown as PagedResponse<Row>,
  );

  const byAthlete = new Map<string, string[]>();
  for (const row of data) {
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
/* Only `name` is load-bearing: it is what groups.colour stores, and
 * GroupSwatch resolves it to the --group-* token pair in tokens.css so a
 * component never paints a raw hex. The light/dark hexes here were a
 * duplicate of those tokens that nothing read — confirmed unused — and had
 * already gone stale against the brightened light palette. Dropped rather
 * than re-synced, so there is one place to change a group colour. */
export const GROUP_COLOURS = [
  { name: 'Blue' },
  { name: 'Green' },
  { name: 'Purple' },
  { name: 'Slate' },
  { name: 'Indigo' },
  { name: 'Cyan' },
  { name: 'Olive' },
  { name: 'Magenta' },
  { name: 'Steel' },
  { name: 'Plum' },
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

  /* Paged: org-wide live memberships, same unbounded shape as
   * fetchMembershipsByAthlete. A truncated read would not fail, it would just
   * quietly report a group as having fewer members than it has. */
  type MembershipRow = { group_id: string; athlete_id: string; athletes: unknown };
  const memberships = await fetchAllPaged<MembershipRow>((from, to) =>
    db
      .from('group_memberships')
      .select('group_id, athlete_id, athletes!inner(status, deleted_at)')
      .eq('org_id', orgId)
      .is('removed_at', null)
      .is('athletes.deleted_at', null)
      .neq('athletes.status', 'left_club')
      .order('id')
      .range(from, to) as unknown as PagedResponse<MembershipRow>,
  );

  const counts = new Map<string, number>();
  for (const m of memberships) {
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
  /* Both sides page. This function is a set difference, so truncation on
   * EITHER side is worse than a short list: a missing membership row promotes
   * an athlete who is in a group into the "in no group" list, and staff act on
   * that by assigning them again. */
  type AthleteRow = { id: string; first_name: string; last_name: string };
  type MembershipRow = { athlete_id: string };

  const [athletes, memberships] = await Promise.all([
    fetchAllPaged<AthleteRow>((from, to) =>
      db
        .from('athletes')
        .select('id, first_name, last_name')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .neq('status', 'left_club')
        .order('id')
        .range(from, to) as unknown as PagedResponse<AthleteRow>,
    ),
    fetchAllPaged<MembershipRow>((from, to) =>
      db
        .from('group_memberships')
        .select('athlete_id')
        .eq('org_id', orgId)
        .is('removed_at', null)
        .order('id')
        .range(from, to) as unknown as PagedResponse<MembershipRow>,
    ),
  ]);

  const grouped = new Set(memberships.map((m) => m.athlete_id));
  return athletes
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
  if (siblingsError) return { error: humanizeDbError(siblingsError.message, 'staff') };
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
    /* Raw driver strings never leave this file — audit S5. */
    return { error: humanizeDbError(error.message, 'staff') };
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
  const { data, error } = await db
    .from('groups')
    .update({
      name: input.name.trim(),
      description: input.description,
      colour: input.colour,
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id');

  if (error) {
    if (error.code === '23505') {
      return { error: `A group called "${input.name.trim()}" already exists.` };
    }
    return { error: humanizeDbError(error.message, 'staff') };
  }
  /* G-36. The 23505 branch above stays: a duplicate name is a business rule
     refusing the ROW, not a policy refusing the PERSON, and collapsing the two
     into one message would lose the only one a user can act on. This checks the
     other case, where nothing raised and nothing changed. */
  if (!data || data.length === 0) {
    return { error: 'Not saved: creating and changing squad groups belongs to the coach and the sport scientist.' };
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
  if (targetError) return { error: humanizeDbError(targetError.message, 'staff') };
  if (!target) return { error: 'That group no longer exists.' };

  const { data: siblings, error: siblingsError } = await db
    .from('groups')
    .select('id, sort_order, name')
    .eq('org_id', orgId)
    .eq('group_type', target.group_type)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (siblingsError) return { error: humanizeDbError(siblingsError.message, 'staff') };

  const ordered = siblings ?? [];
  const index = ordered.findIndex((g) => g.id === groupId);
  if (index === -1) return { error: 'That group no longer exists.' };

  const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
  const neighbour = ordered[neighbourIndex];
  if (!neighbour) return { error: null }; // already first/last — a no-op, not an error

  /* §0az (decided 2026-09-12). These two UPDATEs used to run in parallel and
     check `.error` only: for a role outside groups_staff_update (0078 — the
     medic, the S&C, the nutritionist) PostgREST filtered both to zero rows and
     returned no error, so the screen refreshed as if the swap had happened.
     Each is one row addressed by id that was on screen a moment ago, so zero
     rows can only mean refused; and they run in order so a refused first
     write never leaves the pair half-swapped. */
  const refusal = 'Not saved: reordering squad groups belongs to the coach and the sport scientist.';
  const onError = (message: string) => humanizeDbError(message, 'staff');
  const a = await mustAffect(
    db.from('groups').update({ sort_order: neighbour.sort_order }).eq('id', target.id).eq('org_id', orgId).select('id'),
    { refusal, onError },
  );
  if (a.error) return a;
  return mustAffect(
    db.from('groups').update({ sort_order: target.sort_order }).eq('id', neighbour.id).eq('org_id', orgId).select('id'),
    { refusal, onError },
  );
}

export async function archiveGroup(db: Db, id: string, orgId: string): Promise<void> {
  /* G-36. This function throws rather than returning, so it takes the throwing
     form of the same rule. */
  await mustAffectOrThrow(
    db.from('groups').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('org_id', orgId).select('id'),
    'Not saved: creating and changing squad groups belongs to the coach and the sport scientist.',
  );
}

export async function restoreGroup(db: Db, id: string, orgId: string): Promise<void> {
  /* G-36. This function throws rather than returning, so it takes the throwing
     form of the same rule. */
  await mustAffectOrThrow(
    db.from('groups').update({ deleted_at: null }).eq('id', id).eq('org_id', orgId).select('id'),
    'Not saved: creating and changing squad groups belongs to the coach and the sport scientist.',
  );
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
  /* Paged: this is the one read that deliberately does NOT filter removed_at
   * — it splits current from past members below — so it accumulates every
   * membership the group has ever had, across every season. Truncation would
   * drop the oldest entries off the past-members list without saying so.
   *
   * added_at leads because it is the intent of the sort; `id` (migration
   * 0002's primary key) is what makes it a TOTAL order, and it is doing real
   * work here — a bulk assignment writes one added_at across the whole group,
   * so ties are the common case, not a corner. Both arrays are re-sorted in
   * memory below, so the server order only has to partition the pages. */
  type Row = {
    athlete_id: string;
    added_at: string;
    removed_at: string | null;
    athletes: {
      first_name: string;
      last_name: string;
      squad_number: number | null;
      position: string | null;
      deleted_at: string | null;
    } | null;
  };

  const data = await fetchAllPaged<Row>((from, to) =>
    db
      .from('group_memberships')
      .select(
        'athlete_id, added_at, removed_at, athletes!inner(first_name, last_name, squad_number, position, deleted_at)',
      )
      .eq('org_id', orgId)
      .eq('group_id', groupId)
      .is('athletes.deleted_at', null)
      .order('added_at', { ascending: false })
      .order('id')
      .range(from, to) as unknown as PagedResponse<Row>,
  );

  const current: MemberRow[] = [];
  const past: PastMemberRow[] = [];

  for (const row of data) {
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
