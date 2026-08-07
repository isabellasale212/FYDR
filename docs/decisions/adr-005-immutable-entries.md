# ADR-005: Immutable entries with revisions

## Status

**ACCEPTED.** 2026-08. Already binding as `CLAUDE.md` §2 rule 6.

---

## Context

Fydr's value is the join across domains over time (`00-product-overview.md`). Every analysis
in the product is a time series: rolling wellness baselines, acute against chronic load,
compliance rates, correlation between wellness and gym output, and eventually the association
between loading patterns and soft-tissue injuries.

Time-series analysis rests on an assumption that is rarely stated: **the value recorded for a
past day is the value that was recorded on that day.** If a row can be edited in place, that
assumption is false, and nothing downstream can be trusted.

The concrete ways it goes wrong in this product:

1. **Personal rolling baselines.** `04-data-model.md` §10 makes `personal_rolling` the
   recommended default threshold type. An athlete who edits three weeks of sleep entries upward
   shifts their own baseline, and the thresholds calibrated against that baseline stop firing.
   The system goes quiet, which looks like everything being fine.
2. **Retrospective flag laundering.** A flag fires on Tuesday. On Friday the underlying entry
   is edited so the value no longer breaches. The flag now references a value that does not
   exist and the reason it fired is unrecoverable.
3. **Social pressure on athletes.** Wellness entries, and the weekly nutrition check-in, are personal and mildly
   embarrassing. An athlete who sleeps four hours and then finds out a coach is looking will
   edit it if they can. Editable self-report is not self-report, it is self-presentation.
4. **Disputes about what was known when.** "Did the physio know he reported hamstring soreness
   before the game?" is a question that gets asked after an injury, occasionally with a lawyer
   in the room. Editable rows cannot answer it.
5. **Analysis reproducibility.** A report run in March and again in June produces different
   numbers from the same query over the same period, with no explanation.

Corrections are nevertheless legitimate and common. An athlete taps 3 instead of 8 for sleep
hours. A coach records 60 kg for a set that was 80. Under UK GDPR, athletes also have a right
to rectification of inaccurate data. So the system must support correction without supporting
silent mutation.

---

## Decision

**Entries are immutable once submitted. A correction inserts a new row that references the row
it replaces. The original is retained and marked superseded. There are no `update` grants on
entry tables for any application role.**

The mechanism, already in the schema (`04-data-model.md` §5):

```sql
-- Every entry table carries both:
revision_of   uuid references <same_table>(id),   -- the row this corrects
superseded_by uuid references <same_table>(id)    -- the row that corrects this one
```

A correction is a single transaction:

```sql
create or replace function public.revise_wellness_entry(
  p_original_id uuid,
  p_new_id      uuid,          -- client-generated, so the operation is idempotent
  p_payload     jsonb
) returns uuid
language plpgsql
security invoker                -- runs as the caller, so RLS applies
as $$
declare
  v_new_id uuid;
begin
  insert into public.wellness_entries (
    id, org_id, athlete_id, entry_date,
    sleep_hours, sleep_quality, fatigue, soreness, soreness_areas,
    stress, mood, resting_hr, body_mass_kg, comment,
    source, submitted_at, revision_of, created_by
  )
  select
    p_new_id, o.org_id, o.athlete_id, o.entry_date,
    coalesce((p_payload->>'sleep_hours')::numeric,   o.sleep_hours),
    coalesce((p_payload->>'sleep_quality')::int,     o.sleep_quality),
    coalesce((p_payload->>'fatigue')::int,           o.fatigue),
    coalesce((p_payload->>'soreness')::int,          o.soreness),
    coalesce(array(select jsonb_array_elements_text(p_payload->'soreness_areas')), o.soreness_areas),
    coalesce((p_payload->>'stress')::int,            o.stress),
    coalesce((p_payload->>'mood')::int,              o.mood),
    coalesce((p_payload->>'resting_hr')::int,        o.resting_hr),
    coalesce((p_payload->>'body_mass_kg')::numeric,  o.body_mass_kg),
    coalesce( p_payload->>'comment',                 o.comment),
    o.source, now(), o.id, auth_user_id()
  from public.wellness_entries o
  where o.id = p_original_id
    and o.superseded_by is null          -- may only revise the current revision
  returning id into v_new_id;

  if v_new_id is null then
    raise exception 'entry_not_revisable' using errcode = 'P0001';
  end if;

  update public.wellness_entries
     set superseded_by = v_new_id
   where id = p_original_id;

  return v_new_id;
end;
$$;
```

