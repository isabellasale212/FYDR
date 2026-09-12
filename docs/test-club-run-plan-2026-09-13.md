# Test-club run-through — the plan (proposed 2026-09-12, for approval before anything is created)

**What it is.** A fresh synthetic club on **scratch**, created the way a real club would be,
exercised end to end by all five staff roles and by athletes, with every gate probed from
the wrong side at the database as well as the screen. It is the demo rehearsal and the
highest-value pass for permission gaps: every review so far ran against Ashcombe's seeded
state, where every screen already had data and every account already existed. A club
that starts empty finds the flows the seed hides — the first session, the first invite,
the first injury, the empty states, the order things must happen in.

**What it is not.** Not production (nothing here touches `asbxorjytxsvrzefwzqp`); not a
review of design (findings go to the to-do list as defects or gates, with the design
briefs untouched); not a data-repair exercise (bad rows are reported, not fixed — the
standing rule).

**Where the reviewer's rules bend, and only there.** The whole exercise is writes on
scratch — a new club, isolated by `org_id`, so Ashcombe, Conor and Matt Reid are untouched.
No code changes; no production; explicit-path commits; gate findings to Isabella directly.

---

## 0. What I need from you before step 1

| # | Need | Why | Proposed default |
|---|---|---|---|
| 1 | **The go to write on scratch** for a new organisation | every step below is a write | — |
| 2 | **Who runs `create:org --commit`** | the script needs the service role and its own header says it is "pointed at production"; on scratch it is a dry run until `--commit` | you run the one command from `../fydr` with `.env.local`; or authorise me to |
| 3 | **Club identity** | name, sport, timezone, tier, season | "Harlow Vale RFC" · `rugby_union` · `Europe/London` · **tier `premium`** (GPS import and the training report are Premium; a Basic run would skip them — say if you want both) · season as the script defaults it |
| 4 | **Six staff identities** on a fresh reserved domain (`@harlowvale.example` — reserved, never mailed; the invite link is shown on screen locally) | one account per role plus a second sport scientist for the last-admin guard | Priya Nair (sport scientist, first admin) · Tom Ashworth (head coach) · Dr Hannah Lisk (medic) · Femi Adebayo (S&C) · Laura Quinn (nutritionist) · Sam Byrne (second sport scientist) |
| 5 | **A roster of 12 athletes** with dates of birth, positions, groups | enough for groups, a leaderboard (three qualify), an under-18 (the opt-in rule), one on a rehab path from day one | I draft 12 names/DOBs/positions in the plan's appendix; you strike or rename |
| 6 | **A GPS CSV** | the import flow | I build one from the app's own template route for three athletes and one session; no vendor file needed |
| 7 | **Two-factor** | the hub prompts coach/medic/admin to enrol; TOTP needs an authenticator | I enrol one account (the medic) with a TOTP secret held in the scratchpad, to run the challenge once; the rest stay "prompted, not enforced" — say if you want none |
| 8 | **Keep or drop afterwards** | the club could stay as the standing demo club on scratch | keep; and the same steps, replayed by you on production, become the real demo club |

Nothing in 3–7 blocks starting if you accept the defaults.

## 1. Order of creation — as a club would do it

Each step names the actor, what is created, and what is checked before moving on. Gates
are probed at every step from the wrong side (PostgREST with the wrong role's session, the
method used on 2026-09-12), not only from the right one.

