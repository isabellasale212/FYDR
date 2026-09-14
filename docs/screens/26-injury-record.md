# 26. Injury record

## 1. Page name and URL

**Injury**, at `/injuries/[injuryId]`.

One injury. **This is the screen where the medical boundary is most visible**: a
coach and a medic open the same address and see materially different pages.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Body area, side, onset, status, expected return, actual return, how it happened, and availability | Nothing on the clinical record | **Diagnosis, mechanism, severity, tissue type, imaging, referral, clinical notes, treatment plan**, and the return-to-play ladder | Base | Route guard, then the database refuses the clinical table |
| Coach | Yes | Same, **without the body area and side while the club's setting is off** (`/settings/club#injury-site`, migration 0122, off by default): the title reads "Injury" | Nothing | The same eight, the ladder, and the site and side | Base | Same; the `injuries_staff` view masks the two columns and the table does not grant them |
| Medic | Yes | All of the above, **the full clinical record, and the return-to-play ladder** (migration 0123) | Create and edit the clinical record. Set availability. Open a protocol, advance a stage, set a stage. Sign off or return an S&C's proposal. **Cannot delete the injury** | None | Base | The clinical form and the ladder appear only for a medic, and the database allows only a medic |
| S&C | Yes | Same as coach | Nothing | The same eight | Base | **NOT BUILT** |
| Nutritionist | **No** | Nothing | Nothing | **The whole page** | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing here. An athlete sees their own injury minus the clinical notes, in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**An injury is never deleted.** It is closed. Deletion exists only for the audited
erasure process, which is not a physio action
(`supabase/migrations/0005_injuries_and_availability.sql:43`).

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/injuries/[injuryId]/page.tsx:32`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- An injury row on the injuries list.
- An injury named on the injury and availability report.
- An athlete's profile, where their injury is linked.

---

## 4. What you see

**Everyone sees**: the athlete, the body area and side, when it started, the
status, the expected return date, and how it happened.

**Everyone sees the availability control**, because deciding whether someone can
train is a separate act from recording what is wrong with them.

**Only a medic sees the clinical record**: diagnosis, mechanism, severity, tissue
type, imaging, referral, clinical notes and treatment plan, with a form to record
them.

**A coach is not told that a clinical record exists.** Its absence is silent,
which is correct: telling a coach "there is a diagnosis you cannot see" is itself
a disclosure.

**Only a medic sees the return-to-play ladder** (PATTERN-S3 C3, migration
0123, `injury_protocols` and `injury_stage_events`). A protocol is a count of
stages (1 to 12) opened against the injury — stages are numbered, never named,
because the club's protocol document holds the names and criteria and the
product does not restate them. The ladder shows every stage with a state word —
Done, Now, Next, Later — and the history beneath it, one row per move with who,
when, the line and the reason. **Advancing moves one stage** and asks for two
things: the restriction line rewritten for the new stage, which is what the
coach and the athlete read, and a confirmation that the criteria in the club's
protocol were reviewed. **Any other stage** (back, or a jump) needs a reason in
words. The database refuses an advance without the line or the confirmation, a
set without a reason, and any line that names a protocol, a stage or a
diagnosis (`restriction_line_is_clean`). On an advance the athlete's open
availability row is closed and a new one opened with the same status, reason
and note and the new line — the availability table is a ledger
(`63-availability-history.md`), never rewritten in place — so the coach's
screens change at the same moment, the history shows the line before, and
Today tells the athlete once more, dated to the move. Each move writes a `stage_change` timeline event and an audit
row. `lib/restrictions.ts` keeps stripping protocol and stage words from every
restriction line at every read, for every viewer, so the stage data can only
be read through the ladder (medic) and the athlete's own status screen.

**Gym work proposed for this injury** (PATTERN-S3 C6, migration 0124): each
S&C proposal against this injury with its state — Awaiting your sign-off,
Signed off, Returned with your reason. Sign off is one press and assigns the
block; Request changes opens a required reason and returns the block. Both go
through `decide_proposal`, the same function the proposals list uses, so the
two screens cannot disagree (`docs/screens/66-rehab-proposals.md`).

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| None | Days since onset | How long this has been going on | Since the onset date | Cannot be blank: onset is required |
| None | Days to expected return | How long until they are due back | To the expected date | Blank where no date has been set, which is an ordinary state early on |
| MET-013 | Availability | Whether they can train and play | Now | Unknown |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Set availability | Availability card | Records a new status with reason and restrictions | Stays here | A new availability record; the previous one is closed | Medic, and coach today | Form submission | Should be limited under the agreed model |
| Record clinical detail | Clinical card | Creates or updates the clinical record | Stays here | Writes to the clinical table | **Medic only, enforced by the database** | Form submission | **The whole card is absent for anyone else** |
| Close the injury | Status control | Marks it closed with an actual return date | Stays here | Updates the injury | Medic, and coach today | Form submission | Hidden once closed |
| Open a protocol | Return-to-play card | Starts a protocol with a stage count (1–12) at stage 0 | Stays here, `?stage=opened` | `injury_protocols`, a stage-0 event, an audit row | **Medic only, enforced by the database** | Form submission | Absent for every other role; absent once a protocol exists or the injury is closed |
| Advance one stage | Return-to-play card | Moves to the next stage with the rewritten restriction line and the criteria-reviewed confirmation | Stays here, `?stage=advanced` | A stage event; the open availability row's restrictions; a timeline event; an audit row | **Medic only** | Form submission; the line and the confirmation are required | Absent at the last stage, or once closed |
| Set a stage | Return-to-play card | Moves to any other stage with a reason (and an optional new line) | Stays here, `?stage=set` | The same rows, with the reason | **Medic only** | Form submission; the reason is required | Absent once closed |
| Sign off / Request changes | Gym work proposed card | Approves the block (it goes live) or returns it with a required reason | Stays here | `decide_proposal`: the assignment's status, who decided, when, the reason; a timeline event; an audit row | **Medic only** | One press to approve; the reason to return | Absent once decided |
| Injuries breadcrumb | Header | Back to the list | `/injuries` | Nothing | Any staff today | None | Never |

**There is no delete.** By design.

---

## 7. How this page is built, in plain English

Built on the server.

**The clinical record is requested only when the reader is a medic.** If a coach's
page asked for it anyway the database would return nothing rather than an error,
and an empty clinical panel would render, which looks like a broken page even
though nothing crossed the boundary. So the check happens before the request
(`src/lib/queries/injuries.ts:195`).

The protection that actually matters is the database rule, which allows the
medical role and nobody else, for reading and writing alike
(`supabase/migrations/0012_rls_policies.sql:696`).

---

## 8. States

**Loading.** Renders when ready.

**Not found.** The not found page.

**No clinical record yet.** For a medic, an empty form to fill in. For everyone
else, nothing at all.

**Closed.** Shown with its actual return date, still readable.

**Error.** Surfaces as an error.

**No permission.** Athletes are redirected. **The nutritionist should be refused
and currently is not.**

**Wrong tier.** Not applicable.

**Offline.** Not handled.

---

## 9. Open issues

- **No role gate.** Decision D-01.
- **Coaches can currently set availability and close an injury.** Whether the
  agreed model intends that, or whether availability is a medical decision only,
  is **decision D-35**. The seed data describes the physio as "the only person who
  can set availability or read clinical notes"
  (`supabase/seed.sql:90`), which the code does not enforce.
