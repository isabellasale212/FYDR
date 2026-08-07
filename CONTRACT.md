# Build contract

Every agent and every session working in this repo obeys this file. It exists so that work
done in parallel fits together. It is short on purpose.

## Stack, pinned

- **Next.js 15**, App Router, TypeScript strict, React 19
- **Supabase**: Postgres, Auth, RLS. Local dev via the Supabase CLI.
- **@supabase/ssr** for server and browser clients. Never `@supabase/auth-helpers`, it is deprecated.
- **TanStack Query v5** for server state
- **Zod** for validation, one schema per shape, shared between client and server
- No CSS framework. Hand-written CSS with the design tokens in `src/styles/tokens.css`.
- No component library. No chart library. Charts are hand-built inline SVG.

## File layout

```
supabase/migrations/     numbered SQL, additive only, never edited once applied
supabase/tests/          pgTAP cross-tenant suite
src/app/                 App Router routes, matching docs/20-route-map.md
src/components/          shared components, one folder each
src/lib/supabase/        server.ts, client.ts, middleware.ts
src/lib/queries/         one file per domain, exporting query key factories and fetchers
src/lib/types/           generated database types plus hand-written domain types
src/styles/              tokens.css, base.css
scripts/                 seed.ts and dev utilities
```

## Naming, non-negotiable

- Routes come from `docs/20-route-map.md` §9. Do not invent a path.
- Query key factories: `qk.wellness.byAthlete(athleteId, range)`. One factory per domain file.
- Components: PascalCase folder and file, `AvailabilityStrip/AvailabilityStrip.tsx`.
- Database: `snake_case`, plural tables, singular columns. Enums are Postgres enums.
- CSS: use the token variables. **Never a raw hex in a component.**

## The rules that outrank convenience

1. Every club-data table has `org_id`. Every RLS policy filters on it.
2. Roles come from the JWT custom claim, never from a client value, never from a table read inside a policy.
3. Clinical detail lives in `injury_clinical` and is medical-only. Coaches never join to it.
4. Athlete entries are immutable. Corrections create a revision row.
5. All timestamps `timestamptz` in UTC. Units: kg, metres, m/s, seconds.
6. All 1 to 5 wellness scales run **5 = best**, including soreness where 5 = not sore.
7. Blank where data is missing. Never zero.

## Design tokens

Source of truth is `src/styles/tokens.css`, ported from the client's real design system.
`--good` is `#4dcbb2`. `--highlight` is decorative only and never encodes status. Status
always carries a glyph as well as a colour.

## Definition of done for Phase 0

`npm run test:tenancy` passes: every table, every role, zero rows returned when reading
another organisation's data.
