# 03. Athlete profile

## 1. Page name and URL

**Athlete**, at `/squad/[athleteId]`.

One athlete, on one screen: who they are, whether they are fit, how they have
been, and what needs doing about it. The busiest screen in the staff app and the
one where the medical boundary matters most.

---

## 2. Who can access this page

| Role | Can reach the page | What they can see | What they can change | Fields hidden or masked | Tier required | Where this is enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Everything except the clinical record | View, create, edit. Sets availability, logs a weigh in, corrects an entry, edits biographical details | Diagnosis, mechanism, severity, tissue type, imaging, referral, clinical notes, treatment plan | Base | Route guard `src/lib/session.ts:69`, then a coach or medic check at `src/app/(staff)/squad/[athleteId]/page.tsx:254` |
| Coach | Yes | Everything except the clinical record | Sets availability, logs a weigh in, corrects an entry, **edits biographical details** | The same eight clinical fields | Base | Same, plus `:363` for the bio edit |
| Medic | Yes | Everything **including** the clinical record | Sets availability, logs a weigh in, corrects an entry. **Not** biographical details | None | Base | Same, plus `:693` for the clinical panel |
| S&C | Yes | Everything except the clinical record | Nothing. View only | The same eight clinical fields | Base | **NOT BUILT.** Decision D-01 |
| Nutritionist | Yes | The page **without** any injury or availability region | Nothing | The whole injury and availability block, including reason and restriction text | Base | **NOT BUILT.** Decision D-01 |
| Athlete | **No** | Nothing | Nothing | The whole page | n/a | Middleware, then guard, then database |

**The clinical boundary is not enforced by this page.** It is enforced by the
database: only the medical role may read that table at all, for every operation
(`supabase/migrations/0012_rls_policies.sql:696`). The page still avoids asking
for it unless the reader is a medic, because an empty clinical panel rendered by
mistake looks like a broken page even though no data crossed the boundary
(`src/lib/queries/injuries.ts:195`).

