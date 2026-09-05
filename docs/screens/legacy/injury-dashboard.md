> **This file is not the specification.**
>
> It predates the build specification written on 4 September 2026 and is kept for
> its reasoning, not its instructions. Parts of it describe behaviour that has
> since been deliberately changed, and following it would rebuild things that were
> removed on purpose.
>
> **The binding specification for this screen is in `docs/screens/`, in the
> numbered files.** See `docs/screens/legacy/README.md` for how the two relate.

# Screen: Injury dashboard

> **Layout status**: provisional. Awaiting client design photographs.

Screen 12 in the inventory (`02-information-architecture.md` §5). Route
`/staff/injury-dashboard`. Reached from the Dashboard tab. Drawn on the original navigation map
as `Dashboard → Injury dash → Corner group allocation`, and the client has confirmed that the
"corner group allocation" leaf means **team allocation**, specified in `team-allocation.md`
(screen 14). See `02-information-architecture.md` §1 note 4.

---

## Purpose

The availability board for the whole squad: who is available, who is modified, who is
unavailable, what they are restricted from, and when they are expected back.

This screen is read by two roles with materially different needs and materially different
permissions, and the difference is not cosmetic. A coach reads it to plan a session. A physio
reads it to run a caseload. They see different columns because they are legally entitled to
different columns, and this document specifies both explicitly rather than describing one screen
with things hidden.

Four jobs:

1. Show current availability for the filtered squad, sorted so the unavailable are first.
2. Show expected return dates on a timeline, so a coach can see who is back for which fixture.
3. For medical, show caseload state: who needs review, whose expected return has slipped.
4. Provide the entry point to team allocation (`team-allocation.md`), which is the leaf the
   navigation map draws off this screen, and a secondary entry point to rehabilitation
   grouping (`rehab-groups.md`), which is medical-owned.

Clubs print this screen and pin it in the physio room
(`06-design-system.md` §4.2), which is why the availability glyphs are distinguishable by fill
proportion in greyscale and why the print layout is a specified requirement rather than an
afterthought.

---

## Roles and access

| Role | Access |
|---|---|
| Coach / S&C | Availability level. Body area, side, status, restrictions, expected return, non-clinical note. Never diagnosis, mechanism, severity, imaging, referral, clinical notes, or treatment plan. |
| Medical / Physio | Everything a coach sees, plus clinical columns, caseload state, and edit affordances for availability and injury records. |
| Athlete | No access. An athlete sees their own availability on the Today tab and in `my-data.md`. |
| Admin | Aggregate only: counts by status, no names. Per `01-roles-and-permissions.md` §2, admin has `A` on "View injury, availability level". Renders as a small summary panel with the copy "Individual athlete detail is visible to coaching and medical staff." |

**Group filter**: mandatory.

**The clinical boundary is the defining constraint of this screen.** It is implemented by two
separate queries against two separate tables with two separate RLS policies, not by one query
whose columns are filtered in the client. See
`decisions/adr-007-clinical-data-separation.md`.

---

## The two views, stated explicitly

### Column comparison

| Column | Source | Coach | Medical | Athlete (own record) |
|---|---|---|---|---|
| Athlete name, squad number | `athletes` | Yes | Yes | n/a |
| Availability status | `availability.status` | Yes | Yes | Yes |
| Reason category | `availability.reason_category` | Yes | Yes | Yes |
| Restrictions | `availability.restrictions` | Yes | Yes | Yes |
| Non-clinical note | `availability.note` | Yes | Yes | Yes |
| Body area | `injuries.body_area` | Yes | Yes | Yes |
| Side | `injuries.side` | Yes | Yes | Yes |
| Onset date | `injuries.onset_date` | Yes | Yes | Yes |
| Days out | derived from `onset_date` | Yes | Yes | Yes |
| Injury status | `injuries.status` | Yes | Yes | Yes |
| Expected return | `injuries.expected_return` | Yes | Yes | Yes |
| Occurred in | `injuries.occurred_in` | Yes | Yes | Yes |
| Rehab group | `rehab_assignments.rehab_group_id` | Yes | Yes | Yes |
| Rehab phase | `rehab_assignments.phase` | Yes | Yes | Yes |
| **Diagnosis** | `injury_clinical.diagnosis` | **No** | Yes | Yes |
| **Mechanism** | `injury_clinical.mechanism` | **No** | Yes | Yes |
| **Clinical severity** | `injury_clinical.severity` | **No** | Yes | Yes |
| **Tissue type** | `injury_clinical.tissue_type` | **No** | Yes | Yes |
| **Imaging** | `injury_clinical.imaging` | **No** | Yes | Yes |
| **Referral** | `injury_clinical.referral` | **No** | Yes | Yes |
| **Clinical notes** | `injury_clinical.clinical_notes` | **No** | Yes | **No** |
| **Treatment plan** | `injury_clinical.treatment_plan` | **No** | Yes | Partial |
| Days since clinical update | derived from `injury_clinical.updated_at` | **No** | Yes | No |
| Return slippage | derived, `expected_return` history | No | Yes | No |
| Rehab compliance | `gym_session_logs` against rehab programme | Summary only | Full | Own |

The rows in bold are the ones that make this two screens rather than one screen with a
permission flag.

### What a coach must be able to conclude

"A. Byrne is modified, hamstring, no sprinting, expected back Friday. I will put her in the
skills group and not the speed group."

