# 20. Route map: the binding layer between the click map and the code

## 1. What this file is for

`19-page-flows.md` says what every page does when you click it, in plain English, with no
table names, no field names and no route paths, because its readers are the client and
anybody who has never built software. That is the right document for that audience and it is
not being changed. This file is the other half: it binds each of those pages to a route path,
a spec file, a shell, a role set, a set of panels, a component name per panel, a named query
per panel and the tables in `04-data-model.md` that the query reads. Read them together.
**When the two disagree, `19-page-flows.md` wins on intent and behaviour, and this file wins
on naming: routes, ids, components, queries and tables.** If a panel appears here that does
not appear there, that is a bug in this file. If a panel appears there with no binding here,
it is either in §11 as a gap or it has been missed, and it should be added rather than
invented in code.

Companion documents, in the order a build session reads them: `19-page-flows.md` for intent,
this file for names, `docs/screens/<screen>.md` for detail,
`01-roles-and-permissions.md` §2 for access. See §10.

---

## 2. The route table

### 2.1 The convention

Nine rules, applied without exception. A route that breaks one of them is wrong.

1. **Paths are shell relative and lower kebab-case.** The staff web app is staff only, so it
   needs no `/staff` prefix: the sidebar row Dashboard is `/dashboard`, not
   `/staff/dashboard`. The athlete app is athlete only: `/today`, not `/athlete/today`.
2. **A sidebar row owns a top-level segment.** Nine rows, nine segments: `/dashboard`,
   `/squad`, `/schedule`, `/reports`, `/nutrition`, `/programmes`, `/leaderboards`,
   `/analytics`, `/settings`. Everything else is a child of one of them, or one of the three
   off-sidebar staff trees in rule 4.
3. **A child route is a segment under its parent, never a query string.** Session detail is
   `/schedule/:sessionId`, not `/schedule?session=x`. A different thing gets a different
   path; a different view of the same thing gets a search param (§6).
4. **Three staff trees have no sidebar row**, because `02-information-architecture.md` §4.1
   gives them none and `19-page-flows.md` §2.1 reaches all three from dashboard panels:
   `/flags`, `/injuries` and, under it, `/injuries/rehab-groups` and
   `/injuries/team-allocation`. This is O-723 rendered as routing. If O-723 later grants
   either a row, the path does not change, only §3 does.
5. **Route params are resource identity, search params are view state.** Stated in full in §6.
6. **Static child segments are reserved words and are listed here**, because they sit beside
   a dynamic sibling and must win the match. Under `/squad`: `roster`. Under `/schedule`:
   `timetable`, `fixtures`, `templates`, `testing`. Under `/reports`: `training`, `testing`,
   `schedules`, `runs`. Under `/programmes`: `exercises`. Under `/analytics`: `builder`.
   Under `/my-data`: `day`, `boards`. No athlete may be given the id `roster`, and no
   programme the id `exercises`, which is free because every id is a uuid.
7. **A sheet or dialogue that carries its own state gets a route**, so that it survives a
   refresh and can be deep linked. The morning check-in is `/check-in`, not a boolean in
   component state. A sheet with no state of its own, for example the body map inside the
   check-in, does not.
8. **Plurals for collections, singular resources addressed by id.** `/leaderboards` and
   `/leaderboards/:leaderboardId`.
9. **Ids in the manifest are dotted and stable.** `staff.schedule.testing`. The path may be
   renamed; the id may not, because notifications, analytics events and tests reference it.

Deep links arriving from push are shell namespaced (`/staff/...`, `/athlete/...`) because
`08-notifications.md` §7 defines them that way. §6.4 maps them onto these paths.

### 2.2 Athlete phone

| # | Page | Route | Spec file | Shell | Roles | Parent |
|---|---|---|---|---|---|---|
| 1 | Today | `/today` | `screens/today.md` | athlete phone | athlete | none |
| 2 | Morning check-in | `/check-in` | `screens/wellness-entry.md` | athlete phone | athlete | `/today` |
| 5 | How hard was it | `/rpe/:sessionId` | `screens/training-entry.md` | athlete phone | athlete | `/today` |
| 45 | Weekly protein question | `/nutrition-check-in` | `screens/nutrition-checkin.md` | athlete phone | athlete | `/today` |
| 4 | Gym session, logging | `/gym/:sessionId` | `screens/gym-logging.md` | athlete phone | athlete | `/today` |
| 6 | My data | `/my-data` | `screens/my-data.md` | athlete phone | athlete | none |
| 6 | One day's entry | `/my-data/day/:entryDate` | `screens/my-data.md` | athlete phone | athlete | `/my-data` |
| 26 | Boards I am on | `/my-data/boards` | `screens/leaderboards.md` | athlete phone | athlete | `/my-data` |
| 26 | One board | `/my-data/boards/:leaderboardId` | `screens/leaderboards.md` | athlete phone | athlete | `/my-data/boards` |
| 7 | My programme | `/programme` | `screens/my-programme.md` | athlete phone | athlete | none |
| 3 | Nutrition guidance | `/programme/nutrition` | `screens/nutrition-guidance.md` | athlete phone | athlete | `/programme` |
| 29 | Me | `/me` | `screens/settings.md` | athlete phone | athlete | none |
| 29 | Edit my profile | `/me/profile` | `screens/settings.md` | athlete phone | athlete | `/me` |
| 29 | Notifications | `/me/notifications` | `screens/settings.md` | athlete phone | athlete | `/me` |
| 43 | Privacy and my data | `/me/privacy` | `screens/settings.md` | athlete phone | athlete | `/me` |
| 31 | Export my data | `/me/export` | `screens/exports.md` | athlete phone | athlete | `/me` |
| 26 | My leaderboard opt-ins | `/me/leaderboards` | `screens/leaderboards.md` | athlete phone | athlete | `/me` |
| 33 | Onboarding | `/onboarding/:step` | `screens/onboarding.md` | athlete phone, staff web | athlete, coach, medical, admin | none |

### 2.3 Staff, sidebar rows and their children

`admin (aggregate)` means the role opens the page and sees counts with no athlete names, per
`19-page-flows.md` §3.12, §3.26 and §3.28 and the `A` marks in `01-roles-and-permissions.md`
§2.

| # | Page | Route | Spec file | Shell | Roles | Parent |
|---|---|---|---|---|---|---|
| 8 | Dashboard | `/dashboard` | `screens/dashboard.md` | staff web, staff phone | coach, medical | none |
| 10 | Flags | `/flags` | `screens/flags.md` | staff web, staff phone | coach, medical | `/dashboard` |
| 10 | One flag | `/flags/:flagId` | `screens/flags.md` | staff web, staff phone | coach, medical | `/flags` |
| 12 | Injury dashboard | `/injuries` | `screens/injury-dashboard.md` | staff web, staff phone | coach, medical, admin (aggregate) | `/dashboard` |
| 13 | Injury record | `/injuries/:injuryId` | `screens/injury-record.md` | staff web | medical | `/injuries` |
| 42 | Rehab groups | `/injuries/rehab-groups` | `screens/rehab-groups.md` | staff web | medical, coach (read only) | `/injuries` |
| 14 | Team allocation | `/injuries/team-allocation` | `screens/team-allocation.md` | staff web | coach, medical (read only) | `/injuries` |
| 9 | Squad overview | `/squad` | `screens/squad-status.md` | staff web, staff phone | coach, medical | none |
| 19 | Squad list | `/squad/roster` | `screens/squad-list.md` | staff web, staff phone | coach, medical | `/squad` |
| 20 | Athlete profile | `/squad/:athleteId` | `screens/athlete-profile.md` | staff web, staff phone | coach, medical | `/squad` |
| 20a | Athlete nutrition | `/squad/:athleteId/nutrition` | *(none, built to a client request — see §4.20a)* | staff web | coach, medical | `/squad/:athleteId` |
| 20a | Athlete wellness | `/squad/:athleteId/wellness` | *(none, built to a client request — see §4.20a)* | staff web | coach, medical | `/squad/:athleteId` |
| 20a | Athlete gym | `/squad/:athleteId/gym` | *(none, built to a client request — see §4.20a)* | staff web | coach, medical | `/squad/:athleteId` |
| 15 | Schedule | `/schedule` | `screens/schedule.md` | staff web, staff phone | coach, medical | none |
| 11 | Timetable and register | `/schedule/timetable` | `screens/timetable.md` | staff web, staff phone | coach, medical | `/schedule` |
| 41 | Fixtures list | `/schedule/fixtures` | *(none, G-2)* | staff web, staff phone | coach, medical | `/schedule` |
| 17 | Fixture detail | `/schedule/fixtures/:fixtureId` | `screens/fixture-detail.md` | staff web, staff phone | coach, medical | `/schedule/fixtures` |
| 18 | Week templates | `/schedule/templates` | `screens/md-planner.md` | staff web | coach, medical | `/schedule` |
| 18 | Template editor | `/schedule/templates/:templateId` | `screens/md-planner.md` | staff web | coach, medical | `/schedule/templates` |
| 25 | Testing sessions | `/schedule/testing` | `screens/testing.md` | staff web, staff phone | coach, medical | `/schedule` |
| 25 | Logging grid | `/schedule/testing/:sessionId/log` | `screens/testing.md` | staff web, staff phone | coach, medical | `/schedule/testing` |
| 16 | Session detail | `/schedule/:sessionId` | `screens/session-detail.md` | staff web, staff phone | coach, medical | `/schedule` |
| 28 | Reports | `/reports` | `screens/reports.md` | staff web, staff phone | coach, medical, admin (aggregate) | none |
| 37 | Training report | `/reports/training` | `screens/training-report.md` | staff web | coach, medical | `/reports` |
| 25 | Testing results | `/reports/testing` | `screens/testing.md` | staff web | coach, medical | `/reports` |
| 28 | Report schedules | `/reports/schedules` | `screens/reports.md` | staff web | coach, medical | `/reports` |
| 28 | Report viewer | `/reports/runs/:runId` | `screens/reports.md` | staff web, staff phone | coach, medical, admin (aggregate) | `/reports` |
| 24 | Nutrition | `/nutrition` | `screens/nutrition-plans.md` | staff web, staff phone | coach, medical | none |
| 23 | Gym programme | `/programmes` | `screens/gym-programmes.md` | staff web, staff phone | coach, medical | none |
| 22 | Programme builder | `/programmes/:programmeId` | `screens/programme-builder.md` | staff web | coach, medical | `/programmes` |
| 22 | Exercise library | `/programmes/exercises` | `screens/programme-builder.md` | staff web | coach, medical | `/programmes` |
| 26 | Leaderboard (testing wall) | `/leaderboards` | `LEADERBOARD-SPEC.md` | staff web | coach, medical, admin | none |
| 26 | Manage leaderboards | `/leaderboards/manage` | `screens/leaderboards.md` | staff web, staff phone | coach, medical, admin (aggregate) | `/leaderboards` |
| 26 | New leaderboard | `/leaderboards/new` | `screens/leaderboards.md` | staff web, staff phone | coach, medical | `/leaderboards/manage` |
| 26 | Board detail | `/leaderboards/:leaderboardId` | `screens/leaderboards.md` | staff web, staff phone | coach, medical | `/leaderboards/manage` |

Real divergence recorded here, not silently followed: `/leaderboards` itself moved from the
consent-gated, staff-configured single-metric board list to a different, staff-only "testing
wall" (LEADERBOARD-SPEC.md) — a read-only ranking of real `test_definitions`/`test_results`
plus two real wellness/compliance metrics, never opt-out, never shown to an athlete. The real,
consent-gated board system this row used to point at (create/publish/suppress, and the boards
real athletes see at `/me/leaderboards` and `/my-data/boards`, both unaffected) moved to
`/leaderboards/manage`, linked from the wall's own header. `screens/leaderboards.md` still
describes that moved system accurately; it does not describe the wall, which has no screens/
doc of its own yet — LEADERBOARD-SPEC.md is the only spec for it today.
| 27 | Analytics | `/analytics` | `screens/analytics.md` | staff web, staff phone | coach, medical | none |
| 27 | One preset | `/analytics/:presetId` | `screens/analytics.md` | staff web, staff phone | coach, medical | `/analytics` |
| 27 | Query builder | `/analytics/builder` | `screens/analytics.md` | staff web | coach, medical | `/analytics` |
| 29 | Settings | `/settings` | `screens/settings.md` | staff web, staff phone | coach, medical, admin | none |
| 29 | Profile | `/settings/profile` | `screens/settings.md` | staff web, staff phone | coach, medical, admin | `/settings` |
| 29 | Notifications | `/settings/notifications` | `screens/settings.md` | staff web, staff phone | coach, medical, admin | `/settings` |
| 30 | Thresholds | `/settings/thresholds` | `screens/thresholds.md` | staff web, staff phone | coach | `/settings` |
| 34 | Import GPS | `/settings/imports` | `screens/imports.md` | staff web, staff phone | coach, medical | `/settings` |
| 34 | One import | `/settings/imports/:batchId` | `screens/imports.md` | staff web | coach, medical | `/settings/imports` |
| 31 | Exports | `/settings/exports` | `screens/exports.md` | staff web | coach, medical, admin | `/settings` |
| 21 | Groups | `/settings/groups` | `screens/groups.md` | staff web, staff phone | coach, medical, admin | `/settings` |
| 21 | Group detail | `/settings/groups/:groupId` | `screens/groups.md` | staff web, staff phone | coach, medical, admin | `/settings/groups` |
| 32 | User management | `/settings/users` | `screens/user-management.md` | staff web | admin | `/settings` |
| 32 | One user | `/settings/users/:userId` | `screens/user-management.md` | staff web | admin | `/settings/users` |
| 29 | Club details | `/settings/club` | `screens/settings.md` | staff web | admin | `/settings` |
| 29 | Billing | `/settings/billing` | `screens/settings.md` | staff web | admin | `/settings` |
| 29 | Retention and erasure | `/settings/retention` | `screens/settings.md` | staff web | admin | `/settings` |