---

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/squad/[athleteId]/page.tsx:242`; a **coach or medical** check at `src/app/(staff)/squad/[athleteId]/page.tsx:254`, which renders a named refusal rather than redirecting. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Any row in the squad overview.
- Any row in the dashboard's Needs attention list.
- An athlete's name almost anywhere: flags, reports, leaderboards, injuries,
  session detail, programmes.
- A direct link, for example from a notification.

---

## 4. What you see

**The status header** — the one emphasised card on the screen (STAFF-SS-02-05
C1, 13 September 2026; the accent wash and its soft border, B1's mapping of the
board's tint). The initials, the name and the availability pill in the
dashboard's words and tones; under them the sub line "Flanker · #7 · Forwards,
Rehab" (position · jersey · groups, a missing part said); the restriction line —
what a coach acts on, never a protocol or a diagnosis: "No contact · No collision
drills. Expected return to full training Mon 21 Sept." (the return from the
linked open injury's coach-safe row), an absence as "Academic — Exams this week,
back Monday 24th", and no status as "No restriction recorded. Not counted as
available and not counted as out."; then the owner line, "Set by medical staff ·
Ruth Callaghan · Fri 11 Sept" (an injury-linked row is the medic's; any other row
"Set by coaching staff"; nothing recorded reads "Set by medical staff · nothing
recorded"). The domain chips (Nutrition, Wellness, Gym), Edit and today's
wellness dial sit on the name row as before. Then the bio row (Position, Jersey,
Height, Age, Hand, Weight — the coach's without Weight, C9), and last the
development-plan line the old bar carried — "Development plan · In-Season max ·
week 2 of 4 · ends Tue 29 Sept", or "Development plan · none assigned" — with
its "View plan" / "Change plan" link. The separate plan bar is gone.

**The panels, in one order** (STAFF-SS-02-05 C4, ruled 13 September 2026 and
built 14 September; `lib/profilePanels.ts`). Every role reads the sport
scientist's order — the board's own "All panels" sheet — with the panels that
role cannot see simply absent, never locked: **Flags, Athleticism, ACWR and
wellness rating, Availability, Entries and corrections, Body weight, Nutrition
plan, Injury, Goals, S&C history log, Subject access request.** One exception:
for the S&C and the nutritionist on their own, **Body weight moves above Flags**
(roles add up, so an S&C who is also a coach reads the base order). Layout
follows the sequence: on a desktop the column panels fill the two-column grid
column-first — the first half down the left, the rest down the right — so
"above" is above; on a phone the one column reads the list straight through.
The two wide panels (Entries and corrections, the subject access request)
stand full-width where the sequence puts them, and the grid breaks around
them. The ACWR and wellness card is not on the board (its dial is in the
header there) and sits directly after Athleticism.

**Biographical details.** The facts about the person: position, squad number, and
so on. Editable by a coach.

**Availability.** The current status with its reason and any restrictions, and
the control to change it. No status reads **"Not recorded"** on a neutral pill —
never "Not set" (STAFF-SS-02-05, 12 September 2026): no status is not a state of
availability. The staff form's note field is labelled "Note" and carries, under the
field, *"Coach visible. Describe the restriction, not the injury. Do not name a
diagnosis or a protocol."* — the hint travels with the one free-text field that
leaves the clinical circle (PATTERN-S3).

**The coach's form is an absence form** (PATTERN-S3 C5, 12 September 2026):
"Record an absence" — the reason first, as chips (illness, personal, academic,
representative, other), then the availability words with **Available withheld**
("an absence that leaves an athlete fully available is not a record"), the note
("Visible to the athlete and to all staff. This is not a medical record — do not
describe symptoms."), and a well saying what an absence does not carry: no injury
record, no site, no diagnosis, no return to play stage, no row on the injury
board, and medical staff are not notified. "Record absence" is the primary; while
a non-injury absence is open, "Mark available again" ends it — the Available row
through the same confirmed step. From/Until dates and the "Already recorded"
list are recorded, not built: the read model has no scheduled interval, and the
list is the availability history (PATTERN-S3 C7). Permissions are the database's,
unchanged: coach and sport scientist for a non-injury row, the medic
unconditionally.

**Availability history** (PATTERN-S3 C7, 12 September 2026): "Availability
history ›" under the injury card opens `/squad/[athleteId]/availability` —
every change on record, one row per change, newest first, with a CSV. See
`63-availability-history.md`.

**Before an availability change lands, the form says who will read what**
(PATTERN-S3 / STAFF-SS-02-05 C4, 12 September 2026): pressing "Record absence"
(or "Update availability" on the medic's form) opens a step listing the athlete by name (the status word, restrictions, expected
return, the injury record except the clinical notes), the coaches and the S&C by
role (the status word, the restriction line, the reason category, your note —
never a diagnosis, a mechanism or a protocol stage) and medical staff and the sport
scientist (everything). "Confirm and update" is the write; "Back" returns to the
form. The same step sits on the medic's form on the injury record. The rows state
what each reader can read under the RLS in force today, and change with it.

**The restriction line never names a protocol** (PATTERN-S3 D1, enforced 12 September
2026): every read of `availability.restrictions` passes through `lib/restrictions.ts`,
which drops any entry naming a protocol, a stage or a diagnosis — for every viewer, on
every screen (squad list, dashboard, allocation, timetable, the athlete's own Today).
The return-to-play stage is a clinical fact and lives in the clinical record's treatment
plan, read by medical staff only.

**Injury.** The current injury, if any, as `InjuryCard`. With no open injury it
reads *"No current restrictions. This is not the same as being cleared."* An
expected return the medic has not set reads *"Expected return not known"*; a
clinical field nobody has filled reads *"Not recorded"*, never a dash. For a
non-medic the card stops after the expected return.

**Empty panels state the requirement, never a zero** (STAFF-SS-02-05 C8, 12 September
2026): "No weigh-in recorded. A trend needs three weigh-ins." and the body-weight
caption's "— a trend needs three weigh-ins" under three; "No plan assigned. Targets are
per kilogram, so a plan needs a weigh-in." (or, when a plan is assigned but there is
no weigh-in to scale it — PATTERN-S5 C7, 13 September 2026 — "No weigh-in on record,
so these are the club default figures, not scaled to Kai. Targets are per kilogram; a
weigh-in scales them.", since the resolver serves the club's absolute default in that
case (04-data-model §17.3) and the card shows those numbers; "…set as absolute
targets…" for a personal or group target); "No open flags for this athlete · n = 0.";
the injury panel's "This is not the same as being cleared."

**The programme link is the tell** (PATTERN-S5, 12 September 2026): "Edit this
programme" / "Change plan" for a role that may author a programme
(`PROGRAMME_AUTHOR`), "View full detail" / "View plan" for one that may not. Same
route; the programme page refuses the write on its own.

**Entries and corrections.** The intro states the rules once: entries are never
overwritten, a correction records a new dated revision against your name, the
window is a fixed 28 days, and gym set logs and the weekly nutrition check-in are
not correctable here.

**Flags.** Alerts currently raised against this athlete, each with what triggered
it: the rule's own sentence (the same builder the Thresholds screen uses) and
the evidence line (the rule's window and baseline, and when it fired). **Two
states that must never read as one** (Isabella, 15 September 2026,
`decisions/decision-batch-2026-09-15.md` #2): when the rule cannot be shown,
the panel says which. A role that reads thresholds (sport scientist, coach,
medic, S&C — `THRESHOLD_VIEW`, the database's own select) and finds none is
told "The threshold this flag was raised under is no longer on record." — and
that is said only when it is gone. A role that cannot read thresholds at all
(the nutritionist, X on the Thresholds row) is told "The rule this flag was
raised under is not shown to your role." and the evidence line carries only
the date. Wording, not a permission: the read is gated by row-level security
either way.

**Domain chips.** Links through to this athlete's own wellness, gym and nutrition
detail screens.

**Readiness and wellness.** The athlete's recent readiness with their own normal
range drawn behind it, so today reads against their history rather than against
the squad.

**Body weight.** Recent weights, the trend, and the agreed target range where one
is set. A weigh in can be logged here. **The coach does not see body mass at all**
(STAFF-SS-02-05 C9, decided 12 September 2026): for a role outside
`BODY_MASS_VIEW` (sport scientist, S&C, nutritionist, medic) the whole card is
absent — no heading, no lock, no buttons — as is the Body mass card on the
athlete nutrition page and the body-mass column of the wellness export. A coach
who also holds one of those roles sees it; roles are unions.

**Correcting a weigh-in** (Isabella, 15 September 2026,
`docs/decisions/body-mass-rule.md` §2–§3; migration 0131). One weigh-in per
athlete per day — a second on the same day is refused at the table and the
form says so ("Edit it if it is wrong — a second one on the same day would
count as two observations"). **Edit entries** shows the fields only on a
weigh-in taken today; an older row is read-only, because the table raises
past that day. **Delete** is offered where it will land: on a row logged
today for the medic, S&C and nutritionist, and on any row for a sport
scientist; it is a soft delete (`delete_weigh_in()`, `deleted_at`), audited
by name, and the deleted row leaves every read and every baseline. The list
says the rule once above the rows. The card shows the club's weigh-ins alone,
so it never puts two numbers under one label (§7).

**Read-only panels name their owner** (STAFF-SS-02-05 C5, 12 September 2026). A
panel a role reads but cannot change ends with a well — an uppercase line
"Read-only · set by medical staff" / "Read-only · set by the nutritionist or the
sport scientist" and one sentence naming the person and the date — rather than a
dimmed control: disabled is for a control you could have used. Today: the Injury
card for anyone but the medic when the current availability is injury-linked
(who set it, when, and that a coach may still record a non-injury absence from
the Availability panel); the Nutrition plan panel for a role outside
`NUTRITION_EDIT`, which also offers "View" rather than "Edit" (the rule that
reaches the athlete — personal, group or club default — its author and its
effective date). Recorded, not built: the programme block's owner line (the
assignment carries no author).

**The clinical record. Medics only.** Diagnosis, mechanism, severity, tissue
type, imaging, referral, clinical notes and treatment plan. Nobody else sees this
region at all, and its absence is not announced to them.

**Entry corrections.** A panel for correcting a submitted entry. A correction
creates a new record and marks the old one superseded rather than overwriting it.

**A period selector** controls how far back the charts reach.

---

## 5. Every number on this page

| Metric ID | Label on screen | What it means in plain English | Time window | What shows when data is missing |
|---|---|---|---|---|
| MET-001 | Readiness | How ready the athlete says they feel | The day, and a mean across the chosen period | Blank, never zero |
| MET-006 | The shaded band behind the chart | This athlete's own normal range | 14 days, rolling | No band until 14 days of history exist |
| MET-005 | Body mass | Weight in kilograms | Latest, plus a trend | Blank |
| MET-036 | Target range | The agreed weight range | As set, and it may move across a season | No band shown if none is set |
| MET-010 | Acute to chronic ratio | This week's work against a typical week | 7 days over 28 | Withheld entirely below 21 days of data |
| MET-013 | The availability pill | Whether they can train and play | Right now | Unknown |
| MET-029 | Best on the day | **The best attempt on a test day, not a lifetime best.** See D-40 | Per test date | Blank |

---

## 6. Every thing you can act on

| Element and label | Where it sits | What happens when used | Where it takes you | What it writes | Permission | Confirmation | Disabled or hidden when |
|---|---|---|---|---|---|---|---|
| Record an absence / Mark available again | Availability card (the coach's and sport scientist's absence form) | Records a non-injury absence — reason, Modified or Unavailable, a note — or ends the open one | Stays here | A new availability record; the previous one is closed | Coach, sport scientist (the medic's own form sits on the injury record) | Yes — the who-will-read-what step | Hidden from S&C and nutritionist |
| Log a weigh in | Body weight card | Records a weight for a date — one per athlete per day | Stays here | A new body weight record | Sport scientist, S&C, nutritionist, medic (`WEIGH_IN_EDIT`) | Form submission | The card itself is absent for the coach (`BODY_MASS_VIEW`, 12 September 2026) |
| Edit a weigh-in | Body weight card, Edit entries | Corrects a weigh-in taken today | Stays here | The row, in place | The same four roles | Form submission | Read-only on any row taken before today (0131 §3) |
| Delete a weigh-in | Body weight card, Edit entries | Soft-deletes a weigh-in, audited | Stays here | `deleted_at`, `deleted_by`; an audit row `body_composition.delete` | A sport scientist on any row; medic, S&C, nutritionist on a row logged today (`WEIGH_IN_DELETE_ANY_TIME`, `delete_weigh_in()`) | Yes, inline | Absent where it would be refused |
| Edit biographical details | Bio card | Changes position, squad number and similar | Stays here | Updates the athlete record | **Coach only** | Form submission | Hidden from everyone else, medics included |
| Correct an entry | Corrections panel | Supersedes a submitted entry with a new one | Stays here | A new entry marked as the live one; the old marked superseded. **Never an overwrite** | Coach, medic, sport scientist | Form submission | Hidden from others |
| Wellness, Gym, Nutrition chips | Domain chips | Opens that domain for this athlete | `/squad/[athleteId]/wellness` and siblings | Nothing | Coach or medic today | None | Never |
| Period selector | Above the charts | Changes how far back the charts reach | Stays here, with the period in the address | Nothing | Any staff | None | A period the data cannot honestly express is shown disabled with its reason, never hidden |
| Start a subject access request | Foot of page | Begins the formal process of handing this athlete their data | A server route | Creates a request record | **Sport scientist** in the target model; admin today | Yes | Hidden from everyone else |

**Why corrections never overwrite.** Performance data that can be silently edited
is worthless for showing a trend. This is a standing rule, not a choice made on
this screen.

---

## 7. How this page is built, in plain English

Built on the server. The athlete's own record, availability, flags, wellness
history, body weight history and test results are fetched together rather than in
sequence.

**The clinical record is fetched only when the reader is a medic.** The check
happens before the request is made, not after it returns.

The forms on the page run in the browser and submit to the server, where the
permission is checked again. A control being hidden is never what stops someone
using it.

The period selector puts its choice in the address, so a particular view of an
athlete can be sent to a colleague.

---

## 8. States

**Loading.** The page renders when ready.

**Empty.** A new athlete with no history shows each region saying so rather than
showing zeroes. A zero readiness and no readiness are different things.

**Session RPE is off for this club** (`organisations.collects_rpe`, Settings ›
Club, migration 0118, 13 September 2026). The ACWR dial rests on session load
(RPE × minutes), so under its status line it says "This club does not collect
session RPE, so this ratio has nothing to show. A sport scientist can switch it
on in Settings › Club." (`docs/decisions/absence-rule.md`).

**Error.** Surfaces as an error.

**No permission.** A staff member who is neither coach nor medic currently sees a
Not part of this role screen naming the domain. Athletes are redirected earlier.

**Wrong tier.** Not applicable; this page is on every package.

**Offline.** Not handled.

---

## 9. Open issues

- **S&C and nutritionist restrictions are not built.** Decision D-01.
- **Biographical editing is coach only, including excluding medics.** This is
  what the code does. Whether it is what you want is worth confirming, since a
  medic correcting a date of birth is plausible. Raised as **decision D-26**.
- **UNVERIFIED: whether the page limits how many flags it lists.** Files
  searched: `src/app/(staff)/squad/[athleteId]/page.tsx`,
  `src/lib/queries/playerProfile.ts`.
