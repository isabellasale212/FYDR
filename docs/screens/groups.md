# Screen: Groups

> **Layout status**: provisional. Awaiting client design photographs.

Screen 21 in the inventory (`02-information-architecture.md` §5). File: `docs/screens/groups.md`.

---

## Purpose

Create and manage the named subsets of the squad that the entire product filters by.

A group is a coach-defined subset: forwards, backs, academy, rehab group, S&C group A. An
athlete belongs to as many as apply. `CLAUDE.md` §3 makes the group filter a global rule on every
multi-athlete screen, which means this screen defines the vocabulary the whole application is
filtered by. Get the groups wrong and every other screen is filtered wrongly.

Three responsibilities beyond the obvious:

1. **Colour assignment.** A group's colour is used consistently everywhere it appears: chips on
   the squad list, session participant labels, chart series in analytics. It is assigned here,
   once.
2. **Membership over time.** `group_memberships` is history-preserving on purpose
   (`04-data-model.md` §3): "show me the forwards' load in March" must use March's membership,
   not today's. This screen is where that history is created, viewed, and corrected, and it must
   make the distinction between "not in the group now" and "never in the group" impossible to
   confuse.
3. **Removing an athlete sets `removed_at`. It never deletes the row.** Everything on this screen
   is built around that fact.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full read and write. Create, rename, recolour, reorder, archive groups. Add and remove members. |
| Medical / Physio | Full read and write, per the permission matrix (`01-roles-and-permissions.md` §2, "Manage groups": Y for coach, medical, and admin). In practice medical staff manage rehab groups (`rehab-groups.md`, screen 42), which are a medical-owned feature in their own right and **not** the drawing's "corner group allocation": that is team allocation, screen 14. |
| Admin / Club owner | Full read and write on groups and membership. An admin manages squad structure without seeing performance data, which is exactly the split described in `01-roles-and-permissions.md` §1. |
| Athlete | No access. An athlete does not see which groups they are in, and does not see group membership lists. Raised as O-244, because some clubs would want a player to know they are in "S&C Group A". |

Group membership does **not** grant or restrict access. A coach filtered to Forwards still has
permission to read the backs; they have chosen not to look (`01-roles-and-permissions.md` §5).
Access-scoping groups, where an academy coach can only ever see academy athletes, is open
question O-3 and is out of scope for v1.

---

## Entry points

| From | Route | Notes |
|---|---|---|
| Staff tab bar, Squad, then Groups | `(staff)/squad/groups` | |
| Web sidebar, Squad, Groups | `/squad/groups` | |
| `GroupFilter` dropdown, "Manage groups" | `/squad/groups` | Present for roles that may manage groups, absent otherwise. |
| `GroupFilter` empty state, "Create a group" | `/squad/groups/new` | |
| Squad list, bulk action "Add to group", "New group" | `/squad/groups/new?athletes=id,id,id` | Creates the group with the selection pre-added. |
| Injury dashboard, "Rehab group allocation" | `/squad/groups/{id}` for the rehab group | Screen 42, `rehab-groups.md`, is a specialised view of the same data. |
| Settings, Organisation, Squad structure | `/squad/groups` | Admin path. |
| Analytics, population picker, "Manage groups" | `/squad/groups` | |

---

## Layout

### Group list, mobile

```
+------------------------------------------------------+
| <  Groups                                 [ + New ]   |
+------------------------------------------------------+
| [ Search groups         ]   [Type: All v]  [Archived] |
+------------------------------------------------------+
| POSITIONAL                                        2   |
| +--------------------------------------------------+  |
| | #  Forwards                             16       |  |
| | Blue    positional                               |  |
| | Pack and back row                          >     |  |
| +--------------------------------------------------+  |
| +--------------------------------------------------+  |
| | #  Backs                                15       |  |
| | Amber   positional                               |  |
| |                                            >     |  |
| +--------------------------------------------------+  |
+------------------------------------------------------+
| TRAINING                                          2   |
| +--------------------------------------------------+  |
| | #  S&C Group A                           12      |  |
| | Green   training                                 |  |
| +--------------------------------------------------+  |
| | #  S&C Group B                           11      |  |
| | Purple  training                                 |  |
| +--------------------------------------------------+  |
+------------------------------------------------------+
| REHAB                                             1   |
| +--------------------------------------------------+  |
| | #  Rehab                                  3      |  |
| | Slate   rehab                                    |  |
| | Managed by medical staff                         |  |
| +--------------------------------------------------+  |
+------------------------------------------------------+
| 6 groups. 31 athletes. 2 in no group.        [View]   |
+------------------------------------------------------+
```

### Group detail, mobile

