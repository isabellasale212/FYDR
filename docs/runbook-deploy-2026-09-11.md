# Deploy checklist — 2026-09-11 (prepared by the builder; run by Isabella the same day — outcome in §4)

## 0. Where production is now (verified read-only, 2026-09-11 ~13:00 BST)

- **App:** Vercel project `fydr` (team `fydr`), production deployment `dpl_BGhqk5CdR3bXDQdmFvC71CGoKShz`, commit `0510583` ("Stop the comments pinning a value that lives in Vercel"), deployed 2026-09-10 10:25 BST **from the CLI**, run inside a checkout of `athlete-spec-builder` (the CLI attaches the git metadata the listing shows; there is **no Git connection** on the project, so nothing deploys on push).
- Everything since `0510583` on `athlete-spec-builder` is therefore undeployed by design, not by failure. The next deploy is a manual CLI deploy, §1a below.
- **Database: production is through `0100`** (confirmed by the reviewer, 2026-09-11). Only `0101` and `0102` will apply; the reviewer confirmed both are safe against production's current code. Confirm read-only before pushing (§1b, step 2): the migration list must show exactly `0101` and `0102` as remote-missing.
- **Pre-flight, locally, on `athlete-spec-builder` at the merge of `1299d95`:** `npm run build` (runs the whole prebuild chain: 78 suites, 2422 assertions green at `1299d95`), and `npm run test:tenancy` against scratch (64 files, 1996 assertions green at `5929c2e`).

## 1a. The app deploy — CLI only, from a clean worktree at the approved commit

