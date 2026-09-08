# Stage A2: reconciliation and decisions

Generated 7 September 2026. Mode: **reconciliation**, because substantial code
exists. Fifteen athlete pages, none of them stubs, 49 to 1,726 lines.

Every entry below is a decision for Isabella. Nothing here is settled silently.
Each carries the file and line it came from, or says plainly that it could not be
traced.

**The five open items Stage A1 carried forward are answered first**, because two
of them were access questions and answering them changes what the rest of the
specification has to say.

---

## Answers to the items Stage A1 carried forward

### A1-1. Can a staff member open the thirteen athlete screens missing from the middleware list? NO. Tested, not inferred.

`ATHLETE_PREFIXES` is `['/today', '/check-in']` only
(`src/lib/supabase/middleware.ts:19`). Eleven athlete routes are not in it. That
looked like an access hole, and it is not: **every athlete page calls
`requireAthlete()` for itself**, and `requireAthlete` redirects anybody without
the athlete role to `/dashboard` (`src/lib/session.ts:251`).

Tested at Run level against the running app, signed in as a sport scientist who
is not an athlete, and signed out:

| Route | Signed in as staff | Signed out |
|---|---|---|
| `/today` | `/dashboard` | `/login?next=%2Ftoday` |
| `/check-in` | `/dashboard` | `/login?next=%2Fcheck-in` |
| `/me` | `/dashboard` | `/login` |
| `/me/leaderboards` | `/dashboard` | `/login` |
| `/me/notifications` | `/dashboard` | `/login` |
| `/my-data` | `/dashboard` | `/login` |
| `/my-data/boards` | `/dashboard` | `/login` |
| `/programme` | `/dashboard` | `/login` |
| `/programme/nutrition` | `/dashboard` | `/login` |
| `/nutrition-check-in` | `/dashboard` | `/login` |
| `/report-problem` | `/dashboard` | `/login` |

**No leak. The specification can state that athlete screens are athlete only.**

**But the middleware gap costs something real, and it is a decision.** Look at
the right hand column. `/today` and `/check-in` come back with
`?next=` and the other nine do not. A player who taps a push notification or a
shared link to `/my-data` while signed out is sent to sign in and then landed on
the default screen, not the one they were going to. **DECISION 1.**

### A1-2. Can an athlete see their own availability, restrictions and return to play stage? See DECISION 8.

### A1-3. Does My data show GPS derived figures, and what does a Basic club's athlete see? See DECISION 9.

### A1-4. Which notifications are actually sent, and which screen does each open? See DECISION 12.

### A1-5. Does an athlete with no group membership get told why comparisons are empty? See DECISION 13.

---

## Two things that turned out NOT to be problems

Recorded because both were on the list to check and both came back clean, and a
reconciliation that only lists faults is not a reconciliation.

**Athlete input IS validated server side.** The brief asks for any athlete input
with no server side validation. There is almost none. Every scale, range and
length is a CHECK constraint in the database, so it holds regardless of what the
browser sends:

| Field | Constraint |
|---|---|
| `wellness_entries.sleep_quality`, `fatigue`, `soreness`, `stress`, `mood` | between 1 and 5 |
| `wellness_entries.sleep_hours` | between 0 and 14 |
| `wellness_entries.body_mass_kg` | between 30 and 200 |
| `wellness_entries.resting_hr` | between 20 and 220 |
| `wellness_entries.comment` | 1,000 characters |
| `training_entries.rpe` | between 1 and 10 |
| `training_entries.duration_min` | between 1 and 600 |
| `training_entries.comment` | 1,000 characters |
| `nutrition_checkins.note` | 280 characters |
| `nutrition_checkins.week_start` | must be a real week start, and iso_year and iso_week must agree with it |

There are also client side validators in `src/lib/validation/` for wellness,
training, nutrition, gym, problem reports and entry corrections. Those improve
the message the athlete sees. The database is what enforces it.

**Every table an athlete writes has a row level security insert policy.**
`wellness_entries` 2, `training_entries` 3, `nutrition_checkins` 1,
`gym_session_logs` 1, `gym_set_logs` 1, `problem_reports` 1, `athlete_consents`
4. No athlete writable table is unprotected.

**Under 18 is modelled, contrary to first impression.** `athletes` carries
`date_of_birth`, `dob_asserted_by`, `dob_asserted_at`,
`parental_consent_recorded_at`, `parental_consent_recorded_by`,
`parental_consent_method` and `activation_blocked_reason`. The product knows who
is a child and whether consent was recorded. What is undecided is what the app
then DOES differently, which is DECISION 10.

---

## The decisions

### DECISION 1. Nine athlete routes lose the destination a signed out visitor was going to. LOW, but cheap to fix.

