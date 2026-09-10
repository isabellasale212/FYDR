# Design brief — ATH-ADULT-01, Sign in

**For Claude Design.** Everything below is the current state, read from the
running application and its source on 2026-09-10. Nothing here is aspirational.

---

## 1. What exists now

The screenshots are in **`docs/walkthrough-screenshots/athlete-adult/ATH-ADULT-01 - Sign in.pdf`**
— five frames, captured against scratch:

| Frame | State |
|---|---|
| 1 | The screen as it loads, nothing typed |
| 2 | "Email" filled |
| 3 | "Password" filled |
| 4 | Before pressing "Sign in" |
| 5 | After pressing, showing the refusal |

**This flow was not captured in the original run**, and was also missing from the
capture report's own list of what it had skipped — so it was an unrecorded gap.
Captured now specifically for this brief.

---

## 2. The flow, verbatim from the walkthrough document

## ATH-ADULT-01 — Sign in

**Entry point.** `https://fydr.app/` — the root redirects to `/login`. Also
reached by following any athlete link while signed out: the middleware redirects
to `/login?next=<path>` and returns there afterwards.

**Steps.**

1. Type into "Email".
   - Also visible: "Password" field, "Sign in" button, "Forgot your password?"
     link. Above them: the wordmark and the eyebrow "ATHLETE AND STAFF", the
     heading "Sign in", and "Use the email address your club invited you on.
     Your morning entry takes 45 seconds."
   - Below: "Your wellness answers are visible to your club's staff. Injury
     detail is medical only."
2. Type into "Password".
   - Same controls visible as step 1.
3. Press "Sign in".
   - Also visible: "Forgot your password?".

**Branches.**

- IF the credentials are wrong THEN the page stays and shows an error; the
  attempt is written to `login_attempts` and to `audit_log`.
- IF the account has no athlete record and no staff role THEN sign-in succeeds
  but no athlete surface is reachable.
- IF arrived with `?next=` THEN the redirect after success is that path, once it
  has passed the safe-redirect check (relative paths only).

**End state.** Redirect to `/today`.

**The refusal copy, resolved 2026-09-10** by submitting deliberately invalid
details against scratch and reading `LoginForm.tsx`. Two messages exist and they
are different cases:

| Message | When |
|---|---|
| "That email and password do not match an account." | Wrong email or wrong password. Deliberately does not say which. |
| "That account holds no role in any club. Ask your club administrator to grant one." | The credentials are right but the account holds no role — the branch this document describes as "sign-in succeeds but no athlete surface is reachable". |

The failed attempt is recorded: a `login_attempts` row appears for that email
with `attempt_count` incremented, carrying `lock_count` and `locked_until`
columns, so repeated failures are rate-limited rather than merely logged.

---

---

## 3. What the screen is made of

Every value below is what the browser computes today.

| Element | Current |
|---|---|
| Page background | `--bg` `#e4ebf9` |
| Body text | `--text` `#13161c` |
| Secondary text | `--muted` `#484e57` |
| Primary action | `--accent` `#1f6fea` on `--on-accent` |
| Field radius | `--r-field` `12px` |
| Control radius | `--r-control` `6px` |
| Body font | Roboto 400/500/600/700/800, via `--font-sans` |
| Wordmark font | Sora 800, via `--font-brand` — the only place it is used |
| State transition | `--t-state` `0.15s ease` |
| Press transition | `--t-press` `0.08s ease` |

`.btn-primary` computes to Roboto 15px/700, white on `rgb(31, 111, 234)`,
radius 6px, padding 14px/20px. `.field` and `label.label` are in the full
reference.

**The complete palette — 171 tokens with exact light and dark values — is
`docs/Fydr_-_Design_System_Reference.md`.** That file is the constraint list.

---

## 4. The constraint any proposal must satisfy

The design is frozen (CLAUDE.md §0), with a scoped exception (§0.01) for the
flow under active review — which this is.

**Buildable without further approval:** anything composed from the existing
system — the 171 tokens, the radius scale, the spacing scale, the type scale,
and the two motion timings above.

**Needs flagging and confirming before it is built:** anything requiring a
pattern the system does not have — a new colour, easing curve, component shape,
radius, spacing step, type size or duration. The test is simply whether the
change can be expressed in tokens that already exist.

---

## 5. Known about this screen, and worth designing against

1. **The refusal does not say which field was wrong** — "That email and password
   do not match an account." That is deliberate (it avoids confirming whether an
   address is registered) and should stay unless deliberately revisited.
2. **A second, different refusal exists**: "That account holds no role in any
   club. Ask your club administrator to grant one." A person meeting it has
   valid credentials and no way forward inside the app.
3. **Failures are rate-limited, not just logged.** `login_attempts` carries
   `attempt_count`, `lock_count` and `locked_until`. The screen currently gives
   no indication that a lockout is approaching or has happened — a person who
   has been locked out sees the same message as someone who mistyped once.
4. **The page carries a synchronous inline script** that gates a one-time launch
   animation on `sessionStorage`. It runs before first paint and defaults to *no*
   animation, so any proposal that changes the opening moment interacts with it.
5. **Both apps share this screen.** The eyebrow reads "ATHLETE AND STAFF", and a
   staff member and an athlete sign in through exactly this form.

---

## 6. Not available

**There is no persona review for this flow.** `docs/walkthrough-reviews/` does
not exist — no directory, no findings, for this or any flow. If a persona pass
was expected to inform this brief, it has not been run.
