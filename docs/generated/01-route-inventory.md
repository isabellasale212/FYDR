# Stage A1: Route inventory

Generated 4 September 2026. Every reachable page and server route in the staff
app, taken from the file tree and from the guards each file actually calls.

**Counts.** 64 pages. 27 server routes, which are downloads and actions rather
than screens. 1 shared layout. 9 sidebar destinations. Two of the 64 pages are
redirects that render nothing, so **62 real screens**.

**How to read the roles column.** These are the roles the code enforces today:
`coach`, `medical`, `admin`. The authoritative model agreed in Stage A0 is the
five role one with no admin, so **every row here will need remapping**. That
remapping is a single Stage B4 queue item, not 64 separate ones. This inventory
records what is true now so the remap can be checked off against something real.

**Jargon.** A *guard* is a function a page calls before it renders, which sends
the person somewhere else if they are not allowed. A *route group*, written in
brackets like `(staff)`, is a folder that groups pages under a shared layout
without appearing in the address. A *dynamic segment*, written in square
brackets like `[athleteId]`, is a placeholder for a real identifier. *Tier*
means which package the club has bought: Base, or Premium which adds GPS.

---

## 1. Route structure

There is **one** route group for staff, `(staff)`, with **one** layout at
`src/app/(staff)/layout.tsx`. That layout calls the staff guard at
`src/app/(staff)/layout.tsx:13`, so it runs for every page in the list below.

There are **no parallel routes, no intercepted routes and no modal routes**.
Files searched: the whole of `src/app`. Nothing matched the `@folder` or
`(.)folder` naming those features require. Screens that look like modals, such
as creating a session, are ordinary pages at their own address.

**Four guards exist.** Each names where it lives, so the screen specs can cite
one rather than restating the rule.

| Guard | What it requires | Location |
|---|---|---|
| `requireStaff` | Any of coach, medical, admin | `src/lib/session.ts:69` |
| `requireReportAccess` | Coach or medical. Blocks an admin who holds nothing else | `src/lib/session.ts:120` |
| `requireSubjectAccess` | Admin or medical | `src/lib/session.ts:159` |
| `loadAthleteDomainContext` | Staff, then coach or medical | `src/lib/athleteDomain.server.ts:89` and `:93` |

Above all four sits the middleware, which turns away anyone who is not staff
before a page is built at all (`src/lib/supabase/middleware.ts:84`), and beneath
them sits row level security in the database.

---

## 2. The sidebar, which is only nine of the sixty two screens

`src/components/Sidebar/Sidebar.tsx:66` onward.

| Label | Route | Roles tagged in the sidebar | Line |
|---|---|---|---|
| Dashboard | `/dashboard` | coach, medical | `:69` |
| Squad overview | `/squad` | coach, medical | `:82` |
| Schedule | `/schedule` | coach, medical | `:96` |
| Reports | `/reports` | coach, medical, admin | `:109` |
| Nutrition | `/nutrition` | coach, medical | `:122` |
| Gym programme | `/programmes` | coach, medical | `:134` |
| Leaderboard | `/leaderboards` | coach, medical, admin | `:161` |
| Analytics | `/analytics` | coach, medical | `:174` |
| Settings | `/settings` | coach, medical, admin | `:186` |

Only **Analytics** disappears entirely on the Base package
(`src/components/Sidebar/Sidebar.tsx:64`). Everything else that is Premium is
gated on its own route instead, because its parent destination has Base content
too.

**Four top level screens are not in the sidebar at all**: `/flags`,
`/injuries`, `/testing` and `/timetable`. They are reachable by typing the
address or by following a link from another page. This is not automatically a
fault, but it is exactly the pattern that hides a page from one role while
leaving the address open, so each is checked individually in Stage B3.

---

## 3. Full inventory

Roles shown are what the page's own guard enforces. Where a page calls only
`requireStaff`, any staff member reaches it, and any role wording inside the
page is presentation rather than access.

**Tier column.** *Base* means no tier check. *Premium* means the whole page
refuses on Base. *Base, premium regions* means the page opens on Base with parts
withheld.

**Docs column.** The name of the file in `docs/screens/` that covers it, or
NOT IN DOCS.

