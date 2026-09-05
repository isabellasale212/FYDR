# First run: a club's first fortnight

What Fydr shows a club that has just started, and what it should say at each
stage.

**Why this exists.** Every screen specification has an "empty" line in its states
section, and those were written as edge cases. **For a club in its first
fortnight, empty is the entire experience.** Nothing describes that stretch as a
whole, and one of its states is already a medium risk gap.

**The clubs least able to notice a problem here are exactly the ones who hit it.**
A club six months in knows what a full dashboard looks like. A club on day three
does not, and cannot tell a quiet squad from a squad nobody is watching.

---

## The rule this document proposes

**Every absence must say which kind it is. There are four, and they mean
completely different things.**

| Kind | What it means | What a coach should do |
|---|---|---|
| **Nothing was expected** | No expectation record exists for this day or period | Nothing. This is correct |
| **Something was expected and did not arrive** | An athlete owed an entry and has not given it | Chase the athlete |
| **Enough arrived, but not enough to compute this** | A trend or ratio needs more history than exists | Wait |
| **Nothing is configured to watch for it** | No rule exists, so nothing can ever be raised | Configure it |

**The fourth is the dangerous one**, because it looks identical to good news.

**Fydr already draws the first two distinctions carefully.** Compliance shows an
empty mean rather than zero percent when nothing was expected. Readiness shows
blank rather than zero when no check-in exists. That care is real and this
document extends it rather than introducing it.

**The third is drawn but not explained.** Three different silences exist for three
different reasons and a coach cannot currently tell them apart:

- The wellness trend band needs **14 days** and draws nothing before that
- The acute to chronic ratio needs **21 of the trailing 28 days** and is withheld
  below that
- A leaderboard needs its **minimum population**, three by default, and refuses to
  display below it

Three absences, three causes, and only the third currently says why.

**The fourth is not drawn at all.** That is decision D-39, restated in section 5
below with a correction.

---

## Stage 1: an empty club

**What exists.** An organisation, and at least one staff account. Nothing else.

**What the app shows.** Every screen renders its own empty state. Eighty eight
empty states exist across the staff app, so this is not an unhandled case: it is a
handled one that nobody has read end to end.

**Where it stops, and this is the finding.** **There is no way to add an athlete.**
No screen, no server route, no insert anywhere in the application source. A club
that has just signed up cannot enter its squad
(gap G-14, decision D-16).

Everything downstream depends on that. Groups can be created but have nobody to
put in them. Sessions can be scheduled but nobody is expected at them. A
leaderboard can be built and will never populate.

**So the honest first-run specification has to describe a first step that does not
exist.** Until it does, a club's squad arrives by a route outside the app.

**What should happen at this stage.** The dashboard should say the squad is empty
and point at adding athletes, rather than showing five tiles of zeroes. A zero
that means "no athletes" and a zero that means "nobody needs you today" are
opposite messages.

**UNVERIFIED: what the dashboard currently renders with no athletes at all.**
Files searched: `src/app/(staff)/dashboard/page.tsx`,
`src/lib/queries/dashboard.ts`. This is a Run level question and no Run level
check has been made.

---

## Stage 2: athletes, but no data

**What exists.** A squad. No wellness entries, no sessions run, no test results,
no GPS.

**What is correct today.** Charts render empty rather than at zero. Compliance
shows an empty mean rather than zero percent. Availability shows **unknown** for
every athlete, which is the honest answer: nobody has been assessed.

**The one thing worth changing.** The dashboard's availability split leaves
unknown athletes out of all three counts, so a squad of 28 unknowns reads as
0 fit, 0 doubtful, 0 out, and a ring of 0/0. That is arithmetically correct and
tells a coach nothing. **The screen should say that nobody has been assessed
yet**, which is a different sentence from an empty squad.

**What a coach needs prompting to do at this stage**, in order: set availability
for the squad, create groups, and seed the flag thresholds. Nothing currently
prompts any of it.

---

## Stage 3: a week of data

**What exists.** Some check-ins, one or two sessions run.

**This is where the three silences appear**, and where a coach is most likely to
conclude the app is broken.

**Readiness works from day one.** A single check-in produces a score.

