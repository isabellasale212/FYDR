# Runbook: backup and recovery

**Status: the procedures below were executed end to end against production and
scratch on 2026-09-07 and the numbers are measured, not estimated. What is NOT
yet verified is anything Supabase provides — the project is on the Free tier,
which has no automated backups and no point-in-time recovery. Those sections say
so explicitly rather than describing a capability that does not exist yet.**

This runbook exists because `docs/09-security-and-compliance.md` §5 makes a
commitment that nothing currently backs: *"erasure takes effect on live systems
immediately and on backups within 30 days as they rotate."* There is no
rotation. See §6.

---

## 1. What you can actually run, and on what

| Tool | State | Notes |
|---|---|---|
| `pg_dump` / `psql` | **Installed 2026-09-07**, `brew install libpq` | Keg-only. Not on PATH by default — see below. |
| `supabase db dump` | **Does not work on this machine** | Fails with `LegacyDockerRunError` even for a remote `--db-url`. Docker Desktop is not installed and is a hard prerequisite. Re-confirmed 2026-09-07. |
| Supabase automated backups | **Not on the Free tier** | The reason `0a` is a hard gate. |
| Point-in-time recovery | **Not on the Free tier**, and priced separately above it | Isabella is deciding this directly against Supabase's pricing page. |

libpq is keg-only, so every command below assumes:

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
```

**Client and server versions differ and it worked anyway.** `pg_dump` 18.6
against a 17.6 server, restored into a 17.6 server. That is the pairing actually
tested. A newer client dumping an older server is the supported direction; if a
future restore fails on unrecognised syntax, install `postgresql@17` for a
matching client rather than debugging the output.

---

## 2. Taking a backup

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
cd /Users/isabellasale/Developer/Fydr/fydr
URL=$(grep '^SUPABASE_DB_URL=' .env.production.explicit | cut -d= -f2-)

pg_dump "$URL" --schema=public --no-owner --clean --if-exists \
  -f "fydr-production-$(date +%Y%m%d-%H%M).sql"
```

**Read-only. It cannot damage the source.**

Measured on production, 2026-09-07 (26 MB database, 7,859 live rows):

| | |
|---|---|
| Elapsed | 16–19 seconds |
| File | 2.2 MB, 19,383 lines |
| Contents | 59 tables, 54 functions, 189 policies, 41 triggers, 48 types, 99 indexes, 284 grants, 59 `COPY` data blocks |

### `--no-owner` yes, `--no-acl` NEVER

This is the single most important line in this document, and it was found by
doing the drill rather than by reading the flags.

The first attempt used `--no-acl` to avoid ownership noise. The restore reported
success, **every table's row count matched production exactly**, and all 189 RLS
policies were present. The application was completely dead: every PostgREST
request returned `42501 permission denied for table users`.

`--no-acl` strips every `GRANT`. Production carries **anon=7,
authenticated=189, service_role=462** table grants; the restored database had
**zero**. RLS policies do not grant access — they filter access that a `GRANT`
has already given. Without grants there is nothing to filter.

**A restore verified only by row count would have passed.** Check grants (§5).

### What this dump does NOT contain

- The `auth` schema — users, identities, sessions. Supabase owns it.
- `storage` objects.
- Extensions, roles, and anything outside `public`.

That is survivable for the `public` schema because nothing in it depends on
`auth`: the only `auth.` strings in the dump are the `auth.signed_in` and
`auth.sign_in_failed` values in `audit_log` data. But it means **a restore does
not restore anybody's ability to log in**. See §4.

---

## 3. Restoring

**Restore into a FRESH, EMPTY project. Not over a database that already has the
schema.** The drill proved why.

```bash
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
psql "<TARGET_DB_URL>" --no-psqlrc -v ON_ERROR_STOP=0 -f fydr-production-YYYYMMDD-HHMM.sql
```

Measured restoring production into scratch: **108 seconds**.

### Why not over an existing database

`--clean` drops each object before recreating it, and eight drops failed:

```
cannot drop function public.auth_org_id() because other objects depend on it
cannot drop function public.auth_has_any_role(public.app_role[]) because other objects depend on it
cannot drop type public.app_role because other objects depend on it
cannot drop schema public because other objects depend on it
  → then: "schema public already exists", "type app_role already exists",
    "function auth_has_any_role already exists", "function auth_org_id already exists"
```

The dependent object is `auth_hooks.custom_access_token_hook`, which lives
outside `public` and reads `public.users` and `public.app_role`. It is not in
the dump, so `--clean` cannot drop what it holds.

**The restore then keeps the TARGET's existing definitions of those objects and
carries on.** In this drill that was harmless because both databases had
identical definitions. If they had differed — which is the entire reason you
would be restoring — the restore would silently have kept the wrong ones, and
`auth_org_id()` is the function every RLS policy in the product calls. Row
counts would still have matched.

`ON_ERROR_STOP=0` is deliberate so the restore completes and you can read the
whole error list; it is not permission to ignore it.

