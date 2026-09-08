# Athlete app: gap queue

Generated 7 September 2026. What the specification requires, what exists, and the
files. **Ordered by risk, highest first.** Security, data exposure and under 18
issues rank above cosmetic ones.

---

## Band 1: an athlete is told nothing about their own body

### G-A1. An athlete is told they are unavailable, and almost nothing about why. MEDIUM, not HIGH.

**CORRECTED 2026-09-08. The original entry here said "no screen uses it" and that
an athlete "finds out they cannot train from a person". That was wrong**, and
wrong by the exact method this project has a standing rule against: it was
established by grepping `src/app/(athlete)/` for `from('injuries')` and
`from('availability')`. The queries live in `src/lib/queries/availability.ts`,
outside that folder, and the screen reaches them through an import. Follow the
import, not the folder.

**What is actually built.** `src/app/(athlete)/today/page.tsx:312` renders
`AvailabilityBanner` on every load of the landing screen. It shows the status
word (Available / Modified / Unavailable) with a coloured ring, the restrictions
list, the reason category when there are no restrictions, the free-text note, and
"Everything else is on. Speak to medical staff."

So an athlete who is made unavailable **is** told, on the first screen they see,
and is told what they may and may not do. The banner is careful work: it checks
`status === 'available'` before reading anything else, precisely so a stale
`reason_category` on a coach-authored row can never surface as a false reason.

**What is genuinely missing**, which is a narrower and different gap:

1. **The injury itself is fetched on every Today load and then discarded.**
   `fetchAthleteAvailability` returns `{ current, injury }`
   (`availability.ts:183`); `today/page.tsx` destructures only `current`. The
   discarded object already holds `body_area`, `side`, `onset_date` and
   `expected_return`. **The athlete is not told which injury, or when they are
   expected back**, and the data to tell them is already in memory on the server.
2. **The recovery stage is not even fetched.** `fetchOpenInjuries`
   (`availability.ts:83`) selects six columns and `status` is not among them, so
   `open` / `rehab` / `return_to_play` never leaves the database. This is the
   whole of G-A2.
3. **`injury_clinical_athlete_view` has never been read by any code.** Zero
   references in `src/` outside the generated types and two comments. The club
   has already decided, in a definer-rights view, that an athlete may see their
   own diagnosis, mechanism, severity, tissue type, imaging, referral and
   treatment plan, withholding only `clinical_notes`. None of it reaches them.

**Why it still matters.** On scratch today, Adam Selby is `modified` with a head
injury at `return_to_play`, with a restrictions field reading "return to play
protocol, stage 3 of 6; no contact; no collision drills". That athlete is told the
restrictions. They are not told they are on a graduated concussion protocol, which
stage of six the club thinks they are at, or when they are expected back — and the
first two are only legible because somebody typed them into a free-text field
that happens to be displayed.

### Tier 1 and Tier 2: what was decided, 2026-09-08

**Tier 1 is built.** The banner now carries the injury, its recovery stage and an
expected return date. No new screen, no new query, no migration: the injury was
already being fetched on every Today load and discarded, and `status` was one
column short of being selected.

**Tier 2 is not started, and waits on Isabella seeing diagnosis-only on screen
first.** Two decisions are already made and are binding on it:

1. **The clinical split. Diagnosis and mechanism may show. Imaging and the
   detailed treatment plan are HELD BACK.** In their words, that is "a bigger step
   than the existing DB permission implies" and they want to look at it properly
   before it is on a player's phone. Note what this means: the database is MORE
   permissive than the product. `injury_clinical_athlete_view` already exposes
   `severity`, `tissue_type`, `imaging`, `referral` and `treatment_plan` to the
   athlete, and Tier 2 must select only `diagnosis` and `mechanism` from it. The
   restraint lives in the query, so the test for it has to assert the columns
   NOT selected, not merely that the two chosen ones appear.
2. **The age gate is built in from the start, not deferred.** Using
   `athlete_is_minor()`, which already fails safe: a null date of birth counts as
   a minor. One minor on the roster today, zero with an open injury, and their
   reasoning is that this is exactly the moment to get it right, before it is a
   live problem. Whether a minor sees a reduced version or none of it is still
   open; the gate itself is not.

### G-A2. Return-to-play progression is invisible. MEDIUM.