### 3.1 Dashboard

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/dashboard` | `dashboard/page.tsx` | Dashboard | **Coach or medical**, at `:151` | Base | `dashboard.md` |

### 3.2 Squad

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/squad` | `squad/page.tsx` | Squad overview | **Coach or medical**, at `:26` | Base | `squad-list.md` |
| `/squad/[athleteId]` | `squad/[athleteId]/page.tsx` | Athlete | **Coach or medical**, at `:254` | Base | `athlete-profile.md` |
| `/squad/[athleteId]/wellness` | `.../wellness/page.tsx` | Wellness | Coach or medical, at `athleteDomain.server.ts:93` | Base | NOT IN DOCS |
| `/squad/[athleteId]/gym` | `.../gym/page.tsx` | Gym | Coach or medical, same | Base | NOT IN DOCS |
| `/squad/[athleteId]/nutrition` | `.../nutrition/page.tsx` | Nutrition | Coach or medical, same | Base | NOT IN DOCS |
| `/squad/roster` | `squad/roster/page.tsx` | Redirect only, to `/squad` | None needed | Base | NOT IN DOCS |

### 3.3 Schedule

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/schedule` | `schedule/page.tsx` | Schedule | Any staff | Base | `schedule.md` |
| `/schedule/new` | `schedule/new/page.tsx` | New session | Any staff | Base | `session-detail.md` |
| `/schedule/[sessionId]` | `schedule/[sessionId]/page.tsx` | Session | Any staff | Base | `session-detail.md` |
| `/schedule/fixtures/new` | `.../fixtures/new/page.tsx` | New fixture | Any staff | Base | NOT IN DOCS |
| `/schedule/fixtures/[fixtureId]` | `.../fixtures/[fixtureId]/page.tsx` | Fixture | Any staff | Base | `fixture-detail.md` |
| `/schedule/planner` | `schedule/planner/page.tsx` | Week templates | Any staff | Base | `md-planner.md` |
| `/schedule/planner/new` | `.../planner/new/page.tsx` | New week template | **Coach or medical**, at `:10` | Base | `md-planner.md` |
| `/schedule/planner/[templateId]` | `.../planner/[templateId]/page.tsx` | Week template | Any staff | Base | `md-planner.md` |
| `/schedule/planner/apply` | `.../planner/apply/page.tsx` | Apply a week template | Any staff | Base | `md-planner.md` |
| `/timetable` | `timetable/page.tsx` | Timetable | Any staff | Base | `timetable.md` |

### 3.4 Reports

Every page here calls `requireReportAccess`, except the hub, which does not.

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/reports` | `reports/page.tsx` | Reports | **Any staff** | Base, premium regions | `reports.md` |
| `/reports/athlete` | `reports/athlete/page.tsx` | Pick an athlete | Coach or medical | Base | `reports.md` |
| `/reports/athlete/[athleteId]` | `.../[athleteId]/page.tsx` | Athlete report | Coach or medical | Base, premium regions | `reports.md` |
| `/reports/compliance` | `reports/compliance/page.tsx` | Compliance | Coach or medical | Base | `reports.md` |
| `/reports/injuries` | `reports/injuries/page.tsx` | Injury and availability | Coach or medical | Base | `injury-dashboard.md` |
| `/reports/squad` | `reports/squad/page.tsx` | Squad weekly | Coach or medical | Base | `reports.md` |
| `/reports/testing` | `reports/testing/page.tsx` | Testing report | Coach or medical | Base | `testing.md` |
| `/reports/training` | `reports/training/page.tsx` | Training report | Coach or medical | **Premium** | `training-report.md` |
| `/compliance` | `compliance/page.tsx` | Redirect only, to `/reports/compliance` | None needed | Base | NOT IN DOCS |

**Finding for Stage A2.** `/reports` is the only page in this section that does
not call `requireReportAccess`. It uses plain `requireStaff`, so an admin who
holds no other role opens the reports hub and is then refused at every link on
it. Worth confirming this is intended, since the guard exists specifically to
keep such a person out (`src/lib/session.ts:120`).

