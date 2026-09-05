> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Rehab group allocation

> **Provenance note, 5 August 2026.** This screen was originally written on the reading that
> the whiteboard's "corner group allocation" meant grouping injured athletes for rehab. That
> reading was **wrong**: the client confirmed it means allocating players to teams, specified
> in `team-allocation.md`. Rehabilitation grouping is retained because it is a genuine
> medical need and `rehab_assignments.rehab_group_id` exists in the schema, but it is a
> **medical-owned secondary feature**, not a headline screen, and it is not a sidebar
> destination. Build it in Phase 2 with the rest of the medical module, not before.

> **Layout status**: provisional. Awaiting client design photographs.

---

Screen 42 in the inventory (`02-information-architecture.md` §5). Route
`/staff/rehab-groups`. Reached from the injury dashboard.

---

## Purpose

Allocate injured and restricted athletes into rehabilitation groups so that they train together
under a shared programme and phase, rather than each being managed individually.

The operational problem: a part-time physio at a semi-professional club has four to eight
athletes in rehabilitation at any time. Managing eight individual rehabilitation plans in eight
individual sessions is not possible in the hours available. What actually happens is that
athletes at a similar stage work together in one session with one physio supervising, and the
physio holds the differences in their head. This screen makes those groupings explicit so they
survive the physio being unavailable and so the athletes' plans, compliance, and progression are
recorded rather than remembered.

Four jobs:

1. Show current rehab groups, their members, their shared programme, and their phase.
2. Show unallocated athletes who are injured or restricted, so nobody is missed.
3. Allocate, move, and remove athletes with drag or multi-select.
4. Show each group's session schedule and its members' rehab compliance.

**A rehab group is an ordinary `groups` row** with `group_type = 'rehab'`. It is not a new
entity. It therefore appears in the global group filter, can be assigned to a session as a
participant, and can be assigned a programme, all of which fall out for free. That is the main
argument for keeping the feature: the schema already supports it and no new concept is needed.

---

## Roles and access

| Role | Access |
|---|---|
| Medical / Physio | Full: create groups, allocate athletes, assign rehab programmes, set phases. Medical is the only role that may assign rehabilitation programmes (`01-roles-and-permissions.md` §2). |
| Coach / S&C | **Read-only.** Sees which athletes are in which rehab group, the group's schedule, and its size. Cannot allocate, cannot assign rehab programmes, cannot see clinical detail. The screen inventory lists this screen as `M C`, medical first, which is why. |
| Athlete | No access to this screen. An athlete sees their own rehab programme in the Programme tab and their group's sessions in Today. |
| Admin | Can create and manage groups generally (`01-roles-and-permissions.md` §2) but has no athlete data access, so an admin creating a rehab group sees an empty allocation surface. Renders the group management shell with `noPermission` on the athlete lists. In practice admins do not use this screen. |

**Why a coach reads it.** A coach planning a session needs to know that four athletes are in
Rehab A at 09:00 and are therefore not available for the main session. That is a scheduling
fact, not a clinical one.

**Clinical boundary**: athlete cards on this screen show name, availability status, body area,
restrictions, and rehab phase. Never diagnosis, mechanism, or clinical notes, for any role,
including medical. A physio who needs the diagnosis opens `injury-record.md`, where the read is
audited. Putting diagnoses on an allocation board would mean every glance at the board is an
audited clinical read, which is both noisy and unnecessary: allocation decisions are made on
phase and restriction, not on diagnosis.

**Group filter**: applies to the unallocated pool, not to the groups themselves. A physio
filtering to Forwards should still see all rehab groups, because moving an athlete between
groups is the point of the screen.

---

## Entry points

| From | Trigger | Context |
|---|---|---|
| Injury dashboard | "Rehab groups" | Group filter |
| Injury record | "Add to rehab group" | Athlete pre-selected for allocation |
| Groups management (21) | A group with `group_type = 'rehab'` | That group opened |
| Programmes, a rehab programme | "Assigned groups" | Groups using that programme |
| Schedule, a rehab session | "Manage group" | The group on that session |
| Staff sidebar (medical) | Direct | Group filter |

---

## Layout

**Assumption, pending client design photographs.** A two-pane allocation board (unallocated pool
on one side, groups as columns or cards on the other) with drag on web and multi-select on
mobile. This is the standard shape for an allocation task and it is an assumption: the drawing
gives no form at all, only the phrase.

