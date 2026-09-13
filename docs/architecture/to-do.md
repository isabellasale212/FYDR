# Fydr architecture to-do

**Rewritten 13 September 2026. This is the working list.**
`docs/Fydr_-_Architecture_To-Do_List.md` is the ARCHIVE: full incident
write-ups, measurements and reasoning, worth reading when you want to know why
something is true. Several of its statements are now wrong.

**Age warning.** Items dated 4 to 8 September predate four production deploys
and roughly 150 commits. Anything marked **[verify]** was true when written and
has not been re-checked. Do not treat a [verify] item as open until somebody
has looked.

---

## 1. Standing decisions

See `docs/decisions/scope.md` and `docs/platform-decision.md` for the two most
recent. In brief:

- **Scope:** v1, the complete product across free and premium, ready to sell.
- **Platform:** one web product, two installable web apps, robust offline
  outbox and push on both, no native, Apple Health removed entirely.
- **Roles:** five staff roles, sport scientist holding admin duties. Athlete is
  a separate account type.
- **Injury visibility:** coach, sport scientist and S&C see body area, status,
  restrictions, expected return. Diagnosis, mechanism, severity, imaging,
  referral, treatment notes are medic-only. Protocol stage is stripped at every
  query read for every viewer.
- **Report visibility:** S&C sees every report except clinical detail.
  Nutritionist sees Compliance and a censored injury and availability report
  only. Squad weekly stays closed to them; `access-matrix.md` is stale here and
  must not be used to re-widen it.
- **Premium boundary (D-20):** a wholly premium destination disappears from the
  sidebar and refuses at the URL. A premium region inside a base page shows an
  upsell card and never vanishes silently.
- **Billing:** out of scope permanently.
- **Credentials:** no temporary passwords, invite links only.
- **Schedule:** sessions are not live on create, publish stays.
- **Nutrition:** targets recompute on every weigh-in; day types are three
  independent numbers with no shared rate.
- **Athlete transfers:** a fresh record, stated plainly, never a silent refusal.

---

## 2. Hard gates: before the first real person touches the app

All five are Isabella's, not the builder's.

- [ ] **Supabase Pro.** Free tier has no automated backups and no
      point-in-time recovery.
- [ ] **Decide the production region, then buy Pro against the right project.**
      Production is `eu-west-1`, Ireland, not London; five documents were
      corrected on 7 Sept to say so. Moving is far cheaper before real data.
      The move needs four things, none started: a Supabase management token or
      a new London project (region is fixed at creation); a decision on the 46
      accounts, re-invite or a real `auth` migration; `auth_hooks` recreated
      AND the access-token hook re-registered in the dashboard, which is not
      SQL and without which every RLS policy fails closed while the app looks
      healthy; and `retention`, `cron`, `storage`, `vault` assessed, because
      the rehearsed dump covers `public` only and `cron` holds the nightly jobs.
- [ ] **Verify `fydr.app` in Resend.** `EMAIL_FROM_ADDRESS` is
      `onboarding@resend.dev`, which can only send to the Resend signup
      address, so **invites cannot currently reach a real player.**
- [ ] **DPA, legal review, ICO registration.** Carry the under-18 question into
      the same conversation: what a parent or guardian may receive.
- [ ] **Tell the medical staff that the injury `mechanism` field is
      athlete-visible.** No length limit, no constraint, no guidance shown to
      the medic typing it. A live example already carries an assessment
      finding. A conversation, not a ticket.

---

## 3. Open security and correctness

- [ ] **Invitation revoke does not exist (S8 D5).** Nothing invalidates an
      invite link early. Deactivating the account does not stop the link
      signing the person in; the token then carries no org and no roles, so it
      grants nothing. "Kills the link at once" is false, "grants nothing at
      once" is true. **Decision needed**, recommended: build a real revoke.
- [ ] **Archived groups keep scoping every screen (S8 D9).** A cookie or link
      naming an archived group still filters while the chip row cannot show it,
      so every denominator on every report is quietly wrong. Next builder item.
- [ ] **`auth.audit_log_entries` has never received a row** on either project.
      Pruning ruled out by insert counters. Two questions remain, both outside
      this repository: whether GoTrue needs it enabled, and whether the
      dashboard retains the history independently.
- [ ] **Sign-in attempts against unknown addresses are recorded nowhere.**
      Approved: a platform-level view gated by `isPlatformStaff()`. Settle two
      things while building: what is stored in place of the attacker-controlled
      email, and whether every attempt is written or only streak boundaries.
      The lockout does not bound this case, because the email never succeeds so
      the streak never clears.
- [ ] **Audit trigger widening: 26 of 59 tables.** [verify] 0088, 0089 and 0091
      were scratch-only on 8 Sept and may have gone out with a later push.
      Rules: `audit_log` must never get a trigger; the six highest-volume
      tables would roughly ten-times it and much of that volume has no human
      actor; `organisations` and `metric_definitions` are excluded for shape.
- [ ] **[verify] Migration 0090**, four tables holding grants their migrations
      say they do not have.
- [ ] **[verify] `app_role` enum** said to hold four values rather than five.
      Probably long closed.

---

## 4. Open product decisions

- [ ] **Does a fixture create a linked match session?** Nothing writes
      `fixture_id`, so a club creating a fixture has told nobody to turn up to
      anything: no participants, no RPE, zero contact minutes. The backfill
      rides along: four seeded match sessions with a null `fixture_id` are
      orphans, rows to link by date, or seed data to delete. A half-linked
      schema is worse than either end state.
- [ ] **Does the app record who played and how many minutes?** Answerable from
      the code, and the match report cannot be defined until it is.