### What a coach must not be able to conclude

Anything about grade, tissue, imaging, prognosis basis, or the physio's opinion. If a coach can
work out the diagnosis from what is on screen, the screen has failed the Article 9 test in
`09-security-and-compliance.md` §3, and "they could probably guess" is not a defence.

**Consequence for design**: the coach view does not show a clinical severity proxy of any kind.
It does not show "days out" colour-coded to a severity scale, it does not show an injury title,
and it does not show a free-text field that a physio might fill with clinical language. The one
free-text field a coach sees is `availability.note`, which is documented as non-clinical and
coach-visible by design, and the availability editor labels it as such at the point of writing.

### Audit

The coach view writes no audit event. Reading availability is ordinary operation.

The medical view **does**, but not on this screen. Clinical columns on the board are limited to
`severity` and `diagnosis`, and both are read through the audited RPC. See Data requirements
and O-267, which asks whether the board should show clinical columns at all given that each read
is an audit row.

---

## Entry points

| From | Trigger | Context |
|---|---|---|
| Dashboard, availability block | "Open injury dashboard" | Group filter |
| Dashboard, an availability row | Tap | Athlete pre-selected |
| Staff sidebar or tab bar | Direct | Group filter |
| Squad status, availability column | Tap | Athlete pre-selected |
| Push `staff.availability.changed` | Tap | `/staff/athletes/{id}/availability`, which opens the athlete profile; the board is reachable from there |
| Athlete profile, injury tab | "See whole squad" | Group filter |
| Rehab groups | Back | Scroll position, view mode |

---

## Problem reports, medical only

Specified from the running app, not from the drawing. The staff web build renders a **Problem
reports** section above the board on this screen, for medical staff only. It is the triage inbox
for what an athlete sends through Today's "Something not right?" card and Me's "Report a problem"
row (`screens/today.md`, `03-flows.md` §6, migration `0040_problem_reports.sql`). It is on this
screen because this is where the physio already stands; it is not a separate navigation
destination.

**Access.** Medical only, for every part of it: the section, its count badge, the report bodies,
and the notes below. A coach and an admin see no section at all — not an empty one, not a count.
That is `problem_reports`' own RLS, not a UI decision: the athlete capability that files a report
is worded "to medical staff" (`01-roles-and-permissions.md` §1) and the flow notifies Medical
alone. The athlete reads their own report and its status back, and nothing else about it.

**Per report**: the athlete's name, a status pill (Not yet seen / Acknowledged), the timestamp,
the optional category, and the athlete's own words, which are immutable. Actions are
`Acknowledge`, `+ Note` and `Close`; a report walks open → acknowledged → closed, or straight to
closed for a duplicate or a mis-tap. There is no reopen — the athlete files a new report.

### Notes on a report

Medical can record notes against any athlete's report: what was done about it, who was called,
what happens next. Behaviour, all of it enforced in the database rather than in the UI
(migration `0055_problem_report_notes.sql`):

| Rule | Where it lives |
|---|---|
| **Medical only, read and write.** Not the coach, not the admin, and **not the reporting athlete** — an athlete cannot read notes written on their own report. | `problem_report_notes_medical_select`, the only select policy on the table |
| Notes are **appended, never edited or deleted**. A correction is a new note. The UI offers no edit affordance because no role has an update path. | No update or delete policy, and no update or delete grant to `authenticated` |
| A note is stamped with the medic who wrote it, and shows as *author · timestamp*. A medic cannot file one in another person's name. | `created_by = auth_user_id()` in the insert policy's `WITH CHECK` |
| Bounded at 1000 characters, same as the report body it annotates. | Check constraint; the textarea stops at the same number |
| Org-scoped in both directions, including a note appended to another organisation's report id. | `org_id = auth_org_id()` plus the parent-report `exists()` guard |

**Why a separate table rather than a column on `problem_reports`.** `problem_reports` grants the
reporting athlete a select on their own row, deliberately — seeing the status is the trust loop
the athlete-side screen exists to close. RLS is row-level, so a note column on that table would
be readable by the athlete it is written about through one direct column select, whatever the
staff UI chose to render. The split is structural, the same way `injuries` and `injury_clinical`
are split (`CLAUDE.md` rule 3, `decisions/adr-007-clinical-data-separation.md`).

**Not to be confused with the flag note.** `screens/flags.md`'s "+ Note for athlete" is
athlete-facing by design and appears on the athlete's own flag notice. These notes are the
opposite: medical-only, never shown to the athlete. The note composer says so at the point of
writing, which is the same principle the non-clinical availability note follows above.

**Not a clinical record.** Per `CLAUDE.md` §7, this is a triage trail against one athlete
statement. Diagnosis and treatment belong in `injury_clinical`, reached through
`injury-record.md`, where the read is audited.

---

## Layout

**Assumption, pending client design photographs.** Two view modes, board and timeline, with
board as the default. The drawing shows "Injury dash" and nothing about its form. The timeline
is my addition and it is the part most likely to be cut: it earns its place only if clubs
actually plan around return dates, which O-269 asks.

### Mobile, board view, `md` 390 pt