### Mobile, `md` 390 pt

Drag-and-drop across columns does not work on a phone at this density. Mobile uses select-then-
assign instead, which is slower per athlete and far more reliable.

```
┌────────────────────────────────────────────────┐
│ ‹  Rehab groups     [All squad ▾]        +    │ 56 sticky
├────────────────────────────────────────────────┤
│  UNALLOCATED (2)                               │
│  ┌──────────────────────────────────────────┐  │
│  │ ☐ ○ J. Adeyemi  #5    Shoulder L         │  │ 72 pt row
│  │      No contact · 9 days · no return date│  │
│  ├──────────────────────────────────────────┤  │
│  │ ☐ ◑ P. Sowande  #27   Illness            │  │
│  │      2 days · back Wed 6 Aug             │  │
│  └──────────────────────────────────────────┘  │
│  [ Assign selected to… ]                       │ 48, enabled on select
│                                                │
│  GROUPS (3)                                    │
│  ┌──────────────────────────────────────────┐  │
│  │ Rehab A · Late stage              3      │  │
│  │ Return to running · Phase 3              │  │
│  │ Mon Wed Fri 09:00 · Gym 2                │  │
│  │ ◍ 17 of 21 sessions this week            │  │
│  │ ─────────────────────────────────────────│  │
│  │ ◑ A. Byrne   #14  Hamstring L   Ph 3     │  │
│  │ ◑ K. Reilly  #9   Load mgmt     Ph 3     │  │
│  │ ◑ D. Owusu   #31  Knee R        Ph 2 ⚠   │  │ phase mismatch
│  │                                     ⌄    │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ Rehab B · Early stage             1      │  │
│  │ Acute loading · Phase 1                  │  │
│  │ Daily 08:00 · Treatment room             │  │
│  │ ◍ 5 of 7 sessions this week              │  │
│  │ ─────────────────────────────────────────│  │
│  │ ○ M. Nowak   #21  Ankle R       Ph 1     │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │ Rehab C · Return to play          0      │  │
│  │ No members                               │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

### Web, `xl` 1280 px

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │ [All squad ▾]                                                    ⚙︎ │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │  Rehab groups        5 in rehab · 2 unallocated      [+ New group]   │
│ ▣ Dash │ ┌── 3 cols ─────────┐ ┌── 9 cols, 3 group columns ────────────────┐ │
│  · Inj │ │ UNALLOCATED   2   │ │ Rehab A       │ Rehab B      │ Rehab C     │ │
│  · Reh │ │ ┌───────────────┐ │ │ Phase 3    3  │ Phase 1   1  │ Phase 4  0  │ │
│ ▤ Sched│ │ │○ J. Adeyemi #5│ │ │ MWF 09:00     │ Daily 08:00  │ Not sched.  │ │
│ ▧ Squad│ │ │ Shoulder L    │ │ │ Gym 2         │ Treat. room  │             │ │
│ ▨ Prog │ │ │ No contact    │ │ │ ◍ 17/21       │ ◍ 5/7        │ ◍, │ │
│ ⋯ More │ │ │ 9d · no date  │ │ ├───────────────┼──────────────┼─────────────┤ │
│        │ │ └───────────────┘ │ │ ◑ Byrne A #14 │ ○ Nowak M #21│             │ │
│        │ │ ┌───────────────┐ │ │  Hamstring L  │  Ankle R     │  Drop here  │ │
│        │ │ │◑ P. Sowande   │ │ │  Ph 3  ◍ 6/7  │  Ph 1 ◍ 5/7  │             │ │
│        │ │ │ Illness       │ │ ├───────────────┤              │             │ │
│        │ │ │ 2d · Wed 6    │ │ │ ◑ Reilly K #9 │              │             │ │
│        │ │ └───────────────┘ │ │  Load mgmt    │              │             │ │
│        │ │                   │ │  Ph 3  ◍ 7/7  │              │             │ │
│        │ │  Drag to a group  │ ├───────────────┤              │             │ │
│        │ │  or select and    │ │ ◑ Owusu D #31 │              │             │ │
│        │ │  use Assign to…   │ │  Knee R       │              │             │ │
│        │ │                   │ │  Ph 2 ⚠ ◍ 4/7 │              │             │ │
│        │ └───────────────────┘ └───────────────┴──────────────┴─────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

Drag is an accelerator on web. Every drag action has an equivalent through selection plus an
"Assign to" menu, and the keyboard path is specified under Accessibility. A drag-only allocation
board is unusable with a keyboard and unusable on a phone, and this screen has to work in a
treatment room on a tablet.

### The phase mismatch marker

An athlete whose individual `rehab_assignments.phase` differs from their group's phase renders a
warning glyph and the reason on tap: "Phase 2, group is Phase 3." This is not an error. A physio
will legitimately keep someone in a group they have outgrown or not yet reached because the
session time suits. It is surfaced because an unnoticed mismatch means an athlete doing work
that is wrong for their stage, which is the specific harm this screen exists to prevent.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Header, filters the unallocated pool |
| `AthleteCard` | §6.1 | Every athlete tile. `selectable` for multi-select mode, which the component already supports and was designed for. |
| `AvailabilityPill` | §6.5 | Status on each card, `size="sm"` |
| `ComplianceRing` | §6.6 | Group and per-athlete rehab compliance |
| `SessionCard` | §6.14 | Group's scheduled sessions |
| `EmptyState` | §6.16 | Empty groups, empty pool, no groups yet |
| `ConfirmSheet` | §6.18 | Removing an athlete, deleting a group |
| `BottomSheet` | §6.19 | "Assign to" picker on mobile |
| `RehabGroupColumn` | **New**, this screen | Group header plus member list plus drop target |
| `AllocationPool` | **New**, this screen | Unallocated list with multi-select |

### `RehabGroupColumn`

```ts
export type RehabGroupColumnProps = {
  group: {
    id: string; name: string; colour?: string | null;
    description?: string | null;
  };
  /** The programme and phase shared by the group. */
  programme: { id: string; name: string } | null;
  phase: string | null;
  /** Recurring sessions assigned to this group. */
  sessions: Array<{ id: string; title: string; startsAt: string; location?: string | null }>;
  members: Array<{
    athleteId: string; displayName: string; squadNumber?: number | null;
    availability: AvailabilityStatus;
    bodyArea?: BodyArea | null; side?: BodySide | null;
    restrictions: string[];
    athletePhase: string | null;          // from rehab_assignments
    phaseMismatch: boolean;
    compliance: { completed: number; expected: number };
    expectedReturn?: string | null;
  }>;
  compliance: { completed: number; expected: number };
  readOnly: boolean;                       // true for coach
  onDrop?: (athleteId: string) => void;
  onRemove?: (athleteId: string) => void;
  onEditGroup?: () => void;
  onAssignProgramme?: () => void;
};
```

---

## Data requirements

### Field map

| Field | Source | Transformation |
|---|---|---|
| `group_id`, `name`, `colour`, `description` | `groups` where `group_type = 'rehab'` | |
| `members` | `group_memberships` where `removed_at is null` | |
| `programme_id`, `programme_name` | `rehab_assignments.programme_id` joined to `programmes` | Modal value across the group's members; a group with two programmes is flagged |
| `group_phase` | `rehab_assignments.phase` | Modal value across members |
| `athlete_phase` | `rehab_assignments.phase` | Per athlete |
| `phase_mismatch` | Derived | `athlete_phase <> group_phase` |
| `sessions` | `sessions` joined via `session_participants.group_id`, `session_type = 'rehab'` | Next 7 days |
| `compliance` | `gym_session_logs` matched to the rehab programme's `programme_sessions` | Completed over prescribed for the current week |
| `availability_status`, `restrictions` | `availability` latest open row | |
| `body_area`, `side`, `expected_return` | `injuries` via `availability.injury_id` | Non-clinical only |
| `unallocated` | Athletes with `availability.status <> 'available'` and no rehab group membership | The pool |

**Not read**: any column of `injury_clinical`, for any role, on this screen.

### Board query

```sql
create or replace function public.rehab_board(
  p_group_ids uuid[] default '{}'::uuid[],
  p_as_of     date   default current_date
)
returns table (
  rehab_group_id uuid, rehab_group_name text, rehab_group_colour text,
  group_phase text, group_programme_id uuid, group_programme_name text,
  athlete_id uuid, display_name text, squad_number int,
  availability_status availability_status, restrictions text[],
  body_area body_area, side body_side, expected_return date,
  athlete_phase text, athlete_programme_id uuid,
  rehab_completed int, rehab_expected int,
  is_unallocated boolean
)
language sql security invoker stable
as $$
with rehab_groups as (
  select g.id, g.name, g.colour
  from groups g
  where g.org_id = auth_org_id()
    and g.group_type = 'rehab'
    and g.deleted_at is null
),
-- Every athlete currently not fully available. This is the population
-- the board manages, allocated or not.
in_rehab as (
  select a.id as athlete_id, a.first_name, a.last_name, a.squad_number,
         av.status, av.restrictions, av.injury_id
  from athletes a
  join lateral (
    select av.* from availability av
    where av.athlete_id = a.id and av.effective_to is null
    order by av.effective_from desc limit 1
  ) av on true
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and av.status <> 'available'
),
membership as (
  select gm.athlete_id, gm.group_id
  from group_memberships gm
  join rehab_groups rg on rg.id = gm.group_id
  where gm.org_id = auth_org_id()
    and gm.removed_at is null
),
assignment as (
  select distinct on (ra.athlete_id)
         ra.athlete_id, ra.phase, ra.programme_id, ra.rehab_group_id
  from rehab_assignments ra
  where ra.org_id = auth_org_id()
    and ra.starts_on <= p_as_of
    and (ra.ends_on is null or ra.ends_on >= p_as_of)
  order by ra.athlete_id, ra.starts_on desc
),
-- The group's phase and programme are the modal values across members.
group_modal as (
  select m.group_id,
         mode() within group (order by asg.phase)        as group_phase,
         mode() within group (order by asg.programme_id) as group_programme_id
  from membership m
  join assignment asg on asg.athlete_id = m.athlete_id
  group by m.group_id
),
rehab_compliance as (
  select ce.athlete_id,
         count(*) filter (where ce.is_required)::int as expected,
         count(gl.id)::int                            as completed
  from compliance_expectations ce
  left join gym_session_logs gl
         on gl.athlete_id = ce.athlete_id
        and gl.entry_date = ce.expectation_date
        and gl.status = 'complete'
  where ce.org_id = auth_org_id()
    and ce.domain = 'gym'
    and ce.expectation_date between date_trunc('week', p_as_of)::date and p_as_of
  group by ce.athlete_id
)
select
  m.group_id, rg.name, rg.colour,
  gmo.group_phase, gmo.group_programme_id, p.name,
  ir.athlete_id,
  left(ir.first_name,1) || '. ' || ir.last_name,
  ir.squad_number,
  ir.status, ir.restrictions,
  i.body_area, i.side, i.expected_return,
  asg.phase, asg.programme_id,
  coalesce(rc.completed, 0), coalesce(rc.expected, 0),
  (m.group_id is null) as is_unallocated