Not a separate screen problem. `injuries.status` carries `open`, `rehab` and
`return_to_play` and is not selected by the athlete's query. Structured stage
data (`stage 3 of 6`) does not exist as a column anywhere — where it exists at
all it is free text inside `availability.restrictions`. Surfacing the status is
small; surfacing a real protocol stage is a data-model question, not a screen.

## Band 2: obligations that are specified and not met

### G-A3. No in app account deletion. HIGH.

**Required** by Apple guideline 5.1.1(v) for a native app, and reasonable for a
web one under article 17. **NOT BUILT** in either surface. Erasure is an audited
staff process only.

**The hard part is the copy, not the button.** See `docs/athlete/app-store.md`
section 1 for what can and cannot be deleted.

### G-A4. Nothing sends any notification. HIGH for the product, not for safety.

`notification_preferences` is real, RLS protected, and configurable per user, per
notification, per channel. **Nothing dispatches.** No Expo push credential, no
APNs or FCM key, no email provider.

**So every setting on `/me/notifications` configures something that does not
happen**, and the nudges that `docs/09-security-and-compliance.md:507` constrains
so carefully are not sent at all.

**This is accounts to open rather than code to write**, which is a different kind
of gap and worth saying.

### G-A5. The nudges named in the compliance document are not in the catalogue. MEDIUM.

`athlete.wellness.nudge` and `athlete.rpe.nudge` are named and constrained at
`docs/09-security-and-compliance.md:507`. **Neither appears in
`src/lib/notifications/catalogue.ts`**, which carries `athlete.flag.shared`,
`athlete.compliance.weekly` and `athlete.leaderboard.weekly`.

**UNVERIFIED whether they exist anywhere else.** Either the catalogue is
incomplete or the compliance document specifies two notifications nobody built.

---

## Band 3: things that mislead

### G-A6. The Apple Health toggle asks for a permission that leads nowhere. MEDIUM.

An athlete on a Premium club can grant `healthkit_sync`. **There is no HealthKit
integration and no table holds device sourced data.** The consent is recorded and
nothing reads it to ingest anything.

**Files.** `src/components/HealthkitConsentToggle/HealthkitConsentToggle.tsx`,
`src/app/(athlete)/me/page.tsx:240`.

### G-A7. Nutrition guidance lives behind a tab called Gym. MEDIUM.

A player looking for what to eat has to know it is under Gym. Not a bug, a naming
decision, DECISION 2.

### G-A8. Two flag domains have nowhere to land on My data. LOW.

`gps` and `compliance` flags have no segment (`my-data/page.tsx:452`).

---

## Band 4: robustness

### G-A9. Report a problem is not queued offline. MEDIUM.

Wellness, training, nutrition and gym are queued in `src/lib/outbox.ts`. **Report
a problem is not**, and it is the one an athlete is most likely to submit pitch
side with no signal.

### G-A10. Nine athlete routes lose their destination after a signed out visit. LOW.

`ATHLETE_PREFIXES` covers `/today` and `/check-in` only. Every other athlete route
returns a bare `/login`. Tested, not inferred.

### G-A11. An athlete cannot correct their own entry. LOW as built, worth a decision.

Migration 0058 made `revise_wellness_entry` and `revise_training_entry` coach and
medical only at the club's request. The `?correct=1` routes were removed properly
rather than left to collect answers and refuse them. **Correct as built; the
question is whether it is the intended end state.**

### G-A12. An athlete with no working email may have no recovery path. MEDIUM for academies.

Password reset is PKCE and only works in the browser that asked. With no email
provider configured, the link is not delivered at all. **UNVERIFIED what an
academy player with no email does.**

---

## Band 5: unknowns that block specification, not code

| Gap | What is missing |
|---|---|
| G-A13 | The exact wording of the RPE question and its scale labels |
| G-A14 | The exact wording of the weekly nutrition question and its three answers |
| G-A15 | Whether a problem report can be retracted, and whether the athlete learns it was read |
| G-A16 | What happens to an athlete's account when they leave the club |
| G-A17 | What happens to club data if the club stops paying |
| G-A18 | Whether an athlete in no positional group is told why comparisons are empty |
| G-A19 | Whether MET-036's stated visibility rule holds, given `/programme/nutrition` reads body mass |

**G-A13 and G-A14 matter more than they look.** The brief is right that wording
changes what the data means, and these are two of the four things an athlete ever
types.
