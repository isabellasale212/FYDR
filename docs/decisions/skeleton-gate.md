# The skeletons: measured on production, and the rule that replaced the threshold

**Decided 15 September 2026 by Isabella. Supersedes step 3 of
"The gate on the skeletons" in `docs/perf-measurements-2026-09-16.md`.**

## What was measured

Production, `fydr.app`, deployment `e28c750` (which already carries the
request memo, the shortened guard chain and all five skeletons). Functions
run in `dub1`, the same region as the database, so nothing here is a
cross-region artefact. Signed in as a coach at Ashcombe, 29 athletes.

Four requests per route in one curl call so the connection is paid once and
reused, split into **ttfb** (server time to the first byte, which on a
skeleton route is the shell plus the skeleton) and **stream** (first byte to
last byte, which is how long the shimmer is actually on screen). Median of
the three warm runs.

| Route | skeleton | ttfb, four runs (ms) | stream, four runs (ms) | warm stream median |
|---|---|---|---|---|
| `/dashboard` | yes | 411 436 384 456 | 659 329 356 416 | **356** |
| `/squad/[id]` | yes | 217 226 236 342 | 386 310 319 256 | **310** |
| `/reports/gps` | yes | 324 234 319 264 | 1070 737 743 703 | **737** |
| `/reports/squad` | yes | 333 415 555 357 | 344 336 88 246 | **246** |
| `/reports/athlete/[id]` | yes | 241 300 257 276 | 510 181 311 265 | **265** |
| `/flags` | no | 359 348 310 707 | 59 135 53 49 | 53 |
| `/reports` | no | 380 299 304 261 | 1 18 5 9 | 9 |
| `/reports/training-load` | no | 605 640 509 752 | 203 45 143 37 | 45 |

The three rows with no skeleton are the scale check. Their stream is 9 to
53ms, because a page with no `loading.tsx` arrives in one piece. That
confirms the stream column on the five skeleton routes is the deferred work
and not measurement noise.

## The ruling

**All five skeletons stay, and the shimmer gains a delay.**

The literal rule would have deleted three of the five. Two of those three
had individual runs on both sides of the threshold (`/reports/squad` ran
344, 336, 88, 246) and the medians rest on three samples that vary by a
factor of four. That is not a measurement to delete working code on.

Instead the threshold becomes a property of the page rather than a
judgement made once from noisy numbers: the skeleton is invisible for the
first **200ms** and appears only if the wait outlasts it. A render that
finishes in 180ms never shows a skeleton at all, so the flash the original
rule existed to prevent cannot happen, on any route, at any club, at any
data volume. The two routes that clearly earn it today (`/reports/gps` at
737ms, `/dashboard` at 356ms) are unaffected. The three borderline ones
show a skeleton exactly when they are slow and not when they are fast.

This also survives what the numbers cannot tell us: a real club with a
season of data is slower than 29 synthetic athletes, so routes that sit
under the line today will cross it later. Deleting the skeletons now would
mean rebuilding them then.

## What was not decided, and is now the bigger number

`ttfb` is 217 to 456ms on every route measured, and 260 to 750ms on the
routes with no skeleton. Functions and database are both in Dublin, where a
round trip is one or two milliseconds. That time is the shell —
`auth.getUser()`, the revocation check, the organisation — running before
anything paints, and after the piece-two fix that made it one chain rather
than two.

On `/reports/squad` the person waits roughly 600ms in total and more than
half of it is the shell. **The shell, not the reports, is now the largest
single cost on most screens**, and it is where the next performance work
belongs. Not opened here.
