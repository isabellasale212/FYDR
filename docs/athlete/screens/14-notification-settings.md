# Notification settings

## 1. Where it sits

Reached from Me. Route `/me/notifications`. File 49 lines.

## 2. Who reaches it and when

Every athlete.

## 3. What you see

The athlete notifications from the catalogue, each with a channel toggle.

**Add to Home Screen** (PATTERN-S9 artboard 6, 14 September 2026): the first
row on this screen, above the preferences — "Add to Home Screen · reminders
reach you only from there" — opens `/me/reminders/install`, the permanent,
canonical route to install teaching, reachable by name so a coach can say
where it is. The card there is Fydr's own, marked three ways: the eyebrow
"From Fydr, not from iPhone" (or Android / your phone), the product card
treatment, and — where it is dismissable, on Today — a 44px close plus a
worded "Not now". Three steps naming the exact menu items ("Tap **Share** in
Safari's bar at the bottom of the screen — the square with an arrow coming
out of the top"; "**Add to Home Screen**, then **Add**"; "Open Fydr from the
Home Screen. It asks about reminders once, and you can say no."), a
schematic Safari bar with the share control ringed and labelled "Share — step
1", and what changes once added (an icon, no browser bars, reminders become
possible; login, entries and staff visibility unchanged). On Android the
browser can offer the install itself, so the card carries a real "Install
Fydr" button when the browser fires `beforeinstallprompt`, with the menu route
("Add to Home screen", some browsers "Install app") as the fallback; on a
desktop it says to open fydr.app on the phone. Already added: the card says so
and offers nothing. It never imitates a system dialog.

**Where else it appears — three routes only** (the notes): this row, always;
once on Today, on the open that follows the first check-in ever, with "Not
now" remembered on the phone; and, once a sender exists (S11), returned once
if a reminder could not be delivered. Not on every Today open and not on a
timer. iOS 15 (September 2021) onward puts Safari's bar at the bottom with the
share control in it, which is what the schematic draws; earlier versions had
it at the top — the caption names "the share control", true of both.

**What the club can see of it.** Once per session start the app records how
it is running — platform, standalone or browser, push-capable — in
`athlete_devices` (migration 0121; no identifier of the phone is stored). The
staff squad view reads "N of M athletes can receive reminders" from it, with
a caption naming the cause; it is the phone's readiness, not a reminder
delivered, and the caption says so.

## 4. What the athlete enters here

Per notification, per channel, on or off. Stored in `notification_preferences`
(migration 0008), which is per user, per notification, per channel, where **null
means inherit the default**. Its own row only RLS policy already existed.

**The under 18 floor is real and enforced here.** `me/notifications/page.tsx:25`
computes `ageFrom(athlete.date_of_birth, timezone)` and `isMinor = age < 18` from
the athlete's actual date of birth, and the catalogue marks three notifications
`minorFloorOff: true`:

| Notification | Trigger | Default | Minor floor |
|---|---|---|---|
| `athlete.flag.shared` | Staff acknowledges a flag raised about you | push off | **forced off for minors** |
| `athlete.compliance.weekly` | Every Monday morning | push off | **forced off for minors** |
| `athlete.leaderboard.weekly` | Every Monday morning | push off | **forced off for minors** |

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| A channel toggle | Per row | Sets the preference; also clears that row's pre-mute snapshot, so a chip changed by hand while muted is what "Turn notifications back on" leaves in place | stays | `notification_preferences` | no | the minor floor forces it off |
| **Mute everything** (one switch) | The top card | **Since 13 September 2026 (PATTERN-S8 C13) the mute is one `role="switch"` at the top, no confirmation.** On: turns off every notification that may be muted, remembering per type what it was (`mute_notifications`, migration 0103: `pre_mute_push`, `pre_mute_email`, `muted_at`); a type never touched is created muted with an "inherit" snapshot. Off: Restores each muted type to exactly what it was before muting — off stays off, on comes back on, inherit stays inherit — never all-on (`unmute_notifications`; decided 11 September 2026, §0z). Its state is read from the rows, so it is right after a reload and on another device. The whole card row is the control (56px); the track is the product's existing switch shape. Beneath it, the sentence: "Nothing stops being recorded. Your check-ins, ratings and sessions are still expected and still count, and no coach is told you muted this. Availability changes and privacy notices still reach you — those two never turn off." | stays | `notification_preferences` | **no** | never (an adult); the card is absent where `showMuteAll` is false |

## 7. Offline and sync

Not in the outbox. DECISION 11.

## 8. Notifications

This screen configures them. **Nothing in this codebase sends a push or an email yet** — push is web push, a service worker with VAPID keys, specified as PATTERN-S9 (`docs/platform-decision.md`, 13 September 2026); no Expo push credential (there is no native app),
no APNs or FCM key, no email provider account. Preferences are stored for real;
nothing dispatches against them.

**So every preference on this screen is currently a setting for something that
does not happen.** That is a different gap from "not enough time": it needs a
push credential and an email provider, which are accounts to open rather than code
to write.

## 9. Permissions

**Push permission is not requested**, because nothing sends a push.

## 10. States

Loading, adult, under 18 (three rows forced off), error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy.

## 12. Open issues

- **NOT BUILT:** any dispatch at all. The settings are real; the sending is not.
- The nudges named in `docs/09-security-and-compliance.md:507`
  (`athlete.wellness.nudge`, `athlete.rpe.nudge`) are **not in the catalogue**
  read here. UNVERIFIED whether they exist elsewhere.
