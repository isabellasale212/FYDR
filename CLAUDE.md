# CLAUDE.md for Fydr

You are working on **Fydr**, an athlete performance management platform for sports teams.

This file is loaded automatically at the start of every Claude Code session. It is the
contract. Everything below is binding unless the user explicitly overrides it in the
current conversation.

---

## 0. The design is frozen

**Signed off 4 September 2026: both the staff app and the athlete app.** Do not
change visual design, layout, spacing, colour, typography or component structure
unless the user explicitly asks for a design change in the current conversation.

This includes changes that look like corrections: a spacing value that seems
wrong, a token that seems off, a component that could be tidier. If you notice
one, **say so and leave it alone.** The design has been measured against the
canvas and signed off; an unrequested improvement is a regression against a
decision somebody made.

What is still in scope without asking: behaviour, correctness, data integrity,
permissions, performance, and anything in `docs/spec-gaps.md`. If a correctness
fix genuinely requires a visual change, say what it is and why before making it.

---

## 0.05 The three canonical reference documents

**These three live in `docs/` and are canonical. Ignore any copy anywhere else,
including `~/Downloads`, and any version held in memory from an earlier
session.** Read from `docs/` every time.

| Document | What it is for |
|---|---|
| `docs/FydrStaffAppSpecification_-_CLEAN_for_ClaudeCode.docx` | The specification. 5,496 paragraphs and 202 tables; read it with `python3` and `docx`, it parses cleanly. Its first page lists the 2026-09-04 edits. |
| `docs/Fydr_-_Architecture_To-Do_List.md` | Build order, live bugs, and decisions taken but not built. **Update this file in place** when an item is resolved or a new one appears. Never keep a separate copy of it. |
| `docs/Fydr_-_Claude_Code_Build_Handoff.md` | Build order and the verification standard. Its session log at the end wins over anything earlier in the same file. |

`docs/spec-gaps.md` holds the numbered gap queue (G-01 onward) that the handoff
references, and stays where it is.

---

## 0.1 The specification is binding

`docs/screens/`, `docs/metrics.md` and `docs/access-matrix.md` define what this
app is supposed to be. They are consulted before code is written and updated in
the same commit when agreed behaviour changes.

- **Read the relevant numbered file in `docs/screens/` before changing any
  screen.** They are numbered in route order, for example
  `docs/screens/19-athlete-report.md`. **Only the numbered files are binding.**
  `docs/screens/legacy/` holds 38 older documents kept for their reasoning; they
  contradict the current app in places and must not be followed as instructions.
- **Read `docs/metrics.md` before touching any calculation. Never invent a metric
  or change a formula without updating its registry entry.** Every number in the
  app has an identifier such as MET-014. If two screens need the same quantity
  computed differently, they are two metrics with two identifiers and two names,
  and each entry must say how it differs from its twin.
- **Read `docs/access-matrix.md` before touching any permission, route guard or
  row level security policy.**
- **Any change to displayed behaviour, a formula or a permission updates the
  corresponding spec file in the same commit.** A code change that leaves the
  specification stale is an incomplete change.
- **If a request conflicts with the specification, stop and say so rather than
  building it.** Ask whether to change the specification or drop the request.
  Do not quietly do both.
- **Files under `docs/screens/draft/` are exploratory and not binding**, as is
  everything in `docs/screens/legacy/`. Every numbered file in `docs/screens/` is
  binding.

Open questions live in `docs/decisions-required.md`, numbered D-01 onward. Queued
work lives in `docs/spec-gaps.md`, ordered by risk. `docs/generated/` is generated
output and is never hand edited: run `scripts/build-spec-docx.py` instead.

**Two commands exist for this.** `/spec-drift` re-reads the code against the
specification and reports differences without changing anything. `/spec-export`
regenerates the Word document.

---

## 1. Read this before you write code

The full specification lives in `/docs`. You do **not** need to read all of it every
session, but you **must** read the relevant file before touching the corresponding area.

| If you are working on... | Read first |
|---|---|
| Anything at all | `docs/00-product-overview.md` |
| Permissions, who-sees-what | `docs/01-roles-and-permissions.md` |
| Navigation, adding a screen | `docs/02-information-architecture.md` |
| Any user journey | `docs/03-flows.md` |
| Database, queries, migrations | `docs/04-data-model.md` |
| Infrastructure, auth, sync | `docs/05-architecture.md` |
| UI, components, styling | `docs/06-design-system.md` |
| HealthKit, CSV, vendor data | `docs/07-integrations.md` |
| Push, reminders, emails | `docs/08-notifications.md` |
| Medical data, GDPR, audit | `docs/09-security-and-compliance.md` |
| What to build next | `docs/10-roadmap.md` |
| Tiering, pricing, feature gating | `docs/12-product-tiers.md` |
| **What each buyer actually wants** | `docs/14-` to `docs/18-` role briefs. Read the one for the screen you are building. |
| Company, trademark, contracts | `docs/13-legal-and-trademark.md` |
| What a page does when you click it | `docs/19-page-flows.md` |
| **Routes, route params, panel and query bindings, the sidebar as data** | `docs/20-route-map.md`. The binding layer between `19-page-flows.md` and the code. `19` wins on intent, `20` wins on naming. |
| A specific screen | `docs/screens/<screen>.md` |