### A second error class, harmless but noisy

Keeping the ACLs adds twelve of these:

```
ERROR:  permission denied to change default privileges
```

They are `ALTER DEFAULT PRIVILEGES` statements, which require ownership of the
role whose defaults are being changed. Supabase does not grant that. **They do
not affect the restore** — default privileges only govern objects created
*later*, and every object in the dump carries its own explicit grants, which did
apply (§5 confirms 462 service_role grants landed). Expect them; do not chase
them.

---

## 4. After any restore — three things, in order

**1. Reload PostgREST's schema cache.** It caches the schema and will serve
errors against a replaced one.

```sql
notify pgrst, 'reload schema';
```

**2. Nobody can sign in yet.** `public.users` now holds the SOURCE project's
user ids, and the target project's `auth.users` are different rows entirely.
There is no FK between them, so nothing errors — sign-in simply fails for
everybody.

- **Into scratch or any non-production target:** `npm run seed:auth -- --confirm`
  recreates auth users with the same ids as `public.users`. It refuses to run
  against anything but scratch.
- **Into a real production target:** this is not a seeding problem. Every person
  has to be re-invited, or the `auth` schema has to be migrated as well, which
  this dump does not cover. **Decide this before you need it.**

**3. Verify (§5).** Do not skip it because the restore said nothing.

---

## 5. Verifying a restore

Row counts are necessary and nowhere near sufficient. Check all four:

```sql
-- 1. Data landed
select count(*) from public.users;          -- production 2026-09-07: 46
select count(*) from public.athletes;        -- 35
select count(*) from public.wellness_entries;-- 1028
select count(*) from public.audit_log;       -- 1208

-- 2. GRANTS EXIST. This is the check that would have caught --no-acl.
select grantee, count(*) from information_schema.role_table_grants
 where table_schema = 'public'
   and grantee in ('anon','authenticated','service_role')
 group by grantee;
-- production 2026-09-07: anon=7, authenticated=189, service_role=462
-- a --no-acl restore returns NO ROWS and looks fine by every other measure

-- 3. Policies exist
select count(*) from pg_policies where schemaname = 'public';  -- 189

-- 4. The helper every policy depends on is the RIGHT one, not the target's old copy
select prosrc from pg_proc where proname = 'auth_org_id';
```

Then, through the API rather than SQL — this is what caught the grant failure:

```bash
npm run verify:audit-trail       # read-only
npm run verify:login-attempts    # read-only
```

---

## 6. The commitment this has to satisfy

`docs/09-security-and-compliance.md` §5, on Article 17:

> "erasure takes effect on live systems immediately and on backups within 30
> days as they rotate"

That sentence is in the privacy-notice language and is **currently unbacked** —
there are no backups and therefore no rotation.

Two consequences when backups start:

1. **Retention must be 30 days or less**, or the sentence has to change before
   any club is shown it.
2. **A manual dump kept indefinitely breaks the promise too.** A dump sitting in
   a folder forever is a backup that never rotates. Dumps taken under §2 need a
   deletion schedule, not just a location.

---

## 7. What is still missing

Written down so the gap is a decision rather than an oversight.

- [ ] **Automation.** Everything here is manual and depends on somebody
      remembering. `docs/09-security-and-compliance.md` §Infrastructure asks for
      an "independent weekly encrypted dump to a different provider and account,
      alerting on failure". None of that exists.
- [ ] **Offsite.** The drill wrote to local disk. A backup on the same machine as
      nothing else is not a backup against machine loss.
- [ ] **Encryption at rest for the dump.** It is a plaintext SQL file containing
      every athlete record, including `injury_clinical`.
- [ ] **A restore target.** "Restore into a fresh project" assumes one can be
      created quickly. Nobody has timed that.
- [ ] **The auth-schema question in §4.2**, which is the difference between "we
      have a backup" and "we can actually come back".

---

## 8. Drill log

| Date | What | Result |
|---|---|---|
| 2026-09-07 | `pg_dump` production → 2.2 MB | 16–19s, clean |
| 2026-09-07 | Restore into scratch, `--no-acl` | **Failed usefully.** Row counts perfect, 189 policies present, 0 grants, API dead with 42501. |
| 2026-09-07 | Restore into scratch, ACLs kept | **131s, 20 errors, all expected.** Grants restored to exactly production's counts: anon=7, authenticated=189, service_role=462. |
| 2026-09-07 | `notify pgrst, 'reload schema'` | PostgREST recovered; reads worked again immediately |
| 2026-09-07 | `npm run seed:auth -- --confirm` | Created 2, reset 44 — 46 of 46. Sign-in verified for three accounts. |
| | Restore into a genuinely empty project | **Not yet done.** The `--clean` dependency failures in §3 remain untested against an empty target, and that is the case that matters for both disaster recovery and a region migration. |

**End to end, production → working restored copy: about four minutes**, of which
131s is the restore. At 26 MB. This scales with data, and the first real club
will not change that materially; a season of GPS data might.