**65 routes.** 18 athlete, 47 staff. Screen numbers are the inventory in
`02-information-architecture.md` §5. Screens 35, 36, 43 and 44 are RESERVED there and appear
either as a gap in §11 or, for 43, as a section inside `screens/settings.md` at `/me/privacy`.
Screen 38 is removed from the product and has no route, and none is to be added.

---

## 3. The sidebar, as data

Nine rows, flat, nothing indented, per `02-information-architecture.md` §4.1 and the rule in
`19-page-flows.md` §2.1. This is the array a developer copies. It lives in
`packages/types/navigation.ts` and both shells read it.

```ts
import type { LucideIcon } from 'lucide-react';

export type AppRole = 'athlete' | 'coach' | 'medical' | 'admin';

export type SidebarRow = {
  /** Stable id. Matches the route id in the manifest in section 9. */
  id: string;
  /** The label the client set on 6 August 2026. Do not rename without asking. */
  label: string;
  route: string;
  /** Lucide icon name, per 06-design-system.md section 13.1. */
  icon: keyof typeof import('lucide-react') & string;
  /** Roles that see the row. Hiding only. Access is RLS, per CLAUDE.md rule 2. */
  roles: readonly AppRole[];
};

export const SIDEBAR: readonly SidebarRow[] = [
  { id: 'staff.dashboard',    label: 'Dashboard',      route: '/dashboard',    icon: 'LayoutDashboard', roles: ['coach', 'medical'] },
  { id: 'staff.squad',        label: 'Squad overview', route: '/squad',        icon: 'Users',           roles: ['coach', 'medical'] },
  { id: 'staff.schedule',     label: 'Schedule',       route: '/schedule',     icon: 'CalendarDays',    roles: ['coach', 'medical'] },
  { id: 'staff.reports',      label: 'Reports',        route: '/reports',      icon: 'FileText',        roles: ['coach', 'medical', 'admin'] },
  { id: 'staff.nutrition',    label: 'Nutrition',      route: '/nutrition',    icon: 'Salad',           roles: ['coach', 'medical'] },
  { id: 'staff.programmes',   label: 'Gym programme',  route: '/programmes',   icon: 'Dumbbell',        roles: ['coach', 'medical'] },
  { id: 'staff.leaderboards', label: 'Leaderboard',    route: '/leaderboards', icon: 'Trophy',          roles: ['coach', 'medical', 'admin'] },
  { id: 'staff.analytics',    label: 'Analytics',      route: '/analytics',    icon: 'LineChart',       roles: ['coach', 'medical'] },
  { id: 'staff.settings',     label: 'Settings',       route: '/settings',     icon: 'Settings',        roles: ['coach', 'medical', 'admin'] },
] as const;
```

Three things this array asserts, each of which is a decision and not an accident.

1. **A user holding only the admin role sees four rows**: Reports, Leaderboard, Settings, and
   nothing else, because `01-roles-and-permissions.md` §2 denies admin the squad dashboard,
   flags, squad data, the schedule, programmes and analytics. That is the deliberate friction
   in §1 of that document, not a missing row. An admin who needs squad data holds the coach
   role as well and the rows appear.
2. **Medical sees the same nine rows as a coach except Thresholds**, which is not a row, and
   which `19-page-flows.md` §3.30 states medical staff cannot open at all. The gating is on
   `/settings/thresholds`, not on the Settings row.
3. **No row is added for flags, the injury board, fixtures, the training report, testing,
   thresholds, imports or exports.** They are children, per §2.1 rule 2 and rule 4.

**The two entry points to Import GPS.** `19-page-flows.md` §2.1 and
`02-information-architecture.md` §4.1 both record that burying a four-times-a-week job in
Settings is a cost (O-1100). The mitigation is a second entry point, not a tenth row:

```ts
/** O-1100. Import GPS is at /settings/imports and is also launched from the Reports page,
 *  beside the training report it feeds. Same route, two entry points, one implementation. */
export const SECONDARY_ENTRY_POINTS = [
  { id: 'staff.settings.imports', from: 'staff.reports', label: 'Import GPS', icon: 'Upload' },
] as const;
```

---

## 4. Panel bindings

### 4.1 How to read these tables

One table per page. Columns:

- **Panel**: the thing `19-page-flows.md` draws as a rectangle on that page.
- **Component**: the React component name. Components marked *(DS)* already exist in
  `06-design-system.md`; the rest are screen-owned and live in
  `apps/*/src/features/<screen>/`.
- **Query**: the hook name in `packages/queries/<domain>.ts` and, in brackets, the key factory
  path in `packages/queries/keys.ts` per `05-architecture.md` §9. A hook name is given, never
  SQL. `local` means SQLite, not the server, per the two-cache rule in that section.
- **Tables**: the objects in `04-data-model.md` the query reads. Every name in this column
  exists in that document, including §17; anything that does not is in §11 instead.
- **Edit**: the edit affordance and the role that sees it, per the editing rules in
  `19-page-flows.md` §4. "None" means no control at all, not a disabled one.

Key namespaces that do not yet exist in the factory in `05-architecture.md` §9 and must be
added: `qk.availability`, `qk.injuries`, `qk.compliance`, `qk.nutrition`, `qk.testing`,
`qk.gym`, `qk.leaderboards`, `qk.reports`, `qk.exports`, `qk.imports`, `qk.thresholds`,
`qk.teams`, `qk.groups`, `qk.users`. They follow the same rules: `orgId` second, filter
arrays sorted, dates as ISO strings.

### 4.2 `/today`, screen 1

`19-page-flows.md` §3.1.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Date and sync mark | `SyncStatusIndicator` *(DS)* | `useOutboxStatus` (local) | none, SQLite outbox | None |
| Week strip with MD-n countdown | `WeekStrip` | `useMyWeek` (`qk.schedule.week`) | `sessions`, `fixtures`, `seasons` | None. Staff set the schedule |
| Availability banner | `AvailabilityBanner` | `useMyAvailability` (`qk.availability.mine`) | `availability`, `injuries` | None. Medical only, elsewhere |
| To do list | `OutstandingList` | `useMyOutstanding` (`qk.compliance.mine`) | `compliance_expectations`, `wellness_entries_current`, `training_entries_current`, `gym_session_logs`, `nutrition_checkins` | Each row opens its own entry route |
| Today's sessions | `SessionCard` *(DS)* | `useMyDaySessions` (`qk.schedule.week`) | `sessions`, `session_participants`, `group_memberships` | None. Coaches and S&C edit on `/schedule` |
| Something not right? | `ReportProblemButton` | none, G-9 | none, G-9 | Athlete writes it. Target screen unspecified |

### 4.3 `/check-in`, screen 2

`19-page-flows.md` §3.2.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Direction line | `ScaleDirectionNote` | none, static copy | none | None |
| Sleep hours stepper | `SleepStepper` | `useLastNightSleep` (`qk.wellness.history`) | `wellness_entries_current` | Athlete, until submit |
| Five feeling scales | `FeelingScaleGroup` | none, form state | writes `wellness_entries` | Athlete, until submit |
| Where? body map | `BodyMapSheet` | none, form state | writes `wellness_entries.soreness_areas` | Athlete, until submit |
| Optional block | `OptionalEntryBlock` | none, form state | writes `wellness_entries.resting_hr`, `body_mass_kg`, `comment` | Athlete, until submit |
| Submit entry | `SubmitBar` | `useSubmitWellness` (local write plus outbox) | `wellness_entries` | Athlete. Immutable once submitted, corrections are revisions |

### 4.4 `/rpe/:sessionId`, screen 5

`19-page-flows.md` §3.5.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Session context line | `SessionContextLine` | `useSession` (`qk.schedule.session`) | `sessions`, `fixtures` | None |
| The 1 to 10 list | `RpeScaleList` | none, form state | writes `training_entries.rpe` | Athlete, until submit |
| Duration stepper | `DurationStepper` | `useSession` (`qk.schedule.session`) | `sessions.duration_min` | Athlete, until submit |
| Add a note | `NoteDisclosure` | none, form state | writes `training_entries.comment` | Athlete, until submit |
| Submit rating | `SubmitBar` | `useSubmitRpe` (local write plus outbox) | `training_entries` | Athlete |

### 4.5 `/nutrition-check-in`, screen 45

`19-page-flows.md` §3.37.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Which week | `IsoWeekLabel` | `useCurrentIsoWeek` (local) | none | None |
| The question and my target | `ProteinQuestion` | `useMyProteinTarget` (`qk.nutrition.mineTarget`) | `nutrition_targets` | Nutrition and S&C set the target |
| Yes, Roughly, No | `AnswerTriad` | none, form state | writes `nutrition_checkins.answer` | Athlete only |
| Add a note | `NoteDisclosure` | none, form state | writes `nutrition_checkins.note` | Athlete |
| Done | `SubmitBar` | `useSubmitNutritionCheckin` | `nutrition_checkins` | Athlete. Skipping records nothing |

### 4.6 `/gym/:sessionId`, screen 4

`19-page-flows.md` §3.4.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Preview list | `SessionPreviewList` | `useResolvedProgrammeSession` (`qk.programme.resolvedForAthlete`) | `programme_sessions`, `programme_exercises`, `exercises`, `exercise_overrides` | S&C, in the builder |
| Unresolvable weight notice | `LoadResolutionWarning` | `useResolvedProgrammeSession` | `exercises.one_rm_test_definition_id`, `test_results` | None |
| Running header | `LiveSessionHeader` | `useGymSessionLog` (local) | `gym_session_logs` | Athlete |
| Current exercise, cap note | `ExerciseFocus` | `useResolvedProgrammeSession` | `programme_exercises`, `exercise_overrides` | S&C |
| Set rows | `SetRowList` | `useLogSet` (local write plus outbox) | `gym_set_logs` | Athlete, own sets. Corrections are new rows |
| Last time | `LastTimePanel` | `useLastPerformance` (`qk.gym.lastPerformance`) | `gym_set_logs`, `gym_session_logs` | None |
| Rest timer | `RestTimer` | none, local timer | `programme_exercises.rest_seconds` | Athlete |
| Three dots menu | `SessionOverflowMenu` | `useFinishGymSession` | `gym_session_logs.status`, `comment` | Athlete |

### 4.7 `/my-data`, screen 6

`19-page-flows.md` §3.6.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Section tabs | `SegmentedControl` *(DS)* | none, URL state (`?tab=`) | none | None |
| Period selector | `PeriodSelector` *(DS)* | none, URL state (`?period=`, §6.2) | none | Athlete, for themselves |
| Headline tiles, wellness | `MetricTile` *(DS)* | `useMyWellnessSummary` (`qk.wellness.history`) | `wellness_entries_current`, `mv_wellness_baselines` | None |
| Chart | `DomainChart` *(DS)* | `useMyWellnessHistory` (`qk.wellness.history`) | `wellness_entries_current`, `mv_wellness_baselines` | None |
| Submitted days footer | `SubmissionFootnote` | `useMyCompliance` (`qk.compliance.mine`) | `compliance_expectations`, `mv_compliance_rates` | None |
| Gym section | `GymHistoryList` | `useMyGymHistory` (`qk.gym.mineHistory`) | `gym_session_logs`, `gym_set_logs`, `mv_programme_adherence` | None |
| Testing section | `TestHistoryList` | `useMyTestHistory` (`qk.testing.mineHistory`) | `test_results`, `test_definitions` | None |
| Entry list | `EntryDayList` | `useMyEntryDays` (`qk.wellness.history`) | `wellness_entries_current`, `training_entries_current`, `nutrition_checkins` | Correction only, opens `/my-data/day/:entryDate` |

### 4.8 `/my-data/day/:entryDate` and `/my-data/boards`

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| One day in full | `EntryDayDetail` | `useMyEntryDay` (`qk.wellness.history`) | `wellness_entries_current`, `training_entries_current`, `gym_session_logs` | Correct this, athlete, creates a revision |
| Boards I am on | `MyBoardList` | `useMyBoards` (`qk.leaderboards.mine`) | `leaderboards`, `leaderboard_opt_outs`, `metric_definitions` | Leave a board, athlete, one tap |
| One board ranking | `BoardRanking` | `useBoardRanking` (`qk.leaderboards.detail`) | `leaderboards`, `leaderboard_opt_outs`, `test_results`, `gps_records`, `gym_set_logs`, `metric_definitions` | Leave, athlete. Boards under three people do not render |

### 4.9 `/programme` and `/programme/nutrition`, screens 7 and 3

