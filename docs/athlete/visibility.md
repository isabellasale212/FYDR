# What an athlete can see

Generated 7 September 2026. Every claim carries the file and line it came from.
Where something could not be traced it says so rather than guessing.

**Read this before changing anything an athlete can read about themselves or a
teammate.**

The short version: **an athlete sees a great deal about themselves, including
their own diagnosis, and almost nothing about anybody else except a leaderboard
they can leave.**

---

## 1. Their own data

### What they can read

| Their own | Can they read it | How it is permitted | Citation |
|---|---|---|---|
| Wellness entries | Yes | `wellness_entries` self policy | `supabase/migrations/0012_rls_policies.sql` |
| Training entries and RPE | Yes | same pattern | `0012_rls_policies.sql` |
| Gym session and set logs | Yes | same pattern | `0012_rls_policies.sql` |
| Nutrition check ins and targets | Yes | same pattern | `0012_rls_policies.sql` |
| Test results and personal bests | Yes | shown on My data | `src/app/(athlete)/my-data/page.tsx` |
| **Injuries: body area, status, dates** | **Yes** | `injuries_self_select`, `athlete_id = auth_athlete_id()` | `0012_rls_policies.sql:656` |
| **Availability and restrictions** | **Yes** | `availability_self_select` | `0012_rls_policies.sql:725` |
| **Diagnosis, mechanism, severity, tissue type, imaging, referral, treatment plan** | **Yes** | `injury_clinical_athlete_view` | `0010_helper_functions_and_triggers.sql` |
| **The physio's private clinical notes** | **No** | deliberately excluded from the view | same |
| GPS records | Permitted, but no screen shows them | `gps_records_self_select` | `0023_gps_records.sql:132` |

### The one thing staff record that the athlete cannot see, and why

**`injury_clinical.clinical_notes`.** Nothing else.

The schema comment is unusually direct about it: "clinical_notes is absent. It is
absent here and nowhere else in the product."

**How that is enforced matters, because the obvious way would not have worked.**
`docs/04-data-model.md` section 14 originally sketched an athlete select policy on
`injury_clinical` plus a view that excluded the notes. Those two cannot both hold:
a select policy on the base table lets an athlete run `select clinical_notes from
injury_clinical` straight through PostgREST, and column privileges cannot help
because coach, medic, athlete and admin all connect as the same database role,
`authenticated`.

So the athlete gets **no policy on `injury_clinical` at all**. The table is medic
only for every operation. `injury_clinical_athlete_view` is their only path to
their own clinical detail, and because there is no underlying policy for it to
inherit, it runs with the owner's rights and carries its own predicates:

- `org_id = auth_org_id()`, the tenancy check, exactly as a policy would do it
- `a.user_id = auth_user_id()`, the subject check, read from the verified JWT and
  never from anything the caller can supply

A coach has no athlete row, so they match nothing. A user in another club matches
nothing. `clinical_notes` is not in the select list, so no join, column privilege
or `select *` reaches it. The view is `security_barrier`, which stops a caller
supplied volatile function in a `WHERE` clause being pushed underneath the view's
own filters.

**Why a private note is defensible.** A physio needs somewhere to record a working
thought, a suspicion, or a conversation, without it becoming a document the
subject reads that afternoon. The line drawn here is that the athlete gets the
clinical facts about their own body, including the diagnosis, and does not get the
clinician's notebook.

**The GDPR caveat, stated plainly.** UK GDPR article 15 gives a person a right of
access to personal data about them, and a private clinical note is still personal
data. The product's answer is the subject access request pack, which has a
withholding workflow where a physio marks specific notes withheld with a recorded
reason before release (`docs/09-security-and-compliance.md` section 6). **The app
not showing it is not the same as the club refusing it**, and a club asked for a
subject access request must go through that process rather than pointing at this
screen.

### A right that no screen exercises

**No athlete page under `src/app/(athlete)/` was found reading injuries,
availability or `injury_clinical_athlete_view`.** Searched all fifteen pages.

So the database permits an athlete to see their own diagnosis and restrictions,
and **no screen shows it to them**. That is DECISION 8 in
`docs/athlete/decisions-required.md`, and it is a real gap rather than a
technicality: a player who is unavailable is told so by a person, not by the app.

**UNVERIFIED: whether Today surfaces availability in some other form.** Looked in
`src/app/(athlete)/today/page.tsx`, `my-data/page.tsx` and `me/page.tsx`.

---

## 2. Other players

### Almost nothing, and that is the design

There is no squad list, no teammate profile and no way to look up another player
in the athlete app. The four tabs are Today, My data, Gym and Me
(`src/components/AthleteTabBar/AthleteTabBar.tsx:24`), and none of them is a
directory.

**The single exception is the leaderboard.**

### Leaderboards

| Question | Answer | Citation |
|---|---|---|
| Which metrics | Only metrics marked `leaderboard_eligible`, with an `ineligible_reason` recorded for the rest | `src/lib/queries/leaderboards.ts:22` |
| Is readiness rankable | **No, deliberately** | `docs/metrics.md` MET-039 |
| Whole squad or a group | Board defined per leaderboard, with a `min_population` floor | `leaderboards.ts:22` |
| Named or anonymised | Named | `src/app/(athlete)/my-data/boards/[leaderboardId]/page.tsx` |
| Can an adult leave | Yes, opt out, and it cannot be taken away | `leaderboard_opt_outs`, `opt_out_source = 'athlete'` |
| Can an under 18 be on one | **Only if they opted in themselves** | `supabase/migrations/0016_leaderboards.sql:370` |
| Does an unavailable player appear | **No** | `0016_leaderboards.sql:360` |
| Can a medic suppress somebody | Yes, separately | `opt_out_source = 'medic'`, `leaderboard_opt_outs_medical_insert` |