```
┌────────────────────────────────────────────────┐
│ ‹  Injury dashboard  [All squad ▾]      ⚙︎    │ 56 sticky
├────────────────────────────────────────────────┤
│  [ Board ]  Timeline           31 athletes     │ 44 toggle
│  ┌──────────────────────────────────────────┐  │
│  │  ● 26 available  ◑ 3 modified  ○ 2 unav. │  │ 56 summary
│  └──────────────────────────────────────────┘  │
│  [ Rehab groups ▸ ]                            │ 48 entry point
├────────────────────────────────────────────────┤
│  UNAVAILABLE (2)                               │
│  ┌──────────────────────────────────────────┐  │
│  │ ○ M. Nowak      #21              48 days │  │ 96 pt row
│  │   Ankle, right · Injury                  │  │
│  │   No loading, no running                 │  │
│  │   Back 22 Aug  (17 days)      Rehab B    │  │
│  ├──────────────────────────────────────────┤  │
│  │ ○ J. Adeyemi    #5                9 days │  │
│  │   Shoulder, left · Injury                │  │
│  │   No contact, upper body only            │  │
│  │   No return date set          ⚠ Review   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  MODIFIED (3)                                  │
│  ┌──────────────────────────────────────────┐  │
│  │ ◑ A. Byrne      #14              4 days  │  │
│  │   Hamstring, left · Injury               │  │
│  │   No sprinting                           │  │
│  │   Back Fri 8 Aug  (3 days)    Rehab A    │  │
│  ├──────────────────────────────────────────┤  │
│  │ ◑ K. Reilly     #9                       │  │
│  │   Load management                        │  │
│  │   Reduced volume                         │  │
│  │   Review Thu 7 Aug                       │  │
│  ├──────────────────────────────────────────┤  │
│  │ ◑ P. Sowande    #27               2 days │  │
│  │   Illness                                │  │
│  │   Back Wed 6 Aug  (1 day)                │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  AVAILABLE (26)                          ⌄     │ collapsed
└────────────────────────────────────────────────┘
```

Available athletes are collapsed by default. On a board whose purpose is who is not fit, listing
26 fit athletes first is the wrong order. They are one tap away, not hidden.

### Mobile, timeline view

```
┌────────────────────────────────────────────────┐
│  Board  [ Timeline ]        Next 6 weeks       │
├──────────────┬─────────────────────────────────┤
│              │ Aug          Sep                │
│              │ 5  12  19  26  2   9            │
│              │ │   │   │   │   │   │           │
│              │ ⚑       ⚑       ⚑   ⚑           │ fixtures
├──────────────┼─────────────────────────────────┤
│ ○ Nowak M    │ ████████████▶                   │
│   Ankle      │            ↑ 22 Aug             │
├──────────────┼─────────────────────────────────┤
│ ○ Adeyemi J  │ ██████?????????                 │
│   Shoulder   │        no date set              │
├──────────────┼─────────────────────────────────┤
│ ◑ Byrne A    │ ███▶                            │
│   Hamstring  │    ↑ 8 Aug                      │
├──────────────┼─────────────────────────────────┤
│ ◑ Sowande P  │ █▶                              │
│   Illness    │  ↑ 6 Aug                        │
└──────────────┴─────────────────────────────────┘
   ⚑ fixture   █ out   ? no date   ▶ expected return
```

The fixture markers are the point of the timeline. "Is he back for the cup tie" is the question,
and answering it by mentally comparing a date column against a fixture list is exactly the
manual join Fydr exists to remove.

### Web, `xl` 1280 px, coach view

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │ [All squad ▾]                          Tue 5 Aug · MD-4          ⚙︎ │
│ Fydr   ├──────────────────────────────────────────────────────────────────────┤
│        │  Injury dashboard   [ Board | Timeline ]   [Rehab groups]  ⎙  ⤓     │
│ ▣ Dash │  ● 26 available   ◑ 3 modified   ○ 2 unavailable        31 athletes  │
│  · Sqd │ ┌──────────────────────────────────────────────────────────────────┐ │
│  · Flg │ │ Athlete      Status  Area      Restrictions   Since  Return  Grp │ │
│  · Tmt │ ├──────────────────────────────────────────────────────────────────┤ │
│  · Inj │ │ ○ Nowak M    Unavail Ankle R   No loading,    48d    22 Aug  B   │ │
│ ▤ Sched│ │                                no running                        │ │
│ ▧ Squad│ │ ○ Adeyemi J  Unavail Shoulder  No contact,     9d    none ⚠, │ │
│ ▨ Prog │ │                      L         upper only                        │ │
│ ⋯ More │ │ ◑ Byrne A    Modified Hamstring No sprinting   4d    8 Aug   A   │ │
│        │ │                       L                                          │ │
│        │ │ ◑ Reilly K   Modified, Reduced volume, rev 7Aug, │ │
│        │ │ ◑ Sowande P  Modified, -               2d    6 Aug, │ │
│        │ ├──────────────────────────────────────────────────────────────────┤ │
│        │ │ ▸ Available (26)                                                 │ │
│        │ └──────────────────────────────────────────────────────────────────┘ │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

### Web, `xl` 1280 px, medical view

The medical view adds four columns and a caseload panel. It is visually the same board so that a
physio and a coach can stand at one screen and talk about the same rows, and the additional
columns are grouped to the right under a header that says plainly what they are.

