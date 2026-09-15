# Technical brief — Scottish Rugby, Friday 18 September 2026

For Isabella, before the meeting. Not for sending to them.

Everything here is checked against the code. Where it is judgement rather
than fact, it says so. The full metric definitions are in `docs/metrics.md`
(43 metrics, each with its exact calculation, inputs, timezone, rounding and
what happens when data is missing) — this brief is what to have in your head,
not a replacement for that file.

---

## 1. The one-paragraph answer to "what is it"

Fydr is an athlete performance platform for rugby clubs. Athletes do a
morning check-in and rate sessions; staff see readiness, training load,
availability, injuries, nutrition and testing across the squad, with alerts
when an athlete moves outside their own normal range. It runs as a web app
and installs to a phone home screen. Staff and athletes see different
things, medical data is separated at the database, and every club's data is
isolated from every other club's.

---

## 2. The four calculations they will probe

Sports science people test a product by asking how it computes the numbers
they already argue about. These are the four.

### Readiness score (MET-001)

Five self-ratings, 1 to 5, on sleep quality, fatigue, soreness, stress and
mood. Five is the best answer on all five, so nothing is reverse-scored.

`readiness = (sum of answered) / (5 × number answered) × 100`

**The point to make:** skipping a slider does not drag the score down. Four
4s scores 80, exactly as five 4s does. And if an athlete answers none of
them, the score is **empty, not zero**. Empty and zero mean different things
and the app never conflates them.

This is self-report, not measurement, and saying so first is a strength, not
a weakness. It is not a medical judgement and no device feeds it.

### Session load (MET-007)

`session load = RPE × duration in minutes`

CR-10 scale, 0 to 10, since 13 September. **0 is a real rating meaning rest**
and produces a load of 0, which is present rather than missing. A session
with no rating contributes nothing to any total rather than counting as zero.
Arbitrary units, only meaningful against the same athlete's other sessions.

### Acute:chronic workload ratio (MET-010)

7-day load over 28-day load. The band drawn on screen is 0.8 to 1.5.

**Two things to say before they say them.** First, the 0.8–1.5 band is a
display convention, not the alert rule; the rule that actually raises a flag
lives in the club's own thresholds table and a club can set it differently.
Second, and this is the one that will land: **if an athlete has training
entries on fewer than 21 of the trailing 28 days, Fydr calculates no ratio at
all.** It is withheld, not estimated.

ACWR is contested in the literature and they may well open with that. The
honest answer is that Fydr does not treat it as a truth, it treats it as one
of several signals, it refuses to compute it on thin data, and the threshold
is the club's to set. If they push further, agree with them: the criticism of
ACWR is largely about people acting on a ratio built from insufficient or
poorly collected data, which is exactly what the suppression rule exists to
prevent.

### Body mass change (MET-043, new this week)

Flags an athlete more than 2 per cent below their own 28-day mean. Club
weigh-ins only, never the athlete's self-reported figure, because two sets
of scales disagreeing looks like a weight change that did not happen. One
weigh-in per athlete per day. The rule will not speak until there are four
weigh-ins spanning at least 21 days, so a single clustered week cannot
become a baseline. **The coach cannot see body mass at all** — see §4.

---

## 3. The principle underneath all of it

If they take one thing away, make it this one, because it is unusual and it
is the thing that will make a performance scientist trust the product:

**Fydr refuses to fabricate a number.** Missing is never zero. Every count
carries its denominator ("0 of 7 days", "0 of 29 athletes with a rating").
A ratio built on thin data is withheld rather than estimated. A report says
which entry types it counted. Where a club has turned a measure off, every
screen that depended on it says so rather than showing an empty column.

That is a design rule enforced across the product, not a slogan. It is in
`docs/decisions/design-constitution.md`.

Most tools in this space will happily show a confident number built from
four data points. That is the comparison to invite.

---

## 4. Permissions, which is your strongest technical card

Three layers, and the important one is the bottom.

