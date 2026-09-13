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
| Appear on leaderboards (adult) | "Every leaderboard at once" | on or off | see below | n/a | `leaderboard_opt_outs` | yes, always | affects every board |
| — (under 18) | No control | — | — | — | nothing | no | — |

**Two regimes, and the difference is legal.**

- **An adult is on by default and opts OUT.** The opt out is written to
  `leaderboard_opt_outs` with `opt_out_source = 'athlete'`, and the database
  carries `check (allow_opt_out)` so **a club cannot take the exit away**. The
  reasoning is GDPR article 7(3): consent that cannot be withdrawn was never
  consent.
- **An under 18 is never named, and has no opt-in.** Isabella's ruling, 13
  September 2026 (migration 0116): the self-consent toggle this screen carried
  until then is removed — a sixteen-year-old tapping themselves onto a ranked
  board while `athletes.parental_consent_*` is written by nothing was consent
  that is not consent. Until S9's guardian route exists there is no opt-in path
  for an under-18 at all: excluded by default, no way to leave it. The board
  query enforces it (`supabase/migrations/0116_minors_off_ranked_boards.sql`,
  `not athlete_is_minor(a.id)`), the staff wall applies the same rule, and the
  card on this screen says so and offers no control: "Because you're under 18,
  you are not named on any leaderboard, and nothing here can change that. Your
  results are still recorded and still yours to see in My data. When a parent or
  guardian can record their consent, that will be the only way to be named, and
  it will not be a switch on this screen." Existing `leaderboard_visibility`
  consent rows stay as history and have no effect.

`athlete_is_minor()` **fails safe**: no date of birth means treated as a minor.

There is also a per device hide (`fydr-hide-leaderboards` in `localStorage`).
**That is a display preference on one phone, not a consent record**, and it does
not remove the athlete from anybody else's board.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Every leaderboard at once (adult) | Body | Opts out of, or back into, every board | stays | an opt-out row | no | for an under 18 — nothing replaces it |
| Hide on this device | Body | Local only | stays | `localStorage` | no | never |

## 7. Offline and sync

Not in the outbox. Presumably needs a connection. DECISION 11.

## 8. Notifications

`athlete.leaderboard.weekly`, push, **off by default, minor floor off**. **Nothing in this codebase sends a push or an email yet** (push is web push, PATTERN-S9 — `docs/platform-decision.md`, 13 September 2026; there is no native app and no Expo push). No Expo push credential,
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