```
┌────────┬──────────────────────────────────────────────────────────────────────┐
│        │  Injury dashboard   [ Board | Timeline ]  [Rehab groups] [+ Injury]  │
│ ▣ Dash │  ● 26  ◑ 3  ○ 2      Caseload: 5 open · 2 need review · 1 slipped    │
│  · Inj │ ┌──────────────────────────────────────────────────────────────────┐ │
│        │ │              SHARED                    │  MEDICAL ONLY 🔒        │ │
│        │ │ Athlete   Status Area  Restr  Return   │ Diagnosis  Sev  Updated │ │
│        │ ├────────────────────────────────────────┼─────────────────────────┤ │
│        │ │ ○ Nowak M Unav  AnkleR No ld  22 Aug   │ Grade 2 ATFL  Mod  2d   │ │
│        │ │ ○ Adeye J Unav  ShldrL No con none ⚠   │ AC joint sp.  Mod  9d ⚠ │ │
│        │ │ ◑ Byrne A Mod   HamsL  No spr 8 Aug    │ Grade 1 BFLH  Min  1d   │ │
│        │ │ ◑ Reilly  Mod, Red vol rev 7   │, -, │ │
│        │ └────────────────────────────────────────┴─────────────────────────┘ │
│        │  🔒 Clinical columns. Every read is recorded in the audit log.       │
└────────┴──────────────────────────────────────────────────────────────────────┘
```

The lock glyph and the footnote are not decoration. A physio needs to know, without being told
twice, which part of the screen a coach standing beside them can also see. The visual division
is the mechanism by which the professional boundary survives a shared monitor.

The medical column group is **collapsed by default** and expands on an explicit action, which is
also the action that triggers the audited read. See O-267.

---

## Components

| Component | Source | Purpose |
|---|---|---|
| `GroupFilter` | `06-design-system.md` §6.7 | Header |
| `AvailabilityPill` | §6.5 | Status per row. `editable` for medical. |
| `AthleteCard` | §6.1 | Mobile rows |
| `EmptyState` | §6.16 | `allClear` for a fully fit squad |
| `ConfirmSheet` | §6.18 | Setting availability to unavailable, clearing an athlete |
| `BottomSheet` | §6.19 | Availability editor on mobile |
| `MetricTile` | §6.2 | Summary counts |
| `AvailabilityRow` | **New**, this screen | Board row, coach variant |
| `ClinicalColumnGroup` | **New**, this screen | Medical-only column group with the lock affordance and the audited fetch |
| `ReturnTimeline` | **New**, this screen | Timeline view with fixture markers |

### `ClinicalColumnGroup`

```ts
export type ClinicalColumnGroupProps = {
  injuryIds: string[];
  /** Collapsed by default. Expanding triggers the audited RPC. */
  expanded: boolean;
  onExpand: () => void;
  /** Only ever populated after an audited read. Never prefetched. */
  data: Record<string, ClinicalSummary> | undefined;
  loading: boolean;
  error: boolean;
};

export type ClinicalSummary = {
  injuryId: string;
  diagnosis: string | null;
  severity: InjurySeverity | null;
  updatedAt: string | null;
};
```

Rules, all of which are enforceable in review:

- The component is rendered **only** when `auth_roles()` contains `medical`. A client-side role
  check hides it; RLS is what actually protects it (`CLAUDE.md` §2 rule 2).
- It never prefetches. Expanding is a deliberate act and the audit row records a deliberate act.
  A prefetch on hover would fill the audit log with reads nobody made.
- It never renders `clinical_notes` or `treatment_plan`. Those are on `injury-record.md`, one
  record at a time, where the read is unambiguous.
- A lint rule bans `.from('injury_clinical')` in application code
  (`decisions/adr-007-clinical-data-separation.md`). This component calls
  `read_injury_clinical_batch`, specified below.

---

## Data requirements

### Coach query, non-clinical only

```sql
create or replace function public.availability_board(
  p_group_ids uuid[] default '{}'::uuid[],
  p_as_of     date   default current_date
)
returns table (
  athlete_id uuid, display_name text, squad_number int,
  availability_status availability_status,
  reason_category availability_reason,
  restrictions text[],
  availability_note text,
  availability_since timestamptz,
  injury_id uuid,
  body_area body_area, side body_side,
  onset_date date, days_out int,
  injury_status injury_status,
  expected_return date, days_to_return int, return_overdue boolean,
  occurred_in occurrence_context,
  rehab_group_id uuid, rehab_group_name text, rehab_phase text
)
language sql security invoker stable
as $$
with scoped as (
  select a.id, a.first_name, a.last_name, a.squad_number
  from athletes a
  where a.org_id = auth_org_id()
    and a.deleted_at is null
    and a.status <> 'left_club'
    and (cardinality(p_group_ids) = 0 or exists (
          select 1 from group_memberships gm
          where gm.athlete_id = a.id
            and gm.group_id = any (p_group_ids)
            and gm.removed_at is null))
),
avail as (
  select distinct on (av.athlete_id)
         av.athlete_id, av.status, av.reason_category, av.restrictions,
         av.note, av.effective_from, av.injury_id
  from availability av
  join scoped s on s.id = av.athlete_id
  where av.org_id = auth_org_id()
    and av.effective_from <= (p_as_of + 1)::timestamptz
    and (av.effective_to is null or av.effective_to > p_as_of::timestamptz)
  order by av.athlete_id, av.effective_from desc
),
rehab as (
  select distinct on (ra.athlete_id)
         ra.athlete_id, ra.rehab_group_id, ra.phase, g.name as group_name
  from rehab_assignments ra
  left join groups g on g.id = ra.rehab_group_id
  where ra.org_id = auth_org_id()
    and ra.starts_on <= p_as_of
    and (ra.ends_on is null or ra.ends_on >= p_as_of)
  order by ra.athlete_id, ra.starts_on desc
)
select
  s.id,
  left(s.first_name,1) || '. ' || s.last_name,
  s.squad_number,
  coalesce(av.status, 'available')::availability_status,
  av.reason_category,
  av.restrictions,
  av.note,
  av.effective_from,
  i.id,
  i.body_area, i.side,
  i.onset_date,
  case when i.onset_date is not null
       then (p_as_of - i.onset_date)::int end,
  i.status,
  i.expected_return,
  case when i.expected_return is not null
       then (i.expected_return - p_as_of)::int end,
  (i.expected_return is not null and i.expected_return < p_as_of),
  i.occurred_in,
  r.rehab_group_id, r.group_name, r.phase
from scoped s
left join avail av on av.athlete_id = s.id
left join injuries i on i.id = av.injury_id
left join rehab r on r.athlete_id = s.id
order by
  case coalesce(av.status,'available')
    when 'unavailable' then 0 when 'modified' then 1 else 2 end,
  i.expected_return nulls first,
  s.last_name;
$$;
```