from in_rehab ir
left join membership m    on m.athlete_id = ir.athlete_id
left join rehab_groups rg on rg.id = m.group_id
left join group_modal gmo on gmo.group_id = m.group_id
left join programmes p    on p.id = gmo.group_programme_id
left join assignment asg  on asg.athlete_id = ir.athlete_id
left join injuries i      on i.id = ir.injury_id
left join rehab_compliance rc on rc.athlete_id = ir.athlete_id
order by (m.group_id is null) desc, rg.name, ir.last_name;
$$;
```

Empty rehab groups do not appear in this result, because it is driven from athletes. The client
issues a second, trivial query for the full list of rehab groups so that an empty group renders
as a drop target:

```sql
select g.id, g.name, g.colour, g.description, g.sort_order
from groups g
where g.org_id = auth_org_id()
  and g.group_type = 'rehab'
  and g.deleted_at is null
order by g.sort_order, g.name;
```

### Group sessions

```sql
select s.id, s.title, s.starts_at, s.duration_min, s.location, sp.group_id
from sessions s
join session_participants sp on sp.session_id = s.id
where s.org_id = auth_org_id()
  and s.deleted_at is null
  and sp.group_id = any ($1::uuid[])
  and s.starts_at between now() and now() + interval '7 days'
order by sp.group_id, s.starts_at;
```

### Allocation write

```sql
create or replace function public.allocate_to_rehab_group(
  p_athlete_ids  uuid[],
  p_group_id     uuid,          -- null = remove from any rehab group
  p_phase        text default null,
  p_programme_id uuid default null,
  p_injury_id    uuid default null
)
returns int
language plpgsql security invoker
as $$
declare
  v_org uuid := auth_org_id();
  v_count int := 0;
  v_athlete uuid;