**What happens.** `/today` and `/check-in` are in `ATHLETE_PREFIXES`, so the
middleware sends a signed out visitor to `/login?next=/today`. The other nine
athlete routes are not, so they get a bare `/login` and the visitor is landed
wherever sign in defaults to.

**Why it matters.** Every push notification and every shared link to a screen
other than Today lands in the wrong place if the app has signed the player out.

**Options.** (a) Add the nine prefixes to `ATHLETE_PREFIXES`. (b) Leave it, and
accept that deep links only survive for two screens. (c) Replace the prefix list
with the route group, so a new athlete screen is covered without anyone
remembering.

**No winner picked.** (c) is the one that does not decay, and it is the largest
change.

### DECISION 2. Nutrition guidance sits under a tab called Gym. MEDIUM.

`/programme/nutrition` is reached from `/programme`, and the tab bar labels that
tab **Gym** (`src/components/AthleteTabBar/AthleteTabBar.tsx`). A player looking
for what to eat has to know it lives behind Gym.

**Options.** (a) Rename the tab to something covering both, for example
Programme. (b) Move nutrition guidance under Me. (c) Add a fifth tab. (d) Leave
it and rely on the link from Today.

**This is a product decision about what the four tabs mean, not a bug.**

### DECISION 3. An athlete cannot delete their own account. HIGH for a native app, real for a web one.

**NOT BUILT** in either surface. Erasure exists only as an audited staff process
(`src/lib/retention/`, `docs/09-security-and-compliance.md` section 6).

Apple requires in app account deletion for any app with account creation,
**guideline 5.1.1(v)**. It is also a reasonable expectation for a web app under
UK GDPR article 17.

Stage A0 recorded the working answer: **the specification will require it.** This
entry is where that is carried, and it is still open to reversal. Note the real
complexity, which is not the button: an athlete's wellness and injury history is
club held data the club may have a lawful basis to keep
(`docs/09-security-and-compliance.md` section 5, the article 17 table). Deleting
the account cannot mean deleting the injury record. **What the athlete is told
about that distinction is the actual design work.**

### DECISION 4. HealthKit is a consent record with nothing behind it. RESOLVED AND BUILT, 8 September 2026.

`athlete_consents.purpose = 'healthkit_sync'` is written by
`src/components/HealthkitConsentToggle/HealthkitConsentToggle.tsx` and read on
`/me` (`src/app/(athlete)/me/page.tsx:253`). There is no HealthKit integration:
no native code anywhere, and **no table holds device sourced sleep, resting heart
rate or HRV**. Checked directly.

So an athlete can turn on a permission for a feature that does not exist, and
`docs/07-integrations.md` describes Apple Health as a Premium feature.

**Options.** (a) Hide the toggle until ingestion exists. (b) Keep it and label it
plainly as not yet active. (c) Keep it as is.

**(c) was the current behaviour and it was the one that misleads.**

**RESOLVED 8 September 2026: option (a).** Confirmed by Isabella via Q-03 in
`open-questions.md` — hide it until ingestion exists. **Built the same day**: the
Apple Health card is gone from `src/app/(athlete)/me/page.tsx`, along with the
`fetchHealthkitConsent` read, so nothing on the athlete surface asks for the
permission any more.

Three things deliberately NOT done, so the day ingestion arrives nobody has to
guess what was torn out:

- **The consent rows are untouched.** `athlete_consents.purpose =
  'healthkit_sync'` still holds whatever athletes granted before today, and
  `lib/queries/healthkit.ts` and `HealthkitConsentToggle` are still in the tree,
  now unreferenced. Hiding the toggle is not withdrawing a consent on somebody's
  behalf.
- **The redesign reference's replacement row was not built.** Screens 11-12 draw
  an "Apple Health / sleep and resting heart rate / Not connected" row — that is
  option (b), not the (a) that was confirmed, so it is not on the screen.
- **The staff Settings row stays**, tier gate included: what the plan buys is
  whether athletes would be offered it at all. Its copy was corrected in the same
  commit, because it used to tell coaches that athletes turn this on in their Me
  tab and that is no longer true anywhere.

### DECISION 5. The specification's own premise is wrong, and Stage A0 settled it. Recorded here so it is not lost.

There is no iOS app. Stage A0 section 11 re-verified that on 7 September. The
answer recorded was **option C**: specify the responsive web app that exists, and
add a separate appendix for what a native shell would additionally need.

### DECISION 6. Package 1 and Package 2 do not exist as a distinction in the athlete app. LOW.

The brief asks each screen to be labelled Package 1 or Package 2. Stage A1
section 6 found **no Premium only athlete screen and no tier gate in the athlete
shell**. Every athlete screen is Base.

