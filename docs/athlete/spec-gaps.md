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

### Tier 1 and Tier 2: what was decided and built, 2026-09-08

**Tier 1 is built and deployed.** The availability banner carries the injury, its
recovery stage and an expected return date. No new screen and no migration: the
injury was already fetched on every Today load and discarded, and `status` was
one column short of being selected.

**Tier 2 is built, diagnosis only.** Confirmed by Isabella after looking at
diagnosis-only on a real record through a temporary local-only preview, which has
since been deleted.

**THE CONFIRMED SCOPE IS TWO FIELDS OF SEVEN**, each confirmed separately after
looking at the real text on a real record.

| Field | On the athlete's screen | Why |
|---|---|---|
| `diagnosis` | **Yes** | Confirmed 2026-09-08 after review on screen |
| `mechanism` | **Yes** | Confirmed 2026-09-08, after reading every mechanism on file rather than one sample. They are short factual phrases under ten words — "Inversion in a ruck", "Gradual onset, overload" |
| `imaging` | No | Held back, a bigger step than the DB permission implies |
| `treatment_plan` | No | Held back, same reason |
| `severity`, `tissue_type`, `referral` | No | Not requested, not shown |
| `clinical_notes` | No | Not a column of the view at all |

**The database stays more permissive than the screen, deliberately.**
`injury_clinical_athlete_view` still exposes all seven fields to an adult
athlete; `fetchAthleteInjuryClinical` selects two. That gap is the design, not an
oversight: the restraint lives in one select list where the next decision can be
read and changed. `scripts/test-injury-clinical.ts` therefore asserts the five
columns NOT selected — asserting the two shown fields appear would pass just as
well if all seven were fetched.

**`mechanism` has no format constraint and its athlete-safety rests on data-entry
discipline rather than on anything in the code. See G-A13 below.**

**The age gate is in the database, and it had to be.** Migration `0093` adds the
predicate to the view. It does NOT call `athlete_is_minor()`, which was the first
attempt: that function is SECURITY DEFINER with EXECUTE granted to `postgres` and
`service_role` only, and a view's owner rights cover the TABLES it reads while
EXECUTE on a function it calls is still checked against the caller — so an
owner-rights view calling it fails for `authenticated` exactly as application
code would. The view expands the same rule from `athlete_age_years`, which is not
definer and which `athlete_age_view` already uses to expose `is_minor` to
athletes. Test `490` pins the two to each other at the boundary, one day short of
eighteen, because the threshold now appears in three places.

**Two things found while building the gate, both worth knowing:**

1. **A linked athlete cannot have a null date of birth.** The check constraint
   `athletes_dob_required_when_linked` refuses it, and the view only returns rows
   where `user_id is not null`. The "fails safe on unknown age" case is therefore
   unreachable for this view's whole population. The view still carries its own
   `is not null` test, so relaxing the constraint would not open the gate, and
   490 asserts both facts rather than asserting behaviour for a row that cannot
   exist.
2. **The gate covers clinical detail only.** A minor still sees the availability
   banner and the injury line — body area, recovery stage, expected return —
   because those come from `injuries`, which is the general tier a coach also
   reads. Verified on screen: a sixteen-year-old Selby sees "Head · Return to
   play" and no diagnosis. That split is deliberate, and it is the right one:
   withholding the general tier would leave a minor unable to learn they are
   injured at all.

**Still open, and not blocking:** what a minor sees INSTEAD of the diagnosis.
Nothing is the safe default and is what is built. The component renders no
"withheld" message on purpose — an athlete told something is being withheld
learns the withheld thing exists, which for a minor is the disclosure the gate
prevents.

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

### G-A13. `mechanism` is athlete-visible and unconstrained. MEDIUM, and it is a process gap before it is a code one.

**What changed.** As of 2026-09-08 `injury_clinical.mechanism` renders on the
athlete's own Today screen, for any athlete 18 or over, alongside the diagnosis.
Before that date it was medical-only in practice, because no code read it.

**What constrains it: nothing.**

| | |
|---|---|
| Column type | `text`, nullable — **no length limit** |
| Check constraints mentioning it | **none** |
| Application validation | **none.** `InjuryMedicalForm.tsx:202` is a bare `<input>`; the only processing is `.trim() \|\| null` at line 76 |
| Guidance shown to the medic entering it | **none.** The label reads "Mechanism" and nothing else |

**Why that matters now.** The intended content is a factual description of how
the injury happened, and today's entries are exactly that — 38 characters on
average, 61 at the longest, in the shape of "Inversion in a ruck" or "Gradual
onset, overload".

**But one of the eight already is not.** Adam Selby's reads *"Head to hip contact
making a tackle, no loss of consciousness"*. The clause after the comma is a
clinical assessment finding, not a description of an event — and it is now on
that player's phone. It happens to be reassuring. The next one might not be.

**A free-text field with no limit, no format and no guidance, rendered to the
person it is about, is safe only for as long as everyone entering it remembers
that it is.** That is a real property of the system as built, and it is worth
stating plainly rather than trusting.

**Two possible answers, and they are not exclusive:**

1. **Tell the medical staff** — the immediate one, and Isabella's to do. It is on
   the architecture to-do list. Nothing in this repository can substitute for it.
2. **Make it a code guarantee later**, if that turns out to be wanted. The
   options, roughly in increasing cost: helper text under the field naming who
   sees it; a length cap; splitting the column into a structured mechanism (an
   enum of contact / non-contact / overuse / gradual onset) plus a free-text note
   that stays medical-only. **The last is the only one that is an actual
   guarantee**; the first two only make the discipline easier to keep.

**Not urgent, and deliberately not built.** The right order is to tell people
first and see whether discipline holds, because a constraint designed before
anybody has misused the field will constrain the wrong thing.

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