`19-page-flows.md` §3.7 and §3.3.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Availability banner | `AvailabilityBanner` | `useMyAvailability` (`qk.availability.mine`) | `availability`, `injuries` | Medical only |
| Return to play card | `RehabPhaseCard` | `useMyRehab` (`qk.programme.rehabMine`) | `rehab_assignments`, `injuries` | Medical only |
| Milestones | `MilestoneList` | `useMyRehab` | `rehab_assignments.milestones` | Medical only |
| Programme header and week strip | `ProgrammeHeader` | `useMyProgramme` (`qk.programme.resolvedForAthlete`) | `programme_assignments`, `programmes`, `programme_blocks` | S&C |
| This week's sessions | `WeekSessionList` | `useMyProgrammeWeek` (`qk.programme.resolvedForAthlete`) | `programme_sessions`, `gym_session_logs` | S&C set, athlete logs |
| Nutrition targets card | `NutritionTargetCard` | `useMyNutritionTargets` (`qk.nutrition.mineTarget`) | `nutrition_targets` | Nutrition and S&C. Medical, if an open injury |
| Paused notice | `ProgrammePausedNotice` | `useMyProgramme` | `programme_assignments.status`, `suspended_reason` | Medical decide when it resumes |
| Log without a plan | `AdHocSessionButton` | `useStartAdHocGymSession` | `gym_session_logs` with null `programme_session_id` | Athlete |
| Today's targets, why | `TargetsToday` | `useMyNutritionTargets` | `nutrition_targets`, `sessions.md_offset` | Nutrition and S&C |
| Around training, meal ideas, matchday plan | `GuidanceAccordion` | `useNutritionGuidance`, G-4 | none, G-4 | Nutrition and S&C |
| Who set it and when | `ProvenanceLine` | `useMyNutritionTargets` | `nutrition_targets.created_by`, `effective_from`, `users` | None |

### 4.10 `/me` and its children, screens 29, 31, 43

`19-page-flows.md` §3.29 and §3.31.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Settings list, athlete | `SettingsList` | `useSettingsRoot` (`qk.org`) | `users`, `user_roles`, `organisations.settings` | Rows open their own routes |
| Under-18 standing statement | `MinorTransparencyNote` | `useMinorStatus` (`qk.org`) | `athletes.date_of_birth`, `athletes.parental_consent_recorded_at` | None. Required by the Children's Code |
| Edit my profile | `ProfileForm` | `useUpdateProfile` | `users.full_name`, `phone`, `avatar_url`, `athletes.position`, `squad_number` | Athlete, own profile |
| Notifications | `NotificationPreferenceList` | `useNotificationPreferences`, G-5 | `notification_preferences`, G-5 | Athlete, for themselves |
| Privacy and my data | `PrivacyPanel` | `useConsentState`, G-11 | `athletes.consent_given_at`, `consent_version` | Athlete, for themselves |
| Export my data | `AthleteExportPanel` | `useMyExports` (`qk.exports.mine`) | `export_jobs`, `export_job_downloads` | One button, no configuration |
| Leaderboard opt-ins | `BoardOptInList` | `useMyBoardOptIns` (`qk.leaderboards.mine`) | `leaderboards`, `leaderboard_opt_outs` | Athlete. Under-18 start off |
| Delete my account | `AccountDeletionDialog` | `useRequestErasure` | `export_jobs` with `export_type = 'erasure_record'`, `audit_log` | Athlete requests, club decides |

### 4.11 `/onboarding/:step`, screen 33

`19-page-flows.md` §3.33.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Welcome, which club | `OnboardingWelcome` | `useInvite` | `organisations`, `users.status` | None |
| Password or passkey | `CredentialStep` | `useSetCredential` | `users` | The invitee |
| Confirm your details | `DetailsStep` | `useAthleteSelf` (`qk.squad.athlete`) | `athletes`, `users` | The invitee. Skippable |
| Position, number, groups | `SquadDetailsStep` | `useAthleteSelf` | `athletes.position`, `squad_number`, `group_memberships` | The invitee. Skippable |
| What is collected | `TransparencyStep` | `useNotice` | `athletes.consent_version` | None. Cannot be skipped |
| Under-18 version | `TransparencyStepChild` | `useNotice` | `athletes.date_of_birth`, `parental_consent_recorded_at` | None |
| Optional extras | `OptionalExtrasStep` | `useConsentSet`, G-11 | `leaderboard_opt_outs` | The invitee. All off to start |
| Reminders | `ReminderStep` | `useNotificationPreferences`, G-5 | `notification_preferences`, G-5 | The invitee |

### 4.12 `/dashboard`, screen 8

`19-page-flows.md` §3.8. Panel order is role dependent: see §5.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Header, group filter and date | `GroupFilter` *(DS)*, `PeriodSelector` *(DS)* | `useGroups` (`qk.groups.list`), `useTeams` (`qk.teams.list`) | `groups`, `group_memberships`, `teams`, `team_allocations` | Coach, S&C, medical and admin manage groups at `/settings/groups` |
| Availability strip | `MetricTile` *(DS)*, `AvailabilityPill` *(DS)* | `useAvailabilityCounts` (`qk.availability.counts`) | `availability`, `athletes` | Medical only |
| Not fully available list | `AvailabilityList` | `useNotFullyAvailable` (`qk.availability.list`) | `availability`, `injuries`, `athletes` | Medical only. A coach sees no control at all |
| Attention list | `AttentionRow` | `useDashboardAttention` (`qk.flags.list`) | `flags`, `availability`, `injuries`, `mv_daily_athlete_summary`, `mv_acute_chronic_load`, `mv_wellness_baselines`, `compliance_expectations` | Acknowledge, action, dismiss: coach and medical |
| Today's timetable | `SessionCard` *(DS)* | `useDaySessions` (`qk.schedule.week`) | `sessions`, `session_participants`, `group_memberships`, `fixtures` | Edit, top right of the frame, opens `/schedule?date=`. Coach and medical |
| Wellness compliance | `ComplianceRing` *(DS)* | `useComplianceToday` (`qk.compliance.squadDay`) | `mv_compliance_rates`, `compliance_expectations`, `wellness_entries_current` | None. It is derived |
| Injury board, expanded, medical order | `InjuryBoardPanel` | `useInjuryBoard` (`qk.injuries.board`) | `injuries`, `availability`, `rehab_assignments`, `athletes` | Availability: medical only |

`injury_clinical` is not joined, not selected from and not reachable from any query on this
page, per `screens/dashboard.md`.

### 4.13 `/flags` and `/flags/:flagId`, screen 10

`19-page-flows.md` §3.10.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Domain tabs with counts | `SegmentedControl` *(DS)* | `useFlagCounts` (`qk.flags.list`) | `flags` | None |
| Open or closed, severity | `FlagFilterBar` | none, URL state (`?status=&severity=`) | none | None |
| Flag card | `FlagCard` | `useFlags` (`qk.flags.list`) | `flags`, `thresholds`, `threshold_revisions`, `athletes` | None. A flag is raised by a rule |
| Flag context chart | `DomainChart` *(DS)* | `useFlagDetail` (`qk.flags.detail`) | `flags`, `wellness_entries_current`, `training_entries_current`, `gps_records`, `mv_wellness_baselines` | None |
| Acknowledge, Action, Dismiss | `FlagActionBar` | `useFlagAction` | `flag_actions`, `flags.acknowledged_at`, `athlete_visible_at` | Coach and medical. Anyone else sees no buttons |
| Retune offer | `RecalibrationNotice` | `useThresholdRecalibration` (`qk.thresholds.recalibration`) | `thresholds`, `threshold_revisions`, `flag_actions` | Coach only. Medical cannot change rules |

### 4.14 `/injuries`, screen 12

`19-page-flows.md` §3.12.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Board or Timeline | `SegmentedControl` *(DS)* | none, URL state (`?view=board\|timeline`) | none | None |
| Availability counts | `MetricTile` *(DS)* | `useAvailabilityCounts` (`qk.availability.counts`) | `availability` | Medical only |
| Unavailable, Modified, Available | `InjuryBoardList` | `useInjuryBoard` (`qk.injuries.board`) | `injuries`, `availability`, `athletes`, `rehab_assignments` | Medical only |
| Clinical columns | `ClinicalColumns` | `useInjuryClinical` (`qk.injuries.clinical`) | `injury_clinical` | Medical only. Not rendered, not fetched, for a coach |
| Set availability sheet | `AvailabilitySheet` | `useSetAvailability` | `availability`, `injuries.expected_return`, `audit_log` | Medical only, everywhere |
| Return timeline | `ReturnTimeline` | `useReturnTimeline` (`qk.injuries.timeline`) | `injuries.expected_return`, `fixtures` | None |
| Rehab groups, Team allocation links | `BoardNavLinks` | none | none | Open `/injuries/rehab-groups`, `/injuries/team-allocation` |

Admin opens this route and receives counts only, with no athlete names, per
`19-page-flows.md` §3.12. That is a different query, `useAvailabilityCounts`, and the list
queries are not issued at all.

### 4.15 `/injuries/:injuryId`, screen 13

`19-page-flows.md` §3.13. Medical only.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Header | `InjuryHeader` | `useInjury` (`qk.injuries.detail`) | `injuries`, `athletes` | Pencil per row, medical |
| SHARED block | `SharedInjuryBlock` | `useInjury` | `injuries.body_area`, `side`, `onset_date`, `status`, `expected_return`, `occurred_in`, `sessions` | Pencil per row, medical. A coach sees no pencils |
| CLINICAL block | `ClinicalInjuryBlock` | `useInjuryClinical` (`qk.injuries.clinical`) | `injury_clinical`, `audit_log` | Medical only. Every read is audited |
| Availability row | `AvailabilitySheet` | `useSetAvailability` | `availability` | Medical only |
| Rehab tab | `RehabPlanPanel` | `useRehabAssignment` (`qk.injuries.rehab`) | `rehab_assignments`, `programmes`, `programme_assignments` | Medical only |
| Athlete view tab | `AthletePreview` | `useInjury` | `injuries`, `availability` | None. It is a preview |
| History tab | `ChangeHistoryList` | `useInjuryHistory` (`qk.injuries.history`) | `audit_log` | None |

### 4.16 `/injuries/rehab-groups`, screen 42

`19-page-flows.md` §3.36.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Unallocated | `UnallocatedList` | `useRehabGroups` (`qk.injuries.rehabGroups`) | `injuries`, `rehab_assignments`, `athletes` | Medical only |
| Group card | `RehabGroupCard` | `useRehabGroups` | `groups` with `group_type = 'rehab'`, `rehab_assignments.rehab_group_id`, `sessions` | Edit on the card, medical only |
| Members | `RehabMemberList` | `useRehabGroupMembers` (`qk.injuries.rehabGroups`) | `rehab_assignments`, `injuries.body_area`, `session_attendance` | Medical only |
| Phase mismatch mark | `PhaseMismatchBadge` | `useRehabGroupMembers` | `rehab_assignments.phase` | None |
| Assign a rehab programme | `AssignRehabProgramme` | `useAssignRehabProgramme` | `programme_assignments`, `programmes` with `programme_type = 'rehab'` | Medical only. Coaches cannot assign rehab programmes anywhere |

A coach opening this route sees the membership, the meeting time and the size, with no
buttons and no `injuries.body_area` column.

### 4.17 `/injuries/team-allocation`, screen 14

`19-page-flows.md` §3.14.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Week bar, Draft or Published | `AllocationWeekBar` | `useTeamAllocations` (`qk.teams.week`) | `team_allocations`, `teams` | Coach |
| Pool | `AllocationPool` | `useAllocatablePool` (`qk.teams.week`) | `athletes`, `availability`, `team_allocations` | Coach |
| Not allocatable | `NotAllocatableList` | `useAllocatablePool` | `availability`, `injuries.body_area` | Availability itself: medical only |
| Team lanes | `TeamLane` | `useTeamAllocations` | `teams`, `team_allocations`, `fixtures` | Coach. Medical read only |
| Positional balance and warnings | `LaneWarnings` | `useLaneWarnings` (`qk.teams.week`) | `athletes.position`, `sessions`, `fixtures`, `team_allocations` | None. Names, not counts |
| Publish | `PublishAllocationDialog` | `usePublishAllocation` | `team_allocations.status`, `published_at`, `published_by`, `audit_log` | Coach only |
| Copy last week | `CopyWeekButton` | `useCopyAllocationWeek` | `team_allocations` with `source = 'copied_from_week'` | Coach |

### 4.18 `/squad`, screen 9

`19-page-flows.md` §3.9.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Day or Week | `SegmentedControl` *(DS)* | none, URL state (`?view=day\|week`) | none | None |
| Domain tabs | `SegmentedControl` *(DS)* | none, URL state (`?domain=`) | none | None |
| Summary line | `ComplianceSummary` | `useSquadCompliance` (`qk.compliance.squadDay`) | `mv_compliance_rates`, `compliance_expectations` | None |
| Missing, pinned | `ComplianceList` | `useSquadCompliance` | `compliance_expectations`, `wellness_entries_current`, `training_entries_current`, `gym_session_logs`, `athletes` | None. An entry belongs to the athlete |
| Due, Complete, Waived | `ComplianceList` | `useSquadCompliance` | `compliance_expectations.waived_reason` | Waive: coach |
| Chase | `ChaseDialog` | `useChaseMissing`, G-13 | `compliance_expectations`, and G-13 for the send | Coach and medical |
| Week grid | `ComplianceCell` *(DS)* | `useSquadComplianceWeek` (`qk.compliance.squadWeek`) | `mv_compliance_rates`, `compliance_expectations`, `sessions.md_offset` | None |
| Who I can pick | `SelectionSheet` | `useSelectableSquad` (`qk.availability.list`) | `availability`, `injuries.body_area`, `athletes.position` | None. O-1040 is whether this earns its own route |

### 4.19 `/squad/roster`, screen 19

