# Metrics parity: staff app and athlete app

Generated 7 September 2026. Shared registry: `docs/metrics.md`.

**The rule this document exists to enforce.** An athlete and a coach looking at
the same quantity must see the same number under the same name. If they do not,
the athlete stops believing the app, and a player who does not believe the
readiness score stops filling in the check in that produces it.

Every metric marked `Surfaces: both` in the registry appears below. There are
**nineteen**. Twenty are staff only.

---

## The one that was going to be a parity break, and is not

### MET-001 and MET-002, both called "Readiness score"

The registry carries two entries with almost the same name:

- **MET-001. Readiness score.** Five self ratings, each 1 to 5, summed over the
  answered ones and scaled to 0 to 100. Computed by a database trigger into
  `wellness_entries.readiness_score`
  (`supabase/migrations/0010_helper_functions_and_triggers.sql:253`).
- **MET-002. Readiness score, analytics version.** The same idea calculated a
  different way.

**Two definitions of one word is exactly the shape of a trust break**, so this was
raised as DECISION 7 before it was traced. Traced, it is not one.

**The athlete reads MET-001.** `src/app/(athlete)/my-data/page.tsx:564` reads
`readiness_score`, the trigger written column, and line 581 builds the chart from
it. **The staff dashboard reads the same column.** Same source, same number, same
label.

**MET-002 is used only by Analytics**, a staff screen, and the registry already
says so in MET-001's own closing paragraph: "MET-002 is the same idea calculated
a different way, and only Analytics uses it."

**Verdict: no parity break.** The risk is real and it is contained by the fact
that only one of the two ever reaches an athlete. **It stays worth watching**: if
Analytics ever becomes an athlete surface, or MET-002 is used to fill a staff
screen an athlete also sees, the two numbers meet and one of them is wrong to
somebody.

---

## The nineteen shared metrics

| ID | Athlete label | Staff label | Same definition |
|---|---|---|---|
| MET-001 | Readiness | Readiness score | **Yes.** Both read `wellness_entries.readiness_score` |
| MET-003 | Sleep | Sleep hours | **Yes.** `wellness_entries.sleep_hours`, entered by the athlete |
| MET-004 | Soreness | Soreness | **Yes.** `wellness_entries.soreness`, 1 to 5, 5 is no soreness |
| MET-005 | Body mass | Body mass | **Yes.** `wellness_entries.body_mass_kg` |
| MET-006 | The shaded band on the chart | Wellness trend band | **Yes.** Rolling mean plus or minus 1 SD over the same window |
| MET-007 | Session load | Session load | **UNVERIFIED which athlete screen renders it.** RPE and duration are both read by athlete screens |
| MET-024 | Duration | Session duration | **Yes.** `training_entries.duration_min` |
| MET-028 | Result | Test result | **Yes.** `test_results` |
| MET-029 | Best | Best attempt on a test day | **Yes.** Same rule, and see the note below |
| MET-030 | Prescribed load | Prescribed gym load | **UNVERIFIED which athlete screen renders it** |
| MET-041 | Tonnage (athlete gym page, `total_volume_kg` from `gym_session_logs_current`, 0106) | Total volume (session summary, `sessionVolumeKg`) and tonnage (My data) | **Same rule** — Σ load × reps over live sets carrying both; 0106's view and `lib/gymSummary.ts` state it identically (12 September 2026) |
| MET-031 | Protein | Protein target | **Yes.** Recomputed on every weigh in, both surfaces |
| MET-032 | Carbs | Carbohydrate target | **Yes** |
| MET-033 | Fat | Fat target | **Yes** |
| MET-034 | Energy | Energy target | **Yes** |
| MET-035 | Fluid | Fluid target | **Yes** |
| MET-036 | Your range | Body mass target range | **Yes** |
| MET-037 | Position on the board | Leaderboard rank | **Yes**, subject to the visibility rules |
| MET-038 | Why a board is hidden | Leaderboard minimum population | **Yes** |
| MET-039 | Readiness is not on any board | Same rule | **Yes.** A rule, not a number, and it applies to both |

---

## Two labels worth aligning, neither a computation difference

**MET-029, personal bests.** `src/app/(athlete)/my-data/page.tsx:1118` records a
real bug that was fixed there: ordering by `test_date` relabelled "best you have
ever done" as "best in the last window", so an athlete with a 41.6 all time best
was shown 31.0 because that was their latest session. **The fix is in the athlete
screen.** Whether the staff surface ever had the same ordering error is
**UNVERIFIED: not checked**. It is the kind of thing that is worth checking
precisely because the athlete copy of it was wrong.

**MET-006, the band.** The athlete screen calls it the shaded area and the dashed
line. The staff screen calls it the wellness trend band. Same computation,
different words, and an athlete asking a coach about "the shaded bit" will be
understood. **No action unless you want one vocabulary.**

---

## What a parity break would look like, so it is recognisable

None of these are present today. They are the failure modes to watch for:

1. **Different window.** The athlete sees a 7 day rolling mean, the coach a 14 day
   one, both labelled "recent".
2. **Different rounding.** 79.6 displayed as 80 on one surface and 79 on the
   other, from the same stored value.
3. **Different missing data rule.** One surface treats an unanswered scale as
   zero and the other excludes it. MET-001 is explicit that skipping a slider must
   not push the score down, and both surfaces inherit that because both read the
   same computed column.
4. **Different name for the same number**, which is the softest break and the
   most common. It does not produce a wrong number, it produces two people who
   cannot tell they are discussing the same thing.

---

## How to keep this true

`docs/metrics.md` is shared by both apps. Changing a formula means updating the
registry entry and re-checking this file in the same commit. Defining a metric in
one app that the other already defines differently is the thing this document
exists to prevent.