begin
  if not auth_has_any_role(array['medical']::app_role[]) then
    raise exception 'medical_role_required' using errcode = '42501';
  end if;

  if p_group_id is not null then
    perform 1 from groups
     where id = p_group_id and org_id = v_org and group_type = 'rehab';
    if not found then
      raise exception 'not_a_rehab_group' using errcode = 'P0002';
    end if;
  end if;

  foreach v_athlete in array p_athlete_ids loop
    -- Close any existing rehab group membership. History-preserving:
    -- removed_at is set, the row is never deleted.
    update group_memberships gm
       set removed_at = now()
     where gm.athlete_id = v_athlete
       and gm.removed_at is null
       and gm.group_id in (select id from groups
                            where org_id = v_org and group_type = 'rehab');

    if p_group_id is not null then
      insert into group_memberships (org_id, group_id, athlete_id, added_at)
      values (v_org, p_group_id, v_athlete, now());

      update rehab_assignments
         set rehab_group_id = p_group_id,
             phase          = coalesce(p_phase, phase),
             programme_id   = coalesce(p_programme_id, programme_id)
       where athlete_id = v_athlete
         and org_id = v_org
         and (ends_on is null or ends_on >= current_date);
    else
      update rehab_assignments
         set rehab_group_id = null
       where athlete_id = v_athlete and org_id = v_org
         and (ends_on is null or ends_on >= current_date);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
