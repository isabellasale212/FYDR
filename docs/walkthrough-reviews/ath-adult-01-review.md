# Persona review — ATH-ADULT-01, Sign in

**Persona.** An athlete on their own phone, tired after training, standing up,
one hand. Not at a desk, not reviewing UI, not patient.

**Reviewed 2026-09-10** against the running screen at 375×812, signed out, plus
`LoginForm.tsx` and `PasswordField.tsx`.

---

## A correction to the premise before the answers

The brief for this review says "an athlete who does this daily". **They do not.**
Verified: navigating to `/login` with a live session lands straight on `/today` —
the session persists and is refreshed by middleware. An athlete signs in when
they are first invited, after signing out, when the session finally expires, or
on a new phone.

That matters for everything below. **This is not a daily screen; it is an
occasional screen almost always met at a bad moment** — a new handset, a
forgotten password, a lockout. The thing they do daily is ATH-ADULT-03, the
wellness entry. Optimising this flow for repetition would be optimising for a
frequency it does not have; optimising it for *recovery under mild stress* is the
real job.

---

## 1. How many taps, and is any step redundant?

**Three taps and two typed strings**, with nothing redundant:

| | Action |
|---|---|
| 1 | Tap "Email", type |
| 2 | Tap "Password", type |
| 3 | Tap "Sign in" |

The screen **fits one phone viewport with no scrolling** — page height 812px at a
812px viewport — so nothing is reached by scrolling.

**With a password manager it collapses to roughly one tap**, because the
autocomplete attributes are right: `username` on the email field and
`current-password` on the password field. This is the single biggest thing the
screen already does well for this persona, and it is invisible when it works.

**Two extra steps exist and are conditional, not redundant:** a 6-digit TOTP code
when the account has two-factor on, and the reset flow behind "Forgot your
password?".

**Nothing here should be removed.** Two fields is the floor for a password login.

---

## 2. Does any label or copy not match how this person thinks?

**Three, in descending order of how much they matter.**

**"Your morning entry takes 45 seconds" is copy about a different task.** It sits
under the heading on the sign-in screen. It is a good sentence — it is just
answering "is this app going to be a burden", which is a *first-run* question. A
person signing in on a replacement phone at 9pm, or after being locked out, is
not asking it. It is the most prominent line on the screen after the heading and
it is aimed at someone who is not there.

**"ATHLETE AND STAFF" is systems vocabulary.** Nobody thinks "I am an athlete
user of a dual-audience application". It is doing a real job — telling a coach
they are in the right place — but it says it in the product's terms, not the
person's.

**"Use the email address your club invited you on" is the best line on the
screen** and should survive any redesign. It answers exactly the question a
returning person has — *which* email — and it names the club, which is how they
actually remember it.

---

## 3. Where is a mistake most likely, and can it be undone?

**Most likely mistake: the wrong email, not the wrong password.** Athletes are
invited on a club address they may never otherwise use. The screen already
anticipates this in copy but does nothing else about it.

**The error does not say which field was wrong** — "That email and password do
not match an account." That is deliberate and correct: saying which would confirm
whether an address is registered. It should stay.

**A correction to a finding recorded in the brief.** The brief said a mistyped
password and an actual lockout produce the identical message. **That is wrong.**
Read in `LoginForm.tsx`:

| State | Message | Button |
|---|---|---|
| Wrong details | "That email and password do not match an account." | "Sign in", enabled |
| Locked out | "Too many attempts. Try again in {countdown}." | **"Locked · {countdown}", disabled** |

The lockout is handled well: a distinct `role="alert"` message, a **live
countdown** that re-renders each second, and the button carrying the timer in its
own label while disabled. The earlier claim was made from the walkthrough
document rather than the component, and was not true.

**What IS missing is the approach.** There is no signal before the lock lands —
no "2 attempts left". A tired person mistyping a saved password twice has no idea
they are one attempt from a wait, and the first they know is the lock.

**Nothing here is permanent.** The reset flow exists and is one tap away.

---

## 4. Anything the person must read that the screen could infer?

**The email.** The screen does not remember it. On a returning device the field
is empty every time, so a person who has signed in before still retypes an
address they were given by someone else. The browser or password manager often
covers this, but the screen itself never does.

**Whether this device has been used before.** The screen is identical for a first
invite and a fifth sign-in, so the "which email" copy is shown at full weight to
someone who has already answered that question many times.

---

## 5. Is there a moment where it's unclear whether it worked?

**Yes, briefly, and it is the weakest moment in the flow.**

On submit the button reads **"Signing in"** — with **no ellipsis**, unlike every
other pending label in the product, which uses "Saving…", "Creating…",
"Publishing…", "Sending…". A trailing character is a small thing, but it is the
product's own convention for *something is happening, wait* and this screen does
not use it.

Then success is `router.replace(next)` followed by `router.refresh()`. There is
no success state on this screen at all — correctly, since the destination is the
confirmation. But between the tap and `/today` painting there is a window with a
disabled button reading "Signing in" and nothing else moving. On a tired thumb on
a slow connection, that window is exactly where a person taps again.

**The button is disabled during it**, so a second tap does nothing — the flow is
safe. The uncertainty is a feeling, not a fault.

---

## Summary for design

| # | Finding | Weight |
|---|---|---|
| 1 | Copy answers a first-run question ("45 seconds") on a screen mostly met by returning people | **Highest** — most prominent, least relevant |
| 2 | No warning as lockout approaches; the lock itself is handled well | **High** — the one real gap in error handling |
| 3 | "Forgot your password?" is a **15px-tall** tap target, far below the 44px the fields use | **High** — a phone-specific failure on the recovery path |
| 4 | Pending label "Signing in" breaks the product's own "…" convention | Medium |
| 5 | The email is never remembered | Medium |
| 6 | "ATHLETE AND STAFF" is systems vocabulary | Low |

**Already good, and worth protecting in any redesign:** correct autocomplete
attributes; a labelled password reveal (`aria-label="Show password"`); the whole
screen in one viewport with no scroll; 48px field targets; the deliberate refusal
to say which field was wrong; and the lockout countdown.

---

## Decisions recorded 2026-09-11

- **F5 (email never remembered): the "remembered device" proposal is DECLINED** — no email stored on shared devices; browser autofill instead. Closed by `autocomplete="username"` on the field. See §0ab.
- **The no-role screen (proposal C3) is DEFERRED** to its own scheduling after the 01 design lands. See §0ab.