`19-page-flows.md` §3.19.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Search, sort, filters | `RosterToolbar` | none, URL state (`?q=&sort=`) | none | None |
| Active group banner | `GroupFilterBanner` | `useGroups` (`qk.groups.list`) | `groups`, `group_memberships` | None |
| Athlete rows | `AthleteCard` *(DS)* | `useSquadList` (`qk.squad.list`) | `athletes`, `availability`, `group_memberships`, `mv_compliance_rates`, `teams` | Basic details: coach and admin |
| Select mode action bar | `BulkActionBar` | `useBulkGroupAdd`, `useBulkAssignProgramme` | `group_memberships`, `programme_assignments` | Add to group: coach, medical, admin. Assign programme: coach |
| Add athlete | `AddAthleteSheet` | `useCreateAthlete` | `athletes`, `group_memberships` | Coach and admin |

### 4.20 `/squad/:athleteId`, screen 20

`19-page-flows.md` §3.20. The tab opened is a search param, `?tab=`, see §6.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Identity block | `AthleteIdentity` | `useAthlete` (`qk.squad.athlete`) | `athletes`, `teams`, `group_memberships` | Pencil: coach and admin |
| Availability line | `AvailabilityPill` *(DS)* | `useAthleteAvailability` (`qk.availability.athlete`) | `availability`, `injuries` | Medical only |
| 1. Load | `DomainChart` *(DS)* | `useAthleteLoad` (`qk.squad.athlete`) | `mv_acute_chronic_load`, `training_entries_current`, `gps_records` | None |
| 2. Wellness, and sub-metrics | `DomainChart` *(DS)* | `useAthleteWellness` (`qk.wellness.history`) | `wellness_entries_current`, `mv_wellness_baselines` | None. Entries belong to the athlete |
| 3. Prescribed against completed | `AdherencePanel` | `useAthleteAdherence` (`qk.programme.resolvedForAthlete`) | `mv_programme_adherence`, `programme_exercises`, `gym_set_logs` | None. A blank is not a zero |
| 4. Injury and availability this season | `InjuryHistoryPanel` | `useAthleteInjuries` (`qk.injuries.athlete`) | `injuries`, `availability` | Medical only. Coach sees no clinical column |
| Testing | `TestHistoryList` | `useAthleteTests` (`qk.testing.athlete`) | `test_results`, `test_definitions` | Log results: coach and medical |
| Restrictions | `RestrictionList` | `useAthleteAvailability` | `availability.restrictions`, `set_by`, `effective_from` | Medical only |
| Open flags | `FlagCard` | `useAthleteFlags` (`qk.flags.list`) | `flags`, `flag_actions` | Coach and medical |
| Nutrition tab | `NutritionTargetCard` | `useAthleteNutrition` (`qk.nutrition.athlete`) | `nutrition_targets`, `nutrition_checkins`, `body_composition` | Nutrition and S&C. Medical if an open injury |
| GPS tab | `GpsPanel` | `useAthleteGps` (`qk.squad.athlete`) | `gps_records`, `import_batches` | None |
| Quick actions | `QuickActionMenu` | `useStaffEntry`, `useCreateExport` | `wellness_entries` with `source = 'staff_entered'`, `exercise_overrides`, `flags`, `export_jobs` | Coach and medical |

### 4.20a `/squad/:athleteId/{nutrition,wellness,gym}`, screen 20a

**No `screens/` spec exists for these three and none is claimed.** They were built to a
direct client request — *"on the player profile when i click on the buttons nutrition,
wellness and gym i should be taken to a new page with just that info in it and be able
to edit it if i need to, there should also be a comparison to other people in their
position"* — narrowed by the same client's follow-up: *"dont allow editing of gym,
nutrition, or wellness in players profile just make it veiwable and only editable by the
staff incharge"*. So the "be able to edit it" half of the first message is deliberately
NOT built; each page links out to the single owner of that domain's edit instead.

They are the destinations of the three `DomainChips` on `/squad/:athleteId`, which
previously scroll-anchored to cards on that page (Nutrition, Wellness) or linked to
`/programmes/:programmeId/athlete/:athleteId` when one existed (Gym).

| Page | Shows | Edits live at |
|---|---|---|
| `/squad/:athleteId/nutrition` | Targets in force today (resolved), every live plan row that reaches him (athlete / group / club default), body mass with the staff target range (migration 0060, **staff-only**), weekly check-ins | `/nutrition` — coach or medical |
| `/squad/:athleteId/wellness` | Readiness trend against his own 14-day baseline, submission rate, period means for the five 1–5 scales and sleep hours | `/squad/:athleteId#pp-corrections-title` — the audited correction path, coach or medical (migration 0058) |
| `/squad/:athleteId/gym` | Every programme assignment that reaches him including group-assigned and suspended ones, active tailoring, completed session log | `/programmes/:programmeId` — coach, or **medical for a rehab programme** |

**Positional comparison.** Every one of the three carries a "Compared with his position"
card: an aggregate band (unit median, interquartile range) with this athlete as a marker.
Never a ranked list of named team-mates — `supabase/migrations/0016_leaderboards.sql` bars
wellness and body composition from rankings by name, and a league table here would route
around that. Suppressed below five athletes with a value. Two groupings are used, both
pre-existing: the `positional` **group** for Wellness and Gym (the same peer set
Athleticism and the training report's "vs unit" already use), and
`POSITION_TO_UNIT`'s six rugby units for Nutrition (mass drives energy targets, and mass
is what separates a prop from a back-rower inside "Forwards").

**Params.** `?groups=` and `?period=` per §6, both falling back to their sticky cookies.
The group filter scopes the positional comparison — it aggregates other athletes, so
CLAUDE.md §3 applies — and the card states the scope and how many of the unit the filter
excluded. `day` is offered disabled with its reason on all three: every figure is a mean,
a count or a rolling band.

### 4.21 `/schedule`, screen 15

`19-page-flows.md` §3.15.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Day, Week, Month | `SegmentedControl` *(DS)* | none, URL state (`?view=`) | none | None |
| Planned load bars | `PlannedLoadBars` | `useScheduleWeek` (`qk.schedule.week`) | `sessions.planned_load`, `planned_rpe` | Follows the sessions |
| Day blocks with MD-n | `ScheduleDayBlock` | `useScheduleWeek` | `sessions.md_offset`, `fixtures` | Plus button: coach and medical |
| Session cards | `SessionCard` *(DS)* | `useScheduleWeek` | `sessions`, `session_participants`, `groups` | Coach and medical |
| New session sheet | `SessionEditSheet` | `useUpsertSession` | `sessions`, `session_participants` | Coach and medical |
| Move confirmation | `MdShiftDialog` | `useMoveSession` | `sessions.starts_at`, `md_offset` | Coach and medical |
| Apply a week template | `ApplyTemplateButton` | none, opens `/schedule/templates` | `week_templates` | Coach |

### 4.22 `/schedule/timetable`, screen 11

`19-page-flows.md` §3.11.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Day strip | `WeekStrip` | `useScheduleWeek` (`qk.schedule.week`) | `sessions`, `fixtures` | None |
| Session cards with counts | `SessionCard` *(DS)* | `useDaySessions` (`qk.schedule.week`) | `sessions`, `session_participants`, `session_attendance` | Coach and medical, on `/schedule` |
| Restriction warning line | `RestrictionWarning` | `useSessionRestrictions` (`qk.availability.list`) | `availability`, `injuries.body_area` | Medical only. It never says why |
| Mark all present | `BulkAttendanceButton` | `useMarkAttendance` | `session_attendance` | Coach and medical |
| Attendance rows | `AttendanceRow` | `useMarkAttendance` (local write plus outbox) | `session_attendance.attendance`, `modified_reason` | Coach and medical. Works with no signal |

### 4.23 `/schedule/fixtures` and `/schedule/fixtures/:fixtureId`, screens 41 and 17

`19-page-flows.md` §3.17. The list, screen 41, has no specification: G-2.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Fixture list | `FixtureList` | `useFixtures` (`qk.schedule.fixtures`) | `fixtures`, `seasons` | Coach. Specification missing, G-2 |
| Fixture card | `FixtureCard` | `useFixture` (`qk.schedule.fixture`) | `fixtures` | Edit, top right: coach |
| The week it anchors | `MdAnchorStrip` | `useScheduleWeek` (`qk.schedule.week`) | `sessions.md_offset`, `fixtures.kickoff_at` | Coach |
| Availability now | `MetricTile` *(DS)* | `useAvailabilityCounts` (`qk.availability.counts`) | `availability`, `injuries.expected_return` | Medical only |
| Selection tab | `SelectionBoard` | `useFixtureSelection`, G-3 | `team_allocations`, and G-3 for starting against bench | Coach |
| Publish squad | `PublishSelectionDialog` | `usePublishSelection` | `team_allocations.status`, `published_at`, `audit_log` | Coach |
| Sessions this week | `SessionCard` *(DS)* | `useScheduleWeek` | `sessions` | Coach and medical |

### 4.24 `/schedule/templates` and `/schedule/templates/:templateId`, screen 18

`19-page-flows.md` §3.18.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Template list | `TemplateCard` | `useWeekTemplates` (`qk.schedule.templates`) | `week_templates` | Coach |
| Load chart | `TemplateLoadChart` | `useWeekTemplate` (`qk.schedule.template`) | `week_templates.structure` | None. It follows the sessions |
| Day blocks | `TemplateDayBlock` | `useWeekTemplate` | `week_templates.structure` | Coach |
| Required entries ticks | `RequiredEntryToggles` | `useWeekTemplate` | `week_templates.structure`, mapped to `sessions.requires_wellness`, `requires_rpe` | Coach |
| Apply preview and clashes | `TemplateApplyPreview` | `useTemplateApplyPreview` | `sessions`, `fixtures` | Coach |
| Commit | `TemplateCommitButton` | `useCommitTemplate` | `sessions`, `compliance_expectations` | Coach. Nothing is written until this |

`sessions.requires_nutrition` is dead and is never read or written, per `04-data-model.md` §4
and `CLAUDE.md` rule 8.

### 4.25 `/schedule/:sessionId`, screen 16

`19-page-flows.md` §3.16.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| When and where | `SessionHeader` | `useSession` (`qk.schedule.session`) | `sessions`, `fixtures` | Edit sheet: coach and medical |
| Planned effort and load | `PlannedLoadPanel` | `useSession` | `sessions.planned_rpe`, `planned_load` | Coach |
| Required entries | `RequiredEntryToggles` | `useSession` | `sessions.requires_wellness`, `requires_rpe` | Coach |
| Participants | `ParticipantList` | `useSessionParticipants` (`qk.schedule.session`) | `session_participants`, `group_memberships`, `athletes`, `availability` | Coach and medical |
| Attendance tab | `AttendanceRow` | `useMarkAttendance` | `session_attendance` | Coach and medical |
| Load tab | `PlannedActualPanel` | `useSessionLoad` (`qk.schedule.session`) | `training_entries_current`, `gps_records`, `sessions.planned_load` | None |
| Attached gym programme | `AttachedProgrammeCard` | `useSessionProgramme` (`qk.programme.all`) | `programmes`, `programme_sessions` | Coach |
| Gym floor view | `GymFloorBoard` | `useLiveGymSession` (`qk.gym.live`) | `gym_session_logs`, `gym_set_logs`, `programme_exercises`, `exercise_overrides` | Change load, add set, swap for today: coach |

### 4.26 `/schedule/testing` and `/schedule/testing/:sessionId/log`, screen 25

`19-page-flows.md` §3.25.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Upcoming sessions | `TestingSessionCard` | `useTestingSessions` (`qk.testing.sessions`) | `sessions` with `session_type = 'testing'`, `session_tests`, `test_results` | Coach and medical |
| Edit battery | `BatterySheet` | `useTestBatteries` (`qk.testing.batteries`) | `test_batteries`, `test_battery_items`, `session_tests` | Coach and medical |
| Print sheet | `PrintSheetButton` | `useTestingSession` | `session_tests`, `test_definitions`, `session_participants` | None |
| Logging grid | `TestLoggingGrid` | `useLogTestResult` (local write plus outbox) | `test_results`, `test_definitions.default_attempts`, `side_mode`, `min_plausible`, `max_plausible` | Coach and medical, on an athlete's behalf |
| Excused | `ExcusedToggle` | `useLogTestResult` | `test_results`, `compliance_expectations.waived_reason` | Coach and medical. Excused is not a zero |

### 4.27 `/reports` and children, screens 28, 37, 25

`19-page-flows.md` §3.28 and §3.35.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Five report cards | `ReportCard` | `useReportCatalogue` (`qk.reports.catalogue`) | `saved_views` with `view_type = 'report'` | Run or schedule: coach and medical |
| Import GPS entry point | `ImportEntryButton` | none, opens `/settings/imports` | `import_batches` | Coach and medical. O-1100 |
| Recent runs | `ReportRunList` | `useReportRuns` (`qk.reports.runs`) | `report_runs` | The person who ran it |
| Report viewer pager | `ReportPager` | `useReportRun` (`qk.reports.run`) | `report_runs`, `saved_views` | None |
| Export | `ExportButton` | `useCreateExport` (`qk.exports.jobs`) | `export_jobs`, `export_job_downloads` | Coach and medical |
| Schedules | `ReportScheduleList` | `useReportSchedules` (`qk.reports.schedules`) | `report_schedules` | Coach and medical |
| Injury and availability report, clinical pages | `ClinicalReportPages` | `useInjuryReport` (`qk.reports.run`) | `injuries`, `availability`, `injury_clinical` | Medical only, for the clinical pages |
| Training report tiles | `MetricTile` *(DS)* | `useTrainingReport` (`qk.reports.training`) | `gps_records`, `sessions`, `flags` | None |
| Training report date chips | `DateChipRow` | `useTrainingReportSessions` (`qk.reports.training`) | `sessions`, `gps_records` | None |
| Training report metric selector | `MetricSelector` | `useMetricCatalogue` (`qk.analytics.metrics`) | `metric_definitions` | None |
| The board | `TrainingReportTable` | `useTrainingReport` | `gps_records`, `athletes`, `group_memberships`, `mv_daily_athlete_summary` | None. It comes from the imported file |
| Testing results history | `TestResultHistory` | `useTestHistory` (`qk.testing.history`) | `test_results`, `test_definitions` | None |

