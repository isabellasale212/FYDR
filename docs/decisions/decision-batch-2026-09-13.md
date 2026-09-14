# Decision batch, 13 September 2026

Isabella's rulings on the outstanding design and product sheet. Each row is a
decision, not a discussion. Where a row reverses something earlier, it says so.

## Group A: settled, code already had the answer

| # | Decision |
|---|---|
| 1 | Role change timing is stated as "next request", not "next page load". It is what the code does. |
| 2 | No "export links expire after seven days" sentence. Exports are direct downloads; there is no link to expire. |
| 3 | Catapult stays described as "Import files". It is a CSV drop, not a connection. The board is wrong. |
| 4 | **Apple Health removed from the product entirely.** See `../platform-decision.md`. |
| 5 | Session and schedule changes join the next audit-trigger batch. |
| 6 | A retention preview is logged as its own action and retains no rows. |
| 7 | "No creator" is accepted as the marker for a default threshold. |
| 8 | Archived-group filter fixed in `resolveGroupFilter`: drop ids that are not live groups, clear the cookie when it held any, one sentence in the chip row. |
| 9 | Nine S8 admin screens build as specified: settings hub in four groups, users list with search and filters, role-change preview, group-in-use warning, thresholds in plain English with a 28-day preview, audit filters as a phone sheet, retention consequence before the button, tables as cards below 900px, notifications with one mute switch at the top. |
| 18 | Print tokens approved: `--print-paper`, `--print-ink`, `--w-dialog: 640px`, dated at their values when C3 and C4 are built. |
| 19 | `/analytics/build` stays until PATTERN-S7 C6 replaces it. |
| 20 | A policy refusal marks a held item "could not be sent, the week has closed", shown once, with Discard. |

## Group B: product decisions

**B1. Deactivate is the revoke.** One button, not two. Deactivating an account
invalidates any outstanding invite or magic link at the same moment. No
separate Revoke control on the Users screen. This closes PATTERN-S8 D5: the
current behaviour, where a deactivated person's link still signs them in and
merely grants nothing, is not acceptable because "Deactivate" is a word an
administrator trusts.

**B2. Body site and side are not coach-visible.** A club setting, defaulting to
OFF. A body area plus a restriction line is a diagnosis in two pieces. A coach
needs the status, the restriction and the expected return, not the body part.
A club that wants it switches it on and owns that decision. This closes
PATTERN-S3 C8 and promotes the corresponding line in
`design-constitution.md` from recommendation to rule.

**B3. Body mass becomes a flaggable metric**, with the threshold set on CHANGE
OVER TIME, not on an absolute value. A registry entry and a threshold row. Two
reasons: the nutritionist's attention card is currently structurally incapable
of ever filling, and a sharp day-to-day body mass change is a real thing a
nutritionist wants to catch. **A screen that flags an athlete for weighing a
particular amount must never exist.** Closes STAFF-SS-01 D7.

**B4. Retire MET-014 ("Named") from the registry**, its only surface having
been the lead card's ring, which is gone. Full plus Doubtful is the named count
and the card already says it in three numbers. **MET-015 (week load so far)
stays on the lead card's tail line** rather than moving to Analytics, because
it is useful next to selection. Closes STAFF-SS-01 D8.

**B5. Panel order on the athlete profile: one order, one exception.** The sport
scientist's panel order is used for every role, with **Body weight raised above
Flags for the S&C and the nutritionist**. Four bespoke orders would be better
per role and worse to maintain, because every new panel would then need five
decisions instead of one. Closes STAFF-SS-02-05 C4 and unblocks C3.

**B6. A session that has been rated opens READ-ONLY**, with the reason said out
loud: "This session has been rated by 14 athletes. Ratings are tied to its date
and duration, so it cannot be changed. Cancel it and create a new one if it did
not happen as planned." The rating neither follows nor detaches, because a
session that can move under its rating makes every load figure in the product
retroactively arguable. Accepted cost: a coach who typed 60 minutes and meant 90
must cancel and recreate. Closes PATTERN-S4 C4.

**B7. Applying a week template REPLACES the week**, with the consequence named
before the button: "This will remove 4 sessions already in this week and add 9
from the template." Merge produces weeks nobody intended (two Tuesday gym
sessions, a duplicate matchday, athletes expected twice) and is very hard to
explain afterwards because nothing shows which session came from where. This is
one of the few places a confirmation earns its keep, so the warning must be
genuinely clear. Closes PATTERN-S4 C7 and answers Q5's merge-or-replace.