**Options.** (a) Drop the Package column from the athlete specification. (b) Keep
it, recording every screen as Base, so the column is there when a gate appears.

### DECISION 7. Readiness is computed twice and the athlete sees one of them. HIGH, and it is the trust one.

`docs/metrics.md` carries **MET-001 Readiness score** and **MET-002 Readiness
score, analytics version** as two separate entries. Two definitions of one word.

The brief is explicit that a number an athlete sees which is computed differently
from the staff version breaks trust directly. **Stage B1 resolves which surface
shows which**, and this entry exists so the answer is a decision rather than a
description. If the athlete's readiness and the coach's readiness can differ for
the same day, that must either be fixed or be explained on screen.

### DECISION 8. ANSWERED, and the answer is more generous than expected. No decision needed unless you disagree with it.

**This entry was drafted as "not yet traced" and then traced. Recorded as a
correction rather than quietly rewritten, because the first draft was wrong.**

An athlete can read, about themselves:

| What | How | Citation |
|---|---|---|
| Their own injuries: body area, status, dates | `injuries_self_select`, `athlete_id = auth_athlete_id()` | `supabase/migrations/0012_rls_policies.sql:656` |
| Their own availability and restrictions | `availability_self_select`, same predicate | `0012_rls_policies.sql:725` |
| Their own clinical detail: diagnosis, mechanism, severity, tissue type, imaging, referral, treatment plan | `injury_clinical_athlete_view` | `0010_helper_functions_and_triggers.sql` |

**The one thing withheld is `clinical_notes`**, and the schema comment says so
plainly: "clinical_notes is absent. It is absent here and nowhere else in the
product."

**How that is done is worth reading**, because it is the opposite of a shortcut.
`injury_clinical` has NO athlete policy at all: the table is medic only for every
operation, so an athlete cannot query it directly through PostgREST. The view is
the only path, it is the one deliberate definer rights view in the schema, it
carries its own tenancy and subject predicates checked against the JWT rather
than against anything the caller supplies, and it is `security_barrier` so a
user supplied volatile function cannot be pushed below its filters. A coach has
no athlete row and matches nothing.

**So the answer to Stage A1's most important open question is: an athlete sees
their own injury record including their diagnosis, and not the physio's private
notes.** That is a defensible line and it is already built.

**What is still untraced is whether any athlete SCREEN reads it.** The database
permits it; no athlete page under `src/app/(athlete)/` was found referencing
injuries, availability or the view. Stage B3 checks per screen. A right that no
screen exercises is a right the athlete does not have in practice.

### DECISION 9. Is any athlete number GPS derived, and what does a Basic club's player see? MEDIUM.

Stage A1 section 6 found no tier gate anywhere in the athlete shell. But
`docs/12-product-tiers.md` makes GPS, the training report and the analytics chart
Premium. If `/my-data` shows a GPS derived figure to an athlete whose club is on
Basic, that is either a leak of a paid feature or a deliberate exception.

**UNVERIFIED: not traced.** Stage B1 and B3 settle it per metric and per screen.

### DECISION 10. PARTLY IMPLEMENTED, and the first draft of this entry was wrong. The remaining gap is notifications. MEDIUM, not HIGH.

**Corrected on tracing.** This entry originally said the product knows who is a
child and does nothing different. That is false for leaderboards, which are the
highest risk surface of the three.

**What IS implemented.** `athlete_is_minor()` is a SECURITY DEFINER function that
fails safe: an athlete with no date of birth is treated as a minor, and the
comment says why, "the other failure puts a fifteen year old on a public
ranking". Leaderboard construction applies it in the query, not the client
(`supabase/migrations/0016_leaderboards.sql:370`):

    and (
      not athlete_is_minor(a.id)
      or exists (select 1 from athlete_consents c
                 where c.athlete_id = a.id
                   and c.purpose = 'leaderboard_visibility'
                   and c.granted_at is not null
                   and c.withdrawn_at is null)
    )

**An under 18 athlete appears on a board only where they granted visibility
themselves. Opt in, not opt out**, which is Children's Code standard 7. There is
also an `athlete_age_view` that exposes `is_minor` and `is_under_13` without ever
exposing `date_of_birth`, and `athlete_is_minor` had its public execute revoked
twice, in migrations 0035 and 0036.

**CORRECTED A SECOND TIME, 7 September, on reading the notification screen.** The
minors' protection in notifications IS implemented too. `me/notifications/page.tsx:25`
computes `ageFrom(athlete.date_of_birth, timezone)` and `isMinor = age < 18` from
the athlete's real date of birth, and `src/lib/notifications/catalogue.ts` marks
three athlete notifications `minorFloorOff: true`: `athlete.flag.shared`,
`athlete.compliance.weekly` and `athlete.leaderboard.weekly`. All three are push
only and off by default for everybody, and forced off for minors.