```

An athlete belongs to at most one rehab group at a time, enforced here by closing existing
memberships. They may belong to any number of non-rehab groups simultaneously, which is
unchanged.

The role check inside the function is belt and braces: RLS on `group_memberships` and
`rehab_assignments` is the real control, and a function that could be called by a coach and
silently do nothing would be worse than one that says why it refused.

### Query keys

```ts
rehab: {
  all: (orgId: string) => [...qk.org(orgId), 'rehab'] as const,
  board: (orgId: string, groupIds: string[], asOf: string) =>
    [...qk.rehab.all(orgId), 'board', asOf, { groupIds: [...groupIds].sort() }] as const,
  groups: (orgId: string) => [...qk.rehab.all(orgId), 'groups'] as const,
  sessions: (orgId: string, groupIds: string[]) =>
    [...qk.rehab.all(orgId), 'sessions', { groupIds: [...groupIds].sort() }] as const,
},
```

`staleTime` 60 s. Realtime on `availability` inserts, because an athlete becoming unavailable
should appear in the unallocated pool without a manual refresh: that is the moment a physio needs
to allocate them.

---

## States

### Default

Unallocated pool first, then rehab groups in `sort_order`. Empty groups render as drop targets
rather than being hidden.

### Loading

Pool renders two skeleton cards. Each group column renders its header skeleton plus two member
skeletons. Group columns render before members resolve, so the board shape is stable.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| No rehab groups exist | `notStarted` | "No rehab groups yet. Rehab groups let injured athletes train together under a shared programme." Action: "Create a rehab group" (medical only). The body sentence states what a rehab group is for, because it is a medical-owned secondary feature that a new physio will meet cold. |
| No athletes in rehab | `allClear` | "No athletes in rehabilitation. The squad is fully available." Renders in `status.available` colours. |
| Pool empty, groups populated | inline | "All athletes in rehabilitation are allocated." Not a full empty state, a one-line confirmation above the groups. |
| A group has no members | inline | "No athletes. Drag here or use Assign to." For coach read-only: "No athletes." |
| A group has no programme | inline | "No programme assigned." Action for medical: "Assign rehab programme". |
| A group has no sessions | inline | "Not scheduled." Action: "Add to schedule". |
| Coach view, no rehab groups | `noData` | "No rehab groups." No create action. |

### Error

| Failure | Behaviour |
|---|---|
| Board query | Screen error with retry. |
| Groups list | Board renders athletes grouped by whatever membership resolved, with a caption "Group names could not be loaded." |
| Sessions | Group headers omit schedule lines and caption "Schedule unavailable." Allocation still works. |
| Compliance | Rings render the error state. Allocation still works. |
| Allocation write fails | Optimistic move rolls back with an animated return to the origin, or an instant return under reduced motion, plus "Could not move A. Byrne to Rehab B. Try again." |

### Offline

Board renders from cache with "Last updated 08:12" and an offline chip. **All allocation is
disabled** with "You are offline. Allocation will be available when you reconnect." Per
`06-design-system.md` §11.4. Allocation is a staff write that another physio could conflict with,
so unlike attendance (see `timetable.md` O-401) it is a poor candidate for offline queueing.

### Role-specific

| Role | Behaviour |
|---|---|
| Medical | Full allocation, group creation, programme assignment, phase setting. |
| Coach | Read-only board. No drag handles, no checkboxes, no "Assign to" control, no create. Group headers show schedule and size, which is what a coach needs. An explicit caption reads "Rehab groups are managed by medical staff." rather than showing disabled controls, because a row of greyed buttons invites a support ticket. |
| Dual role | Medical behaviour. |
| Admin | Group shell only, `noPermission` on athlete lists. |

---

## Interactions

| Action | Result |
|---|---|
| Drag an athlete card to a group (web) | Optimistic move. Calls `allocate_to_rehab_group`. A drop onto the pool removes them from any rehab group. |
| Select athletes and tap "Assign to…" (mobile and web) | `BottomSheet` listing groups plus "Remove from group". Multi-select assigns all in one RPC call. |
| Tap an athlete card | Medical: navigate to `injury-record.md`. Coach: navigate to `athlete-profile.md`, injury tab. |
| Tap a group header | Expands to show the group's programme detail, its sessions for the next 7 days, and per-member compliance. |
| Tap "+ New group" (medical) | Sheet: name, description, colour, optional starting programme and phase. Creates a `groups` row with `group_type = 'rehab'`. |
| Tap "Assign rehab programme" (medical) | Programme picker filtered to `programme_type = 'rehab'`. Assigning to a group writes a `programme_assignments` row with `group_id` set, and updates each member's `rehab_assignments.programme_id`. Assigning a rehab programme suspends each member's gym programme rather than deleting it (`03-flows.md` §4, rehab exception). |
| Set group phase (medical) | Sets the phase on every member's current `rehab_assignments` row. Behind a `ConfirmSheet` naming the count: "Set Phase 3 for 3 athletes?" |
| Tap a phase mismatch warning | Sheet explaining the mismatch with "Move to the group's phase" and "Keep individual phase". Keeping is a valid choice and is not nagged again. |
| Remove an athlete from a group | `ConfirmSheet`. They return to the unallocated pool, they do not leave rehabilitation. Sets `removed_at`, never deletes the membership row. |
| Delete a group | `ConfirmSheet` stating the consequence: "Rehab A will be deleted. 3 athletes return to unallocated. Their programmes and phases are unchanged." Soft delete via `groups.deleted_at`. Blocked with an explanation if the group is assigned to a future session. |
| Change group filter | Filters the unallocated pool. Group columns and their members are unaffected. A caption explains: "Pool filtered to Forwards. All rehab groups shown." |
| Realtime availability change | An athlete becoming unavailable appears in the pool with a brief highlight. An athlete cleared to play is removed from their group automatically and a notice reads "M. Nowak was cleared and removed from Rehab B." |

---

## Validation rules

| Rule | Enforcement |
|---|---|
| Only medical allocates | RLS plus the role check in the RPC. |
| Only medical assigns rehab programmes | `01-roles-and-permissions.md` §2. RLS on `programme_assignments` for `programme_type = 'rehab'`. |
| A rehab group is a `groups` row with `group_type = 'rehab'` | The RPC rejects a non-rehab `group_id`. Allocating athletes into a positional group through this screen would corrupt both concepts. |
| An athlete is in at most one rehab group | Enforced by closing prior memberships in the RPC. Also worth a partial unique index once `group_type` is denormalised onto `group_memberships`, which it currently is not. See O-338. |
| Membership history is preserved | `removed_at` is set, rows are never deleted. `group_memberships` is history-preserving deliberately (`04-data-model.md` §3). |
| An available athlete cannot be allocated | The pool contains only athletes whose availability is not `available`. Allocating a fit athlete is rejected with `athlete_not_in_rehab`. A fit athlete in a rehab group would appear in every rehab session's expected list and corrupt compliance. |
| Clearing an athlete removes them from their rehab group | `close_injury` and `set_availability` to `available` both trigger removal, in the same transaction. Otherwise a cleared athlete stays on the board forever and physios stop trusting it. |
| A group's phase is derived, not stored | The modal of its members' phases. Storing a group phase separately creates two sources of truth that will diverge within a week. |
| Deleting a group with future sessions is blocked | Explained, not silently refused: "Rehab A is assigned to 3 sessions this week. Remove it from the schedule first." |
| No clinical field is read | Enforced by the query and by the lint rule banning `.from('injury_clinical')`. |

---

## Edge cases

| Case | Handling |
|---|---|
| **An athlete is in a rehab group and a positional group.** | Normal and correct. Rehab membership is one membership among several. The global group filter treats them identically. |
| **An athlete is cleared to play mid-session.** | Realtime removes them from the group with a visible notice. Their rehab compliance history for the group is retained. |
| **A group's members have three different phases.** | The modal wins as the group phase and all three members show a mismatch warning if none matches. A caption reads "Members are at 3 different phases." This is a signal the group needs splitting and it is exactly what the screen should surface. |
| **A group's members have two different programmes.** | The header shows the modal programme with a "+1 other" chip. Tapping lists which athlete is on which. |
| **A physio drags an athlete into a group, then immediately back.** | Two RPC calls. The membership history shows an added and removed pair minutes apart, which is untidy and correct. No undo window: allocation is not destructive and re-dragging is as fast as an undo. |
| **Two physios allocate the same athlete simultaneously.** | Both RPCs run; the second closes the first's membership and creates its own. Last write wins, which for allocation is acceptable. The board refetches and both see the same result. |
| **An athlete has no `rehab_assignments` row**, for example unavailable through illness with no rehab plan. | They appear in the pool and can be allocated. Their phase renders `-`. Allocating creates no assignment row unless a programme is also assigned, which is correct: not every restricted athlete has a rehabilitation programme. |
| **An athlete is unavailable for suspension or personal reasons.** | They appear in the pool, because the pool is "not fully available". A physio can ignore them. Filtering the pool to `reason_category = 'injury'` is available as a toggle, defaulting to off so nobody is invisible. |
| **A rehab group with no athletes and no sessions, left over from last season.** | Renders as an empty drop target. Groups are soft-deleted, not auto-cleaned. A "Hide empty groups" toggle exists and defaults to off. |
| **Long-term injured athlete, 8 months.** | Nothing special. Their days-out figure is large and their phase probably late. The board does not treat duration specially. |
| **All athletes are available.** | `allClear`: "No athletes in rehabilitation. The squad is fully available." Groups still render, empty, so a physio can prepare them. |
| **Group assigned to a session, then emptied.** | The session's expected headcount drops to zero. `timetable.md` renders "No athletes assigned. The group Rehab A is empty." |

---

## Performance notes

| Concern | Approach |
|---|---|
| Population size | At most 8 to 10 athletes in rehabilitation at a semi-professional club, across 2 to 4 groups. This is the smallest screen in the product by data volume. |
| Board query | One RPC over a filtered population. The `mode() within group` aggregates run over a handful of rows. |
| Compliance | Aggregated in the same query over a week's expectations. At 10 athletes this is about 70 rows. |
| Sessions | One query for the visible groups over 7 days. |
| Drag performance | Native drivers on native, pointer events on web. Cards are memoised on `athleteId + groupId + phase`. |
| Optimistic allocation | The move renders immediately and the RPC confirms. A rollback animates the card back, or moves it instantly under reduced motion. |
| Realtime | `availability` inserts only, debounced 500 ms. |
| Payload | Under 15 KB. |
| Budget | Board query 150 ms p95. Allocation write 200 ms p95. Screen interactive 800 ms p95. |
| The screen does not need virtualisation, pagination, or a materialised view | Stated explicitly so nobody adds them. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Drag is never the only path | Every allocation is achievable through selection plus "Assign to". This is the first accessibility requirement of this screen and it is also what makes it work on a phone. |
| Keyboard allocation, web | Focus an athlete card, press `Space` to pick up, arrow keys to move between groups, `Space` to drop, `Escape` to cancel. Standard drag-and-drop keyboard pattern, announced at every step: "A. Byrne picked up. Rehab B, 1 athlete. Press space to drop." |
| Heading structure | `h1` "Rehab groups", `h2` "Unallocated" and per group name, `h3` per group's sub-blocks. |
| Group column label | "Rehab A. Phase 3. Return to running. Monday, Wednesday, Friday 09:00, Gym 2. 3 athletes. 17 of 21 rehab sessions complete this week." |
| Athlete card label | "A. Byrne, 14. Modified. Left hamstring. No sprinting. Phase 3. 6 of 7 rehab sessions. In Rehab A." |
| Phase mismatch | Announced as part of the card: "Phase 2. Group is Phase 3." Warning glyph plus text, never colour alone. |
| Selection | Checkboxes are real checkboxes with `aria-checked`. Selecting announces the running count: "3 athletes selected." |
| Assign sheet | Focus moves in on open, returns to the trigger on close. Options are a list, not a grid. |
| Live region | Allocation announces "A. Byrne moved to Rehab B." A realtime clearance announces "M. Nowak was cleared and removed from Rehab B." |
| Touch targets | Athlete cards 72 pt. Checkboxes 48 pt with 8 pt separation from the card's own press area. Drag handles on web are 24 px visually with 44 px targets. |
| Dynamic type | At 150% the web board drops from three group columns to two with horizontal scroll. At 200% it becomes a single-column stacked list, which is the mobile layout, and allocation is selection-only. |
| Reduced motion | Cards move instantly rather than animating. A rejected drop returns instantly. |
| Colour independence | Group colour is decorative only. Group identity is carried by its name, always rendered. An athlete's availability uses the glyph trio. |
| Read-only clarity, coach | The absence of controls is explained in words: "Rehab groups are managed by medical staff." A screen reader user gets that sentence in the region label, not an unexplained lack of buttons. |

---

## Open questions

- **O-335**: **CLOSED, 5 August 2026.** This screen no longer rests on a reading of "corner
  group allocation". O-5 resolved that phrase to team allocation (`team-allocation.md`), and
  rehabilitation grouping is retained on its own merits as a medical-owned secondary feature.
  See the provenance note at the top of this file.
- **O-336**: Is a rehab group a **standing** group that
  athletes move through, or a **per-programme cohort** created when a programme starts and
  archived when it ends? I have specified standing groups with a derived phase, because it
  matches how a small club actually works: "the 09:00 lot". A cohort model is cleaner and needs
  more administration than a part-time physio will do.
- **O-337**: Can one athlete be in two rehab groups? I have said no, on the basis that a rehab
  group is a session time and an athlete cannot be in two places. If a club runs a strength
  rehab group and a conditioning rehab group that the same athlete attends, that is two
  sessions and the model needs to allow it.
- **O-338**: Enforcement of the one-rehab-group rule is currently procedural, in the RPC.
  Making it a database constraint needs `group_type` denormalised onto `group_memberships` or a
  trigger. I have left it procedural because the trigger fires on a hot table. Confirm the
  procedural enforcement is acceptable, or accept the denormalisation.
- **O-339**: Should the group phase be settable directly on the group, rather than derived from
  members? Derived is safer and it means a physio cannot express "this group is Phase 3, the
  members are not yet". Directly settable creates two sources of truth. I have chosen derived
  and would like it confirmed by someone who runs a rehab caseload.
- **O-340**: Should coaching staff see rehab group membership at all? I have said yes, because
  it is a scheduling fact and a coach planning a session needs to know four athletes are
  elsewhere at 09:00. The counter-argument is that group membership plus phase is a reasonable
  proxy for injury severity, which coaches are not entitled to. I do not find that persuasive
  given they already see availability and expected return, but it should be a conscious
  decision.

---

## Related documents

- Why this screen is not the whiteboard's "corner group allocation" → `02-information-architecture.md` §1 note 4 and §8, O-5
- The whiteboard item itself → `team-allocation.md` (screen 14)
- Availability board and entry point → `injury-dashboard.md`
- Clinical record → `injury-record.md`
- Rehab programme assignment and the gym-suspension rule → `03-flows.md` §4
- Groups generally → `groups.md` (screen 21)
- Schema: `rehab_assignments`, `groups`, `group_memberships` → `04-data-model.md` §3, §9