**Multi-tenancy.** Every row belongs to an organisation. Isolation is
enforced by PostgreSQL row-level security, not by application code, so a bug
in a query cannot leak another club's data — the database refuses to return
the rows.

**Clinical separation.** Medical detail is separated at the column level.
Injury body area and side are not granted to ordinary authenticated roles;
non-medical staff read an `injuries_staff` view that cannot see them.
Injury-linked availability can only be set by medical staff, enforced by a
database policy, not by hiding a button.

**Body mass.** The coach sees no body mass anywhere: not the profile, not
the nutrition card, not the exports, not the flags. The reasoning is worth
saying out loud, because it is a safeguarding answer and this audience will
recognise it: the coach picks the team, and an athlete who knows the selector
is watching their weight behaves differently about their weight. Sharper
again for the minors in the squad.

**The line to use:** every one of these is enforced at the database. The UI
hiding a control is a convenience. The database refusing the write is the
rule. There is a test suite (pgTAP, 94 files) that asserts each policy
directly.

---

## 5. Architecture, in the order they will ask

**Stack.** Next.js on Vercel, PostgreSQL on Supabase, all in Dublin,
functions in the same region as the database. TypeScript throughout.

**Why a web app rather than native.** Clubs use mixed devices and staff use
laptops; an installable web app is one codebase, installs to a home screen,
and ships a fix the same day rather than through review. Native is a later
decision, not a rejected one.

**Offline.** Athlete entries queue on the device and send when signal
returns; a pitch-side form is designed for bad signal.

**Auditing.** Corrections are recorded rather than overwritten, with who and
when. Exports are audited with the row count and the person who took them.

**Testing.** Every commit runs the full suite before it builds — 154 suites
at the moment, plus the database tests. Guards assert their own coverage, so
a check that silently walks nothing fails rather than passing.

**Scale.** Honest answer: it has been built and measured against a synthetic
club of 29 athletes with a season of data. It has not carried a real club
yet. Do not claim otherwise.

---

## 6. The hard questions, and what to say

**"What is your lawful basis for processing this data?"**
The one you cannot bluff, and a union will ask it. The honest answer: the
question is open and with a solicitor, the DPIA and the Children's Code
assessment are scheduled, and no real club goes on the platform until they
are done. **That answer is fine.** Saying "we've thought about it" without
specifics is not. A grown-up "not yet, and here is the plan and the date"
lands better with a governance-minded organisation than a confident wrong
answer, and they will check.

**"Who owns the data?"**
The club. Every report exports to CSV and PDF with its own filters written
into the file. Be straight that a formal data processing agreement is part
of the same legal workstream.

**"What happens when an athlete leaves, or withdraws consent?"**
Consent is recorded per purpose and can be withdrawn; withdrawal is never
blocked by the plan a club is on — there is a test that asserts exactly
that. Retention is part of the legal workstream.

**"Who else is doing this?"**
Know the names before you are asked. Kitman Labs, Teamworks/Smartabase,
Catapult, Hudl, Vald, Output Sports, and PlayerData, who are Edinburgh-based
and will very likely be known to this room. *(My confidence on the current
state of that market is moderate — check the two or three most relevant
before Friday rather than trusting this list.)*
Your differentiator is not features, it is that the product refuses to
mislead: denominators, withheld ratios, enforced clinical separation. Say
that rather than claiming to out-feature a company with fifty engineers.

**"Who built this?"**
You did, solo, with AI tooling, in a few months. Say it plainly. It is a more
impressive answer than any hedge, and this room can read the code quality
off the demo.

**"What happens if you get run over?"**
A fair question about a one-person company. The honest answer is that the
architecture is documented, the decisions are written down with their
reasoning, and everything is in one repository — but that a single founder is
a real risk and any pilot agreement should reflect it.

---

## 7. When you do not know

Say you do not know, write it down in front of them, and say when you will
come back with an answer. You have spent this week ruling on things that
most people would have guessed at. That habit is the thing worth showing.

Do not invent a number in that room. Everything in this product is built on
not doing that.