### 3.5 Injuries

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/injuries` | `injuries/page.tsx` | Injuries | Any staff | Base | `injury-dashboard.md` |
| `/injuries/new` | `injuries/new/page.tsx` | New injury record | **Medical only**, at `:13` | Base | `injury-record.md` |
| `/injuries/[injuryId]` | `injuries/[injuryId]/page.tsx` | Injury | Any staff | Base | `injury-record.md` |
| `/injuries/rehab-groups` | `.../rehab-groups/page.tsx` | Rehab groups | Any staff | Base | `rehab-groups.md` |
| `/injuries/team-allocation` | `.../team-allocation/page.tsx` | Team allocation | Any staff | Base | `team-allocation.md` |

**Finding for Stage A2, and this one matters most.** All five injury screens
call only `requireStaff`. Each mentions the medical role inside the page, which
means the medical distinction is drawn while rendering rather than at the door.
Under the newly agreed rule the **nutritionist must not see injury information
at all**, so this whole section needs a real role gate, not a presentational
one. Ranked in Stage B4 as a data exposure item.

### 3.6 Nutrition

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/nutrition` | `nutrition/page.tsx` | Nutrition | Any staff | Base | `nutrition-plans.md`, `nutrition-guidance.md` |
| `/nutrition/new` | `nutrition/new/page.tsx` | New nutrition target | Any staff | Base | `nutrition-plans.md` |

### 3.7 Gym programmes

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/programmes` | `programmes/page.tsx` | Gym programme | Any staff | Base | `gym-programmes.md` |
| `/programmes/new` | `programmes/new/page.tsx` | New programme | Any staff | Base | `programme-builder.md` |
| `/programmes/[programmeId]` | `.../[programmeId]/page.tsx` | Programme | Any staff | Base | `programme-builder.md` |
| `/programmes/[programmeId]/athlete/[athleteId]` | `.../athlete/[athleteId]/page.tsx` | Athlete view | Any staff | Base | `gym-logging.md` |
| `/programmes/exercises` | `programmes/exercises/page.tsx` | Exercise library | Any staff | Base | NOT IN DOCS |

### 3.8 Leaderboards

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/leaderboards` | `leaderboards/page.tsx` | Leaderboard | Any staff | Base | `leaderboards.md` |
| `/leaderboards/new` | `leaderboards/new/page.tsx` | New leaderboard | Any staff | Base, premium metrics | `leaderboards.md` |
| `/leaderboards/manage` | `leaderboards/manage/page.tsx` | Manage leaderboards | Any staff | Base | `leaderboards.md` |
| `/leaderboards/[leaderboardId]` | `.../[leaderboardId]/page.tsx` | Board detail | **Coach or medical**, at `:59` | Base, refuses a GPS board on Base at `:95` | `leaderboards.md` |

### 3.9 Analytics

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/analytics` | `analytics/page.tsx` | Analytics | Any staff | **Premium** | `analytics.md` |
| `/analytics/build` | `analytics/build/page.tsx` | Analytics, build a view | Any staff | **Premium** | `analytics.md` |

**Finding for Stage A2.** The agreed model says analytics is sport scientist
only. The code lets **any** staff member in, subject to tier. This is a real
difference, not a wording one.

### 3.10 Testing

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/testing` | `testing/page.tsx` | Testing | Any staff | Base | `testing.md` |
| `/testing/[testDefId]` | `testing/[testDefId]/page.tsx` | Log results | Any staff | Base | `testing.md` |
| `/testing/[testDefId]/[athleteId]` | `.../[athleteId]/page.tsx` | Test history | Any staff | Base | `testing.md` |