**`injury_clinical` is not referenced.** The function is `security invoker` so RLS applies, and
a coach calling it gets exactly these columns because these are the only columns it selects.

Note the ordering: within unavailable, athletes with **no** expected return sort first
(`nulls first`). An injury with no prognosis is the one a coach most needs to ask about.

### Medical clinical batch, audited

```sql
create or replace function public.read_injury_clinical_batch(p_injury_ids uuid[])
returns table (
  injury_id uuid,
  diagnosis text,
  severity injury_severity,
  updated_at timestamptz
)
language plpgsql
security invoker             -- RLS still applies. Grants nothing.
as $$
declare
  v_org uuid := auth_org_id();
begin
  -- One audit row per injury actually returned. A coach calling this
  -- gets zero rows from RLS and therefore writes zero audit rows.
  return query
  with visible as (
    select ic.injury_id, ic.diagnosis, ic.severity, ic.updated_at, ic.org_id
    from injury_clinical ic
    where ic.injury_id = any (p_injury_ids)
  ),
  logged as (
    insert into audit_log (org_id, actor_id, actor_role, action,
                           entity_type, entity_id, athlete_id, metadata)
    select v.org_id, auth_user_id(), 'medical'::app_role, 'injury_clinical.read'  -- caller is role-guarded upstream; see injury-record.md,
           'injury_clinical', v.injury_id, i.athlete_id,
           jsonb_build_object('via','batch','surface','injury_dashboard',
                              'batch_size', cardinality(p_injury_ids))
    from visible v
    join injuries i on i.id = v.injury_id
    returning 1
  )
  select v.injury_id, v.diagnosis, v.severity, v.updated_at from visible v;
end;
$$;
```

Three properties this must have and a reviewer must check:

1. It returns only `diagnosis`, `severity`, and `updated_at`. Not `clinical_notes`, not
   `treatment_plan`, not `mechanism`. Column selection here is convenience, and the security
   comes from RLS, but a batch endpoint returning the whole clinical row would be a needlessly
   large blast radius.
2. The audit insert is inside the same statement as the read, so a read cannot succeed while its
   audit row fails.
3. `metadata` carries the surface and the batch size, never the values read. Logging the
   diagnosis into the audit log creates a second, less-protected copy of the clinical data
   (`09-security-and-compliance.md` §8.5).

### Medical caseload query

Non-clinical derivations that medical needs and coaches do not.

```sql
select
  count(*) filter (where i.status <> 'closed')                       as open_cases,
  count(*) filter (where i.status <> 'closed'
                     and ic.updated_at < now() - interval '7 days')  as need_review,
  count(*) filter (where i.expected_return < current_date
                     and i.actual_return is null)                    as slipped,
  count(*) filter (where i.status = 'return_to_play')                as rtp
from injuries i
left join injury_clinical ic on ic.injury_id = i.id
where i.org_id = auth_org_id();
```

This one **does** join `injury_clinical`, for `updated_at` only, and it is therefore
medical-only by RLS. It returns counts, not rows, so it does not write per-injury audit entries.
Counting is not reading a record. If a compliance review disagrees with that position, the
alternative is to move `last_clinical_update_at` onto `injuries` as a non-clinical
denormalisation, which is defensible and is raised as O-268.

### Timeline query

```sql
select f.id, f.opponent, f.kickoff_at, f.home_away, f.importance
from fixtures f
where f.org_id = auth_org_id()
  and f.deleted_at is null
  and f.status = 'scheduled'
  and f.kickoff_at between now() and now() + interval '6 weeks'
order by f.kickoff_at;
```

Joined client-side with the board rows. Fixtures are not athlete data and the join is trivial.

### Query keys

```ts
injury: {
  all: (orgId: string) => [...qk.org(orgId), 'injury'] as const,
  board: (orgId: string, groupIds: string[], asOf: string) =>
    [...qk.injury.all(orgId), 'board', asOf, { groupIds: [...groupIds].sort() }] as const,
  caseload: (orgId: string) => [...qk.injury.all(orgId), 'caseload'] as const,
  clinicalBatch: (orgId: string, injuryIds: string[]) =>
    [...qk.injury.all(orgId), 'clinical-batch', { injuryIds: [...injuryIds].sort() }] as const,
  timeline: (orgId: string, weeks: number) =>
    [...qk.injury.all(orgId), 'timeline', weeks] as const,
},
```

