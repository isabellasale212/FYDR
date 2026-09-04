# 60. Notifications

## 1. Page name and URL

**Notifications**, at `/settings/notifications`.

A person's own notification preferences.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Their own preferences | Their own | None | Base | Route guard, `src/lib/session.ts:69` |
| Coach | Yes | Their own | Their own | None | Base | Same |
| Medic | Yes | Their own | Their own | None | Base | Same |
| S&C | Yes | Their own | Their own | None | Base | Same |
| Nutritionist | Yes | Their own | Their own | None | Base | Same |
| Athlete | **No** here. Athletes have their own equivalent in their own app | Nothing | The whole page | n/a | Middleware, then guard |

**Nobody sets anybody else's preferences**, including the sport scientist.

## 3. How you get here

- The Notifications link in Settings.

## 4. What you see

The kinds of notification that exist, and a switch for each.

**Where nothing is configurable, the screen says so** rather than showing an empty
panel.

## 5. Every number on this page

None.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| A preference switch | The list | Turns a notification kind on or off for you | Stays here | Updates your own preference row | Any staff, for themselves | None. Reversible | Never |

## 7. How this page is built, in plain English

Built on the server, reading only the signed in person's own preferences.

## 8. States

**Nothing to configure.** Said in those words, which is the honest state where the
kinds of notification a club has produce no choices.

**Error.** Surfaces as an error. **Offline.** Not handled.

## 9. Open issues

- **Quiet hours are not built.** The database has the columns and no screen sets
  them (`src/lib/queries/notificationPreferences.ts:20`). Decision D-18.
- **This screen has no entry in the previous specification set.** This file is its
  first specification.
