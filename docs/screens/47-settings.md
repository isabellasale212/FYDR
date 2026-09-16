# 47. Settings

## 1. Page name and URL

**Settings**, at `/settings`.

Two things in one screen: a person's own account, and the club's administration.
What each role sees differs more here than anywhere else in the app.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden or masked | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Their own account **and every administration row** | Their profile, password, two factor login, club details, and the links to users, audit, retention and subject access | None | Base, with the Plan card showing the package | Route guard, then per row in `src/lib/settingsHub.ts` |
| Coach | Yes | Their own account, the Plan card, integrations and exports | Their profile, password, two factor login | The users, audit, retention, club details and subject access rows are closed with their reason | Base | Same |
| Medic | Yes | Their own account, plus the subject access row | Their profile, password, two factor login | The users, audit, retention and club details rows are closed with their reason | Base | Same |
| S&C | Yes | Their own account | Their profile, password, two factor login | Every administration block | Base | **NOT BUILT** |
| Nutritionist | Yes | Their own account | Their profile, password, two factor login | Every administration block | Base | **NOT BUILT** |
| Athlete | **No** | Nothing here. Athletes have their own account screen in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Every role opens Settings**, because it holds their own password and two factor
login. The administration blocks are simply absent for those without them.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` in `src/app/(staff)/settings/page.tsx`, then the per-row gates in `src/lib/settingsHub.ts`; the product package checks moved with the Plan card to `src/app/(staff)/settings/club/page.tsx`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Settings, the ninth sidebar item.
- Redirected here when refused elsewhere, with a reason in the address.

## 4. What you see

**Since 13 September 2026 (PATTERN-S8 C2) the hub is four groups on one
screen, and the long forms are one level down.** Before this the page was a
single scroll of every form and every list, over two screens tall on a desktop.
Now `/settings` is four cards side by side at desktop width (two across between
768 and 1200px, the dashboard's own boundary, one column on a phone), each a short list of destination rows,
and it fits one screen at 1440 × 900 for the sport scientist, who has the most
rows.

| Group | Rows, in order | Count shown on the row |
|---|---|---|
| **Club** | Setup checklist (sport scientist only, since C1) · Plan · Club details (sport scientist only) · Groups · Thresholds · Notifications | Setup checklist: "2 of 5 done" (warn until 5 of 5). Plan: the package word, "Previewing Basic — the real plan is Premium" while a preview is on. Groups: "N groups". Thresholds: "N active" |
| **People** | Users · Subject access requests · Data retention | Users: "N active accounts". Subject access: "N open" (requests not yet released) |
| **Data** | Vendor imports · Exports · Audit log | Imports: "N files", or the word "Premium" on a Basic club. Audit: "N in 90 days" |
| **You** | Profile and password, then the **Log out** button | "Two-factor on", "Two-factor required" (warn tone) or "Two-factor off" |

**Every row is one target for its whole width** (A2, 52px on desktop and 64px on
a phone), label on the left, count on the right, chevron after it. A row a role
may not open is not a greyed-out door and not a dead link: it renders with no
link and its reason as the second line — "Sport scientist only", "Sport
scientist or medic only", "Sport scientist, coach, S&C or medic only" (the
nutritionist and exports). A count carries its noun; there is never a bare
number. Rows whose count a role cannot read carry none.

**Two-factor required.** When a role that must have two-factor login has not
enrolled, a `role="alert"` banner sits above the four groups: "Your role
requires two-factor authentication · not enrolled. Set it up under Profile and
password." and links to
`/settings/profile#password`. The You card's count reads "Two-factor required".

**Log out is a button** (PATTERN-S8 A1): a bordered 44px `btn-ghost` (48px on a
phone) at the foot of the You card. The "Ends this session on this browser
only" line beside it went under the text rule on 16 September 2026 (category
1), as did the profile page's "Add an authenticator app (…) as a second
sign-in step." and the notifications page's "Preferences save instantly."
("In-app notifications are always on and can't be turned off here" stays: the
reason there is no toggle.)

**One level down.**

