# Why a destination is absent: three reasons, three appearances

**Decided 13 September 2026, extending D-20.** Raised by the design manager
while revising S10: the seventh report created a third reason a destination can
be missing, and if all three read the same way a coach concludes the product is
broken, while the one they could fix themselves is the one they never discover.

| Reason | What the user sees |
|---|---|
| **Premium, and the club is on free** | Gone entirely. Absent from the sidebar, refuses at the URL. A premium REGION inside an otherwise-free page still shows an upsell card and never vanishes silently. This is D-20, unchanged. |
| **A club setting is switched off** | The destination STAYS. It carries an off state naming the setting, what it would show, and who can change it. This is the only thing that tells an administrator a switch exists. |
| **It exists and nothing has been recorded yet** | Empty state as the constitution requires: the denominator, "nothing is missing", and where the data enters. |

**The immediate consequence:** the RPE-load report appears in the navigation for
a club with RPE switched off, carrying its off state. It is not hidden. Hiding
it would remove the only place an admin learns the setting exists.

**The general rule:** absence caused by what a club has BOUGHT is silent.
Absence caused by what a club has CHOSEN is visible and reversible from where it
is noticed. Absence caused by what a club has not yet DONE says so and points at
the door.


## Where a basic club learns premium exists, 14 September 2026

D-20 hides a premium destination completely, which means a basic club never sees
it in the sidebar and cannot reach it by URL. **That is confirmed and stays.**

The obvious objection is that a club then never learns what it is missing. The
answer is **not** a visible locked destination, which is a nav item existing only
to tease. It is **one honest place**: a plan page in Settings, visible to the
sport scientist, listing what the premium plan contains and what it costs.

One place to look, no teasers scattered through the product, and D-20 stays
consistent everywhere rather than having an exception for whichever screen is
most saleable.

## Analytics is premium, 14 September 2026

**Analytics is a wholly premium destination covering ALL metrics, GPS included.**
It is not the session-load-only screen built on 13 September.

Two consequences for the build:

- GPS metrics join the analytics panels. The screen is no longer scoped to
  measures a free club has.
- The whole destination takes a tier gate, at the database as well as the app,
  per `docs/decisions/lawful-basis-open.md`'s sibling decision that the tier gate
  moves down (migration 0119). Under D-20 it is absent from the sidebar for a
  basic club and refuses at the URL.

This supersedes the 13 September note recommending the load panel measure
session load so that analytics works for a free club. Analytics is not for a
free club at all.