Architectural decisions and their reasoning are recorded in `docs/decisions/`. If you are
about to contradict one, stop and say so instead.

---

## 2. Non-negotiable rules

These exist because breaking them causes data leaks, legal exposure, or silent
corruption of athlete records. Violating one is worse than not shipping the feature.

1. **Every table that holds club data has an `org_id` column.** No exceptions. Row-level
   security policies key off it. A query that can return rows from two organisations is a
   critical bug.
2. **Never trust a `role` value sent from the client.** Roles are resolved server-side
   from the authenticated session. Client-side role checks are for hiding UI only, never
   for authorisation.
3. **Medical data is separately gated.** Injury detail, diagnosis, and treatment notes are
   visible to medical staff and the athlete concerned. Coaching staff see *availability
   status* only, never diagnosis. See `docs/09-security-and-compliance.md`.
4. **Athlete data is never hard-deleted.** Use soft deletes with `deleted_at`. Retention
   and erasure are handled by an explicit, audited process.
5. **All timestamps are stored as `timestamptz` in UTC.** Display in the organisation's
   timezone. Never store a naive local time.
6. **Wellness, gym, and nutrition entries are immutable once submitted.** Corrections
   create a new revision row and mark the old one superseded. Performance data that can
   be silently edited is worthless for trend analysis.
7. **Every screen respects the active group filter.** See rule in §3.
8. **Athletes do not log nutrition daily.** Nutrition is guidance: targets, meal ideas, and
   training-day fuelling. There is no daily nutrition entry, no per-meal macros, and no
   nutrition compliance domain. `nutrition_entries` is dormant. The ONE exception is the
   weekly one-tap check-in (`docs/screens/nutrition-checkin.md`, `nutrition_checkins`): one
   question, once a week, three answers. Missing it is not non-compliance. See
   `docs/screens/nutrition-guidance.md`.
9. **Menstrual cycle tracking is out of scope.** Do not add it, do not infer it.
10. **No secrets in the repo.** Environment variables only. If you need a new one, add it
   to `.env.example` with a comment and tell the user.

---

## 3. The group filter rule

The single most-repeated instruction on the original design is *"all pages group
separations"*. It means:

> Every screen that displays more than one athlete must be filterable by squad group,
> and that filter selection persists globally as the user navigates between screens.

A squad group is a coach-defined subset of the squad (forwards, backs, academy, rehab
group, S&C group A, etc.). An athlete may belong to several. Implement this once as a
global context, not per-screen. If you are adding a multi-athlete screen and you have not
wired it to the group filter, the screen is not finished.

---

## 4. Stack

- **Mobile app**: React Native via Expo (managed workflow), TypeScript, distributed
  through the App Store and Google Play. **Two shells in one app**: the athlete four-tab
  shell and the staff five-tab shell. The shell is resolved from the authenticated user's
  roles, never from a client-side toggle. See `docs/02-information-architecture.md` §3 and §4.6.
- **Backend**: Supabase, Postgres, Auth, Storage, Edge Functions, Realtime.
- **Staff web dashboard**: Next.js, deployed on Vercel, sharing types and query logic with
  the mobile app via a local workspace package.
- **Language**: TypeScript everywhere. No JavaScript files in new code.
- **State/data**: TanStack Query for server state. Local component state otherwise. Do not
  introduce Redux, MobX, or Zustand without asking.
- **Validation**: Zod schemas, shared between client and Edge Functions. A type and its
  runtime validator must be defined once.

Do not add a dependency without stating what it does, what it replaces, and its
maintenance status.

---

## 5. Working style

- **Ask before inventing product behaviour.** If the spec does not define what happens in
  a case, do not guess and quietly implement something. Say what is undefined and propose
  two options.
- **Small, reviewable changes.** One feature per branch. Do not refactor unrelated code in
  a feature commit.
- **Migrations are additive.** Never rewrite an applied migration. Add a new one.
- **Write the test for a permission rule before the rule.** Access control is the one area
  where tests are mandatory.
- **When the spec and the code disagree, the spec wins**: but tell the user, because it
  may be the spec that is out of date.
- **Update the spec when behaviour changes.** A code change that alters documented
  behaviour must include the corresponding `/docs` edit in the same commit.

---

## 6. Vocabulary

Use these terms consistently in code, UI, and conversation. Inconsistent naming here has
already caused confusion in the design phase.

