# Screen: Gym Programmes

> **Layout status**: provisional. Awaiting client design photographs.

Screen 23 in the inventory (`02-information-architecture.md` §5). Reached from
`Programmes → Gym programmes`. The whiteboard drew this as `GYM PROGRAMME` in capitals, which
is the only item drawn that way, and it sits directly above the arrow reading *"create general
programme and tailor to specific athletes"*.

---

## Purpose

The library. Everything a coach does with a gym programme other than authoring it happens
here: find it, see who is on it, duplicate it, archive it, start a new one from a template.

Three jobs:

1. **Answer "what is running right now, and who is on it".** A coach opening this screen in
   week 6 of pre-season wants the active programmes, the assigned athlete count, and where in
   the block each one is.
2. **Answer "who is on what".** Both directions: programme to athletes, and athlete to
   programme. The second direction is the one spreadsheets never answer and is why the screen
   carries an athlete-oriented view as well as a programme-oriented one.
3. **Get to a new programme fast.** Blank, from template, or duplicate. The 10-minute
   build-and-assign target in `00-product-overview.md` starts on this screen, so the path to
   the builder is one press.

**What this screen is not.** It is not the builder (`programme-builder.md`). It does not edit
prescriptions or overrides. It shows counts and status, and hands off.

Rehab programmes have the same shape and are listed at `Programmes → Rehab programmes` with
the same component set and a medical-owned write path. Nutrition plans are a different shape
and have their own screen (`nutrition-plans.md`).

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Full. Create, duplicate, archive, restore, assign, unassign, save as template |
| Medical / Physio | Read-only on gym programmes, including assignment and divergence counts. Full on rehab programmes. Cannot archive or edit a coach-owned gym programme |
| Athlete | No access |
| Admin | No access |

The `02-information-architecture.md` inventory lists screen 23 as `C` only. Medical read
access is added deliberately here: a physio returning an athlete to play needs to see what gym
programme that athlete is going back onto, and forcing them through the coach to find out is
friction with no safety benefit. This is a read grant, not a write grant, and it is consistent
with `01-roles-and-permissions.md` §1 which already gives medical "everything Coach / S&C can,
in read-only form, for context".

---

## Entry points

| From | Lands on | Context carried |
|---|---|---|
| `Programmes` tab | Active tab of this screen | Group filter |
| Staff web sidebar, `Programmes → Gym` | Same | Group filter |
| `athlete-profile.md → Gym tab`, "Programme" link | This screen, Active tab, filtered to that athlete's programmes | `athlete_id` as a filter chip |
| `programme-builder.md`, Back or "Save and close" | This screen, tab matching the programme's status | `programme_id` scrolled into view and briefly highlighted |
| `dashboard.md`, "Programmes ending this week" card | Active tab, sorted by end date | Sort applied |
| `groups.md`, "Programmes assigned to this group" | Active tab, filtered to that group | `group_id` |
| Deep link `fydr://programmes/gym` | Active tab | None |

---

## Layout

Three tabs: **Active**, **Templates**, **Archived**. Plus a view toggle within Active between
programme-oriented and athlete-oriented listing, because both questions are asked and neither
is a subset of the other.

### Web, 1280 pt design target

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Fydr    [Group filter: All squad ▾]                                        Alex R  ▾     │
├────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard  │  Gym programmes                                        [+ New programme ▾]  │
│ Schedule   │                                                                             │
│ Squad      │  ┌──────────────────────────────────────────────────────────────────────┐  │
│ Programmes │  │ Active (4) │ Templates (7) │ Archived (23)                            │  │
│  ▸ Gym     │  └──────────────────────────────────────────────────────────────────────┘  │
│  ▸ Nutri   │  View: (•) By programme  ( ) By athlete    [Search           ]  [Sort ▾]   │
│  ▸ Rehab   │                                                                             │
│  ▸ Builder │  ┌────────────────────────────────────────────────────────────────────────┐│
│ More       │  │ Pre-season Strength 2026                          Active   [Edit] [⋯] ││
│            │  │ 12 weeks · Block 2 of 3 · Week 6 of 12  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░  50%       ││
│            │  │ 4 Aug 2026 to 26 Oct 2026                                              ││
│            │  │ 38 athletes  [Forwards] [Backs]        6 tailored  ⚠ 1 unacknowledged  ││
│            │  │ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●   Adherence 82% (28d)          ││
│            │  ├────────────────────────────────────────────────────────────────────────┤│
│            │  │ Academy Foundation                                Active   [Edit] [⋯] ││
│            │  │ 8 weeks · Block 1 of 2 · Week 3 of 8    ▓▓▓▓▓░░░░░░░░░░░░░  37%       ││
│            │  │ 21 Jul 2026 to 14 Sep 2026                                             ││
│            │  │ 11 athletes  [Academy]                  2 tailored                     ││
│            │  │ ●●●●●●●●●●●                             Adherence 64% (28d)  ▼         ││
│            │  ├────────────────────────────────────────────────────────────────────────┤│
│            │  │ Return to Play Strength                           Active   [Edit] [⋯] ││
│            │  │ 6 weeks · Block 1 of 1 · Week 2 of 6    ▓▓▓▓░░░░░░░░░░░░░░  33%       ││
│            │  │ 28 Jul 2026 to 7 Sep 2026                                              ││
│            │  │ 3 athletes  [individually assigned]     3 tailored                     ││
│            │  │ ●●●                                     Adherence 91% (28d)            ││
│            │  ├────────────────────────────────────────────────────────────────────────┤│
│            │  │ Goalkeeper Power  (draft)                          Draft   [Edit] [⋯] ││
│            │  │ 10 weeks · not started · nobody assigned                               ││
│            │  │ Created 2 Aug 2026 by Sam Rees                        [Publish]        ││
│            │  └────────────────────────────────────────────────────────────────────────┘│
│            │                                                                             │
│            │  Not on any gym programme: 4 athletes  [Review]                            │
└────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

