# Database, Phase 0

Everything in this folder is the Fydr database: the schema, the auth claims hook, the row
level security policies, the development seed, and the cross tenant test suite that is the
Phase 0 exit gate.

Specification: `docs/04-data-model.md` is the schema, `docs/01-roles-and-permissions.md` is
the permission model, `docs/05-architecture.md` §5 is the claim model. Where this folder and
those documents disagree, the documents win and the code is the bug, per `CLAUDE.md` §5.

---

## Layout

```
supabase/
  config.toml     local stack configuration, including the access token hook
  migrations/     numbered, additive, never edited once applied
  tests/          pgTAP. The mandatory suite.
  seed.sql        two organisations of development data
```

### Migrations

| File | What it does |
|---|---|
| `0001_extensions_and_enums.sql` | citext, pgcrypto, the application roles, every enum type |
| `0002_tenancy_and_identity.sql` | organisations, users, user_roles, athletes, athlete_consents, groups, group_memberships |
| `0003_schedule.sql` | seasons, fixtures, sessions, session_participants, session_attendance, week_templates, teams, team_allocations |
| `0004_athlete_entries.sql` | wellness_entries, training_entries, nutrition_checkins |
| `0005_injuries_and_availability.sql` | injuries, injury_clinical, availability |
| `0006_thresholds_flags_compliance.sql` | thresholds, threshold_revisions, flags, flag_actions, compliance_expectations |
| `0007_audit_log.sql` | audit_log plus the append only trigger |
| `0008_notification_preferences_and_push_tokens.sql` | closes gap G-5 |
| `0009_current_revision_views.sql` | the ADR-005 `*_current` views |
| `0010_helper_functions_and_triggers.sql` | `auth_*` helpers, the access token hook, computed columns, the age functions, the sanitised clinical view, the `revise_*` functions |
| `0011_indexes.sql` | the minimum index set from §15 and §17.11 |
| `0012_rls_policies.sql` | RLS on every table, privileges, and every policy |

Migrations are **additive**. Never edit one that has been applied. Add a new file.

---

## Running it locally

### `supabase start`

Boots Postgres, Auth, PostgREST, Storage, Studio and Inbucket in Docker, applies every
migration in order, and then applies `seed.sql`.

```bash
supabase start
```

It prints the API URL, the anon key and the service role key. Put the first two in
`.env.local`. The service role key never goes near client code and never goes in git.

Studio is on <http://127.0.0.1:54323>, Postgres on `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

Stop it with `supabase stop`, and `supabase stop --no-backup` to discard the volume.

### `supabase db reset`

Drops the local database, replays every migration from `0001` in order, then applies
`seed.sql`.

```bash
supabase db reset
```

This is the command that proves the migrations apply cleanly from nothing, which is the
only state a new developer or CI ever starts from. Run it before pushing a migration. If
`db reset` fails, the migration is broken, whatever your local database happens to look
like.

After a reset you have:

- **Ashcombe Rugby Club**, a 28 player rugby squad matching the names in the mockups, six
  staff across all four roles, four groups, three teams, a season, three fixtures, four
  weeks of sessions, 28 days of wellness entries with realistic variation and realistic
  gaps, session RPE, weekly nutrition check ins, six injuries with clinical detail,
  availability for the whole squad, five thresholds and nine flags.
- **Marlow Vale RUFC**, a six player decoy that exists so the tenancy tests have something
  to fail against.

The seed uses deterministic identifiers, so a bookmarked URL survives a reset.

---

## Running the tests

The cross tenant suite is the Phase 0 exit gate. It is the one suite that blocks merge
(`01-roles-and-permissions.md` §6).

```bash
supabase test db
```

That runs pgTAP over every file in `supabase/tests` through `pg_prove`. Expect:

```
supabase/tests/000_setup_test_helpers.sql ............ ok
supabase/tests/010_rls_coverage_test.sql ............. ok
supabase/tests/020_cross_tenant_test.sql ............. ok
supabase/tests/030_medical_and_entry_rules_test.sql .. ok
All tests successful.
Files=4, Tests=444
```

Against an already running database, or in CI where the CLI is not installed:

```bash
pg_prove --ext .sql -d "$DATABASE_URL" supabase/tests/
```

`CONTRACT.md` names this as `npm run test:tenancy`. When the root `package.json` lands, the
script is:

```json
"test:tenancy": "supabase test db"
```

### What each file asserts

| File | Assertions | What it proves |
|---|---:|---|
| `000_setup_test_helpers.sql` | 1 | Installs pgTAP and the `tests` schema. Not wrapped in a transaction, so its helpers persist for the files that follow. |
| `010_rls_coverage_test.sql` | 113 | Every table has RLS enabled and at least one policy. Every policy on every club data table filters on `auth_org_id()`. The entry tables have no update or delete policy and no update or delete privilege. `audit_log` is insert only. The `*_current` views are `security_invoker`. The sanitised clinical view has no `clinical_notes` column. |
| `020_cross_tenant_test.sql` | 273 | For every club data table, for each of the four roles, in **both** directions: reading the other organisation returns zero rows. Plus cross tenant write attempts, an unauthenticated caller, and positive controls. |
| `030_medical_and_entry_rules_test.sql` | 57 | The boundaries inside one club: clinical detail, availability, entry immutability, athlete self service, the flag carve out, draft team allocations, and what an admin cannot see. |

Table enumeration in `010` and `020` is **dynamic**, read from `pg_class`. Add a table with
an `org_id` column and it is in the suite on the next run whether you remembered or not.

### Testing the test

`10-roadmap.md` §3 requires that a deliberately broken policy is proven to make the suite
fail. Break one and watch:

```bash
psql "$DATABASE_URL" -c "drop policy wellness_staff_select on public.wellness_entries;" \
  -c "create policy wellness_staff_select on public.wellness_entries for select
      to authenticated
      using (auth_has_any_role(array['coach','medical']::app_role[]));"
supabase test db      # expect FAIL
supabase db reset     # put it back
```

Dropping the `org_id = auth_org_id()` predicate from one policy fails five assertions: four
cross tenant reads and the structural check in `010`.

---

## Things that will bite you

**Empty screens after a reset.** Check `[auth.hook.custom_access_token]` in `config.toml`.
Without the hook the JWT carries no `app_metadata`, every `auth_*` helper returns null,
every policy predicate is false, and the application correctly reads nothing.

**You cannot update an entry row.** That is deliberate (`CONTRACT.md` rule 4, ADR-005).
Corrections go through `revise_wellness_entry`, `revise_training_entry` or
`revise_nutrition_checkin`, which insert a revision and stamp the original superseded. Read
the `*_entries_current` views, never the base tables.

**Coaches cannot write availability.** Only medical can, anywhere
(`01-roles-and-permissions.md` §4). There is no coach policy on that table to relax.

**Never join a coach facing query to `injury_clinical`.** It is medical only for every
operation. The athlete path is `injury_clinical_athlete_view`, which excludes
`clinical_notes` and is the one owner rights view in the schema, with its own tenancy and
subject predicates. It is commented at length in `0010`.

**`service_role` bypasses RLS entirely.** Every statement made with it filters `org_id`
itself, and every function using it carries a comment naming the check it performs in place
of RLS (`05-architecture.md` §5).
