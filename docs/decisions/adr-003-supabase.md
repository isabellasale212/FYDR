# ADR-003: Supabase as the backend platform

## Status

**ACCEPTED.** 2026-08.

---

## Context

Fydr needs, at minimum: a relational database, authentication with roles, file storage for
athlete photographs and CSV imports and generated exports, scheduled jobs, a place to run server-side
logic, and a realtime channel for flags. Built from parts, that is six to ten weeks of work
before a single athlete submits a wellness entry.

Two product facts constrain the choice more than the feature list does.

**The product thesis is a join.** `00-product-overview.md` is explicit: the differentiator is
correlating wellness against gym output against on-pitch load against injury incidence for
the same athlete over an adjustable window. That is a relational query with window functions
over time series. Any datastore that makes that hard is disqualified regardless of its other
merits.

**Authorisation is the highest-risk area of the product.** Four roles, a clinical carve-out, a
strict organisation boundary, and a permission matrix that has to be provably correct
(`01-roles-and-permissions.md`). Whatever enforces it must be testable as a whole rather than
reviewed query by query.

---

## Decision

**Supabase, using Postgres directly, with row-level security as the authorisation mechanism.**

| Component | Used for | Notes |
|---|---|---|
| Postgres | Everything relational, plus `pg_cron`, `pg_net`, materialised views | The actual product. The rest is convenience around it. |
| PostgREST | The default read and write API | Clients talk to the database. RLS is the only thing between them and the data. |
| Auth (GoTrue) | Sign-in, invitations, refresh tokens, custom claims hook | Claims carry `org_id`, `roles`, `athlete_id` (`05-architecture.md` §5) |
| Storage | Athlete photographs (adults only, off by default), GPS CSV uploads, generated exports | Bucket policies mirror the RLS model. No nutrition photographs: athletes do not log meals |
| Edge Functions (Deno) | Sync push, threshold evaluation, notification dispatch, CSV import, exports, admin role changes | Shares `core` and `validation` packages with the clients |
| Realtime | Flags, availability, schedule changes, forced token refresh | Broadcast from triggers, not `postgres_changes` (`05-architecture.md` §8) |

**Row-level security is the authorisation boundary, not a second line of defence.** There is
no application-layer permission check that RLS backs up. There is RLS, and there are UI
affordances that hide things the user cannot do anyway.

---

## Consequences

**Good:**

- Real Postgres. Window functions, CTEs, materialised views, generated columns, enums, array
  columns, `citext`, partial indexes. The schema in `04-data-model.md` is not a compromise
  shaped by the platform.
- **Authorisation lives in one place and is testable as a unit.** The pgTAP suite in
  `05-architecture.md` §12 asserts, for every table and every role, that cross-organisation
  reads return nothing. That assertion is not expressible against a codebase of hand-written
  queries.
- Clients query the database directly, so there is no API layer to keep in sync with the
  schema. A new field is available to both apps as soon as the migration runs and the types
  are regenerated.
- Six to ten weeks not spent building auth, storage, and job scheduling.
- Local development is the whole stack in Docker, which is what makes the RLS suite runnable
  on every commit.
- `pg_cron` and `pg_net` inside the database mean scheduled work has no separate runtime to
  operate.

**Bad, and accepted:**

- **RLS failures are total.** A wrong policy does not degrade, it exposes. Mitigated by the
  mandatory test suite, the CI check that every tenant table has coverage, and the hourly
  production canary.
- **RLS is hard to debug.** A query returning fewer rows than expected gives no explanation.
  The technique is `set local role authenticated; set local request.jwt.claims = '...'` in a
  transaction and bisect. This should be a documented runbook because it will be needed
  regularly and it is not obvious.
- **RLS has a performance cost** if policies are written carelessly. A policy that subqueries
  `user_roles` runs per row and recurses through that table's own policies. This is why roles
  live in the JWT (`04-data-model.md` §14) and why helper functions are `stable` and
  `security definer`.
- **`service_role` bypasses everything.** One Edge Function using the service key and
  forgetting an `org_id` filter is a cross-tenant leak with no database-level protection. The
  three rules in `05-architecture.md` §5 exist for exactly this and are the highest-value
  review checklist in the codebase.
- **PostgREST shapes the API.** Complex queries become database views or RPC functions rather
  than application code. This is mostly good, since it keeps logic near the data, but it means
  more SQL and less TypeScript than a typical team expects.
- **Edge Functions are Deno**, not Node. Most npm packages work through `npm:` specifiers, some
  do not. Anything requiring a native Node addon does not.
- **Platform maturity risk.** Supabase moves quickly. Auth hooks, realtime authorisation, and
  the Deno runtime version have all changed shape within the last two years. Pin versions, read
  changelogs, and expect occasional unrequested work.
- **Connection limits.** PostgREST pools, but Edge Functions and any direct connections do not
  automatically. Use the pooler endpoint for anything long-lived and watch the saturation alert
  (`05-architecture.md` §10).

---

## Lock-in analysis

The question that matters is not "is there lock-in" but "what does leaving cost, per
component, and can it be done incrementally". Estimates assume the schema and data volumes in
`04-data-model.md`.