`clinicalBatch` has `gcTime: 0` and `staleTime: 0`. It is **never persisted** to AsyncStorage.
Clinical data must not survive in a device cache after the screen closes, per
`09-security-and-compliance.md` §10.1. This requires an explicit exclusion in the query
persister's `shouldDehydrateQuery` predicate, keyed on the `'clinical-batch'` segment, and that
predicate deserves a test of its own.

---

## States

### Default

Board view, today, unavailable first, available collapsed. Medical additionally sees the
caseload summary and the collapsed clinical column group.

### Loading

Summary counts render as skeleton tiles. Five skeleton rows at 96 pt. The clinical column group
renders as a locked placeholder even before expansion, so its position is stable.

### Empty

| Condition | `kind` | Copy |
|---|---|---|
| Whole squad available | `allClear` | "Full squad available. No current restrictions." Renders in `status.available` colours. |
| Group filter excludes everyone | `noResults` | "No athletes in Forwards." Action: "Clear filter". |
| No athletes at all | `notStarted` | "No athletes yet." |
| Timeline, no fixtures in the window | `noData` | "No fixtures scheduled in the next 6 weeks." Timeline still renders return dates without fixture markers. |
| Medical, no open injuries but athletes are unavailable for other reasons | Not empty | The board renders; the caseload panel reads "No open injuries. 2 athletes unavailable for illness or personal reasons." |
| Admin | `noPermission` for the detail | "Individual athlete detail is visible to coaching and medical staff." The aggregate counts render above it. |

### Error

| Failure | Behaviour |
|---|---|
| Board query | Block error with retry. |
| Clinical batch | The medical column group renders "Clinical detail could not be loaded" with a retry. The shared columns are unaffected. A failed clinical read writes no audit row, correctly: nothing was read. |
| Caseload | Panel renders the error state. Board unaffected. |
| Timeline fixtures | Timeline renders return bars without fixture markers and captions "Fixtures could not be loaded." Never draws the timeline as though there are no fixtures. |
| Rehab group lookup | Group column renders `-` with a caption. |

### Offline

Board renders from cache with "Last updated 08:12" and an offline chip.

**The clinical column group does not render from cache at all.** It renders
`EmptyState kind="offline"` with the copy "Clinical detail is available online only." This is
deliberate: clinical data is not persisted to the device cache, so there is nothing to render,
and that is the correct behaviour rather than a limitation to work around.

Availability editing is disabled offline.

### Role-specific

Specified in full in "The two views" above. Summarised:

| Role | Board columns | Extra panels | Edit |
|---|---|---|---|
| Coach | Shared only | none | none |
| Medical | Shared plus clinical group, collapsed | Caseload summary | Availability, injury record, rehab assignment |
| Coach and medical | Medical view | Medical panels | Medical edits |
| Admin | Counts only | none | none |

---

## Interactions

| Action | Result |
|---|---|
| Toggle Board / Timeline | Switches view. Persisted per screen. |
| Tap a row | Coach: navigate to `athlete-profile.md`, injury tab. Medical: navigate to `injury-record.md` for the open injury, or to the athlete profile if there is no injury record. |
| Tap "Available (26)" | Expands. Persisted for the session. |
| Tap the availability pill (medical) | Opens the availability editor sheet: status, restrictions (multi-select plus free text), reason category, expected return, non-clinical note. Setting `unavailable` is behind a `ConfirmSheet` because it removes the athlete from every session plan. |
| Save availability (medical) | Writes a new `availability` row with `effective_from = now()` and closes the previous by setting `effective_to`. It is an event log, never an update (`04-data-model.md` §9). Writes an `availability.set` audit event. Notifies the athlete and coaching staff (`08-notifications.md` §4.3). |
| Expand the clinical column group (medical) | Calls `read_injury_clinical_batch` for the visible injuries. Writes one audit row per injury returned. A one-line notice appears the first time per session: "Clinical detail opened. This read is recorded." |
| Tap a clinical cell (medical) | Navigate to `injury-record.md` for that injury. |
| Tap "Team allocation" | Navigate to `team-allocation.md`, carrying the group filter and the current week. This is the drawn path off this screen. |
| Tap "Rehab groups" (medical) | Navigate to `rehab-groups.md`, carrying the group filter. |
| Tap "+ Injury" (medical) | Opens `injury-record.md` in create mode with an athlete picker. |
| Tap a fixture marker on the timeline | Shows opponent, date, and which athletes are expected back before it. |
| Tap a return bar | Same drill-down as a board row. |
| Tap "Print" (web) | Print stylesheet: shared columns only, no clinical columns, regardless of role. A printed sheet leaves the building and nobody controls who reads it. Medical who genuinely need a clinical printout use the medical report export on `injury-record.md`, which is audited as an export. |
| Tap "Export" | CSV of the current view. For medical, an explicit choice between "Availability only" and "Including clinical detail", the second writing an `export.run` audit event with `includes_clinical: true`. |
| Change group filter | Refetch. The clinical group collapses on filter change, so a new set of injuries is never read without a new deliberate expansion. |

---

## Validation rules