**So the Children's Code is implemented in both places it currently can be:
leaderboards and notification defaults. This entry was overstated twice and is
recorded rather than tidied away, because the pattern is the point: three
successive readings each found more of it built than the last.**

**What genuinely remains.** The nudge limits at
`docs/09-security-and-compliance.md:507` are for `athlete.wellness.nudge` and
`athlete.rpe.nudge`, and **neither notification exists in the catalogue at all**
(gap G-A5). They cannot have minor limits because they do not exist. And nothing
sends any notification anyway, which is DECISION 12.

### DECISION 11. Offline is built for four domains. Is that the intended set? MEDIUM.

`src/lib/outbox.ts` queues wellness, training, nutrition check in and gym set
logs in `localStorage`, one key per domain, and retries on next load. Its own
header states the intent: an athlete in a gym with no signal must never see a
network error for something they have already done.

Not queued: problem reports, consent changes, leaderboard opt out, notification
preferences.

**Options.** (a) Confirm the four are the intended set and say so in each screen
specification. (b) Extend to problem reports, which is the one a player might
submit pitch side.

### DECISION 12. ANSWERED. Notifications are configured and never sent. MEDIUM.

**None are sent. Nothing in this codebase dispatches a push or an email.**
`src/lib/queries/notificationPreferences.ts` says so in its own header: no Expo
push credential, no APNs or FCM key, no email provider account, in `.env.local` or
anywhere else.

What IS real: `notification_preferences` (migration 0008), per user, per
notification, per channel, with its own-row-only RLS policy, and a catalogue of
three athlete notifications in `src/lib/notifications/catalogue.ts`.

**So the exact copy, timing and timezone the brief asks for do not exist to be
documented**, and section 8 of each screen specification says so rather than
inventing them.

**And two notifications the compliance document constrains are not in the
catalogue at all**: `athlete.wellness.nudge` and `athlete.rpe.nudge`. Either the
catalogue is incomplete or the compliance document specifies two things nobody
built. Gap G-A5.

### DECISION 13. An athlete with no group membership sees empty comparisons. LOW.

The staff surface handles this explicitly: it says the athlete is not a member of
any positional group, so there is no set of players to compare against. **Whether
the athlete's own screens say anything equivalent is untraced.** Stage B3 checks
it per screen.

### DECISION 14. Wellness scale direction is consistent, and one scale reads backwards to a newcomer. LOW, worth stating.

Verified from `src/lib/validation/wellness.ts:44`. All five scales run 1 to 5
with **5 as the best**, including soreness where 5 means no soreness:

| Scale | 1 | 5 |
|---|---|---|
| Sleep quality | Very poor | Very good |
| Fatigue | Exhausted | Very fresh |
| Soreness | Very sore | No soreness |
| Stress | Very stressed | Very relaxed |
| Mood | Very low | Very good |

The code already knows this is counter intuitive: the comment above it says both
ends are always labelled because "5 = no soreness" is counter intuitive and an
unlabelled scale is a guess. **No decision needed unless you want the wording
changed.** It is recorded because the brief asks every screen specification to
confirm scale direction explicitly, and this is the source of truth for that.

---

## Controls that do nothing

**None found so far.** The staff surface had six such controls, all fixed in
September. The athlete surface has not been swept at the same depth. Stage B3
checks every control on every screen, and any found are added here.

---

## What this stage could not establish

- **UNVERIFIED: notification copy, timing and timezone.** DECISION 12.
- **UNVERIFIED: what an athlete sees of their own injury record.** DECISION 8.
- **UNVERIFIED: whether any athlete figure is GPS derived.** DECISION 9.
- **UNVERIFIED: whether athlete screens explain empty comparisons.** DECISION 13.
- **NOT BUILT: athlete account deletion.** DECISION 3.
- **NOT BUILT: HealthKit ingestion.** DECISION 4.
- **NOT BUILT: any under 18 behaviour in the athlete app.** DECISION 10.

---

**STOP. Fourteen entries. Two are answered rather than open (8 and 10), and both
were overstated in the first draft and corrected on tracing, which is recorded
rather than tidied away.**

**One HIGH remains: DECISION 7, readiness computed twice.** An athlete and a
coach may be looking at the same word and a different number, and Stage B1
settles it.

**Two MEDIUM depend on work not yet done:** DECISION 12, the notification
implementation could not be located, which in turn blocks the minors' nudge
limits in DECISION 10.