Rules that go with it:

1. **Only the current revision may be revised.** Chains are linear. No branching.
2. **`entry_date`, `athlete_id`, and `org_id` are never changed by a revision.** An entry
   recorded against the wrong day is not corrected, it is superseded by a revision that zeroes
   its contribution and a new entry is created for the correct day. Allowing the date to move
   reintroduces exactly the retrospective rewriting this ADR prevents.
3. **Every read of "current" data filters `superseded_by is null`.** Enforced by querying views
   rather than base tables:

```sql
create view wellness_entries_current
with (security_invoker = true) as
  select * from public.wellness_entries
   where superseded_by is null;
```

4. **The `update` privilege is revoked** on entry tables for `authenticated`. The revision
   function is the only write path other than insert, and the `superseded_by` write happens
   inside it as `security invoker` under a policy permitting exactly that column change.
5. **Revisions are visible.** The athlete's history shows "edited" with a timestamp and offers
   the previous value. Hiding the revision would reintroduce the trust problem at the UI layer.
6. **The offline outbox has no `update` operation** (`05-architecture.md` §6). A correction made
   offline is an insert carrying `revision_of`, which is why sync has no update-ordering
   conflicts to resolve.

### What is not immutable

For clarity, because "everything is immutable" would be wrong and expensive:

| Mutable | Immutable |
|---|---|
| `athletes` profile fields | `wellness_entries` |
| `sessions`, `fixtures`, the schedule | `nutrition_checkins` (`nutrition_entries` is dormant, `CLAUDE.md` §2 rule 8) |
| `programmes` and their structure (see ADR-006) | `training_entries` |
| `thresholds` | `gym_session_logs`, `gym_set_logs` |
| `flags` status transitions | `test_results` (correction is a new row flagged as such) |
| `groups` and membership (history-preserving, `removed_at`) | `availability` (an event log, never updated) |
| `injuries` clinical fields (updated, with `audit_log` capture) | `audit_log` (append-only) |

The line is: **anything an athlete reports about a moment in time is immutable. Anything staff
plan for the future is editable.**

---

## Consequences

**Good:**

- Historical analysis is reproducible. The same query over the same window returns the same
  answer in June as it did in March.
- Rolling baselines cannot be retroactively shifted, so thresholds stay calibrated.
- A flag always references a value that genuinely existed at the moment it fired.
- Self-report stays honest, because it cannot be tidied up before someone looks.
- "What did we know, and when" is answerable from the data, which matters after an injury.
- Sync is dramatically simpler. No updates means no update conflicts (ADR-004).
- Provenance stays coherent: a `staff_entered` correction to a `self_report` entry keeps both
  rows with both sources, which the display rules in `03-flows.md` §7 depend on.

**Bad, and accepted:**

- **Every read must filter `superseded_by is null`.** A forgotten filter double-counts, which
  is a silent wrong answer rather than an error. Mitigated by making the `_current` views the
  default access path and treating a base-table read in application code as a review rejection.
- **Unique constraints get awkward.** `unique (athlete_id, entry_date)` is wrong, because a
  revision legitimately shares both. The schema uses
  `unique (athlete_id, entry_date, revision_of)`, which permits one original plus one revision
  per parent and blocks two originals for the same day. It is not obvious and deserves the
  comment it has in `04-data-model.md`.
- **Storage grows**, and it does not matter. An entry row is a few hundred bytes and the
  revision rate will be low single-digit percent. At 3,000 entries a day fleet-wide this is
  megabytes per year.
