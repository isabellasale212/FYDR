# 47. Settings

## 1. Page name and URL

**Settings**, at `/settings`.

Two things in one screen: a person's own account, and the club's administration.
What each role sees differs more here than anywhere else in the app.

## 2. Who can access this page

| Role | Can reach | What they see | What they change | Hidden or masked | Tier | Enforced |
|---|---|---|---|---|---|---|
| Sport scientist | Yes | Their own account **and every administration block** | Their profile, password, two factor login, club details, and the links to users, audit, retention and subject access | None | Base, with the Plan card showing the package | Route guard, then per block checks at `src/app/(staff)/settings/page.tsx:377` onward |
| Coach | Yes | Their own account, the Plan card, integrations and exports | Their profile, password, two factor login | The users, audit, retention, club details and subject access blocks | Base | Same |
| Medic | Yes | Their own account, plus the subject access block | Their profile, password, two factor login | The users, audit, retention and club details blocks | Base | Same, plus `:389` |
| S&C | Yes | Their own account | Their profile, password, two factor login | Every administration block | Base | **NOT BUILT** |
| Nutritionist | Yes | Their own account | Their profile, password, two factor login | Every administration block | Base | **NOT BUILT** |
| Athlete | **No** | Nothing here. Athletes have their own account screen in their own app | Nothing | The whole page | n/a | Middleware, then guard, then database |

**Every role opens Settings**, because it holds their own password and two factor
login. The administration blocks are simply absent for those without them.

**Verified access, from the code.** This page's real gates, in the order they run, are: `requireStaff()` at `src/app/(staff)/settings/page.tsx:44`; a product package check at `src/app/(staff)/settings/page.tsx:47`; a product package check at `src/app/(staff)/settings/page.tsx:53`. Above them sits the middleware (`src/lib/supabase/middleware.ts:84`) and beneath them row level security.

## 3. How you get here

- Settings, the ninth sidebar item.
- Redirected here when refused elsewhere, with a reason in the address.

## 4. What you see

**Your own account**: name, phone, avatar, password, and two factor login. Some
roles are required to have two factor login enabled.

**The Plan card**, naming the club's package, read only.

**Integrations**, including the GPS vendor and the Apple Health connection, which
is a Premium feature.

**Exports and imports**, as links.

**Administration blocks**, for the sport scientist only in the agreed model:
users, the audit log, data retention, subject access requests, and the club's own
details.

## 5. Every number on this page

None. Settings displays configuration, not measurements.

## 6. Every thing you can act on

| Element and label | Where it sits | What happens | Where it goes | What it writes | Permission | Confirmation | Hidden when |
|---|---|---|---|---|---|---|---|
| Edit your profile | Account | Changes your name and phone | Stays here | Updates your user record | Any staff, for themselves only | Form submission | Never |
| Upload an avatar | Account | Sets your picture | Stays here | Uploads a file, at most 2 MB | Any staff, for themselves | Form submission | Never |
| Change password | Account | Sets a new password | Stays here | Changes your sign in | Any staff, for themselves | Form submission | Never |
| Two factor login | Account | Enrols or manages a second factor | Stays here | Registers a factor | Any staff, for themselves. **Required for some roles** | Yes | Never |
| Club details | Administration | Changes the club's name, sport, timezone, country and logo | Stays here | Updates the organisation | **Sport scientist only** in the agreed model | Form submission | Absent for everyone else |
| Users, Audit, Retention, Subject access | Administration | Open those screens | Their own addresses | Nothing | As each screen | None | Absent for everyone else |
| Groups, Thresholds, Notifications, Exports, Imports | Links | Open those screens | Their own addresses | Nothing | As each screen | None | Never |
| Plan preview switch | Plan card | Lets Fydr's own staff view the product on the lower package | Stays here | Sets a browser cookie | **Fydr staff only, identified by email address, not by role** | None | Absent for a club's own staff |

**Roles are granted, never self selected.** Nothing on this screen lets a person
change their own role.

**The plan preview is not the club's.** It exists so Fydr's own people can see
what a Base club sees, and it can only ever resolve downward. A club's own
administrator does not get it, deliberately
(`src/app/(staff)/settings/page.tsx:48`).

## 7. How this page is built, in plain English

Built on the server. Each administration block is decided before it is rendered,
so a block a person may not use is never sent to their browser.

The Plan card shows the club's real package even when a preview is active, and
says so, so nobody mistakes a preview for a downgrade.

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
