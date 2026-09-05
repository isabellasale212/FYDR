# Journeys

Five things a person actually does in Fydr, followed from beginning to end across
however many screens they take.

**Why this exists.** Every screen is specified alone. A specification of parts
cannot show that a queue has no route to it, or that a plan stops following the
athlete it was written for. **Four of these five journeys run into an open
decision, and in each case the journey makes the case better than the decision
entry does.**

**How to read a step.** Each names the screen, its numbered specification, and
what happens. Where a step is blocked or missing, it says so in place rather than
in a footnote, because that is where a person would meet it.

**These describe what happens today.** Where today differs from the agreed
specification, the step says which decision covers it.

---

## Journey 1: a coach's Monday morning

**The one journey with a stated success criterion.** The dashboard exists to
satisfy it: *a coach can go from opening the app to identifying the three athletes
needing attention in under 15 seconds, without applying a filter manually.*

**1. Open the app.** Signing in lands a coach on the **Dashboard** (01). No
filter is applied: the criterion says so explicitly, and the group filter defaults
to the whole squad.

**2. Read the attention list.** The ranked list of athletes with a one line reason
each. This is the screen; everything else on it is packaging.

**3. Glance at the five tiles.** Need you, wellness in, available, open flags,
days to matchday. Two of them expand in place rather than navigating, which was a
deliberate choice: expanding shows the names right there, where linking to a
squad-wide page would have made a coach re-filter to find the people the tile was
already counting.

**4. Open the first athlete.** From the attention row to the **Athlete profile**
(03). Their readiness against their own normal range, their availability, their
flags.

**5. Decide something.** Set availability, or leave it. If they set it, the
previous record closes and a new one opens: the athlete now has a history.

**6. Check the week.** Back to the dashboard's **Ready for Saturday** card, or on
to the **Schedule** (07). How many can be named, who is doubtful, what is left to
run.

**Where this journey is good.** It is short, it is one click deep, and the
dashboard was rebuilt on 4 September specifically so that the selection picture
and the availability split stopped being two cards saying the same thing.

**Where it breaks.**

**Nothing tells a coach that nothing is being watched.** If the club has no
thresholds, the attention list is empty and the open flags tile reads zero, which
is indistinguishable from a good morning. Amended decision D-39, and
`docs/first-run.md` §5.

**The Week load card may be empty for a reason nobody states.** It is built
entirely from GPS, which is Premium, on a screen that is Base. Decision D-23.

---

## Journey 2: an injury, from report to return

**The longest journey in Fydr, and the one that crosses the most boundaries.**

**1. The athlete reports a problem.** In their own app, at
`/report-problem`, choosing an optional category and writing what is wrong
(`src/components/ProblemReportForm/ProblemReportForm.tsx`).

**2. It arrives in a queue only a medic can see.** Problem reports are medical
only by design, enforced by the database. A coach cannot read them at all, and is
not told they exist.

**3. And nothing links to that queue.** The triage panel sits on the **Injuries**
screen (25), which is **not in the sidebar**. A medic signing in has no navigation
route to the one queue only they can work. **Decision D-34.**

*This is the step where the journey most clearly shows what a screen
specification cannot: the panel is correctly built, correctly gated, and
effectively invisible.*

**4. The medic triages it.** Acknowledge, note, or close
(`src/components/ProblemReportsTriage/ProblemReportsTriage.tsx:9`). The report
moves through open, acknowledged, closed.

**5. If it is real, the medic records an injury.** At **New injury** (27), which
is **medical only** and correctly so. A coach cannot create one, which is the
answer decision D-35 proposes for the rest of this area.

Body area, side, onset, where it happened. **No clinical detail is captured here
by anyone**, including the medic: creating the record and recording the diagnosis
are two acts.

**6. The medic adds clinical detail.** On the **Injury record** (26), in the panel
only they can see. Diagnosis, mechanism, severity, tissue type, imaging, referral,
notes, treatment plan. **A coach is not told this panel exists**, and its absence
is silent, which is correct: telling a coach there is a diagnosis they cannot see
is itself a disclosure.

**7. Somebody sets availability.** A separate act again. **Today a coach can do
this**, which the seed data says should be the physio's alone. Decision D-35.

**8. The squad sees the consequence.** The athlete appears as modified or
unavailable on the **Dashboard**, the **Squad overview** (02), the **Injury
report** (24) and the **Squad weekly report** (21), in the limited view: body
area, restrictions, expected return, never a diagnosis.

**9. Rehab.** The athlete joins a group on **Rehab groups** (28).

**10. Return.** The medic moves the injury through rehab and return to play to
closed, in any order, since no ordering is enforced. Availability goes back to
available, as a new record.

**11. The injury is never deleted.** It is closed. Deletion exists only for the
audited erasure process.

**Where this journey breaks, in order of severity.**

**A nutritionist can currently see all of it.** Every step from 8 onward is
visible to a role your agreed model excludes entirely. **Decision D-01**, the
highest ranked gap in the specification.

**The queue at step 3 is unreachable by navigation.** D-34.

**Availability is a coaching act at step 7 and a medical one everywhere else.**
D-35.

---

## Journey 3: planning a training week

**1. A coach defines the shape once.** **New week template** (13): which days
carry what, at what time, for how long.

**2. And applies it to a week.** **Apply a week template** (15). This is the
largest single write in the schedule area.

