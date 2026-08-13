# ADR-008: A coach may set non-injury availability

## Status

**ACCEPTED.** 2026-08. Narrows the rule in `01-roles-and-permissions.md` §2 and §4
("Set availability status: the only role that can [is medical]"), which was itself
written before this case was considered. Both documents are updated in the same
commit as this ADR. Does **not** touch ADR-007 (clinical data separation) — read
that ADR's own scope note below for why the two are independent.

---

## Context

Audit governance finding 2 / gameplan 2.6. A club with 16–25 year olds in
education has real, common, non-injury reasons a player is unavailable: exam
leave, a personal or family matter, representative honours elsewhere (called up
by a representative side), a disciplinary suspension. None of these is a medical
fact. Before this ADR, the only way to record any of them was through the medical
role's `SetAvailabilityForm`, and that form was only reachable from an injury's
own detail page (`/injuries/[injuryId]`) — so recording "unavailable, exams" for
an athlete who was never hurt meant either fabricating an injury record to reach
the form at all, or the absence simply never being recorded. The audit caught
clubs doing the former, which is worse than the gap it was worked around: a
sports-injury record now exists, forever, for a player who was never injured.

**What the investigation found, precisely, before deciding anything:**

1. The schema was never the blocker. `availability.injury_id` has been nullable
   since 0005, and `reason_category` has carried non-injury values ('illness',
   'personal', 'suspension', 'load_management') since 0001. `SetAvailabilityForm`
   already builds a reason picker from those values and already passes
   `injuryId: null` when there is none.
2. The blocker was RLS, and it was deliberate. 0012's `availability` section
   reads: *"There is no coach insert policy on this table. Not a restricted one,
   not one gated on a column: none. A reviewer looking for a way a coach could
   write here should find nothing to read."* That is a considered, defended
   design, not an oversight, and this ADR exists because overriding it needs the
   same weight of reasoning the original decision had.
3. `SetAvailabilityForm` itself was only reachable via an existing injury record
   — a second, independent gap, on top of the RLS one, that existed even for
   medical staff. Fixed in the same change: the squad athlete profile page now
   carries its own "Set availability" entry point that does not require an
   injury to exist first.
4. `reason_category`, `restrictions` and `note` were fetched by every read query
   (`fetchCurrentAvailability`, `fetchNotFullyAvailable`) but rendered by **no
   screen at all** — `AvailabilityBanner` showed only restrictions, the reports
   page fell back to the string `"Restricted"` when there was no body area,
   and the dashboard's squad-state tile showed bare names with no reason. A
   third, independent gap: even a medical-authored non-injury reason had
   nowhere to display. Fixed in the same change, reusing each surface's
   existing rendering idiom rather than adding a new one — see the file list at
   the end of this ADR.

So the real shape of the problem was three gaps stacked on one boundary, not the
two-way "schema gap vs. UI gap" split the work was originally scoped against.
The schema was fine. The permission layer, the entry point, and the display
surface were each a separate, real gap.

---

## Decision

**A coach may insert and later close an `availability` row, but only when it is
not linked to an injury and does not claim `reason_category = 'injury'`.**
Medical retains full, unconditional access to every row, exactly as before.

```sql
-- migration 0041, abbreviated — see the file for the full comments
create policy availability_coach_insert_noninjury on public.availability for insert
  to authenticated
  with check (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and set_by = auth_user_id()
    and injury_id is null
    and reason_category is not null
    and reason_category is distinct from 'injury'::availability_reason
  );

create policy availability_coach_update_noninjury on public.availability for update
  to authenticated
  using (
    org_id = auth_org_id()
    and auth_has_any_role(array['coach']::app_role[])
    and injury_id is null
    and reason_category is distinct from 'injury'::availability_reason
  )
  with check (
    org_id = auth_org_id()
    and injury_id is null
    and reason_category is distinct from 'injury'::availability_reason
  );
```

Three column-level conditions do all the work:

| Condition | What it protects |
|---|---|
| `injury_id is null` | A coach can never touch a row that traces back to a real injury, regardless of what it says |
| `reason_category is distinct from 'injury'` | A coach can never claim the injury reason even without a linked record — closes the gap a coach typing the wrong category rather than leaving the field blank would otherwise leave |
| `reason_category is not null` (insert only) | A coach cannot open a bare, unexplained row. Not required on update, because the ordinary starting state of an athlete who has never had an availability event is exactly that: an open row with no reason at all, set by whoever onboarded them. A coach has to be able to close that row to open their own — see migration 0041's own header for the full reasoning, and 200_coach_noninjury_availability_test.sql section 1 for the fixture case this exists to cover. |

The enum gained three values in its own migration (0040, `academic`,
`representative`, `other`), following the pattern 0015 already established for
enum additions — each new value in its own transaction, never sharing a
transaction with a policy or query that references it.

### The reason picker a coach sees is a subset of the enum

`SetAvailabilityForm` (medical) offers the full enum. The new coach-facing form
offers five: Illness, Personal, Academic, Representative, Other. `suspension` and
`load_management` are deliberately not in the coach picker — not because a coach
cannot administer a disciplinary suspension (they plainly can, and do, without
medical involvement in most clubs), but because the task that produced this ADR
specified this exact five-item list, and widening it further is a product
decision for whoever owns that list next, not one to make silently while fixing
an access-control gap. **This is a judgement call, not a technical constraint**:
the RLS policy above does not enforce the five-item list at all, only
"non-injury". A club that wants a coach to be able to record a suspension
through this path can have the picker widened without a migration.

---

## Consequences

**Good:**

