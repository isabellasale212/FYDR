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

## Related decisions made the same day

- Scope is v1: `scope.md`.
- Platform, notifications and the quiet-hours rule: `../platform-decision.md`.
- Premium downgrade is keep and hide: `premium-downgrade.md`.
- No athlete self-export of any report. Athletes ask a coach or sport scientist
  out of band. No request button, no queue, no new entity.
- No automatic squad weekly report. On demand only, any point in the week. No
  scheduler, no outbound email, no distribution list.
- Weeks remain Monday to Sunday, club local time.