- **The UI has to explain itself.** An athlete taps edit and does not expect to create a
  revision. The screen says "your original entry is kept, coaches see the correction", in those
  words, because silently doing something different from what the button implies is worse than
  explaining it.
- **Erasure is slightly more work.** A GDPR erasure request must delete the whole revision
  chain, not just current rows. The erasure process walks `revision_of` in both directions.
- **Rectification versus retention.** A rectification request is satisfied by a revision, since
  the current value becomes correct. If a data subject demands the incorrect value be removed
  entirely rather than superseded, that is an erasure of that row and it breaks the chain. The
  process must handle it by nulling the `revision_of` pointer rather than leaving a dangling
  reference. Covered in `09-security-and-compliance.md`.
- **Bulk correction of an import is heavier.** Re-importing a corrected GPS file creates a
  revision per affected row rather than an update. Acceptable, and it means a bad import is
  fully recoverable rather than destructive.

---

## Alternatives considered

### 1. Mutable rows with an audit trigger writing to a history table

The conventional pattern: `update` freely, a trigger copies the old row into
`wellness_entries_history`.

Rejected, though it is close, and the reasons are specific rather than aesthetic.

| | Trigger history | Revision rows |
|---|---|---|
| Current-value query | Simplest. No filter needed. | Needs `superseded_by is null` |
| Historical query at a point in time | Union base and history with timestamp logic, per table | `where submitted_at <= t and (superseded_by is null or superseded_at > t)` over one table |
| Offline sync | Updates conflict and need ordering. Last-write-wins loses data. | Insert-only. No conflict class exists. |
| Foreign keys to a specific version | Impossible. A flag references a row whose contents changed. | A flag references an immutable row. |
| Can history be bypassed? | Yes, by `alter table disable trigger`, or by a bug in the trigger, silently | No. The absence of an `update` grant is the mechanism. |
| Provenance per version | Has to be reconstructed from history rows | Each row carries its own `source` and `created_by` |

The deciding factor is the fourth row. Flags, compliance matches, and analytics results all
reference entries. Under the trigger model those references point at a mutable row, so a flag's
`observed_value` and the entry it came from can disagree with no way to tell which is right.
Under the revision model the reference is to an immutable fact.

The second deciding factor is offline sync. Update-based history requires conflict resolution
over concurrent updates. Insert-only does not have that problem to solve.

### 2. Full event sourcing

Store an append-only event stream and project current state from it.

Rejected as disproportionate. It gives everything this decision gives, plus arbitrary temporal
replay, at the cost of projections, projection migrations, eventual consistency in the read
model, and a substantially harder debugging story. Fydr needs one property, not a paradigm. The
revision chain is event sourcing for the two tables that need it and nothing else.

### 3. `updated_at` plus a JSONB diff column

Update in place, keep a JSONB array of previous values on the row.

Rejected. Unqueryable, unindexable, and it grows unboundedly on a hot row. It also cannot
express provenance per version, which the mixed-source rules in `03-flows.md` §7 require. This
is the pattern that looks cheap and produces a column nobody can analyse.

### 4. Immutable with a correction window

Allow true edits within, say, 15 minutes of submission, and require revisions after.

Genuinely tempting, since most corrections are immediate typo fixes and a revision chain for a
mis-tap is noise. Rejected on two grounds. It creates two write paths where one would do, and
every consumer has to handle both. More importantly, offline entries can arrive hours after
they were created, so "within 15 minutes" has no unambiguous meaning: 15 minutes of device
time, or of server time? The answer differs, and the difference is exploitable.

The UI achieves the same outcome without a second mechanism: a confirmation step at submission,
and a revision that presents as an ordinary edit afterwards.

---

## Open questions

- **O-28**: Should a coach be able to see the full revision chain, or only the current value
  plus an "edited" marker? Full visibility is more honest and might create the exact social
  pressure this ADR is meant to prevent, because an athlete who knows the coach can see the
  original will hesitate before correcting a genuine mistake. I have specified: the athlete sees
  their own chain in full, the coach sees the current value plus an edited marker and can expand
  it, and any expansion is written to the audit log. Confirm.