| Rule | Enforcement |
|---|---|
| Only medical may write availability linked to an injury | RLS on `availability` insert/update (migration 0012). A coach may write a non-injury row directly since ADR-008 (migration 0041); the injury-linked control still only renders for medical. |
| Availability is an event log | The previous open row is closed (`effective_to` set) and a new one inserted, as two statements rather than one transaction — see `setAvailability`'s own comment in `lib/queries/injuries.ts` for why this is a documented, accepted gap, not the atomic single-transaction this row used to claim. |
| An athlete has at most one open availability row | Partial unique index: `create unique index on availability (athlete_id) where effective_to is null`. This does not exist in `04-data-model.md` §15 and is required. Two open rows makes "current status" ambiguous and the dashboard's counts stop summing. |
| `expected_return` cannot precede `onset_date` | Check constraint on `injuries`. |
| Setting `unavailable` without a reason category is rejected | RPC-level. "Unavailable" with no reason is unreadable a month later. |
| Restrictions come from a controlled vocabulary plus free text | The vocabulary drives conflict detection in `timetable.md`. Free-text restrictions are permitted and simply never match a conflict rule. |
| The `note` field is labelled non-clinical at the point of writing | The editor's helper text reads "Visible to coaching staff. Do not record clinical detail here." This is a control, not a nicety: it is the one field where a physio could accidentally place clinical text in a coach-visible column. |
| No coach-facing query joins `injury_clinical` | Lint rule plus the mandatory RLS test asserting a coach reads zero rows from `injury_clinical` (`05-architecture.md` §12). |
| Clinical reads are audited | The batch RPC writes the audit row in the same statement as the read. A test asserts `count(audit_log where action='injury_clinical.read')` increases by exactly the number of rows returned. |
| Clinical data is not persisted to device storage | Query persister exclusion, with a test. |

---

## Edge cases

| Case | Handling |
|---|---|
| **Athlete unavailable for a non-injury reason** (illness, personal, suspension). | `availability.injury_id` is null. Body area, onset, and return columns render `-`. The reason category carries the meaning. No injury record exists and none should be created. |
| **Athlete has two open injuries.** | `availability.injury_id` points at one. The board shows that one and a "+1" chip; the athlete profile shows both. Medical's caseload counts both. |
| **Injury closed but availability still modified.** | Legitimate: an athlete returned to play with a lingering restriction. The row shows the restriction with the injury status "closed" and no days-out figure. |
| **`expected_return` in the past, athlete not yet back.** | Renders "Overdue, expected 1 Aug" in `compliance.pending` grey with an alert glyph. Medical's caseload counts it as slipped. Not red: an overdue return is normal and a red board teaches staff to ignore red. |
| **No expected return set.** | "No return date set" with a review glyph, sorted **first** among unavailable. This is the row a coach most needs to ask about and the row a physio most needs to update. |
| **Athlete becomes available mid-day.** | New `availability` row. The previous closes. The board refetches on the realtime event. History is intact: an end-of-season report can reconstruct every day of the season from the event log. |
| **Two physios edit availability simultaneously.** | Both inserts succeed, both close the prior row, and the partial unique index rejects the second open row. The second physio sees "Availability was changed by Dr Okoro at 11:04" and the current state. No silent overwrite. |
| **Coach and physio look at one monitor.** | The medical column group is collapsed by default and the lock glyph is visible. A physio can leave the board open in a shared office without exposing diagnoses. This is the reason for the collapse, not performance. |
| **A physio expands the clinical group 40 times in a day.** | 40 batch reads times the visible injuries, each an audit row. At a few hundred rows a month this is nothing (`decisions/adr-007`). If it becomes noisy, the answer is deduplicating audit rows within a session window, not logging less. |
| **An athlete leaves the club with an open injury.** | Excluded from the default board. Available under "Include former athletes" for medical only, because closing out a departed athlete's record is a medical task and retention obligations differ (`09-security-and-compliance.md` §7). |
| **Group filter set to a rehab group.** | Works exactly as any other group. This is the natural way a physio looks at their caseload and it is why rehab groups are ordinary `groups` rows with `group_type = 'rehab'`. |
| **Timeline window contains a postponed fixture.** | Postponed fixtures render in outline with a "postponed" label rather than disappearing. A return date planned around a fixture that moved is exactly the thing a physio needs to see. |
| **Athlete with an injury but no availability row.** | Data integrity fault: an injury should always have produced an availability change. The row renders with status "Not set" (`06-design-system.md` §6.5 empty state) and is logged at `warn`. Never rendered as available. |
| **Admin opens the screen.** | Aggregate counts only, `noPermission` for the list. Not a 403 and not an error: nothing has gone wrong (`06-design-system.md` §11.3). |

---

## Performance notes

