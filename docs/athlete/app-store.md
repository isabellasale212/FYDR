# App Store readiness

Generated 7 September 2026.

**There is no iOS app.** Stage A0 established it and re-verified it today: no
Xcode project, no Swift, no React Native, no Expo, no bundle identifier, no
provisioning profile, no privacy manifest. The athlete app is responsive web.

**So this document is forward looking**, which is the answer recorded in Stage A0
to question 2. It is what a native shell would need, derived from the data the web
app already writes. The privacy answers below will not change when a shell wraps
them, because they come from the tables rather than from the packaging.

---

## 1. Account deletion, guideline 5.1.1(v)

**NOT BUILT, and it is a hard blocker.** Apple requires in app account deletion
for any app that supports account creation.

**Where it would live.** `/me`, the athlete's own settings screen.

**The design work is not the button.** An athlete's record is club held data the
club may have a lawful basis to keep. `docs/09-security-and-compliance.md` section
5 sets it out per data type:

| Data | Erasable on request | Why |
|---|---|---|
| Wellness, RPE, gym logs, GPS, test results | **Yes, generally** | Once they have left, the club's interest in their subjective wellness scores will not survive a balancing test |
| Injury records and clinical detail | **No, generally not** | Article 17(3)(b) and (c): occupational health, and defence of a personal injury claim |
| Availability history tied to injuries | **No** | Part of the injury record |
| Identity and contact details | **Partially** | Keep the minimum needed to link retained injury records, pseudonymise the rest |
| Audit log | **No** | Article 17(3)(b). It is the evidence that processing was lawful, including the erasure |

**So "delete my account" cannot mean "delete my data", and the screen has to say
so honestly without sounding like a refusal.** That sentence is the actual work.

---

## 2. Privacy nutrition label

Every answer below is tied to the table it comes from. **Nothing here is
inferred from a category list.**

| Apple category | Collected | Linked to identity | Used for tracking | Source |
|---|---|---|---|---|
| Contact info: name | **Yes** | Yes | No | `athletes.first_name`, `.last_name`, `.preferred_name` |
| Contact info: email | **Yes** | Yes | No | `users.email` |
| Health and fitness | **Yes** | Yes | No | `wellness_entries`, `training_entries`, `injuries`, `injury_clinical`, `test_results`, `gps_records` |
| Sensitive info | **Yes** | Yes | No | `injury_clinical`: diagnosis, mechanism, imaging, referral |
| Identifiers: user ID | **Yes** | Yes | No | `auth.users.id` |
| Usage data | **Yes** | Yes | No | `audit_log` records reads and writes with actor, role and IP |
| Diagnostics | **UNVERIFIED** | | | No crash reporter found |
| Location | **No** | | | GPS records are vendor imported session summaries, not device location |
| Purchases, financial | **No** | | | There is no billing surface, permanently |
| Contacts, photos, browsing | **No** | | | Not collected |

**Date of birth is collected** (`athletes.date_of_birth`) and is the basis of the
under 18 protections. Apple has no separate category for it; it sits under contact
info.

**Nothing is used for tracking**, in Apple's sense of linking to third party data
for advertising. There is no advertising, no analytics SDK and no third party
identifier anywhere in the codebase.

---

## 3. Age rating, and the consequence of under 18 users

**Athletes under 18 are expected, not exceptional.** Academy players are a named
part of the product.

`docs/09-security-and-compliance.md:293` is unambiguous: the Children's Code
applies in full to every athlete under 18, and a 16 or 17 year old is a child for
this purpose. **There is no partial compliance.**

What is already built, and would carry into a native app unchanged:

- age derived, never stored twice, and never exposed as a date of birth to a
  screen that only needs the boolean (`athlete_age_view`)
- **no date of birth means treated as a minor**, failing safe
- leaderboards opt in for minors, enforced in the board query
- three notification types forced off for minors

**A 4+ rating is defensible on content.** The real consequence is not the rating,
it is that the Children's Code obligations already apply and are already partly
implemented.

---

## 4. HealthKit usage descriptions

**NOT BUILT.** There is no HealthKit integration: no native code, and no table
holds device sourced sleep, resting heart rate or HRV. What exists is a consent
row, `athlete_consents.purpose = 'healthkit_sync'`, and a toggle on `/me` behind a
Premium check.

**A native app must not ship the toggle without the integration.** Requesting a
HealthKit permission for data the app never reads is a rejection risk under
guideline 5.1.1, and it misleads the athlete.

If it is built, the strings would need to name the purpose specifically. Apple
rejects generic ones:

| Data type | Why Fydr would read it | Suggested string |
|---|---|---|
| Sleep analysis | To fill in the sleep hours an athlete would otherwise type each morning | "Fydr uses your sleep data so you do not have to enter last night's sleep by hand." |
| Resting heart rate | As a wellness input alongside the self ratings | "Fydr shows your resting heart rate beside your own readiness so you can see them together." |
| Body mass | To keep nutrition targets current without a manual weigh in | "Fydr uses your weight to keep your nutrition targets up to date." |

**All three are guesses at wording and are labelled as such.** The justification
for each is real; the sentences are not written anywhere yet.

---

## 5. Sign in requirements

**Sign in with Apple would be required** if the app offers any third party sign
in, under guideline 4.8. **Today it offers none**: email and password through
Supabase Auth, and nothing else. So Sign in with Apple is **not** required as
things stand, and would become required the day a Google or Facebook button
appears.

**There is no anonymous or guest mode.** An athlete cannot use the app without a
club inviting them, which is correct for the product and worth stating in review
notes, because a reviewer with no account cannot see past the sign in screen.
**A demo account will have to be provided.**

---

## 6. Likely rejection triggers

| Risk | Guideline | State |
|---|---|---|
| No in app account deletion | 5.1.1(v) | **Blocker. NOT BUILT** |
| A reviewer cannot get past sign in | 2.1 | **Blocker unless a demo account is supplied** |
| HealthKit permission for data never read | 5.1.1 | **Blocker if the toggle ships without the integration** |
| Health data and minors | 5.1.1, 1.3 | Partly handled. The Children's Code work already done is the strongest part of the case |
| A web view wrapper with no native value | 4.2 | **Real risk.** A shell around the existing responsive site, with no offline, no push and no HealthKit, is close to what 4.2 exists to reject |
| Privacy policy link | 5.1.1 | **UNVERIFIED: not found in the app** |

**The 4.2 risk deserves the most thought.** The web app is complete and good. A
native shell that adds nothing except an icon is the case Apple rejects. Push
notifications and HealthKit are the two things that would make a shell worth
having, and **neither is built**.