```
+------------------------------------------------------+
| <  Forwards                              [ ... ]      |
| # Blue   positional   16 athletes                     |
+------------------------------------------------------+
| [ Members ] [ History ] [ Settings ]                  |
+------------------------------------------------------+
| MEMBERS as at today                    [ + Add ]      |
| [ Search ]                        [Show past members] |
+------------------------------------------------------+
|  4  Ellis Marsh      Prop     since 12 Jul      [-]   |
|  2  Ryan Doherty     Hooker   since 12 Jul      [-]   |
|  5  Will Trent       Lock     since 3 Aug       [-]   |
|  ...                                                  |
+------------------------------------------------------+
| PAST MEMBERS                                     2    |
| 12  Tom Reeve        Lock     12 Jul to 28 Jul        |
|                                            [Re-add]   |
| 18  Alex Nunn        Flanker  1 Sep to 4 Nov 2025     |
+------------------------------------------------------+
| [ Add athletes ]                                      |
+------------------------------------------------------+
```

History tab:

```
+------------------------------------------------------+
| [ Members ] [ History ] [ Settings ]                  |
+------------------------------------------------------+
| Membership over time            [As at: 1 Mar 2026 v] |
+------------------------------------------------------+
|  16 |                    ____________                 |
|  14 |        ___________/                             |
|  12 |_______/                                         |
|  10 |                                                 |
|     +--------------------------------------------     |
|      Jul    Aug    Sep    Oct    Nov    Dec           |
|                                                       |
| Members as at 1 March 2026                       14   |
|  4  Ellis Marsh       12 Jul 2025 to now              |
| 12  Tom Reeve         12 Jul 2025 to 28 Jul 2026      |
|  ...                                                  |
|                                                       |
| CHANGE LOG                                            |
|  3 Aug 2026   Will Trent added          A Bell        |
| 28 Jul 2026   Tom Reeve removed         A Bell        |
| 12 Jul 2025   14 athletes added         A Bell        |
+------------------------------------------------------+
```

### Web, group list and detail side by side

```
+----------------------------------------------------------------------------------------+
| Groups                                                        [Reorder]  [ + New group ]|
+----------------------------------+-----------------------------------------------------+
| [ Search groups        ]         |  Forwards                            [Edit] [ ... ] |
| [Type v] [ ] Show archived       |  # Blue   positional   16 athletes                  |
|                                  |  Pack and back row                                  |
| POSITIONAL                       +-----------------------------------------------------+
|  # Forwards            16    >   |  [ Members | History | Settings ]                    |
|  # Backs               15        |                                                     |
| TRAINING                         |  As at [ today          v ]      [Show past members]|
|  # S&C Group A         12        |  [ Search members     ]              [ + Add ]      |
|  # S&C Group B         11        |                                                     |
| REHAB                            |  #  | Athlete       | Position | Since    |         |
|  # Rehab                3        |  4  | Ellis Marsh   | Prop     | 12 Jul   |   [-]   |
| AGE                              |  2  | Ryan Doherty  | Hooker   | 12 Jul   |   [-]   |
|  # Under 20             9        |  5  | Will Trent    | Lock     | 3 Aug    |   [-]   |
| CUSTOM                           |  ...                                                |
|  # Leadership           5        |                                                     |
|                                  |  PAST MEMBERS (2)                                   |
| 6 groups, 31 athletes            |  12 | Tom Reeve     | Lock     | 12 Jul to 28 Jul   |
| 2 athletes in no group    [View] |                                          [Re-add]   |
+----------------------------------+-----------------------------------------------------+
```

### Create and edit form