| Component | Lock-in | Exit path | Estimated cost |
|---|---|---|---|
| Postgres schema and data | **None** | `pg_dump` to any Postgres host. It is standard Postgres with standard extensions. | Days |
| RLS policies | **None** | Plain SQL, portable to any Postgres | Zero |
| PostgREST | **Low** | Self-hostable, open source, or replace with a thin API layer per resource | 2 to 3 weeks to write an equivalent API |
| Auth | **Moderate** | GoTrue is open source and self-hostable. To leave entirely: issue JWTs with the same claim shape from another provider, migrate `auth.users` (password hashes are bcrypt and portable), and repoint foreign keys. `public.users.id` mirrors `auth.users.id`, which is the coupling. | 1 to 2 weeks |
| Storage | **Low** | S3-compatible API. Copy buckets, rewrite signed-URL generation. | Days |
| Edge Functions | **Low to moderate** | Deno, standard Web APIs. Portable to Deno Deploy, Cloudflare Workers, or Node with modest changes. The Supabase-specific parts are the client construction and secret handling. | Days per function |
| Realtime | **Moderate** | The client API is Supabase-specific. Replaceable with Pusher, Ably, or a self-hosted equivalent. The trigger-side `realtime.send` calls would need rewriting. | 1 week |
| `pg_cron` and `pg_net` | **None** | Postgres extensions, available on most managed hosts. If not, an external scheduler calling the same functions. | Days |
| **Total** | | | **Roughly 4 to 6 weeks, and it can be done component by component** |

The important property is that it is **incremental**. The database can move first, with
PostgREST self-hosted in front of it and everything else unchanged. Nothing requires a
big-bang migration.

The genuine dependency is on Postgres itself, which is a choice I would make again with no
vendor involved.

---

## Alternatives considered

### 1. Firebase

Firestore plus Firebase Auth, Cloud Functions, Cloud Storage, FCM.

Rejected primarily on the data model.

| Requirement | Firestore |
|---|---|
| "Correlate wellness against gym output against load against injury for 40 athletes over 28 days" | Multiple collection reads assembled client-side, or a denormalised aggregate maintained by triggers. Every new analysis needs a new denormalisation. |
| Ad-hoc analytics builder (`03-flows.md` §9) | Effectively impossible. The builder generates arbitrary queries over arbitrary metric combinations; Firestore requires a composite index per query shape, declared in advance. |
| Window functions, rolling 7:28 ACWR | Computed in application code over fetched documents |
| Materialised views | Manual aggregate collections kept current by triggers |
| Cost model | Per document read. A dashboard showing 40 athletes × 28 days is 1,120 reads, per view, per coach, per refresh. |
| Authorisation | Security Rules. Path-based, no joins, cannot express "medical role may read clinical detail, coach may not, athlete may read their own except free-text notes" without denormalising the role onto every document. |
| Offline | **Genuinely better.** The offline persistence in the Firebase SDK would remove most of ADR-004's cost. |

The offline SDK is a real advantage and it is the one thing that made this worth considering.
It does not outweigh the fact that the product's stated differentiator is a relational
analytical query, and Firestore's answer to that is "restructure your data per question".

### 2. Custom Node plus Postgres, self-hosted or on a PaaS

Fastify or NestJS, Postgres on RDS or Neon, Auth.js or a hosted identity provider, S3, a job
runner.

| Element | Build cost |
|---|---|
| Auth: sign-up, invite, refresh rotation, password reset, session revocation, rate limiting | 2 to 3 weeks to do properly |
| Authorisation layer, tested to the standard `01-roles-and-permissions.md` demands | 1 to 2 weeks |
| CRUD API across roughly 35 tables | 2 to 3 weeks |
| Storage with signed URLs and access control | 1 week |
| Job scheduling and monitoring | 1 week |
| Realtime | 1 week |
| Local development environment | Days |
| **Total before the first athlete submits anything** | **8 to 11 weeks** |

Rejected on that arithmetic alone. It also gives up the property that makes the security model
defensible: with a hand-written API, "no query can cross an organisation boundary" is a claim
about developer discipline across every endpoint, checked by review. With RLS it is a test.

The upside forgone is control, and the freedom to shape the API. That is worth having in year
three with a team. It is not worth two and a half months in year one with one person.

### 3. Postgres on a managed host, with PostgREST self-hosted

Neon or RDS for Postgres, PostgREST in a container, an identity provider bolted on.

Rejected as the same architecture with more operations work and no compensating benefit. It is
the natural destination if Supabase becomes untenable, which is precisely why the exit cost
above is modest.

### 4. Appwrite, Nhost, Pocketbase

Considered briefly. Nhost is the closest analogue (Postgres plus Hasura) and would be a
reasonable choice; it has a smaller ecosystem, and GraphQL adds a layer this product does not
need. Appwrite's relational support is weaker. Pocketbase is single-binary SQLite, excellent
for small projects and unsuitable for a product that expects to run analytical queries over
tens of millions of rows.

---

## Open questions

- **O-25**: Supabase's Article 28 processor terms and subprocessor list need reviewing against
  what will be promised to clubs about special category health data before the first paid
  contract is signed. I have assumed the standard DPA is acceptable. That assumption should be
  checked by someone qualified, not by me, and it interacts with O-15 on data residency.