| Concern | Approach |
|---|---|
| Board query | One RPC, one `distinct on` per athlete against a partial index that exists (`availability (athlete_id, effective_from desc) where effective_to is null`). At 40 athletes this is trivial. |
| The `as_of` variant | Passing a historical date defeats the partial index because it must consider closed rows. **Add** `create index on availability (athlete_id, effective_from desc, effective_to)`. Historical board views are infrequent, so this index is for correctness of plan, not for a hot path. |
| Clinical batch | Primary-key lookups on a table with at most a few thousand rows per organisation. The audit insert is the larger cost and it is one insert per row. Batched, so expanding the group is one round trip. |
| Never join clinical into the board query | Two queries, always. This is a security property, and it is also why the board is fast for coaches: they never pay for a join they cannot read. |
| Caseload | Aggregate over a small table. Cached 5 min. |
| Timeline | Fixtures for six weeks, at most a few dozen rows. Joined client-side. |
| Rendering | 40 rows, not virtualised. The timeline draws at most 10 bars and a dozen fixture markers as SVG, no animation on redraw. |
| Realtime | Subscribed to `availability` inserts filtered by `org_id`. Availability changes are rare and consequential, which is exactly the profile realtime suits. Clinical data is **not** subscribed: a realtime payload carrying a clinical row is the invisible leak identified in `decisions/adr-007`, alternative 1. |
| Print | Print stylesheet renders the shared columns at 9 pt with the glyph trio, one A4 portrait page for up to 45 athletes. |
| Budget | Board query 150 ms p95. Clinical batch 250 ms p95 including the audit write. Screen interactive 1.0 s p95. |

---

## Accessibility

| Requirement | Implementation |
|---|---|
| Heading structure | `h1` "Injury dashboard", `h2` per status section, `h3` "Clinical detail" on the medical group. |
| Row label, coach | "M. Nowak, 21. Unavailable, injury. Right ankle. No loading, no running. Out 48 days. Expected back 22 August, 17 days." |
| Row label, medical | The same, plus, when expanded: "Clinical: Grade 2 ATFL, moderate, updated 2 days ago." |
| Availability glyphs | Distinguishable by fill proportion and internal mark, per `06-design-system.md` §4.2. Verified in greyscale, because the board is printed. |
| Clinical group | `aria-expanded` on the control, `aria-controls` on the group. The control's accessible name is "Show clinical detail. This read is recorded in the audit log." The audit consequence is part of the label, not a visual footnote, because a screen reader user must know it before activating. |
| Timeline | Rendered as an accessible table alternative behind a "View as table" control, per the chart rule in `06-design-system.md` §8.6. The SVG itself carries a summary: "Return timeline. 4 athletes out. 3 expected back before the fixture on 16 August." |
| Overdue and no-date markers | Glyph plus text, never colour alone. "Overdue" and "No return date set" are words on the row. |
| Touch targets | Rows 96 pt on mobile. The availability pill inside a row is a nested target of 44 pt with 8 pt separation from the row's own press area, and on mobile the pill is not separately pressable for coaches, only for medical. |
| Dynamic type | At 200% the web table becomes a stacked card list, one athlete per card, with the clinical group as a labelled section. A 9-column table at 200% is not readable at any density. |
| Reduced motion | Section expand and collapse are instant. The timeline renders complete. |
| Focus, web | Tab order: view toggle, rehab groups, summary, section headers, rows, clinical group control. `Escape` collapses the clinical group, which is a useful panic control for a shared screen. |
| Live region | An availability change arriving by realtime announces "Availability updated: A. Byrne is now modified." Consequential and rare, so a full announcement is right here where it would be wrong on the flags list. |
| Print | Clinical columns never print. Enforced by the print stylesheet and by a test that renders the print view as medical and asserts no clinical text is present. |

---

## Open questions

- **O-266**: Board and timeline as two views is my recommendation. The drawing says only
  "Injury dash". If your designs show one form, the timeline is the one to cut, and the board is
  the one that cannot be cut.
- **O-267**: Should the medical board show clinical columns at all? Every expansion writes one
  audit row per injury, which is defensible but noisy, and the alternative is that a physio
  opens each record individually where the read is unambiguous. I have included a collapsed,
  deliberately-expanded, diagnosis-and-severity-only column group as the compromise. Confirm,
  because the stricter option (no clinical data on any multi-athlete screen) is also defensible
  and it is simpler.
- **O-268**: `last_clinical_update_at` on `injuries`. The medical caseload panel needs "days
  since clinical update", which currently requires joining `injury_clinical`. Denormalising a
  timestamp onto the non-clinical table would remove that join and let the caseload panel run
  without touching clinical data at all. A timestamp is not clinical content, but it does reveal
  that a clinical record exists, which is already visible from the injury row. I recommend the
  denormalisation. Confirm.
- **O-269**: Does anyone actually plan around the return timeline? It is the feature I am least
  confident in. If clubs work fixture by fixture rather than in six-week horizons, the timeline
  is decoration and the board plus the expected-return column is the whole product.
- **O-270**: Restriction vocabulary. The controlled list drives conflict warnings in
  `timetable.md`. I have assumed: no contact, no sprinting, no jumping, no loading, upper body
  only, lower body only, reduced volume, non-contact training only, individual work only. Your
  physio needs to own this list.
- **O-271**: Should coaching staff see how long an athlete has been out (`days_out`)? It is
  non-clinical and it is operationally essential, and it is also a strong proxy for severity. I
  have included it, on the basis that a coach can count days on a calendar anyway and hiding it
  would be security theatre. Confirm you agree, because the opposite position is arguable.

---

## Related documents

- Full clinical record → `injury-record.md`
- Rehab group allocation → `rehab-groups.md`
- Why the tables are separate → `decisions/adr-007-clinical-data-separation.md`
- Who sees what → `01-roles-and-permissions.md` §4
- Injury and availability schema → `04-data-model.md` §9
- Audit obligations → `09-security-and-compliance.md` §8.5
