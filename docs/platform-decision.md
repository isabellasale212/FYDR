# Fydr platform decision

**Decided by Isabella, 13 September 2026. Supersedes every earlier platform
statement in every Fydr document, in the repo and outside it.**

## The decision

One web product, deployed once, containing two apps.

- Staff app: desktop browser, and installable to a phone or tablet home screen.
- Athlete app: phone, installable to the home screen.

Both are installable web apps (PWAs). Both must have a robust offline outbox
and push notifications.

There is no native iOS app and none is planned. **Apple Health is removed from
the product entirely**, not deferred and not merely taken off the Premium list.
It was the only capability that required native.

## What is now stale and must not be repeated

- "native (Swift/SwiftUI, iOS first) for athletes"
- "the athlete-facing app is a separate codebase"
- "whether the web app is the real athlete product or a stopgap"
- Apple Health as a Premium feature (PATTERN-S8 D1)
- Push notifications on hold pending sign-in data (to-do §0e)
- Staff offline as post-pilot (PATTERN-S6 C4 and C5)

## What both apps must have

**Installable.** Manifest, icons, splash screens, standalone display, offline
app shell. `manifest.webmanifest` already returns 200 as of 2026-09-07; check
its contents against this requirement rather than assuming. iOS Safari has no
`beforeinstallprompt`, so the install cannot be triggered in code and the app
must teach it on screen.

**Robust offline outbox.** One shared foundation for both apps, not the
per-screen localStorage queues that exist today. IndexedDB, a service worker,
retry with backoff, a visible queue state, a manual "send now", and the last
successful sync time. Append-only writes first, because they cannot conflict.

**Push notifications.** Service worker, VAPID keys, a subscription table, a
send path, per-person preferences and quiet hours (the preference columns
already exist, nothing sets them). On iOS push reaches only a home-screen
installed app, so install is a prerequisite of notifications.

Note: `push_tokens` holds 43 seeded rows encoding the abandoned Expo plan.
No code has ever written that table. Do not read them as devices.

## Consequences for the decision sheet

- Staff offline (S6 C4, C5) moves from "not now" to in scope. The clinical
  conflict inside it is live: a coach's held Unavailable arriving after a medic
  has set a different value.
- "Send a reminder" (STAFF-SS-01 C4) was declined because nothing sends
  anything. Reconsider once a sender exists.
- Two new boards: installability and offline (S11), and premium (S12).

## What this does not change

Supabase, every RLS policy, every migration, the report and metric logic, the
design tokens, the deploy pipeline. This is about delivery, not contents.

## Revisit condition

Wrap the same code in a native shell (Capacitor) only if a real club says its
players will not install from Safari, or if an App Store listing is needed as a
sales asset. Nothing built for the installable web app is wasted if so.

---

# Notifications (S9), specified 13 September 2026

Decided by Isabella. The schedule below is the product's notification set.
Anything not listed here is not sent.

## Athlete

| What | When | Condition |
|---|---|---|
| Wellness check-in | 08:00 club local | Only on mornings a check-in is EXPECTED (before a training day, per the existing rule and the sport scientist's per-day override). Not sent if already submitted. |
| Session RPE | 30 minutes after the session ends | The existing `lib/rpeDue.ts` rule. One reminder only. Nothing after the window closes at the end of the following club-local day. |
| Weekly nutrition check-in | Sunday 10:00 club local | Once, if not submitted for that week. |
| Unfinished gym session | 20:00 club local | Only if sets were logged and the session was never finished. |

Nothing is sent for anything an athlete cannot act on.

**OPEN, Isabella to confirm:** she asked for wellness "every morning at 8am".
That contradicts the standing decision that a check-in is expected only before a
training day, with a per-day override. Written here as EXPECTED MORNINGS ONLY,
because a reminder for something that is not due is how a club's athletes learn
to dismiss the channel. If she wants it literally every morning, change this row
and nothing else.

## Staff

Nothing scheduled. Staff notifications are actions a person takes, not a clock.
STAFF-SS-01 C4 ("Send a reminder" on a missing check-in) was declined only
because no sender existed; it returns now that one is required.

## Rules for all notifications

- **Quiet hours per person.** The `notificationPreferences` columns already
  exist and no screen sets them. **Corrected 13 Sept 2026, replacing an earlier
  wrong rule that said such notifications are dropped:**
  - A SCHEDULED reminder (wellness, nutrition, unfinished gym session) shifts
    to the first minute after quiet hours end. Late, not absent.
  - A reminder whose WINDOW HAS CLOSED is not sent at all (session RPE past its
    close, a check-in past its week). Late is worse than nothing there, because
    it prompts an action the database will refuse.
  - The settings screen states the consequence as it is set: "Quiet hours from
    07:00 to 09:00. Your morning check-in reminder will arrive at 09:00."
  - Dropping silently must not ship. An athlete whose quiet hours cover 08:00
    would be permanently un-prompted, and their compliance would read as a
    behaviour problem when it is a settings problem.

- **Push is opt-in behind a manual gesture, so it can never be the mechanism.**
  iOS cannot request notification permission before add-to-home-screen, and the
  install cannot be triggered in code. Two requirements follow:
  - **The athlete's Today screen carries the outstanding thing prominently**
    whether or not a push was ever permitted. The notification accelerates; it
    does not deliver.
  - **Staff see, at squad level, who can actually be reached**, with its
    denominator: "18 of 30 athletes can receive reminders". Without it, an
    install-rate problem reads as a compliance problem and a club blames its
    players for something the product did to them.
- **One per thing per day.** No escalation, no repeat chasing.
- **Every notification opens the exact screen that clears it.**
- **All times are club local**, from the club's timezone, the same boundary the
  week uses. Confirm one shared week/day boundary exists before building.
- **An athlete who has not installed the app cannot receive push on iOS.** The
  app must say so on screen rather than silently sending nothing.