The **By athlete** view answers the second direction:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ View: ( ) By programme  (•) By athlete   [Search        ]  [ ] Only unassigned         │
├──────────────┬────────────────────────────┬───────────┬──────────┬─────────────────────┤
│ Athlete      │ Gym programme              │ Week      │ Tailored │ Adherence 28d       │
├──────────────┼────────────────────────────┼───────────┼──────────┼─────────────────────┤
│ S. Adeyemi   │ Pre-season Strength 2026   │ 6 of 12   │ 1        │ 88%  ▁▃▅▆▆▅▇        │
│ T. Bennett   │ Pre-season Strength 2026   │ 6 of 12   │ 1        │ 79%  ▃▅▂▅▆▄▅        │
│ M. Chen      │ none                       │ -         │ -        │ -                   │
│ J. Okafor    │ Return to Play Strength    │ 2 of 6    │ 2        │ 94%  ▆▇▇▆▇▇▇        │
│              │ Pre-season Strength (susp.)│ -         │ 1        │ suspended: rehab    │
│ D. Rahman    │ Academy Foundation         │ 3 of 8    │ 1        │ 61%  ▃▂▄▁▃▂▄        │
│ M. Price     │ Pre-season Strength 2026   │ 6 of 12   │ 0        │ 85%  ▅▆▅▇▆▆▇        │
└──────────────┴────────────────────────────┴───────────┴──────────┴─────────────────────┘
```

The **Templates** tab:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Templates (7)                                        [+ New template]  [Import ▾]      │
│ Filter: [Goal ▾] [Duration ▾] [Source: All ▾]                                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐│
│ │ 12-week Pre-season       │ │ 8-week In-season Maint.  │ │ 6-week Return to Play    ││
│ │ Strength and power       │ │ Maintenance              │ │ Rehab handover           ││
│ │ 3 blocks · 4 sess/wk     │ │ 2 blocks · 2 sess/wk     │ │ 1 block · 3 sess/wk      ││
│ │ 32 exercises             │ │ 18 exercises             │ │ 14 exercises             ││
│ │ Club template            │ │ Club template            │ │ Fydr standard            ││
│ │ Used 3 times             │ │ Used 5 times             │ │ Used 8 times             ││
│ │ [Use] [Preview] [⋯]      │ │ [Use] [Preview] [⋯]      │ │ [Use] [Preview] [⋯]      ││
│ └──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

The **Archived** tab is the Active list layout in a muted treatment, with `[Restore]` and
`[Duplicate]` replacing `[Edit]`, plus the archive date and who archived it.

### Mobile, 390 pt design target

```
┌─────────────────────────────┐
│ Gym programmes          [+] │
│ [All squad ▾]               │
├─────────────────────────────┤
│ Active 4 │Templates 7│Arch 23│
│ ────────                     │
│ [Search                    ] │
│ By programme ▾               │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Pre-season Strength 2026│ │
│ │ Active · Wk 6 of 12     │ │
│ │ ▓▓▓▓▓▓▓▓▓▓░░░░░░  50%   │ │
│ │ 38 athletes · 6 tailored│ │
│ │ ⚠ 1 divergence notice   │ │
│ │ Adherence 82%        ⋯  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Academy Foundation      │ │
│ │ Active · Wk 3 of 8      │ │
│ │ ▓▓▓▓▓░░░░░░░░░░  37%    │ │
│ │ 11 athletes · 2 tailored│ │
│ │ Adherence 64%  ▼     ⋯  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Return to Play Strength │ │
│ │ Active · Wk 2 of 6      │ │
│ │ 3 athletes · 3 tailored │ │
│ │ Adherence 91%        ⋯  │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Goalkeeper Power        │ │
│ │ Draft · nobody assigned │ │
│ │              [Publish] ⋯ │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 4 athletes on no programme  │
│                    [Review] │
└─────────────────────────────┘
```

The `⋯` menu opens a `BottomSheet`: Edit, Assign athletes, Duplicate, Save as template,
Archive, Export CSV, View divergence.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Scopes assignment counts and the By athlete view |
| `AthleteCard` | §6.1 | Rows in the By athlete view and in the assignment drawer |
| `AvailabilityPill` | §6.5 | Availability against each athlete in the By athlete view |
| `TrendSparkline` | §6.3 | 7-week adherence sparkline per programme and per athlete |
| `ComplianceRing` | §6.6 | Optional adherence rendering on the mobile card at `lg` and above |
| `EmptyState` | §6.16 | `notStarted`, `noResults`, `noData`, `noPermission` |
| `ConfirmSheet` | §6.18 | Archive, restore, unassign, delete a template |
| `BottomSheet` | §6.19 | The `⋯` overflow menu on mobile, and the assignment drawer |
| `FlagBadge` | §6.4 | The unacknowledged divergence indicator, reusing the badge treatment rather than inventing a second alert style |
| `ProgrammeCard` | New, this screen | One programme: name, status, block and week position, progress bar, assignment chips, tailoring count, adherence |
| `ProgrammeProgressBar` | New, this screen | Elapsed weeks against total, with block boundaries marked |
| `AssignmentChips` | New, this screen | Group chips plus an individually-assigned count, coloured from `groups.colour` |
| `TemplateCard` | New, this screen | Template summary with use count and provenance |
| `TemplatePreview` | New, this screen | Read-only render of a template's structure in a sheet, before committing to use it |
| `AthleteProgrammeTable` | New, this screen | The By athlete view |
| `NewProgrammeMenu` | New, this screen | The three-way create: blank, template, duplicate |

---

## Data requirements

### Reads

| Field | Source `table.column` | Transformation |
|---|---|---|
| Name, goal, description | `programmes.name`, `.goal`, `.description` | None |
| Type filter | `programmes.programme_type` | Fixed to `gym` on this screen; the rehab screen passes `rehab` |
| Status tab | `programmes.status` | `draft` and `active` both appear in the Active tab, visually distinguished. `archived` in the Archived tab |
| Template flag | `programmes.is_template` | Drives tab placement. A template is never in the Active tab regardless of status |
| Total weeks | `programmes.duration_weeks` | Falls back to `sum(programme_blocks.duration_weeks)` if null |
| Block count and names | `programme_blocks.id`, `.name`, `.sequence`, `.duration_weeks` | Ordered by `sequence`; used for the progress bar's block markers |
| Sessions per week | `count(programme_sessions)` grouped by `week_number` | Modal value, displayed as "4 sess/wk" |
| Exercise count | `count(programme_exercises)` | Template cards only |
| Current week | `programme_assignments.starts_on` and `current_date` | `floor((current_date - min(starts_on)) / 7) + 1`, clamped to `duration_weeks` |
| Date range | `min(programme_assignments.starts_on)`, `max(.ends_on)` | Nulls render as "no end date" |
| Assigned athlete count | `programme_assignments` expanded through `group_memberships` | Distinct athletes, respecting the group filter, excluding `status in ('cancelled','completed')` |
| Group chips | `groups.name`, `.colour` via `programme_assignments.group_id` | Individually assigned athletes collapse to "+3 individual" |
| Suspended count | `programme_assignments.status = 'suspended'`, `.suspended_reason` | Shown separately, never folded into the assigned count |
| Tailored athlete count | `count(distinct exercise_overrides.athlete_id)` for the programme, active only | Distinct athletes, not override rows |
| Unacknowledged divergence | `programme_change_events` where `acknowledged_at is null` | Badge count. Table defined in `programme-builder.md` |
| Adherence, 28 days | Derived from `gym_session_logs` against expected programme sessions | See the query below |
| Adherence trend | Weekly adherence for the last 7 weeks | Sparkline. Suppressed below 3 weeks of data per §8.5 |
| Template use count | `count(programmes.parent_id = template.id)` | Includes archived children |
| Template provenance | `programmes.org_id is null` | Null org means a Fydr standard template, shipped with the product |
| Archived by and when | `audit_log` action `programme.archive` | Latest matching row |
| Athletes on no programme | `athletes` left join active `programme_assignments` | Respects the group filter and excludes `status = 'left_club'` |

### Query: the Active tab, by programme

```sql
with scoped_athletes as (
  select a.id
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and ($2::uuid[] is null or exists (
          select 1 from group_memberships gm
          where gm.athlete_id = a.id
            and gm.group_id = any($2::uuid[])
            and gm.removed_at is null))
),
assigned as (
  select
    pa.programme_id,
    coalesce(pa.athlete_id, gm.athlete_id) as athlete_id,
    pa.status,
    pa.starts_on,
    pa.ends_on,
    pa.group_id
  from programme_assignments pa
  left join group_memberships gm
    on gm.group_id = pa.group_id and gm.removed_at is null
  where pa.org_id = auth_org_id()
    and pa.status in ('active','suspended')
),
counts as (
  select
    a.programme_id,
    count(distinct a.athlete_id) filter (where a.status = 'active')    as athlete_count,
    count(distinct a.athlete_id) filter (where a.status = 'suspended') as suspended_count,
    min(a.starts_on) as starts_on,
    max(a.ends_on)   as ends_on
  from assigned a
  join scoped_athletes s on s.id = a.athlete_id
  group by a.programme_id
),
tailoring as (
  select b.programme_id,
         count(distinct o.athlete_id) as tailored_athletes,
         count(*)                     as override_rows
  from exercise_overrides o
  join programme_exercises pe on pe.id = o.programme_exercise_id
  join programme_sessions s   on s.id = pe.programme_session_id
  join programme_blocks b     on b.id = s.block_id
  where o.org_id = auth_org_id()
    and (o.expires_at is null or o.expires_at > now())
  group by b.programme_id
),
divergence as (
  select programme_id, count(*) as unacknowledged
  from programme_change_events
  where org_id = auth_org_id() and acknowledged_at is null
  group by programme_id
),
structure as (
  select b.programme_id,
         count(distinct b.id)                   as block_count,
         sum(b.duration_weeks)                  as total_weeks,
         count(distinct s.id)                   as session_count,
         count(pe.id)                           as exercise_count
  from programme_blocks b
  left join programme_sessions s   on s.block_id = b.id
  left join programme_exercises pe on pe.programme_session_id = s.id
  where b.org_id = auth_org_id()
  group by b.programme_id
)
select
  p.id, p.name, p.goal, p.status, p.duration_weeks, p.created_at,
  u.full_name                       as created_by_name,
  coalesce(st.total_weeks, p.duration_weeks) as total_weeks,
  st.block_count, st.session_count, st.exercise_count,
  c.athlete_count, c.suspended_count, c.starts_on, c.ends_on,
  coalesce(t.tailored_athletes, 0)  as tailored_athletes,
  coalesce(t.override_rows, 0)      as override_rows,
  coalesce(d.unacknowledged, 0)     as unacknowledged_divergences,
  case
    when c.starts_on is null then null
    when current_date < c.starts_on then 0
    else least(
      floor((current_date - c.starts_on) / 7)::int + 1,
      coalesce(st.total_weeks, p.duration_weeks))
  end as current_week