**Day 0 — the club exists (Isabella / script)**
1. `create:org` → organisation, season, the first sport scientist, an invite link. *Check:* the org is invisible to every existing account (Ashcombe's Jane cannot read it at the database); the invite link works once and only once.
2. Priya accepts, chooses a password, lands on an **empty dashboard**. *Check:* every empty state on every sidebar row, at 1280 and 375, with the nav rule in mind (what the admin sees with nothing set up).

**Day 0 — the admin sets the club up (Priya)**
3. Club details: name, sport, timezone, logo. 4. Plan: confirm the tier renders and the Premium rows exist. 5. Groups: Forwards, Backs, Academy; team selections 1st XV / 2nd XV. 6. Thresholds: the seeded defaults, one edited, one added. 7. Notifications: her own. *Check:* audit rows for each write (the "records of record" coverage); the group filter appears on every multi-athlete screen once groups exist.

**Day 0 — the people (Priya)**
8. Invite the coach (single invite) and the other four staff (bulk invite). *Check:* each link single-use; the roles chips; the last-admin guard (0101) and the no-self-medic guard (0102) exercised on this club — Priya cannot grant herself medic, cannot remove her own last sport-scientist role; Sam Byrne (second SS) added, then Priya's own SS role can be removed and restored.
9. Each staff member accepts and lands. *Check:* the role slot in the phone bar, the More sheet per role, the hub rows per role — against the nav rule decided 2026-09-12.
10. Add 12 athletes via Add athlete (with invite email) and the bulk path; each accepts. *Check:* the under-18 athlete's leaderboard opt-in state; Add athlete's transfer message for a name that exists at Ashcombe; the roster and its sideways scroll at 375.

**Day 1 — structure (the roles that own it)**
11. Schedule (Tom, coach): a week of sessions from the wizard and the form, a fixture, saved as a template, applied to next week, published. *Check:* athletes' Today shows the week only after publish; §0al's offline-publish hold once (network cut at publish, week kept, published on return); session audit rows (0104).
12. Programmes (Femi, S&C): the exercise library incl. a bodyweight movement and a 1.25 kg step (0108), a gym programme, assigned to Forwards; a rehab programme is Hannah's. *Check:* the label is the tell; the S&C cannot author rehab; PROGRAMME_AUTHOR limits.
13. Nutrition (Laura): a plan per group, day-type targets, a manual target, the meal library. *Check:* athletes with no weigh-in get general guidance (§0b L734 — first real test); the targets recompute on a weigh-in.
14. Leaderboards (Femi or Tom): one board, published to athletes. *Check:* it renders only once three athletes qualify; the under-18 absent until they opt in.
15. GPS (Priya): import the CSV, then re-import it. *Check:* rows replaced, not doubled (0064/0072 on a fresh club); the recent-imports list; the export of a batch.

**Day 1–3 — athlete life (two athletes: one adult, the under-18)**
16. Wellness check-in (all six questions), RPE after a published session (30 min after it ends, and the close at the end of the following day), gym logging through the programme (a set logged offline and flushed; one set corrected; the tonnage on My data), the weekly nutrition check-in (and its one correction), report a problem (read by the medic alone), notification preferences (mute all, restore), export my data, leaderboard opt-out and back, the under-18 opt-in. *Check:* each write audited where the coverage says it is; compliance counts exactly as expectations say (the §0ad cutoff on a real late rating); "Sessions logged" only once a set exists.

**Day 2–3 — staff life by role**
17. Coach (Tom): dashboard, squad, a non-injury availability (illness), a correction, acknowledge a flag, print the injuries board, exports. 18. Medic (Hannah): log an injury from the pitch-side form, the clinical record, availability with the who-will-read-what step, a rehab group phase, a problem-report note, the SAR review when Priya opens a request, the "MEDICAL IN CONFIDENCE" PDF. 19. S&C (Femi): propose a programme for the injured athlete — and, per §0bb (not yet built), try the same as Priya to record the current bypass; weigh-in; publish a board. 20. Nutritionist (Laura): the plan flow end to end; the profile's weigh-in; the nav she should not see (the nav rule, measured). 21. Admin (Priya): users and roles, the audit log filtered per type, exports (every domain), a retention preview (not a run), a SAR request → Hannah's review → release, the data-retention page.

**Every step — the wrong side.** For each write in 3–21, the same write attempted by each role that should not hold it: at the database (PostgREST with that role's session) and at the screen (the control absent, blocked with a reason, or a refusal page). One matrix, filled in as we go.

## 2. What I check, and how it is recorded

- **A step log** — `docs/test-club-run-2026-09-13.md` — one line per step: actor, action, expected, measured, audit row yes/no, gate probes, screenshots where a state matters (1280 and 375).
- **The gate matrix** — every write × every role, database and screen, with the migration or constant that decides it. Any row where the database allows what the screen hides, or the screen offers what the database refuses, goes to you the same day, not into the log.
- **The audit matrix** — every write × whether `audit_log` holds it (the coverage list from §0e L185, tested rather than read).
- **The empty-state inventory** — every screen as it looks with nothing in it, at both widths, against the design boards that drew empties.
- **Pilot-list items re-verified on a real club**: §0ad (the cutoff), §0u (sessions logged), §0at (tonnage from the first set), §0al (publish hold), 0101/0102 (the guards), 0107 (once-only correction), 0108 (the step), the nav rule (§0av).
- **Findings** filed on the to-do list as defects (with the step that produced them) or as gate findings to you directly; nothing redesigned.

## 3. Sequence and effort

Day 0 (steps 1–10) is one sitting — about two hours, mostly invites. Day 1 (11–15) a second sitting. Days 1–3 (16–21) can be compressed into a third sitting by moving the clock in the data (the RPE window and the check-in week are date-driven; I will say where I move a date rather than wait). Reports after each sitting, in the batch format: what was created, what held, what broke, what is for you.

## Appendix — the proposed roster (strike or rename)

| # | Name | DOB | Position | Group |
|---|---|---|---|---|
| 1 | Jack Morland | 1998-03-14 | Loosehead prop | Forwards |
| 2 | Kofi Mensah | 1996-11-02 | Hooker | Forwards |
| 3 | Ethan Rooke | 2001-07-19 | Lock | Forwards |
| 4 | Ben Talbot | 1999-01-28 | Flanker | Forwards |
| 5 | Liam Oduya | 2000-05-05 | No. 8 | Forwards |
| 6 | Sean Kavanagh | 1997-09-30 | Scrum-half | Backs |
| 7 | Owen Prosser | 2002-02-11 | Fly-half | Backs |
| 8 | Reuben Achebe | 1998-12-08 | Centre | Backs |
| 9 | Harry Fenwick | 2003-06-22 | Wing | Backs |
| 10 | Marcus Delaney | 1995-04-17 | Full-back | Backs (on a rehab path from day one) |
| 11 | Tyler Nkemelu | 2009-10-03 | Wing | Academy (**under 18**) |
| 12 | Callum Brice | 2008-08-26 | Centre | Academy (turns 18 during the season) |
