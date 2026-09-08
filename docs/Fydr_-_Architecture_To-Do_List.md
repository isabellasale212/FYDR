# Fydr — Architecture To-Do List

## Decisions Log
- **Staff platform**: web app, not native, for now. Cheaper and faster to build, works on whatever device club staff already have. Revisit only if a real pilot club says the web app fails for pitch-side, live, poor-signal use.
- **Athlete platform, CORRECTED BY ISABELLA 2026-09-08**: **there is no native iOS app and there never has been.** What exists is the web route group at `src/app/(athlete)/` — one codebase, one deployment, one Supabase project, shared with the staff app. The earlier entry here said "native mobile app (iOS first)" and was recorded wrong; it is replaced rather than annotated, because a decisions log that carries a false statement about what exists is worse than one with a gap. Verified independently the same day: no Xcode project, no `.swift` file, and no React Native, Expo, Capacitor or Cordova manifest anywhere in the home directory. **Open, and being decided on the afternoon of 2026-09-08:** whether that web app is the real athlete product going forward or a stopgap for a native rebuild. `docs/generated/Fydr-Athlete-App-Specification.docx` documents the app that exists, not the one that was assumed.
- **Backend reality check (2026-09-04)**: this is not a from-scratch build. A real Supabase-backed app already exists — 58 tables, 62 migrations from Aug 6 to Sep 2, real RLS policies, two clubs' data. Verification of Claude Code's claims about it is in progress after it fabricated one finding (falsely claimed no ERD existed) and self-corrected under pressure.
- **Role model, confirmed by memory (2026-09-04)**: no separate admin role. Admin duties sit with the sports scientist role instead. Five staff roles: sport scientist (with admin permissions), medic, S&C, nutritionist, coach. Athlete is a separate account type, not a staff role.
- **Injury visibility, confirmed (2026-09-04)**: coach, sport scientist, and S&C see general injury info only, body area, current status, restrictions, expected return. Diagnosis, mechanism, severity, imaging, referral, and treatment notes stay medic-only. This resolves the "what does limited mean" question the spec left open, and applies to every screen showing injury data, including the dedicated Injuries screens not yet reviewed.
- **Nutrition targets, confirmed (2026-09-04), resolves D-28**: targets now recompute automatically on every weigh-in, using the nutritionist's set rate against the athlete's latest weight, instead of staying fixed to the weight at assignment. Past targets are unaffected and keep the weight they were originally calculated against, so history is not rewritten. This is a change from a stored snapshot to a live calculation, real backend work.
- **Vercel connected and verified (2026-09-04)**: connector initially authorised against the wrong scope (personal account instead of the Fydr team), fixed by reconnecting and selecting the right team. Confirmed the real project: team "Fydr", project "fydr", no Git repo linked (matches the no-remote finding from Supabase). Last 20 production deploys all `READY`, most recent from today.
- **D-20 adopted as the standing rule (2026-09-04)**: a destination entirely Premium disappears from the sidebar and refuses at the URL. A Premium region inside an otherwise-Base page shows an upsell card, never vanishes silently. Applied everywhere this question comes up, not decided per screen. Already resolves the dashboard's week load card and the athlete report's GPS regions; pre-empts the same question on leaderboards, analytics, and settings, don't re-litigate it there.
- **Billing, out of scope (2026-09-05)**: no billing surface in this specification, permanently, not "not yet built." To be designed as its own separate piece of work, discussed outside this document. Resolves D-17.
- **Credential handling, decided (2026-09-05), resolves G-03/D-38**: temporary passwords removed from account creation entirely, both single and bulk. Replaced with invite links the person acts on themselves. See the updated G-03 item below for the follow-up check this creates.
- **Report visibility, decided (2026-09-06)**: S&C sees every report except the medic's clinical/injury detail, same pattern as coach. Nutritionist sees only Compliance and a censored Injury & availability report (body area, status, restrictions, expected return, never diagnosis); Squad weekly stays closed to them even though the access matrix document lists it as VP, that document is stale here, decided twice directly, don't re-widen it to match the matrix without asking again.
- **Timetable and attendance, decided (2026-09-06)**: the timetable screen opens to all staff roles, its narrower visibility was an artefact, not a decision, `/schedule` already shows the same sessions to everyone. Recording attendance stays a separate, gated action: sport scientist and coach only, matching `SESSION_EDIT`. Medic, S&C and nutritionist can view the timetable but not mark attendance.
- [x] **Timetable and attendance — BUILT 2026-09-06 (migration 0076), deployed.** The decision above, live on production, Run-verified as sport scientist, coach, medic, S&C, and the dual-role coach+medic account.
- **Athlete transfers between clubs, decided**: fresh record, no link, made explicit to the person adding the athlete rather than a silent refusal. The screen states plainly what happened (the athlete is on the squad, has no app access at this club, why, and how to fix it if needed). One-account-to-many-athlete-records is deferred as its own future design pass, not implied by this decision.
- [x] **G-41 backlog — cleared and deployed (2026-09-06).** Meal-library nutritionist/sport-scientist authoring fixed; `NutritionTargetsList` and `expireTarget` dead code removed after an exhaustive import check; 28 code comments (not the originally-scoped 7) citing the superseded `01-roles-and-permissions.md` marked, six unreachable "not part of this role" branches removed; access-gate guard reached zero exemptions as a result.
- [x] **DONE 2026-09-06: both projects now have an IPv4 pooler fallback.** Production and scratch both reachable via Supabase session pooler when the direct (IPv6-only) host can't be resolved from this machine. Scripts prefer direct, fall back automatically, and report which route was used, so no claim is made about which database was actually queried without knowing for certain.
- **Invisible-gate guard shipped (2026-09-06)**: a source-level check now runs in `prebuild`, so a page or route that derives access from `roles.includes(...)` directly instead of `access.ts` fails the build itself, not just a skippable test. This is real enforcement, confirmed by proving a failing guard actually stopped `next build` from running. Before this, nothing blocked a deploy in this repo, no CI, no git hooks, no aggregate test script. Exemptions require a `// access-exempt: <why>` comment, so any remaining silent case is a written, arguable choice rather than an oversight.

## 0c. Not yet built — decided, needs a rule shape access.ts doesn't have yet

## 0d. Not yet decided — needs your call before Claude Code can build either
- [x] **Nutrition day-type editing (Journey 4 finding, decided 2026-09-06).** Replace the rate+multiplier model with three fully independent numbers per day type, training/match/rest, no shared rate, no auto-scaling. Changing one day type must not affect the others. A suggested/guideline value shown next to each field as a non-enforced reference is welcome, but not required. This removes the original auto-scaling design intent on purpose, confirmed, not inferred.
- [x] **CLOSED by Isabella, 8 September 2026: browse-only is the product. Food library on the athlete app.** No meal logging, now or as a planned feature. What is already shipped is the whole of it, so there is nothing to build and nothing left to decide.

  **What this closes, stated so it is not reopened by accident.** An athlete browses the club's meal library, portion-scaled to their own body mass, and cannot log, submit or record anything from it. That is the finished product, not a first phase. `CLAUDE.md` rule 8 stands unchanged: no daily nutrition entry, no per-meal macros, no nutrition compliance domain, with the weekly one-tap check-in as the single exception.

  **If it is ever reopened**, it is not a screen. It needs rule 8 changed deliberately, a table to hold an intake record — none exists, and `nutrition_entries` is dormant by rule — plus that table's RLS, its retention treatment, and a place in the subject-access pack. Anybody proposing "just add a log button" should be shown this paragraph.

  **Also corrected on the way to closing it**, because the entry had been acted on for two days against a false premise: there was never an access question (the athlete app is the web route group in this repository, not a separate native iOS/Swift codebase), and browse-only was never undecided — it was already live.

  **There is no access question.** The athlete app is the web route group at `src/app/(athlete)/` in this repository — one codebase, one deployment, one Supabase project, shared with the staff app. There is no separate native iOS/Swift codebase and there never has been, verified 2026-09-08: no Xcode project, no `.swift` file, no React Native, Expo, Capacitor or Cordova manifest anywhere on the machine. See the corrected Decisions Log entry at the top of this document.

  **And browse-only is not undecided. It is built, live, and pinned.** `src/app/(athlete)/programme/nutrition/page.tsx` already reads `fetchMealLibrary(db, orgId)` and renders every meal — the five fixed reference meals plus whatever the club's coach has authored — portion-scaled to that athlete's own last recorded body mass through the same `scaleMeal`/`scaleDay` maths the coach's `/nutrition` workspace uses, so a recipe cannot read differently on the two screens. Its own header states the constraint: *"Read-only, CLAUDE.md rule 8: no logging, no per-meal macro entry, no submit action anywhere on this screen."* The screen closes with "Reference only — nothing here is logged or tracked."

  **The question that was briefly open** — whether an athlete should be able to **log** a meal from the library against an intake record — **is answered: no.**

  **It is a product decision against a standing rule, not a screen.** CLAUDE.md rule 8 says athletes do not log nutrition daily — *"no daily nutrition entry, no per-meal macros, and no nutrition compliance domain"* — with exactly one exception, the weekly one-tap check-in. Meal logging is the thing that rule exists to refuse. Answering "yes" means changing the rule deliberately, not working around it.

  **And it is a data-model question before it is a UI one.** There is nowhere to put a logged meal. The nutrition tables are `meal_library`, `meal_library_items`, `nutrition_rules`, `nutrition_targets` and `nutrition_checkins` — a library, its items, the rules, the computed targets, and the weekly check-in. The only nutrition write an athlete has is one row a week in `nutrition_checkins`. An intake table does not exist, `nutrition_entries` is dormant by rule, and per-meal logging would need a new table, its RLS, its retention treatment and a place in the subject-access pack.

  **Answered by Isabella, 8 September 2026: "No, browse-only is the product, close it."**

  <details><summary>The original entry, as written 2026-09-06 and acted on until 2026-09-08</summary>

  Food library on the athlete app (2026-09-06). Athlete-facing app is a separate codebase (native iOS/Swift), unconfirmed whether reachable from the same Claude Code session as the staff web app, check access first. Also undecided: browse-only (see foods and macros, no interaction), or log a meal by picking from the library (tracked against intake), or something else. Needs both the access question and the interaction-scope question answered before this is buildable.

  </details>
- [ ] **Should creating a fixture also create a linked `match` session? (2026-09-07).** A match is representable two ways in this schema and today they are unconnected. `fixtures` holds the opponent, kick-off, venue and competition. `sessions` has a `match` type with its own red treatment, an "RPE after full time" expectation in the EXPECTS map, participants, a duration, and a `fixture_id` column pointing back at the fixture. **Nothing writes `fixture_id`.** All four seeded `match` sessions on scratch carry `fixture_id: null`, so the two representations coexist and neither knows about the other.

  What that means in practice right now: a fixture is staff-calendar information. It draws on the schedule grid (2026-09-07), tints the matchday header, anchors the MD spine, and appears on every athlete's Today screen as the "Working towards" line — which is club-wide and names nobody. **It has no participants, generates no RPE, and counts zero contact minutes.** A club creating a fixture has not told anybody to turn up to anything.

  Linking would change what a match *is* in the product rather than how it looks: the squad would be named in it, it would carry a duration and appear in load planning, and the RPE expectation the type already declares would start meaning something. That is a product decision about whether a fixture is a scheduling anchor or an event athletes attend, not an implementation detail, which is why it is here and not in a build queue.

  Two things already anticipate the answer, so neither is blocking: `sessions.fixture_id` exists and is indexed by the schema, and `fixturesToDraw` (scheduleGeometry.ts) already suppresses a fixture's own grid block the moment a `match` session claims it — added when fixture blocks were built, precisely so both representations could coexist without drawing the same match twice.

  **The backfill question rides along with it.** If fixtures start creating sessions, the four existing `match` sessions with `fixture_id: null` are either orphans to leave alone, rows to link to a matching fixture by date, or seed data to delete. Whichever, it needs deciding at the same time — a half-linked schema is worse than either end state, because `fixturesToDraw` would then hide some fixtures and not others with nothing on screen explaining the difference.


