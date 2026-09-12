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

**A header** with the athlete's name, squad number, position and age, and a pill
showing whether they are available.

**Biographical details.** The facts about the person: position, squad number, and
so on. Editable by a coach.

**Availability.** The current status with its reason and any restrictions, and
the control to change it. No status reads **"Not recorded"** on a neutral pill —
never "Not set" (STAFF-SS-02-05, 12 September 2026): no status is not a state of
availability. The staff form's note field is labelled "Note" and carries, under the
field, *"Coach visible. Describe the restriction, not the injury. Do not name a
diagnosis or a protocol."* — the hint travels with the one free-text field that
leaves the clinical circle (PATTERN-S3).

**Before an availability change lands, the form says who will read what**
(PATTERN-S3 / STAFF-SS-02-05 C4, 12 September 2026): pressing "Update availability"
opens a step listing the athlete by name (the status word, restrictions, expected
return, the injury record except the clinical notes), the coaches and the S&C by
role (the status word, the restriction line, the reason category, your note —
never a diagnosis, a mechanism or a protocol stage) and medical staff and the sport
scientist (everything). "Confirm and update" is the write; "Back" returns to the
form. The same step sits on the medic's form on the injury record. The rows state
what each reader can read under the RLS in force today, and change with it.

**Injury.** The current injury, if any, as `InjuryCard`. With no open injury it
reads *"No current restrictions. This is not the same as being cleared."* An
expected return the medic has not set reads *"Expected return not known"*; a
clinical field nobody has filled reads *"Not recorded"*, never a dash. For a
non-medic the card stops after the expected return.

**Empty panels state the requirement, never a zero** (STAFF-SS-02-05 C8, 12 September
2026): "No weigh-in recorded. A trend needs three weigh-ins." and the body-weight
caption's "— a trend needs three weigh-ins" under three; "No plan assigned. Targets are
per kilogram, so a plan needs a weigh-in." (or "…so this plan needs a weigh-in." when
a plan has no weight to scale to); "No open flags for this athlete · n = 0."; the
injury panel's "This is not the same as being cleared."

**Entries and corrections.** The intro states the rules once: entries are never
overwritten, a correction records a new dated revision against your name, the
window is a fixed 28 days, and gym set logs and the weekly nutrition check-in are
not correctable here.

**Flags.** Alerts currently raised against this athlete, each with what triggered
it.

**Domain chips.** Links through to this athlete's own wellness, gym and nutrition
detail screens.

**Readiness and wellness.** The athlete's recent readiness with their own normal
range drawn behind it, so today reads against their history rather than against
the squad.

**Body weight.** Recent weights, the trend, and the agreed target range where one
is set. A weigh in can be logged here.

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
| Set availability | Availability card | Records a new availability status with reason and restrictions | Stays here | A new availability record; the previous one is closed | Coach, medic, sport scientist | Yes, the form must be submitted | Hidden from S&C and nutritionist |
| Log a weigh in | Body weight card | Records a weight for a date | Stays here | A new body weight record | Coach, medic, sport scientist | Form submission | Hidden from others |
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