**The trend band does not.** It needs 14 days, and the days before that draw
nothing. The specification records why this was worth building carefully: without
a deliberate run-up, the opening stretch of every chart drew no band, which reads
as "this athlete has no norm" when the truth is "we did not ask for the days that
would show one" (`src/lib/queries/analytics.ts:505`). **That reasoning applies
equally to a club that genuinely has no history**, and there the fix is a sentence
rather than a wider query.

**The acute to chronic ratio does not appear at all** until an athlete has
training entries on 21 of the trailing 28 days. For a new club that is three
weeks minimum, and the ratio is one of the numbers a coach is most likely to have
been told about before they signed up.

**A leaderboard will not display** below its minimum population. Under a group
filter this bites sooner than people expect.

**What should happen.** Each of these three should say what it is waiting for and
roughly when it will arrive: not "no data" but "needs 14 days, has 6".

---

## Stage 4: a month in

**What works.** Nearly everything.

**What still does not, and why it surprises people.** The training report cannot
score a session whose title has not repeated. A club that names sessions freshly
each week never accumulates a reference, and the report says there is not enough
data to read the session, indefinitely. **This is not a first-run problem that
goes away**: it is a habit the app quietly requires and never explains. It
connects to decision D-33, where renaming a session detaches it from its own
history.

**GPS is a separate clock.** A Premium club sees nothing GPS derived until
somebody uploads a file, which is a manual act nothing prompts.

---

## Stage 5: the dangerous state, corrected

**Decision D-39 said that a club with no thresholds raises no flags, and a
dashboard showing zero open flags looks exactly like a well behaved squad.**

**That is still true, and it is less severe than the decision entry implies.
Correcting it here.**

**What actually exists.** The thresholds screen detects a club with no rules and
offers **one click to seed five sensible defaults**
(`src/app/(staff)/settings/thresholds/page.tsx:81`,
`src/components/SeedDefaultThresholds/SeedDefaultThresholds.tsx`). It answers a
coach's own question, recorded verbatim in the code: "do we have general default
thresholds for each club to use and start with?"

**Four of the five arrive active.** The fifth, wellness compliance, arrives
switched off deliberately: its measure counts wellness entries, so on a club that
has never submitted anything it reads zero rather than "no data" and would flag
the entire squad on day one (`src/lib/queries/thresholds.ts:206`). **That is
precisely the distinction this document is about, already understood and already
handled.**

**So the narrower finding, which stands.**

**The dashboard says nothing.** A club that has not visited the thresholds screen
still sees a calm dashboard with no indication that nothing is being watched. The
prompt exists on a settings screen nobody has a reason to open in their first
week.

**And the seeding acts only on a club that has never had a threshold.** A club
that cleared its rules on purpose does not get them back, deliberately, so that
the defaults cannot be reinstated behind a coach's back
(`src/lib/queries/thresholds.ts:197`). **That is the right behaviour and it means
a cleared club is permanently in the dangerous state with no prompt anywhere.**

**Revised recommendation for D-39.** Say it on the dashboard, not just on
Settings: when a club has no live thresholds, replace the open flags figure with a
line saying nothing is being watched, linking to Thresholds. **Reason: the seeding
prompt is in the right place for somebody who went looking and the wrong place for
somebody who did not, and the second is the club at risk.**

---

## What this document asks for

**Six changes, in order of value.**

1. **A way to add an athlete.** Everything else is downstream. Gap G-14.
2. **The dashboard says when nothing is being watched.** Revised D-39 above.
3. **The dashboard distinguishes an empty squad from an unassessed one.**
4. **The three waiting states say what they are waiting for**, with a count: not
   "no data" but "needs 14 days, has 6".
5. **A first-run prompt sequence.** Add athletes, set availability, create groups,
   seed thresholds. Four steps, each of which exists except the first.
6. **Session naming is explained once**, because the training report quietly
   depends on it.

**Items 2, 3 and 4 are sentences.** Item 1 is a screen. Item 5 is a small feature.
Item 6 is a line of help text.

---

## Open items

- **UNVERIFIED: what the dashboard renders for a club with no athletes.** A Run
  level question, per `docs/verification-standard.md`.
- **UNVERIFIED: whether any screen currently distinguishes "waiting for more data"
  from "no data".** The training report does, in words. Whether the wellness band
  and the ratio do has not been checked at the Run level.
- **Decision D-39 is amended by this document**, not withdrawn: the seeding prompt
  exists and is good, and the dashboard silence is the part that remains.