The approved commit is the `athlete-spec-builder` merge that contains `1299d95` (the reviewer's merge of `build/walkthrough`). Deploy the database first (§1b), then the app, so the app never runs ahead of the triggers it expects.

```sh
# 1. A worktree that holds exactly the approved commit and nothing else.
cd /Users/isabellasale/Developer/Fydr/fydr
git fetch origin
git worktree add ../fydr-deploy origin/athlete-spec-builder      # or the exact SHA once agreed
cd /Users/isabellasale/Developer/Fydr/fydr-deploy
git log --oneline -1                                             # must be the approved commit
git status --porcelain                                           # must print NOTHING: clean, no untracked files

# 2. Dependencies from the lockfile, and the same env default every worktree carries.
npm ci
cp ../fydr/.env.local .env.local                                 # the SCRATCH default — `npm run build`'s check:env-files refuses a production .env.local, and Vercel builds with its own env, not this file
git status --porcelain                                           # still nothing (.env.local and node_modules are ignored)

# 3. The whole guard chain, locally, before anything leaves the machine.
npm run build                                                    # prebuild: every test suite, then next build

# 4. Link the folder to the existing project (a fresh worktree has no .vercel/), then deploy.
npx --yes vercel@59.11.0 link --yes --scope fydr --project fydr
npm run deploy                                                   # = npx --yes vercel@59.11.0 deploy --prod   (pinned; never a bare `npx vercel`)

# 5. Afterwards.
cd /Users/isabellasale/Developer/Fydr/fydr && git worktree remove ../fydr-deploy
```

Do not deploy from `../fydr` (the reviewer's working checkout) or `../fydr-build` (the builder's): both are live working trees and neither is guaranteed clean. The `deploy` script is pinned to `vercel@59.11.0` for the reason recorded in `package.json` and `05-architecture.md` §4.1 — a moving `latest` broke a deploy once.

## 1b. Migrations to apply — only `0101` and `0102`

**Pre-check FIRST, read-only: does every production organisation already have a sport scientist?** 0101 refuses removing the last one; it cannot create the problem, but an org already at zero would be permanently stuck and must be known before the trigger exists.

```sh
cd /Users/isabellasale/Developer/Fydr/fydr-deploy
node --env-file=.env.production.explicit -e '
const pg=require("pg");const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL});
(async()=>{await c.connect();
console.log("target:", new URL(process.env.SUPABASE_DB_URL).host);
const o=await c.query("select o.id,o.name from organisations o where not exists (select 1 from user_roles ur where ur.org_id=o.id and ur.role=$1)",["sport_scientist"]);
console.log("orgs with no sport scientist:",o.rows);
await c.end();})().catch(e=>{console.error(e.message);process.exit(1)})'
```
Pass: `target: db.asbxorjytxsvrzefwzqp.supabase.co:5432` and `orgs with no sport scientist: []`. **If any org is listed, stop and say so before applying 0101.**

| # | File | What it does | Data it touches | Risk / note |
|---|---|---|---|---|
| 0101 | `user_roles_guard.sql` | BEFORE DELETE OR UPDATE trigger: refuses any change leaving an org with zero `sport_scientist` rows. Holds for every caller incl. service role; TRUNCATE unaffected; cascade from `users` refused. | None. | Pre-check above. Test 570. |
| 0102 | `user_roles_no_self_medic.sql` | Extends the trigger to BEFORE INSERT OR DELETE OR UPDATE: refuses granting `medic` to `auth_user_id()`; to others unchanged; no-JWT callers unaffected. | None. | Test 580. The enum value is `medic` (0063). |

**How the push works, exactly** (as it ran on 2026-09-11). `npm run db:push` = `node --env-file=.env.production.explicit scripts/db-push.mjs`, run **from the worktree folder** (`/Users/isabellasale/Developer/Fydr/fydr-deploy`), reading **only** `.env.production.explicit` in that folder (copied from `../fydr`; gitignored). It prints the host line — `Applying migrations to: db.asbxorjytxsvrzefwzqp.supabase.co:5432/postgres  ← NOT local` — then the Supabase CLI prints its confirmation question with the pending files:

```
Do you want to push these migrations to the remote database?
 • 0101_user_roles_guard.sql
 • 0102_user_roles_no_self_medic.sql
 [Y/n] y
```

The wrapper passes `--yes`, so the `y` is the CLI's own and the question does not wait for a keypress — the list is shown, then applied. That is why step 1 below (the read-only `migration list`) comes first: it is the same list with nothing behind it. If the prompt ever does pause for you (a CLI without `--yes`), answer `y` only when the list is exactly the files you expect.

So run these two commands, in this order:

```sh
# 1. Prints the target host and the pending list, applies NOTHING (`migration list` is read-only).
cd /Users/isabellasale/Developer/Fydr/fydr-deploy
node --env-file=.env.production.explicit -e 'console.log("target:", new URL(process.env.SUPABASE_DB_URL).host)'
node --env-file=.env.production.explicit -e 'require("child_process").execFileSync("npx",["--yes","supabase@2.116.0","migration","list","--db-url",process.env.SUPABASE_DB_URL],{stdio:"inherit"})'
```
Pass: `target: db.asbxorjytxsvrzefwzqp.supabase.co:5432`; in the table `0100` has both Local and Remote, and **exactly two** rows — `0101` and `0102` — have a Local version and an empty Remote. Anything else remote-missing: stop.

```sh
# 2. Applies whatever step 1 listed as remote-missing — which step 1 just showed is exactly 0101 and 0102.
cd /Users/isabellasale/Developer/Fydr/fydr-deploy
npm run db:push
```
Pass: first line `Applying migrations to: db.asbxorjytxsvrzefwzqp.supabase.co:5432/postgres  ← NOT local`; the CLI lists `• 0101_user_roles_guard.sql` and `• 0102_user_roles_no_self_medic.sql` and nothing else; `Applying migration …` twice; ends `"message":"Finished supabase db push."`.

Then `npm run verify:tier-rls` (same folder, same env file) as the standing post-migration check the repo already has.

## 2. App changes the deploy carries (commits since `0510583` touching `src/`)

Security: `f9b660c` sign-in form `method="post"` + route accepts form body, same-origin check, 303s · `add7d3f` every password form posts · `1a363f3`+`cfb22a2` "one attempt left" with the timing floor and `after()` audit write · `8632c4b`/`73392a2` §0ae UI chips + `roleToggleRefusal`. Design flows: `cb32bca` §0w hit areas · `9db60c5` ATH-ADULT-01 phone · `1299d95` sign-in desktop (headline Roboto clamp, **the claim column becomes visible for the first time**, form states at every width) · `cfd410b` ATH-ADULT-02 Today (RPE due/close rule, carry-over, "Rate {name}", tone cards). Earlier: `6398493` §0v, `328106d`, `fc85066`, `58bef86`.

**Runtime dependency:** `/auth/sign-in` now uses `next/server`'s `after()` — needs Vercel's `waitUntil` (standard on Vercel functions). Nothing to configure.

## 3. Post-deploy checks

### 3.1 Database (read-only SQL, production)
- `select tgname, tgtype from pg_trigger where tgname = 'user_roles_guard' and not tgisinternal;` → one row, `tgtype` **31** (BEFORE + ROW + INSERT + DELETE + UPDATE).
- The orgs-without-admin query from §1b again → `[]` (it was `[]` before the push; nothing should have changed it).
- `supabase migration list` shows `0101` and `0102` with a Remote version.

### 3.2 Sign-in (fydr.app)
- `/login` at ≥1080: **"Data, finally worth reading." and the three-column grid are visible** in Roboto (they were behind the fixed ground until `1299d95`); at 375: no scroll, eyebrow "For athletes and club staff", one-sentence sub, disclosure at the bottom.
- `/login?e=invalid&a=1` shows the warn banner "That did not match. One attempt left before a short wait."; `/login?e=locked&s=30` shows the ghost lock counting down.
- **Native submit path:** `curl -s -o /dev/null -w "%{http_code} %header{location}\n" -X POST -H "origin: https://fydr.app" -H "content-type: application/x-www-form-urlencoded" --data-urlencode "email=nobody.deploycheck@example.invalid" --data-urlencode "password=x" https://fydr.app/auth/sign-in` → `303 /login?e=invalid&a=4`. Without the `origin` header → `403`.

### 3.3 C1 timing check on PRODUCTION — required before the C1 item is closed (to-do §1158)
The 800ms floor was tuned to scratch latency from one machine. Measure:
1. Pick one **synthetic** production account (all 46 are synthetic) that can absorb four failures — not an account anyone is demoing with; each failure writes an `auth.sign_in_failed` audit row for it, and the fifth would lock it for 30s.
2. Interleave, JSON path, four each:
   `for i in 1 2 3 4; do for who in nobody.deploycheck@example.invalid <real>@…; do curl -s -w "\n%{time_total} %{http_code}" -X POST -H "content-type: application/json" -d "{\"email\":\"$who\",\"password\":\"wrong-$i\"}" https://fydr.app/auth/sign-in; echo; done; done`
3. Pass criteria: every 401 ≥ 0.80s; the unknown and the real account within ~40ms of each other at each step; bodies byte-identical — `{"ok":false,"locked":false,"error":"That email and password do not match an account.","attemptsRemaining":N}` with N = 4,3,2,1 for both. If the real account's failures exceed 800ms the floor must rise (`FAILED_SIGN_IN_MIN_MS`, `lib/signInSubmission.ts`) — say so rather than closing the item.
4. Scratch reference (2026-09-11): unknown 808–843ms, real 808–817ms; threshold 429 at 816 vs 817ms.

### 3.4 Today (as a synthetic athlete)
- To do is the first section; rows are name + line + chevron; "None left" / "You're up to date" when empty.
- An RPE row appears only ≥30 min after a session ends and disappears at the end of the following day (club time); opening `/rpe/<old session>` says "This session can no longer be rated."
- Availability Modified/Unavailable: one-line banner above To do links to the tinted card below.

### 3.5 §0ae in the UI (as the club's sport scientist)
- `/settings/users`: on your own row, Medic chip disabled with its title; Sport scientist chip disabled while you are the only one. Deactivate still disabled on self.

## 4. Outcome, 2026-09-11

Deployed and live: `7df310e` (the head of `athlete-spec-builder`, containing `1299d95`), deployment `dpl_BPhPtr9igAFd7a7RWJKbZcvTcMqW` = `fydr-p42jd9tj0-fydr.vercel.app`, aliased `https://fydr.app`. Migrations `0101` and `0102` applied to production; `user_roles_guard` present with `tgtype 31`; no organisation without a sport scientist; `verify:tier-rls` 14/14. Sign-in checks passed (headline and eyebrow served, native `303 /login?e=invalid&a=4`, no-Origin `403`). C1 timing measured on production: every 401 ≥ 0.80s, bodies identical at every step; the per-address **minima** — the noise-free comparison — matched within 20ms (1.027s vs 1.011s; 1.198s vs 1.192s), so the floor covers production's real-account path. `j.barnes@` carries four failed attempts from the test (a fifth locks him for 30s until his next real sign-in clears it).

**What went wrong:** the rollback command, then listed as Block 11 of the numbered sequence, was pasted along with the rest and ran — a paste, not a decision. Production served `0510583` for a few minutes against a database already carrying `0101`/`0102` (safe — the reviewer had confirmed the triggers against the old code) until Isabella promoted `dpl_BPhPtr9igAFd7a7RWJKbZcvTcMqW` in the Vercel dashboard and re-verified it (headline served; sign-in without an Origin header → 403). **Production is `7df310e` + migrations through `0102`.** Hence the section below.

---

# EMERGENCY ONLY — do not run unless a numbered check above has FAILED

These are not steps. Nothing in this section is part of a normal deploy, and pasting it after a successful run undoes the deploy.

**Know this before touching either command.** After a CLI `vercel rollback`, Vercel **pins** the old deployment to the production alias and keeps it pinned — a later `vercel deploy --prod` does **not** move the alias back. The pin is released only when a deployment is explicitly promoted (`vercel promote <deployment-url>`). So a rollback is always two decisions: the rollback, and, later, the deliberate promotion of whichever build should be live.

### App rollback
From a clean worktree linked to the project (a fresh `git worktree add`, then `npx --yes vercel@59.11.0 link --yes --scope fydr --project fydr` — not from `../fydr`, whose `.env.local` the link step would rewrite):
```sh
npx --yes vercel@59.11.0 rollback <deployment-id-or-url of the last known-good build> --scope fydr
```
Pass: "Success! fydr was rolled back to …". Then, when the fix is ready, re-promote explicitly:
```sh
npx --yes vercel@59.11.0 promote <deployment-url of the build that should be live> --scope fydr
```
Pass: the alias reports moving to that URL, and `curl -s https://fydr.app/login | grep -o 'For athletes and club staff'` prints the eyebrow (the pre-`9db60c5` builds say "Athlete and staff" — that line tells you which build is answering).

Last known-good before this deploy: `dpl_BGhqk5CdR3bXDQdmFvC71CGoKShz` = `fydr-et383maea-fydr.vercel.app` (`0510583`). Current live: `fydr-p42jd9tj0-fydr.vercel.app` (`7df310e`).

> **Addendum, reviewer, 16:35 BST:** superseded the same afternoon. A dashboard redeploy for the Dublin function region produced `dpl_BuZQTttnBLTyGgGRdTtUcLJCRYJX` = `fydr-jvgpijjra-fydr.vercel.app` (same `7df310e`), which now holds `fydr.app` — that is **current live**. It still runs functions in `iad1`; see to-do §0an.

### Database rollback
Neither `0101` nor `0102` rewrites data, so undoing them is dropping the trigger — **as a new migration, never by editing an applied one**: create `supabase/migrations/0103_drop_user_roles_guard.sql` containing `drop trigger if exists user_roles_guard on public.user_roles; drop function if exists public.user_roles_guard();`, run §1b step 1 (the read-only list) to see it as the only remote-missing file, then `npm run db:push`. Only if §1b's pre-check found a stuck organisation after the fact, or a real user is refused something they must do.