- The clinical boundary (ADR-007) is untouched. `injuries` and `injury_clinical`
  have no new policy, no new grant, and no coach-reachable path gained a single
  new column of visibility.
- The three protections are independent of each other (injury_id, reason
  literally 'injury', and — on insert — no reason at all), so defeating the
  boundary requires defeating all three, not finding the one condition that was
  missed.
- The regression this could most easily have caused — quietly widening what a
  blanket, no-`WHERE` coach `UPDATE` can reach — was caught by the existing
  pgTAP suite before this shipped, not after: 030's own "a coach updating an
  availability row changes zero rows" assertion, run unmodified against 0041,
  failed by matching the wrong row, which is exactly why that assertion is now
  scoped to `athlete_1` by id rather than the whole table. See the diff to
  030 §3 for the full account.

**Bad, and accepted:**

- **The five-item coach picker is a judgement call**, documented above, not a
  hard boundary. It can drift from what the RLS policy actually allows if a
  future change widens one but not the other. The gap is intentional and small
  (a UI restriction is strictly narrower than what the database permits, never
  wider), but worth flagging for whoever next touches this list.
- **A coach and medical staff member can both now author non-injury rows**,
  and nothing in the schema records which "kind" of write it was beyond
  `reason_category` and `set_by`. `set_by` already resolves to a named user
  with a role, so "who wrote this" is always answerable, but there is no
  denormalised `authored_by_role` column. Not adding one: `set_by` joined to
  `user_roles` already answers the question and a denormalised copy is another
  thing to keep in sync for no query this build needs.
- **The update policy is deliberately looser than the insert policy** (no
  `reason_category is not null` requirement). This is asymmetric on purpose —
  see the table above — but it means a coach can close a row that they did not
  open and that carries no explanation at all (a bare "available" row from
  onboarding), which is correct for the workflow this ADR exists for and would
  read as a bug if this paragraph were not here.

---

## Alternatives considered

### 1. Leave medical as the only role that can write, and just fix the entry point

Give medical staff a standalone "Set availability" action that does not require
an injury to exist first, and leave the RLS boundary exactly as 0012 wrote it.

Rejected as insufficient, not wrong. It is a real fix to a real, separate gap
(§4 above) and this change makes it too, but it does not solve the problem the
audit actually raised: a coach still cannot record "James Barnes, exam leave"
without asking a physio to do it on their behalf, for something that was never
medical staff's decision to begin with. A club without a physio on-site every
day — which is most clubs at this age group — would still have no path.

### 2. Widen the existing medical-only policy to "coach or medical", unconditionally

Drop the role check to `array['coach','medical']` on the existing
`availability_medical_insert`/`_update` policies, with no column condition.

Rejected outright. This is exactly the change 0012's own comment was written to
make impossible to do by accident, and doing it on purpose is worse: it would
let a coach open or close an availability interval **for an injury**, which is
the one thing every other document in this repo — CLAUDE.md rule 3,
01-roles-and-permissions.md §4, ADR-007 — agrees a coach must never do.

### 3. A new role, "coach-medical-lite" or similar

Invent a role between coach and medical with availability-write but no injury
access.

Rejected as unnecessary machinery. The four roles (`athlete`, `coach`,
`medical`, `admin`) are a documented, deliberate, small set
(`01-roles-and-permissions.md` §1's own framing: "an admin who also needs squad
data holds the coach role as well"). A fifth role for one capability, when a
column-level condition on the existing `coach` role does the same job with less
surface area, is the kind of thing CLAUDE.md §4 asks to be justified with what
it replaces before adding — and it would replace nothing; it would sit
alongside coach doing almost the same thing.

### 4. A denormalised `is_clinical` boolean on `availability`, instead of deriving it from `injury_id`/`reason_category`

Add a single flag column, set once at insert time, and gate everything on that.

Rejected. It is one more piece of state that must agree with `injury_id` and
`reason_category` forever, and a policy that trusts a flag a coach's own insert
sets is a policy that trusts the coach to flag their own row honestly — which
is exactly the "select * away from a breach" shape ADR-007 rejected for a
different table, for the same underlying reason: derive the boundary from facts
that cannot be lied about in the same statement that inserts them, not from a
label attached to the row asserting what it is.

---

## What changed, file by file

- `supabase/migrations/0040_availability_reason_categories.sql` — three new enum values.
- `supabase/migrations/0041_coach_noninjury_availability.sql` — the two policies above.
- `supabase/tests/200_coach_noninjury_availability_test.sql` — new, the permission suite.
- `supabase/tests/030_medical_and_entry_rules_test.sql` §3 — narrowed one assertion to
  match the new, correct scope; see the inline comment at the point of the edit.
- `docs/01-roles-and-permissions.md` §2, §4 — matrix row and prose updated.
- `docs/04-data-model.md` §9 — short note added, pointing here.
- `docs/screens/athlete-profile.md`, `injury-dashboard.md`, `squad-list.md` — the three
  validation-rule rows that flatly said "medical only, the coach client does not render
  the control" corrected. These are pre-existing, more elaborate design-phase specs the
  live build already diverges from in other ways; only the lines this change made false
  were touched.
- `src/components/SetAvailabilityFormCoach/` — new, the non-injury picker (five reasons).
- `src/app/(staff)/squad/[athleteId]/page.tsx` — new entry point, coach-visible.
- `src/app/(staff)/squad/page.tsx` — stale "a coach reads it and never writes it" copy corrected.
- `src/components/AvailabilityBanner/`, `AvailabilityList/`, and the reports/dashboard
  call sites — `reason_category` and `note` now render, reusing each surface's existing
  idiom (see §4 of the Context section above).
