# Continue this build in Claude Code

This repo was scaffolded in a Cowork session. **Finish it in Claude Code, on your machine.**
The reason is not preference, it is feedback loop: Claude Code can run Supabase, apply the
migrations, see the real error, and fix it in seconds. A cloud session cannot.

## What is done

| Layer | State |
|---|---|
| Database, 12 migrations, 29 tables, 95 RLS policies | Written and verified against a real Postgres 16 with pgTAP |
| Cross-tenant test suite, 444 assertions | Written, passing against that Postgres |
| Seed, 28-player squad plus a decoy club | Written |
| Next.js app, 15 routes, 17 components | Typechecks and lints clean |
| Design tokens, light and dark | Ported, no raw hex in components |
| Auth, middleware, role-resolved shells | Written, not run against real Supabase Auth |

## What is NOT verified, and must be your first job

The sandbox had no Docker, no Supabase CLI and no outbound access to Google Fonts. So:

1. **`supabase start` and `supabase db reset` have never been run.** Expect migration
   ordering or syntax fixes.
2. **`npm run build` fails only on `next/font/google`** because the sandbox blocked
   `fonts.googleapis.com`. It builds with the font calls removed. On your machine it should
   just work.
3. **No query has ever hit a real database.** Column name mismatches are likely.
4. `src/lib/types/database.ts` is hand-written. Replace it with generated types.

## First three sessions in Claude Code

**Session 1, get it running.**
> Read CONTRACT.md and README.md. Run `supabase start` then `supabase db reset`. Fix every
> migration error until it applies clean. Then run `npm run test:tenancy` and fix until all
> assertions pass. Do not touch the app code in this session.

**Session 2, real types and real queries.**
> Run `supabase gen types typescript --local > src/lib/types/database.ts`. Fix every
> resulting type error in `src/lib/queries/`. Then `npm run dev`, sign in as each seeded
> user, and fix every runtime query error. Report which columns did not match.

**Session 3, the athlete loop end to end.**
> Sign in as an athlete, submit a wellness entry at /check-in, confirm it writes, confirm
> the flag engine raises a flag, then sign in as a coach and confirm it appears on the
> dashboard attention list. Fix whatever breaks.

After that you have a working thin slice and you can put it in front of a club.

## The rules Claude Code must not break

They are in `CONTRACT.md` and `CLAUDE.md`. The two that matter most:

- Every club-data table has `org_id`, every policy filters on it, and `npm run test:tenancy`
  is the gate. If it goes red, stop and fix it before anything else.
- Coaches never read `injury_clinical`. No query in the app touches that table.
