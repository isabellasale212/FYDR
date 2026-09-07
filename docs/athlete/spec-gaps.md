# Athlete app: gap queue

Generated 7 September 2026. What the specification requires, what exists, and the
files. **Ordered by risk, highest first.** Security, data exposure and under 18
issues rank above cosmetic ones.

---

## Band 1: an athlete is told nothing about their own body

### G-A1. A player who is made unavailable is not told by the app. HIGH.

**Required.** An athlete can see their own availability, restrictions and return
to play stage.

**Exists.** The permission exists and **no screen uses it**. `injuries_self_select`
and `availability_self_select` both allow it
(`supabase/migrations/0012_rls_policies.sql:656`, `:725`), and
`injury_clinical_athlete_view` even gives them their own diagnosis, mechanism,
severity, imaging, referral and treatment plan.

**Files.** All fifteen pages under `src/app/(athlete)/`. None reads any of it.

**Why it is first.** A player finds out they cannot train from a person, or by
noticing they have vanished from the leaderboards. The database was built to tell
them and nothing asks it. **This is the single largest gap in the athlete app**,
and it is a screen, not a permission.

### G-A2. Return to play progression is invisible to the athlete. HIGH.

Same cause as G-A1, listed separately because it is the flow a rehabbing player
cares about most and it has no screen at all.

---

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
