# Performance — measured before optimising, 16 September 2026

**The numbers first, before any fix, so the slow routes are the measured ones
and not the guessed ones.** The suspicion was the report routes with heavy
queries, `/analytics`, and anything reading GPS. Measured: every report route
and its PDF, the analytics panels (session load and a GPS measure), the GPS
import page and the GPS report and export, plus four ordinary pages for
comparison — as Jane Pemberton (sport scientist, Ashcombe, Performance plan,
32 athletes, ~600 GPS records, ~870 wellness entries, 101 open flags).

## How

A production build (`next build`, `next start` on 127.0.0.1:3002) against the
scratch database, with `FYDR_QUERY_TIMING=1` — a one-line-per-request timer on
both Supabase clients (`src/lib/supabase/queryTiming.ts`, off unless the flag
is set) that writes each request's duration, path and start time to stderr.
The harness signs in once, requests each route four times and takes the median
of the three warm runs for: **total** (time to the last byte of the page),
**db span** (first query start to last query end inside the render), **rest**
(total minus db span — the render, the serialisation, the HTTP), **queries**
(how many the render made), **dup** (how many were byte-identical repeats of
another in the same render), **rounds** (sequential round trips — a query that
starts after another finishes is a new round), **Σq** (the sum of every
query's own time, which exceeds the span wherever queries ran in parallel).

Then the round-trip floor and the heaviest single queries, from a script
against the same database with no app in between (`scratchpad/qfloor.mjs`).

## What the floor is

| Query | min | median | rows |
|---|---|---|---|
| `organisations` select id limit 1 (the floor) | 54ms | 132ms | 1 |
| `athletes` HEAD count | 70ms | 273ms | 32 |
| `gps_records` select `*`, 90 days | 125ms | 214ms | 598 |
| `gps_records` five columns, 90 days | 64ms | 82ms | 598 |
| `gps_records` with `sessions!inner` | 66ms | 89ms | 597 |
| `wellness_entries_current`, all | 60ms | 68ms | 868 |
| `flags` open | 68ms | 81ms | 101 |
| `compliance_expectations`, 28 days | 69ms | 91ms | 1000 |
| `test_results`, all | 57ms | 98ms | 198 |
| `sessions`, 90 days | 60ms | 64ms | 59 |
| rpc `analytics_daily_rows` | 60ms | 112ms | 0 |
| ten floor queries in parallel, wall | — | 185ms | — |

**Every real query the product makes sits within 10–20ms of the floor.** The
one exception is `gps_records` with `select *` — twice the floor, because it
returns every column of 598 wide rows; the same rows in five columns are at
the floor. Nothing here is a slow query. The database is not where the time
goes; the round trip to it is — 55–70ms at best from this machine, jittering
to 130–270ms — and a route pays it once per sequential round.

## The routes, fastest to slowest (median of three warm runs, ms)

| Route | total | db span | rest | queries | dup | rounds | Σq | KB |
|---|---|---|---|---|---|---|---|---|
| `/reports/athlete` | 855 | 750 | 105 | 12 | 3 | 5 | 1509 | 92 |
| `/squad` | 862 | 699 | 163 | 12 | 3 | 5 | 2161 | 54 |
| `/reports/match/pdf?fixture=[id]` | 896 | 536 | 360 | 8 | 0 | 3 | 786 | 6 |
| `/reports/injuries` | 929 | 819 | 110 | 17 | 4 | 5 | 2006 | 62 |
| `/reports/training-load` | 930 | 838 | 92 | 14 | 3 | 2 | 1116 | 76 |
| `/reports/match?fixture=[id]` | 947 | 864 | 83 | 17 | 3 | 3 | 1602 | 67 |
| `/analytics` | 1032 | 908 | 124 | 19 | 9 | 4 | 2421 | 60 |
| `/flags` | 1061 | 901 | 160 | 11 | 3 | 3 | 1797 | 219 |
| `/analytics?load=gps_total_distance` | 1132 | 1031 | 101 | 19 | 9 | 4 | 2284 | 60 |
| `/schedule` | 1242 | 1103 | 139 | 48 | 29 | 12 | 4430 | 48 |
| `/reports/injuries/pdf` | 1270 | 958 | 312 | 12 | 1 | 5 | 1235 | 6 |
| `/reports/squad` | 1320 | 1190 | 130 | 54 | 26 | 28 | 6765 | 70 |
| `/settings/imports` | 1380 | 1220 | 160 | 11 | 2 | 5 | 2118 | 45 |
| `/reports/compliance/pdf` | 1380 | 1232 | 148 | 13 | 0 | 3 | 1501 | 9 |
| `/dashboard` | 1403 | 1234 | 169 | 51 | 17 | 29 | 7623 | 60 |
| `/reports/testing/pdf` | 1413 | 1226 | 187 | 11 | 1 | 3 | 1185 | 11 |
| `/reports/compliance` | 1481 | 1216 | 265 | 18 | 3 | 3 | 1836 | 74 |
| `/reports/training-load/pdf` | 1507 | 1234 | 273 | 9 | 0 | 2 | 1193 | 7 |
| `/squad/[id]` | 1618 | 1501 | 117 | 37 | 4 | 9 | 3544 | 77 |
| `/reports/testing` | 1626 | 1544 | 82 | 19 | 5 | 3 | 2727 | 97 |
| `/reports/squad/pdf` | 1667 | 1288 | 379 | 26 | 3 | 14 | 3116 | 12 |
| `/reports/athlete/[id]/pdf` | 2208 | 1939 | 269 | 31 | 0 | 11 | 3603 | 8 |
| `/reports/gps` | 2343 | 2189 | 154 | 36 | 12 | 9 | 4182 | 118 |
| `/reports/gps/pdf` | 2476 | 2209 | 267 | 17 | 2 | 5 | 4086 | 8 |
| `/reports/gps/export` | 2731 | 2470 | 261 | 13 | 1 | 4 | 3400 | 1 |
| `/reports/gps?mode=week` | 2737 | 2576 | 161 | 36 | 12 | 9 | 6562 | 118 |
| `/reports/athlete/[id]` | 3094 | 2989 | 105 | 38 | 2 | 11 | 8470 | 64 |
| `/reports` | 4386 | 762 | 3624 | 7 | 2 | 2 | 988 | 39 |

`/reports`'s 4386 is one run's stall on the auth round trip (`/auth/v1/user`
took 3.6s once; the other runs were ~800ms) and is reported as measured.

## Where the time goes

**Not the query, not the render. The round trips, and how many of them a
route makes in sequence.** On every route the db span is 85–95% of the total;
what is left — 90 to 160ms for a page, 250 to 360ms for a PDF — is the render
and the serialisation, and it is the same on the fastest route as on the
slowest. Three shapes account for the span:

1. **The shell's own chain, paid twice.** `requireStaff()` runs
   `auth.getUser()` → `users` (the revocation check) → `organisations`, three
   sequential rounds, and both the layout and the page call it, so every
   staff route starts with ~180ms of the same three queries twice over
   (`/users` ×2 and `/organisations` ×2 appear on every row above). The
   `GroupFilter` and the sidebar's flag badge add `groups` ×2 and `flags` ×1.
2. **Duplicates inside a report.** `/reports/squad` makes 54 queries of which
   26 are byte-identical repeats — `athletes` fourteen times, `availability`
   six, because its sections each fetch their own inputs. `/schedule` repeats
   29 of 48, `/dashboard` 17 of 51, `/reports/gps` 12 of 36 (`sessions`
   twelve times), `/analytics` 9 of 19 (`athletes` once per panel, five
   panels). A duplicate costs its round trip in parallel with its twin, so it
   widens the burst rather than the chain — but the chain is made of these
   too.
3. **Sequential tails.** After the parallel burst, `/reports/squad` runs
   eight small queries one after another (entries → gym logs → set logs →
   sessions → test results → the audit row), `/dashboard` makes 29 rounds
   in all, `/reports/athlete/[id]` and `/reports/gps` 9–11. Each round is a
   floor's worth of waiting for a query that returns in single-digit
   milliseconds.

## Where the time does not go

- `/analytics`: 19 queries in 4 rounds, ~1.0s, of which the `analytics_daily_rows`
  rpc is 80–320ms per panel and the rest is the shell and five identical
  `athletes` reads. Not the suspected culprit; the same shape as any page.
- The GPS import page (`/settings/imports`): 11 queries, 1.4s, dominated by a
  HEAD count on `import_batches` and the shell. Nothing GPS-heavy on it.
- The PDFs: 250–360ms of render on top of the same queries as their pages.

## The caveat on the absolute numbers

This machine to the scratch project is a 55–70ms round trip at best. On
Vercel, in the same region as the production database, the floor is a
fraction of that, so every absolute number above shrinks — but the shape does
not: a route that pays 29 sequential rounds pays 29 floors wherever it runs.
The fixes that follow reduce rounds and duplicates, which is what survives
the move to production; a fix that only helped this machine would not be
worth making.

## What this rules in, and out

- **In:** one request-scoped memo on the shell's fetchers so the layout and
  the page share one `getUser`/`users`/`organisations` chain, and on the
  query helpers the reports repeat, so a byte-identical read happens once per
  render; then, on the routes whose tails are sequential, awaiting the
  independent ones together. Narrowing `gps_records` reads from `select *` to
  the columns rendered where any remain. No cache.
- **Out:** indexes (no query is slow), policy rewrites (RLS is not where the
  time is — every policy-gated read is at the floor), and any skeleton on a
  route that the fixes bring under a few hundred milliseconds of wait.

---

## After the fixes (piece two), same harness, same database, same night

Three changes, none of them a cache and none of them touching a query's
shape except where noted:

1. **One read per render** (`src/lib/supabase/requestMemo.ts`): the server
   Supabase client memoises GET/HEAD requests per render, keyed on method,
   URL and the answer-shaping headers (Accept, Prefer, Range), scoped by
   React's `cache()` so nothing outlives the request. Writes and every rpc
   (POST) are never memoised. A byte-identical read that used to run
   fourteen times runs once.
2. **The guard chain, once and shorter** (`src/lib/session.ts`): `base()` is
   `cache()`d so the layout and the page share one `getUser` → (`users` +
   `organisations`) chain, and those two reads run in the same round — two
   rounds where there were three, paid once where it was paid twice.
3. **Two pages' own chains flattened** (`/reports/gps`, `/reports/athlete/[id]`):
   the group filter, the group list and the session picker in one round;
   the comparison and the audit row alongside the overview and the board;
   the recency reads alongside the report. Nothing reordered that depends
   on something else.

| Route | before total | after total | queries before → after | rounds before → after |
|---|---|---|---|---|
| `/reports/gps` | 2343 | 1523 | 36 → 27 | 9 → 8 |
| `/reports/gps?mode=week` | 2737 | 1576 | 36 → 27 | 9 → 8 |
| `/reports/gps?mode=match` | — | 782 | — | 6 |
| `/reports/athlete/[id]` | 3094 (2025 on the first run) | 1330 | 38 → 35 | 11 → 11 |
| `/reports/squad` | 1320 | 1520 (jitter; db span 1190 → 1053) | 54 → 33 | 28 → 12 |
| `/squad/[id]` | 1618 | 1344 | 37 → 33 | 9 → 10 |
| `/dashboard` | 1403 | 1144 | 51 → 36 | 29 → 20 |
| `/analytics` | 1032 | 673 | 19 → 12 | 4 → 4 |
| `/reports/testing` | 1626 | 785 | 19 → 13 | 3 → 3 |
| `/reports/training-load` | 930 | 827 | 14 → 10 | 2 → 2 |
| `/squad` | 862 | 441 | 12 → 8 | 5 → 4 |
| `/flags` | 1061 | 610 | 11 → 7 | 3 → 3 |
| `/settings/imports` | 1380 | 599 | 11 → 8 | 5 → 5 |
| `/reports` | 882 | 646 | 7 → 4 | 2 → 2 |

(Two runs of the same route on this link differ by ±20% on their own — the
floor jitters between 55 and 270ms — so the query and round counts are the
reliable columns; the totals are indicative.)

**What survives the fixes.** Four routes still spend a second or more on
this link, and their remaining rounds are inside their own query modules,
each round a lookup that genuinely needs the one before it: `/dashboard` (20
rounds across `queries/dashboard.ts`'s tiles), `/reports/squad` (12, its
sections' entries → logs → sessions → results tail), `/squad/[id]` (10), and
`/reports/athlete/[id]` (11: entries → sessions → participants → attendance).
Flattening those means restructuring the modules, which is a day's work
each and is not tonight's; they are the routes that take a streaming
skeleton in piece three. `/reports/gps` at 8 rounds sits with them. On
Vercel every one of these is a fraction of the figure here, but a route
that waits on ten dependent rounds waits on ten wherever it runs.

**Not done, and why.** No index: no query is slow. No policy change: every
RLS-gated read is at the floor. No cache: a memo that lives for one render
is not a cache. `gps_records` `select *` survives in one place, the SAR
pack assembly (`queries/sarPackAssembly.ts`), which needs every column by
design.