**B8. Today lists the athlete's gym session as a row**, with its count: "6 of 12
sets · 2 waiting to send". Today is the athlete's whole day or it is not worth
opening, and an athlete who sees nothing about their gym session on the one
screen that tells them what to do will reasonably conclude there is nothing to
do. It also gives the offline queue a visible home, which matters now the outbox
is a real feature rather than a hidden mechanism. Accepted cost: a genuinely new
query, as the page's own comment notes. Closes PATTERN-S6 C2.

**B9. A part-filled form survives session expiry in localStorage, per form.**
The same mechanism the gym drafts already use, so no new pattern. Sign in, return
to the same sheet at the same scroll position, every answer still set. It moves
into the shared IndexedDB outbox when S11 builds it. Closes PATTERN-S6 C3.

**B10. One renderer: the PDF survives and Print opens it.** Seven `@react-pdf`
handlers and a `@media print` block are two documents pretending to be one, and
they will drift. The first time a club prints a report and emails the PDF of the
same report and the two disagree, that is a credibility problem rather than a
tidiness one. Accepted cost: printing becomes a two-step action. Closes
PATTERN-S7 C4.

**B11. One dialog pattern is approved**, built once and reused. It unblocks the
finish-early confirmation (ATH-ADULT-10 C2), the export dialog (PATTERN-S7 C3)
and the template-replace warning (B7). It uses `--w-dialog: 640px`, approved in
group A. **The rule that comes with it: a dialog exists only where the action is
destructive or irreversible** — replacing a week, deleting a board, running a
retention purge. Never for a confirmation that merely slows someone down.

**B12. A held availability write that lands after a newer value exists is never
applied.** It is refused and shown to the coach as a conflict, naming both
values with their times and who set each, with one action: discard, or open the
athlete and set it again now. The medic's value stands while the coach decides,
because availability after an injury is medic-owned. Accepted cost: the coach
did real work offline and loses it. The alternative is a player marked
unavailable by a four-hour-old phone after a clinician cleared them, which is
the exact failure the clinical boundary exists to prevent. This is the open
decision inside PATTERN-S6 C4 and C5, which the platform decision moved into
scope.

## From the builder's report of 13 September

**Match participation is recorded. Scope: exactly three things.** Who started,
who came on, and minutes each. No positions, no events, no score. Today the app
records attendance and a published allocation and nothing about game time, so
the match report cannot be written and nothing in the product can say who
played. Decide alongside the fixture-to-match-session question, which is the
same root: a fixture today creates no session, names no squad and expects
nobody.

**The tier gate moves to the database.** "Keep and hide" is currently enforced
only in the app: every tier check is app-side and the one database rule lives
inside `compute_leaderboard`, so a base club's GPS data is reachable through a
direct API call. This is the same shape as the leaderboard gate already fixed
once, and as the default-privilege gap: a rule that looks enforced and is not.
**The subject access read path stays open as a written, tested exception**,
because `gps_records` is deliberately readable on Basic so a SAR can be answered.

**RPE stays, with three changes.** Removal was considered and rejected: session
RPE times session minutes is the only load measure the base tier has, GPS being
premium, and a base club with no load monitoring is a different product rather
than a smaller one.

1. **RPE becomes a club setting.** A club that will not chase it switches it
   off. Every surface that depends on it then SAYS SO rather than showing an
   empty column or a zero: the training report, the compliance figure, the
   dashboard's attention card, effort leaderboards and analytics. Missing is not
   zero applies to a switched-off feature as much as to a missing value.
2. **The prompt is one tap, not a form.** A row on Today carrying the scale
   itself, no sheet. It is one number and the sheet is why compliance is hard.
3. **The scale becomes 0 to 10**, matching standard session-RPE (CR-10).

**On the scale change.** All production data is synthetic, so there is no
back-conversion problem: widen the constraint to allow 0, change the control and
the labels, and note in the migration that rows written before it were entered
on a 1-to-10 scale. A rating of 0 is a real value in CR-10, meaning rest, and it
must not be treated as missing anywhere. Check every place that tests an RPE for
truthiness rather than for null, because `0` is falsy and that is exactly how a
rested session becomes an unrated one.

**The match report is kept.** Considered for removal and rejected. A rugby
product that cannot say who played is odd, and "who played, and for how long" is
the question a coach asks before any analytics panel. Keeping it commits three
things: the match participation build (starters, who came on, minutes each, and
nothing more), a migration for it, and the fixture-to-match-session decision
underneath, which must be settled at the same time because a half-linked schema
is worse than either end state. The catalogue stays at seven reports.