```
+------------------------------------------------------+
|  New group                                    [ x ]   |
+------------------------------------------------------+
| Name         [ Forwards                          ]    |
|              Used in filters across the app           |
|                                                       |
| Type         ( ) Positional  ( ) Training             |
|              ( ) Rehab       ( ) Age                  |
|              (o) Custom                               |
|                                                       |
| Description  [ Pack and back row                 ]    |
|              Optional                                 |
|                                                       |
| Colour       [#][#][#][#][#][#]                       |
|              [#][#][#][#][#][#]                       |
|              Blue selected. Used on chips and charts. |
|              (!) Amber is used by Backs               |
|                                                       |
| Members      [ + Add athletes ]              0 added  |
|                                                       |
|              [ Cancel ]        [ Create group ]       |
+------------------------------------------------------+
```

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupList` | **New** | Sectioned list by `group_type`, with counts. |
| `GroupRow` | **New** | Colour swatch, name, type, member count, description. |
| `GroupChip` | **New**, shared with `squad-list.md`, `session-detail.md` | The group's name in its colour, everywhere a group is referenced. Always carries the name: colour is never the only channel (`06-design-system.md` §4.1). |
| `GroupEditorSheet` | **New** | Create and edit form. |
| `ColourPicker` | **New** | Constrained palette, see below. Not a free colour wheel. |
| `MembershipTable` | **New** | Current members, with `since` dates and a remove action. |
| `PastMembersList` | **New** | Removed members with their membership window and a re-add action. |
| `AsAtDatePicker` | **New** | Resolves membership at any past date. The mechanism that makes historical membership visible rather than merely stored. |
| `MembershipTimeline` | **New** | Line chart of member count over the season, plus a change log. Line chart per §8.1 for "how has one metric moved". |
| `AthletePicker` | **New**, shared with `session-detail.md` | Multi-select athlete search with availability shown. |
| `AthleteCard` | §6.1, `compact` | Member rows. |
| `GroupFilter` | §6.7 | Present in the header for consistency, disabled on this screen because filtering groups by group is meaningless. Disabled rather than absent so the header does not reflow between screens. |
| `ConfirmSheet` | §6.18 | Remove member, archive group, merge groups. |
| `EmptyState` | §6.16 | No groups, no members, no past members, no results. |

---

## Data requirements

### Fields

| Field | Source | Transformation |
|---|---|---|
| Group id | `groups.id` | |
| Name | `groups.name` | Unique per organisation, enforced by `unique (org_id, name)`. |
| Description | `groups.description` | Optional. |
| Colour | `groups.colour` | Hex string. Constrained to the palette below by the client and by a check constraint (recommended, O-245). |
| Type | `groups.group_type` | `positional` \| `training` \| `rehab` \| `age` \| `custom`. |
| Sort order | `groups.sort_order` | Drives display order within a type section, and the order of options in `GroupFilter`. |
| Archived | `groups.deleted_at` | Not null means archived. The schema calls it a soft delete; the UI calls it archived, because nothing is deleted. |
| Member count, now | `group_memberships` where `removed_at is null` | Excludes athletes with `status = 'left_club'` and soft-deleted athletes. |
| Member count, as at a date | `group_memberships` where `added_at <= :d and (removed_at is null or removed_at > :d)` | The single query pattern this whole screen is built on. |
| Member since | `group_memberships.added_at` | Displayed as a date, not a timestamp. |
| Member until | `group_memberships.removed_at` | Null means current. |
| Change log | `group_memberships.added_at`, `removed_at`, plus `audit_log` for who | See the note on authorship below. |

**Authorship gap.** `group_memberships` has no `created_by` and no `removed_by`, so the change
log cannot say who added or removed an athlete without reading `audit_log`. Two options:

1. Add `added_by uuid references users(id)` and `removed_by uuid references users(id)` to
   `group_memberships`. Cheap, direct, and it makes the change log a single query.
2. Write an `audit_log` row for every membership change and read it back.

Membership changes are not a mandatory audit event under `09-security-and-compliance.md` §8.5, so
option 2 means adding audit writes anyway. **Recommendation: option 1.** Raised as O-246.

### The colour palette

`groups.colour` is a free hex column. A free colour wheel produces two groups in near-identical
greens, a group in a colour indistinguishable from the `unavailable` red, and a colour that fails
contrast in dark theme. The picker is therefore constrained to a fixed palette.

Rules the palette satisfies:

1. **It never reuses a status, severity, or compliance colour.** A group must never be mistaken
   for an availability state (`06-design-system.md` §3, "Explicitly not expected to change").
2. **Every entry clears 3:1 against both canvas colours** as a chip border and glyph, and its
   paired text colour clears 4.5:1 on its own tint.
3. **The first five entries are the chart series colours**, so a group used as a chart series in
   analytics keeps its identity between the squad list and the chart.
4. **Twelve entries maximum.** Beyond twelve, colour stops distinguishing anything and the name
   is doing all the work (§8.4 caps categorical series at five for a reason).

| Slot | Name | Light | Dark | Note |
|---|---|---|---|---|
| 1 | Blue | `#1246C8` | `#5AA8FF` | `chart.series[0]` |
| 2 | Amber | `#A87400` | `#F0B84A` | `chart.series[1]` |
| 3 | Green | `#007B3F` | `#22AB60` | `chart.series[2]`. Was Teal, `#1E8F6B` / `#3FCFA0`, changed 5 Aug 2026: the dark value measured 6.01 ΔE00 against the new `--good` `#4dcbb2` and broke rule 1. |
| 4 | Purple | `#7A2FA8` | `#EE9FE6` | `chart.series[3]` |
| 5 | Slate | `#41505E` | `#6E7F91` | `chart.series[4]` |
| 6 | Indigo | `#3B3BAF` | `#8C8CF5` | |
| 7 | Cyan | `#0F6C87` | `#4FC3E8` | |
| 8 | Olive | `#5A6B12` | `#B4C64A` | |
| 9 | Magenta | `#96256E` | `#F08CC8` | |
| 10 | Brown | `#7A4A22` | `#D2A176` | |
| 11 | Steel | `#2F5A6B` | `#7FB4C8` | |
| 12 | Plum | `#5D2E6B` | `#C08FD2` | |