from programmes p
left join users u      on u.id = p.created_by
left join counts c     on c.programme_id = p.id
left join tailoring t  on t.programme_id = p.id
left join divergence d on d.programme_id = p.id
left join structure st on st.programme_id = p.id
where p.org_id = auth_org_id()
  and p.deleted_at is null
  and p.programme_type = $1::programme_type
  and p.is_template = false
  and p.status in ('draft','active')
order by
  (p.status = 'draft'),          -- drafts last
  c.starts_on desc nulls last,
  p.name;
```

### Query: adherence over 28 days

Adherence is "sessions logged against sessions prescribed", not compliance. Compliance is the
`compliance_expectations` mechanism in `04-data-model.md` §11 and answers "did the athlete
submit an entry". Adherence answers "did the athlete do the prescribed work". They are
different numbers and conflating them is a reporting bug.

```sql
with prescribed as (
  -- Every programme session an assigned athlete was due, in the window
  select
    b.programme_id,
    asg.athlete_id,
    s.id            as programme_session_id,
    d.due_date
  from programme_assignments pa
  left join group_memberships gm
    on gm.group_id = pa.group_id and gm.removed_at is null
  cross join lateral (select coalesce(pa.athlete_id, gm.athlete_id) as athlete_id) asg
  join programme_blocks b     on b.programme_id = pa.programme_id
  join programme_sessions s   on s.block_id = b.id
  join lateral (
    select (pa.starts_on + ((s.week_number - 1) * 7) + coalesce(s.day_number, 1) - 1)::date
             as due_date
  ) d on true
  where pa.org_id = auth_org_id()
    and pa.programme_id = $1
    and pa.status = 'active'
    and d.due_date between (current_date - $2::int) and current_date
),
logged as (
  select gsl.athlete_id, gsl.programme_session_id, gsl.entry_date, gsl.status
  from gym_session_logs gsl
  where gsl.org_id = auth_org_id()
    and gsl.entry_date between (current_date - $2::int) and current_date
    and gsl.status = 'complete'
)
select
  p.programme_id,
  count(*)                                              as prescribed_sessions,
  count(l.programme_session_id)                         as completed_sessions,
  round(100.0 * count(l.programme_session_id)
        / nullif(count(*), 0), 0)                       as adherence_pct,
  count(distinct p.athlete_id)                          as n_athletes
