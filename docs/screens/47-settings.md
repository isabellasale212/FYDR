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
phone) at the foot of the You card with "Ends this session on this browser
only" beside it.

**One level down.**

- **`/settings/club`** — eyebrow "Settings · Club". The **Plan card**, exactly as
  it was on the hub: the package sentence ("Premium · GPS, the training report
  and the analytics bar chart are on."), the plan-compare columns, and the
  preview switch for Fydr's own staff, which says when a preview is active. The
  **Integrations card**: Catapult reads **"Import files"** (A7) — a CSV file
  drop, never a live connection; **there is no Apple Health row**
  (`docs/platform-decision.md`, 13 September 2026: removed from the product, not
  deferred). For the sport scientist only, the **Club details** form (name,
  sport, timezone, country, logo). The sidebar's and the plan gate's "see the
  plan" links point at `/settings/club#plan`.
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