The picker warns, and does not block, when a colour is already used: "Amber is used by Backs."
Two groups sharing a colour is legitimate when they never appear together, and blocking it makes
a club with fifteen groups unable to finish.

**Slot 3, why it is green and not teal.** `--good` moved from cyan `#4fd6ff` to teal `#4dcbb2`
(`06-design-system.md` §4.2), which put the old Teal dark value `#3FCFA0` 6.01 ΔE00 from a
status colour. Rule 1 requires clear separation, so the slot was recomputed rather than nudged.
The replacement holds its hue in CIE Lab and was chosen by maximising the smallest CIEDE2000
distance to every semantic token and to every other slot, subject to 4.5:1 against both
canvases in its theme. Green is available precisely because Fydr deliberately does not use
green for "good" (`06-design-system.md` §4.2), so it encodes nothing.

| Measure, CIEDE2000, normal vision | `#007B3F` light | `#22AB60` dark |
|---|---|---|
| vs `--good` `#4dcbb2` | 28.58 | **16.30** |
| vs `--warn` `#f6ab2f` | 47.72 | 42.74 |
| vs `--bad` `#f15a4a` | 65.27 | 67.62 |
| vs `--highlight` `#f5c518` | 45.29 | 37.59 |
| Nearest other slot (Olive) | 16.22 | 22.12 |
| Contrast on its theme's `--surf` / `--bg` | 5.38 / 4.58 | 5.54 / 5.25 |

The binding figure is 16.30, above the 15 floor. **Slots 2 Amber and 10 Brown do not clear it**:
Amber dark `#F0B84A` measures 5.10 ΔE00 against `--warn` and 6.93 against `--highlight`, and
Brown dark `#D2A176` measures 13.64 against `--warn`. Both breach rule 1. Neither is fixed
here, because the brief was slot 3. Added to O-247.

The exact hex values for slots 6 to 12 must go through the same contrast and colour-vision
verification as `06-design-system.md` §4.3 before build, with the results added to that
section's generated table. Raised as O-247.

### Queries

**Group list with current counts:**

```sql
select
  g.id, g.name, g.description, g.colour, g.group_type, g.sort_order,
  g.deleted_at,
  coalesce(m.member_count, 0) as member_count
from groups g
left join lateral (
  select count(*) as member_count
  from group_memberships gm
  join athletes a on a.id = gm.athlete_id
  where gm.group_id = g.id
    and gm.removed_at is null
    and a.deleted_at is null
    and a.status <> 'left_club'
) m on true
where g.org_id = auth_org_id()
  and (:include_archived or g.deleted_at is null)
order by
  case g.group_type
    when 'positional' then 0 when 'training' then 1 when 'rehab' then 2
    when 'age' then 3 else 4 end,
  g.sort_order, g.name;
```

**Members as at a date.** This is the query the screen exists to make visible. `:as_at` is a
timestamptz; the default is `now()`.

```sql
select
  a.id, a.first_name, a.last_name, a.squad_number, a.position, a.status,
  gm.added_at,
  gm.removed_at,
  (gm.removed_at is null) as is_current
from group_memberships gm
join athletes a on a.id = gm.athlete_id and a.deleted_at is null
where gm.org_id   = auth_org_id()
  and gm.group_id = :group_id
  and gm.added_at <= :as_at
  and (gm.removed_at is null or gm.removed_at > :as_at)
order by a.last_name, a.first_name;
```

**Past members**, meaning every membership row that has ended, whether or not the athlete is
currently a member again:

```sql
select
  a.id, a.first_name, a.last_name, a.squad_number,
  gm.added_at, gm.removed_at,
  exists (
    select 1 from group_memberships c
    where c.group_id = gm.group_id and c.athlete_id = gm.athlete_id
      and c.removed_at is null
  ) as is_current_member
from group_memberships gm
join athletes a on a.id = gm.athlete_id and a.deleted_at is null
where gm.org_id = auth_org_id()
  and gm.group_id = :group_id
  and gm.removed_at is not null
order by gm.removed_at desc;
```

**Member count over time**, for the timeline chart. One point per week is enough resolution for a
season and keeps the payload small.

```sql
with weeks as (
  select generate_series(
           date_trunc('week', :from_date::timestamptz),
           date_trunc('week', :to_date::timestamptz),
           interval '1 week') as w
)
select w::date as week_start,
       (select count(*)
        from group_memberships gm
        join athletes a on a.id = gm.athlete_id and a.deleted_at is null
        where gm.group_id = :group_id
          and gm.added_at <= w + interval '6 days'
          and (gm.removed_at is null or gm.removed_at > w + interval '6 days')) as member_count
from weeks;
```

**Athletes in no group**, surfaced on the list footer because it is the most common squad
structure error:

```sql
select a.id, a.first_name, a.last_name, a.squad_number
from athletes a
where a.org_id = auth_org_id()
  and a.deleted_at is null
  and a.status <> 'left_club'
  and not exists (
    select 1 from group_memberships gm
    join groups g on g.id = gm.group_id and g.deleted_at is null
    where gm.athlete_id = a.id and gm.removed_at is null
  )
order by a.last_name;
```

### Writes

| Action | Statement |
|---|---|
| Create group | `insert into groups (org_id, name, description, colour, group_type, sort_order)` |
| Rename, recolour, redescribe | `update groups set ...` |
| Reorder | `update groups set sort_order = ...` for the affected rows, in one statement |
| Archive | `update groups set deleted_at = now()` |
| Restore | `update groups set deleted_at = null` |
| **Add member** | `insert into group_memberships (org_id, group_id, athlete_id, added_at) values (..., now())` |
| **Remove member** | `update group_memberships set removed_at = now() where group_id = :g and athlete_id = :a and removed_at is null` |
| Re-add a past member | A **new row** with a new `added_at`. Never clearing `removed_at` on the old row. |
| Correct a mistaken removal | `update group_memberships set removed_at = null where id = :id`, available only within 10 seconds through Undo, or through an explicit "this was a mistake" action that is audited |
| Merge groups | Insert memberships into the target for members not already there, set `removed_at` on the source's live memberships, archive the source |

**The removal statement is the single most important line in this document.**

```sql
-- Correct:
update group_memberships
   set removed_at = now()
 where group_id = :group_id and athlete_id = :athlete_id and removed_at is null;

-- Never, under any circumstance:
delete from group_memberships where group_id = :group_id and athlete_id = :athlete_id;
```

Deleting the row destroys the answer to "who was in the forwards in March", which is the reason
the table carries `added_at` and `removed_at` at all (`04-data-model.md` §3). Enforce it:

1. `revoke delete on group_memberships from authenticated;` There is no application path that
   needs it.
2. No RLS `for delete` policy exists on the table.
3. A `before delete` trigger raises, so a future migration or a service-role script cannot do it
   by accident either.

```sql
create or replace function group_memberships_no_delete() returns trigger
  language plpgsql as $$
  begin
    raise exception 'group_memberships is history-preserving: set removed_at instead';
  end $$;

create trigger group_memberships_block_delete
  before delete on group_memberships
  for each row execute function group_memberships_no_delete();
```

The `on delete cascade` on `group_memberships.group_id` and `athlete_id` in the current schema
conflicts with this. Deleting a group would cascade and destroy history, and hard-deleting an
athlete is already prohibited (`CLAUDE.md` §2 rule 4). **Recommendation**: change both to
`on delete restrict`, since neither parent is ever hard-deleted. Raised as O-248.

---

## States

| State | Rendering |
|---|---|
| **List, default** | Sectioned by type, with counts and the footer summary. |
| **List, empty** | `EmptyState` kind `notStarted`: "No groups yet." Body "Groups filter every squad screen. Most clubs start with positional groups." Action "Create a group", secondary "Create positional groups from positions" which offers to generate groups from the distinct values of `athletes.position`. |
| **List, filtered empty** | `noResults` naming the filter. |
| **Group detail, default** | Members tab, as at today. |
| **Group detail, no members** | `EmptyState` kind `notStarted`: "No athletes in Forwards." Action "Add athletes". The group is still valid and still appears in the global filter, where selecting it will produce empty screens; the filter dropdown therefore shows the count beside each group name so an empty group is visible before it is selected. |
| **Group detail, no past members** | History tab renders the timeline with a flat line and the caption "No members have been removed from this group." Not an error. |
| **As-at date in the past** | Members table header changes to "Members as at 1 March 2026", the table is read-only, and a `severity.low` banner explains: "Viewing past membership. Switch to today to make changes." Removing an athlete from a historical view is meaningless and is therefore not offered. |
| **Archived group** | Whole detail at 60% opacity, banner "Archived on 4 Aug 2026 by A Bell. It no longer appears in filters." Actions: Restore, Export members. Membership editing disabled. |
| **Loading** | Skeleton rows. Timeline renders a skeleton block of its final height. |
| **Error** | Section-scoped. A failed member query leaves the group header and settings readable. |
| **Offline** | Read-only from cache. All writes disabled with the standard copy. |
| **Rehab group, coach viewing** | Readable. Membership editing disabled with the tooltip "Rehab groups are managed by medical staff." Assumption, raised as O-249. |
| **Group referenced by active objects** | The Settings tab lists what depends on the group: sessions, programme assignments, thresholds, nutrition targets, saved analytics views. Archiving shows the same list in the confirm. |

---

## Interactions

### Managing groups

