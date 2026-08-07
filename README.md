# Fydr

Athlete performance management for sports clubs. This repository holds the
Postgres schema in `supabase/` and the Next.js application in `src/`.

What is built, and only what is built: the Phase 1a thin slice.

| Surface | Route | State |
|---|---|---|
| Staff web | `/dashboard` | Built. Availability strip, the named list of who is not fully available, a ranked attention list, today's sessions, wellness compliance. |
| Staff web | `/squad` | Built. Roster, group filter, search, through to an athlete. |
| Staff web | `/squad/:athleteId` | Built. Wellness against the athlete's own rolling mean and band, recent sessions, injury and availability, restrictions. |
| Staff web | the other seven sidebar rows | Present, and each says plainly that it is coming in the next phase. The shell is complete; the screens are not. |
| Athlete, mobile web | `/today` | Built. Availability banner, outstanding entries, today's schedule. |
| Athlete, mobile web | `/check-in` | Built. Six controls, one thumb, 5 = best on every scale. |
| Both | `/login` | Built. Supabase email and password. |

---

## Running it

```bash
git clone <this repository>
cd fydr
npm install

cp .env.example .env.local     # then fill in the two keys `supabase start` prints

supabase start                 # Postgres, Auth, Studio, on 54321 to 54324
supabase db reset              # applies every migration, then seed.sql
npm run seed:auth              # creates the logins seed.sql cannot create

npm run dev                    # http://127.0.0.1:3000
```

`supabase db reset` writes `public.users`, which is the application's user
table. It cannot write `auth.users`, which belongs to GoTrue and hashes its own
passwords, so `npm run seed:auth` creates one auth login per seeded user with
the same id. Without that step every sign-in fails and nothing else works.

`npm run build` needs outbound access to `fonts.googleapis.com` and
`fonts.gstatic.com`, because Sora and DM Mono are loaded with
`next/font/google`, which downloads and self-hosts them at build time. On a
network that blocks Google Fonts the build fails with
`` `next/font` error: Failed to fetch `Sora` from Google Fonts ``, and nothing
else is wrong. Allow the two hosts, or run the build where they are reachable.

### Scripts

| Script | Does |
|---|---|
| `npm run dev` | Next.js in development |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`, strict |
| `npm run test:tenancy` | The pgTAP cross-tenant suite in `supabase/tests` |
| `npm run seed:auth` | Development logins, service role key required |

---

## The seeded logins

Every one uses the password in `SEED_USER_PASSWORD`, which `.env.example` sets
to `fydr-dev-password`. All belong to Ashcombe Rugby Club.

| Email | Name | Roles | Lands on |
|---|---|---|---|
| `p.ackland@ashcomberfc.example` | Peter Ackland | coach | `/dashboard` |
| `r.callaghan@ashcomberfc.example` | Ruth Callaghan | medical | `/dashboard` |
| `a.whitmore@ashcomberfc.example` | Anna Whitmore | coach and medical | `/dashboard` |
| `j.pemberton@ashcomberfc.example` | Jane Pemberton | admin | `/dashboard`, four sidebar rows only |
| `j.barnes@ashcomberfc.example` | James Barnes | athlete | `/today` |

Jane Pemberton is the club secretary and holds admin alone, which by
`01-roles-and-permissions.md` §1 means she manages the club and cannot read a
single wellness score. That is the deliberate friction, not a missing grant.

All twenty-eight squad members have a login on the same pattern:
`<first initial>.<surname>@ashcomberfc.example`.

A second organisation, Marlow Vale RUFC, is seeded so the tenancy suite has
something to fail against. Its data deliberately resembles Ashcombe's, so a leak
reads as plausible data rather than as obvious nonsense.

---

## How access works

1. `src/middleware.ts` runs on every page request. It refreshes the session and
   resolves the shell from the roles in the JWT: staff to `/dashboard`, athletes
   to `/today`. There is no client-side role check anywhere in the access path.
2. `requireStaff()` and `requireAthlete()` in `src/lib/session.ts` are the second
   lock, in the server component.
3. Row-level security is the third, and the only one that matters. Ninety-five
   policies key off `org_id`, and the roles they read come from the custom access
   token hook, never from a table read inside a policy.

Roles hide a sidebar row. They never grant a row of data.

### What a coach never sees

`injury_clinical` holds diagnosis, mechanism, imaging, referral, clinical notes
and treatment plan. This application does not select from it, does not join to
it, and does not name it in `src/lib/types/database.ts`, so a query cannot reach
it by accident. Coaches read body area, availability, restrictions and expected
return, which is what they need to pick a team.

---

## Layout

```
supabase/migrations/   numbered SQL, additive only
supabase/tests/        pgTAP cross-tenant suite
src/app/               App Router, routes from docs/20-route-map.md
src/components/        one folder per component, PascalCase
src/lib/supabase/      server.ts, client.ts, middleware.ts, claims.ts
src/lib/queries/       one file per domain, plus the key factory in keys.ts
src/lib/types/         database types
src/lib/validation/    Zod schemas, shared between form and mutation
src/styles/            tokens.css, base.css
scripts/               seed-auth.ts, test-tenancy.mjs
```

### Design tokens

`src/styles/tokens.css` is the only file in the application that may contain a
hex value. Everything else styles through a token, which is what makes light and
dark free and what makes the seven-value reskin work. `--good` is `#4dcbb2`, the
teal that separates from the brand blues under deuteranopia; the derived
`*-text` and `*-pill-text` sets and the `*-rgb` triplets are all there.

Status is never colour alone. Every status carries a glyph and a word as well,
because roughly 8% of the male user base has a colour vision deficiency and
clubs print the availability board in greyscale.

---

## Things worth knowing before you extend it

- **Blank, never zero.** A missing wellness day is an absent row. It draws as a
  gap in the chart and an em rule in a table. A zero is a claim.
- **Entries are immutable.** A correction is a new row with `revision_of` set.
  Read `wellness_entries_current`, never the base table.
- **Every 1 to 5 scale runs 5 = best**, including soreness where 5 = no
  soreness. Nothing in the codebase inverts one. Do not add the first.
- **The group filter lives in the URL**, at `?groups=`, so it survives a refresh
  and is applied in the query rather than after the rows arrive.
- **Materialised views.** `screens/dashboard.md` points the attention list at
  `mv_daily_athlete_summary`, `mv_wellness_baselines` and
  `mv_acute_chronic_load`. None of the three is in `supabase/migrations`, so this
  slice computes the same quantities in `src/lib/stats.ts` from
  `wellness_entries_current` and ranks flags in `src/lib/queries/flags.ts`. When
  the views land, those are the two files they replace.
- **Database types are hand written.** `supabase gen types typescript --local`
  needs a running stack. Regenerate over
  `src/lib/types/database.ts` when you have one.
