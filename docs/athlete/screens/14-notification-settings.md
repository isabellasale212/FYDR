# Notification settings

## 1. Where it sits

Reached from Me. Route `/me/notifications`. File 49 lines.

## 2. Who reaches it and when

Every athlete.

## 3. What you see

The athlete notifications from the catalogue, each with a channel toggle.

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
| Mute everything else | Top card | Turns off every notification that may be muted, remembering per type what it was (`mute_notifications`, migration 0103: `pre_mute_push`, `pre_mute_email`, `muted_at`). A type never touched is created muted with an "inherit" snapshot. Pressing it again changes nothing | stays | `notification_preferences` | no | while muted (the button becomes "Turn notifications back on") |
| Turn notifications back on | Top card | Restores each muted type to exactly what it was before muting — off stays off, on comes back on, inherit stays inherit — never all-on (`unmute_notifications`; decided 11 September 2026, §0z). Shown after a reload and on another device, because muted state lives on the rows | stays | `notification_preferences` | no | when nothing is muted |

## 7. Offline and sync

Not in the outbox. DECISION 11.

## 8. Notifications

This screen configures them. **Nothing in this codebase sends a push or an email.** No Expo push credential,
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