**Three protections, and each is enforced in the query rather than the client.**

**Availability.** A player whose latest availability row is anything other than
`available` is excluded from every board. So a player who is injured does not
find themselves ranked last while they are out.

**The adult opt out is irrevocable by the club.** `leaderboard_opt_outs` carries a
`check (allow_opt_out)` in the database, on GDPR article 7(3) grounds: consent
that cannot be withdrawn was never consent. A club cannot switch a player back on.

**The under 18 rule is opt in, not opt out**, which is Children's Code standard 7:

    and (
      not athlete_is_minor(a.id)
      or exists (select 1 from athlete_consents c
                 where c.athlete_id = a.id
                   and c.purpose = 'leaderboard_visibility'
                   and c.granted_at is not null
                   and c.withdrawn_at is null)
    )

`athlete_is_minor()` **fails safe**: an athlete with no date of birth is treated
as a minor. Its own comment gives the reason, "the other failure puts a fifteen
year old on a public ranking".

There is also a per device hide, `fydr-hide-leaderboards` in `localStorage`
(`src/lib/leaderboardVisibility.ts:24`). That is a display preference on one
phone, not a consent record, and it does not remove the athlete from anybody
else's board.

---

## 3. Under 18 players

| Protection | Built | Citation |
|---|---|---|
| Age is known and derived, never stored twice | Yes | `athlete_age_years()`, `0010_helper_functions_and_triggers.sql:336` |
| A screen can ask "is this a child" without receiving a date of birth | Yes | `athlete_age_view`, exposes `is_minor` and `is_under_13` only |
| No date of birth is treated as a child | Yes | `athlete_is_minor()` |
| The helper cannot be called by an anonymous caller | Yes, revoked twice | migrations 0035 and 0036 |
| Leaderboards are opt in for minors | Yes | `0016_leaderboards.sql:370` |
| Parental consent is recorded | Yes, as data | `athletes.parental_consent_recorded_at`, `_by`, `_method` |
| An athlete cannot be activated without a date of birth | Yes | `athletes_dob_required_when_linked` |
| **Tighter notification limits for minors** | **NOT BUILT** | specified at `docs/09-security-and-compliance.md:507` |

**Does a parent or guardian have any access?** **No.** `parental_consent_recorded_by`
records which staff member recorded the consent and by what method. There is no
guardian login, no guardian view and no guardian account type anywhere in the
schema. **A parent cannot see their child's data through this product.**

**How consent is recorded.** By a staff member, on the athlete record, with a
method and a timestamp. It is an assertion by the club that consent was obtained,
not a consent captured from the parent directly.

---

## 4. What staff see the moment an athlete submits something

| The athlete submits | Who sees it, and when | Can the athlete change it |
|---|---|---|
| Wellness check in | Immediately on the staff dashboard, and it feeds readiness and flags | **No.** Immutable once submitted. A correction creates a new revision row and marks the old one superseded |
| Session RPE | Immediately, and it feeds session load | Same |
| Gym set logs | Immediately | Same |
| Nutrition check in | Immediately, weekly | Same |
| Report a problem | Lands in the medic's triage queue on the staff Injuries screen | **UNVERIFIED: whether the athlete can retract it.** Looked in `src/app/(athlete)/report-problem/page.tsx` and `src/lib/queries/problemReports.ts` |

**Immutability is a product rule, not an accident.** `CLAUDE.md` rule 6: wellness,
gym and nutrition entries are immutable once submitted, because performance data
that can be silently edited is worthless for trend analysis. Every one of those
tables carries `revision_of` and `superseded_by` columns with check constraints
stopping a row pointing at itself.

**Is the athlete notified that staff saw it?** **UNVERIFIED: not found.**

---

## 5. Data rights

### Export

`/me/export` produces a multi section CSV: profile, wellness, training, gym sets,
nutrition check ins, nutrition targets
(`src/app/(athlete)/me/export/route.ts:15`).

**It is the article 20 portability set only**, meaning data the athlete provided.
It is deliberately **not** the article 15 subject access pack, which needs the
withholding workflow described in section 1 above and is generated by an admin.
The route's own header says so.

Every export is written to `audit_log` with report type `my_data`.

### Deletion

**NOT BUILT.** An athlete cannot delete their own account in either surface.
Erasure is an audited staff process (`src/lib/retention/`). This is DECISION 3,
and Apple guideline 5.1.1(v) makes it a blocker for any future native app.

### Leaving the club, or the club leaving Fydr

**UNVERIFIED: not found.** Looked in `src/lib/retention/`, `docs/09-security-and-compliance.md`
section 5 and `docs/12-product-tiers.md`.

What is known: `athletes.left_at` exists, athlete data is never hard deleted
(`CLAUDE.md` rule 4), and the article 17 table in the compliance document sets out
what is erasable on request, with injury records generally retained under article
17(3)(b) and (c). **What actually happens to a player's account when they leave,
and what happens to a club's data if they stop paying, is not specified anywhere I
could find, and it is a question every club will ask.**