- **`/settings/club`** — eyebrow "Settings · Club". The **Plan card**, exactly as
  it was on the hub: the package sentence ("Premium · GPS, the training report
  and the analytics bar chart are on."), the plan-compare columns, and the
  preview switch for Fydr's own staff, which says when a preview is active. The
  **Integrations card**: Catapult reads **"Import files"** (A7) — a CSV file
  drop, never a live connection; **there is no Apple Health row**
  (`docs/platform-decision.md`, 13 September 2026: removed from the product, not
  deferred). The **Session RPE after training card** (`#rpe`, since 13
  September 2026, migration 0118, `organisations.collects_rpe`; retitled 14
  September, decision batch #4): a switch, on by default, that decides whether
  this club collects a session rating at all. Both consequences are printed
  on the card before the switch is pressed — on: athletes are asked for a
  session RPE after training, one rating of each session they were expected
  at on the CR-10 scale, and session load, the compliance figure, the
  training load report, the effort leaderboards and the analytics load
  presets rest on it; off: nobody is asked, nothing is expected, ratings
  already recorded stay, and each of those surfaces says "This club does not
  collect session RPE …" and who can switch it on, rather than showing an
  empty column or a zero (`docs/decisions/absence-rule.md`). **The card says
  what it does not cover**: "This is the session RPE after training. The
  per-set RPE in the gym logger and a programme's planned RPE are a lifting
  cue between an athlete and their S&C, feed none of the above, and are not
  switched off here." — so a club that switches it off and is still asked in
  the gym does not report a bug. The switch is the sport scientist's; every
  other role reads the state as a sentence. Each flip writes an audit row
  (`org.collects_rpe.changed`). The **Coaches and the injury site card**
  (`#injury-site`, since 13 September 2026, migration 0122,
  `organisations.coach_sees_injury_site`, PATTERN-S3 C8): a switch, **off by
  default**, that decides whether a coach reads where an athlete's injury is.
  Off: a coach reads the status word, the restriction line and the expected
  return — never the body site or the side, which stay with the medic, the
  sport scientist and the S&C, and with the athlete. On: a coach also reads the
  body site and side of an open injury on the injuries list, the squad list,
  the allocation and rehab boards and the injury report — never the diagnosis,
  the treatment notes or the protocol stage, whatever the setting says. Both
  positions are printed on the card before the switch is pressed. The database
  enforces it, not the screens: `body_area` and `side` are not readable at the
  `injuries` table by any signed-in reader; the `injuries_staff` view masks both
  to null for a coach while the setting is off (`injury_site_visible()`), and a
  masked site renders as the word "Injury". The switch is the sport
  scientist's; every other role reads the state as a sentence. Each flip writes
  an audit row (`org.coach_sees_injury_site.changed`). For the sport scientist
  only, the **Club details** form (name, sport, timezone, country, logo). The
  plan card's two columns read the plan page's inventory
  (`lib/premiumWords.ts`, `PREMIUM_INVENTORY`) and link to the page; the
  sidebar's and the phone shell's "Previewing Basic" links still point at
  `/settings/club#plan`, where the preview switch lives.
- **`/settings/plan`** — eyebrow "Settings · Club". **The plan page**
  (`docs/decisions/absence-rule.md`, "Where a basic club learns premium
  exists", 14 September 2026; built 15 September): **the one place a Basic
  club learns what Premium contains.** D-20 hides every wholly premium
  destination and shows a card for a premium region; nothing else in the
  product teases, and this page is where the absent things are named. Sport
  scientist only (the hub's Plan row is closed with its reason for everyone
  else; the URL refuses through the denied screen). Three cards: **This club
  is on Basic / Premium** — what that means in a sentence, when the plan last
  changed (the `org.tier.changed` audit row the tier trigger writes, 0126) and
  that the plan is changed with Fydr, not here; **What Premium contains** —
  the seven items of the inventory, each with one sentence (GPS import, GPS
  report, GPS on the athlete report, GPS leaderboards, GPS flags and
  thresholds, Analytics, Named support) and **the price as a placeholder**,
  drawn as one (the pending pattern) because it is not decided — never a
  number; **What is kept while the club is on Basic / Your GPS history** —
  from `premium_history_kept()` (0126, a definer read the sport scientist may
  make on any plan, counts and dates only): "598 GPS records from Tue 14 Jul to
  Sat 12 Sept are kept. They are hidden from every screen while the club is on
  Basic and return with Premium — nothing was deleted when the plan changed."
  (on Premium, the same figures with "if the club ever leaves Premium…"; with
  none, "This club holds no GPS records."), and that kept does not mean kept
  forever — GPS records age under the club's normal retention on any plan,
  with the link to Data retention. The GPS report and the imports area — wholly
  premium destinations — are absent from navigation on Basic and refuse at the
  URL through the denied screen (D-20 without exception, 15 September 2026);
  the region card a premium region inside a base page shows (`PlanGateCard`)
  sends "See what Premium contains" here.
- **`/settings/profile`** — eyebrow "Settings · You". Profile (name, club, role
  as words), avatar upload, the profile edit form, then under `#password` the
  change-password form and two-factor enrolment.

**Administration rows** — Users, Subject access requests, Data retention, Audit
log, Club details — are for the sport scientist only in the agreed model
(Subject access also opens for the medic). They are present for everyone as
rows so the shape of the screen does not change by role, but closed with their
reason; the destination behind each refuses at the URL as before.

## 5. Every number on this page

None. Settings displays configuration, not measurements.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Edit your profile | `/settings/profile` | Changes your name and phone | Stays there | Updates your user record | Any staff, for themselves only | Form submission | Never |
| Upload an avatar | `/settings/profile` | Sets your picture | Stays there | Uploads a file, at most 2 MB | Any staff, for themselves | Form submission | Never |
| Change password | `/settings/profile#password` | Sets a new password | Stays there | Changes your sign in | Any staff, for themselves | Form submission | Never |
| Two factor login | `/settings/profile#password` | Enrols or manages a second factor | Stays there | Registers a factor | Any staff, for themselves. **Required for some roles** | Yes | Never |
| Club details | `/settings/club` | Changes the club's name, sport, timezone, country and logo | Stays there | Updates the organisation | **Sport scientist only** in the agreed model | Form submission | Absent for everyone else |
| Session RPE after training switch | `/settings/club#rpe` | Turns the session rating on or off for the whole club; the database stops generating RPE expectations while it is off | Stays there | `organisations.collects_rpe` and an audit row | **Sport scientist only**; other roles read the state | None — reversible, and both consequences are on the card | Never absent: the sentence stands in for the switch |
| Plan | `/settings/plan` | Reads what the club is on, what Premium contains, the price placeholder, and what GPS history is kept | Stays there | Nothing | **Sport scientist only** | None | Closed row with its reason for every other role |
| Coaches and the injury site switch | `/settings/club#injury-site` | Decides whether a coach reads the body site and side of an open injury; the database masks both while it is off | Stays there | `organisations.coach_sees_injury_site` and an audit row | **Sport scientist only**; other roles read the state | None — reversible, and both positions are on the card | Never absent: the sentence stands in for the switch |
| Users, Audit, Retention, Subject access | People and Data groups | Open those screens | Their own addresses | Nothing | As each screen | None | Never absent: closed rows state their reason instead of linking |
| Groups, Thresholds, Notifications, Exports, Imports | Club and Data groups | Open those screens | Their own addresses | Nothing | As each screen | None | Never |
| Plan preview switch | Plan card at `/settings/club` | Lets Fydr's own staff view the product on the lower package | Stays there | Sets a browser cookie | **Fydr staff only, identified by email address, not by role** | None | Absent for a club's own staff |

**Roles are granted, never self selected.** Nothing on this screen lets a person
change their own role.

**The plan preview is not the club's.** It exists so Fydr's own people can see
what a Base club sees, and it can only ever resolve downward. A club's own
administrator does not get it, deliberately
(`src/app/(staff)/settings/club/page.tsx`).

## 7. How this page is built, in plain English

Built on the server. `src/lib/settingsHub.ts` (`settingsGroups`) decides the
four groups, every row's link or its closed reason, and every count, from the
person's roles and six counts the page reads (groups, active thresholds, active
accounts, open subject access requests, import files, audit rows in 90 days —
the last four only for roles that may open those rows). The hub itself holds no
form. The Plan card, on `/settings/club`, shows the club's real package even
when a preview is active, and says so, so nobody mistakes a preview for a
downgrade.

**Phone width (16 September 2026, the overnight queue, 2.6).** Below 768px the
hub hides Plan, Club details, Groups and Thresholds (the Club card keeps Setup
checklist and Notifications) and the whole People and Data cards; their routes
show "This setting is desktop-only" with a way back to Settings
(`SettingsPhoneNotice`, from `lib/settingsHub.ts`'s `PHONE_HIDDEN_ROUTES`).
Presentation, not permission: every gate in the table above stands
(`docs/access-matrix.md` §8).

## 8. States

**Preview active.** A banner says so. **Base package.** Premium integrations are
shown with an explanation rather than hidden. **Error.** Surfaces as an error.
**Offline.** Not handled.

## 9. Open issues

- **The administration blocks belong to admin today and must move to the sport
  scientist.** Decision D-07.
- **There is no billing surface.** Decision D-17. The Plan card says plan changes
  are a sales conversation.
- **There is no way to add an athlete to the squad from here or anywhere.**
  Decision D-16.