**What it does well.** It does not blindly add. Sessions already occupying the
positions the template would fill are **soft deleted** and replaced, and if every
position is already filled it refuses outright and says so. Sessions are written
in one batch, so a week is never half created, and if the second write fails the
screen says *Sessions created, but rostering failed* rather than leaving a coach
to discover it.

**3. Compliance does not follow immediately.** The sessions exist. The expectation
records that compliance is measured against are generated **on a nightly run**.
**Decision D-30.**

*A coach who builds next week on Sunday evening sees a week that reads as
unmeasured until Monday.* The generator exists and is safe to call more than once;
only the call is missing.

**4. The week runs.** Athletes submit ratings, attendance is recorded, GPS is
uploaded if the club is on Premium.

**5. The coach reads it back.** **Training report** (23), which scores each session
against a typical session **of the same title**.

**Where this journey has a trap.** Step 1 and step 5 are connected in a way
nothing states. **If session titles change, the report loses its reference.**
Rename Tuesday's "Conditioning" and it becomes a kind of session that has never
happened before. **Decision D-33**, and `docs/first-run.md` §4 for the version of
this that bites a new club.

---

## Journey 4: a nutrition plan

**The journey that demonstrates a defect better than its decision entry does.**

**1. The nutritionist writes a rule.** **New nutrition target** (32): grams per
kilogram of body weight for protein, carbohydrate, fat and fluid, scoped to the
club, a group or one athlete. Optionally an energy cap.

**The premise, in the design's own words**, is that a plan is a set of rules per
kilogram rather than a list of numbers, so that a target recomputes on its own as
the athlete changes.

**2. They assign it.** On **Nutrition** (31). Every affected athlete's absolute
target is worked out from their **latest recorded weight**, the previous target is
closed, and a new one is written carrying a sentence saying what it was computed
from and at what weight.

**3. The athlete sees their targets.** In their own app, and staff see them on
**Athlete nutrition** (06).

**4. The athlete gains four kilograms over a month.**

**5. Nothing happens.**

**The target does not move.** The only thing in Fydr that recomputes a target is
assigning a plan, and a weigh-in is not that. The athlete keeps the target
computed against the weight they were in step 2, indefinitely, until a
nutritionist thinks to re-apply the plan. **Decision D-28.**

**What limits the harm, and it is real.** Every auto-computed target carries its
own explanation naming the weight it used: *Auto-computed from Squad default
(training day) at 96.4 kg*. A nutritionist who reads it can see the staleness.
**Nothing points it out to them.**

**Two further things a nutritionist should know**, both correct and both
surprising:

**The day multipliers cannot be edited.** Training is 1, match day 1.25, rest day
0.58. The nutritionist controls the rate and which day applies, never the
multipliers.

**Energy is derived and can disagree with the macros beside it.** When a cap is in
force the total is clamped, so it will not equal protein times four plus carbs
times four plus fat times nine. Intended, and a screen showing both without
explaining it looks broken.

---

## Journey 5: onboarding a club

**This journey stops at step two.**

**1. The club exists.** An organisation and at least one staff account.

**2. Add the squad.** **There is no screen.** No route, no insert, nothing in the
application source creates an athlete record. Gap G-14, decision D-16.

Everything after this is written for completeness and cannot currently be reached
through the app.

**3. Invite the athletes.** **Invite athletes** (50) links accounts to athlete
records **that already exist**. It cannot create one. It also sends nothing:
accounts are created with temporary passwords returned on screen, which the
operator must distribute themselves. **Decision D-38.**

**4. Create groups.** **New group** (56). These filter every multi-athlete screen
from then on.

**5. Set availability.** Per athlete, on the profile. Until this is done every
athlete reads as **unknown**, which is honest and looks alarming.

**6. Seed the thresholds.** **Thresholds** (58) detects a club with no rules and
offers five sensible defaults in one click, with the fifth deliberately switched
off because it would flag the whole squad on day one. **This step is well built
and almost nobody will find it**, because nothing prompts it. Amended D-39.

**7. Build the first week.** Journey 3.

**8. Wait.** Readiness works immediately. The trend band needs 14 days. The acute
to chronic ratio needs 21 of 28. A leaderboard needs its minimum population. See
`docs/first-run.md` §3.

**What this journey shows that no screen specification does.** **Six of the eight
steps are built, and the app cannot be started because the second is not.** A
specification organised by screen shows six good screens. Organised as a journey,
it shows a product that cannot be opened.

---

## What the five journeys have in common

**Every one runs into at least one open decision**, and three of the four highest
ranked gaps in `docs/spec-gaps.md` appear in a journey before they appear as a
symptom on any single screen.

**Three defects are only visible from a journey.**

**The medic's queue has no route to it** (D-34). Every screen involved is correct.

**Nutrition targets stop following the athlete** (D-28). Both screens are correct;
the connection between them is missing.

**A club cannot be started** (D-16). Six of eight steps work.

**That is the argument for keeping this document.** A screen specification
guarantees each part is right. It cannot tell you the parts do not join up.

---

## What is not here

**Two journeys worth writing later.**

**A subject access request, end to end.** It crosses two roles by design, has a
legal deadline, and ends in data leaving the building permanently. It is the
journey with the highest consequence and the fewest people who will ever walk it.

**An athlete's own week.** Check in, rate a session, log a gym session, read My
Data. It sits mostly in the athlete app, which is outside this specification's
scope. Item 6 of `docs/specification-additions.md`.