from prescribed p
left join logged l
  on l.athlete_id = p.athlete_id
 and l.programme_session_id = p.programme_session_id
 and l.entry_date between p.due_date - 2 and p.due_date + 2
group by p.programme_id;
```

The `± 2 days` match window exists because athletes do not do Wednesday's session on
Wednesday. A stricter match produces an adherence figure nobody believes, and a looser one
double-counts. Two days is an assumption and is open question O-263.

Per `06-design-system.md` §8.3 the adherence figure always renders with its n and window:
`n = 38 athletes · 28 days to 5 Aug 2026 · 412 of 502 sessions`.

### Query: athletes on no gym programme

```sql
select a.id, a.first_name, a.last_name, a.squad_number, a.position,
       av.status as availability_status
from athletes a
left join lateral (
  select status from availability
  where athlete_id = a.id and effective_to is null
  order by effective_from desc limit 1
) av on true
where a.org_id = auth_org_id()
  and a.deleted_at is null
  and a.status <> 'left_club'
  and ($1::uuid[] is null or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id and gm.group_id = any($1::uuid[])
          and gm.removed_at is null))
  and not exists (
    select 1
    from programme_assignments pa
    left join group_memberships gm2
      on gm2.group_id = pa.group_id and gm2.removed_at is null
    join programmes p on p.id = pa.programme_id
    where p.programme_type = 'gym'
      and pa.status = 'active'
      and coalesce(pa.athlete_id, gm2.athlete_id) = a.id
      and (pa.ends_on is null or pa.ends_on >= current_date))
order by a.last_name;
```

### Query: the By athlete view

```sql
select
  a.id as athlete_id, a.first_name, a.last_name, a.squad_number,
  p.id as programme_id, p.name as programme_name,
  pa.status as assignment_status, pa.suspended_reason,
  pa.starts_on, pa.ends_on,
  case when pa.starts_on is null or current_date < pa.starts_on then null
       else floor((current_date - pa.starts_on) / 7)::int + 1 end as current_week,
  coalesce(st.total_weeks, p.duration_weeks) as total_weeks,
  coalesce(ov.n, 0) as override_count
