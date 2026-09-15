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

## Amendment, same day: a 300ms minimum display

The ruling above specified the 200ms hold and said nothing about a floor
once the skeleton is showing. That was incomplete, and the builder found
it: `docs/06-design-system.md` §12.1 had specified a 150ms delay **and** a
400ms minimum display, and the minimum is what closes the gap.

Without a floor, a render finishing at 210ms shows the skeleton for 10ms —
a flash, which is the defect the hold exists to remove. Not theoretical: of
the five measured warm streams (246, 265, 310, 356, 737ms) three sit in the
200 to 400ms band where a hold with no floor flickers.

**Once shown, the skeleton stays for at least 300ms.**

Not the 400 the design system wrote: that figure was set against a 150ms
delay, and 200 plus 400 puts a 600ms floor on a product whose slowest
measured route streams in 737. 200 plus 300 means a page ready at 210ms is
held to 500ms — a deliberate slowdown, in a narrow band, in exchange for a
skeleton that always reads as loading rather than as a glitch.

`docs/06-design-system.md` §12.1 is brought back into line by this: the
delay row is 200ms, the minimum-display row is 300ms and is built.

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