| Action | Behaviour |
|---|---|
| Create | `GroupEditorSheet`. Name, type, description, colour, optional initial members. |
| Rename | Inline on web, sheet on mobile. Renaming propagates everywhere immediately, because every reference is by id. A toast notes "This group is used in 3 saved views and 2 thresholds." **Built, simplified**: `GroupEditForm.tsx`, a popover on the group detail page, real `update groups set name = ...`, and renaming does propagate everywhere by id exactly as specified. No usage-impact toast — that needs a query counting references across thresholds and (if this build has an equivalent of) saved views, which wasn't built this pass. A real, silent gap, not a considered cut: a coach renaming a group in daily use gets no warning it's referenced elsewhere. |
| Recolour | Picker, with the in-use warning. Recolouring changes chips and chart series everywhere on next render. **Built, simplified**: same form and same gap as Rename — the constrained `GROUP_COLOURS` picker is real, propagation by id is real, the in-use warning is not. |
| Reorder | Drag within a type section on web, up and down actions on mobile. Writes `sort_order`. Order drives the `GroupFilter` option order, so a club can put the groups they use daily at the top. **Built, simplified**: up/down step buttons (`GroupReorderButtons.tsx`) on the web Groups list too, not just mobile — no drag-and-drop dependency, no drag gesture to make keyboard/screen-reader accessible (see §"Accessibility" below, "Space to pick up" — that requirement is for the drag interaction this build doesn't have). Writes `sort_order` exactly as specified, scoped to the group's own type section. |
| Change type | Permitted. Moves the group to a different section. Warns if the group is the target of `rehab_assignments.rehab_group_id` and the new type is not `rehab`. |
| Archive | `ConfirmSheet` listing dependencies: "Archive Forwards? It is used by 4 future sessions, 2 programme assignments, and 1 threshold. Those keep working. The group stops appearing in filters. Membership history is kept." |
| Restore | One tap, no confirmation. |
| Merge | Choose a target group. Preview states counts: "Move 11 athletes into S&C Group A. 3 are already members. S&C Group B will be archived." Source memberships are ended with `removed_at`, target memberships created with `added_at = now()`. History in both groups survives, which is why merge is a membership operation and not a rename. |
| Delete permanently | Not offered. There is no UI path to hard-delete a group. |

### Managing membership

| Action | Behaviour |
|---|---|
| Add athletes | `AthletePicker`, multi-select, searchable, showing availability and which other groups each athlete is in. Athletes already in the group are shown greyed with "already a member". |
| Add from another group | "Copy members from..." picks a source group and adds its current members. Reports skips. |
| Remove one athlete | Row action. `ConfirmSheet` on the first removal in a session, then a toast with Undo for subsequent ones. Copy: "Remove Tom Reeve from Forwards? Their membership history is kept, and past data stays attributed to the group." |
| Remove several | Multi-select then a bulk remove, one `ConfirmSheet` stating the count. |
| Re-add a past member | From the past members list. Creates a new row. The history tab then shows two membership periods for that athlete, which is correct and is displayed as two bars on their row. |
| Undo a removal | Toast for 10 seconds. Clears `removed_at` on the row just written. After 10 seconds the supported path is to re-add, which creates a new period and leaves the gap visible. This asymmetry is deliberate: a genuine mistake is corrected silently within seconds, and a change of mind a day later is history. |
| Change the as-at date | Reloads the member list for that instant. Everything becomes read-only. |
| Export members | CSV of the current or as-at membership, through the audited export pipeline. |

### The history tab

Three elements:

1. **Member count over time**, a line chart with point markers, one point per week, with the
   season boundary marked and today marked with a vertical rule (§8.2 rule 9).
2. **Members as at the selected date**, the same table as the Members tab with the as-at date
   applied, each row showing the membership window.
3. **Change log**, reverse chronological: date, athlete, added or removed, and who did it (once
   O-246 is resolved). Grouped where a bulk action added many athletes at once: "12 Jul 2025, 14
   athletes added, A Bell", expandable.

The chart makes one thing obvious that a table cannot: a group that quietly emptied over a
season, which is the state in which a coach filters to it, sees nothing, and reports a bug.

---

## Validation rules

| Rule | Enforcement | Message |
|---|---|---|
| Name required, 1 to 60 characters | Zod, `not null` | "Give the group a name." |
| Name unique per organisation | `unique (org_id, name)` | "A group called Forwards already exists." Includes archived groups, so restoring never collides. The message says so: "An archived group has that name. Restore it, or choose another name." |
| Name is trimmed and collapsed whitespace | Client | "Forwards " and "Forwards" are the same group. |
| Description 0 to 200 characters | Zod | |
| Type required, from the enum | Zod | |
| Colour required, from the palette | Zod, plus the check constraint in O-245 | |
| Colour already in use | Warn, do not block | "Amber is used by Backs." |
| `sort_order` integer | Zod | Not user-visible. |
| An athlete may have only one live membership per group | Partial unique index, recommended below | Adding an existing member is a no-op, reported as a skip, never an error. |
| Removing an athlete who is not a member | Server, no-op | Reported as a skip. |
| Membership `added_at` may not be in the future | Server | Backdating membership is a separate, audited correction, see Edge cases. |
| Archiving a group used by a **future** session | Warn, permit | Lists the sessions. |
| Archiving the last group | Permitted | Groups are optional. The global filter simply offers only "All squad". |
| Merging a group into itself | Blocked | |
| Group type `rehab` write | Medical, or coach if O-249 says so | |

The schema's `unique (group_id, athlete_id, added_at)` does not prevent two simultaneous live
memberships, because a second row with a different `added_at` satisfies it. Add:

```sql
create unique index group_memberships_one_live
  on group_memberships (group_id, athlete_id)
  where removed_at is null;
```

This makes "add a member who is already a member" a database-level no-op rather than a race
condition that produces a duplicate. Raised as O-250.

---

## Edge cases

| Case | Behaviour |
|---|---|
| **Removing an athlete from a group** | Sets `removed_at = now()`. The row is kept. The athlete disappears from the current member list and appears in past members. Every historical query, report, and analysis over a window before the removal still includes them. This is the behaviour the client called out and it is enforced at three levels: no delete grant, no delete policy, and a blocking trigger. |
| **Athlete removed and re-added** | Two rows, two periods. The history tab shows two bars on their row with the gap visible. A query for "as at a date inside the gap" correctly excludes them. |
| **Athlete added twice in error** | Prevented by the partial unique index. The second add is reported as a skip. |
| **Athlete in six groups** | Fine. `group_memberships` has no cardinality limit. Chips truncate to two plus a count. |
| **Athlete in no group** | Counted on the list footer with a "View" action opening the squad list filtered to them. They are invisible whenever any group filter is active, which is exactly why the count is on the footer. |
| **Athlete leaves the club** | Memberships are **not** ended automatically. Their `athletes.status` becomes `left_club` and they are excluded from current member counts by the `status <> 'left_club'` predicate, while their membership rows stay intact so historical group analysis is unchanged. Ending memberships on departure would silently rewrite the March forwards. |
| **Athlete record soft-deleted** | Excluded everywhere by `deleted_at is null`. Membership rows retained. |
| **Group archived while athletes are in it** | Memberships are **not** ended. The group vanishes from filters and its members stay attached, so restoring the group restores the squad structure exactly. Ending 16 memberships on archive and recreating them on restore would produce sixteen false "removed" and sixteen false "added" events in the history. |
| **Group archived that a future session references** | Sessions keep working. `session_participants.group_id` still resolves and membership still expands. The session detail shows the group chip with an "archived" marker. |
| **Group archived that a threshold targets** | `thresholds.applies_to_group_id` still resolves and the threshold keeps firing. The thresholds screen shows the archived marker. Silently disabling a threshold because a group was tidied up would stop flags without anyone noticing. |
| **Group renamed after a report was exported** | The export carries the name at export time. Reports are snapshots. |
| **Two staff editing the same group simultaneously** | Last write wins on group fields. Membership adds and removes are independent statements and both apply, because they touch different rows. |
| **Bulk add of 40 athletes** | One statement. Reports the count added and the count skipped. |
| **Backdating a membership** | Not offered in the normal flow. Where a club realises an athlete has been in the forwards since July but was only added in August, the correction is an explicit "Correct membership start date" action on the row, restricted to admin and coach, audited, and warned: "This changes historical figures for this group." Raised as O-251. |
| **As-at date before the organisation existed** | The member list is empty and the caption says "No membership records before 12 July 2025." |
| **As-at date in the future** | Blocked. The picker's maximum is today. Future membership is not modelled. |
| **Timeline over a season with no changes** | Flat line, which is a valid and informative result. Not an empty state. |
| **Group with the same name as an archived group** | Blocked by the unique constraint, with the restore-or-rename message. |
| **Colour reused across many groups** | Permitted with a warning. The chip always carries the name, so colour reuse degrades the visual shorthand without breaking anything (§4.1). |
| **Analytics using a group as a chart series** | Series colour comes from `groups.colour`. Above five groups in one chart, §8.4 caps the series and the chart offers small multiples instead. |
| **Rehab group allocation** | `rehab_assignments.rehab_group_id` points at a group of type `rehab`. Screen 42 (`rehab-groups.md`) is a specialised editor over the same membership rows, and every rule on this page applies there too. |

---

## Performance notes

1. **Counts come from a lateral aggregate**, one per group, using
   `group_memberships (group_id, athlete_id) where removed_at is null`, which already exists
   (`04-data-model.md` §15). At a dozen groups this is trivial.
2. **The as-at query needs its own index**, because the partial index above only covers live
   rows:
   ```sql
   create index on group_memberships (group_id, added_at, removed_at);
   ```
3. **The timeline query is 40 correlated counts for a season.** Acceptable at squad scale and
   run only when the History tab is opened. If it becomes slow, replace it with a single pass
   over membership events accumulated in the client, which is the same data in one round trip.
4. **Group data is cached hard**: `staleTime` 10 minutes, `gcTime` 24 hours, per the freshness
   policy for "athlete profile and groups". Groups change rarely.
5. **The `GroupFilter` reads the same query**, so opening this screen warms the global filter and
   vice versa. One query key, `qk.org(orgId) + ['groups']`.
6. **Membership mutations invalidate three keys**: groups, the squad list, and the schedule
   (because session participant counts expand through group membership).
7. **Bulk membership changes are one statement**, using `insert ... select` over an array of
   athlete ids with `on conflict do nothing` against the partial unique index.
8. **Budget**: list interactive under 300 ms warm. Group detail under 400 ms. Timeline under 1 s.

---

## Accessibility

- The group list is a set of `region`s per type, each with a heading carrying the count: "Positional
  groups, 2".
- `GroupChip` always renders the group name. Colour is never the only channel. The chip's
  `accessibilityLabel` is the name plus the type: "Forwards, positional group".
- The colour picker is a `radiogroup` where each swatch is labelled with its colour name, not its
  hex: "Blue", "Amber". A screen reader user picks by name. The in-use warning is announced.
- The member table is a real `table` with a caption stating the as-at date: "Members of Forwards
  as at today".
- Removing a member announces the outcome and the consequence: "Tom Reeve removed from Forwards.
  Membership history kept."
- Past member rows announce their window: "Tom Reeve, member from 12 July to 28 July 2026".
- The as-at picker announces the change: "Showing membership as at 1 March 2026. Read only."
- The membership timeline follows §8.6: one-sentence label ("Line chart. Members of Forwards over
  the 2026/27 season. Ranges 12 to 16. Currently 16."), a table alternative, focusable points on
  web.
- The archived banner is `role="status"` and is the first focusable region after the header.
- Drag reordering has a keyboard equivalent: focus a group, `Space` to pick up, arrows to move,
  `Enter` to drop, with each move announced.
- Touch targets 48 px, including the colour swatches, which are the smallest controls here and
  will otherwise be 24 px.
- Dynamic type to 200%: group rows stack the count beneath the name; colour swatches do not
  scale, because a scaled swatch is just a bigger square.
- Reduced motion: no chip animation on colour change, no timeline draw-in.

---

## Open questions

- **O-244** Should athletes see which groups they are in? I have assumed not. Some clubs treat
  group membership as public squad information ("you are in S&C Group A this block") and would
  want it on the athlete Programme tab. Others treat "Rehab" as information a player should hear
  from a physio, not from a chip.
- **O-245** Should `groups.colour` carry a check constraint restricting it to the palette? It
  stops a stray hex arriving through the API or a script and turning up unreadable in dark theme.
  The cost is a migration whenever the palette changes.
- **O-246** `group_memberships` has no `added_by` or `removed_by`, so the change log cannot say
  who made a change without reading `audit_log`. I recommend adding both columns. Two columns
  now, or an audit read on every history view.
- **O-247** Palette slots 6 to 12 need the same contrast and colour-vision verification as
  `06-design-system.md` §4.3 before build. The values above are proposals, not verified tokens.
  Slot 3 has now been verified and replaced. **Slots 2 Amber and 10 Brown fail rule 1 against
  `--warn` and `--highlight` and still need replacing**, on the same method used for slot 3.
- **O-248** `group_memberships` currently has `on delete cascade` on both foreign keys, which
  would destroy membership history if a group or athlete were ever hard-deleted. Neither is ever
  hard-deleted, so I recommend changing both to `on delete restrict` and adding the
  block-delete trigger described above.
- **O-249** Can a coach edit rehab group membership, or is it medical only? Rehabilitation
  grouping is a medical-owned feature (`rehab-groups.md`, screen 42), which suggests medical
  ownership here too. I have assumed medical only for `rehab` type groups and coach or medical for every
  other type.
- **O-250** The partial unique index preventing two live memberships of the same group. I
  recommend it. Without it, a double tap on "Add" can create two live rows and every count is
  then wrong by one, silently.
- **O-251** Backdating and correcting membership dates. A club will realise in September that an
  athlete has been training with the forwards since July. Do you want an audited correction
  action that edits `added_at`, with the warning that it changes historical figures? I have
  specified it but flagged it, because an editable history is a history nobody can rely on.

---

## Related documents

- The global group filter this screen defines → `CLAUDE.md` §3, `06-design-system.md` §6.7
- Where groups are used to filter → `squad-list.md`, `schedule.md`, every multi-athlete screen
- Rehab group allocation → `rehab-groups.md`
- Schema and the history-preserving rule → `04-data-model.md` §3
- Access scoping versus view filtering → `01-roles-and-permissions.md` §5