from athletes a
left join lateral (
  select pa.*, coalesce(pa.athlete_id, gm.athlete_id) as resolved_athlete_id
  from programme_assignments pa
  left join group_memberships gm
    on gm.group_id = pa.group_id and gm.removed_at is null
  where coalesce(pa.athlete_id, gm.athlete_id) = a.id
    and pa.status in ('active','suspended')
) pa on true
left join programmes p on p.id = pa.programme_id and p.programme_type = 'gym'
left join lateral (
  select sum(b.duration_weeks) as total_weeks
  from programme_blocks b where b.programme_id = p.id
) st on true
left join lateral (
  select count(*) as n
  from exercise_overrides o
  join programme_exercises pe on pe.id = o.programme_exercise_id
  join programme_sessions s   on s.id = pe.programme_session_id
  join programme_blocks b     on b.id = s.block_id
  where o.athlete_id = a.id and b.programme_id = p.id
    and (o.expires_at is null or o.expires_at > now())
) ov on true
where a.org_id = auth_org_id()
  and a.deleted_at is null
  and a.status <> 'left_club'
  and ($1::uuid[] is null or exists (
        select 1 from group_memberships gm
        where gm.athlete_id = a.id and gm.group_id = any($1::uuid[])
          and gm.removed_at is null))
order by a.last_name, p.name;
```

### Writes

| Action | Write | Audit |
|---|---|---|
| Create blank | Insert `programmes` with `status='draft'`, `programme_type='gym'` | `programme.create` |
| Create from template | Insert `programmes` with `parent_id = template.id`, then deep-copy blocks, sessions and exercises with new ids | `programme.create_from_template` |
| Duplicate | Same deep copy, `parent_id = source.id`, name suffixed " (copy)" | `programme.duplicate` |
| Save as template | Insert a copy with `is_template = true`, `status = 'active'`, no assignments | `programme.save_as_template` |
| Archive | Update `programmes.status = 'archived'`; update every `programme_assignments.status` from `active` to `completed` with `ends_on = current_date` where null | `programme.archive` |
| Restore | Update `status = 'draft'`. Assignments are **not** restored | `programme.restore` |
| Delete a template | Soft delete: `deleted_at = now()`. Blocked if any live programme has `parent_id` pointing at it | `programme.template_delete` |
| Assign / unassign | Insert or update `programme_assignments` | `programme.assign`, `programme.unassign` |
| Publish a draft | Update `status = 'active'` after builder validation | `programme.publish` |

Deep copy is a single Postgres function, not client-side orchestration, so a half-copied
programme cannot exist:

```sql
create or replace function public.duplicate_programme(
  p_source_id uuid,
  p_new_name  text,
  p_as_template boolean default false
)
returns uuid
language plpgsql
security invoker
as $$
declare v_new_id uuid;
begin
  insert into programmes
    (org_id, name, programme_type, description, goal, duration_weeks,
     is_template, parent_id, status, created_by)
  select org_id, p_new_name, programme_type, description, goal, duration_weeks,
         p_as_template, p_source_id,
         case when p_as_template then 'active' else 'draft' end::programme_status,
         auth_user_id()
  from programmes where id = p_source_id
  returning id into v_new_id;

  with b as (
    insert into programme_blocks (org_id, programme_id, name, sequence, duration_weeks, focus)
    select org_id, v_new_id, name, sequence, duration_weeks, focus
    from programme_blocks where programme_id = p_source_id
    returning id, sequence
  ),
  bmap as (
    select ob.id as old_id, nb.id as new_id
    from programme_blocks ob
    join b nb on nb.sequence = ob.sequence
    where ob.programme_id = p_source_id
  ),
  s as (
    insert into programme_sessions
      (org_id, block_id, name, week_number, day_number, md_offset, sequence)
    select os.org_id, bmap.new_id, os.name, os.week_number, os.day_number,
           os.md_offset, os.sequence
    from programme_sessions os
    join bmap on bmap.old_id = os.block_id
    returning id, block_id, week_number, sequence
  ),
  smap as (
    select os.id as old_id, ns.id as new_id
    from programme_sessions os
    join bmap on bmap.old_id = os.block_id
    join s ns on ns.block_id = bmap.new_id
             and ns.week_number = os.week_number
             and ns.sequence = os.sequence
  )
  insert into programme_exercises
    (org_id, programme_session_id, exercise_id, sequence, superset_group, sets,
     reps_min, reps_max, load_basis, load_value, tempo, rest_seconds, notes)
  select ope.org_id, smap.new_id, ope.exercise_id, ope.sequence, ope.superset_group,
         ope.sets, ope.reps_min, ope.reps_max, ope.load_basis, ope.load_value,
         ope.tempo, ope.rest_seconds, ope.notes
  from programme_exercises ope
  join smap on smap.old_id = ope.programme_session_id;

  return v_new_id;