- [x] **Flags and player-profile field-level rules (2026-09-06).** Done, deployed (migration 0075), Run-verified across four roles. S&C raises flags but cannot edit wellness entries or RPE scores. Nutritionist edits only nutrition-domain flags, read-only on all others, and can only edit bodyweight and nutrition plan on the player profile.
- [x] **Prevent the "invisible gate" class from recurring.** Done, deployed. Guard runs in `prebuild`, fails the actual build, not a skippable script. Found 20 candidate sites on first sweep, six were real bugs (schedule/planner detail page, settings/groups allocation link, team-allocation publish button, nutrition manual-target link, per-athlete programme split, timetable), all fixed and deployed. Zero exemptions remain as of 2026-09-06 (`test:access-gates` confirms), the last one (`nutrition/page.tsx`'s `isCoach`) was cleared during the G-41 backlog work.
- [x] **Policy-replacement guard (2026-09-06).** Done, deployed. Scans migrations for any `drop policy` + `create policy` on the same object, fails the build unless the matching test file asserts what the previous policy used to refuse (or the migration carries a written `-- policy-widening: <role> — <reason>` marker). Standing rule going forward: any migration that replaces a policy must assert what the old one refused, not just what the new one allows, this is what would have caught 0080's near-miss on the rehab-authorship rule before it was fixed by hand. Also flagged: 154 role-gating policies exist, only 64 have every refusal asserted, 40 tables carry at least one unasserted refusal, grandfathered by the guard's baseline (prospective only, not retroactive). Highest-risk gap: `user_roles` has zero refusal assertions for any staff role, that's the table granting privilege. Worth its own pass, triaged list lives in the guard's own inventory output (`refusedByPolicy` / `refusalCoverage`).

## 0e. Queued by Isabella 2026-09-07, in the order she gave
- [ ] **ON HOLD by Isabella 2026-09-08, revisit after roughly three weeks of real sign-in data: push notifications.** The DECISION to build the wellness and RPE nudges stands. What is on hold is starting the infrastructure, and the reason is that nobody knows yet how many athletes it could reach.

  **iOS Safari delivers Web Push only to a site added to the Home Screen**, and there is no `beforeinstallprompt` on Safari, so the install cannot be triggered in code. The athlete has to open Fydr in Safari, tap Share, choose Add to Home Screen, confirm, and then reopen from the new icon before the app can even request permission. Miss the reopen and the request still fails. **On iOS the reach without that flow is zero, not low.** Android and desktop take an ordinary in-browser prompt.

  **The share is unknown and cannot be estimated from this build.** `push_tokens` holds 43 rows all saying `platform=ios`, but no code has ever written that table — they are seed rows encoding the abandoned Expo plan, now annotated as such at the top of their block in `supabase/seed.sql`. Production held exactly one `auth.signed_in` row on 8 September because the user-agent capture only shipped that morning.

  **What to do instead of guessing:** `src/lib/signInAudit.ts` is now recording the browser on every sign-in into `audit_log.metadata->>'user_agent'`. Read it in early October 2026 and the device split answers itself, for free. Then decide whether push goes ahead as scoped or gets rethought around the install flow being the feature rather than a caveat.

  **Carry this along when push is built, agreed 2026-09-08:** add `comment on table public.push_tokens` recording that the seeded rows are an assumption rather than observed devices. Isabella asked for it batched into the next migration that touches the table rather than given one of its own, so it is not queued as work in its own right. The exact statement is written out ready to paste at the top of the `push_tokens` block in `supabase/seed.sql`.

  **Not blocked on:** the email half of Q-30, which is now DONE — see below.
- [ ] **NOT CODE, and it is yours: tell the medical staff that `mechanism` is now athlete-visible.** Added 2026-09-08, the same day the field started rendering on the athlete's own Today screen for anyone 18 or over.

  **The message, in substance:** the Mechanism field on the injury form is now read by the player it is about. It should carry a factual description of how the injury happened — "Inversion in a ruck", "Direct contact, fell onto point of shoulder in tackle" — and not clinical interpretation. Anything that is an assessment finding, an opinion, or a note to another clinician belongs in **Clinical notes**, which stays medical-only and is not a column of the athlete's view at all.

  **Worth using as the example, because it is real and it is already live:** Adam Selby's mechanism reads *"Head to hip contact making a tackle, no loss of consciousness"*. The first half is exactly right. The clause after the comma is an assessment finding, and it is now on that player's phone. It happens to be reassuring; the point is that nothing decided that, and the next one might not be.

  **Why this is a conversation and not a ticket.** There is no length limit on the column, no check constraint, no application validation, and no guidance shown to the medic typing it — `InjuryMedicalForm.tsx:202` is a bare input whose only processing is a trim. **The field's athlete-safety currently rests on data-entry discipline, not on any code guarantee.** That is written up as **G-A13** in `docs/athlete/spec-gaps.md`, with the options if it later turns out to want a real constraint. The recommendation there is to tell people first: a constraint designed before anybody has actually misused the field will constrain the wrong thing.


- [x] **FIXED AND DEPLOYED 2026-09-08: SQL and TypeScript disagreed about an athlete's `actor_role`.** `audit_acting_role()` walks the five staff roles and returns NULL when none matches; `actingRole()` in `lib/access.ts` fell back to `roles[0] ?? 'athlete'`. So one athlete opting themselves out of a leaderboard was recorded with a null role by the trigger and as `'athlete'` by the application — two answers to "what role were they acting in", in the table whose whole job is being true.

  **TypeScript now matches SQL and returns null.** `actor_role` names WHICH STAFF ROLE somebody acted in, and an athlete holds none; writing `'athlete'` claims a staff role in the column that exists to name one. Nothing is lost, because `actor_id` still says exactly who acted and the column has always been nullable.

  The return type went from `AppRole` to `AppRole | null`, which the compiler traced to eight staff callers and five audit helpers — all of them writing into `audit_log.actor_role`, so their parameter types were widened to match the column rather than patched with `?? 'athlete'` at each call site, which is how the two implementations drifted apart in the first place. The old fallback's stated purpose, "so the audit write cannot throw", is preserved: returning null cannot throw either.

  Run-verified on scratch through the real sign-in route: an athlete's `auth.signed_in` row carries `actor_role = NULL`, a sport scientist's carries `sport_scientist`, so the fallback went and the precedence did not.

Both come after the sign-in-history item in 0b, which is in progress.

- [ ] **1. Launch sign-in page: new headline and a three-column feature grid.** Full spec as given:

  Headline, 56px margin-top below the wordmark: **"Data, finally worth reading."** — Sora 800, 48px, line-height 1.1, letter-spacing -0.03em, max-width 11ch.

  Three-column feature grid, 48px margin-top from the headline, `grid-template-columns: repeat(3, minmax(0,140px))`, 24px gap, each column top-aligned, label `white-space: nowrap`. Icons 24×24 outline, accent colour:

  | # | Icon | Label (16px/700, 8px margin-top) | Caption (13.5px, `var(--muted)`, 3px margin-top) |
  |---|---|---|---|
  | 1 | flag, stroke 1.5 | Flags | raised when a value crosses your threshold |
  | 2 | circle with checkmark, stroke 1.4 | Availability | who can train, and what they can't do |
  | 3 | circle with clock hands, stroke 1.4 | This morning | entries against each athlete's baseline |

  Roboto throughout except the logo/wordmark, which keeps the Sora treatment fixed in ce2e52d.

  **THE RESPONSIVE ANSWER SHE ASKED FOR, AND IT INVERTS THE PREMISE.** Measured on production before proposing, not estimated. The worry was that 140×3 + gaps = 468px "won't fit smaller screens". Two things make that not the problem:

  * **`.launch-claim` is `display: none` below 1080px.** This grid never renders on a phone at all. "Narrow" here means the 1080–1150px band, not 360px.
  * **`minmax(0, 140px)` is a MAXIMUM, not a fixed width.** The tracks shrink on their own. Column widths across the range the grid actually renders in: 119.2px at 1080, and the full 140px from 1150 up, where they stay — the cap is what 140px means, so slack at wider windows falls to the right of the grid rather than into the columns. Nothing overflows at any of them.

  Measured against that, the two things that could still break do not:

  * Widest `nowrap` label is **"This morning" at 95.4px** (not "Availability", which is 79.1px). It clears the narrowest 119.2px column with 23.8px to spare.
  * Captions never overflow; they wrap to 3 lines at 1080 and 2 at 1150+.

  **So: no media query for the grid. The spec as written is already the responsive behaviour.** The only visible cost is 3-line captions in the 1080–1150 band, which is a raggedness question rather than a breakage one. **But the two are coupled** — this holds *because* the claim column is hidden below 1080px. Lowering that breakpoint to show the claim on tablets would make this grid real work, so the two must not be changed independently.

  **What DOES overflow, which is the headline and not the grid.** Sora 800 at a fixed 48px with `max-width: 11ch` measures **406.1px**, against **405.5px** of content width at 1080px. It over-runs by half a pixel at exactly the width where the claim column first appears, and it is only safe from ~1082px up. The current headline avoids this deliberately: `.launch-claim-h` is `clamp(30px, 3.2vw, 44px)` and its comment says why — "44px is the scene's, at its own 1440... so it scales with the window and only reaches 44 where the scene has the room for it." A fixed 48px reverses that decision. **Needs her call:** clamp the new headline the same way (`clamp(34px, 3.5vw, 48px)`, reaching a true 48px at ~1370px up), or keep the fixed 48px and raise the claim breakpoint to 1100.

  **Second thing needing her call: the headline in Sora is a second brand-face element that is not the wordmark.** The spec says Sora 800 for the headline and "Roboto throughout except the logo/wordmark" in the same breath; a headline is not a logo, so the specific instruction and the general rule disagree. ce2e52d's decision was one mark, one face — a Sora headline does not break that rule, but it does change what the brand face means on this page, from "the mark" to "the mark and the claim". Worth being deliberate rather than inferred.

  Also note the grid **reorders** the existing three: the DOM today is This morning / Flags / Availability (`.launch-facts`, a `ul` with `k`/`v` spans), and the spec asks for Flags / Availability / This morning. The captions are word-for-word what is already there, so this is a re-presentation of existing true copy, not new claims — which matters, because the page's header comment records that the design's original three slots were a named club's live figures and had to be replaced.

  Tests first, Run-verified, screenshot before deploying. Show her before finalising.

- [x] **2. FIXED AND DEPLOYED 2026-09-07. Audited, then all three closed.** Verified on production after the deploy: `/login/reset` renders `lockup-word` and carries no `signin-mark`; `/icon.svg`, `/apple-icon.png`, `/opengraph-image.png` and `/manifest.webmanifest` all return 200 with the right content types, and Next wires `rel="icon"`, `rel="apple-touch-icon"`, `rel="manifest"` and `og:image` into the head; and a probe of the deployed stylesheet at a 900px viewport computes `.brand .wm` and `.wm-trace` at 40px against a control div of 900px, so the rail rules are really being served.

  **One thing worth keeping.** The first attempt at fix 1 used the right component and still drew the wrong thing: `.lk-trace` falls back to `--accent-border` when nothing declares `--lk-trace`, and only `.launch` declared it, so the lockup on a new surface rendered its trace in full-strength blue instead of the pale tint. The same class of error as the blue square, one layer down, and invisible to every assertion that had been written at that point — it was caught by looking at the render. The three inks are now pinned equal to the splash's by test.

  **Left open deliberately, needs Isabella's judgement:** at 40px the collapsed rail's ringed dot is 5.6px across. It is correct and no longer overflows, but the detail is faint. Showing a larger CROPPED dot rather than the whole trace shrunk is a different fix and was not assumed.

  The audit that produced these follows.

- [x] **2b. The audit, 2026-09-07.**

  **The word is right everywhere. The MARK is not.** All five text wordmarks measure Sora 800 at -0.035em, which is why the production check earlier that day reported `/login/reset` as correct — it measured `.signin-word`, the typography, and the thing that is wrong is the graphic sitting next to it. A check that passes on the half you looked at.

  **The reference mark** (`FydrLockup` on `/login`, and `.wm-trace` in the sidebar) is a GPS trace — down into a trough, along, up — ending in a ringed dot. Both draw the same shape at two scales.

  | Surface | Route(s) | Word | Mark | |
  |---|---|---|---|---|
  | `FydrLockup` | `/login`, `/login/loading` | Sora 800 -0.035em | trace + ringed dot | reference |
  | Sidebar `.brand .wm` | every staff/athlete page, >=1024px | Sora 800 -0.035em | trace + ringed dot | ok |
  | Sidebar collapsed `.wm-mono` | same, 768-1023px | Sora 800, bare "F" | **trace renders 132px inside a 63px rail** | **MISMATCH** |
  | `.signin-logo` | `/login/reset` | Sora 800 -0.035em | **plain blue rounded square** | **MISMATCH** |
  | `.signin-logo` | `/login/reset/confirm` | same | same square | **MISMATCH** |
  | `.signin-logo` | `/login/mfa` | same | same square | **MISMATCH** |
  | favicon, apple-icon, OG image, manifest | every page, and every shared link | — | **absent** | **MISSING** |

  **1. `.signin-mark` is not the Fydr mark.** It is a 26x26 div, `border-radius: 8px`, filled `var(--accent)` with a glow ring — a generic rounded blue square that appears nowhere else in the brand. Three public pages use it, including the forgot-password page. The wordmark beside it also differs in content: these write "Fydr**.**" with a typographic full stop, where the lockup's dot IS the ringed dot of the mark.

  **2. The collapsed rail leaks its trace.** `Sidebar.tsx` says the trace is "Hidden on the 64px collapsed rail with the wordmark". **No CSS does that.** Measured at 900px: the rail is 63px, `.wm-full` is correctly hidden, `.wm-mono` shows the bare "F" — and `.wm-trace` still renders at its full 132px, overflowing the rail by 68px and clipping. The comment describes a fix that was never written.

  **3. There is no favicon at all.** `public/` is empty, `src/app/` has no `icon.*`, `apple-icon.*`, `opengraph-image.*` or `favicon.ico`, and `layout.tsx`'s metadata declares no `icons`. Confirmed on production: `/favicon.ico`, `/icon.png`, `/icon.svg`, `/apple-icon.png`, `/apple-touch-icon.png`, `/opengraph-image.png`, `/manifest.webmanifest` and `/site.webmanifest` all return **404**. Every browser tab shows the browser's generic icon and every shared link previews with none. This is the most likely thing "the wrong logo" actually refers to, since it is the only mark visible on every page at once.

  **Deliberately NOT in scope:** `organisations.logo_url` / `OrgLogoField` / `ClubDetailsEditForm` is a CLUB's own uploaded logo, not the Fydr mark, and is correct as built.

  **Not screenshotted:** `/login/mfa` is behind auth and redirects signed-out, so its mark is confirmed from source (identical `.signin-logo` markup) rather than from a render.

  Original brief follows.

- [ ] **2a. As first written.** "Some pages, including a forgot-password page, are showing the wrong logo." Find every place a logo or wordmark renders, list them by page/route AND by the asset or CSS class each one uses, and say which do not match the current Sora treatment (Sora 800, tracking -0.035em, per ce2e52d). Screenshot each mismatch before changing anything.

  Known starting points, not the answer: `.lockup-word` (`FydrLockup`, used by `/login` and `/login/loading`), `.signin-word` (`/login/reset`, `/login/reset/confirm`, `/login/mfa`), `.brand .wm` (`Sidebar`). The forgot-password page she names is `/login/reset`, which measured correct on production today — so either the mismatch is on a different route than the one it looks like, or it is an asset (favicon, og image, email template, PWA icon) rather than a CSS-set wordmark. **Sweep by import, not by route folder** — a route-folder grep has already answered a question like this confidently and wrongly once.

- [ ] **IN PROGRESS 2026-09-08: widen the audit triggers to the rest of the sweep, in small batches.** 0085 and 0086 covered ten tables. Measured on production: **49 unaudited, not ~40**, of 59 public tables.

  **Batch three, `0088_audit_widen_config.sql` — five tables, applied to scratch, verified, NOT pushed.** `thresholds`, `leaderboards`, `leaderboard_opt_outs`, `week_templates`, `fixtures`. Test `450`, 13 assertions, a real write per table through RLS, red before the migration and green after. The case that earned `leaderboard_opt_outs` its place in this batch rather than a later one: its self-insert policy lets an **athlete** write their own row, and every audited row until then had been written by staff. `audit_acting_role()` walks the five staff roles and returns NULL when none matches, so an athlete's opt-out is recorded with a real actor and a null role. That is correct and 450 pins it, so nobody later "fixes" the null to `'athlete'`.

  **Batch four, `0089_audit_widen_authoring.sql` — six tables, applied to scratch, verified, NOT pushed.** The programme authoring chain whole: `exercises`, `programmes`, `programme_blocks`, `programme_sessions`, `programme_exercises`, `exercise_overrides`. Test `460`, 16 assertions. Taken whole rather than split because a half-audited chain reads worse than an unaudited one — somebody who can see a block added but not the session inside it rewritten draws a confident wrong conclusion from a record that looks complete. Volume checked, not assumed: live counts are 5 / 7 / 6 / 15 / 15 / 2, and every write in `src/lib/queries/programmes.ts` is a single-row insert, so one audit row is one thing a person did.

  **The one shape that was not like the others, and the reason shapes get checked.** `exercises.org_id` **is nullable**; every other table in the chain requires an org. The trigger copies the row's `org_id` straight through, and `audit_log`'s select policy is `org_id = auth_org_id()`, which no null satisfies. **A global exercise therefore produces an audit row that is written and then readable by nobody.** 460 asserts it in both directions — invisible through RLS, present underneath it — so it is a recorded limitation rather than a later mystery. There are no global exercises in the data today and the insert policy requires `org_id = auth_org_id()`, so only a service role can create one. **This is the same shape as the org-less failed sign-in row already on this list and it wants the same answer: a platform-level read path.** See `/platform/sign-in-probes`.

  **Also proven in batch four:** every staff-written audit row in the suite until now came from a sport scientist, because that is the only role permitted to read `audit_log` and so the role every test drove as. A function returning `'sport_scientist'` unconditionally would have passed 430, 440 and 450 alike. 460 writes the authoring chain as the S&C and asserts the recorded role follows the person.

  **Batch five, `0091_audit_widen_records_of_record.sql` — five tables, applied to scratch, verified, NOT pushed.** The records you reach for after something has already gone wrong: `sar_requests`, `sar_clinical_reviews`, `injury_timeline_event`, `rehab_assignments`, `users`. Test `470`, 15 assertions. Three of the five are tables whose grants `0090` has just corrected, which is not a coincidence — they kept turning up as the ones nobody had looked at.

  What this batch proved that the earlier ones could not: `audit_row_change()` carries a special case written for 0085, resolving an athlete through `public.injuries` when a row has an `injury_id` but no `athlete_id`. It had exactly one user — `injury_clinical` — for six migrations. `injury_timeline_event` and `sar_clinical_reviews` are its second and third, and 470 asserts both, because a path with one user has only ever been proven for one shape.

  Also found, and asserted rather than filtered away: **granting somebody a role writes an audit row against their user account**, not only against `user_roles`, because it bumps `users.claims_version`. That is right — a role grant changes what an account can do — and 470 pins it so a later reader does not treat the second row as a duplicate.

  **State: 26 of 59 tables audited.** 0088, 0089 and 0091 are on scratch only. To deploy all three: `npm run db:push`.

  **Two tables are now excluded for SHAPE rather than volume, and the guard knows the difference.** `organisations` has no `org_id` column at all — it IS the org — and `metric_definitions` has neither `id` nor `org_id`. The generic function would write rows with a null `org_id` that `audit_log`'s own select policy can never return. Auditing `organisations` needs the same special case `athletes` has, where the row's own id becomes the org: a function change, its own migration, its own test.

  **Remaining, and the decision they need.** The high-volume tables are now guarded rather than merely noted — `scripts/test-default-privileges.ts`'s sibling `scripts/test-audit-triggers.ts` fails the build if `session_participants`, `session_attendance` or `group_memberships` acquire a trigger, because a row per athlete per session is a decision somebody has to take, not a sweep. `group_memberships` alone took 17,692 inserts over the statistics window against 47 live rows.

  Isabella's terms: check each table's actual shape before assuming the pattern fits, no more than a handful per batch given two shape surprises last round (`athletes` has no `athlete_id` because the row IS the athlete; `user_roles` has none and correctly so), tests first, Run-verified with a REAL write per table, report back after each batch rather than at the end, tell her before deploying.

  **THREE THINGS THE PRODUCTION NUMBERS SAY BEFORE ANY OF THIS STARTS**, and they change the batching rather than just informing it:

  * **`audit_log` is in the unaudited list and must stay there.** A trigger on it would audit its own writes. Obvious once said, easy to sweep into a batch mechanically.
  * **Volume is the real constraint, not shape.** Inserts over the 45-day window: `wellness_entries` 25,083, `flags` 17,750, `group_memberships` 17,692, `training_entries` 13,894, `compliance_expectations` 11,658, `session_participants` 9,086. A per-row trigger on those adds an `audit_log` row per write, and `audit_log` itself has already taken 9,803. Auditing the six largest would roughly ten-times the table. Decide per table whether the answer is "audit it", "audit updates and deletes but not inserts", or "do not audit; it is machine-generated".
  * **Much of that volume has no human actor.** `flags` and `compliance_expectations` are written by the nightly SECURITY DEFINER jobs, which never authenticate — so `auth_user_id()` is null and the rows would record that nobody did something, thousands of times a night. That is noise in the table whose value is that every row means something. The clinical tables were worth auditing because a person writes them; these are not the same case and should not inherit the decision.

  **Suggested first batch, all low-volume and human-written:** `injury_clinical_attachments` if it exists, `athlete_consents` follow-ups, `subject_access_requests`, `retention_policies`, `thresholds`. Confirm shapes first — `thresholds` shows 8,761 inserts against 7 live rows, which is a re-seed pattern worth understanding before attaching anything to it.

  **The count itself is worth re-measuring at the start**, not taken from here: `scripts/verify-audit-trail.mjs`'s approach (`pg_stat_all_tables`, plus `pg_trigger` for coverage) is what produced these numbers.

- [x] **ANSWERED 2026-09-07: production is in the wrong region, and the documents were wrong about it. Diagnosis and document corrections are done; the MOVE is the item below.**

  **Measured.** `.env.production.explicit`'s pooler host is `aws-1-eu-west-1.pooler.supabase.com`. `eu-west-1` is **Ireland**. The server's own address is in AWS's `2a05:d018::/32` range. Scratch is in eu-west-1 too.

  **`docs/09-security-and-compliance.md` says London (eu-west-2) in four places**: the architecture diagram (§line 140), the sub-processor table's transfer-mechanism column — "UK, none needed for the data at rest" (line 715) — an explicit instruction (line 722), and a launch checklist item (line 1868) that would otherwise be ticked untruthfully.

  **What is and is not at stake.** The *factual* claim is wrong: the data is in the EEA, not the UK. The *legal* conclusion may well survive — the UK's adequacy regulations cover the EEA, so a transfer mechanism is probably still unnecessary — but that is a different reason than the document gives, and it is not my call to make. Either the region moves or the document is corrected to say Ireland and to state the actual basis.

  **Why it is urgent in a way it will not be later.** Line 722 of that document says: *"You cannot change it later without a migration."* Migrating today means moving **26 MB and 7,859 rows of synthetic data** — the dump/restore drill on 2026-09-07 took about four minutes end to end and is written up in `docs/runbook-backup-and-recovery.md`. Migrating after a club is on it means real athlete data, real sign-ins, and a re-invite for every account, because a `public`-schema dump does not carry `auth.users`.

  **So the order is: settle this, then buy Pro.** Buying Pro on a project that is then abandoned for a London one wastes the purchase, and it is the one decision on the 0a path whose cost rises sharply rather than staying flat.

  **DOCUMENTS CORRECTED 2026-09-07.** Seven statements across five files, not the four first counted — `05-architecture.md` (the environment table, and O-15 itself, now closed with the real answer), `09-security-and-compliance.md` (the sub-processor diagram, the sub-processor table's legal conclusion, the "choose London" instruction, and the launch-checklist item), `11-open-questions.md`, and three more in `10-roadmap.md` that the first sweep missed. Every one now states eu-west-1 or is explicitly marked as an intention that was not met. `Europe/London` as a TIMEZONE is a different thing and was left alone.

  **THE MOVE ITSELF IS BLOCKED ON TWO CAPABILITIES, not on a decision.** Attempted 2026-09-07 and stopped before anything was changed:

  1. **Creating the London project needs a Supabase management credential that is not present.** No `SUPABASE_ACCESS_TOKEN` in any env file or the environment, and the CLI is not logged in (`LegacyPlatformAuthRequiredError`). A project's region is fixed at creation, so nothing can begin without this.
  2. **The `auth` schema cannot be migrated by the rehearsed method.** The drill's dump covers `public` only. Production has 13 other schemas, and two matter: `auth` (46 users and their password hashes) and `auth_hooks` (the `custom_access_token_hook` that puts `org_id` and `roles` into every JWT — without it `auth_org_id()` returns null and **every RLS policy in the product fails closed**). Dumping `auth` was refused by the environment's safety classifier because it extracts credential material; that refusal is correct and was not worked around.

  **So "confirm the restored auth works exactly like the drill did" cannot be satisfied, and should not be.** The drill's auth step was `npm run seed:auth`, which sets ONE SHARED KNOWN PASSWORD on every account. That is right for synthetic scratch data and would be indefensible on production — which is why the guard added the same day refuses to run it anywhere else.

  **What a real move therefore needs, none of it started:** the new project; a decision on how accounts transfer (an `auth` migration performed by somebody who can extract it, or re-inviting all 46 accounts); `auth_hooks` recreated AND the hook re-registered in Supabase's auth settings, which is dashboard configuration rather than SQL; the `retention`, `cron`, `storage` and `vault` schemas assessed; new URL and keys into Vercel; and redirect URLs and the custom domain repointed.

  Also worth knowing: "our data stays in the UK" is described in that same paragraph as removing "an entire conversation with every club".

- [ ] **MOVE PRODUCTION TO eu-west-2 (LONDON).** The action arising from the item above. Not urgent while every account is synthetic; **materially cheaper now than after a real club is on it**, which is the only reason it has a place this high.

  **Four prerequisites, and the fourth comes before anything is touched.**

  - [ ] **A Supabase management token, or the connection string for a new London project — from Isabella.** Region is fixed at project creation, so this is the first move and nothing precedes it. There is no `SUPABASE_ACCESS_TOKEN` in any env file or in the environment, and the CLI is not logged in.
  - [ ] **A decision on the 46 existing accounts: re-invite, or a proper `auth` migration.** **Re-invite is likely cleaner while the data is synthetic** — every account is one Isabella created, the invite flow is built and tested, and it avoids moving password hashes between projects entirely. A real `auth` migration is the answer only once the accounts belong to people who would notice being asked to set a password again. Note that dumping `auth` was refused by the environment's safety classifier as credential extraction, so that path needs somebody who can perform it, not just a decision.
  - [ ] **`auth_hooks` recreated AND the token hook re-registered in Supabase's dashboard settings.** Two separate steps and the second is not SQL. `custom_access_token_hook` puts `org_id` and `roles` into every JWT; if the function exists but is not registered as the access-token hook in the project's auth settings, `auth_org_id()` returns null and **every RLS policy in the product fails closed**. The app would come up looking healthy and show nobody any data.
  - [ ] **`retention`, `cron`, `storage` and `vault` assessed BEFORE touching anything.** The rehearsed dump covers `public` only; production has 13 other schemas. `cron` holds the nightly jobs (compliance expectations, threshold evaluation, retention preview) — a move that leaves them behind is silent, because nothing fails, work simply stops happening overnight. `storage` holds club logos and any subject-access packs. `vault` may hold secrets the hooks depend on.

  **The parts already rehearsed and measured** (`docs/runbook-backup-and-recovery.md`): the `public` dump and restore, 2.2 MB, about four minutes end to end, with the `--no-acl` and `--clean` traps documented. That runbook is the migration's middle; these four prerequisites are its beginning and its end.

  **Sequencing against the Pro upgrade:** do this FIRST. Buying Pro on a project that is then abandoned wastes the purchase, and `0a` should be closed against whichever project is the permanent one.

## 0a. Hard gate — do this before the first real person touches the app
- [x] **CLOSED 2026-09-08: `0090` is applied to production. Measured, not assumed.** The entry below was written when `0090` was scratch-only, and its "has NOT been pushed" line went stale the same afternoon when the migration went out in the 0088-0091 batch. Confirmed afterwards against production's own privilege catalogue and migration ledger, not by trusting the push and not by inference:

  **How it was checked.** Connected
  directly with `pg` over `SUPABASE_DB_URL`, the same path `db-push.mjs` and the
  pgTAP runner use, and read two things: the migration ledger, and
  `information_schema.role_table_grants`. Both are read-only `select`s.

  **The ledger settles it on its own.** `supabase_migrations.schema_migrations`
  holds `0080`-`0094` with no gaps, `0090` among them.

  **And the privileges match `0090`'s own grant statements, table by table** —
  four DIFFERENT privilege sets across four tables, which is the per-table
  narrowing this migration specifies and is not something a blanket default
  produces:

  | Table | `0090` grants `authenticated` | production holds |
  |---|---|---|
  | `injury_timeline_event` | select, insert | `INSERT,SELECT` |
  | `login_attempts` | select | `SELECT` |
  | `sar_requests` | select, insert, update | `INSERT,SELECT,UPDATE` |
  | `sar_clinical_reviews` | select, insert | `INSERT,SELECT` |

  `anon` holds **nothing on any of the four** — no row at all in the grants
  table, which is what `revoke all ... from public, anon, authenticated`
  produces. `service_role` holds all seven on each, by design.

  Original entry follows.

  <details><summary>As filed</summary>

  **QUEUED 2026-09-08, awaiting deploy: four tables carry database grants their own migrations say they do not have. Migration `0090` is written, applied to scratch and verified; it has NOT been pushed.** Found by running the full pgTAP suite for the first time — two files were red and had been red for some time.

  **What is wrong**, measured on scratch, which is a restore of production:

  | Table | Holds | Its migration intended |
  |---|---|---|
  | `injury_timeline_event` (0080) | **anon** and `authenticated`: all seven privileges | `authenticated`: select, insert. anon: nothing |
  | `login_attempts` (0048) | `authenticated`: all seven | `authenticated`: select |
  | `sar_requests` (0032) | `authenticated`: all seven | `authenticated`: select, insert, update |
  | `sar_clinical_reviews` (0032) | `authenticated`: all seven | `authenticated`: select, insert |

  All seven means select, insert, update, delete, **truncate**, references, trigger.

  **How bad it is, precisely.** RLS is enabled on all four, no policy on any of them names `anon`, and none has a DELETE policy at all — so a delete reaches no row and returns zero rows affected rather than a refusal. **No data is exposed and nothing can be destroyed through the API today.** What is missing is the grant layer that is meant to sit underneath RLS as the second line. TRUNCATE is the one privilege here not subject to RLS, but no PostgREST verb issues one, so it is a latent grant rather than a live hole — and it is the privilege that made a scratch database unrebuildable once already. The three tables involved are the subject access request records and the sign-in security log: the records whose entire purpose is to still be readable after something has gone wrong.

  **Why it happened, and why it happened twice.** Supabase provisions the project with default privileges granting `anon`, `authenticated` and `service_role` everything on any table created afterwards in `public`. Postgres GRANT is additive, not a reset, so a narrow `grant select, insert to authenticated` lands on top of the wide default instead of replacing it — the revoke has to come first. `0013_close_default_privilege_gaps.sql` closed exactly this for the 29 tables that existed then, and its own header says it was found only by running the tests against a real hosted project for the first time. Since then 0032 and 0048 revoked `from public, anon` and stopped, leaving `authenticated` untouched — which is verbatim the mistake 0013's header describes. 0080 wrote no revoke at all.

  **Why nobody saw it.** The assertions that catch it are `010_rls_coverage_test.sql` ("anon holds no privilege on any table in public") and two in `400_injury_timeline_test.sql`. Both live in pgTAP, and pgTAP could not be run on this machine until `psql` was installed (2026-09-07). The guards that run on every build had no equivalent check. **That gap is now closed**: `scripts/test-default-privileges.ts` is in `prebuild`, reads the migration set rather than the database, checks BOTH roles separately, and its central case is that it would have caught 0080.

  **To deploy** (queued, not run):

  ```
  npm run db:push
  ```

  Then re-run `010`, `400` and `scripts/test-default-privileges.ts`.


  </details>

- [ ] **Upgrade Supabase from Free to Pro tier before inviting the first real club, design partner, or any person whose data isn't something you typed in yourself.** Not "before full completion", before the first real account. Free tier has no automated backups and no point-in-time recovery; confirmed 2026-09-05 that Claude Code also cannot take a manual backup from its own environment (no `pg_dump`/`psql` on PATH, `supabase db dump` needs Docker, not available). As of 2026-09-05 all production accounts are synthetic test data created by you, so this is not yet urgent, it becomes urgent the moment that stops being true.

## 0. Verification — do this before trusting any further Claude Code output on this repo
- [ ] Log into the Supabase dashboard directly and check the `organisations` table yourself. Not through Claude Code.
- [x] Upload the data model, role model, and decisions-required files directly to this chat — done, read directly, confirmed genuine and consistent with what was reported
- [x] Personally confirm, from your own memory, whether you actually decided on the five-role model — confirmed: yes, no admin role, admin duties folded into sport scientist
- [x] Confirm `coachkitstudio <isale4567@gmail.com>` is your own account/session — confirmed. Deployment history under your personal Vercel account (`isabellasale212@gmail.com`, confirmed as your own email) shows the same identity across the last 20 production deploys, all `READY`, most recent from today. Two independent systems agreeing, plus your own confirmation.

## 0b. Urgent, found while reading the raw files (2026-09-04) — not waiting on any product decision
- [x] **DONE 2026-09-08: email sends for real, both flows, confirmed in a real inbox.** This closes the email half of Q-30 and the front-page Step 1 item that read "write the correct rows but send nothing".

  **Two flows, two systems, and they were never the same one** — the front-page instruction to "wire it into the existing password reset and invite link flows" was half wrong:

  | Flow | Sends via | Configured in |
  |---|---|---|
  | Invite (Settings → add a user) | `getEmailProvider()` → Resend REST API | `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` in **Vercel**, Production only |
  | Password reset | `supabase.auth.resetPasswordForEmail()` → Supabase's own mailer | Custom SMTP in the **Supabase** dashboard |
  | Bulk invite | nothing — returns a link for staff to copy | n/a |

  Isabella configured both herself; no code change was needed for either. Both confirmed landing in a real inbox on 2026-09-08.

  **The invite path, verified from the audit trail rather than assumed:** `invite.email_sent`, `provider: resend` (not the `logged` no-op), `delivered: true`, no error, actor `j.pemberton@ashcomberfc.example` as sport_scientist, target a real address, 15:59 BST. The code only reports `delivered: true` on a genuine 2xx from Resend. The test account was deleted afterwards and production is back to 46 users / 46 auth users; the audit row survives it, because `audit_log` carries three triggers refusing UPDATE, DELETE and TRUNCATE.

  **`EMAIL_FROM_ADDRESS` is `onboarding@resend.dev`, which is a constraint not a choice.** Until a domain is verified in Resend, that is the only permitted sender and it can only send to the Resend signup address. **So invites cannot yet reach a real player.** Verifying `fydr.app` in Resend — a few DNS records — is what makes invites usable, and it wants doing before a pilot club rather than after.

  **The bounce protection that went in alongside it:** `GuardedProvider` in `lib/email/provider.ts` refuses any send to a non-routable domain without making the request. All 46 production seed accounts are on `.example`, so every one of them is refused and **nothing on production can produce a hard bounce**. Renaming those rows was considered and rejected — every placeholder TLD is equally non-resolving, `public.users.email` is NOT NULL with a unique index, and all 46 match `auth.users` so a rename would have changed the sign-in address for every test account. Full reasoning is in the module header and `scripts/test-email-send-guard.ts`.


- [x] **CLOSED 2026-09-08 by migration 0094, awaiting deploy. The GPS tier gate is now inside `compute_leaderboard`.** Test `500` proves it with the key and the source deliberately disagreed, so a prefix check cannot satisfy it; `290` gained a §7 asserting the gate so opening the tier in its own setup cannot hide the gate's removal. The four page-level checks stay, as Isabella instructed — a function returning no rows cannot tell an athlete why. One consequence: the athlete detail page had to split its board/membership guard, because a gated board now returns no ranking rows and the combined guard would have answered "not available" and made the plan message dead code. Original entry follows.

  <details><summary>As filed</summary>

  **FILED 2026-09-08: the GPS tier gate is page-level only. `compute_leaderboard` has no tier check of its own, and that is the same class of problem as the audit-trail and default-privilege work — a rule that looks enforced and is not.** Isabella asked for this to be filed at the same seriousness as the other invisible-gate items, and it belongs with them for the same reason: nothing fails, nothing logs, and the code reads as if the rule holds.

  **What is closed.** Q-29's leak is fixed at the surface. Both athlete board screens now call `gpsMetricBlocked()` (`src/lib/tier.ts`) — the list filters a gated board out, the detail page returns a plan notice — and the two staff leaderboard surfaces already did the equivalent. Deployed 2026-09-08, commit `77cdf20`.

  **What is not closed.** `compute_leaderboard` itself will happily rank a `gps.*` metric for a club on `core`. Read the function: it resolves the board, checks `metric_definitions.leaderboard_eligible`, checks staff-versus-athlete visibility, filters the population for opt-outs and for under-18 consent — and never once reads `organisations.tier`. Four separate rules enforced inside the function, and the commercial one enforced only by the four pages that happen to call it.

  **So the gate is four page-level checks with nothing underneath them**, which is exactly the shape 0090 was written to fix for table grants: RLS held the line while the layer beneath it was missing. Here there is no layer beneath it at all. A direct PostgREST call to `compute_leaderboard` on a Basic org returns GPS rankings today. `leaderboards/new` names this in its own header — *"a direct PostgREST insert could still create a GPS board on a Basic org... closing it properly needs the tier inside compute_leaderboard"* — so it has been known and unclosed since GPS boards landed.

  **How bad it is, stated precisely rather than dramatically.** This is a commercial gate, not a safety one: GPS is a paid tier, not medical data, and an athlete seeing a distance ranking is a revenue leak rather than a disclosure. Reaching it needs a PostgREST call rather than a screen, so it is not something a player stumbles into. It is not urgent in the way the clinical gates were. It is filed here because the *shape* is the dangerous part — every screen currently looks like it enforces the rule, so the next person to add a leaderboard surface will reasonably assume the function protects them, and it does not.

  **The fix.** Add the tier to `compute_leaderboard`: refuse, or return no rows, when `md.source_table = 'gps_records'` (or the key is `gps.%`) and the board's org is not on `performance`. Prefer the `source_table` test over the key prefix — it is what makes a metric a GPS metric, and it will still be right if a tenth GPS metric is added under a different key. Then the four page-level checks become defence in depth rather than the only defence, and the pgTAP suite can assert it the way 490 asserts the age gate.

  **Do not delete the page-level checks when this lands.** They give the athlete a readable plan message instead of an empty board, which a function-level refusal cannot do.

  </details>

  **Still open after 0094, and named in its header:** the metric dispatcher inside the function still selects its GPS branch on `metric_key like 'gps.%'`, so a tenth GPS metric under a different naming convention would be *gated* correctly by 0094 but would not *rank* at all. And the four page-level checks still use the key prefix, because `fetchMetricCatalogue` does not send `source_table` to the client — so such a metric would get the generic "not available" rather than the plan message. Strictly safe, mildly less readable, and the fix if it ever matters is one column added to `METRIC_COLUMNS`.


- [x] **FIXED AND DEPLOYED 2026-09-08: `users.last_seen_at` was read by three components and written by nothing, so every account showed "Never signed in".** Wired into `recordSignIn()`, which all three sign-in flows already pass through — `/auth/sign-in` (password), `/auth/confirm` (invite and magic link) and `/auth/record-sign-in` (the PKCE reset, whose session is established in the browser). Stamped above the audit row's guard, deliberately: the audit insert is refused without an org because its policy is `org_id = auth_org_id() and actor_id = auth_user_id()`, while `users_self_update` pins only `id = auth_user_id()` — and somebody whose claims are missing an org has still signed in. Fails open, like the audit write and the rate limiter.

  **The interaction that made this more than a one-liner.** `users` has been audited by trigger since 0091, applied the same morning, so every sign-in would have written a `users.update` audit row saying `last_seen_at` moved — next to the `auth.signed_in` row that says the same thing and carries the address, the method and the session as well. Migration `0092` adds `last_seen_at` to the columns `audit_row_change()` already excludes from an update's changed list, the same treatment `updated_at` has always had and for the same reason. Test `480` asserts both directions, because an exclusion is a hole in an audit trail: a sign-in writes no row, suspending an account still does, and a write moving BOTH still records the status alone.

  Run-verified on scratch through the real route: two sign-ins, `last_seen_at` moved from NULL on both accounts, one `auth.signed_in` row each, **zero** `users.update` rows.

  <details><summary>The original finding</summary> `UserDetailPanel` renders `Last seen …` or the literal string `Never signed in` from it, `UserManagementPanel` renders `· last seen …`, and `userManagement.ts` selects it. Nothing in `src/` and no migration ever writes the column. So the user-management screen tells a sport scientist that every member of staff has never signed in, including ones who signed in that morning. Found while checking whether `users` was low-volume enough to audit — it is, precisely because this column is dead. Not fixed here: writing it is a decision about where (an auth hook, the sign-in route, or a periodic update) and each has a different cost. The sign-in route is the obvious home given `recordSignIn()` already runs there.</details>

- [x] **FIXED 2026-09-07, Run-verified, awaiting deploy. The product called every athlete "he".** 108 occurrences across 31 files, not the six in four that the first count found — the "his own" search had caught one phrasing out of many. The rendered set alone was 35 across 9 files: "Compared with his position" on three different profile tabs, "What he reported", "What he actually did, as he logged it", "Every plan that reaches him", "Called him Wednesday" in a triage placeholder, and the three shared band labels in `lib/status.ts` that surface wherever a body-composition status renders.

  Fixed as copy, not a pronoun field, for the reasons below. `scripts/test-inclusive-copy.ts` runs in `prebuild` and covers comments as well as strings — the internal prose saying "he" about a hypothetical athlete is where the shipped copy came from, and a rule that exempts the place the habit lives is not a rule. Proved it fails by planting a regression.

  **Two things the sweep needed a person for.** `TestBests.tsx` built "This season's" as `${cond ? '…: t' : 'T'}his season's`, splitting the word across a template expression so a word-boundary search read a stray "his" — fixed at source rather than exempted, which is clearer anyway. And `ProgrammeBuilder` said "It will not reach him until they sign it off", where "him" was the athlete and "they" the medic; a mechanical swap made both "they" and lost the distinction, so both are now named outright: "It will not reach the athlete until a medic signs it off."

  Original entry follows.

- [x] **As first written.** Rugby union's fastest-growing participation is women's and girls', `docs/07-integrations.md` names "semi-professional squad sport in the UK and Ireland" as the market, and a readiness card that says "vs **his** own 68" in front of a women's squad is the kind of thing that ends a demo in the first thirty seconds.

  **There is no gender or pronoun column anywhere in the schema.** Checked directly: no `gender`, no `pronouns`, nothing on `athletes`. So the copy is not defaulting from data that happens to be male — it is hardcoded, and there is currently nothing it could read instead.

  **SIX RENDERED STRINGS IN FOUR FILES.** This is a correction to what was said in the moment, which named five files: four of those five were COMMENTS rather than user-facing copy, and three real ones were missed. The rendered set:

  | File | Line | String |
  |---|---|---|
  | `src/lib/status.ts` | 48 | `Above his own band` |
  | `src/lib/status.ts` | 49 | `Below his own band` |
  | `src/lib/status.ts` | 50 | `Inside his own band` |
  | `src/app/(staff)/squad/[athleteId]/page.tsx` | 840 | `status vs his own 14-day baseline` |
  | `src/app/(staff)/squad/[athleteId]/nutrition/page.tsx` | 443 | `never sees this range in his own app` |
  | `src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx` | 132 | `vs his own ${r.baseline}` |

  **`lib/status.ts` is the one that spreads.** It is a shared status-label map, so those three strings surface wherever a body-composition band status is rendered rather than on one screen. Fixing the three obvious card strings and leaving it would leave the phrase in the product.

  **Two ways, and the second is better.**

  * **Add a pronoun field** and interpolate. Honest, and it buys a data-collection question nobody has asked for, a migration, a settings UI, an import path, and a default for the 35 athletes already in production. It also gets it wrong until somebody fills it in.
  * **Rewrite the copy so no pronoun is needed**, which is usually shorter as well as correct: "vs his own 68" → "vs their 68" or simply "vs baseline 68"; "Above his own band" → "Above band"; "never sees this range in his own app" → "never sees this range in the athlete app". **Recommended.** No schema, no migration, no per-athlete data, correct for everybody on day one, and the possessive was carrying almost no meaning in most of these — the card already names the athlete directly above the sentence.

  **Also worth a sweep at the same time, but NOT the same problem:** nine or so comments use "he/his" about a hypothetical athlete. Those are internal prose, not shipped copy, and should be corrected for the same reason rather than urgently.

  Cost: perhaps an hour including the sweep and an assertion that no rendered string in `src/` matches `\b(his|her|him|she)\b`, which is what stops it coming back.

- [x] **RESOLVED 2026-09-07, verified on production. `auth.sessions.ip` no longer records the signer — it records Vercel (found 2026-09-07).** Ahead of the two below on purpose: those are MISSING data, and missing data announces itself. This is MISLEADING data. Every production login since the switch to server-side sign-in carries an IP address that looks like an ordinary record of where somebody signed in from, and means nothing.

  The cause is not a bug, it is a side effect of a deliberate change. Login moved out of the browser and into `POST /auth/sign-in` so that an unforgeable attempt count could exist for rate limiting (that route's own header states it: "LoginForm.tsx used to call it directly from the browser"). Supabase therefore sees the Vercel serverless function, not the visitor: the recorded IP is the function's, the user agent is `node`, and the Referer is the site's own origin.

  It is worse than one wrong constant. The address varies per invocation — since 2026-09-06 the sessions table holds `18.204.19.96`, `98.83.218.118` and `35.178.201.118`, one session each — so the data reads as three different origins when all three are the same platform. Before the switch the same table held real signer addresses (`5.64.191.129`, `90.210.217.210`) and one genuine browser user agent, so a reader comparing old rows to new would conclude the estate had moved, not that the field had stopped meaning anything.

  This cost real time on 2026-09-07: a routine login by an athlete was investigated as a possible intrusion precisely because the recorded origin was an AWS address with a `node` agent, and it could only be resolved by reading the deployed route's source.

  Fix, and one trap in it. The route already has the caller's address in the request headers and can forward it. **`login_attempts` cannot be the destination**, and not for any reason that goes away once you look closer — checked directly on 2026-09-07, not inferred. It has no IP column at all (`email, org_id, attempt_count, lock_count, locked_until, last_attempt_at, created_at`), and more decisively `login_attempt_record_result` **deletes the row on success**: it tracks a failure streak, and a successful sign-in clears it. An IP stored there would survive only for logins that FAILED, which is the opposite of what is needed — the question this gap exists to answer is where a successful sign-in came from. That is also why the table holding two rows is not a symptom of anything: it is the designed shape, and both functions are live.

  (An earlier draft of this item warned that `SUPABASE_SERVICE_ROLE_KEY` was never set in Vercel production, taken from the sign-in route's own header. That is out of date: `vercel env ls` on 2026-09-07 shows it set on Production, added five days earlier, and rate limiting is genuinely working. The route's comment still describes the old outage and should be corrected so it stops sending readers after a resolved problem.)

  So the fix needs a destination that survives a successful login: its own column on something that records successes, or forwarding the real address to Supabase on the sign-in call so `auth.sessions.ip` means what it says again. The second repairs the field people already read, rather than adding a second place they have to know to look.

  **BUILT AND DEPLOYED 2026-09-07.** The second option, and it works: GoTrue
  honours a forwarded address. Established before writing any of it, by creating
  a session through supabase-js with `X-Forwarded-For: 203.0.113.45` and reading
  `auth.sessions` back — it recorded `203.0.113.45/32`, and the forwarded
  `User-Agent` alongside, which repairs the other half of what made that
  investigation slow (`user_agent` reads `node` for every production login).
  Confirmed again against `createServerClient` from `@supabase/ssr`, which is
  the client the route actually uses, not just the plain one.

  `lib/clientAddress.ts` is where the trust decision lives, and it is the whole
  design rather than an implementation detail: a caller can send any
  `X-Forwarded-For` it likes, so forwarding one blindly would replace a value
  that is merely uninformative with one an attacker chooses — strictly worse, in
  the one table anybody reads after a suspected intrusion. Platform headers
  (`x-vercel-forwarded-for`, `x-real-ip`) are preferred because Vercel writes
  them and a caller cannot; failing those it takes the LAST entry of
  `x-forwarded-for`, not the first, because proxies append the peer they
  received from so the rightmost hop is the trustworthy one; and anything that
  does not parse as an IP literal is discarded. When nothing survives, nothing
  is forwarded and the behaviour is exactly what it is today.

  **CLOSED. A real password sign-in on fydr.app at 16:04 on 2026-09-07 recorded
  `90.210.217.210` and a Mozilla user agent.** Every session before it reads
  `node`, across four distinct addresses — the symptom this item described,
  visible one line above the fix in `scripts/verify-audit-trail.mjs`'s output.

  **A second route was missed on the first pass and is also fixed.**
  `/auth/confirm` creates sessions server-side too, so every invite acceptance,
  password reset and magic-link sign-in was still recording the function — and
  an invite acceptance is the FIRST session a new club's account ever has. Found
  by writing the verification script rather than by review. The test now sweeps
  for routes calling verifyOtp / signInWithPassword / exchangeCodeForSession
  instead of listing the ones known at the time.

- [x] **DIAGNOSED AND FIXED 2026-09-07 (migration 0087), awaiting push. A failed sign-in records nothing in `login_attempts` on scratch.** The symptom was right and the cause was not where it looked.

  **`service_role` could not execute the functions.** 0048 creates `login_attempt_gate` and `login_attempt_record_result`, grants the TABLE to service_role, and then revokes EXECUTE on both FUNCTIONS from public, anon and authenticated — correctly, and its own comment explains that CREATE FUNCTION grants EXECUTE to PUBLIC by default here so the revoke must be explicit. But nothing grants EXECUTE back to service_role, which held it only THROUGH the PUBLIC grant just revoked. The functions ended up executable by their owner and nobody else, including the application.

  Measured on both databases, 2026-09-07:

  | | `login_attempt_gate` ACL | behaviour |
  |---|---|---|
  | scratch | `postgres=X/postgres` | calling as service_role → **42501 permission denied**; three failed sign-ins through the real route → 0 rows |
  | production | `postgres=X/postgres \| service_role=X/postgres` | **229 inserts over 45.5 days** against 372 sessions — working |

  **So production works only because somebody granted it by hand, and no migration records it.** That is the actual defect, and it is worse than the scratch symptom: the repository is not the source of truth for a security control, so rebuilding production from these migrations — or standing up any new environment — silently ships with no rate limiting at all.

  **Why it hid for months.** `/auth/sign-in` fails open on purpose: a limiter that errors is logged and the sign-in continues, because rate-limiting infrastructure breaking should degrade to "not currently rate limited" rather than "nobody can sign in". That is the right call, and it makes a limiter that has never once run indistinguishable from a healthy one with nothing to do. The only difference was a line in the function log — `login_attempt_gate unavailable, proceeding without rate limiting` — which is what finally identified it.

  0087 grants EXECUTE to service_role and to nobody else; anon and authenticated stay revoked, since the gate would let a caller enumerate locked-out emails and `record_result` is the table's only writer. Applied to scratch and confirmed: the same three failed sign-ins now produce `attempt_count: 3`. It is a **no-op on production**, which already has the grant — its purpose there is to put it in the history.

  `scripts/test-service-role-grants.ts` derives the rule from the code rather than a list: whatever the app calls through the admin client must carry a service_role grant in a migration. `npm run verify:login-attempts` answers "is it recording" on either database, using `n_tup_ins` — because the table deletes on success, so a row count cannot tell a healthy limiter from one that has never run.

  The original entry follows.

- [x] **As first written.** Noticed while smoke-testing the sign-in route for audit item 1, and confirmed NOT to be caused by that change: with the change stashed, a POST to `/auth/sign-in` with a wrong password returns 401 with the right message and leaves `login_attempts` at zero rows, exactly as it does with the change applied. So this is pre-existing.

  It is not the "record_result deletes on success" behaviour that makes the table look empty — that explains an empty table after SUCCESSES, and this was a failure, which is the case the streak exists to count. Both `login_attempt_gate` and `login_attempt_record_result` exist on scratch, and `SUPABASE_SERVICE_ROLE_KEY` is present in the environment the dev server loaded, so neither the missing-function nor the missing-key explanation applies.

  Why it matters: the route is designed to fail open (rate-limiting infrastructure breaking should degrade to "not currently rate limited", not "nobody can sign in"), which is the right call and also means a silently non-recording limiter looks exactly like a working one from outside. The to-do entry above states production's `login_attempts` holds live rows, so this may be scratch-only — worth confirming on production before assuming the limiter is doing anything there either.

  Not investigated further on purpose: found mid-way through audit item 1, which was being worked one at a time.

- [x] **RESOLVED 2026-09-07 for ten tables, all verified on production (0085 then 0086). Injury creation and availability changes write nothing to `audit_log` (found 2026-09-07).** Widening was the remaining work when this was first marked and it is now done; the ~40 tables still unaudited are a further sweep, not this item's residue. Proven on production during an incident review, not inferred: an injury and an availability row were created on production at 12:10:44 and 12:10:59 on 2026-09-07, and `audit_log` held **no user actions at all** for that day — six rows, every one an overnight job (compliance expectations 02:05, retention preview 03:15, thresholds evaluated 04:30, each twice, once per org). There was no actor, no role, no IP and no origin recorded for either write.

  Why it matters more than the missing rows did: those two writes could not be attributed to a client. The account was known from `reported_by`, but nothing recorded WHERE the write came from, and at that moment a dev server on localhost was pointed at production while the deployed app was also live — so the same credentials worked from two places and the log could not tell them apart. An injury is exactly the record this table exists to cover: `audit_log` already carries actor, role at time of action, entity, athlete, metadata and IP, and it is what a club would be asked for if a clinical record were ever disputed.

  Scope: at minimum injury create/update (including status changes and closing an injury) and every availability change. Check the same for `injury_clinical`, which is the medic-only detail and currently unaudited as far as this review went. Worth a sweep of which write paths audit and which do not, rather than fixing these two and assuming the rest are covered — the same "the count was an undercount" pattern this project has hit repeatedly.

  Note the deletion side too: the two rows were removed on 2026-09-07 by a direct superuser connection, below the application layer, so nothing logged the removal either. The app itself cannot delete an injury at all — `injuries` has a `deleted_at` column and no DELETE policy — so any hard delete will always be invisible to the audit trail unless it is done through a path that writes one.

  **THE SWEEP, done 2026-09-07: 4 write paths reach `audit_log` and 105 do not.**
  The suspicion in the paragraph above was right and understated. Unaudited
  alongside `createInjury`, `updateInjuryFields`, `upsertClinical` and
  `setAvailability` are roughly a hundred more across fifty tables — every
  session, group, programme, threshold, leaderboard, consent and weigh-in write.
  The four that do audit are `settings/users/create`, `bulk-invite/send`,
  `recordAttendance` and `applyTemplate`, each hand-rolled, no shared helper.

  **Two findings changed the fix.** First, `audit_log`'s insert policy is
  `org_id = auth_org_id() AND actor_id = auth_user_id()`, and the mutations in
  `src/lib/queries` run IN THE BROWSER through the anon key — so an audit row is
  written by the same client doing the thing, which chooses the action, the
  metadata, and whether to write at all. A self-reported trail is advisory.
  Second, 105 call sites is 105 places to forget, and new ones arrive weekly.

  **BUILT AND DEPLOYED 2026-09-07 as migration 0085: audited by trigger.**
  Fires whichever path wrote, cannot be skipped by a client, one place instead
  of 105 — and it gets a REAL client address, because the browser talks to
  PostgREST directly so `request.headers` carries the visitor rather than a
  serverless function. That is the exact inverse of the `auth.sessions.ip`
  item above, where our own server was the caller.

  Three tables to start, on Isabella's call — `injuries`, `injury_clinical`,
  `availability` — proving the pattern before widening by table.

  Details worth knowing before widening: `injury_clinical` has neither an `id`
  nor an `athlete_id` (its key is `injury_id`, and the athlete is reachable only
  through the injury), so the trigger is generic over the row shape rather than
  written against one. `metadata` records WHICH fields changed and never their
  values, because `audit_log` is sport-scientist readable and clinical detail is
  separately gated (CLAUDE.md rule 3). A no-op update writes nothing. The role
  is chosen by the same precedence `lib/access.ts` uses, and the two lists are
  asserted equal so the trigger and a route cannot disagree about who acted.

  Verified against scratch through RLS, 16 pgTAP assertions plus 17 in
  TypeScript. The deletion caveat in the paragraph above still stands unchanged:
  a superuser connection bypasses triggers as completely as it bypassed the app.

  **CLOSED ON PRODUCTION 2026-09-07.** Creating one injury as the medic
  r.callaghan produced FOUR audit rows at 16:09, which is the useful part:
  `injuries.insert`, `availability.update` (closing the standing row),
  `availability.insert` (opening the new one) and `injury_clinical.insert`.
  One clinical action is four writes, and it is the exact shape of the incident
  that prompted this item — an injury and an availability row seconds apart,
  which at the time left nothing at all. All four carry actor, role medic, the
  athlete and the real client address; the disclosure check confirmed no
  clinical value reached the metadata.

  **WIDENED AND DEPLOYED 2026-09-07 as migration 0086: ten tables now.**

  **How all three above were confirmed, and by whom.** Isabella ran `db:push`
  for 0085 and 0086 against production herself and re-ran
  `scripts/verify-audit-trail.mjs`, which passed against real production data
  for both — not against a fixture and not on scratch. The script is read-only
  (`begin; set transaction read only`) and excludes its own probe agents by
  name, so a pass is a statement about real sign-ins and real clinical edits,
  not about its own traffic. The sign-in forwarding above rode the same day's
  application deploy and is what the script's session check reads.

  **What the passing run also established, which is why it has its own item
  below:** the trail is now attributable but not durable. `auth.sessions` holds
  live sessions only, and production showed 372 inserts against 362 deletes
  over 45 days — so roughly 97% of sign-ins have already left no trace. A
  passing check here does not mean sign-in history exists.
  The seven named above joined the original three. It was NOT mechanical, which
  is the useful finding: two of the seven had shapes the function had never met,
  and neither would have failed loudly — both would have written a row with a
  null where the answer goes, exactly as injury_clinical would have.

  * `athletes` has no `athlete_id` column, because the row IS the athlete. The
    one field saying who a roster change concerns would have been null.
  * `user_roles` has none either, and correctly — a role grant is not about an
    athlete. But `audit_log` has no column for the USER a grant concerns, so the
    row would have said somebody's roles changed without saying whose or to
    what, in the table that grants privilege.

  So `metadata` gained an identity allowlist of exactly two keys, `user_id` and
  `role`. The disclosure rule is unchanged and now asserted across all ten
  tables rather than the clinical three: metadata may carry identity, never
  content. Adding a third key needs the same argument, which is why it is an
  explicit list rather than a heuristic.

  Verified against scratch through RLS with a real write to every one of the
  seven — attachment checks would have proved they were created, not that they
  record anything useful. 13 new pgTAP assertions, 1758 across the full suite,
  all passing.

  **STILL REMAINING:** roughly forty tables from the sweep are unaudited. The
  ones done are the write paths a club would be asked about; the rest are
  lower-stakes (scheduling, programme authoring, thresholds, leaderboards) and
  can go in batches now that two shape surprises in ten tables suggest the
  function will keep meeting new ones.

- [ ] **HIGH PRIORITY, and a SECOND, DIFFERENT blindness from the `audit_log` item above: Supabase's own `auth.audit_log_entries` is empty (found 2026-09-07).** Measured on both projects on the same day: production has **0** rows in `auth.audit_log_entries` against 11 rows in `auth.sessions` and 46 in `auth.users`; scratch has **0** against 6 sessions and 44 users. So it is not something about production, and it is not that nobody has signed in — sessions are being created and recorded, and the auth audit table beside them is not.

  These are two separate systems and both are currently blind, which is why this is its own item rather than part of the `audit_log` one. `public.audit_log` is the APPLICATION's trail — who did what to an athlete's record, written by our own code. `auth.audit_log_entries` is SUPABASE'S trail — sign-ins, sign-outs, token refreshes, password changes, recovery requests — written by GoTrue, not by us. Fixing the first does nothing for the second. Together their absence means that during the 2026-09-07 incident the only surviving evidence of who signed in was `auth.sessions`, which holds a row per session with an IP and user agent and **no action history at all** — no record of what any of those sessions then did, and no record of sign-ins that did not create a durable session.

  What to establish first, before assuming it is a bug: whether Supabase prunes this table on the current plan (a retention window would explain an empty table without anything being misconfigured), whether it needs enabling, and whether the hosted dashboard's Auth logs are populated independently of it — the dashboard viewer may retain data this table does not. If the dashboard has the history and the table does not, the fix is knowing where to look rather than changing anything. If neither has it, this is a real gap in the only trail that can answer "who signed in".

  **PRUNING RULED OUT, 2026-09-07, on scratch. It is not being cleaned up — it
  is never written to.** `pg_stat_all_tables.n_tup_ins` for
  `auth.audit_log_entries` is **0** across a statistics window of 12 days 19
  hours, during which `auth.sessions` took 174 inserts and 150 deletes and
  `auth.refresh_tokens` 186 and 160. A retention window leaves inserts followed
  by deletes, exactly as those two do; this leaves nothing at all. The counters
  demonstrably work, and a sign-in made during the check added no row either.
  Counting live rows cannot tell those two cases apart, which is why the item
  had been stuck on "empty".

  That closes the first of the three questions and moves the other two: whether
  GoTrue needs the table enabled (a Supabase-side configuration question, not
  something in this repository), and whether the dashboard retains the history
  independently (still needs the dashboard).

  `scripts/verify-audit-trail.mjs` check 3 makes this reproducible on either
  project, read-only. It prints the statistics window alongside the counts,
  because a zero over a short window means nothing, and it reports INCONCLUSIVE
  rather than a pass when the window carries no session inserts to compare
  against.

- [x] **BUILT 2026-09-07, Run-verified on scratch, awaiting deploy. There is no sign-in HISTORY (raised 2026-09-07).** The recommendation below was taken as written; what follows it is what building it actually found.

  **Scope was four session-creating sites, not the two this item assumed.** Swept rather than listed, and the sweep is the reason: the password RESET establishes its session in the browser (PKCE, and often exchanged by the SDK's own URL detection before any of our code runs), so it reaches the app through no server route at all. That is the flow that matters most — completing a reset from a stolen mailbox is the account-takeover path — and it would have been the one left unlogged. It gets `/auth/record-sign-in`, a small route it posts to, rather than writing from the browser: the browser holds a valid session and would pass the RLS policy, but a page cannot know its own public address, so every reset would have been the single row in this table with a null IP. The fourth site, `ChangePasswordForm`'s re-authentication, is exempted in writing — it creates a session but is not a sign-in, and recording it would read back as somebody signing in twice who never left.

  **The insert policy refuses what the column allows, which shaped the code.** `audit_authenticated_insert` is `org_id = auth_org_id() and actor_id = auth_user_id()`, and `org_id = NULL` is not false but NULL — so refused — even though the column is nullable and 0007's own comment says why it is. Since the caller fails open, a swallowed 42501 would look exactly like a successful write, so the row is refused in our code instead of sent and lost. No row now means no row was attempted.

  **Verified end to end on scratch, not asserted.** Sign-ins through the real route recorded the forwarded visitor address (203.0.113.77) rather than the server; an athlete signed in and was recorded as role `athlete`, which is the majority case and the one the incident was about; a FAILED sign-in recorded nothing. Then the `auth.sessions` row was deleted — exactly what expiry does on its own — and **the audit row survived it intact**, with a subsequent UPDATE refused by the append-only trigger. All three rows show on the audit screen, and `session` appears in its entity-type filter without the viewer being touched.

  The sweep runs in `prebuild` and was proved to have teeth: a planted session-creating route with no logging fails it, and so does a rubber-stamp exemption carrying no real reason.

  **Still open, deliberately not bundled:** failed sign-ins leave nothing durable. `login_attempts` tracks a failure STREAK and deletes the row on success, so it answers "is this account being brute-forced right now", not "who tried and failed last month". Separate decision.

  The original recommendation, which was followed, is kept below.

- [x] **BUILT 2026-09-07, Run-verified on scratch, awaiting deploy. A FAILED sign-in leaves nothing durable either.** Decided in favour of the service-role write into `audit_log`; the reasoning that was put to Isabella is kept below, and what building it settled is here.

  **The deciding argument was the schema's own comment.** `0007:26` reads "Nullable: a platform support access or **a failed sign in** has no organisation yet." The column was made nullable for this row; only the insert policy blocks it. A service-role write uses the schema as designed rather than working around it, and no anonymous caller gains write access to `audit_log` — which the policy alternative would have cost permanently, for a caller who controls the rate.

  **The cost, stated rather than glossed:** this is the first `audit_log` row the database does not check. One call site, a constant action, and 0007's append-only triggers still apply — but it is trusted where every other row is verified.

  **Two things building it settled that the recommendation had left open.**

  * **Only accounts that exist get a row.** Not only because an unmatched email is attacker-controlled text going into the table whose job is being true, but because `lib/queries/auditLog.ts` filters every read by `org_id` — so a row with no org could never be seen in the app meant to surface it. An unknown address stays `login_attempts`' business.
  * **Volume needs no streak logic.** The recommendation proposed writing only on streak boundaries. Unnecessary: once the fifth failure locks the account, `login_attempt_gate` returns 429 **before** `signInWithPassword`, so no further rows are written. Verified — six failures produced five rows and then nothing. The lockout is the rate limit.

  **`actor_id` is the account somebody tried to reach, and is claimed rather than proven** — the sign-in failed, so nothing establishes they are that person. Recorded anyway because "what happened around this account" is the question a review asks, and the viewer's actor filter is how it gets asked. `actor_role` is null: nobody acted. `entity_type` is `sign_in`, not `session`, because no session exists to point at.

  Run-verified: three failures wrote three rows with the forwarded visitor address and the streak position (`attempts_remaining` 4, 3, 2); an unknown email wrote nothing; a success still wrote `auth.signed_in`; six failures recorded 4/3/2/1/0 with the last marked `locked`.

  The reasoning as it was put follows.

  **Not the same as the open finding further up.** That one says a failed sign-in records nothing in `login_attempts` on scratch, which is a bug — the limiter may not be running there at all. This is about what happens when `login_attempts` works exactly as designed, which on production it does.

  **The design deletes the evidence, on purpose.** `login_attempt_record_result` **removes the row on success**. The table tracks a failure STREAK so the backoff can escalate, and clearing it on a good password is what stops yesterday's typo locking somebody out today. That is right for rate limiting and it means the table answers "is this account being brute-forced right now" and cannot answer "who tried and failed last month". There is no IP column either — the schema is `email, org_id, attempt_count, lock_count, locked_until, last_attempt_at, created_at` — so even mid-streak it does not record where the attempts came from.

  So the sign-in trail is now durable and attributable in one direction only. `auth.signed_in` says who got in, from which address, on which browser. Nothing says who tried and did not, and a run of failures against a real account followed by a success is the shape of the thing somebody would actually want to find afterwards — and it is the half that currently vanishes.

  **Recommendation, if it is wanted: `auth.sign_in_failed` in `audit_log`, beside the success.** The same table, the same dotted action convention, `clientAddress()` already resolving the caller in the same route. It costs one more write on a path that already writes one.

  **But it does NOT fit the existing insert policy, and that is the whole difficulty.** `audit_authenticated_insert` is `org_id = auth_org_id() and actor_id = auth_user_id()`, and a failed sign-in has neither: there is no session, so `auth_org_id()` and `auth_user_id()` are null and the row is refused. Three ways out, and they are not equivalent:

  * **Write it with the service role**, from the route, bypassing RLS. The route already holds `createAdminClient()` for the rate limiter, so nothing new is introduced. But it is the first row in this table written by something the policy does not check, which weakens a guarantee currently worth having.
  * **A separate policy for anonymous inserts** restricted to `action = 'auth.sign_in_failed'` and a null actor. Narrow, checkable, and a policy on the one table whose job is being true — which is also the argument against, since it is the first policy that lets an unauthenticated caller write to it at all, and the caller controls how often.
  * **A different table entirely**, `sign_in_failures`, with its own retention. Keeps `audit_log`'s guarantees untouched at the cost of a second place to look.

  **Rate limiting is the real question underneath**, whichever is chosen: an unauthenticated writer means anybody can grow the table by failing to sign in. `login_attempts` already knows the streak, so writing only on a streak boundary — say the first failure and each lockout — records the shape of an attack without recording every keystroke of it.

  **Not started, and deliberately not bundled with the sign-in-history work** — that item is closed, deployed and verified, and this needs a decision about the policy before any of it is buildable.

  **The gap, measured on production.** `auth.sessions` holds a row per LIVE session and nothing else. Over a 45-day window it took **372 inserts and 362 deletes**: roughly 97% of all sign-ins have already left no trace whatsoever, and the ten rows that survive are simply the ones not yet expired. `auth.audit_log_entries` would have been the durable record of sign-ins, sign-outs and token refreshes, and it has never received a single row on either project — that is a Supabase-side configuration question and not something this repository can fix.

  So the question "who signed in, and when" is answerable for about a week and unanswerable before that. That is precisely what could not be answered on 2026-09-07, when a single athlete sign-in had to be reconstructed from a surviving session row and the deployed route's source.

  **What is NOT the gap any more, so it does not get re-solved.** Sessions that do survive now carry the real signer's address and browser (fixed the same day). Ten tables write an attributable `audit_log` row for what somebody then DID. The hole is specifically the sign-in event itself.

  **Recommendation: write our own row to `public.audit_log` on every successful sign-in.**

  Not a new table. `audit_log` already records reads as well as writes — `injury_clinical.read`, `report.athlete.view`, `report.training.view` are all in there — so it is the "who did what" trail rather than a write log, and a sign-in belongs beside the actions it made possible. It is already append-only at the database (three triggers refuse UPDATE, DELETE and TRUNCATE), already sport-scientist readable, and already carries actor, role, IP and org. A second table would need all of that built again and a second place to look.

  Shape: `action` = `auth.signed_in`, matching the existing dotted convention; `entity_type` = `session`; `org_id`, `actor_id` and `actor_role` from the claims the fresh session carries; `ip_address` from `lib/clientAddress.ts`, which already exists and already resolves the caller safely. Both routes that create a session need it — `/auth/sign-in` and `/auth/confirm` — and the test that sweeps for session-creating routes is already written and would catch a third.

  **It must fail open.** The sign-in route already degrades to "not currently rate limited" rather than "nobody can sign in" when its rate-limit calls fail, and an audit write deserves the same treatment: a logging failure must never cost somebody their sign-in.

  **Considered and rejected: a trigger on `auth.sessions`.** It would be unskippable in the way the clinical triggers are, and it is the obvious symmetry. But `auth` is Supabase's schema, not ours: a trigger there is outside the migration history they manage, and is the kind of thing that survives until it silently does not across a platform upgrade. An app-level write is self-reported in a way a trigger is not, and that is a real weakness — but at sign-in there is no honest alternative we control.

  **Known limitation to accept with it:** failed sign-ins still leave nothing durable. `login_attempts` tracks a failure STREAK and `login_attempt_record_result` deletes the row on success, so it answers "is this account being brute-forced right now", not "who tried and failed last month". Worth naming as a separate decision rather than bundling — and note the open finding above that a failed sign-in currently records nothing in `login_attempts` on scratch at all.

  Cost: perhaps an hour, one route change each side plus assertions. No migration.

  Concrete trigger for this: a programmatic sign-in as the athlete `j.barnes@ashcomberfc.example` at 10:49:51 on 2026-09-07 from 18.204.19.96 (AWS), user agent `node`, session created and never used again. Nothing in this repository accounts for it — no `vercel.json`, so no declared crons; the overnight jobs are SECURITY DEFINER Postgres functions that never authenticate; and the only script that signs in with a password targets scratch. It could not be attributed because there was no auth audit trail to attribute it with. Note that `node` sign-ins from cloud IPs are the NORM here, not the exception — of every session in production's history, exactly one came from a browser.

- [ ] **APPROVED AND QUEUED 2026-09-07: build the platform-level view. Sign-in attempts against emails that match no account are recorded nowhere.** Isabella chose the platform view over an org-less read path in the existing viewer, which is the shape argued for below.

  **Scope as approved:** a platform-level view, gated by `isPlatformStaff()`, showing attempts against addresses that belong to no organisation — so enumeration patterns are visible ACROSS clubs rather than invisible or wrongly scoped to one tenant.

  **Two things to settle while building, both raised below and neither decided:** what is stored in place of the raw attacker-controlled email (hash, truncation, or the address itself behind the platform gate), and whether the write happens on every unmatched attempt or only on a streak boundary — noting that the lockout does NOT bound this case the way it bounds the known-account one, because `login_attempts` keys on an email that will never succeed and so never clears.

  Standard: tests first, Run-verified, screenshot of the view before finalising, tell her before deploying.

  The original scoping follows, and the reasoning in it is what was approved.

  **What happens today.** `/auth/sign-in` writes `auth.sign_in_failed` only when the submitted email resolves to a real account. An attempt against an address the database has never heard of leaves no durable trace at all — `login_attempts` keys on the email and would hold a streak, but it deletes on success and carries no IP, so it answers "is this address being hammered right now" and nothing afterwards.

  **Why it was left out, and the second reason is the one that decides it.** The submitted email is attacker-controlled, so writing an unmatched address verbatim would let anybody put arbitrary text into the table whose job is being true. That alone could be handled — hash it, truncate it, store a boolean. The real obstacle is that such a row has no organisation, and **`lib/queries/auditLog.ts` filters every read by `.eq('org_id', orgId)`**. An org-less row is not a quiet record; it is an invisible one. Writing rows into the one table nobody can read them from would be worse than not writing them, because it would look like coverage.

  **So it needs somewhere to be seen before it needs to be written**, which is what makes it a feature rather than a line of code. Two shapes:

  * **A platform-level view.** `src/lib/platformStaff.ts` already exists — `isPlatformStaff()` against a `FYDR_PLATFORM_EMAILS` allowlist — so there is already a notion of somebody who is not a tenant. Cross-org sign-in failures are genuinely platform data rather than any one club's: an address that belongs to no organisation cannot sensibly appear in one organisation's audit log. This is the better fit.
  * **An org-less read path in the existing viewer**, showing rows with a null `org_id` to sport scientists. Cheaper, and wrong in a multi-tenant product: it would show every club the attempts made against every other club's non-existent addresses.

  **What it would actually be for**, so the design has a target: detecting enumeration — one address tried across many clubs, or many addresses tried from one IP. Neither question is answerable per-organisation, which is the same argument for the platform view arriving first.

  **Not urgent.** `login_attempts` still rate-limits these attempts in real time and the lockout still applies; what is missing is the history, and only for addresses that do not exist. Attempts against real accounts are fully recorded as of today.

- [ ] **D-24 resolved, 2026-09-05, real build work**: running distance and high intensity efforts added to the GPS import's accepted upload headings, twelve columns now instead of ten. Both were already rankable leaderboard measures with real data (512 of 597 rows) that could never be updated through the import screen, they'd have gone silently stale. Update the parser and the on-screen column list together.
- [ ] **Decided, 2026-09-05, resolves part of D-18**: quiet hours for notifications. A start time and an end time per person, no notifications delivered in that window. Database columns already exist (`notificationPreferences.ts:20`); no screen sets them yet. Deferred, not urgent, but decided in principle.
- [ ] **Decided, 2026-09-05, needs code verification**: only sport scientist and coach may create, edit, or delete a squad group. Medic, S&C and nutritionist stay view only. This is the agreed model already, but currently unenforced in the code across all three group screens (list, new, detail), real build work, not just documentation.
- [ ] **Unverified, 2026-09-05**: what actually happens today when a saved group filter cookie names a group that has since been deleted. Decided target behavior: fall back silently to no filter, show everyone, same as the existing no-groups state, no error, no message. Someone with code access needs to confirm current behavior against this before it can be marked done.
- [ ] **Resolved, 2026-09-04**: medic gets full log-and-correct access to test results, the same as sport scientist, coach, and S&C, not view-only as previously planned. Testing sessions can be created and completed by any staff role except the nutritionist, who stays excluded under D-01.
- [ ] **D-41 resolved, real build work**: changing a test's direction now recalculates every personal-best flag for that test retroactively, across all past results, with an explicit warning before the edit applies. Currently silently allowed with no recalculation and no warning.
- [ ] **Addendum, 2026-09-04**: Timetable also gets a link from the dashboard, not just the schedule. Two entry points, neither in the sidebar.
- [ ] **Build order, per the specification document's own stated logic**: fix the role model (G-02) and the GPS duplicate-row bug (G-25) together first, the injury gate fix depends on the role model existing. Credential handling (G-03) next, cheap and independent. Everything else after.
- [ ] **G-03 resolved, 2026-09-05, real build work**: temporary passwords removed entirely from both the single and bulk account-creation paths, not just force-changed. Every new account, athlete or staff, is sent a link instead; using it is how the person sets their own password and proves they own the address. No password is ever generated, emailed, or shown on screen.
- [ ] **New, 2026-09-05, follow-up to G-03**: confirm a mail provider key is configured in production before relying on this. If it isn't, invite links are silently undeliverable on both paths and a club would have no way to tell. Check this before the first real club goes live.
- [ ] **New, 2026-09-05, real build work**: granting a staff role that would combine with the nutritionist role now warns first, naming exactly what the person will be able to see, injury data included, before the grant is confirmed. Resolves D-25, applies on the individual user's role-management screen.
- [ ] **D-42 / G-25, live bug**: re-uploading a GPS file duplicates every row, no unique constraint stops it. Corrupting real club data right now. Fix: unique constraint on athlete/date/session, import should replace not insert.
- [ ] **D-01 / G-01, highest risk in the spec**: four injury screens have no role-specific gate. Harmless today only because nutritionist currently equals coach. Becomes a real leak of restricted injury data to nutritionist the moment the five-role split ships. Depends on G-02 first.
- [ ] **D-22 adopted, real build work**: both readiness calculations are kept, but the Analytics screen's stricter version needs its own distinct label ("Complete-day readiness") instead of plain "Readiness," and the incorrect internal code comment claiming the two match needs correcting.
- [ ] **D-02, agreed but not built**: Analytics should be sport scientist only, not even S&C, coach, medic, or nutritionist. Tightest role restriction of any screen. Right now every staff role currently reaches it.
- [ ] Don't blanket-approve batches of Claude Code recommendations that mix cosmetic fixes with access-control changes. Review D-01 and D-07 individually before either is built, both touch who can see medical data.
- [ ] **Verification task, not a product decision**: a code comment on the Squad weekly report references a "planned ACWR column" that wasn't built, but the screen as specified already shows an ACWR ratio column. Either the comment is stale, or it refers to a second column that never made it in, Claude Code should check the actual code before anyone signs off on this screen.
- [ ] **Verification task, not a product decision**: confirm editing a template stays safe for weeks already built from an older version of its shape. The version number on stored shapes suggests this was anticipated, worth Claude Code actually confirming it works rather than assuming.
- [ ] **Specific bug, not just the general D-06 gap**: the New week template screen's real access check gates on "coach or medical," not "coach or sport scientist." A medic can currently get in when they shouldn't be able to at all, and a sport scientist may currently be blocked when they should have full access. Looks like a leftover check from an earlier role system, needs fixing directly, the general role migration may not catch it automatically.
- [ ] **Confirmed live bug, New fixture screen**: if a coach's session has expired while filling out this form, submitting silently redirects to sign-in with no message and nothing saved. A guard exists in the code for this exact case and does not fire, this isn't a missing feature, it's a broken one that looks working on inspection. Fix the guard, don't just note its presence.
- [ ] **D-27, small fix**: deleting a session correctly refuses when GPS records, injuries, test results, or compliance data are linked to it, the database blocks it. But the coach only sees a generic error, not the "cancel it instead" message the other two link types already give. Extend the existing worded-refusal pattern to all six linked tables, not just two.
- [ ] **Decision, 2026-09-04, new feature**: wellness check-ins are expected automatically on any morning before a training day, not on rest days, derived from the schedule. Sport scientist can override per day in Settings, toggling which days a wellness report is asked for, independent of the automatic default.
- [ ] **Assumption made, needs confirming**: match days count as training days for wellness-expectation purposes, so a check-in is still expected before a match. Flag if that's wrong.
- [ ] **Settings is accumulating real requirements now, worth designing as one coherent screen rather than bolting on**: the wellness-day toggle, the compliance "under half" threshold (defaulting to 50%), the training-load verdict cutoffs (70/85/115/130%), the flag escalation window (defaulting to 24 hours), and now the nutrition day-type multipliers (training 1, match day 1.25, rest day 0.58). All sport-scientist or nutritionist-controlled, all belong in the same thresholds section.
- [ ] **Decision, 2026-09-04, new feature**: a nutrition plan can now be set for an athlete with no recorded weight. They get general, non-weight-specific guidance instead of being skipped, with a prompt that a weigh-in is needed to tailor it. Applies on both the nutrition authoring screen and the athlete nutrition screen.
- [ ] **Decision, 2026-09-04, new feature**: a dismissed flag can be reopened, by coach or medic, same permission as dismissing it. Real build work, not just documentation.
- [ ] **Decision, 2026-09-04**: the halves split for match GPS should be searched for in the vendor data first, not assumed to never exist, some vendors do include a genuine per-half breakdown. Shown when present, labelled absence otherwise.
- [ ] **D-11 resolved**: starting training-report verdict cutoffs are 70%, 85%, 115%, and 130% of typical, based on the same evidence-grounded sweet-spot logic already used for ACWR in this app, not a single agreed published standard for this exact comparison. Needs sport-scientist sanity-check once built.
- [ ] **Decision, 2026-09-04**: editing an existing leaderboard's measure now warns first, naming what it currently shows and what it's about to show instead. Same standard as the fixture-date, team-publish, and programme-edit warnings.
- [ ] **Decision, 2026-09-04**: "Retire a board" is renamed to "Delete a board" and made irreversible, unlike retiring elsewhere in this app. The confirmation must state explicitly that it cannot be undone.
- [ ] **D-05, agreed but not built**: only S&C and sport scientist should be able to create, edit, or delete leaderboards, coach, medic, and nutritionist should be view only. Same shape as D-03, D-04, and D-06.
- [ ] **Verification task, not a product decision**: D-24 says two rankable leaderboard measures can never be updated by any upload, a real technical gap if true. Claude Code should identify which two measures and why before this is treated as settled.
- [ ] **D-04, agreed but not built**: only S&C and sport scientist should be able to edit gym programmes, coach, medic, and nutritionist should be view only. Same shape as D-03 and D-06.
- [ ] **Decision, 2026-09-04, new feature**: a real delete action is added for exercises. Deleting one is refused with a named reason if any live programme still references it, same pattern as session deletion. No programme is ever left with a broken reference.
- [ ] **D-37 resolved**: editing a gym programme now warns first, naming how many athletes are currently assigned, before the change takes effect for all of them immediately. Same standard as the fixture-date and team-publish warnings.
- [ ] **Decision, 2026-09-04, reverses an earlier documented cut**: gym programme changes must now be versioned and recorded, not overwritten. Real build work, same pattern as nutrition rules. A programme edited mid-block needs to be comparable against what an athlete actually trained during that period.
- [ ] **D-03, agreed but not built**: only the nutritionist and sport scientist should be able to author nutrition plans, not coach, medic, or S&C. Right now any staff role can currently reach and edit the nutrition authoring screen. Same shape as D-06.
- [ ] **D-06, agreed but not built**: only coach and sport scientist should be able to edit the schedule, everyone else (medic, S&C, nutritionist) should be view only. Right now nothing enforces that, any staff role can currently edit the week.
- [ ] **Decision, 2026-09-04, scope expanded**: build one shared local-storage-then-sync foundation, not a one-off per screen. Priority order: append-only writes first, they're safe by construction, nothing to conflict with. Athlete GPS uploads, athlete wellness check-ins, attendance submission, injury problem reports.
- [ ] **Decision, 2026-09-04, resolved**: on conflict, the coach must confirm before an edit overwrites a server change made while they were offline, not last-write-wins. The confirmation must queue for their attention next time they're actively in the app, not interrupt as a popup the moment background sync happens, that's how people learn to dismiss it unread.
- [ ] **Decision, 2026-09-04**: add a manual "sync now" button, in addition to automatic sync, for coaches who want to force it once back on wifi. Needs visible status alongside it, pending change count and last successful sync time, otherwise the button is just a leap of faith with no feedback.
- [ ] Staff web app needs a service worker and real local storage (IndexedDB) for any of this to survive a dropped connection or reload, see the PWA note in section 3.
- [ ] **Decision, 2026-09-04, real schema change**: positional groupings (currently a hardcoded six-unit rugby mapping) become club configurable. Affects the athlete report picker and the positional comparison cards on the wellness and gym screens, all three use the same units. Needs a club-level groupings table, not a small edit.
- [ ] **D-31 resolved**: link the Timetable screen from the schedule (it currently has no link anywhere, not even the sidebar). Kept deliberately as a quick single-day view, not retired.
- [ ] **Naming clash to watch for**: there are now two different "sync" buttons in this spec, the offline-queue one that pushes local schedule/session edits up, and the one on Apply a week template that pulls compliance expectations down immediately. Make sure Claude Code builds these as two clearly distinct, clearly labelled controls, not one button quietly doing both jobs.
- [ ] **D-35 resolved, real permission tightening needed**: only a medic should be able to set availability or close an injury on the injury record screen. Currently coaches can do both, and the club's own seed data already says only the physio should. Enforce it, don't just document it. General availability for absences/rest stays coach-permitted elsewhere, unaffected.
- [ ] **D-34 resolved**: the Injuries screen stays deliberately out of the sidebar, reached only through the injury report and direct links.
- [ ] **Squad setup, spec'd 2026-09-05, not yet built.** A new screen, Add athlete, is fully specified: sport-scientist-owned, name/DOB/position/squad number/optional invite email, resolves D-16. No code exists for it yet, this is a build task, not a documentation gap anymore. One open product question before it's built: how should a transfer from another club already on the platform be handled, a fresh record or a link to the existing one?
- [ ] **Retention run isn't resumable or transactional (D-43), confirmed and decided open, 2026-09-05.** Categories are processed in sequence and the run stops on the first error, leaving earlier categories deleted and later ones untouched, permanently, with no record of exactly where it stopped. Decided not to fix this now, tracked here instead: either make the run resumable, or make it transactional so a mid-run failure rolls back rather than leaving a half-completed deletion. Relevant to the GDPR erasure work already on this list. This sits on the data retention screen, the only screen in the app that permanently deletes athlete data, which as of 2026-09-05 also requires a typed confirmation (the club name) rather than a button click before it runs.
- [ ] Decide retention period for athlete data after they leave a club — open question in the data model doc, same question as the compliance item below.

## 0f. Low priority, filed 2026-09-08 so it does not resurface as a surprise
- [ ] **`seed.sql` authors dates as offsets from `current_date`, so seeded data goes stale as a database ages.** Not urgent and not a bug — the seed is correct at the moment it runs. It is a property of any long-lived database seeded from it.

  **How it showed up.** All six open injuries carried an `expected_return` between 9 and 31 days in the past, because they were authored as `current_date + 5` (`seed.sql:603`) and seeded on 2026-08-06, 33 days before anybody looked. The athlete-facing return date is suppressed when it is in the past — deliberately, see `upcomingDate` in `src/lib/format.ts` — so the effect was that **no athlete saw a return date at all**, on either database. Corrected on both on 2026-09-08 by re-anchoring each date to a realistic window for its own diagnosis.

  **It will happen again**, on scratch and on production alike, because nothing re-anchors the dates as time passes. Anything authored relative to `current_date` drifts: injury onsets and returns, availability windows, fixture kickoffs, session dates.

  **What to actually do:** re-check the seeded dates before any demo, and before trusting a long-running scratch session for anything date-sensitive. The quick check is `select count(*) from injuries where status <> 'closed' and deleted_at is null and expected_return < current_date` — non-zero means the data has aged. Production is the one that matters if a club is ever shown around it, since all 46 accounts there are synthetic and the same drift applies.

  **Not proposed here:** changing the seed. Relative dates are the right authoring choice — a seed with fixed dates would be stale the day after it was written rather than a month later. The fix, if this ever becomes annoying, is a re-anchoring script rather than a different seed.

## 0g. Cosmetic, filed 2026-09-08 from the athlete restoration screenshot pass — Isabella confirmed neither blocks the deploy

- [ ] **The readiness area fill turns a two-day run of data into a solid sliver.** `WellnessChart`'s `area` prop was added on 2026-09-08 for the redesign reference ("a filled-area sparkline (was a bare line)"). It builds one closed path per value SEGMENT, which is right — a day the athlete did not submit leaves a gap in the fill exactly as it leaves one in the line, and closing the area across a gap would invent a reading. The problem is only at small segment sizes.

  **How it showed up.** James Barnes's My data on scratch: 9 of 28 days submitted, in two clusters. The SVG holds two area paths — one 76 units wide over nine points, one **13 units wide over two points** — and the second reads on screen as a detached blob sitting to the right of the plot, which looks like a rendering artefact. It is not: it is the data. Verified by reading the path geometry rather than by eye, because the eye said "bug".

  **Why the reference never showed it.** Screens 03/04 draw twelve contiguous days out of fourteen, so every segment there is long enough for the fill to read as an area.

  **The fix, if wanted:** skip the fill for segments below about three points and let them stay a bare line. The line is already drawn for every segment, so this is a filter on `areaSegments`, not new drawing code. One condition, one place.

  **Not proposed:** closing the area across gaps. That would flatter an athlete's consistency and is the exact invention the segmented path exists to prevent.

- [ ] **The gym session clock's `mm:ss` format has unbounded minutes, so a long session reads "177:19".** `elapsed()` in `GymSessionLogger` does `Math.floor(total / 60)` for the minutes field with no hours rollover. At 2h57m it prints 177 minutes, which is not a duration a reader can parse.

  **Pre-existing, and restored verbatim.** The clock was removed by the 2026-09-08 redesign and put back the same day when Isabella asked that no features be lost; the format came back exactly as it was, so this is not a regression. It is more visible now: the clock used to sit on its own small utility line and now sits on the progress row beside the set count.

  **How it showed up, including whose fault the data was.** The 177-minute session was opened by Claude, not by an athlete — `startOrGetSessionLog` creates a log the moment the page loads, and the page was loaded during the token audit three hours earlier. **The scratch row was left in place rather than tidied**, per the standing preference for fixing the app over repairing data. An athlete can reach the same state by forgetting to finish a session, which is why the format is still worth fixing.

  **The fix:** roll over to `h:mm:ss` past an hour. Worth deciding at the same time whether an hours-long open session should show a duration at all, or should say something about the session being left open — a gym session is 45 to 90 minutes by design, and three hours means something went wrong rather than that the athlete trained for three hours.

## 0h. Vertical rhythm on the athlete app, filed 2026-09-08 — measured, needs a decision before any fix

- [x] **SETTLED 2026-09-08 at 28px, after 14px was tried on a phone and read too tight.** The athlete body sits at `--gap-body: 28px`; Today stays at 16px. Measured on all eleven routes after the change.

  **28px IS WHAT EIGHT SCREENS ALREADY RENDERED BY ACCIDENT**, from a flex gap plus a per-block margin. So the visual outcome is what was signed off on 4 September — the difference is that it now comes from ONE place instead of producing 18, 26, 28, 32 and 40.5px across the app depending on which block happened to carry which margin. The reversal was a value change, not an undo: none of the removed margins came back.

  **Its own token, not `--gap-stack`.** That token is read by `.stack`, which 21 staff screens use, and by `.profile-grid`; moving it to 28px would have re-spaced the staff app. `--gap-body` is the athlete shell's alone.

  **TODAY'S OVERRIDE IS DELETED TOO. One rhythm, 28px, everywhere.** For one revision Today rendered 16px against everything else's 28px, which read as nearly half and was a wider inconsistency than the 16-against-14 it replaced. `.phone-body:has(> .wk-card) { gap: 16px }` is gone on Isabella's instruction. **28px is now the only distinct gap anywhere in the athlete app** — measured across all eleven routes, every gap on every screen.

  **THE SPEC SENTENCE THIS ALL IMPLEMENTED IS STALE IN BOTH HALVES.** It read "16px between body cards on Today, 14px everywhere else". The body is 28px and Today is no longer special. Neither figure survives, and no markdown screen spec states it — the claim lives in the docx §4 that `base.css` was citing, so **that document needs the correction, not a code change.** Recorded here rather than left for someone to hit.

  **The 14px attempt is kept below**, because everything it records about HOW the spacing was wrong still applies and the four traps it names are still traps.

  <details><summary>The 14px attempt, and the four things it got wrong before it worked</summary>

  **FIXED 2026-09-08. Isabella chose 14px. Every athlete screen now measures 14px between body blocks, and 16px on Today.** Verified by measuring all thirteen routes after the change, not by reading the diff:

  `today [16,16,16,16,16] · my-data [14,14,14,14] · me [14,14,14] · me/notifications [14,14] · me/leaderboards [14,14,14,14] · my-data/boards [14,14,14] · programme [14,14,14] · programme/nutrition [14,14,14,14,14] · check-in [14] · nutrition-check-in [14] · report-problem [14,14]`

  **What did it.** One rule states the invariant — `.phone-body.phone-body > * { margin-top: 0; margin-bottom: 0 }` — and 18 inline vertical margins were removed from the pages, because an inline style beats any rule. Three now-dead declarations were deleted outright: `.me-stats`, `.md-seg-track` and `.sheet-head`. `.nutr-meal-grid` keeps its 18px because `NutritionWorkspace` needs it on a staff screen; the reset neutralises it on the athlete side, and `check:athlete-spacing` pins that one entry so removing the reset shows up.

  **FOUR THINGS THE FIRST ATTEMPT GOT WRONG, all caught by measuring the rendered page rather than trusting the change.** Recorded because each is a trap the next person will meet:

  1. **`margin-block: 0` did not beat `margin-top: 18px`.** Logical and physical properties are different declarations resolving to the same side, so specificity does not cleanly arbitrate. The reset uses physical longhands now.
  2. **`.phone-body > *` is the same specificity as `.nutr-meal-grid`**, so source order decided and the class — defined further down the file — won. The class is doubled to make it (0,2,0). Do not "tidy" it back.
  3. **The parser missed the inline `margin` shorthand.** `me/notifications` had `style={{ margin: '4px 0 14px' }}` on a phone-body child, rendering 18px and 28px gaps while the guard called the screen clean.
  4. **The parser stopped at wrapper components.** `boards/page.tsx` wraps its body in `<LeaderboardVisibilityGate>`, which renders `{children}`, so a nested `stack` was a phone-body child at runtime. Capitalised tags are transparent to the parser now, which over-approximates on purpose.

  **And the guard failed the build on its own stale expectation** once the rule changed from `margin-block` to the longhands. That is the behaviour working: it is how the mismatch was noticed.

  </details>

  Original entry follows.

  <details><summary>As filed</summary>

  **Eight of the ten athlete screens do not render the spacing the stylesheet says they should, and the gaps range from 14px to 40.5px where 14px is intended.** Measured on production in a real athlete session, not read off the CSS.

  **THE CAUSE IS ONE LINE OF LAYOUT.** `.phone-body` is `display: flex; flex-direction: column; gap: var(--gap-stack)`, so the shell already supplies the space between body blocks. Flex children do not collapse margins, so any block that ALSO sets `margin-top` adds to the gap: `gap 14 + mTop 14 = 28`. Where the preceding block carries a `margin-bottom` as well, that adds too.

  | Screen | rendered gaps | intended | |
  |---|---|---|---|
  | Today | 16, 16, 16, 16, 16 | 16 | correct |
  | Programme | 14, 14, 14 | 14 | correct |
  | Me | 28, 28, 28 | 14 | 2x |
  | My data | 18, 26, 28, 28 | 14 | mixed |
  | Me -> Notifications | 18, 28 | 14 | mixed |
  | Me -> Leaderboards | 26, 28, 28, 24 | 14 | mixed |
  | My data -> Boards | 26.5, 40.5, 24 | 14 | up to 2.9x |
  | Programme -> Nutrition | 25, 14, 40.5, 36, 28 | 14 | worst spread |
  | Report a problem | 26, 34 | 14 | mixed |
  | Nutrition check-in | 26 | 14 | 1.9x |

  Today and Programme are clean for the same reason: no child sets a margin. Today's 16px is deliberate and documented — `.phone-body:has(> .wk-card)`, selected off the week card because Today is the only screen that has one.

  **NUMBERS THAT DO NOT ADD UP, said so rather than smoothed over.** The 40.5px and 36px readings exceed `gap + margin-top`. The probe only read the FOLLOWING child's margin-top, so those two are under-explained by the table: the remainder is a `margin-bottom` on the preceding block. Anyone fixing this should measure both sides, not just the one the table shows.

  **SCOPE.** 17 inline `marginTop` declarations across the athlete pages, plus `.me-stats` in CSS. Two arrived with the 2026-09-08 redesign — `.md-seg-track { margin-top: 4px }` and the `md-more` footer card's `marginTop: 14` — and the rest predate it. Athlete rules currently run 156 raw spacing values against 11 token reads.

  **WHY IT DRIFTED INVISIBLY — now closed.** There was no spacing guard.
  `check:control-radius` fails the build on a raw radius anywhere near a
  control; nothing checked that a direct child of `.phone-body` adds no margin
  of its own. **`check:athlete-spacing` now does, and is in `prebuild`.**

  It deliberately does NOT enforce a number, because that is the open decision
  below. It pins the SET of 25 offenders, so the problem cannot grow while the
  decision is pending, and fails in BOTH directions: a new offender is a
  regression, and a removed one means the fix landed and the baseline is stale.
  Verified against three planted failures — a new margin on Programme (the clean
  screen), a pinned offender removed, and `.phone-body` losing its gap — each
  exiting non-zero.

  Identifying a direct child of `.phone-body` from source needed a small parser
  (`scripts/lib/phone-body-children.mjs`), and it was **validated against the
  live DOM rather than trusted**: it reproduces the measured children of Me and
  My data exactly. That comparison caught two bugs in it — taking the file's
  first `return (` instead of the default export's, which reported My data as a
  single `<p className="cap">`, and treating `<WellnessTab/>` as the child
  rather than resolving it to the `<div className="stack">` that actually
  carries the margin. Four of the 25 are only visible because of that second
  fix.

  **THE DECISION, WHICH IS NOT CLAUDE'S TO MAKE**, because the code cannot say which side is wrong:

  **(a) The comment is right and the screens drifted.** `base.css` quotes "Spec §4: 16px between body cards on Today, 14px everywhere else", and eight screens do not do that. The fix is mechanical — remove margins from direct children of `.phone-body` and let the gap do the work — but it visibly tightens eight screens against a design that was signed off.

  **(b) The screens are right and the comment is stale.** The athlete app was signed off on 4 September AS IT RENDERS, at 28px. If what shipped is what was approved, then `--gap-stack` and that comment are the things to correct, not the layout.

  **Do not fix this by adding a second margin anywhere.** Whichever way it goes, the space between two body blocks should come from ONE place. That is the property the guard should assert.


  </details>

## 1. Data & Schema — confirmed already built by reading the raw files directly
- [x] Multi-tenancy: `org_id` on 56 of 58 tables, RLS enabled with a policy on all 58
- [x] Role-based access: `app_role` enum, medical data split across `injuries` (coach-visible) and `injury_clinical` (medical-only by policy)
- [x] Audit logging: `audit_log` table with actor, role at time of action, entity, athlete, metadata, IP
- [x] GPS scope decided: moment-by-moment trace, not totals only. This is new build, the existing table only stores session totals.
- [ ] **Deferred**: decide what the GPS screen actually displays, speed-over-time trace, positional heat map, both, or neither. This gates whether the raw storage build below is worth doing at all, revisit before starting it.
- [ ] **Check first, before anything else**: does your GPS vendor/hardware actually export raw, per-reading data (timestamp, position, speed for every moment), or only session totals? If it's totals-only, this feature is blocked until that changes, no schema work can create data that was never captured.
- [ ] Once confirmed, design a new raw GPS readings table, separate from the existing session-totals table, indexed by athlete, session, and timestamp
- [ ] Design an aggregation layer so the app displays summarized views (not a million raw points on screen), while keeping raw data available underneath for export
- [ ] Decide how long raw GPS data gets kept, given the volume, this affects storage cost over time
- [x] Finalize the authoritative role list — sport scientist (admin permissions), medic, S&C, nutritionist, coach; athlete separate
- [ ] **Real gap to fix**: the code's `app_role` enum currently only has four values (athlete, coach, medical, admin), not the five decided roles. It doesn't distinguish sport scientist, S&C, or nutritionist as separate roles yet, and still has an `admin` value that shouldn't exist. This needs a migration plus updated RLS policies, it's not just a naming tweak.
- [ ] **Finish the different staff logins and access, end to end.** The umbrella task the pieces above and below feed into: real accounts for all five staff roles, correctly gated on every screen, not just some. Ties together the `app_role` migration above, G-03 (credential handling), D-01 (injury gate), D-06 (schedule editing), and every "S&C, not built" or "nutritionist, not built" flag found screen by screen so far. Worth treating as one build push rather than fixing each screen in isolation, since they're all the same underlying gap surfacing in different places.
- [x] Review the existing ERD in `docs/04-data-model.md` §2 — confirmed real, a genuine Mermaid diagram matching the entities discussed (injuries/injury_clinical split, org-based tenancy, GPS, testing, thresholds and flags)

## 2. Backend & Infrastructure
- [x] Backend already built on Supabase
- [ ] No GitHub remote currently configured — deploys go straight from CLI. Decide if that's an acceptable risk or worth fixing.
- [ ] Confirm which Supabase tier is live (Free has no automated backups — needs Pro before real club data is at risk)
- [ ] Confirm offline sync strategy for GPS/wellness data on poor signal — status in the existing build unknown, needs checking
- [ ] Once verification is done, have Claude Code produce one consolidated, cited "verified state" doc rather than relying on scattered prose docs

## 3. Apps
- [x] Platform decision: web app for staff, native (Swift/SwiftUI, iOS first) for athletes — **SUPERSEDED, see the corrected Decisions Log entry at the top of this document. No native athlete app was ever built, and on 2026-09-08 Isabella confirmed the responsive web app is what continues to be built. This line records the decision as it was taken on 2026-09-04, not the platform as it stands.**
- [ ] Confirm what's actually been built matches this decision
- [ ] **This is no longer just an option to evaluate, it's a requirement.** The 2026-09-04 decision that schedule edits must be saved locally and synced on reconnect needs a service worker and real local storage (IndexedDB, not just a form staying open in a tab) to work at all. A plain web app doesn't have this by default. Decide whether that's built as a full PWA, or the specific offline-storage pieces only, without the rest of the PWA shell.

## 4. Compliance & Legal
- [ ] Confirm UK GDPR obligations for special category (medical) data
- [ ] Draft a data processing agreement template to use with each club
- [ ] Confirm encryption at rest on Supabase
- [ ] Confirm CLOUD Act exposure (Supabase is US-headquartered even when EU-hosted) with whoever does the compliance review

## 5. People & Validation
- [ ] Meeting with Apple engineer contact — stack choice + offline sync approach
- [ ] Legal review of compliance approach before the first pilot club goes live