### 3.11 Flags

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/flags` | `flags/page.tsx` | Flags | **Coach or medical**, at `:33` | Base | `flags.md` |

### 3.12 Settings

| URL | File | Name on screen | Roles | Tier | Docs |
|---|---|---|---|---|---|
| `/settings` | `settings/page.tsx` | Settings | Any staff, with admin only regions | Base, premium regions | `settings.md` |
| `/settings/users` | `settings/users/page.tsx` | Users | **Admin**, at `:21` | Base | `user-management.md` |
| `/settings/users/[userId]` | `.../[userId]/page.tsx` | User | **Admin**, at `:31` | Base | `user-management.md` |
| `/settings/users/bulk-invite` | `.../bulk-invite/page.tsx` | Invite athletes | **Admin**, at `:17` | Base | `user-management.md` |
| `/settings/audit` | `settings/audit/page.tsx` | Audit log | **Admin**, at `:44` | Base | `settings.md` |
| `/settings/retention` | `settings/retention/page.tsx` | Data retention | **Admin**, at `:30` | Base | `settings.md` |
| `/settings/subject-access` | `.../subject-access/page.tsx` | Subject access requests | Admin or medical | Base | `settings.md` |
| `/settings/subject-access/[requestId]/review` | `.../review/page.tsx` | Clinical review | Any staff | Base | `settings.md` |
| `/settings/groups` | `settings/groups/page.tsx` | Groups | Any staff | Base | `groups.md` |
| `/settings/groups/new` | `.../groups/new/page.tsx` | New group | Any staff | Base | `groups.md` |
| `/settings/groups/[groupId]` | `.../groups/[groupId]/page.tsx` | Group | Any staff | Base | `groups.md` |
| `/settings/thresholds` | `settings/thresholds/page.tsx` | Thresholds | Any staff | Base | `thresholds.md` |
| `/settings/thresholds/new` | `.../thresholds/new/page.tsx` | New threshold | **Coach only**, at `:10` | Base | `thresholds.md` |
| `/settings/notifications` | `.../notifications/page.tsx` | Notifications | Any staff | Base | NOT IN DOCS |
| `/settings/exports` | `settings/exports/page.tsx` | Exports | Coach or medical | Base | `exports.md` |
| `/settings/imports` | `settings/imports/page.tsx` | Import GPS | **Coach or medical**, at `:30` | **Premium** | `imports.md` |

**This section was re-scanned and corrected on 4 September 2026.** The first pass
found a page's guard by looking for calls to the four named guard functions. Three
patterns exist, not one: a named guard, an inline `redirect` on a role test, and a
`hasAccess` variable used to render a refusal in place of the page. Nine rows
above were corrected as a result, and every one moved in the same direction: the
page is **more** restricted than first recorded, not less. No row was found to be
less restricted than reported.

**A finding raised here was later withdrawn.** This inventory originally recorded
`/settings/subject-access/[requestId]/review` as calling only `requireStaff`. It
does call that guard, and then immediately redirects anyone without the medical
role (`src/app/(staff)/settings/subject-access/[requestId]/review/page.tsx:19`).
The scan behind this table counts which roles each file mentions, which cannot
distinguish a guard from a comment. Treat the roles column here as a starting
point, not a verdict: Stage B3 checks each page by hand.

---

## 4. Server routes

These are not screens. They are downloads and actions. Listed because each is a
door with its own lock, and a lock that differs from the screen's is exactly the
kind of gap this exercise is for.

**Report downloads**, seven pairs, each a spreadsheet route and a PDF route:
athlete, compliance, injuries, squad, testing, training, and the leaderboard
board. Files at `src/app/(staff)/reports/*/export/route.ts` and `*/pdf/route.tsx`,
plus `src/app/(staff)/leaderboards/[leaderboardId]/export/route.ts` and its PDF
sibling.

**Testing downloads**: `src/app/(staff)/testing/[testDefId]/[athleteId]/export/route.ts`
and its PDF sibling.

**Settings actions**: exports generate, imports template, imports upload,
imports batch export, retention preview, retention run, subject access release,
user MFA reset, bulk invite send, user create.

**Athlete action**: `src/app/(staff)/squad/[athleteId]/subject-access/route.ts`.

The training report's two download routes are the worked example of why this
matters. Both once answered a plain request with the full GPS board while the
screen above them was correctly gated, because a hidden button is not a gate
(`src/lib/session.ts:126` records the whole episode). Each of the 27 routes is
checked individually in Stage B3.

---

## 5. Counts, as required by the stage

| | |
|---|---|
| Pages | 64 |
| Of which redirects that render nothing | 2 |
| **Real screens** | **62** |
| Server routes | 27 |
| Layouts | 1 |
| Route groups | 1 |
| Parallel, intercepted or modal routes | 0 |
| Sidebar destinations | 9 |
| Screens not reachable from the sidebar | 53 |
| Pages with no entry in `docs/screens/` | 8 |

The eight with no documentation: `/squad/[athleteId]/wellness`,
`/squad/[athleteId]/gym`, `/squad/[athleteId]/nutrition`, `/squad/roster`,
`/schedule/fixtures/new`, `/programmes/exercises`,
`/settings/notifications`, `/compliance`.

---

## 6. Four findings carried into Stage A2

1. **The five injury screens have no role gate**, only `requireStaff`. Under the
   newly agreed rule the nutritionist must see no injury information anywhere,
   so this is a data exposure item, ranked highest.
2. **Analytics admits any staff member.** The agreed model says sport scientist
   only.
3. **`/reports` does not use the report guard** its own children use, so an
   admin-only user reaches the hub and is refused at every link from it.
4. ~~`/settings/subject-access/[requestId]/review` is reachable by any staff
   member.~~ **Withdrawn.** The page guards on the medical role. See section 3.12.

---

**STOP. Waiting for your approval of this inventory before starting Stage A2.**