Athletes cannot reach `/reports/training` at all: it is not present in the athlete shell, per
`19-page-flows.md` §3.35 and the shell rule in `08-notifications.md` §7 resolution rule 4.

### 4.28 `/nutrition`, screen 24

`19-page-flows.md` §3.24.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Unintentional mass change against load | `MassAgainstLoadPanel` | `useMassAgainstLoad` (`qk.nutrition.massLoad`) | `body_composition`, `wellness_entries_current.body_mass_kg`, `mv_acute_chronic_load` | None. Measurements are entered when taken |
| Suppressed players, Show | `SuppressedRowsToggle` | `useMassAgainstLoad` | `body_composition`, `nutrition_targets.reason` | Nutrition and S&C |
| Squad body composition | `BodyCompositionTable` | `useBodyComposition` (`qk.nutrition.bodyComp`) | `body_composition` | Nutrition staff, when recording. No sort, no ranking |
| Squad target grid | `TargetGrid` | `useResolvedTargets` (`qk.nutrition.grid`) | `nutrition_targets`, `groups`, `athletes`, `organisations.settings` | Edit, top right of the frame. Nutrition and S&C, medical for an open injury |
| Weekly protein check-in | `CheckinSummary` | `useCheckinWeek` (`qk.nutrition.checkins`) | `nutrition_checkins` | Only the athlete answers |
| Prompt list | `PromptList` | `useCheckinWeek` | `nutrition_checkins`, `athletes` | None |

`nutrition_entries` is dormant and is never read on this page or any other, per `CLAUDE.md`
rule 8.

### 4.29 `/programmes` and children, screens 23 and 22

`19-page-flows.md` §3.23 and §3.22.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Active, Templates, Archived | `SegmentedControl` *(DS)* | none, URL state (`?status=`) | `programmes.status`, `is_template` | Coach |
| Programme cards | `ProgrammeCard` | `useProgrammes` (`qk.programme.list`) | `programmes`, `programme_assignments`, `exercise_overrides`, `mv_programme_adherence` | Coach |
| By athlete view | `ProgrammeByAthlete` | `useProgrammesByAthlete` (`qk.programme.byAthlete`) | `programme_assignments`, `athletes`, `mv_programme_adherence` | Coach |
| New programme | `NewProgrammeMenu` | `useCreateProgramme` | `programmes.parent_id`, `is_template` | Coach |
| Exercise library | `ExerciseLibrary` | `useExercises` (`qk.programme.exercises`) | `exercises` | Coach |
| Programme tree | `ProgrammeTree` | `useProgrammeStructure` (`qk.programme.structure`) | `programme_blocks`, `programme_sessions`, `programme_exercises` | Coach |
| Exercise editor | `ExerciseEditor` | `useUpsertProgrammeExercise` | `programme_exercises`, `programme_change_events` | Coach |
| Missing best lift notice | `LoadBasisWarning` | `useLoadResolution` (`qk.programme.loadResolution`) | `exercises.one_rm_test_definition_id`, `test_results` | None |
| Assign tab | `AssignPanel` | `useAssignProgramme` | `programme_assignments`, `groups`, `athletes` | Coach. Medical assign rehab programmes only |
| Tailor tab | `TailorPanel` | `useUpsertOverride` | `exercise_overrides` | Coach |
| Divergence tab | `DivergenceList` | `useDivergences` (`qk.programme.divergences`) | `programme_change_events`, `programme_change_divergences` | None |

### 4.30 `/leaderboards`, screen 26

`19-page-flows.md` §3.26.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Board list | `BoardCard` | `useBoards` (`qk.leaderboards.list`) | `leaderboards`, `metric_definitions`, `leaderboard_opt_outs` | Coach and medical |
| New board | `BoardBuilderSheet` | `useCreateBoard` | `leaderboards`, `metric_definitions.leaderboard_eligible`, `ineligible_reason` | Coach and medical |
| Refused metric explanation | `IneligibleMetricNote` | `useMetricCatalogue` (`qk.analytics.metrics`) | `metric_definitions.ineligible_reason`, `test_definitions.leaderboard_eligible` | None. It is a product rule |
| Board ranking | `BoardRanking` | `useBoardRanking` (`qk.leaderboards.detail`) | `leaderboards`, `test_results`, `gps_records`, `gym_set_logs`, `leaderboard_opt_outs`, `athletes` | Coach and medical |
| Publish | `PublishBoardDialog` | `usePublishBoard` | `leaderboards.visibility` | Coach and medical |
| Hide from one player | `SuppressAthleteDialog` | `useSuppressFromBoard` | `leaderboard_opt_outs` with `opt_out_source = 'medical'` | Medical only. The reason is never shown to a coach |

### 4.31 `/analytics`, screen 27

`19-page-flows.md` §3.27.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Preset panels | `PresetCard` | `usePresets` (`qk.analytics.presets`) | `saved_views`, `metric_definitions` | Save own views: coach and medical |
| Drift, ranked | `DriftPanel` | `useAnalyticsRun` (`qk.analytics.run`) | `mv_wellness_baselines`, `mv_daily_athlete_summary`, `wellness_entries_current`, `gps_records` | None |
| Sources listed | `SourceProvenanceList` | `useAnalyticsRun` | `metric_definitions.source_table`, `import_batches` | None |
| Refused answer | `InsufficientDataGuard` | `useAnalyticsRun` | `metric_definitions.min_population` | None. It refuses rather than drawing |
| Export rows | `ExportButton` | `useCreateExport` (`qk.exports.jobs`) | `export_jobs` | Coach and medical |
| Query builder | `QueryBuilder` | `useSaveView` | `saved_views`, `metric_definitions` | Coach and medical |
| Correlation | `CorrelationPanel` | `useCorrelation` (`qk.analytics.run`) | `metric_definitions`, `mv_acute_chronic_load`, `wellness_entries_current`, `nutrition_checkins` | None |

Injury metrics on this page resolve to `injuries` and `availability` only.
`injury_clinical` is not an analytics source for any role, per `screens/analytics.md`.

### 4.32 `/settings` and children, screens 29, 30, 34, 31, 21, 32

`19-page-flows.md` §3.29 to §3.34.

| Panel | Component | Query | Tables | Edit |
|---|---|---|---|---|
| Settings list, staff | `SettingsList` | `useSettingsRoot` (`qk.org`) | `users`, `user_roles`, `organisations.settings` | Rows differ per role. No greyed out doors |
| Threshold counts and flag volume | `ThresholdSummary` | `useThresholds` (`qk.thresholds.list`) | `thresholds`, `flags` | Coach only |
| Retune notice | `RecalibrationNotice` | `useThresholdRecalibration` (`qk.thresholds.recalibration`) | `thresholds`, `threshold_revisions`, `flag_actions` | Coach only |
| Rule rows, as sentences | `ThresholdRow` | `useThresholds` | `thresholds`, `metric_definitions` | Coach only. Medical cannot open this route |
| Rule editor, four steps | `ThresholdEditSheet` | `useUpsertThreshold` | `thresholds`, `threshold_revisions` | Coach only |
| Import drop area | `ImportDropZone` | `useParseImport` | `vendor_profiles`, `import_batches` | Coach and medical |
| Matched session and confidence | `SessionMatchPanel` | `useParseImport` | `sessions`, `import_batches` | Coach and medical |
| Units check | `UnitCheckPanel` | `useParseImport` | `vendor_profiles.unit_map` | Coach and medical |
| Exceptions only | `ImportExceptionList` | `useParseImport`, partly G-7 | `import_batches.errors`, and G-7 for per-row state and aliases | Coach and medical. No row is silently dropped |
| Import and Undo | `ImportCommitBar` | `useCommitImport`, `useUndoImport` | `gps_records`, `import_batches`, `gps_records.superseded_by`, `deleted_at` | Coach and medical |
| Export builder | `ExportScopePicker` | `useCreateExport` (`qk.exports.jobs`) | `export_jobs.scope`, `metric_definitions` | Each role within what it can read |
| Locked rows | `LockedScopeRow` | `useCreateExport` | `export_jobs.contains_clinical`, `sar_clinical_reviews` | Medical only |
| Export history | `ExportHistoryList` | `useExportJobs` (`qk.exports.jobs`) | `export_jobs`, `export_job_downloads` | The person who created it |
| Group cards | `GroupCard` | `useGroups` (`qk.groups.list`) | `groups`, `group_memberships` | Coach, medical and admin |
| Group members and past members | `GroupMemberList` | `useGroupMembers` (`qk.groups.detail`) | `group_memberships.added_at`, `removed_at` | Coach, medical and admin |
| Players in no group | `UngroupedList` | `useUngroupedAthletes` (`qk.groups.list`) | `athletes`, `group_memberships` | Coach, medical and admin |
| User table and counts | `UserTable` | `useUsers` (`qk.users.list`) | `users`, `user_roles`, `athletes.user_id` | Admin only |
| Roles tick boxes | `RoleCheckboxes` | `useSetUserRoles` | `user_roles`, `audit_log` | Admin only. Roles add up |
| Link to an athlete record | `AthleteLinkPanel` | `useLinkAthlete` | `athletes.user_id` | Admin only |
| What this user can see | `PermissionPreview` | `useUsers` | `user_roles` | None |
| Deactivate | `DeactivateDialog` | `useDeactivateUser` | `users.status`, `audit_log` | Admin only. Nobody is deleted |
| Club details, billing, retention | `OrgSettingsForm` | `useOrgSettings` (`qk.org`) | `organisations`, `organisations.settings` | Admin only |
| Audit log | `AuditLogViewer`, G-8 | `useAuditLog`, G-8 | `audit_log` | Admin only. Screen 35 has no specification |

**235 panel bindings across the 65 routes.** The manifest in §9 lists 245 panel slots, because
a panel bound once here appears on more than one route: the availability banner, the export
button, the profile form, the notification preference list and the exercise library are each
bound once and used twice.

---

## 5. The dashboard's role-dependent panel order, as data

From `02-information-architecture.md` §4.2. The panels are the same for everybody. Only the
order, and whether a panel starts expanded, is resolved from the signed-in user's role. This
is ordering, not a second dashboard, and there is no medical sidebar row.

```ts
export type DashboardPanelId =
  | 'availability-strip'
  | 'not-fully-available'
  | 'attention-list'
  | 'todays-timetable'
  | 'wellness-compliance'
  | 'injury-board';

export type DashboardPanelSlot = {
  panel: DashboardPanelId;
  /** Starts open rather than collapsed. */
  expanded?: boolean;
  /** Counts only, no athlete names. Drives which query is issued, not a render filter. */
  aggregateOnly?: boolean;
  /** Narrows the panel's own query. Used for the medical flag slot. */
  domains?: readonly ('wellness' | 'gym' | 'gps' | 'compliance' | 'testing')[];
};

/**
 * Resolved server side from roles on the session and passed to the shell.
 * A user holding two roles takes the first matching entry in this order:
 * medical, coach, admin. A player coach sees the coach order.
 */
export const DASHBOARD_PANEL_ORDER: Record<AppRole, readonly DashboardPanelSlot[]> = {
  coach: [
    { panel: 'availability-strip' },
    { panel: 'not-fully-available' },
    { panel: 'attention-list' },
    { panel: 'todays-timetable' },
    { panel: 'wellness-compliance' },
  ],
  medical: [
    { panel: 'injury-board', expanded: true },
    { panel: 'availability-strip' },
    { panel: 'not-fully-available', expanded: true },
    { panel: 'attention-list', domains: ['wellness'] },
    { panel: 'todays-timetable' },
  ],
  admin: [
    { panel: 'wellness-compliance' },
    { panel: 'availability-strip', aggregateOnly: true },
  ],
  athlete: [],
} as const;
```

Three notes a developer needs before implementing this.

1. **`admin` is present because `02-information-architecture.md` §4.2 defines an admin order,
   and unreachable at v1 because `01-roles-and-permissions.md` §2 gives admin `no` for
   "View squad dashboard".** The route roles in §2.3 follow the permission matrix, which is
   normative, so an admin-only user does not open `/dashboard`. The entry stays here so the
   ordering is not reinvented if the contradiction is resolved the other way. See G-1.
2. **`athlete` is empty and that is deliberate.** The staff dashboard does not exist in the
   athlete shell, structurally, per `08-notifications.md` §7 resolution rule 4.
3. **`aggregateOnly` changes the query, not the rendering.** An aggregate panel issues
   `useAvailabilityCounts` and never issues `useNotFullyAvailable`. Filtering names out in the
   component would mean the names crossed the wire.

---

## 6. Navigation rules, at code level

### 6.1 Route params against search params

