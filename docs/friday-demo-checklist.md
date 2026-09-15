# Friday 18 September — the Scottish Rugby demo

Audience: Isabella's former manager at Scottish Rugby and his manager.
Expect technical questions about the data model, the permissions and the
calculations. The deliverable is a product that works flawlessly on the
screens walked through, not a finished backlog.

## The three screens tonight's deploy made look unfinished

Migrations 0128–0132 shipped on 15 September. Two of them are correct
decisions that read as bugs to someone seeing the app for the first time.
**These are Isabella's to fix through the interface, not the builder's —
the builder has no production access.**

1. **Every programme assignment shows "Set start date"** rather than a
   block, because 0132 deliberately left existing rows unmapped. Set a start
   date on every assignment a demo athlete or squad holds.
2. **Every athlete lands on the consent flow**, because 0129 removed the
   backfill. Walk each demo athlete account through consent once, so the
   demo opens on their Today screen. (Or open on the consent flow
   deliberately — it is a good screen and a strong answer to a governance
   question. Choose, do not be surprised by it.)
3. **The athlete programme screen names one block while listing every live
   block's sessions.** Builder is fixing this; verify after the Thursday
   deploy.

## Sign-ins to verify, one by one, on fydr.app

Every staff role plus at least one athlete, each signed into properly and
each screen opened once:

- coach · medic · S&C · nutritionist · sport scientist
- one adult athlete
- optionally: an athlete on a Basic club, to show the tier gates

For each: sign-in works, the screens carry enough data to be worth looking
at, nothing reads "no data" on a screen being demoed.

## Order of the week

- **Tuesday night** — builder queue runs unattended.
- **Wednesday** — the technical brief (calculations, architecture,
  permissions). Isabella fixes the three screens above.
- **Thursday** — deploy, then Isabella walks every role end to end on
  production. Not the builder, not Claude.
- **Friday morning** — no changes of any kind.

## The ad

Cut unless Thursday goes cleanly and budget survives. A polished film
competes with the thing this audience came for, which is the app working.
A storyboard already exists in the project docs if it is revived.