end;
$$;
```

**Overrides and assignments are never copied.** An override belongs to a specific athlete on a
specific parent element. Copying them into a new programme would silently reapply a load cap
that a physio set for a different block, which is the safety failure that ADR-006 open question
O-29 is about. The duplicate confirmation states this in one line.

---

## States

### Default

Active tab, By programme view, sorted by start date descending with drafts last. Group filter
applied. Tab counts in the tab labels.

### Loading

Three `ProgrammeCard` skeletons at final card height, per §11.1. Counts in tab labels render
as a skeleton pill rather than zero, because a zero that becomes a four is a worse experience
than a placeholder. Adherence figures and sparklines load in a second pass and show a dash
until they arrive, never a zero.

### Empty

| Kind | Trigger | Copy | Action |
|---|---|---|---|
| `notStarted` | No gym programmes in the org | "No gym programmes yet." | "Create a programme", "Browse templates" |
| `notStarted` | Templates tab, none saved | "No templates yet. Save any programme as a template to reuse its structure." | "Browse Fydr standard templates" |
| `allClear` | Archived tab empty | "Nothing archived." | none |
| `noResults` | Search matches nothing | "No programmes match 'preseson'." | "Clear search" |
| `noResults` | Group filter excludes every assignment | "No gym programmes are assigned to Academy." | "Clear filter" |
| `noData` | Active programme with no assignments | Rendered inline on the card: "Nobody assigned yet." | "Assign athletes" |
| `insufficientData` | Adherence with fewer than 3 prescribed sessions in window | "Not enough sessions to report adherence. 2 of 3 needed." | none |
| `noPermission` | Medical opening the `⋯` menu on a gym programme | "Editing gym programmes is available to coaching staff." | none |

The "4 athletes on no programme" footer is not an empty state, it is a finding, and it is
always rendered when the count is above zero. Athletes falling off a programme silently is one
of the failure modes this product exists to catch.

### Error

Per §11.3, at the smallest failing scope. A failed adherence query leaves the cards rendered
with "Adherence unavailable" in the metric slot, and the rest of the screen usable. A failed
programme list shows a full-screen error with a retry, because there is nothing else on the
screen.

A failed duplicate shows "Could not duplicate Pre-season Strength 2026. Nothing was created."
The function is transactional, so the message is true.

### Offline

Renders the last cached list with a persistent offline chip and a "Last updated 09:41"
caption. All write actions are disabled with "You are offline. This will be available when you
reconnect." Adherence figures render from cache with the caption stating the cache time, per
§11.4, never a partial window without saying so.

### Role-specific

| Role | Difference |
|---|---|
| Coach / S&C | Full |
| Medical | `[+ New programme]` hidden. `⋯` menu contains View, Preview, View divergence, Export only. Card status chips and counts identical. Rehab programmes screen is fully enabled |
| Athlete, admin | Route not registered. Deep link resolves to `noPermission` |

---

## Interactions

### Creating

`[+ New programme ▾]` opens a three-item menu, in this order because it matches the frequency
of the actions:

1. **From a template.** Opens the Templates tab in a picker mode with `TemplatePreview`
   available on every card. Choosing one runs `duplicate_programme` and lands in the builder.
2. **Duplicate an existing programme.** Picker over Active and Archived. Most common in
   practice: last season's pre-season block, with adjustments.
3. **Blank.** Name, goal, duration in weeks. Lands in the builder on an empty tree.

All three land in `programme-builder.md` with the new programme in `draft`. There is no
"create without opening the builder" path, because an empty named programme is not useful.

### Assigning from this screen

The `⋯ → Assign athletes` action opens the same `AssignmentPanel` component the builder uses,
in a drawer. This is deliberate duplication of an entry point, not of the component: assigning
is the action a coach most often returns for after building, and making them re-enter the
builder to do it costs the 10-minute target.

The drawer carries the same restriction warning and rehab suspension behaviour specified in
`programme-builder.md` under "Assigning".

### Archiving

Archiving is the correct end state for a finished block, not deletion. `CLAUDE.md` rule 4
prohibits hard deletion of athlete data, and the logged work under a programme is athlete
data.

The `ConfirmSheet` states the consequences plainly:

```
Archive "Pre-season Strength 2026"?

· 38 athletes stop receiving this programme from today.
· 9 tailoring records are kept and will apply again if you restore it.
· 412 logged gym sessions are unaffected and stay in each athlete's history.
· Athletes are not notified. Assign their next programme first if there is one.

                              [Cancel]  [Archive]
```

The fourth line matters. Archiving without a replacement leaves athletes with an empty
Programme tab, and the footer count on this screen will show them as unassigned the next day.

Restoring sets `status = 'draft'`, not `active`, and does not restore assignments. A restored
programme must be reassigned deliberately, because the squad has moved on and the previous
group membership is stale.

### Templates

A template is a `programmes` row with `is_template = true`. It has structure and prescriptions
but never assignments and never overrides.

- **Fydr standard templates** have `org_id = null` and are read-only. Using one copies it into
  the organisation. There is a small set shipped with the product: 12-week pre-season, 8-week
  in-season maintenance, 6-week return to play, 4-week deload, 3-day full body, upper/lower
  split.
- **Club templates** are org-owned and editable in the builder like any other programme.
- **Use count** is `count(programmes.parent_id = template.id)`, including archived children,
  so a coach can see which templates the club actually uses.
- **Preview** renders the structure read-only in a sheet, without creating anything. A coach
  should not have to create a programme to find out whether a template is what they wanted.
- **Deleting a template** is soft and is blocked while live programmes reference it, because
  `parent_id` is the provenance trail.

> **Assumption**: templates do not carry a version. Editing a template does not affect
> programmes created from it. This is the simple behaviour and matches how coaches describe
> templates. Versioned templates with a pull-changes action is the copy-plus-merge model
> ADR-006 rejected, one level up. See O-262.

### Sorting and searching

| Sort | Default direction | Note |
|---|---|---|
| Start date | Newest first | Default |
| Name | A to Z | |
| Athletes assigned | Most first | |
| Adherence | Lowest first | The exceptions-first ordering from design principle 1 |
| Ending soonest | Soonest first | Drives the dashboard card of the same name |
| Tailoring count | Most first | Finds the programme that has drifted furthest from its parent |

Search matches programme name, goal, block name and exercise name. Exercise-name matching is
what makes the search useful: "which programme has Nordic curls in it" is a real question and
is otherwise unanswerable.

### The divergence badge

An unacknowledged `programme_change_events` row renders a `FlagBadge` on the card. Pressing it
deep-links to the builder's Divergence tab, `fydr://programme/<id>/divergence`. It does not
open a summary here, because acting on divergence needs the parent and resolved values side by
side, which is the builder's job.