| Kind | Carries | Examples |
|---|---|---|
| **Route param** | The identity of the resource the page is about. Changing it is a different page. | `:athleteId`, `:sessionId`, `:flagId`, `:injuryId`, `:fixtureId`, `:templateId`, `:programmeId`, `:leaderboardId`, `:groupId`, `:userId`, `:batchId`, `:runId`, `:presetId`, `:entryDate`, `:step` |
| **Search param** | View state: what is filtered, which window, which tab, which sheet is open. Changing it is the same page seen differently. | `group`, `team`, `from`, `to`, `period`, `view`, `tab`, `domain`, `status`, `severity`, `metric`, `date`, `q`, `sort`, `open` |

Route params are uuids except `:entryDate`, which is `YYYY-MM-DD`, and `:presetId` and
`:step`, which are slugs. Search params are always strings; arrays are comma separated and
**sorted before they are written**, for the same reason query keys sort them
(`05-architecture.md` §9, rule 2).

### 6.2 The group filter and the date range live in the URL

This is the implementation of `CLAUDE.md` §3 and of the header rule in `19-page-flows.md`
§4.8, and it is not optional.

- `?group=<id>,<id>` holds the group filter, sorted, uuids only, absent when the filter is
  `All squad`. Teams are separate, `?team=<id>`, because `04-data-model.md` §17.13 keeps
  `teams` out of `groups` and the filter reads two sources (O-808).
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` holds the date range, or `?period=` where the page offers
  named windows only.

  **`?period=` is now real** (`src/lib/period.ts`, `src/components/PeriodSelector/`). Its
  values are the six keys the client asked for — *"from the day to the week to the season to
  the year to all"* — not the five this line used to name:

  `?period=day|week|month|season|year|all`

  `month` is 28 days, not a calendar month, because the whole model is anchored on the 7:28
  acute-to-chronic convention. `year` and `all` were missing from the older list and are
  explicitly requested; `today|this-week|last-7|last-28` were renamed to the keys the code has
  used since `/analytics` shipped, so the rename cost nothing. There is no `custom` key: no
  screen implements a custom range, and `?from=`/`?to=` already covers that case.

  Both open-ended keys are capped at `MAX_WINDOW_DAYS` (730), and `season` resolves against the
  org's current season row — the option is absent, not defaulted, for a club that has none.

  **Legacy period params still in the tree**, all readable through `readPeriodParam()` in
  `lib/period.ts` so a migrated control cannot make an unmigrated handler fall back to its
  default without saying so. (`periodToOfferedDays()` was the other half of that bridge, for
  handlers that still took a raw day count. All nine of those migrated in the same pass — see
  the `?days=` row below — so the function survives with no callers; it is not part of how
  these params are read today.)

  | Param | Where | Meaning | Status |
  |---|---|---|---|
  | `?range=day\|week\|month\|season\|year\|all` | `/analytics` | The same six keys | A pure rename to `?period=` |
  | `?range=day\|week` | `/reports/training` | **Not a period.** Which view: one session, or the week around it | Rename the *other* control; do not auto-convert |
  | `?range=all` | `/settings/audit` | **Not a period.** "Lift the default 90-day bound" | Boolean-shaped; do not auto-convert |
  | `?days=<number>` | *(read-only compatibility)* `/reports/compliance`, `/reports/injuries`, `/reports/athlete/[athleteId]` | A raw integer that used to come from a per-screen allow-list, duplicated across **nine** files — each report's `page.tsx`, `export/route.ts` and `pdf/route.tsx` | **Migrated.** All nine now resolve through `readPeriodParam()` and write `?period=`; existing `?days=` bookmarks still render, widened not narrowed, with the screen saying it approximated |

  All nine copies are gone. Each report resolves its period once, in a `period.ts` colocated
  with its routes (`reports/injuries/`, `reports/athlete/[athleteId]/`, `reports/compliance/`,
  `reports/testing/`), imported by its page, its CSV export and its PDF, so a value the page
  can offer but a handler cannot honour is a type error rather than a document that quietly
  covers the wrong window. The compliance and testing modules take the four resolution steps
  from `lib/reportPeriod.server.ts`; the other two still spell them out inline.

  The historical warning, kept because it is what the migration nearly tripped over: **grep
  the numbers, not `PERIODS`.** `compliance/export/route.ts` and `injuries/export/route.ts`
  inlined the array literal (`[7, 14, 28].includes(…)`) rather than naming the constant, so a
  search for `PERIODS` found only seven of the nine, and a migration trusting it would have
  left two export handlers reading the old param and silently falling back to their defaults.

  `/reports/testing` is a fifth case and was in none of the nine: it had **no** window param
  and no window, so its queries were unbounded rather than merely narrow. It now offers
  `month | season | year | all`, defaulting to `season`.

  **Migration status.** `/reports/injuries` and `/reports/athlete/[athleteId]` are migrated:
  all six of their files (each `page.tsx`, `export/route.ts`, `pdf/route.tsx`) now write and
  read `?period=` through one module colocated with the routes
  (`reports/injuries/period.ts`, `reports/athlete/[athleteId]/period.ts`), so a page and its
  own PDF handler cannot disagree about the window. Their legacy `?days=` bookmarks still
  render — `readPeriodParam()` widens rather than narrows when there is no exact key, and both
  screens print a caption saying they approximated. Offered keys differ per screen and are
  listed in `docs/screens/reports.md`, "The period control, as built", along with the two
  things the period deliberately does not reach: the athlete report's ACWR tiles (pinned to
  trailing 7:28, because that is what the ratio is) and the injury report's Current tab (live
  availability, never date-bounded).

  `?period=` also has a sticky `fydr-period` cookie, read by `resolvePeriod()` in
  `lib/period.server.ts` under the same present-versus-absent rule as the group filter: the URL
  wins whenever the key is present at all, including present and empty; only a genuinely absent
  key inherits.
- The global provider is the **owner** of the value and the URL is the **transport**. On
  navigation the provider writes the current filter into the next URL; on load a page reads
  the URL first and falls back to the persisted provider value. A URL without the params
  therefore inherits, and a URL with them wins.
- The consequence is the point: a filtered view is a link a coach can paste to a colleague,
  and it survives a refresh, a browser restore and a deep link. A filter held only in React
  context does neither.
- Three routes switch the group filter off entirely and must declare it:
  `/settings/imports`, because an import is about a file and not a group
  (`19-page-flows.md` §3.34); `/settings/users`; and `/settings/club`. The header renders the
  filter as absent, not as disabled.
- Every panel query that takes a population takes `groupIds` and puts it in its key, sorted.
  A screen that shows more than one athlete and does not is not finished.

### 6.3 What Back means

`02-information-architecture.md` §7 rule 3: back returns to the originating screen, not to a
canonical parent.

- Back is history based: `router.back()` on both shells, never a hard-coded parent path.
- The `parent` column in §2 and the `parent` field in the manifest describe **hierarchy**, for
  breadcrumbs, for the sidebar active state and for the deep-link fallback in 6.4 rule 5. It
  is not what Back does.
- An athlete profile opened from `/flags` returns to `/flags` with its filters intact, because
  the filters were in the URL that history restored.
- A route with no history entry, which is what a deep link produces, falls back to its
  `parent`. That is the only case where `parent` drives a back action.
- Leaving a route with unsaved input asks once, keep or discard, per `19-page-flows.md` §4.4.
  Implemented as a single navigation guard on the shell, not per form.

### 6.4 Deep links from push

`08-notifications.md` §7 sends role-namespaced routes. They are resolved in this order, and
the shell prefix is stripped to produce the paths in §2.

| Notification | Link sent | Resolves to | `required_roles` |
|---|---|---|---|
| `athlete.wellness.prompt` | `/athlete/today?open=wellness` | `/check-in` | athlete |
| `athlete.rpe.prompt` | `/athlete/today?open=rpe&session={id}` | `/rpe/:sessionId` | athlete |
| `athlete.availability.changed` | `/athlete/availability` | `/programme` | athlete |
| `athlete.programme.assigned` | `/athlete/programme/{assignment_id}` | `/programme` | athlete |
| `athlete.test.results` | `/athlete/my-data?tab=testing` | `/my-data?tab=testing` | athlete |
| `staff.flag.raised.high` | `/staff/flags/{flag_id}` | `/flags/:flagId` | coach, medical |
| `staff.flag.digest` | `/staff/flags?status=raised&date={date}` | `/flags?status=raised&date=` | coach, medical |
| `staff.availability.changed` | `/staff/athletes/{athlete_id}/availability` | `/squad/:athleteId?tab=injury` | coach, medical |
| `staff.injury.reported` | `/staff/medical/injuries/{injury_id}` | `/injuries/:injuryId` | medical |
| `staff.import.completed` | `/staff/imports/{import_batch_id}` | `/settings/imports/:batchId` | coach, medical |
| `staff.programme.divergence` | `/staff/programmes/{programme_id}/divergences` | `/programmes/:programmeId?tab=divergence` | coach, medical |
| `staff.compliance.weekly` | `/staff/compliance?window=last_week` | `/squad?view=week&period=last-week` | coach, medical |

The guard, in order, per `08-notifications.md` §7 resolution rules:

1. **Not authenticated**: store the resolved path as pending, run auth, resume. Survives a
   cold start and an install.
2. **Wrong organisation**: compare `data.org_id` with the session org. Switch with a visible
   confirmation, or land on home with "this is no longer available to you".
3. **Role check**: compare `data.required_roles` with the roles on the session, using the
   `roles` array for the target route id in the manifest in §9 as the authority. This is
   routing only. It is **not** authorisation: `CLAUDE.md` rule 2 stands, roles are resolved
   server-side and RLS returns nothing regardless of what the router does.
4. **Shell check**: the prefix picks the shell. A `/staff/...` link has no matching route in
   the athlete navigator at all, which is why a flag cannot open for an athlete. Structural,
   not defensive. `push_tokens.shell` means it should not have been delivered either.
5. **Resource gone**: render the empty state on the target's `parent` route, "That flag has
   been resolved". Not a 404 and not a spinner.
6. **Tap tracking**: write `notification_deliveries.opened_at`.

`/injuries/:injuryId` carries `medical` alone in its `roles`, so `staff.injury.reported` is
addressed to medical devices only and a coach who somehow receives it lands on `/injuries`
with an explanation rather than on a clinical record.

---

## 7. Context carried between routes

`02-information-architecture.md` §7 rule 2: every drill-down preserves context. Concretely:

| From | To | Carried how |
|---|---|---|
| A wellness flag on `/flags` | `/squad/:athleteId` | `?tab=wellness&from=&to=` taken from the flag's `flag_date` |
| The attention list on `/dashboard` | `/squad/:athleteId` | `?tab=` from `AttentionReason.domain` |
| The training report board | `/squad/:athleteId` | `?tab=gps&date=` from the session shown |
| `/squad` compliance cell | `/squad/:athleteId` | `?tab=&date=` |
| `/schedule` session card | `/schedule/:sessionId` | route param only; group and range inherit |
| `/injuries` row | `/injuries/:injuryId` | route param only |
| Fixture availability counts | `/injuries?fixture=` | search param, filters the board to that fixture |
| Any staff page | Any staff page | `group`, `team`, `from`, `to` are rewritten onto every internal navigation by the shell |

The athlete profile **opens on the thing you clicked**, per `19-page-flows.md` §3.20. If
`?tab=` is absent it opens on Overview. A drill-down that omits it is a bug, not a default.

---

## 8. How the shells differ

| Shell | App | Root | Rows or tabs |
|---|---|---|---|
| staff web | `apps/web`, Next.js App Router, `app/(dashboard)/` | `/dashboard` | The nine sidebar rows in §3 |
| staff phone | `apps/mobile`, expo-router, `app/(staff)/` | `/dashboard` | Five tabs: Dashboard, Schedule, Squad, Programmes, More, per `02-information-architecture.md` §4.6 |
| athlete phone | `apps/mobile`, expo-router, `app/(athlete)/` | `/today` | Four tabs: Today, My data, My programme, Me |

The five staff phone tabs are a phone affordance and not a concept in the product. They
group the same routes: Dashboard holds `/dashboard`, `/flags`, `/injuries`, `/squad`;
Schedule holds the `/schedule` tree; Squad holds `/squad/roster` and `/squad/:athleteId`;
Programmes holds `/programmes` and `/nutrition`; More holds `/analytics`, `/reports`,
`/leaderboards` and `/settings`. The paths do not change between shells. Routes with
`staff phone` absent from their `shells` array are not built for the phone: the template
editor, the programme builder, the query builder, the injury record, user management and the
export builder, all of which are desk work.

The shell is resolved server-side from roles by `resolveShell` in `05-architecture.md` §5. It
decides which navigator renders and grants nothing.

---

## 9. The manifest

**This block is the source of truth for routing.** The tables in §2 and the panel tables in
§4 are, in spirit, generated from it: where a table and this block disagree, this block is
right and the table is stale. Claude Code should be able to generate the router, the sidebar
active-state logic and the deep-link resolver from this block alone, without reading the
prose above.

`spec` is null where no specification exists, and every null is accounted for in §11.
`shells` is an array because `/onboarding/:step` genuinely has two. `roles` is the set of
roles that may open the route, taken from `01-roles-and-permissions.md` §2. `role_notes`
narrows a role to aggregate access where the matrix says `A`. `panels` are the panel ids
bound in §4.

```json
{
  "version": 1,
  "generated_from": ["docs/19-page-flows.md", "docs/02-information-architecture.md", "docs/01-roles-and-permissions.md", "docs/04-data-model.md"],
  "conventions": {
    "path_case": "lower-kebab",
    "shell_relative": true,
    "deep_link_prefixes": { "athlete phone": "/athlete", "staff web": "/staff", "staff phone": "/staff" },
    "reserved_segments": {
      "/squad": ["roster"],
      "/schedule": ["timetable", "fixtures", "templates", "testing"],
      "/reports": ["training", "testing", "schedules", "runs"],
      "/programmes": ["exercises"],
      "/analytics": ["builder"],
      "/my-data": ["day", "boards"]
    },
    "search_params": ["group", "team", "from", "to", "period", "view", "tab", "domain", "status", "severity", "metric", "date", "q", "sort", "open"],
    "group_filter_disabled_on": ["staff.settings.imports", "staff.settings.users", "staff.settings.club"]
  },
  "sidebar": [
    { "id": "staff.dashboard", "label": "Dashboard", "route": "/dashboard", "icon": "LayoutDashboard", "roles": ["coach", "medical"] },
    { "id": "staff.squad", "label": "Squad overview", "route": "/squad", "icon": "Users", "roles": ["coach", "medical"] },
    { "id": "staff.schedule", "label": "Schedule", "route": "/schedule", "icon": "CalendarDays", "roles": ["coach", "medical"] },
    { "id": "staff.reports", "label": "Reports", "route": "/reports", "icon": "FileText", "roles": ["coach", "medical", "admin"] },
    { "id": "staff.nutrition", "label": "Nutrition", "route": "/nutrition", "icon": "Salad", "roles": ["coach", "medical"] },
    { "id": "staff.programmes", "label": "Gym programme", "route": "/programmes", "icon": "Dumbbell", "roles": ["coach", "medical"] },
    { "id": "staff.leaderboards", "label": "Leaderboard", "route": "/leaderboards", "icon": "Trophy", "roles": ["coach", "medical", "admin"] },
    { "id": "staff.analytics", "label": "Analytics", "route": "/analytics", "icon": "LineChart", "roles": ["coach", "medical"] },
    { "id": "staff.settings", "label": "Settings", "route": "/settings", "icon": "Settings", "roles": ["coach", "medical", "admin"] }
  ],
  "routes": [
    { "id": "athlete.today", "screen": 1, "name": "Today", "path": "/today", "spec": "docs/screens/today.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": null,
      "panels": ["sync-mark", "week-strip", "availability-banner", "to-do-list", "todays-sessions", "report-a-problem"] },
    { "id": "athlete.checkin", "screen": 2, "name": "Morning check-in", "path": "/check-in", "spec": "docs/screens/wellness-entry.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.today",
      "panels": ["direction-line", "sleep-stepper", "feeling-scales", "body-map", "optional-block", "submit-entry"] },
    { "id": "athlete.rpe", "screen": 5, "name": "How hard was it", "path": "/rpe/:sessionId", "spec": "docs/screens/training-entry.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.today",
      "panels": ["session-context", "rpe-scale", "duration-stepper", "rpe-note", "submit-rating"] },
    { "id": "athlete.nutrition-checkin", "screen": 45, "name": "Weekly protein question", "path": "/nutrition-check-in", "spec": "docs/screens/nutrition-checkin.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.today",
      "panels": ["iso-week-label", "protein-question", "answer-triad", "checkin-note", "checkin-done"] },
    { "id": "athlete.gym-session", "screen": 4, "name": "Gym session, logging", "path": "/gym/:sessionId", "spec": "docs/screens/gym-logging.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.today",
      "panels": ["session-preview", "load-resolution-warning", "live-header", "exercise-focus", "set-rows", "last-time", "rest-timer", "session-overflow"] },
    { "id": "athlete.my-data", "screen": 6, "name": "My data", "path": "/my-data", "spec": "docs/screens/my-data.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": null,
      "panels": ["section-tabs", "period-selector", "headline-tiles", "domain-chart", "submitted-days", "gym-history", "testing-history", "entry-list"] },
    { "id": "athlete.my-data.day", "screen": 6, "name": "One day's entry", "path": "/my-data/day/:entryDate", "spec": "docs/screens/my-data.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.my-data",
      "panels": ["entry-day-detail"] },
    { "id": "athlete.boards", "screen": 26, "name": "Boards I am on", "path": "/my-data/boards", "spec": "docs/screens/leaderboards.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.my-data",
      "panels": ["my-board-list"] },
    { "id": "athlete.board", "screen": 26, "name": "One board", "path": "/my-data/boards/:leaderboardId", "spec": "docs/screens/leaderboards.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.boards",
      "panels": ["board-ranking"] },
    { "id": "athlete.programme", "screen": 7, "name": "My programme", "path": "/programme", "spec": "docs/screens/my-programme.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": null,
      "panels": ["availability-banner", "rehab-phase-card", "milestones", "programme-header", "this-weeks-sessions", "nutrition-target-card", "paused-notice", "ad-hoc-session"] },
    { "id": "athlete.nutrition-guidance", "screen": 3, "name": "Nutrition guidance", "path": "/programme/nutrition", "spec": "docs/screens/nutrition-guidance.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.programme",
      "panels": ["targets-today", "guidance-accordion", "provenance-line"] },
    { "id": "athlete.me", "screen": 29, "name": "Me", "path": "/me", "spec": "docs/screens/settings.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": null,
      "panels": ["settings-list-athlete", "minor-transparency-note"] },
    { "id": "athlete.me.profile", "screen": 29, "name": "Edit my profile", "path": "/me/profile", "spec": "docs/screens/settings.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.me",
      "panels": ["profile-form"] },
    { "id": "athlete.me.notifications", "screen": 29, "name": "Notifications", "path": "/me/notifications", "spec": "docs/screens/settings.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.me",
      "panels": ["notification-preferences"] },
    { "id": "athlete.me.privacy", "screen": 43, "name": "Privacy and my data", "path": "/me/privacy", "spec": "docs/screens/settings.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.me",
      "panels": ["privacy-panel", "account-deletion"] },
    { "id": "athlete.me.export", "screen": 31, "name": "Export my data", "path": "/me/export", "spec": "docs/screens/exports.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.me",
      "panels": ["athlete-export-panel"] },
    { "id": "athlete.me.leaderboards", "screen": 26, "name": "My leaderboard opt-ins", "path": "/me/leaderboards", "spec": "docs/screens/leaderboards.md", "shells": ["athlete phone"], "roles": ["athlete"], "parent": "athlete.me",
      "panels": ["board-opt-in-list"] },
    { "id": "onboarding", "screen": 33, "name": "Onboarding", "path": "/onboarding/:step", "spec": "docs/screens/onboarding.md", "shells": ["athlete phone", "staff web"], "roles": ["athlete", "coach", "medical", "admin"], "parent": null,
      "panels": ["onboarding-welcome", "credential-step", "details-step", "squad-details-step", "transparency-step", "transparency-step-child", "optional-extras-step", "reminder-step"] },

    { "id": "staff.dashboard", "screen": 8, "name": "Dashboard", "path": "/dashboard", "spec": "docs/screens/dashboard.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": null,
      "panels": ["header-filters", "availability-strip", "not-fully-available", "attention-list", "todays-timetable", "wellness-compliance", "injury-board"] },
    { "id": "staff.flags", "screen": 10, "name": "Flags", "path": "/flags", "spec": "docs/screens/flags.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.dashboard",
      "panels": ["domain-tabs", "flag-filter-bar", "flag-card", "retune-offer"] },
    { "id": "staff.flag", "screen": 10, "name": "One flag", "path": "/flags/:flagId", "spec": "docs/screens/flags.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.flags",
      "panels": ["flag-card", "flag-context-chart", "flag-action-bar"] },
    { "id": "staff.injuries", "screen": 12, "name": "Injury dashboard", "path": "/injuries", "spec": "docs/screens/injury-dashboard.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "role_notes": { "admin": "aggregate counts only, no names" }, "parent": "staff.dashboard",
      "panels": ["board-timeline-toggle", "availability-counts", "injury-board-list", "clinical-columns", "set-availability-sheet", "return-timeline", "board-nav-links"] },
    { "id": "staff.injury", "screen": 13, "name": "Injury record", "path": "/injuries/:injuryId", "spec": "docs/screens/injury-record.md", "shells": ["staff web"], "roles": ["medical"], "parent": "staff.injuries",
      "panels": ["injury-header", "shared-block", "clinical-block", "availability-row", "rehab-tab", "athlete-view-tab", "history-tab"] },
    { "id": "staff.rehab-groups", "screen": 42, "name": "Rehab groups", "path": "/injuries/rehab-groups", "spec": "docs/screens/rehab-groups.md", "shells": ["staff web"], "roles": ["medical", "coach"], "role_notes": { "coach": "read only, membership and meeting time, and the limited injury view: body area and side, restrictions, expected return. Never clinical detail. CORRECTED 2026-09-09 — this note said \"no body area\", which contradicted screens/28-rehab-groups.md and the shipped screen; rehabGroups.ts flagged the conflict and read it as a stale early draft, and Isabella confirmed that reading" }, "parent": "staff.injuries",
      "panels": ["unallocated-list", "rehab-group-card", "rehab-members", "phase-mismatch", "assign-rehab-programme"] },
    { "id": "staff.team-allocation", "screen": 14, "name": "Team allocation", "path": "/injuries/team-allocation", "spec": "docs/screens/team-allocation.md", "shells": ["staff web"], "roles": ["coach", "medical"], "role_notes": { "medical": "read only, may change availability, may not allocate or publish" }, "parent": "staff.injuries",
      "panels": ["allocation-week-bar", "allocation-pool", "not-allocatable", "team-lanes", "lane-warnings", "publish-allocation", "copy-last-week"] },
    { "id": "staff.squad", "screen": 9, "name": "Squad overview", "path": "/squad", "spec": "docs/screens/squad-status.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": null,
      "panels": ["day-week-toggle", "domain-tabs", "compliance-summary", "missing-list", "due-complete-waived", "chase", "week-grid", "who-i-can-pick"] },
    { "id": "staff.squad.roster", "screen": 19, "name": "Squad list", "path": "/squad/roster", "spec": "docs/screens/squad-list.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.squad",
      "panels": ["roster-toolbar", "group-filter-banner", "athlete-rows", "bulk-action-bar", "add-athlete"] },
    { "id": "staff.athlete", "screen": 20, "name": "Athlete profile", "path": "/squad/:athleteId", "spec": "docs/screens/athlete-profile.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.squad",
      "panels": ["athlete-identity", "availability-line", "load-block", "wellness-block", "prescribed-vs-completed", "injury-availability-season", "testing-block", "restrictions", "open-flags", "nutrition-tab", "gps-tab", "quick-actions"] },
    { "id": "staff.schedule", "screen": 15, "name": "Schedule", "path": "/schedule", "spec": "docs/screens/schedule.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": null,
      "panels": ["view-toggle", "planned-load-bars", "day-blocks", "session-cards", "new-session-sheet", "move-confirmation", "apply-template"] },
    { "id": "staff.schedule.timetable", "screen": 11, "name": "Timetable and register", "path": "/schedule/timetable", "spec": "docs/screens/timetable.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule",
      "panels": ["day-strip", "session-cards-with-counts", "restriction-warning", "mark-all-present", "attendance-rows"] },
    { "id": "staff.schedule.fixtures", "screen": 41, "name": "Fixtures list", "path": "/schedule/fixtures", "spec": null, "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule",
      "panels": ["fixture-list"], "gap": "G-2" },
    { "id": "staff.fixture", "screen": 17, "name": "Fixture detail", "path": "/schedule/fixtures/:fixtureId", "spec": "docs/screens/fixture-detail.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule.fixtures",
      "panels": ["fixture-card", "md-anchor-strip", "availability-now", "selection-tab", "publish-squad", "sessions-this-week"] },
    { "id": "staff.schedule.templates", "screen": 18, "name": "Week templates", "path": "/schedule/templates", "spec": "docs/screens/md-planner.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.schedule",
      "panels": ["template-list"] },
    { "id": "staff.schedule.template", "screen": 18, "name": "Template editor", "path": "/schedule/templates/:templateId", "spec": "docs/screens/md-planner.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.schedule.templates",
      "panels": ["template-load-chart", "template-day-blocks", "required-entry-ticks", "apply-preview", "commit"] },
    { "id": "staff.schedule.testing", "screen": 25, "name": "Testing sessions", "path": "/schedule/testing", "spec": "docs/screens/testing.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule",
      "panels": ["upcoming-sessions", "edit-battery", "print-sheet"] },
    { "id": "staff.testing.log", "screen": 25, "name": "Logging grid", "path": "/schedule/testing/:sessionId/log", "spec": "docs/screens/testing.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule.testing",
      "panels": ["logging-grid", "excused-toggle"] },
    { "id": "staff.session", "screen": 16, "name": "Session detail", "path": "/schedule/:sessionId", "spec": "docs/screens/session-detail.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.schedule",
      "panels": ["session-header", "planned-load", "required-entries", "participants", "attendance-tab", "load-tab", "attached-programme", "gym-floor-view"] },
    { "id": "staff.reports", "screen": 28, "name": "Reports", "path": "/reports", "spec": "docs/screens/reports.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "role_notes": { "admin": "club level totals with no names" }, "parent": null,
      "panels": ["report-cards", "import-entry-point", "recent-runs"] },
    { "id": "staff.reports.training", "screen": 37, "name": "Training report", "path": "/reports/training", "spec": "docs/screens/training-report.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.reports",
      "panels": ["training-report-tiles", "date-chips", "metric-selector", "training-report-board", "export"] },
    { "id": "staff.reports.testing", "screen": 25, "name": "Testing results", "path": "/reports/testing", "spec": "docs/screens/testing.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.reports",
      "panels": ["testing-results-history"] },
    { "id": "staff.reports.schedules", "screen": 28, "name": "Report schedules", "path": "/reports/schedules", "spec": "docs/screens/reports.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.reports",
      "panels": ["report-schedule-list"] },
    { "id": "staff.reports.run", "screen": 28, "name": "Report viewer", "path": "/reports/runs/:runId", "spec": "docs/screens/reports.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "role_notes": { "admin": "club level totals with no names" }, "parent": "staff.reports",
      "panels": ["report-pager", "export", "clinical-report-pages"] },
    { "id": "staff.nutrition", "screen": 24, "name": "Nutrition", "path": "/nutrition", "spec": "docs/screens/nutrition-plans.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "role_notes": { "medical": "may edit targets for an athlete with an open injury" }, "parent": null,
      "panels": ["mass-against-load", "suppressed-rows", "squad-body-composition", "target-grid", "weekly-checkin", "prompt-list"] },
    { "id": "staff.programmes", "screen": 23, "name": "Gym programme", "path": "/programmes", "spec": "docs/screens/gym-programmes.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "role_notes": { "medical": "rehab programmes only, may not edit a coach-owned gym programme" }, "parent": null,
      "panels": ["status-tabs", "programme-cards", "by-athlete-view", "new-programme"] },
    { "id": "staff.programme-builder", "screen": 22, "name": "Programme builder", "path": "/programmes/:programmeId", "spec": "docs/screens/programme-builder.md", "shells": ["staff web"], "roles": ["coach", "medical"], "role_notes": { "medical": "rehab programmes only" }, "parent": "staff.programmes",
      "panels": ["exercise-library", "programme-tree", "exercise-editor", "missing-best-lift", "assign-tab", "tailor-tab", "divergence-tab"] },
    { "id": "staff.exercises", "screen": 22, "name": "Exercise library", "path": "/programmes/exercises", "spec": "docs/screens/programme-builder.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.programmes",
      "panels": ["exercise-library"] },
    { "id": "staff.leaderboards", "screen": 26, "name": "Leaderboard", "path": "/leaderboards", "spec": "docs/screens/leaderboards.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "role_notes": { "admin": "board and participant counts only, no names against values" }, "parent": null,
      "panels": ["board-list", "new-board", "refused-metric"] },
    { "id": "staff.leaderboard", "screen": 26, "name": "Board detail", "path": "/leaderboards/:leaderboardId", "spec": "docs/screens/leaderboards.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.leaderboards",
      "panels": ["board-ranking", "publish-board", "hide-from-one-player"] },
    { "id": "staff.analytics", "screen": 27, "name": "Analytics", "path": "/analytics", "spec": "docs/screens/analytics.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": null,
      "panels": ["preset-panels"] },
    { "id": "staff.analytics.preset", "screen": 27, "name": "One preset", "path": "/analytics/:presetId", "spec": "docs/screens/analytics.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.analytics",
      "panels": ["drift-ranked", "sources-listed", "refused-answer", "export"] },
    { "id": "staff.analytics.builder", "screen": 27, "name": "Query builder", "path": "/analytics/builder", "spec": "docs/screens/analytics.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.analytics",
      "panels": ["query-builder", "correlation"] },
    { "id": "staff.settings", "screen": 29, "name": "Settings", "path": "/settings", "spec": "docs/screens/settings.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "parent": null,
      "panels": ["settings-list-staff"] },
    { "id": "staff.settings.profile", "screen": 29, "name": "Profile", "path": "/settings/profile", "spec": "docs/screens/settings.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "parent": "staff.settings",
      "panels": ["profile-form"] },
    { "id": "staff.settings.notifications", "screen": 29, "name": "Notifications", "path": "/settings/notifications", "spec": "docs/screens/settings.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "parent": "staff.settings",
      "panels": ["notification-preferences"] },
    { "id": "staff.settings.thresholds", "screen": 30, "name": "Thresholds", "path": "/settings/thresholds", "spec": "docs/screens/thresholds.md", "shells": ["staff web", "staff phone"], "roles": ["coach"], "parent": "staff.settings",
      "panels": ["threshold-summary", "retune-notice", "rule-rows", "rule-editor"] },
    { "id": "staff.settings.imports", "screen": 34, "name": "Import GPS", "path": "/settings/imports", "spec": "docs/screens/imports.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical"], "parent": "staff.settings",
      "panels": ["import-drop-area", "session-match", "units-check", "import-exceptions", "import-commit"] },
    { "id": "staff.settings.import", "screen": 34, "name": "One import", "path": "/settings/imports/:batchId", "spec": "docs/screens/imports.md", "shells": ["staff web"], "roles": ["coach", "medical"], "parent": "staff.settings.imports",
      "panels": ["import-exceptions", "import-commit"] },
    { "id": "staff.settings.exports", "screen": 31, "name": "Exports", "path": "/settings/exports", "spec": "docs/screens/exports.md", "shells": ["staff web"], "roles": ["coach", "medical", "admin"], "parent": "staff.settings",
      "panels": ["export-builder", "locked-rows", "export-history"] },
    { "id": "staff.settings.groups", "screen": 21, "name": "Groups", "path": "/settings/groups", "spec": "docs/screens/groups.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "parent": "staff.settings",
      "panels": ["group-cards", "players-in-no-group"] },
    { "id": "staff.settings.group", "screen": 21, "name": "Group detail", "path": "/settings/groups/:groupId", "spec": "docs/screens/groups.md", "shells": ["staff web", "staff phone"], "roles": ["coach", "medical", "admin"], "parent": "staff.settings.groups",
      "panels": ["group-members", "group-settings-tab"] },
    { "id": "staff.settings.users", "screen": 32, "name": "User management", "path": "/settings/users", "spec": "docs/screens/user-management.md", "shells": ["staff web"], "roles": ["admin"], "parent": "staff.settings",
      "panels": ["user-table"] },
    { "id": "staff.settings.user", "screen": 32, "name": "One user", "path": "/settings/users/:userId", "spec": "docs/screens/user-management.md", "shells": ["staff web"], "roles": ["admin"], "parent": "staff.settings.users",
      "panels": ["roles-checkboxes", "athlete-link", "permission-preview", "deactivate"] },
    { "id": "staff.settings.club", "screen": 29, "name": "Club details", "path": "/settings/club", "spec": "docs/screens/settings.md", "shells": ["staff web"], "roles": ["admin"], "parent": "staff.settings",
      "panels": ["org-settings-form"] },
    { "id": "staff.settings.billing", "screen": 29, "name": "Billing", "path": "/settings/billing", "spec": "docs/screens/settings.md", "shells": ["staff web"], "roles": ["admin"], "parent": "staff.settings",
      "panels": ["org-settings-form"] },
    { "id": "staff.settings.retention", "screen": 29, "name": "Retention and erasure", "path": "/settings/retention", "spec": "docs/screens/settings.md", "shells": ["staff web"], "roles": ["admin"], "parent": "staff.settings",
      "panels": ["org-settings-form", "audit-log"] }
  ]
}
```

---

## 10. How to use this when building a screen

In this order. Skipping a step is how a screen ends up right in isolation and wrong in the
product.

1. **`docs/19-page-flows.md`, the section for your page.** What is on it, what you can press,
   what expands, what opens on top, and who can change it. Read it first because it is the
   only document written from the user's side, and it is what the client signed off. If your
   screen disagrees with it about behaviour, it wins.
2. **This file.** The route path, the parent, the shell, the panel list, the component name
   per panel, the query name and the tables it reads. Take the names from here verbatim,
   including the route id, because notifications, tests and analytics events reference it.
3. **`docs/screens/<screen>.md`.** Layout, states, empty states, error states, offline
   behaviour, validation, edge cases and the real queries. This is where the detail lives and
   this file deliberately does not repeat it.
4. **`docs/01-roles-and-permissions.md` §2.** Check the `roles` array in §9 against the
   matrix before you write a single guard, and write the permission test before the rule, per
   `CLAUDE.md` §5. A coach never reaches clinical detail: `injury_clinical` is not joined, not
   selected and not reachable on any coach-facing route in this document.

Then, before opening a pull request: the group filter is in the URL and in every query key
(§6.2), the route appears in the manifest in §9, and the screen has no edit control for a role
that cannot edit, rather than a disabled one.

---

## 11. Gaps

Everything a panel above needs that does not exist in `04-data-model.md`, including §17, or in
`docs/screens/`. Nothing here has been invented into the tables above. Each gap is named `G-n`
and referenced from the panel that needs it.

| Gap | What is missing | Who needs it | What to do |
|---|---|---|---|
| **G-1** | `02-information-architecture.md` §4.2 defines an admin dashboard panel order. `01-roles-and-permissions.md` §2 gives admin `no` for "View squad dashboard". Both cannot be true. | `/dashboard`, §5 | Route roles follow the matrix, so admin does not open `/dashboard` at v1. Ask the client which is right. Raise with O-1101. |
| **G-2** | Screen 41, the fixtures list, has no specification. Only `fixture-detail.md` exists. Recorded in `02-information-architecture.md` §5 and O-727. | `/schedule/fixtures` | Write `docs/screens/fixtures.md` before building the route. Do not infer it from the detail screen. |
| **G-3** | `fixture_selections` is named in `04-data-model.md` §17.13 as the answer to "who starts and who is on the bench" and referenced by `fixture-detail.md` and O-232, but no `create table` for it exists anywhere in the schema. | Selection tab on `/schedule/fixtures/:fixtureId` | Specify the table in §17 before building the selection tab. `team_allocations` answers which team, not starting against bench, and must not be overloaded. |
| **G-4** | `nutrition_guidance` and `meal_ideas` are referenced by `nutrition-guidance.md` as §17.14, which was never written. O-971. | Around training, meal ideas and the matchday plan on `/programme/nutrition` | The targets panel is buildable from `nutrition_targets`. The guidance content panels are not. Write §17.14 first. **Partially superseded, 28 August 2026**: the meal-ideas panel is now real, built on `meal_library`/`meal_library_items` (migration 0051, athlete read added by 0054) instead of the never-written `meal_ideas` — see `nutrition-guidance.md`'s own amended note. "Around training" and the matchday plan are still blocked on §17.14 exactly as before; this gap is not fully closed. |
| **G-5** | `notification_preferences` and `push_tokens` are defined in `08-notifications.md`, not in `04-data-model.md`, which `CLAUDE.md` §1 names as the schema document. | `/me/notifications`, `/settings/notifications`, the reminders step of onboarding | Move or mirror both into `04-data-model.md` §17 so one document is the schema. |
| **G-6** | No table holds a per-user appearance preference. Theme and the dark or light toggle appear on the header and in `settings.md`, and `organisations.settings` is organisation-wide. | Appearance rows on `/settings` and `/me` | Either declare appearance device-local and say so, or add a user preference table. Do not write it into `organisations.settings`. |
| **G-7** | `import_batch_rows`, `athlete_import_aliases` and the `import_batch_status`, `import_row_status` and `alias_match_method` enums are named in `04-data-model.md` §17.8 as belonging to `07-integrations.md` and are not created in the schema document. | Exceptions list and remembered aliases on `/settings/imports` | The import screen cannot show per-row exceptions or remember an alias without them. Land them in §17 with Phase 2. |
| **G-8** | Screen 35, the audit log viewer, has no specification. `audit_log` exists and every clinical read writes to it. | `/settings/retention`, audit panel | Specification held for a later phase per `19-page-flows.md` §5. The table is there when it is written. |
| **G-9** | Screen 36, athlete report a problem, has no specification and no table. The entry point exists on Today. | "Something not right?" on `/today` | The button is specified, the destination is not. Do not invent a messages table: `CLAUDE.md` §7 says Fydr is not a messaging app. Ask first. |
| **G-10** | Screen 44, data requests, has no specification. | Admin queue, no route defined here | Held for Phase 1a. No route is asserted for it in §9. |
| **G-11** | `athlete_consents` is referenced by `04-data-model.md` §17.16 as the place a consent grant is checked, and no `create table` exists. `athletes.consent_given_at` and `consent_version` carry one consent, not a set. | Optional extras on onboarding, privacy panel on `/me/privacy` | Specify the table. The Children's Code work in §17.16 assumes it. |
| **G-12** | Four screen specs declare a route in their header: `dashboard.md` `/staff/dashboard`, `timetable.md` `/staff/timetable`, `flags.md` `/staff/flags`, `training-report.md` `/staff/training-report`. This document drops the `/staff` prefix on the staff web app, per §2.1 rule 1. | Those four screens | Update the four headers to point at this file. The prefix survives only in deep links, §6.4. |
| **G-13** | The Chase action sends a reminder. The outbox that sends it, `notification_outbox`, is in `08-notifications.md`, not in `04-data-model.md`. Same defect as G-5. | Chase on `/squad` | Resolve with G-5. |
| **G-14** | No route or table exists for the head coach's standalone "who I can pick" view. It is drawn on `/squad` as a panel, and whether it earns its own route is O-1040. | `who-i-can-pick` panel on `/squad` | Buildable now as a panel from `availability`, `injuries.body_area` and `athletes.position`. If it earns a route, it is `/squad/selection`, which is why `selection` should be treated as a reserved segment. |

Two things worth stating that are **not** gaps, because they are decisions rather than
omissions. `nutrition_entries` exists and is dormant, and no route in this document reads it
(`CLAUDE.md` rule 8). `sessions.requires_nutrition` exists and is dead, and no panel reads or
writes it.