## Premium contents and the match report, 14 September 2026

**Three premium rows from the Step 1 report, all approved as recommended.**

1. **`12-product-tiers.md` §3.2 is rewritten**: the analytics row reads "P, the
   whole destination (row 27)". The document currently contradicts both §3.1 and
   the code, which is the same class of problem as the catalogue drift.
2. **A `PlanGateCard` goes in the athlete report's GPS section on Basic.** The
   columns must not vanish silently. This is the second half of D-20: a wholly
   premium DESTINATION disappears, a premium REGION inside an otherwise-base
   page shows an upsell card. Both halves are one rule.
3. **A downgraded club's GPS flags carry a plan note on the domain word.** A
   flag still visible while the rule behind it is dormant is a number that means
   something it no longer means. The "GPS history is kept" sentence belongs on
   the plan page, not on the flag.

**The match report, both halves approved.**

**Definition sentence, confirmed** (supersedes the catalogue's draft now that
participation is captured):

> Everything recorded against {fixture}: who was selected, who started, who came
> on, and minutes played, with each athlete's availability as it stood at
> kick-off. An athlete with no minutes recorded shows as not recorded, never as
> zero.

**Capture: a coach's post-match sheet on the fixture.** One screen, reached from
the fixture, writable by the coach and the sport scientist, matching
`SESSION_EDIT`. Per athlete: started, came on, minutes. Nothing else. No
positions, no events, no score. It is the smallest thing that makes the report
real and the thing a coach will actually fill in on a Sunday.

The fixture-to-session link is largely already done: `sessions.fixture_id` has
been written since 9 September and three of the four seeded match sessions are
linked. The orphan stays, with an attach action rather than a backfill.

## The My data hero cards are CUT, 14 September 2026

ATH-ADULT-12 C2 and C3 are cut from v1, not deferred. The athlete's My data
screen keeps its charts and loses the plain-English summary line above them.

**Why.** The cards need two rules that do not exist and cannot be invented by a
builder, because they are sports science judgements: what counts as "steady"
rather than rising or falling, and the minimum sample before a trend is
described at all. Both are answerable in ten minutes, but the cards are polish
on a screen that already works, and cutting them starts the closing sweeps a day
earlier.

**If they are ever revived**, the defaults put to Isabella were: steady means the
most recent 7-day mean within 5 percent of the 28-day mean; minimum sample is 8
entries in the 28-day window and 3 in the most recent 7 days. The 5 percent
figure needs sanity-checking against a 1 to 5 wellness scale, where it is a very
small move. And the tests tab will almost always report too few results, because
a club may run a CMJ twice a season, so its wording has to say why rather than
looking broken.

**Consequence: the feature work for v1 is complete.** The only remaining build
is the accessibility sweep and then the design system conformance pass.

## Group C: the order of the big briefs

Each is a day or more and needs its own brief. Agreed order, 13 September 2026:

1. **The injury and rehab cluster** (PATTERN-S3 C1, C2, C3, C6). The athlete
   status screen, the read flag, stages as real data, rehab proposal states.
   Migrations. First because it is the largest hole in the product, the one a
   medic notices in the first ten minutes, and the only brief here where the gap
   is a missing capability rather than a weaker version of something that exists.
2. **Match participation.** Starters, who came on, minutes each, and the
   fixture-to-match-session decision underneath it. Second because the match
   report cannot exist without it, and "who played" is a question a rugby coach
   asks before any analytics panel.
3. **Analytics as four panels** (PATTERN-S7 C6). The thing a sport scientist
   opens to justify the subscription.
4. **Premium contents.** The mechanism is already with the design manager; this
   adds what is premium and what a free club sees in its place. Cannot be
   finished before the code inventory lands.
5. **My data hero cards** (ATH-ADULT-12 C2, C3). Last: polish on a screen that
   already works, and blocked until `metrics.md` states what "steady" means and
   what the minimum sample is.

Running in parallel, not competing with this order: **S11 installability and
offline**, with the design manager, because it is what makes the platform
decision real.

## Related decisions made the same day

- Scope is v1: `scope.md`.
- Platform, notifications and the quiet-hours rule: `../platform-decision.md`.
- Premium downgrade is keep and hide: `premium-downgrade.md`.
- No athlete self-export of any report. Athletes ask a coach or sport scientist
  out of band. No request button, no queue, no new entity.
- No automatic squad weekly report. On demand only, any point in the week. No
  scheduler, no outbound email, no distribution list.
- Weeks remain Monday to Sunday, club local time.