### Row actions summary

| Action | Coach | Medical | Confirmation |
|---|---|---|---|
| Edit | Yes | Rehab only | No |
| Assign athletes | Yes | Rehab only | No |
| View divergence | Yes | Yes | No |
| Duplicate | Yes | Rehab only | States that overrides and assignments are not copied |
| Save as template | Yes | Rehab only | No |
| Export CSV | Yes | Yes | No, but audited per `exports.md` |
| Archive | Yes | Rehab only | Yes, as above |
| Restore | Yes | Rehab only | States that assignments are not restored |
| Publish draft | Yes | Rehab only | Runs builder validation first |

---

## Validation rules

| Rule | Severity | Message |
|---|---|---|
| Programme name 1 to 80 characters | Block | "Give the programme a name." |
| Name unique per org among non-archived, non-deleted programmes | Block | "A programme called 'Pre-season Strength 2026' already exists. Archived programmes may reuse the name." |
| Duplicate name auto-suffix | Auto | " (copy)", then " (copy 2)" |
| `duration_weeks` 1 to 52 | Block | "A programme runs from 1 to 52 weeks." |
| Archive a programme with active assignments | Warn, in the `ConfirmSheet` | "38 athletes stop receiving this programme from today." |
| Archive the only active programme for an athlete | Warn, names them | "4 athletes will have no gym programme." |
| Delete a template referenced by a live programme | Block | "3 programmes were created from this template. Archive it instead." |
| Publish with zero exercises | Block | "This programme has no exercises." |
| Publish with zero assignments | Warn | "Nobody is assigned. Publish anyway?" |
| Restore into a name collision | Block | "A live programme already uses this name. Rename before restoring." |
| Save as template with unresolved `percent_1rm` links | Warn | "2 exercises use % of 1RM with no linked test. The template will carry that gap." |

---

## Edge cases

1. **A programme assigned to a group whose membership changes.** Counts are computed live from
   `group_memberships` with `removed_at is null`, so the number on the card moves without any
   action on this screen. An athlete added to Forwards today appears in tomorrow's count and
   receives the programme.
2. **An athlete on two active gym programmes.** Permitted, warned at assignment. The By
   athlete view shows both rows. Adherence is computed per programme, and the athlete's total
   gym load is the sum, which is exactly the situation the warning exists to make visible.
3. **A suspended assignment.** Rendered in the By athlete view as a second, muted row with
   "suspended: rehab" and excluded from the assigned count on the card. Folding suspended
   athletes into the headline count tells a coach 38 athletes are training when 35 are.
4. **A programme whose end date has passed but whose status is still `active`.** Rendered with
   an "ended 12 days ago" chip and surfaced at the top of the "Ending soonest" sort. A nightly
   job does not auto-archive it, because auto-archiving a programme a coach intends to extend
   is worse than a stale chip. See O-264.
5. **A draft older than 60 days with no assignments.** Rendered with a "draft, untouched since
   3 Jun" caption. Not deleted, not hidden.
6. **Group filter set to a group with no programme assignments.** `noResults` state naming the
   filter, per §11.2. This is the single most common cause of "the app is broken" and the copy
   names the active filter for that reason.
7. **A Fydr standard template used by a club that then edits its copy heavily.** The
   `parent_id` link stays, the use count stays, and nothing propagates. The card shows "from
   Fydr standard: 12-week Pre-season" as provenance only.
8. **Archiving a programme that has unacknowledged divergence events.** Permitted. The events
   remain and are visible if the programme is restored. The `ConfirmSheet` mentions the count.
9. **A programme with 60 assigned athletes and 12 weeks of history.** The adherence query is
   the expensive one on this screen. It is served from `mv_daily_athlete_summary` where
   possible, and the raw query above is the definition rather than the runtime path. See
   Performance notes.
10. **Two coaches archiving the same programme simultaneously.** The second archive is a no-op
    and shows "Already archived by Sam Rees." rather than an error.
11. **An athlete who left the club mid-programme.** Excluded from counts by
    `athletes.status <> 'left_club'`, retained in historical adherence, and their overrides are
    left in place because deleting them would alter the historical record.
12. **A rehab programme appearing here.** It does not. This screen filters
    `programme_type = 'gym'`. A gym programme suspended by rehab is shown with its suspension
    reason, which is the correct cross-reference.

---

## Performance notes

