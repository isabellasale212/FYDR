# Cross app flows

Generated 7 September 2026. Eight journeys that cross both surfaces, naming the
screen on each side and the tables in between.

**Both surfaces are one Next.js application on one Vercel deployment, reading one
Supabase project.** There is no synchronisation step between them: when a staff
member writes a row, the athlete's next read sees it, and the reverse. That is
worth stating because most of the risk people expect in a cross app flow, drift
between two stores, does not exist here.

---

## 1. Staff invite a player, the player accepts, the player appears in the squad

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Staff | `/squad/new`, or bulk invite | `athletes`, `users` |
| 2 | System | An invite link is generated | `auth.users` |
| 3 | Athlete | `/auth/confirm` verifies a `token_hash` server side and signs them in | `auth.sessions`, `audit_log` as `auth.signed_in` with `method: invite` |
| 4 | Athlete | `/login/reset/confirm?invite=1` to set a password | `auth.users` |
| 5 | Athlete | Lands on `/today` | none |

**No temporary password ever exists.** Removed deliberately (G-03 and D-38,
decided 5 September) because squad credentials then travel by whatever channel is
to hand.

**An athlete cannot be activated without a date of birth**
(`athletes_dob_required_when_linked`), which is what makes every later minor check
trustworthy.

**Email delivery is usually a no op.** With no provider configured the link is
returned on screen for the inviter to pass on.

---

## 2. A player submits wellness, staff see it and act

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Athlete | `/check-in`, five scales and sleep hours | `wellness_entries` |
| 2 | Database | A trigger computes readiness on save | `wellness_entries.readiness_score` |
| 3 | Database | Thresholds evaluate overnight and raise flags | `flags` |
| 4 | Staff | Dashboard shows the entry and the open flags card | `flags`, `wellness_entries` |
| 5 | Staff | A flag is acknowledged | `flag_actions`, `audit_log` |
| 6 | Athlete | `athlete.flag.shared` would notify them. **Nothing sends it** | `notification_preferences` |

**The athlete and the coach read the same readiness number from the same column.**
No parity break. See `docs/metrics-parity.md`.

**The athlete cannot correct their own entry.** Migration 0058 made
`revise_wellness_entry` coach and medical only at the club's request.

---

## 3. S&C assigns a gym programme, the player completes it, staff see completion

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Staff | Programme builder | `programmes`, `programme_blocks`, `programme_assignments` |
| 2 | Athlete | `/programme` shows it, blocks and all | same, read |
| 3 | Athlete | `/gym/[sessionId]` resolves the prescription **for this athlete** | `exercise_overrides`, `test_results` for percent of 1RM |
| 4 | Athlete | Logs sets | `gym_session_logs`, `gym_set_logs` |
| 5 | Staff | The athlete's gym tab shows what was actually lifted | same, read |

**The prescription an athlete sees is already personal** (migration 0043):
exemptions remove an exercise entirely, substitutions and volume overrides apply,
load caps bind, and a percent of 1RM resolves against the athlete's own latest
result or says plainly that it cannot.

**If the athlete has an open injury, an S&C assignment becomes a proposal** and
does not reach them until a medic signs it off (migrations 0079 to 0081).

---

## 4. A medic marks a player unavailable

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Staff | Injuries, medic only | `injuries`, `injury_clinical`, `availability` |
| 2 | Database | The row is audited by trigger | `audit_log` |
| 3 | Athlete | **Permitted to read it, and no screen shows it** | `availability_self_select` |

**This is the largest gap in the athlete app.** The athlete can read their own
availability and restrictions, and their own diagnosis through
`injury_clinical_athlete_view`, and **no athlete screen reads any of it**. A
player who has been made unavailable finds out from a person.

They are also removed from every leaderboard while unavailable
(`supabase/migrations/0016_leaderboards.sql:360`), which they will notice without
being told why.

---

## 5. Return to play progression

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Staff | Medic advances the stage | `injuries`, `injury_clinical` |
| 2 | Athlete | **UNVERIFIED: nothing found that shows a stage to an athlete** | none |

**UNVERIFIED: not found.** Looked in all fifteen athlete pages. The data is
readable by the athlete and no screen reads it. Same gap as flow 4.

---

## 6. The weekly one tap nutrition check in

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Athlete | Today shows it is owed, weekly | none |
| 2 | Athlete | `/nutrition-check-in`, **the week that just ended** | `nutrition_checkins` |
| 3 | Staff | The nutritionist's screens | same, read |

**Missing it is not non compliance** (`CLAUDE.md` rule 8), and there is no
nutrition compliance domain.

---

## 7. A GPS session is imported

| Step | Surface | Screen | Tables |
|---|---|---|---|
| 1 | Staff | Vendor CSV import, sport scientist only | `gps_records`, `import_batches` |
| 2 | Staff | Training report and analytics | `gps_records` |
| 3 | Athlete | **Nothing. No athlete screen shows GPS** | `gps_records_self_select` exists and is unused |

**An athlete is permitted to read their own GPS and no screen renders it.** The
migration's own comment says a read is owed but the screen for it is not built.

So there is **no explanation of GPS to a player anywhere in the product**, and
also no tier leak, because there is nothing to leak.

---

## 8. A player leaves, or the club stops paying

| Step | Surface | What happens |
|---|---|---|
| A player leaves | Staff | `athletes.left_at` is set. Athlete data is never hard deleted |
| Their account | **UNVERIFIED** | Whether the login is disabled, and what the player sees, was not found |
| Erasure on request | Staff | An audited retention process, with the article 17 table deciding what survives |
| The club stops paying | **UNVERIFIED: not found** | Looked in `src/lib/retention/`, `docs/12-product-tiers.md` and `docs/09-security-and-compliance.md` |

**Both unverified rows are questions every club will ask before signing.**