- [ ] **RPE scale.** 1 to 10 in the app, 0 to 10 for standard CR-10.
- [ ] **Who may change an athlete's availability status.**
- [ ] **Wellness notification timing:** every morning at 08:00, or only on
      mornings a check-in is expected. Written as expected mornings only.
- [ ] **The clinical-conflict rule for staff offline.**
- [ ] **Premium:** contents, what a free club sees in its place, downgrade.
- [ ] **Retention period after an athlete leaves a club.**
- [ ] **GPS raw data:** does the vendor export per-reading data at all, what
      would the screen show, how long are readings kept. The first gates both.

---

## 5. Build backlog

**New boards from the platform decision, neither designed:**

- [ ] **S11, installability and offline.** Manifest, icons, splash, app shell,
      one shared IndexedDB outbox for both apps, service worker, retry with
      backoff, visible queue state, manual send now, last sync time, and the
      on-screen teaching of the iOS install flow. `manifest.webmanifest`
      already returns 200, so start by reading what it contains.
- [ ] **S12, premium.** Inventory first, from the code and the live policies.

**S9, notifications.** Specified in `docs/platform-decision.md` part two.
Service worker, VAPID keys, a subscription table, a send path, per-person
preferences and quiet hours. The preference columns exist and no screen sets
them. `push_tokens` holds 43 seeded rows from the abandoned Expo plan that no
code has ever written; do not read them as devices.

**Offline foundation.** One shared local-then-sync foundation, not one per
screen. Append-only writes first. On conflict the coach confirms before an edit
overwrites a server change, queued for their attention rather than interrupting
on background sync. A manual sync button with a pending count and last
successful sync time beside it.

**Known bugs and gaps** [verify all, 4 to 7 Sept]:

- [ ] Re-uploading a GPS file duplicates every row. No unique constraint.
- [ ] GPS import accepts ten headings; running distance and high intensity
      efforts are rankable measures with data that no upload can update.
- [ ] The new week template screen gates on "coach or medical".
- [ ] The new fixture screen's expired-session guard does not fire; the form
      redirects silently with nothing saved.
- [ ] Session deletion gives a worded refusal for two linked types and a
      generic error for the other four.
- [ ] Editing a test's direction does not recalculate personal bests.
- [ ] The retention run is neither resumable nor transactional.
- [ ] Positional groupings are a hardcoded six-unit rugby mapping and need a
      club-level table.
- [ ] The launch sign-in page headline and feature grid. Two calls needed:
      clamp the headline or keep a fixed 48px and raise the claim breakpoint to
      1100; and whether a Sora headline is acceptable beside the wordmark rule.
- [ ] The collapsed sidebar rail's 5.6px ringed dot. Correct, and faint.

**Permission tightenings agreed and [verify] unbuilt:** schedule editing to
coach and sport scientist (D-06); nutrition authoring to nutritionist and sport
scientist (D-03); gym programmes to S&C and sport scientist (D-04);
leaderboards to S&C and sport scientist (D-05); group create, edit, delete to
coach and sport scientist; analytics to sport scientist only (D-02);
availability-setting and injury-closing on the injury record to medic only
(D-35).

**Smaller agreed items** [verify]: a dismissed flag reopenable by coach or
medic; a real delete for exercises, refused by name if a live programme
references it; gym programme changes versioned with a warning naming how many
athletes are assigned; a warning before editing a leaderboard's measure;
"Retire a board" renamed "Delete a board" and explicitly irreversible; a
warning when granting a role that combines with nutritionist; quiet hours per
person; the timetable linked from the dashboard; the injuries screen kept out
of the sidebar; the analytics readiness calculation relabelled "Complete-day
readiness"; match days count as training days for wellness expectation.

---

## 6. Working rules that must not be lost

- **Tests first, Run-verified with a real write, report after each batch, tell
  Isabella before deploying.** No exceptions.
- **Scratch database only for agent work.** No production writes, no `db:push`
  to production, no Vercel commands from the builder.
- **Deploys run from a clean worktree at an approved commit, database first,
  then app.** `vercel link` always carries `--scope fydr --project fydr`, and
  the `project.json` id is compared before deploying. Rollback commands are
  emergency-only and never part of a normal paste.
- **Do not blanket-approve batches mixing cosmetic fixes with access control.**
- **Check each table's actual shape before assuming a pattern fits.** Two shape
  surprises in ten tables, twice.
- **A policy replacement must assert what the old policy refused**, not only
  what the new one allows. 154 role-gating policies exist, 64 have every
  refusal asserted, and `user_roles` has zero.
- **Guards run in `prebuild` and fail the build:** invisible-gate,
  default-privileges, service-role grants, audit-trigger volume,
  inclusive-copy, session-creating-route sweep, policy-replacement.
- **Seeded dates drift.** `seed.sql` authors dates as offsets from
  `current_date`. Re-check before any demo.

---

## 7. Closed, as one-liners

Audit triggers on ten tables, on production. Sign-in history in `audit_log`
including the PKCE reset path. Failed sign-ins against real accounts recorded.
Real client IP and user agent forwarded to GoTrue. `login_attempts` execute
grant fixed and put in the migration history. `users.last_seen_at` written on
sign-in and excluded from the audit diff. The GPS tier gate moved inside
`compute_leaderboard`. Default-privilege gaps closed. Email sending live for
invite and reset. The invisible-gate guard and the six real bugs it found. 108
occurrences of "he" about athletes rewritten. Timetable and attendance
permissions. Flags and player-profile field-level rules. Favicon, apple-icon,
OG image and manifest, all previously 404. The five-role model throughout.
Migrations 0101 to 0110 on production.