| Path | Budget |
|---|---|
| Programme list, 30 programmes | 300 ms p95 server |
| Adherence panel, all active programmes | 500 ms p95 server, loaded in a second pass |
| By athlete view, 60 athletes | 400 ms p95 server |

Rules:

1. **Adherence comes from a materialised view.** Add `mv_programme_adherence` to the set in
   `04-data-model.md` §12, refreshed by `refresh_analytics_views` nightly and on demand after
   a bulk gym log import. Columns: `programme_id`, `athlete_id`, `iso_week`,
   `prescribed_sessions`, `completed_sessions`. The raw query above is its definition. A live
   scan of `gym_session_logs` across a season for the list screen is a bug.
2. **Two-pass load.** The list query returns fast and renders. Adherence and sparklines arrive
   in a second query keyed separately, so the screen is interactive before the expensive
   number lands.
3. **Counts are computed in SQL, not in the client.** Fetching every assignment row to count
   distinct athletes in JavaScript is the obvious wrong implementation at 38 athletes and the
   catastrophic one at 60 athletes across 30 programmes.
4. **Query keys**: `qk.programme.list(orgId, type, status, groupIds)`,
   `qk.programme.adherence(orgId, programmeIds, days)`,
   `qk.programme.byAthlete(orgId, groupIds)`,
   `qk.programme.templates(orgId)`,
   `qk.programme.unassigned(orgId, groupIds)`.
   Group id arrays sorted before entering the key, per `05-architecture.md` §9 rule 2.
5. **Freshness**: list `staleTime` 60 s, templates 24 h, adherence 15 min. Templates are
   effectively static and are persisted.
6. **Invalidation**: archive, restore, assign, unassign and publish invalidate
   `qk.programme.list` and `qk.programme.byAthlete`. Duplicating invalidates the list only.
   Nothing on this screen invalidates the resolved-programme cache, because nothing here
   changes a prescription.
7. **The unassigned-athletes footer** is a separate cheap query with a 5-minute `staleTime`.
   It is not folded into the list query, because it is squad-scoped and the list is
   programme-scoped.
8. **Indexes**: `programme_assignments (programme_id, status)`,
   `programme_assignments (athlete_id, status) where status = 'active'`,
   `programmes (org_id, programme_type, status) where deleted_at is null`.
9. **Search** is client-side over the loaded list for name and goal, and server-side for
   exercise-name matching, which requires a join and is debounced at 300 ms with a minimum of
   3 characters.

---

## Accessibility

1. **Cards are links, not click-handlers on a div.** Each `ProgrammeCard` has a single primary
   activation target reading "Pre-season Strength 2026, active, week 6 of 12, 38 athletes
   assigned, 6 tailored, adherence 82 percent, 1 unacknowledged divergence notice".
2. **The `⋯` menu** is a proper menu with roving focus, `Escape` to close, and focus returned
   to the trigger.
3. **Progress bars** carry `role="progressbar"` with `aria-valuenow`, `aria-valuemin`,
   `aria-valuemax` and a text equivalent "week 6 of 12" adjacent, never the bar alone.
4. **Status is not colour alone** per §1.4. Every status is a text chip: Active, Draft,
   Archived, Suspended.
5. **The divergence badge** carries a text label in its accessible name: "1 unacknowledged
   divergence notice", not "1".
6. **The By athlete table** is a real table with a caption, column headers with scope, and a
   summary row announced as such.
7. **Sparklines** have a text alternative in their accessible name: "Adherence by week: 64, 71,
   58, 79, 82, 80, 82 percent" and a long-press "View as table" action per §8.6.
8. **Tab counts** are inside the tab's accessible name: "Active, 4 programmes", so a screen
   reader user is not told just "Active".
9. **Touch targets** 44 pt minimum, including the `⋯` trigger and the group chips.
10. **Dynamic type** to 200%. Cards grow vertically. The By athlete table reflows to stacked
    cards above 150%.
11. **Search results** announce their count in a polite live region: "6 programmes match".

---

## Open questions

- **O-260**: Should medical hold read access to gym programmes on this screen? I have
  specified yes, read-only, on the grounds that a physio returning an athlete needs to see
  what they are returning to. The inventory in `02-information-architecture.md` §5 lists this
  screen as coach-only, so this is a deliberate deviation that needs confirming.
- **O-261**: Should archiving a programme notify the assigned athletes? Currently no. An
  athlete whose Programme tab empties overnight with no explanation is a support call, but a
  push saying "your programme has ended" with nothing to replace it is worse. The likely right
  answer is to notify only when a replacement is assigned.
- **O-262**: Do templates need versioning, so that editing a template can offer to update
  programmes built from it? I have said no, because it is the copy-plus-merge model ADR-006
  rejected. Confirm that a template is a one-time seed.
- **O-263**: The adherence match window is `± 2 days` between a prescribed session date and a
  logged session. Is that the right tolerance for how these squads actually train? It directly
  sets every adherence number in the product.
- **O-264**: Should a programme whose end date has passed auto-archive? Currently no, it gets
  an "ended" chip. Auto-archiving is tidier and will occasionally remove a programme a coach
  was about to extend.
- **O-265**: Should there be a squad-wide "programme coverage" view showing every athlete and
  their current gym, nutrition and rehab programme in one grid? It is the natural extension of
  the By athlete view across domains, and it may belong on `squad-status.md` instead of here.
