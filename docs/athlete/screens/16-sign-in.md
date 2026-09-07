# Sign in

## 1. Where it sits

Outside the athlete shell, **no tab bar**, because a person here is not yet known
to be an athlete. Route `/login`. **Shared with the staff app: it is the same
screen.**

## 2. Who reaches it and when

Anybody opening the app signed out, and anybody following an expired link.

## 3. What you see

The Fydr lockup, a claim column on a wide screen, and a form: email, password,
sign in, and "Forgot your password?".

## 4. What the athlete enters here

| Field | As worded | Type | Validation | On invalid | Stored | Editable | Who sees it |
|---|---|---|---|---|---|---|---|
| Email | Email | email | server side | **one generic message either way** | not stored by this screen | n/a | nobody |
| Password | Password | text | Supabase Auth | same generic message | never stored by Fydr | n/a | nobody |

**A wrong password and an unknown email look identical**, deliberately, so the
screen cannot be used to find out who has an account.

**Rate limited server side.** Five failures per email start an escalating lockout,
30 seconds to 60 minutes, capped. Guessing while locked does not extend the lock.

## 5. Every number shown

None.

## 6. Every thing you can act on

| Element | Where | What happens | Takes you to | Writes | Confirm | Hidden when |
|---|---|---|---|---|---|---|
| Sign in | Below the fields | Authenticates | **the shell their roles resolve to** | a session, and an `auth.signed_in` audit row | no | never |
| Forgot your password | Below | Starts a reset | `/login/reset` | nothing | no | never |

**Where an athlete lands is decided by their roles, not by a choice.** An athlete
goes to `/today`. Somebody who is both a player and a coach goes to the staff app,
because it is the larger tool (`src/lib/supabase/claims.ts:124`).

## 7. Offline and sync

Sign in needs a connection. Nothing is queued.

## 8. Notifications

None.

## 9. Permissions

None.

## 10. States

Loading, wrong credentials, **locked out with a countdown**, error.

## 11. Accessibility and device

Translated for a web app per Stage A0. **UNVERIFIED:** text scaling, screen
reader labels, browser support policy.

## 12. Open issues

- Deep links: only `/today` and `/check-in` survive a signed out visit with their
  destination intact. DECISION 1.
