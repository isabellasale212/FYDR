# My leaderboards

## 1. Where it sits

Reached from Me. Route `/me/leaderboards`. File 98 lines.

## 2. Who reaches it and when

Every athlete. **The screen behaves differently for under 18s, and that is the
point of it.**

## 3. What you see

Whether they appear on boards, and the control to change it.

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Appear on leaderboards | UNVERIFIED exact wording | on or off | see below | n/a | `leaderboard_opt_outs` (adult) or `athlete_consents.leaderboard_visibility` (minor) | yes, always | affects every board |

**Two different mechanisms behind one control, and the difference is legal.**

- **An adult is on by default and opts OUT.** The opt out is written to
  `leaderboard_opt_outs` with `opt_out_source = 'athlete'`, and the database
  carries `check (allow_opt_out)` so **a club cannot take the exit away**. The
  reasoning is GDPR article 7(3): consent that cannot be withdrawn was never
  consent.
- **An under 18 is off by default and opts IN.** Children's Code standard 7. The
  board query itself enforces it (`supabase/migrations/0016_leaderboards.sql:370`),
  not the client.

`athlete_is_minor()` **fails safe**: no date of birth means treated as a minor.

There is also a per device hide (`fydr-hide-leaderboards` in `localStorage`).
**That is a display preference on one phone, not a consent record**, and it does
not remove the athlete from anybody else's board.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| The toggle | Body | Opts in or out | stays | a consent or opt out row | UNVERIFIED | never |
| Hide on this device | Body | Local only | stays | `localStorage` | no | never |

## 7. Offline and sync

Not in the outbox. Presumably needs a connection. DECISION 11.

## 8. Notifications

`athlete.leaderboard.weekly`, push, **off by default, minor floor off**. **Nothing in this codebase sends a push or an email.** No Expo push credential,
no APNs or FCM key, no email provider account. Preferences are stored for real;
nothing dispatches against them.

## 9. Permissions

None.

## 10. States

Loading, adult, **under 18 and not opted in**, opted out, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling at 200
percent, screen reader labels, browser support policy.

## 12. Open issues

- **UNVERIFIED:** the exact wording shown to a 16 year old, which is the wording
  that matters most on this screen.
