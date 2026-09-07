# Runbook: onboarding a new club

What to do the day a real club says yes. The tooling is built and tested; this
is the procedure around it.

**Read `docs/runbook-backup-and-recovery.md` §0a first.** Do not onboard a real
club onto the Free tier. There are no automated backups and no point-in-time
recovery, and everything below creates data that is not yours to lose.

---

## 1. Before the day

Everything here is slower than the technical work and none of it can be rushed
on the morning.

- [ ] **A signed DPA.** The club is the controller and Fydr is the processor —
      `docs/09-security-and-compliance.md` §3. This is the document that makes
      the processing lawful, and it comes before the organisation exists, not
      after.
- [ ] **Incorporated.** §2 of the same document is blunt about the personal
      liability of signing a data processing agreement as an individual.
- [ ] **Region confirmed.** See the open item in the architecture to-do list.
      Production is currently in `eu-west-1` (Ireland) while the compliance
      document says London in four places. Resolve that before a club's data is
      in it, because §5 of that document says the region cannot be changed after
      project creation.
- [ ] **Know the answers to the three questions every club asks**: where the
      data lives, who can see injury detail, and what happens when a player
      leaves. All three are in `docs/09-security-and-compliance.md`; the point is
      to have read them beforehand.

---

## 2. Creating the organisation

`scripts/create-org.ts`. **Dry run by default — nothing is written without
`--commit`.**

```bash
cd /Users/isabellasale/Developer/Fydr/fydr
npm run create:org -- \
  --name "Real Club RFC" \
  --sport rugby_union \
  --tier premium \
  --timezone Europe/London \
  --admin-email "first.person@theclub.example" \
  --admin-name "Their Name"
```

Read the dry run. It prints exactly what it will create. Then add `--commit`.

**What it does, and the order matters** — it rolls back in reverse on any
failure, so a half-created club is not a state you can end up in:

1. The `organisations` row, with sport, tier, timezone and season.
2. A `users` row for the first staff member.
3. A `user_roles` grant of `sport_scientist` — deliberately, because that role
   carries the admin duties in the five-role model. `docs/access-matrix.md`.
4. An invite link for them to set their own password.

**It refuses to create a duplicate** (`DuplicateOrgError`) rather than making a
second club with the same name.

---

## 3. The first person

They get an **invite link**, not a password. Temporary passwords were removed
from account creation entirely — `G-03`/`D-38`, decided 2026-09-05 — because
squad credentials then travel by whatever channel is to hand.

The link goes to `/auth/confirm`, which verifies a `token_hash` server-side and
signs them in, so they set a password in one click. It is **single use** and
failure is deliberately vague about which failure it was.

- Send it directly to the person, not to a shared inbox.
- **`/auth/confirm` requires no browser state**, unlike the password-reset flow,
  which is PKCE and only works in the browser that asked for the email. An
  invite forwarded to a colleague still works; a forwarded reset link does not.
- If it expires, re-issue rather than trying to recover it.

Their sign-in will be recorded in `audit_log` as `auth.signed_in` with the real
IP and browser, and an invite acceptance is distinguishable from an ordinary
sign-in by `metadata.method`.

---

## 4. Once they are in

Order that gets a club to something useful fastest:

1. **Athletes.** `/squad/new` individually, or bulk invite.
2. **Groups.** Forwards, backs, academy, rehab. The group filter is global and
   every multi-athlete screen respects it, so this shapes everything after it.
3. **Their own staff.** `/settings/users`, each with the narrowest role that
   works — `docs/access-matrix.md` is the reference, not intuition.
4. **Thresholds.** `/settings/thresholds` seeds defaults; they will want their
   own numbers.
5. **The season's fixtures.** The MD spine is what the dashboard and schedule
   are built around, so a club with no fixtures sees a much weaker product.

---

## 5. Verifying, before you tell them it is ready

```bash
npm run verify:audit-trail       # read-only
npm run verify:login-attempts    # read-only — is the rate limiter recording
```

And by hand:

- [ ] Sign in as their first account. Not as yourself.
- [ ] The sidebar shows what that role should see, and no more.
- [ ] A second club's data is not reachable — the tenancy suite covers this
      (`npm run test:tenancy`), but look once.
- [ ] `/settings/audit` shows their sign-in.

---

## 6. What is not built yet

Say these before a club discovers them.

- **No billing surface.** Permanently out of this specification, not "not yet" —
  decided 2026-09-05, resolves D-17. Invoicing happens outside the product.
- **No SSO.** No SAML, no OIDC anywhere in the codebase.
- **The athlete app is mobile web, not a native app.** It is a real, complete
  experience and it is not in the App Store. `CLAUDE.md` §8.
- **Email delivery is usually a no-op.** `lib/email/provider.ts` — with no
  provider configured the invite link is returned on screen rather than sent.
  **Check this before promising a club that invitations will arrive by email.**