| Term | Means |
|---|---|
| **Organisation** (`org`) | A paying customer. One club or team. The tenancy boundary. |
| **Squad** | All athletes in an organisation. |
| **Group** | A named subset of a squad. Athletes can be in many. |
| **Athlete** | A player. The subject of all performance data. |
| **Staff** | Any non-athlete user: coach, S&C, medical, admin. |
| **Session** | A single scheduled activity: training, gym, match, testing, meeting. |
| **Fixture** | A match. A session with an opponent. |
| **MD-n** | Matchday minus *n* days. The scheduling spine. MD is matchday itself. |
| **Entry** | One athlete's submitted record for one thing on one day. |
| **Compliance** | Whether an expected entry was actually submitted. |
| **Availability** | Whether an athlete can train or play. Medically determined. |
| **Flag** | An automatically raised alert when a value crosses a threshold. |
| **Threshold** | The configurable rule that raises a flag. |
| **Programme** | A prescribed plan (gym, nutrition, rehab) assigned to athletes. |
| **Block** | A time-bounded phase of a programme. |
| **Test** | A standardised measurement, repeated over time. |

Never use "user" in the UI. It is always "athlete" or the specific staff role.

---

## 7. What Fydr is not

Guard against scope creep. Fydr is **not**:

- A video analysis or tactical platform
- A medical record system of record (it records availability, not clinical notes as legal record)
- A messaging or social app
- A wearable device or a hardware product
- A recruitment or scouting database

If a request implies one of these, flag it before building.

---

## 8. Current state

**Both the staff and athlete surfaces exist and are running, live, in production.** This
section has been wrong twice now, in opposite directions: it first said Fydr was a fresh
build with no legacy code (false for staff web), then said the athlete app was greenfield
(false too — it existed the whole time, just hadn't been inspected). Correct position:

| Surface | State |
|---|---|
| **Staff web app** | **Exists.** Next.js, deployed on Vercel. A left sidebar, consolidated to **nine** destinations (Groups, Timetable and Testing were their own rows and were folded into Squad overview/Schedule/Reports respectively; Flags has no row at all — see `02-information-architecture.md` §4.1, which records exactly where each went and resolves the O-723 question this file used to leave open). Covers dashboard, squad, schedule, reports, nutrition, gym programmes, leaderboards, analytics and settings, each backed by real RLS-scoped queries, not placeholders. Source of the design system (`src/styles/tokens.css`, `src/styles/base.css`). **Not greenfield, and further along than "exists and is running" suggests** — most of what `10-roadmap.md` schedules across its Phase 0–2 (and pieces of Phase 3: the training report is GPS-derived already) is real and shipped. See that file's own corrected banner.
| **Athlete mobile app** | **Exists, is not mobile, and is not greenfield.** A full real experience — sign-in, a 4-tab shell, wellness/RPE/nutrition entry, gym logging, My Data, Programme, Me — lives at `src/app/(athlete)/`, sharing this same Next.js app and deployment with the staff surface. It is **responsive mobile web, not the React Native/Expo app §4 describes** — that native shell has not been started. Real divergence from §4, recorded here rather than silently followed: do not assume an Expo/React Native codebase exists anywhere in this repo. |
| **Backend and schema** | **Known and real.** Supabase Postgres, real migrations, real RLS, a passing cross-tenant test suite (`npm run test:tenancy`). Broadly matches `04-data-model.md`, with real, individually-documented deviations found along the way (check the query file for the table you're touching — its own header comment usually says what's been simplified or cut against the doc, and why). |

**Before assuming a greenfield build, inspect the existing code.** Specifically:

1. **Read `web/src/app/globals.css` first.** The design system in
   `docs/source/design-system-content.txt` states it was "extracted from
   `web/src/app/globals.css`" and is "pulled straight from the source". That file is the
   **styling source of truth**. `docs/06-design-system.md` documents and reasons about it; where
   the two disagree, `globals.css` is what is actually rendering and `06-design-system.md`
   needs correcting, not the CSS. Style through the tokens defined there, never a raw hex.
2. **Check whether the screen already exists** before building it. `docs/screens/` describes
   screens that may already be built, partly built, or built differently. Compare before you
   write.
3. **Check the real navigation**, `docs/02-information-architecture.md` §4.1, which is
   transcribed from a screenshot of the running app, before adding a route.
4. **Check the real schema** against `docs/04-data-model.md` before writing a migration. The
   training report renders three columns that do not exist in the documented schema, which
   means either the schema has moved or the app computes them elsewhere. Find out which.

The "when the spec and the code disagree, the spec wins" rule in §5 still holds for **intent**:
do not change documented behaviour because the code does something else. It does **not** hold
for **facts about what exists**. If the code contradicts a factual claim in `/docs`, the code is
the fact and the doc is the bug, and you should say so.

`docs/screens/training-report.md` is the worked example: a screen specified from the running app
rather than from the drawing.

The current phase is recorded in `docs/10-roadmap.md`. Check it before starting work so
you build in the right order, and read the note at the top of that file about GPS: the phase
ordering predates the evidence that GPS is already central to the shipped app.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
